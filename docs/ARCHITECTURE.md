# HappyPix — System Architecture & Product Workflows

> **Audience:** engineers, architects, investors doing technical diligence, new senior hires.
> **Companions:** [`BACKEND_API_DATABASE.md`](BACKEND_API_DATABASE.md) · [`APPLICATIONS_CRM.md`](APPLICATIONS_CRM.md) · [`HARDWARE_PRINTING.md`](HARDWARE_PRINTING.md)
> **Last verified:** 2026-10-23, branch `arena/097e52ae-local`.

---

## Table of contents

1. [Architecture at a glance](#1-architecture-at-a-glance)
2. [Component responsibilities](#2-component-responsibilities)
3. [Communication flows (ports, protocols, contracts)](#3-communication-flows)
4. [User roles and permissions](#4-user-roles-and-permissions)
5. [The client → event → booth → attendee hierarchy](#5-the-client--event--booth--attendee-hierarchy)
6. [Core product workflows](#6-core-product-workflows)
7. [Data lifecycle and retention](#7-data-lifecycle-and-retention)
8. [Key technical decisions (and why)](#8-key-technical-decisions-and-why)
9. [Known limitations and deliberate debt](#9-known-limitations-and-deliberate-debt)
10. [Failure modes and system behaviour](#10-failure-modes-and-system-behaviour)

---

## 1. Architecture at a glance

### 1.1 Deployment view

```
                                   INTERNET
                                      │
        ┌─────────────────────────────┼──────────────────────────────┐
        │                             │                              │
   ┌────▼─────┐                 ┌─────▼─────┐                  ┌─────▼──────┐
   │ Website  │                 │    CRM    │                  │  Backend   │
   │ (Vercel) │                 │ (Vercel)  │                  │ (Vercel)   │
   │ React 18 │                 │ React 18  │                  │ Express 5  │
   └────┬─────┘                 └─────┬─────┘                  └─────┬──────┘
        │ /api                        │ /api (JWT)                   │
        │                             │                              │
   ┌────▼──────────────┐              │                              │
   │ Website Backend   │              │                              │
   │ (Vercel)          │              │                              │
   │ Express 5         │              │                              │
   └────┬──────────────┘              │                              │
        │                             │                              │
        └──────────────┬──────────────┴──────────────┬───────────────┘
                       │                             │
              ┌────────▼─────────┐          ┌────────▼──────────┐
              │  MongoDB Atlas   │          │   AWS S3 (ap-*)   │
              │  single database │          │ photos · assets   │
              │  23 collections  │          │ presigned URLs    │
              └──────────────────┘          └───────────────────┘
                       ▲
                       │ heartbeat 2 min · snapshot on revision change
        ┌──────────────┴───────────────┐
        │                              │
  ┌─────▼──────────┐            ┌──────▼─────────┐
  │ RN booth       │            │ Electron booth │
  │ Android · iPad │            │ (on-site LAN)  │
  │ (on-site LAN)  │            │ React 19       │
  │ RN + XState    │            └──────┬─────────┘
  └─────┬──────────┘                   │
        │                       Camera (UVC/CCAPI seam)
   Camera (CCAPI/USB/phone)      Printer (Win spooler / CUPS)
   Printer (IPP · Print Bridge · AirPrint stub)
```

### 1.2 Trust boundaries

| Boundary | Inside | Outside | Control |
|---|---|---|---|
| Browser ↔ API | CRM/website JS | Node API | JWT bearer (8 h), CORS allowlist, rate limits |
| Booth ↔ API | Booth device | Node API | Device token (hashed at rest), revocable, per-device |
| Renderer ↔ OS (Electron) | React renderer | Main process | `contextIsolation: true`, `nodeIntegration: false`, narrow preload IPC |
| Guest ↔ download | Anonymous browser | Website backend | 144-bit unguessable `downloadId`, 24 h TTL, presigned redirect |
| Payment provider ↔ API | Razorpay/Cashfree | Node API | Raw-body HMAC signature verification, idempotent order IDs |

### 1.3 Tenancy model

Single MongoDB database, **application-enforced tenancy**. Every tenant-scoped document carries a
mandatory `organizationId`. The auth middleware resolves `req.user.organizationId` from the JWT and
every query filters on it. Platform roles (Owner/Platform Admin/Support Manager) bypass the tenant
filter only on explicitly platform-scoped routes.

```
users.organizationId ──┐
                       ├──► organizations._id ──► events ──► devices ──► photos
organizationdefaults ──┘                       └──► coupons, guestdownloads, payments
```

No cross-tenant entity is ever addressable by a bare ID: a handler that accepts `:id` always
constrains by `organizationId` in the same query.

---

## 2. Component responsibilities

### 2.1 Main backend (`/backend`) — the system of record

| Responsibility | Implementation |
|---|---|
| Authentication | `routes/crm/auth.js` — bcrypt login, JWT issue, `/me`, password change, email change with OTP |
| Authorization | `middleware/auth.js` (`authenticate`, `requirePerm`), `middleware/deviceAuth.js` |
| Tenancy | Per-collection `organizationId` + query scoping |
| Plan catalogue & entitlement | `services/planService.js` — computed status, billing prices, device/event caps |
| Event & device CRUD | `routes/crm/org.js`, `routes/eventRoutes.js`, `routes/deviceRoutes.js` |
| Booth snapshot | `services/boothSnapshotService.js` — normalises templates → device pixel coords + `revision` hash |
| Booth session API | `routes/boothRoutes.js` — login, bootstrap, heartbeat, quote, payments, upload URLs, session complete, consent, support |
| Payments | `routes/paymentRoutes.js` — order create, verify, both webhooks, free/prepaid completion |
| Photo + delivery | `routes/boothRoutes.js` → `persistSessionPhoto`, `services/guestDownloadService.js`, `utils/s3.js` |
| Gallery & sharing | `routes/crm/org.js` gallery, `routes/photoShareRoutes.js`, `models/PhotoShare.js` |
| Support | `models/SupportTicket.js` (guest), `PlatformSupportRequest.js` (org → platform) |
| AI templates | `services/ai/*` — prompt classification, design JSON, FLUX backgrounds |
| Prepaid wallet | `models/Withdrawal.js`, `/api/org/wallet`, `/wallet/withdraw` |
| Audit | `utils/auditLogger.js` → `models/AuditLog.js` |
| Scheduled jobs | `services/CronService.js` |

### 2.2 Website backend (`/website-backend`) — public surface

Deliberately separate from the main API so a traffic spike on marketing (or a scraper) can never
starve booth heartbeats. Shares the **same MongoDB** for `subscriptionplans`, `organizations`,
`users`, `subscriptions`, `guestdownloads`.

| Responsibility | Route |
|---|---|
| Public plan catalogue + live discounts | `GET /api/plans` |
| Subscription checkout | `POST /api/checkout/order`, `POST /api/checkout/verify` |
| Guest download page data | `GET /api/downloads/:id` |
| Guest file stream (presigned) | `GET /api/downloads/:id/file/:kind` |
| Server-to-server download creation | `POST /api/internal/downloads` (shared secret) |
| Sales leads from contact form | `POST /api/leads` |
| Health | `GET /health` |

### 2.3 CRM (`/crm`) — operator console

21 screens in two families: `pages/platform/*` (Owner, Platform Admin, Support Manager) and
`pages/org/*` (Org Admin, Org Manager). Navigation, routing and API calls are all generated from a
single permission matrix in `src/lib/roles.js`. The in-browser mock backend
(`src/api/mock/server.js`) implements the same contract so the entire CRM can be demoed offline.

### 2.4 Booth clients

| Concern | RN booth — Android (`/client-app`) | RN booth — iPad (`/client-app/apps/booth/ios`) | Electron (`/electron`) |
|---|---|---|---|
| Process model | RN bridge, native modules (Kotlin) | RN bridge, no custom native modules yet | Renderer (React) + main (Node) with IPC |
| State | XState finite machine (`boothMachine.ts`) | Same code | React context + reducer, idle timers |
| Compositing | Skia (`RenderEngine`, `SkiaRenderAdapter`) | Same code | Canvas 2D (`utils/composite.ts`) |
| Camera | VisionCamera + Canon CCAPI + PTP seam | VisionCamera (front camera), CCAPI untested | `getUserMedia` + `reportCamera` telemetry |
| Printing | IPP / DNP Print Bridge / OS | **Print Bridge only**; AirPrint is a stub | PowerShell `System.Drawing` (Win), `lp` (macOS) |
| Kiosk lock | Lock Task Mode (device owner) | Guided Access / Single App Mode (MDM) | BrowserWindow `kiosk: true` |
| Offline | AsyncStorage snapshot + `offlineSyncService` | Same code | `services/cache.ts` + device store JSON |
| Platform notes | `dpm set-device-owner`, `10.0.2.2` host | `Info.plist` keys, Local Network permission, no `10.0.2.2` | — |

The 18 iPad-specific findings, the build steps and the lockdown recipe live in
[`IPAD_SUPPORT.md`](IPAD_SUPPORT.md); this table only records where the two RN targets diverge.

---

## 3. Communication flows

### 3.1 Ports and protocols

| Path | Protocol | Auth | Payload |
|---|---|---|---|
| CRM/website → main API | HTTPS JSON | JWT bearer | REST |
| Website → website backend | HTTPS JSON | none (public) | REST |
| Booth → main API | HTTPS JSON | `Authorization: Bearer <deviceToken>` | REST |
| Main API → S3 | HTTPS (SDK) | IAM user / instance role | PUT, presigned GET |
| Razorpay/Cashfree → API | HTTPS JSON | HMAC signature | Webhook |
| Gallery → API | HTTPS | JWT | REST (redirects to presigned S3) |
| Tablet on LAN → Electron print bridge | HTTP | none (LAN-scoped) | `POST /api/print` on `:9123` |
| App → printer | Spooler / CUPS / IPP:631 | OS | driver-managed |

### 3.2 The snapshot contract (the heart of offline capability)

```
CRM changes template/pricing/branding
        │
        ▼
boothSnapshotService builds:
  • devices pixel coordinate slots (x, y, w, h)
  • effective layoutPrices (event > org defaults > platform suggested)
  • allowed templates + asset URLs
  • branding logos, tagline, timeouts
  • revision = md5(canonical snapshot JSON)
        │
        ▼  GET /api/booth/bootstrap  (device token)
Booth stores snapshot + asset blobs locally
        │
        ▼  every 120 s
POST /api/booth/heartbeat  { currentRevision, hardware }
        │
        ├── upToDate: true   → no download, no wasted bandwidth
        └── upToDate: false  → booth re-fetches only when revision differs
```

The revision is a **content hash, not a timestamp**: two identical payloads never trigger a
re-download, and any meaningful change always does.

### 3.3 Payment flow (on-booth)

```
Booth                          Backend                        Provider
  │  POST /booth/checkout/quote   │                              │
  │──────────────────────────────►│ price from event snapshot    │
  │◄──────────────────────────────│ { amount, currency, ... }    │
  │  POST /booth/payments         │                              │
  │──────────────────────────────►│ create order / UPI QR        │
  │                               │─────────────────────────────►│
  │◄──────────────────────────────│ { paymentId, qr, link }      │
  │  (guest scans / pays)         │                              │
  │                               │◄──────── webhook ────────────│
  │                               │ verify HMAC, mark paid       │
  │  GET /booth/payments/:id      │                              │
  │──────────────────────────────►│                              │
  │◄──────────────────────────────│ status: paid                 │
  │  camera unlocks               │                              │
```

Two independent confirmations exist: booth polling **and** the signed webhook. A session cannot be
printed on an unpaid order, and cannot be double-charged because order creation is keyed on
`sessionId`.

### 3.4 Session completion and delivery

```
POST /booth/sessions/upload-urls     → presigned S3 PUT URLs (individuals + composite)
     booth uploads bytes to S3
POST /booth/sessions/complete
     body: { photos: [url | {url, isComposite}], compositeUrl, ... }
        │
        ├─► photoTasks: create/update Photo docs (url, compositeUrl, sessionId, eventId, deviceId)
        ├─► persistSessionPhoto → S3 object (data URLs fall back to server-side upload)
        ├─► guestDownloadService.create → GuestDownload { downloadId, expiresAt: +24 h }
        ├─► digital token / PhotoShare (if enabled)
        └─► response { shareUrl, downloadId, expiresAt }
        │
        ▼
Booth renders QR → https://<website>/download/<downloadId>
        │
        ▼
Guest opens page → website-backend → presigned GET → 302 to S3
```

**Composite-first gallery rule:** the CRM gallery groups rows by `sessionId` and displays
`compositeUrl || url`. The booth therefore uploads the *final composited frame* of a multi-slot
template alongside the individual captures; otherwise a 3-slot session would show one raw frame as
the session's cover.

---

## 4. User roles and permissions

### 4.1 The five roles

| Role | Scope | Can do | Cannot do |
|---|---|---|---|
| **Owner** | Platform | Everything: revenue, plans, organizations (suspend/ban/restore), internal team, global templates, audit, leads | — |
| **Platform Admin** | Platform | Dashboard, organizations (read), support, global templates, gallery settings, audit | Revenue, plans, team creation, org suspend/ban |
| **Support Manager** | Platform | Platform dashboard, organizations (read-only), organization support tickets | Templates, plans, revenue, mutations |
| **Org Admin** | One org | Events, devices, revenue, wallet, defaults, coupons, team, gallery, guest tickets | Platform screens, other orgs |
| **Org Manager** | One org | Events, devices, guest/org support, gallery (read) | Revenue, coupons, defaults edit, team, audit |

**There is no `BOOTH_OPERATOR` role.** A booth is not a user; it is a device identified by
`deviceUuid` and authenticated with a device token. This is deliberate: operators change shift, but
the hardware identity must not.

### 4.2 Three-layer enforcement

```
Layer 1 — Navigation    src/lib/roles.js → sidebar renders only permitted entries
Layer 2 — Router        router.jsx redirects forbidden paths to the role home
Layer 3 — API            requirePerm(PERMS.X) returns 403 + writes an AuditLog
```

Because the matrix is a single exported constant used by the mock server *and* mirrored in
`backend/routes/crm/*`, UI and API cannot silently disagree. `backend/tests/permissions.parity.test.js`
asserts that parity in CI.

### 4.3 Computed, never stored

Organization status is **derived** on every read by `planService.js`:

```
banned flag            → 'banned'
suspended flag         → 'suspended'
no plan / trial ended  → 'expired'
expires within 7 days  → 'expiring_soon'
trial window active    → 'trial'
otherwise              → 'active'
```

Storing it would require a nightly job and would drift; deriving it means a payment landing at
23:59 grants access at 23:59.

### 4.4 Writable-org guard

Every mutating org route is wrapped in `requireWritableOrg`, which rejects
`expired | suspended | banned` tenants with `402/403` and a machine-readable code. Read-only access
is preserved so an expired customer can still export their data — a deliberate churn-reduction and
GDPR-alignment decision.

---

## 5. The client → event → booth → attendee hierarchy

```
PLATFORM (HappyPix)
│
├── ORGANIZATION (tenant = a photo-booth business)
│   ├── OrganizationDefaults     ← baseline prices, logos, timeouts, UPI, gateway keys
│   ├── Users (Org Admin, Org Manager)
│   ├── Subscription             ← plan, expiry, limits, add-ons
│   ├── Wallet                   ← prepaid balance, withdrawals
│   │
│   ├── CLIENT / EVENT (one booking: wedding, gala, corporate activation)
│   │   ├── name, client name, venue, dates, status, paused
│   │   ├── layoutPrices         ← FROZEN copy of defaults at creation
│   │   ├── templateIds          ← allowed templates for this event
│   │   ├── filters              ← allowed edit styles
│   │   ├── branding             ← logo, tagline, up to 15 sponsor logos
│   │   └── shortCode / passkey  ← guest pairing UX
│   │
│   ├── BOOTH DEVICE (hardware, not a person)
│   │   ├── deviceUuid (persistent installation identity)
│   │   ├── assignedEventId
│   │   ├── telemetry (camera, printer, kiosk screen)
│   │   └── lastSeenAt (heartbeat health)
│   │
│   └── ATTENDEE / GUEST (anonymous, session-scoped)
│       ├── SESSION (sessionId = one guest run)
│       │   ├── captures (Photo.url)
│       │   ├── composite (Photo.compositeUrl)
│       │   ├── Payment (if paid)
│       │   ├── GuestDownload (24 h TTL)
│       │   └── SupportTicket (if they raised an issue)
│       └── CONSENT (guestConsent flag, per photo)
│
└── PLATFORM SUPPORT REQUEST (org → HappyPix escalation)
```

### Cardinality

| Relationship | Cardinality | Notes |
|---|---|---|
| Organization → Events | 1 : N | Event count limited by plan (`events` field) for *parallel active* events |
| Organization → Devices | 1 : N | Plan `devices` cap applies to registered devices |
| Event → Devices | 1 : N | Many booths at one large event |
| Event → Templates | N : M | Global library + org AI templates |
| Device → Sessions | 1 : N | Unlimited within an event |
| Session → Photos | 1 : N (1–8) | One per layout slot |
| Session → Payment | 1 : 0..1 | Zero for free/included sessions |
| Session → GuestDownload | 1 : 1 | Optional if digital copy disabled |

---

## 6. Core product workflows

### 6.1 Onboarding (operator)

```
Website /plan checkout ──► Razorpay ──► website-backend creates organization + subscription
                                              │
                                              ▼
                         Owner/Admin appears in CRM → invited by email
                                              │
                                              ▼
                         Org Admin logs in → sets OrganizationDefaults
                         (logos, tagline, UPI id, timeouts, per-layout prices)
```

### 6.2 Event creation

1. Org Admin → **Events & Devices → New event**.
2. Names event, sets client/venue/dates, picks templates and filters.
3. Prices are **deep-cloned** from `OrganizationDefaults.layoutPrices` into `event.layoutPrices`.
4. Plan limits are enforced server-side: *parallel* active events only; finished events never count.
5. A 6-digit pairing code and short code are issued.

> **Immutability rule:** changing defaults tomorrow never alters an existing event. This is why
> two events created a month apart can legitimately have different prices.

### 6.3 Booth pairing and boot

```
App launch
  ├─ read installation UUID from secure store (generate on first run)
  ├─ attempt silent device login with stored token
  │    ├─ 200 → GET /booth/bootstrap → cache snapshot
  │    └─ 401 / 410 (DEVICE_DELETED) → clear identity → pairing UI
  └─ pairing UI: operator enters 6-digit code → POST /booth/login → token stored
```

`POST /booth/login` binds the `deviceUuid` to a device record in the org. Deleting the device in the
CRM returns `410 DEVICE_DELETED`, which the app treats as an instruction to wipe itself — so a
decommissioned tablet cannot keep printing against a stale event.

### 6.4 Guest session (the golden path)

```
IDLE
  → guest touches screen
  → ENTRY / event details (org logo, event name, sponsor logos, event type)
  → ORIENTATION (portrait / landscape)  [if templates allow both]
  → TEMPLATE (layout family + slot count, price shown)
  → PRINT COUNT / COPIES
  → PAYMENT (skip if free)  ── UPI QR / card ── poll or webhook
  → CAPTURE (countdown per slot, flash, extra shots, retake)
  → PHOTO SELECTION (choose which frame fills each slot)
  → CUSTOMISE (filters: original/warm/cool/bw/vintage/soft/party; stickers; ornaments)
  → COMPOSITE (300 DPI render, branding footer)
  → PRINT ("Print it") + DETAILS (phone/email opt-in)
  → UPLOAD individuals + composite → S3
  → SUCCESS (print status, QR, ticket/issue button, timer paused while modal open)
  → IDLE (session reset, counters incremented)
```

Idle behaviour: every guest-side interaction resets the idle timer; the timer is **paused** while an
overlay (issue modal, payment sheet) is open, so a guest reading the ticket form is never kicked out
mid-sentence.

### 6.5 Editing and compositing

```
selectedPhotos[i] (dataURL)
        │
        ▼  renderCompositeDataUrl({ layout, photos, filter, ornaments, branding, footer })
  Canvas at devicePixelRatio-independent print size
  • each slot clipped with cover-fit (no distortion, no letterbox)
  • FILTER_CSS applied via ctx.filter (original/warm/cool/bw/vintage/soft/party)
  • ornaments: bubbles, hearts, stars, confetti — deterministic seeded placement
  • sponsor logos in the reserved footer band
  • footer reserved band = bottom 15% of canvas (never overlapped by photos)
        │
        ▼
  compositeDataUrl (PNG/JPEG)  ──┬──► print (spooler / CUPS)
                                 └──► S3 upload (compositeUrl)
```

### 6.6 Printing

1. Renderer requests print from the main process via preload IPC (`booth:print`).
2. Main process resolves printer, orientation (from layout), quality, copies.
3. Windows: PowerShell `PrintDocument` with landscape flag, resolution kind, zero margins,
   high-quality bicubic, looped per copy. macOS/Linux: `lp -n <copies> -o orientation-requested
   -o print-quality -o fit-to-page`.
4. On success `printsTotal += copies`; on failure the renderer receives a real error and the success
   screen shows **Print failed** with retry — never a fake "Printed".

### 6.7 Digital delivery

| Step | Detail |
|---|---|
| Identity | `downloadId` = 144-bit base64url random (unguessable) |
| TTL | `expiresAt = now + 24 h`; MongoDB TTL index deletes the doc |
| Access | `GET /api/downloads/:id` → metadata; `/file/:kind` → presigned S3 GET |
| Abuse control | `downloadLimiter` per IP; `viewCount`/`downloadCount` tracked |
| QR | `shareUrl` from session-complete response, with `guaranteedShareUrl` fallback if the response is late |
| Privacy | No login, no email required; guest can opt in to contact details |

### 6.8 Raising an issue after success

The success screen mirrors the Android `OrderSuccessScreen`:

* category chips: **Printing · Payment · Photo quality · General**;
* optional message + contact;
* `POST /api/booth/support` with `{ category, message, sessionId, paymentId, holdPhotos: true }`;
* returns a `ticketId` shown to the guest;
* the idle countdown is **paused** while the modal is open;
* org-side ticket appears in **CRM → Guest Support** with context (session, photos, device).

### 6.9 Support escalation (org → platform)

```
Org Manager → Platform Support → new request (category, subject, body)
      → Platform Support Manager accepts/denies → replies → resolves
      → org can reapply if denied or reopen if unresolved
```
Every state change is timestamped and attributed; nothing is deletable.

### 6.10 AI template generation

```
Prompt ("elegant mehendi night, 3 photos, gold")
   → PromptClassifier (Groq) → intent ∈ {THEME, COLOR, BACKGROUND, FRAME, STYLE, DECORATION}
   → if intent implies geometry change → 422 LAYOUT_IMMUTABLE
   → TemplateGenerationService → strict Design JSON (palette, typography, treatment, asset prompts)
   → IP sanitiser strips trademarked characters
   → TogetherImageProvider (FLUX) → 1024×1024 base64
   → CRM preview (IndexedDB) → user saves → S3 + orgaitemplates
```

Geometry is immutable by AI. Only the designer can change slot coordinates, and only the platform
can publish a global template. This prevents an LLM from producing an unprintable layout.

---

## 7. Data lifecycle and retention

| Data | Written by | Lives in | Retention |
|---|---|---|---|
| Individual captures | Booth | S3 + `photos` | Until org deletion; gallery visibility governed by settings |
| Composite | Booth | S3 + `photos.compositeUrl` | Same as captures |
| GuestDownload record | Session complete | `guestdownloads` | **24 h** (TTL index) |
| Guest download counter | Public page | `guestdownloads` | With the record |
| Booth telemetry | Heartbeat | `devices.telemetry` (latest only) | Overwritten each beat |
| Pages/prints counters | Booth + backend | `devices`, `booth-state.json` | Lifetime |
| Payments | Payment routes | `payments` | 7 years (financial record) |
| Audit logs | Every mutation | `auditlogs` | 24 months (configurable) |
| Support tickets | Guest / org | `supporttickets`, `tickets` | 24 months |
| Leads | Contact form | `websitleads` / `websiteleads` | Until contacted + 12 months |

Deletion policy and data-subject requests: see [`SECURITY_PRIVACY.md`](SECURITY_PRIVACY.md#5-data-subject-requests).

---

## 8. Key technical decisions (and why)

### 8.1 Single database, application-enforced tenancy

**Chosen:** one MongoDB database, `organizationId` on every tenant document.
**Rejected:** database-per-tenant; collection-per-tenant.
**Why:** database-per-tenant multiplies operational cost and makes cross-tenant platform analytics
(revenue, churn) nearly impossible. The risk — a missing `organizationId` filter — is mitigated by
(a) a mandatory schema field, (b) a single auth middleware that always sets the tenant, (c) parity
tests that assert every org route is permission-guarded.

### 8.2 Snapshot + content-hash revision instead of live queries

**Chosen:** booth downloads a full snapshot; refreshes only when `revision` changes.
**Why:** a booth sits on unreliable venue Wi-Fi with 200 guests in line. It must never block on a
network call to render a template or compute a price. Hashing means "no change = no traffic", so
1000 idle booths cost ~nothing.

### 8.3 Frozen event pricing

**Chosen:** deep-clone org defaults into the event at creation.
**Why:** an operator raising prices mid-season would otherwise silently re-price events already
quoted to clients. This is a product-correctness decision, not an optimisation.

### 8.4 Pure-math layout engine instead of Fabric.js/Konva

**Chosen:** `layouts.js` computes slot geometry from `UNIT = 250` and per-family ratios; rendering
happens in Skia (mobile), Canvas 2D (Electron) and Sharp (server).
**Why:** deterministic coordinates can be shared by four renderers and verified in unit tests.
Canvas libraries bind to DOM or native contexts, leak memory on long kiosk sessions, and cannot run
headless on the server.

### 8.5 The 15% footer rule

**Chosen:** the bottom 15% of every template is reserved for branding and never used for photos.
**Why:** sponsors pay for visibility; a face covering a logo is a contractual failure. It is a hard
constant (`FOOTER_RATIO = 0.15`) so designers, the AI generator and all three renderers agree.

### 8.6 Honesty rule for hardware

**Chosen:** hardware operations fail loudly; no mock success in production paths.
**Why:** a fake "printed successfully" while a guest has paid is the single worst failure mode in
this business. Simulators exist only behind explicit demo flags and are never reachable when a real
device endpoint is configured.

### 8.7 Separate website backend

**Chosen:** second Express service sharing the same Mongo.
**Why:** marketing traffic (SEO crawlers, ad landing pages) and checkout spikes are unpredictable.
Keeping them off the API that serves booth heartbeats and payments isolates blast radius and lets
each service scale independently on Vercel.

### 8.8 XState on Android, reducer on Electron

**Chosen:** formal FSM where the guest can physically hammer the screen; simpler reducer where the
kiosk has one pointer and more screen real estate.
**Why:** on tablets, rapid taps caused real race conditions (payment confirm vs capture start). An
FSM makes illegal transitions mathematically impossible. On desktop the same bug class did not
appear, so the extra machinery was not justified.

### 8.9 Device identity separate from user identity

**Chosen:** `deviceUuid` + hashed device token, no booth login as a "user".
**Why:** staff rotate every event. Binding hardware identity to a person would require re-pairing at
every shift change and would leave orphaned permissions.

---

## 9. Known limitations and deliberate debt

| # | Limitation | Impact | Mitigation / plan |
|---|---|---|---|
| 1 | **Canon EDSDK not bundled in Electron** | A USB-tethered Canon on a PC kiosk falls back to UVC (`getUserMedia`) rather than full remote control | Use CCAPI over Wi-Fi (works today), or add EDSDK behind a vendor agreement — seam exists in `hardware.ts` |
| 2 | **Sony / Nikon native transports pending** | Those bodies are unsupported on Android | Interfaces and opcodes are mapped; transport work is scoped in the roadmap |
| 3 | **CUPS does not expose dye-sub media counts** | macOS cannot report `paperRemaining` for some drivers | Field returns `null` (honest); operator gets a low-media prompt by print count threshold |
| 4 | **No automated E2E for booths** | Regressions caught by unit/contract tests + manual QA | Detox (Android) and Playwright-for-Electron planned; see TESTING doc |
| 5 | **iPad build not shipped** | The Xcode target and iPad configuration exist and the session flow runs, but printing, kiosk lockdown, app icons and TestFlight signing are open | Tracked finding-by-finding in [`IPAD_SUPPORT.md`](IPAD_SUPPORT.md) §5 and §10 |
| 6 | **Video booth / GIF mode** | Add-on exists in the price catalogue but is not implemented in the booth | Scoped as a post-launch feature; do not sell the add-on yet |
| 7 | **Single Mongo cluster, one region** | Regional latency and blast radius | Atlas replica set + automated backup today; multi-region read preference is in the scalability plan |
| 8 | **Cron jobs run in-process** | A crash mid-job delays retries | Idempotent jobs + heartbeat-driven retries; moving to a queue is stage-2 of the scale plan |
| 9 | **`s3` assets served directly in some legacy paths** | Mixed presigned/direct URLs in older template records | New code always presigns; migration script is in `backend/scripts/` |
| 10 | **Email/SMS OTP depends on provider quota** | Login lockout risk if SendGrid/Twilio fails | Password login is primary; OTP is for reset only, with rate limits and support fallback |

---

## 10. Failure modes and system behaviour

### 10.1 Venue internet drops mid-event

| Component | Behaviour |
|---|---|
| Snapshot | Already on disk → templates, prices, branding all still render |
| Capture | Local only → unaffected |
| Composite | Local (Skia / Canvas) → unaffected |
| Print | Local spooler → unaffected |
| Payment | If already paid: session continues. If unpaid at capture time: booth shows "payments unavailable, contact operator" and does **not** silently give a free session (org policy can pre-authorise offline sessions) |
| Upload | Queued; retried with backoff; success screen shows "digital copy will be available shortly" and the QR is generated from a client-side `guaranteedShareUrl` fallback |
| Heartbeat | Fails silently; CRM marks device `offline` after 3 missed beats (6 min) |

### 10.2 Printer offline or out of media

1. Print request returns `success: false` with a real error.
2. Success screen shows **Print failed** and offers retry + raise-issue.
3. `POST /api/booth/support` attaches device telemetry (queue depth, status code, paper remaining).
4. CRM device view shows the printer status from the next heartbeat.
5. Duplicate-print protection: an idempotent print job id per session prevents double dispatch on
   retry within the same session.

### 10.3 Payment webhook lost

The booth polls `GET /booth/payments/:id` every few seconds while the payment sheet is open. If both
poll and webhook fail within the timeout, the booth shows a clear "payment not confirmed" state with
retry; no order is marked paid locally. Server-side reconciliation happens on the next status poll
or through the provider dashboard's manual capture.

### 10.4 Device deleted in CRM

`410 DEVICE_DELETED` on any device-authenticated call → booth wipes local token, clears cached
snapshot and returns to pairing. Photographs already uploaded remain in the org's gallery (they are
org property, not device property).

### 10.5 Duplicate session completion

`POST /booth/sessions/complete` is idempotent per `sessionId`: it upserts photos and reuses an
existing `GuestDownload` if one is still valid, so a retried network call cannot create two gallery
entries or two download records.

### 10.6 Database unavailable

Health endpoint returns `503`. The backend boots but fails requests with a structured error rather
than hanging. Booths keep operating offline; CRM shows a retryable error state.

### 10.7 Media loss (S3 object deleted)

Presigned URL generation returns 404; the guest page shows "this photo is no longer available" and
offers a support link. The `Photo` document is not deleted, so the org can re-upload from local
booth cache where it still exists.

---

*Next: [`APPLICATIONS_CRM.md`](APPLICATIONS_CRM.md) for module-by-module behaviour, or
[`BACKEND_API_DATABASE.md`](BACKEND_API_DATABASE.md) for the endpoint and schema reference.*
