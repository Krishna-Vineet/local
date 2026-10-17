# Backend changes required for CRM v2

CRM v2 (this repo) is built against a **v2 API contract** (`src/api/mock/server.js` implements
it 1:1, including RBAC, tenancy scoping, plan-limit and suspend/ban rules). The current backend
(see `backend/02-api-reference.md`) does not expose several of these endpoints and needs new
models. Below is exactly what must be added/changed. All routes assume the existing
`Authorization: Bearer <jwt>` auth and the existing `getOrgFilter` tenancy helper (which must
be made fail-closed for internal roles per P0 SEC-03).

Conventions: errors are `{ "error": "message" }` with the status code
(400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict).

---

## 1. New models (Mongo collections)

### `organizationStatus` (lifecycle state)
Stored on the `Organization` document:
```json
{
  "status": "active | suspended | banned",   // default "active"
  "suspendReason": "string | null",
  "suspendedAt": "ISO | null",
  "suspendedBy": "userId"
}
```
- `suspended`: CRM login restricted to a limited "account suspended" view; event creation,
  device registration and pair-unpair blocked.
- `banned`: CRM login fully blocked; booth pairing/connection blocked.
- Restore reverts to `active` and recomputes plan state.

### `trialExtensions` (on `Organization`)
```json
{ "trialExtensionCount": 0 | 1, "trialExtendedUntil": "ISO | null" }
```
Trial ends at `max(originalTrialEnd, trialExtendedUntil)`. A second extension is rejected.

### `Subscription` (new collection — server-owned billing lifecycle, P1)
```json
{
  "id": "ObjectId",
  "organizationId": "ObjectId",
  "plan": "starter | basic | professional | business | custom",
  "amount": 2999,                       // INR paid for this purchase
  "razorpayOrderId": "order_...",
  "razorpayPaymentId": "pay_... | null",
  "razorpaySignature": "string | null",
  "invoiceNo": "HAP-INV-2609-000421",
  "startDate": "ISO", "endDate": "ISO",
  "status": "paid | pending | failed",
  "createdBy": "userId", "createdAt": "ISO"
}
```
Plan *status* (trial/active/expiring_soon/expired/…) is **always computed** from this +
`organizationStatus` — never stored as a string.

### `Template` (new collection — global, platform-owned)
```json
{
  "id": "ObjectId",
  "name": "4x6 Duo",
  "category": "Classic",
  "description": "string",
  "imageScope": "general | specific",        // general = universal background, any layout
  "orientation": "portrait | landscape | strip | square | universal",
  "slotCount": 4,                            // 1 | 2 | 3 | 4 | 6 (0 for general)
  "canvas": { "width": 1200, "height": 1800 },
  "photoSlots": [{ "id": "slot-1", "x": 40, "y": 40, "width": 1120, "height": 730 }],
  "backgroundUrl": "https://cdn/.../bg.png | null",   // required in practice for general; optional art for specific
  "source": "manual | ai_generated",
  "status": "draft | published",
  "active": true,                            // disabled templates are not selectable
  "usage": 3,
  "createdBy": "userId", "createdAt": "ISO", "updatedAt": "ISO"
}
```
- `photoSlots` for `specific` templates **must be computed server-side** by the
  Architecture V1 slot engine (canvas grid with the **bottom 15% reserved for the
  branding footer**) — clients never send coordinates. The mock implements the engine in
  `src/lib/templates.js` (33 canonical layouts: 4x6/5x7/6x8 portrait, wide/strip
  landscape, 6x6 square).
- AI generation (`POST /api/platform/templates/ai-generate`) returns an **unsaved draft**
  (`{ draft }`); the client shows it in a preview and only persists it (as
  `source: "ai_generated"`, `status: "published"`) after the user clicks *Save to
  Templates*.
- Only `OWNER` / `PLATFORM_ADMIN` may create/update/delete (Support Manager has no access
  to the template surface). **Events reference `templateIds: [ObjectId]`** (multi-select,
  all active platform templates are shown at event creation).

### `Frame` (new collection — the platform frame catalogue)
```json
{
  "id": "ObjectId",
  "name": "Royal Black",
  "description": "string",
  "background": {
    "type": "solid | gradient",
    "colors": ["#191420"] ,                  // 1 for solid, 2 for gradient
    "pattern": "none | dots | stripes"
  },
  "text": "#FFFFFF",                          // footer/tagline colour on this frame
  "defaultPrice": 60                          // suggested ₹; orgs price freely
}
```
A **frame is the canvas a print is made on**: the background design carries the template's
photo slots, and the complete output print (photos + the 15% branding footer) is printed
on the frame. The catalogue is platform data — **only `OWNER` may add or remove frames**
(`PLATFORM_ADMIN` reads it for the same *Templates & Frames* screen). **A frame cannot be
removed while it is enabled (`allowed: true`) in any organization's defaults → 409.**
Orgs price each frame and switch booth availability in `OrganizationDefaults`.

### `OrganizationDefaults` (new collection — the single org config doc)
```json
{
  "organizationId": "ObjectId",   // unique
  "name": "Sunset Weddings",
  "logoUrl": "https://cdn/.../logo.png | null",
  "frames": [
    { "frameId": "ObjectId", "price": 50, "allowed": true }
  ],
  "boothTimeoutSec": 600
}
```
- **There is no `printPrice` / `downloadPrice` here and none anywhere in the CRM.** The
  per-frame `price` entries *are* the pricing surface — a guest's print cost is
  `frame.price` (plus any coupon discount computed server-side).
- `boothTimeoutSec` is the kiosk idle timeout, **in seconds** (10–86400).
- This doc stores **only** `allowed` + `price` per frame. The frame catalogue itself is
  platform data (`Frame`); when the backend reads this doc it should **merge in the full
  current catalogue** (frames the org has never touched appear as
  `{ frameId, price: <defaultPrice>, allowed: false }`) so newly added frames show up
  without the org re-saving, and removed frames never surface.

### `Event` (new/changed shape — per-layout event price snapshot, no passkey)
```json
{
  "id": "ObjectId",
  "organizationId": "ObjectId",
  "name": "Kapoor–Verma Wedding",
  "clientName": "Rohan Kapoor",
  "location": "ITC Maurya, New Delhi",
  "startDate": "ISO", "endDate": "ISO",
  "paused": false,
  "templateIds": ["ObjectId", "ObjectId"],   // multi-select from active platform templates
  "filters": ["warm", "bw", "vintage"],      // ⊆ the 8 photo filters (original, warm, cool,
                                             //   bw, vintage, neon, soft, party)
  "digitalCopy": true,                        // guests may receive a digital copy
  "layoutPrices": { "46:1": 80, "57:3": 120 }, // full effective event snapshot
  "branding": { "logoUrl": "https://cdn/... | null", "tagline": "Shubh Vivah" },
  "shortCode": "KAPWED",
  "createdAt": "ISO"
}
```
- **The event has NO `passkey`, NO scalar `printPrice`, and NO `frameIds`** — booth guest
  access is a booth-app concern. `layoutPrices` is copied from Organization Defaults when
  the event is created, overlaid with event-specific overrides, validated server-side, and
  stored in full so later default changes do not silently reprice the event.
- `branding.logoUrl` defaults to `null` (none); when set it renders in the 15% footer of
  every print alongside `branding.tagline`.

### `Coupon` (new collection — org-owned)
```json
{
  "id": "ObjectId",
  "organizationId": "ObjectId",
  "code": "WEDDING20",            // uppercase A-Z0-9, unique per org (case-insensitive)
  "type": "percentage | fixed",
  "value": 20,                    // % or ₹
  "quantity": 100,
  "usedCount": 3,                 // atomic $inc on redemption
  "expiryDate": "ISO",
  "eventIds": ["eventId"],        // [] = applies to all events
  "status": "active | paused",
  "createdAt": "ISO", "updatedAt": "ISO"
}
```
Redemption (booth): validate `active`, not expired, `usedCount < quantity`, and event scope —
in one transaction; then `$inc` `usedCount` atomically. **Never trust a client-computed
discount** (P0 SEC-07) — the server computes price from `OrganizationDefaults`.

### `Ticket` (new collection — guest support)
```json
{
  "id": "ObjectId",
  "organizationId": "ObjectId",
  "eventId": "ObjectId | null",
  "deviceId": "ObjectId | null",
  "category": "device | payment | photo | event | general",
  "subject": "string",
  "priority": "low | medium | high | urgent",
  "status": "open | in_progress | resolved | closed",
  "guest": { "name": "string", "contact": "string" },
  "messages": [ { "id": "ObjectId", "author": "string", "at": "ISO", "text": "string" } ],
  "resolution": "string | null",
  "createdAt": "ISO", "updatedAt": "ISO"
}
```

### `AuditLog` (new collection — append-only)
```json
{
  "id": "ObjectId",
  "actorId": "userId | null",     // null = system
  "organizationId": "ObjectId | null",  // null = platform-level
  "action": "platform.org.suspended",   // dotted, typed
  "entity": "organization",
  "summary": "Suspended vishal — reason: billing dispute",
  "severity": "info | warn | danger",
  "ip": "string | null",
  "at": "ISO"
}
```
Indexes: `(organizationId, at)`, `(actorId, at)`.

### `User` (changes to existing model)
- Add fixed `role` enum: `OWNER | PLATFORM_ADMIN | SUPPORT_MANAGER | ORG_ADMIN | ORG_MANAGER`
  (replace the caller-supplied role bug, P0 SEC-01).
- `organizationId` is set only for org roles; null for platform roles.
- Password resets generate a temp password server-side and return it **once**.

---

## 2. New / changed endpoints

Auth — `POST /api/auth/me`
- `GET /api/auth/me` → `{ token, user }` (refresh session; 401 if expired).

Auth — profile
- `PUT /api/auth/profile` body `{ name?, photoUrl? }` → `{ user }`
- `POST /api/auth/password` body `{ currentPassword, newPassword }` → 200

### Platform (scope = platform role; revenue = OWNER only)

- `GET /api/platform/dashboard`
  → `{ orgs: { total, active, trial, suspended, banned, expired },
       devices: { total, online, offline, operational },
       events: { active, upcoming },
       expiringSoon: [{ id, name, plan, daysLeft }],
       nearLimits: [{ id, name, deviceUsed, deviceLimit, eventUsed, eventLimit }],
       alerts: [{ kind, tone, text }],
       recentSignups: [{ id, name, plan, createdAt }] }`

- `GET /api/platform/revenue` (OWNER only)
  → `{ monthWise: [{ label, value }], quarterWise: [{ label, value }], yearOptions: [2026, 2025],
       net, fyRevenue, monthRevenue,
       orgs: [{ id, name, email, plan, planName, planStatus, expiry, daysLeft,
                revenue, revenueThisMonth, revenueFY }] }`

- `GET /api/platform/organizations?search=&status=&plan=&page=&limit=`
  → `{ items: [{ id, name, email, ownerName, ownerEmail, plan, planName, status,
                 planStatus, planExpiry, planDaysLeft, devices, onlineDevices, activeEvents,
                 createdAt, lastActiveAt }], page, pages, total }`
- `GET /api/platform/organizations/:id`
  → full detail: `organization, plan { planName, status, startDate, endDate, daysLeft,
     deviceLimit, eventLimit, amountPaid, invoiceNo }, subscription, devices[], events[],
     revenue { total }, suspendReason`
- `POST /api/platform/organizations/:id/suspend` body `{ reason }` (reason required) → 200
- `POST /api/platform/organizations/:id/ban` body `{ reason }` (reason required) → 200
- `POST /api/platform/organizations/:id/restore` → 200
  *(all three: OWNER only; audit-logged; blocks apply immediately to events/devices/booths)*

- `GET /api/platform/audit?search=&actor=&action=&page=&limit=`
  → `{ items: [{ id, at, actorId, actor, role, action, entity, summary, severity, ip }],
       page, pages, total, actors: [{ id, name, role }] }`

- `GET /api/platform/users` (OWNER) → `{ users: [{ id, name, email, role, status, lastLoginAt, createdAt }] }`
- `POST /api/platform/users` (OWNER) body `{ name, email, password, role: PLATFORM_ADMIN|SUPPORT_MANAGER }`
  → 201 `{ user }` (400 if role is Owner or org role; 409 on duplicate email)
- `PUT /api/platform/users/:id` body `{ status: "active"|"inactive" }` (OWNER) → `{ user }`.
  Any `name`, `email`, `role` or password field is rejected with 403; identity is self-managed.
- Password reset is self-service; there is no platform reset-password endpoint.

- `GET /api/platform/templates` (OWNER/PA manage; org roles read via `GLOBAL_TEMPLATES_USE`
  so the event editor can list them) → `{ templates: [...] }`
- `POST /api/platform/templates` (OWNER/PLATFORM_ADMIN) body
  `{ name, category?, description?, imageScope: general|specific,
     orientation?: portrait|landscape|strip|square, slotCount?: 1|2|3|4|6,
     backgroundUrl?: string|null, source: manual|ai_generated }`
  → 201 `{ template }`
  — for `specific` the server computes `canvas` + `photoSlots` from the slot engine
  (400 on invalid orientation/slotCount); `general` ⇒ `orientation: "universal"`,
  `photoSlots: []`.
- `POST /api/platform/templates/ai-generate` (OWNER/PLATFORM_ADMIN) body
  `{ prompt, imageScope, orientation?, slotCount? }` → `{ draft }`
  (an **unsaved** template-shaped draft incl. generated `backgroundUrl`; the client
  previews it and persists via the create endpoint after user approval)
- `PUT /api/platform/templates/:id` body `{ name?, category?, description?, active?, status? }` → `{ template }`
- `DELETE /api/platform/templates/:id` → 200 (409 if any event's `templateIds` includes it → "disable instead")

### Frames (platform catalogue — same *Templates & Frames* screen)
- `GET /api/platform/frames` (any platform role) → `{ frames: [{ ...Frame, enabledOrgs: 3 }] }`
- `POST /api/platform/frames` (**OWNER only**) body
  `{ name, description?, background: { type, colors[], pattern }, text?, defaultPrice? }`
  → 201 `{ frame }` (409 on duplicate name)
- `DELETE /api/platform/frames/:id` (**OWNER only**) → 200
  (409 while `enabledOrgs > 0` — disable it in those organizations' defaults first)

### Organization (scope = org role, tenant-scoped by org filter)

- `GET /api/org/dashboard`
  → `{ organization { name, contact, status },
       plan { plan, planName, status, startDate, endDate, daysLeft, deviceLimit, eventLimit },
       usage { deviceLimit, eventLimit, devicesUsed, eventsUsed },
       revenue { total, thisMonth, fy, byStatus: { paid, pending, failed },
                 monthWise: [{ label, value }] },        // ORG_ADMIN only — omit for ORG_MANAGER
       devices { total, online, offline, list: [...] },
       events { active: [], upcoming: [], paused: [], finished: [] },
       tickets { open, list: [] },
       warnings: [{ kind, tone, text }] }`

- `GET /api/org/revenue?eventId=&deviceId=` (ORG_ADMIN only)
  → `{ total, thisMonth, fy, byStatus: { paid, pending, failed },
       monthWise: [{ label, value }],
       byEvent: [{ id, name, status, prints, transactions, total }],
       byDevice: [{ id, name, online, prints, transactions, total }],
       events: [{ id, name }], devices: [{ id, name }] }`

- `GET /api/org/events?search=&status=`
  → `{ events: [{ id, name, clientName, location, startDate, endDate, status,
                  templateIds, filters, digitalCopy, layoutPrices, branding, assignedDevices: [{ id, name, online }],
                  deviceCount }], canCreate }`
- `POST /api/org/events` (both org roles) — **General + Customisation + event pricing + Branding**:
  body `{ name, clientName?, location?, startDate, endDate,
          digitalCopy?, filters?: string[], templateIds?: string[],
          layoutPrices?: Record<"familyId:slots", number>,
          branding?: { logoUrl?: string|null, tagline?: string } }`
  → 201 `{ event }`
  **Server checks (in order)**: required fields · end > start · org not suspended/banned ·
  plan not expired/not_subscribed · `activeCount < plan.eventLimit` (active = between start
  and end and not paused; finished never counts) · every `templateId` exists and is active ·
  every `filter` ∈ the 8-filter catalogue · every `layoutPrices` key resolves to a catalogue
  family/slot iteration and every value is ₹0–₹100000. The server merges defaults + overrides
  into a full saved snapshot. `shortCode` is auto-derived from the name.
- `PUT /api/org/events/:id` — same body/validations as create (partial allowed);
  branding/tagline can be edited at any time
- `POST /api/org/events/:id/pause` / `POST /api/org/events/:id/resume` → 200
- `DELETE /api/org/events/:id` — 409 while the event is `active` (pause first)
- `GET /api/org/devices` → `{ devices: [{ id, deviceUuid, deviceName, location, hardware,
  online, lastSeenAt, registeredAt, assignedEvent: { id, name, status } | null }],
  limit: { used, allowed }, canRegister }`
  *(read-only in CRM — registration happens in the booth app via the existing
  `booth-login` + UUID pairing; the device token is never returned to CRM users)*
- `POST /api/org/devices/:id/assign` body `{ eventId }` — 409 if event finished; writes audit
- `POST /api/org/devices/:id/unassign` → 200
- `DELETE /api/org/devices/:id` — 409 if assigned to an active event; unregisters the UUID

- `GET /api/org/tickets?status=&priority=` → `{ tickets: [...with event/device refs],
  counts: { open, in_progress, resolved, closed } }`
- `GET /api/org/tickets/:id` → `{ ticket }`
- `POST /api/org/tickets/:id/reply` body `{ message }` — open → in_progress
- `POST /api/org/tickets/:id/resolve` body `{ note? }` — sets `resolution`, status resolved
- `POST /api/org/tickets/:id/reopen` — resolved/closed → open

- `GET /api/org/defaults` (ORG_ADMIN + ORG_MANAGER read) → the defaults doc **with the full
  current frame catalogue merged in** (see model above)
- `PUT /api/org/defaults` (ORG_ADMIN only) body
  `{ name?, logoUrl?, boothTimeoutSec?: 10..86400, frames?: [{ frameId, price, allowed }] }`
  → the merged doc (400 on unknown frameId or out-of-range timeout)
- `GET /api/org/coupons` → `{ coupons: [...with event names, isExhausted, expired flags],
  events: [{ id, name }] }`
- `POST /api/org/coupons` body `{ code, type, value, quantity, expiryDate, eventIds }`
  → 201 `{ coupon }` (code normalised to uppercase A-Z0-9; 409 on duplicate)
- `PUT /api/org/coupons/:id` (same body) → `{ coupon }`
- `POST /api/org/coupons/:id/pause` / `POST /api/org/coupons/:id/activate`
- `DELETE /api/org/coupons/:id`
- `GET /api/org/team` → `{ members: [...], canManage }`
- `POST /api/org/team` body `{ name, email, password }` (ORG_ADMIN) → 201
  **role is always ORG_MANAGER — never client-supplied**
- `PUT /api/org/team/:id` body `{ name?, email? }`
- `POST /api/org/team/:id/deactivate` / `POST /api/org/team/:id/activate`
- `POST /api/org/team/:id/reset-password` → `{ tempPassword }`
- `GET /api/org/audit?search=&actor=&action=&page=&limit=` → same shape as platform audit

### Booth (existing endpoints — contract notes, no new code needed)
- `POST /api/booth/login` already returns device context; it must also reject devices whose
  org is `banned` (403) and return a read-only banner state when `suspended`.
- Device "registration" stays a booth-app action (UUID pairing). **No CRM route registers
  devices** — the old CRM's "Add device" with a manual deviceToken is gone for good (P0 SEC-05).

---

## 3. Cross-cutting rules the backend must enforce

1. **RBAC matrix is fixed server-side** — the exact matrix in `src/lib/roles.js`. No
   permission tables in the DB, no admin UI for them.
2. **`getOrgFilter` fails closed**: internal roles never receive an org filter that
   degenerates to `{}` (P0 SEC-03); org roles always receive `{ organizationId }`.
3. **Plan limits and org status are checked on the server** for every create/assign/mutate —
   the CRM's `canCreate`/403s are UX, not the source of truth.
4. **Every mutating platform/org action writes an `AuditLog` row** (actor, action, entity,
   summary, severity, ip). Failed logins write `platform.auth.failed` with severity `danger`.
5. **Razorpay keys/verification** for `Subscription` stay server-side; the CRM never sees raw
   gateway payloads — it only reads `Subscription` records (per the v2 contract above).
6. **Coupon redemption** is a single atomic transaction (validate + `$inc`) — P0 SEC-07.
   The print cost shown by a booth comes from the assigned event's validated `layoutPrices`
   snapshot (minus any server-computed coupon); Organization Defaults supplies its baseline.

---

## 4. v2.1 additions (this CRM release — mock implements all of these)

### 4.1 Forgot password (OTP-style) — public auth routes
```
POST /api/auth/forgot-password   { email }
  → 200 { ok: true, delivery: "email" }
```
- **Always 200** for any address — never reveal whether an account exists.
- Issues a 6-digit code, valid **10 minutes, single-use**.
- The real backend sends the code by **email AND SMS** (the CRM shows it on screen
  only when `delivery` is `"demo"` — a mode flag for sandbox previews).
```
POST /api/auth/reset-password    { email, code, newPassword }
  → 200 { ok: true } | 400 invalid/expired code | 400 password < 6 chars
```
- Store a hash of the code + expiry on the user; clear both on success.
- Audit: `platform.auth.forgot_password` (warn) and `platform.auth.password_reset` (warn).

### 4.2 Device rename + booth operator — org routes
```
PUT /api/org/devices/:id   { deviceName?, operatorName?, operatorPhone? }
```
- Perm: `organization.events.devices.manage` → **both ORG_ADMIN and ORG_MANAGER**.
- `deviceName` required non-empty; `operatorName`/`operatorPhone` nullable strings
  (phone ≤ 20 chars). The operator is the **on-ground booth worker, not a CRM user** —
  whoever assigns them records name + number so the whole team can reach them.
- Returns `{ device }` with the same shape as `GET /api/org/devices` rows.
- Audit: `device.updated` — "renamed X → Y", "operator A assigned/changed/removed".

### 4.3 Hardware telemetry — booth push route (public, device-scoped)
```
POST /api/booth/devices/:deviceUuid/telemetry
  { printsTotal, shutterCount, batteryPct,
    connections: { camera: boolean, printer: boolean, kioskScreen: boolean } }
  → 200 { ok, telemetry, connections }
```
- Authenticated by the **device UUID** (booth apps are not CRM users).
- The booth pushes periodically (heartbeat cadence); the server clamps values
  (counts ≥ 0, battery 0–100) and stamps `updatedAt`, refreshing `lastSeenAt`.
- The CRM **reads** stored `telemetry { prints, shutters, batteryPct, updatedAt }` and
  `connections { camera, printer, kioskScreen, updatedAt }` through `GET /api/org/devices`.
  It renders all three peripherals as green-tick / red-cross icon tiles and never computes
  or writes their state. Suggested Mongo shape: latest telemetry/connection sub-documents
  on `Device` plus an append-only history collection if per-day rollups are wanted later.

### 4.4 Support tickets created by the booth app — session context
```
POST /api/booth/tickets
{ organizationId, eventId?, deviceId?, subject, category?, priority?,
  guestName?, message?, session }
```
- `session` **must** include `phone` (validated) and ideally:
```
session: {
  id: "SES-…",
  phone: "+91 …",                       // collected from the guest at ticket time
  slot: { label, start, end },          // slot the guest picked (label + times)
  package: { templateId, templateName, frame, prints, digitalCopy },
  cameraClicks: 12,                     // shutter activations this session
  filtersUsed: ["warm", "bw"],          // what the guest customised
  payment: { utr, amount, status, method, at },   // txn ref when paid
  startedAt, endedAt
}
```
- The server resolves `templateId`/`eventId`/`deviceId` into display names
  (`session.package.templateName`, `session.event.name`, `session.device.name`)
  and stores the snapshot immutably on the ticket.
- The org reads it back on `GET /api/org/tickets/:id` as `ticket.session` — the
  CRM renders it as the read-only "Booth session" card in the ticket drawer.

## 5. Layout system & Template Library (this round — mock implements all of these)

The frame catalogue is **fully retired**. Templates are now anchored to a
shared **layout system**, and the platform's creation surface is the
**Template Library**.

### 5.1 The layout system (contract data)

Shared between CRM and booth app as `src/lib/layouts.js` (server-side it is
`require`d / bundled — it is plain data + pure functions):

- **16 layout families** (cut size | print sheet | image-slot counts), e.g.
  `Pocket Polaroid 46-23 (2×3 from 4×6, [1])`, `Classic Duo Strip 46-26
  (2×6 from 4×6, [3,4])`, … `Quad Strip Reel 812-68 (2×6 from 8×12, [3,4])`.
- Each `(family, slotCount)` pair is a **layout variant** with id
  `` `${familyId}-${'v'|'h'}${slots}` `` — **76 variants total** (portrait +
  landscape where the cut allows). Guests group/filter by orientation, cut
  dimension, image count and sheet size.
- Geometry helper `slotsForLayout(id)` → `{ canvas, photoSlots[], footer }`
  in layout units (250 px/inch); the **footer (bottom 15%) is reserved for
  the event's branding logos + tagline**.
- `PRICE_KEY(familyId, slots)` (`"57:3"`) and a `suggestedPriceMap()` are the
  single pricing namespace for guest-facing print prices.

### 5.2 Templates (breaking changes)

- Template documents lose `imageScope / orientation / slotCount /
  photoSlots / canvas / defaultPrice` and gain:
```
{
  id, name, description, category,
  layoutId: "57-v3",            // REQUIRED — the pinned layout variant
  componentId: "RoyalWedding",  // designer templates only (code registry)
  design: {                     // playground/AI templates only
    bg: { type: "gradient"|"solid"|"image", colors?, url? },
    accent, textColor, ornament, font, slotShape, titleBand, title, tagline
  },
  source: "designer" | "playground" | "ai_generated",
  active: true,                 // publish gate — see 5.4
  usage: 87                     // sessions rendered (display only)
}
```
- Seeds: **14 designer** (hand-written components in `src/templates/designer/*`),
  **2 AI-config** (`design` with generated SVG background art) and
  **1 playground** template.
- `GET /api/platform/templates` → `{ templates: [...] }`, each row enriched
  with `layout: { code, name, orientation, slots, sheets, canvas }`.

### 5.3 Template endpoints (replace the old Architecture-V1 ones)

| Method & path | Perm | Notes |
|---|---|---|
| `GET /api/platform/templates` | templates.use | orgs may read (event picker) |
| `POST /api/platform/templates` | templates.manage | body `{ name, layoutId!, category?, description?, design? }` → 201 `source:"playground"`, `active:true` |
| `POST /api/platform/templates/ai-generate` | templates.manage | `{ prompt, layoutId }` → `{ draft }` (deterministic palette + AI background, **nothing persisted**) |
| `PUT /api/platform/templates/:id` | templates.manage | partial; `layoutId` change → **409** if any event uses the template; publish/unpublish audited |
| `DELETE /api/platform/templates/:id` | templates.manage | **409** for `source:"designer"` or event-used; otherwise 200 |

Validation: `layoutId` must resolve to a real variant (400 otherwise).
Audit actions: `platform.template.created / published / unpublished /
updated / deleted`.

### 5.4 Publish gate (platform → org availability)

- A template with `active:false` is invisible/unusable for orgs.
- `POST /api/org/events` and `PUT /api/org/events/:id` reject any
  `templateIds[]` entry that is unknown **or** `active:false` (400).
- The CRM's Template Library page exposes a Published/Hidden toggle per
  template; designer templates can only be published/unpublished, never
  edited or deleted.

### 5.5 Organization Defaults — layout pricing (replaces frame pricing)

`GET/PUT /api/org/defaults` now carry **`layoutPrices`** instead of `frames`:

```
layoutPrices: { "46:1": 30, "46:4": 40, "57:1": 70, "57:3": 90, ... }
// key = PRICE_KEY(familyId, slotCount) → guest price in ₹
```

- `GET` returns the **full map**: server-suggested prices overlaid with the
  org's saved overrides (every family×slot iteration the org could offer).
- `PUT` accepts a **partial** map; each key is validated against
  `LAYOUT_FAMILIES` (family exists + slot count offered) and each price must
  be a finite number 0–100000 (400 otherwise). Unmentioned keys keep their
  current values.
- Organization Defaults is the baseline. Event creation copies the full effective map and
  allows overrides for that event; booth pricing uses the assigned event's saved map.

### 5.6 Event branding — sponsor/host/venue logos (0–15, optional)

Event create/update accept `branding.logos: string[]` (data-URIs / URLs) —
**not** the organization logo. They are the extra personalisation layer
(sponsors, host, venue, player teams — the "BMW/Audi/Ferrari at a race"
case) that each template places at its reserved footer positions.

- 0 logos is valid (blank); >15 → **400** ("A maximum of 15 logos per
  event"); non-string entries are filtered.
- Legacy `branding.logoUrl` is still accepted and normalised to
  `logos[0]`; responses always use `branding.logos`.
- `branding.tagline` renders beside the logos in the print footer.

### 5.7 Booth ticket session package

`session.package` becomes `{ templateId, templateName, layout, prints,
digitalCopy }` — the server resolves `templateName` and echoes `layout`
(e.g. `"4×6 · 1"`) as an immutable display snapshot.

## 6. Security round & account self-service (v2.2)

Full rationale in `SECURITY.md`. Contract deltas:

### 6.1 Sessions
* `POST /auth/login` → `{ token, user, expiresInMin }`. **429** `Too many failed attempts…` while locked (5 failures / 15 min per email, configurable). Wrong password → 401 (mock used to accept any 6+ chars).
* Tokens are opaque, server-tracked, expire after `SESSION_TTL_MIN` (default 480). Forged / expired → 401 on every guarded route.
* `POST /auth/logout` → `{ ok }` — revokes the presented token. Idempotent.
* Sessions are killed on: password change (except current), password reset (all), email change (except current), admin deactivation, admin email edit.

### 6.2 Password policy
`≥ 8 chars, ≥ 1 letter, ≥ 1 digit` → otherwise 400 with the policy message. Applies to `/auth/password`, `/auth/reset-password`, `POST /platform/users`, `POST /org/team`.
`POST /auth/password` now **requires** `currentPassword` (400 if wrong).

### 6.3 Change email (new)
* `POST /auth/email/change-request { newEmail, currentPassword }` → 400 wrong password / bad format, 409 taken, else `{ ok, delivery, newEmail }` (+ `code` in demo only). Sends 6-digit OTP to the NEW address, 10-min TTL.
* `POST /auth/email/change-confirm { code }` → `{ ok, user }` with the new email. Uniqueness re-checked at confirm.

### 6.4 Removed
* `POST /platform/users/:id/reset-password` and `POST /org/team/:id/reset-password` — **gone** (404). Admins never issue passwords; users self-reset via forgot-password.

### 6.5 Org Team & Roles
* `GET /org/team` → `{ members, canManage }` — readable by ORG_ADMIN and ORG_MANAGER.
* `POST /org/team { name, email, password, role }` — `role ∈ ORG_ADMIN|ORG_MANAGER` (400 otherwise). ORG_ADMIN only.
* `PUT /org/team/:id { name?, email?, role?, status? }` — role changes allowed; **409** when it would leave zero active admins; 400 on self-deactivate.
* `POST /org/team/:id/deactivate|activate` — same guards.
* New perm `organization.team.view` (ADMIN + MANAGER) alongside `organization.team.manage` (ADMIN).

### 6.6 Input guards
* Media fields (`photoUrl`, defaults `logoUrl`, `branding.logos[]`, template `design.bg.url`) accept only `https://`, `http://` or `data:image/*` → else 400.
* Free text sanitised (control chars stripped, length capped): names ≤ 80, emails ≤ 120, taglines ≤ 120.

### 6.7 Fixed
* `GET /platform/organizations/:id` previously fell through to the list handler and returned a paginated list; now returns the org detail object `{ ...org, plan, subscription, devices[], events[], revenue }`.

### 6.8 Environment
See `.env.example`. `VITE_MOCK=false` builds contain no mock code; `VITE_API_URL` base (empty = same origin).

## v2.3 — UPI payouts, org wallet, event × booth revenue

**Org defaults** (`GET/PUT /org/defaults`) gain:
- `upiId: string|null` — validated `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`. Guests are shown a `upi://pay?pa=<upiId>&pn=<orgName>&cu=INR` QR at the booth when direct mode is on. Wallet withdrawals are paid to this ID.
- `payoutMode: 'upi' | 'wallet'` — `upi` = guests pay the org UPI directly; `wallet` (default / "paused") = HappyPix collects and credits the org wallet. Turning `upi` on without a `upiId` → 400. Mode changes are audited (`organization.payout.mode_changed`).
- Response also carries `wallet: { balance }`.

**Payments** gain `settlement: 'upi' | 'wallet'` — stamped at pay time from the org's mode *then* (never recomputed retroactively). Booth-created support tickets (`POST /booth/tickets`) stamp `session.payment.settlement` the same way if the booth omits it.

**Wallet** — `GET /org/wallet` (ORG_ADMIN) → `{ balance, credited, withdrawn, processing, viaUpi, minWithdrawal: 500, withdrawals[], payout }`. `balance = credited − withdrawn(paid) − processing`.

**Withdrawals** — `POST /org/wallet/withdraw { amount }` (ORG_ADMIN only; managers 403). Whole rupees, `≥ 500`, `≤ balance`, requires a saved `upiId`; → 201 `{ withdrawal: { id, amount, upiId, status: 'processing', reference, requestedAt, paidAt, requestedBy }, wallet }`. Status moves `processing → paid|failed` when the bank settles (backend job). Audited.

**Revenue** (`GET /org/revenue`) gains `payout`, `wallet`, `settlement: { upi, wallet }` (paid only), `monthSplit[]` (per-month upi/wallet), and `matrix[]` — one row per **event × device** with `{ eventId, eventName, deviceId, deviceName, total, prints, transactions, viaUpi, viaWallet }` (`eventId` null = walk-in). Org dashboard `revenue` gains `payout`, `wallet { balance, processing, minWithdrawal }`, `viaUpi`, `viaWallet`.

New seed shape → `DB_VERSION = 7`.

## v2.4 — plan catalogue, platform support, protected team identity, event pricing

This section supersedes older pricing/team statements above where they conflict.

### Owner-managed `SubscriptionPlan`

```json
{
  "id": "ObjectId",
  "key": "business",
  "name": "Business",
  "description": "Higher limits for multi-city operators.",
  "price": 9999,
  "durationMonths": 6,
  "durationLabel": "6 months",
  "devices": 10,
  "events": 10,
  "active": true,
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

`key` is unique and immutable because organization/subscription records reference it. Hiding a
plan does not invalidate current subscribers. Plan limit reads must use this collection, not a
client constant.

- `GET /api/platform/plans` (OWNER) → `{ plans: [...with organizations, subscriptions] }`
- `POST /api/platform/plans` (OWNER) → 201 `{ plan }`
- `PUT /api/platform/plans/:id` (OWNER) → `{ plan }`; changing `key` → 400

### `PlatformSupportRequest`

```json
{
  "id": "ObjectId",
  "ticketNo": "HPX-2609-0003 | null",
  "organizationId": "ObjectId",
  "createdBy": "userId",
  "subject": "string",
  "category": "technical | billing | account | feature | other",
  "priority": "low | medium | high | urgent",
  "status": "new | denied | open | in_progress | resolved",
  "decision": { "type": "accepted | denied", "reason": "string | null", "by": "userId", "at": "ISO" },
  "messages": [{
    "id": "ObjectId", "authorId": "userId", "authorName": "string",
    "authorRole": "string", "side": "org | platform", "at": "ISO",
    "text": "string", "images": ["https://cdn/... or data:image in demo"]
  }],
  "reapplyCount": 0,
  "lastReapplication": { "text": "string", "images": [], "authorId": "userId", "at": "ISO" },
  "resolution": "string | null",
  "acceptedAt": "ISO | null",
  "resolvedAt": "ISO | null",
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

Production should upload images to object storage using signed URLs and persist only media URLs;
the mock accepts bounded `data:image/*` values. Limit each message to four validated images.

All platform roles may use the platform side; both organization roles may use their own tenant's
organization side.

Platform routes:
- `GET /api/platform/support?status=&search=` / `GET /api/platform/support/:id`
- `POST /api/platform/support/:id/accept { message? }` — `new → open`, atomically allocates
  the unique human ticket number
- `POST /api/platform/support/:id/deny { reason }` — reason required and org-visible
- `POST /api/platform/support/:id/reply { message?, images? }` — active tickets only
- `POST /api/platform/support/:id/resolve { resolution }` — platform only, note required
- `POST /api/platform/support/:id/reopen { message? }` — platform only, `resolved → in_progress`

Organization routes (always tenant-scoped):
- `GET /api/org/platform-support` / `GET /api/org/platform-support/:id`
- `POST /api/org/platform-support { subject, category, priority, message, images? }`
- `POST /api/org/platform-support/:id/reapply { message, images? }` — denied only, text required,
  returns to `new` review state and stores the response as `lastReapplication` so the platform
  review inbox shows the reason separately from the original request
- `POST /api/org/platform-support/:id/reply { message?, images? }` — accepted active tickets only

Organization routes intentionally have no resolve or reopen operation. A resolved ticket is
read-only until platform staff reopens it.

### Platform team identity protection

`PUT /api/platform/users/:id` accepts exactly `{ status: "active"|"inactive" }`. Owner attempts
to modify `name`, `email`, `role` or password are rejected. A member edits their own name/email
through authenticated self-service profile/email verification flows. Self-deactivation remains
blocked and deactivation revokes sessions.

### Event layout-price snapshot

`POST /api/org/events` and partial `PUT /api/org/events/:id` accept `layoutPrices`. On create:

1. Load the full server-suggested map.
2. Overlay the organization's saved default map.
3. Overlay the request's event overrides.
4. Validate every `familyId:slots` key and ₹0–₹100000 value.
5. Save the resulting full map on the event in the same transaction.

The booth must charge from the assigned event snapshot, never from a client-computed value. Event
updates retain unmentioned snapshot entries. Coupons remain server-computed after selecting the
event layout price.

New mock seed shape → `DB_VERSION = 9`.
