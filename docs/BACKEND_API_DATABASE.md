# HappyPix — Backend, API & Database Documentation

> **Scope:** the main API (`/backend`, port 5000) and the public website API
> (`/website-backend`, port 5001).
> **Machine-readable contract:** [`openapi.yaml`](openapi.yaml) (OpenAPI 3.1) — import into Postman,
> Insomnia or Swagger UI.
> **Last verified:** 2026-10-23, branch `arena/097e52ae-local`.

---

## Table of contents

1. [Service overview](#1-service-overview)
2. [Middleware and request lifecycle](#2-middleware-and-request-lifecycle)
3. [Authentication](#3-authentication)
4. [API reference — auth & profile](#4-api-reference--auth--profile)
5. [API reference — platform (owner / internal)](#5-api-reference--platform-owner--internal)
6. [API reference — organization](#6-api-reference--organization)
7. [API reference — booth (device)](#7-api-reference--booth-device)
8. [API reference — payments, sharing, downloads](#8-api-reference--payments-sharing-downloads)
9. [API reference — website backend](#9-api-reference--website-backend)
10. [Error model and codes](#10-error-model-and-codes)
11. [Rate limits](#11-rate-limits)
12. [Database schema](#12-database-schema)
13. [Indexes and migrations](#13-indexes-and-migrations)
14. [File storage (S3)](#14-file-storage-s3)
15. [Background jobs, webhooks and retries](#15-background-jobs-webhooks-and-retries)
16. [Versioning and compatibility](#16-versioning-and-compatibility)

---

## 1. Service overview

| Service | Port | Base path | Auth | Consumers |
|---|---|---|---|---|
| Main API | 5000 | `/api` | JWT (users) · device token (booths) | CRM, booth apps, payment webhooks |
| Website API | 5001 | `/api` | none (public) · shared secret (server-to-server) | Website |

Both connect to **one MongoDB database**. The website API never writes booth session data; it owns
plans, subscription checkout, leads and read-only guest downloads.

### 1.1 Route map (main API)

```
/api/auth        crm/auth.js         login, /me, logout, profile, password, OTP, email change
/api/platform    crm/platform.js     owner & internal-team console
/api/org         crm/org.js          tenant console
/api/booth       boothRoutes.js      device pairing, snapshot, heartbeat, sessions
/api/payments    paymentRoutes.js    orders, verify, webhooks, legacy completion
/api/downloads   downloadRoutes.js   guest download metadata + file
/api/share       photoShareRoutes.js share tokens + delivery tracking
/api/support     supportRoutes.js    guest issue tickets (legacy path)
/api/events      eventRoutes.js      legacy event API
/api/coupons     couponRoutes.js     legacy coupon API
/api/settings    settingRoutes.js    legacy settings
/api/devices     deviceRoutes.js     legacy device tracking + heartbeat
/api/usage       usageAccessRoutes.js usage telemetry
```

`/api/booth` supersedes the legacy `/api/events`, `/api/devices`, `/api/coupons` paths for new
clients. Legacy routes remain for older installed APKs and are marked *deprecated* below.

### 1.2 Conventions

| Topic | Convention |
|---|---|
| Content type | `application/json; charset=utf-8` (`multipart/form-data` for uploads) |
| Timestamps | ISO 8601 UTC strings |
| IDs | 24-char ObjectId hex, or UUID where noted |
| Money | Integer **paise** in storage; API responses expose rupee numbers for booth/CRM convenience |
| Success envelope | Bare object or `{ ok: true, ... }`; list endpoints return `{ items: [], total, page }` |
| Error envelope | `{ error: { code, message, details? } }` (see §10) |
| Pagination | `?page=1&limit=25` (max 100) |
| Sorting | `?sort=-createdAt` |
| Idempotency | `sessionId` for sessions, order-ID uniqueness for payments |

---

## 2. Middleware and request lifecycle

```
request
  │
  ├─ express.json({ limit: '10mb' })         (raw body preserved for webhooks)
  ├─ cors({ origin: allowlist })             ── 403 if origin not allowed
  ├─ helmet-style headers (via host/middleware)
  ├─ globalLimiter (per IP)                  ── 429 RATE_LIMITED
  │
  ├─ route limiter (auth/otp/download/ai)    ── 429
  ├─ authenticate / authenticateDevice       ── 401 UNAUTHENTICATED
  ├─ requirePerm(PERMS.X)                    ── 403 FORBIDDEN
  ├─ requireWritableOrg (org mutations)      ── 402/403 ORG_NOT_WRITABLE
  │
  ├─ handler (asyncRoute wraps errors)
  │    ├─ mongoose queries (tenant-scoped)
  │    ├─ S3 / provider calls (timeout-guarded)
  │    └─ auditLogger (mutations)
  │
  └─ error handler → httpError shape         ── 4xx/5xx
```

### 2.1 Middleware inventory

| Middleware | File | Purpose |
|---|---|---|
| `authenticate` | `middleware/auth.js` | Verifies JWT, loads user, attaches `req.user` (`_id`, `role`, `organizationId`) |
| `requirePerm(perm)` | `middleware/auth.js` | Checks the role→permission matrix; writes an audit row on denial |
| `requireWritableOrg` | `middleware/auth.js` | Blocks mutations for expired/suspended/banned orgs |
| `authenticateDevice` | `middleware/deviceAuth.js` | Hashes the presented token and matches `deviceTokenHash`; loads device + org |
| `softDeviceAuth` | `middleware/deviceAuth.js` | Same, but returns a **state envelope** instead of 401 so a suspended booth learns why |
| `asyncRoute` | `utils/httpError.js` | try/catch → `next(err)` |
| `auditLogger` helpers | `utils/auditLogger.js` | Writes `AuditLog` rows with actor, org, IP, summary |
| `rateLimit` instances | `server.js`, route files | Global + per-route limits (§11) |

### 2.2 Booth state envelope

Booth routes that use `softDeviceAuth` answer with a state so the kiosk can show the right screen
instead of a generic failure:

```json
{
  "state": "SUSPENDED",
  "message": "This organization is suspended. The booth is locked until HappyPix restores it.",
  "invalidateCache": true,
  "snapshot": null
}
```

States: `ACTIVE · SUSPENDED · BANNED · DEVICE_BLOCKED · DEVICE_DELETED · ORG_MISSING`.

---

## 3. Authentication

### 3.1 User sessions (JWT)

| Property | Value |
|---|---|
| Algorithm | HS256 |
| Secret | `JWT_SECRET` (fail-closed: server refuses to boot without it) |
| Claims | `sub` (user id), `role`, `organizationId` (nullable for platform roles), `iat`, `exp` |
| Lifetime | 8 hours (client hint `VITE_SESSION_TTL_MIN`) |
| Transport | `Authorization: Bearer <token>` |
| Logout | `POST /api/auth/logout` (client discards; server may add a denylist) |
| Failed attempts | 5 per email → 15-minute lockout (mirrored client-side) |

### 3.2 Device sessions (booth)

| Property | Value |
|---|---|
| Identity | `deviceUuid` (persistent installation UUID, generated by the app) |
| Credential | 32-byte random hex token issued **once** by `POST /api/booth/login` |
| At rest | `deviceTokenHash` = SHA-256; the raw token is never stored |
| Transport | `Authorization: Bearer <deviceToken>` |
| Rotation | Re-pairing replaces the token; the old token stops working immediately |
| Revocation | Delete/block device in CRM → `410 DEVICE_DELETED` / `403 DEVICE_BLOCKED` |
| Scope | Exactly one organization, one assigned event at a time |

### 3.3 Webhook authentication

| Provider | Mechanism |
|---|---|
| Razorpay | `X-Razorpay-Signature` HMAC-SHA256 over the **raw** body with `RAZORPAY_WEBHOOK_SECRET` |
| Cashfree | Signature header verified per Cashfree v6 scheme |

Both handlers read `express.raw()` bodies — a JSON-parsed body would invalidate the signature.

### 3.4 Website-internal authentication

`POST /api/internal/downloads` on the website API requires
`X-Internal-Secret: <WEBSITE_INTERNAL_SECRET>`. Constant-time comparison. Intended for
server-to-server calls only; never exposed to a browser.

---

## 4. API reference — auth & profile

Base: `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/login` | none (`authLimiter`) | Email + password → JWT + user profile |
| `GET` | `/me` | JWT | Current user, org summary, effective permissions |
| `POST` | `/logout` | JWT | Session end (client-side token discard + audit) |
| `PUT` | `/profile` | JWT | Update name/phone/avatar |
| `POST` | `/password` | JWT | Change password (requires current password) |
| `POST` | `/forgot-password` | none (`otpRequestLimiter`) | Send OTP to the account email |
| `POST` | `/reset-password` | none (`otpVerifyLimiter`) | OTP + new password |
| `POST` | `/email/change-request` | JWT (`otpRequestLimiter`) | Request email change |
| `POST` | `/email/change-confirm` | JWT (`otpVerifyLimiter`) | Confirm with OTP |

### 4.1 `POST /api/auth/login`

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "sana@sunsetweddings.com", "password": "…" }
```

**200**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs…",
  "user": {
    "_id": "6650f…",
    "name": "Sana Kapoor",
    "email": "sana@sunsetweddings.com",
    "role": "ORG_ADMIN",
    "organizationId": "664ff…",
    "organization": { "name": "Sunset Weddings", "plan": "pro", "status": "active" }
  },
  "permissions": ["org.dashboard.view", "event.create", "…"]
}
```

**Errors:** `400 VALIDATION_ERROR` · `401 INVALID_CREDENTIALS` · `403 ACCOUNT_DEACTIVATED` ·
`403 ORG_SUSPENDED` · `429 RATE_LIMITED`.

### 4.2 `GET /api/auth/me`

Returns the same `user` object plus `subscription` (computed status, expiry, limits) and
`permissions`. Used on every CRM boot; must stay under 150 ms.

---

## 5. API reference — platform (owner / internal)

Base: `/api/platform`. Every route is permission-guarded (matrix in §12.3).

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/dashboard` | `PLATFORM_DASHBOARD_VIEW` | Platform KPIs: orgs, MRR, devices, sessions |
| `GET` | `/revenue` | `PLATFORM_REVENUE_VIEW` | Revenue time series, by plan, by org |
| `GET` | `/organizations` | `PLATFORM_ORGS_VIEW` | Tenant list with computed status |
| `GET` | `/organizations/:id` | `PLATFORM_ORGS_VIEW` | Tenant detail: plan, devices, events, owner |
| `POST` | `/organizations/:id/suspend` | `PLATFORM_ORG_SUSPEND` | Suspend tenant (reason required) |
| `POST` | `/organizations/:id/ban` | `PLATFORM_ORG_SUSPEND` | Ban tenant (fraud/abuse) |
| `POST` | `/organizations/:id/restore` | `PLATFORM_ORG_SUSPEND` | Restore tenant |
| `GET` | `/plans` | `SUBSCRIPTION_PLANS_MANAGE` | Plan catalogue incl. add-ons & discounts |
| `POST` | `/plans` | `SUBSCRIPTION_PLANS_MANAGE` | Create plan |
| `PUT` | `/plans/:id` | `SUBSCRIPTION_PLANS_MANAGE` | Update plan / discount campaign |
| `DELETE` | `/plans/:id` | `SUBSCRIPTION_PLANS_MANAGE` | Archive plan (never hard-delete if subscribed) |
| `GET` | `/users` | `PLATFORM_TEAM_VIEW` | Internal team (Owner, Platform Admin, Support) |
| `POST` | `/users` | `PLATFORM_USERS_MANAGE` | Invite internal user |
| `PUT` | `/users/:id` | `PLATFORM_USERS_MANAGE` | Update role/status |
| `GET` | `/support` | `PLATFORM_SUPPORT_VIEW` | Org → platform support queue |
| `GET` | `/support/:id` | `PLATFORM_SUPPORT_VIEW` | Thread detail |
| `POST` | `/support/:id/accept` | `PLATFORM_SUPPORT_VIEW` | Accept request |
| `POST` | `/support/:id/deny` | `PLATFORM_SUPPORT_VIEW` | Deny with reason |
| `POST` | `/support/:id/reply` | `PLATFORM_SUPPORT_VIEW` | Reply |
| `POST` | `/support/:id/resolve` | `PLATFORM_SUPPORT_VIEW` | Resolve |
| `POST` | `/support/:id/reopen` | `PLATFORM_SUPPORT_VIEW` | Reopen |
| `GET` | `/templates` | `GLOBAL_TEMPLATES_MANAGE` | Global template library |
| `POST` | `/templates` | `GLOBAL_TEMPLATES_MANAGE` | Create global template |
| `PUT` | `/templates/:id` | `GLOBAL_TEMPLATES_MANAGE` | Update (publish gate `active`) |
| `DELETE` | `/templates/:id` | `GLOBAL_TEMPLATES_MANAGE` | Unpublish/delete |
| `POST` | `/templates/ai-generate` | `GLOBAL_TEMPLATES_MANAGE` | AI-generate a global template |
| `GET` | `/template-layouts` | `PLATFORM_TEMPLATE_LAYOUTS_MANAGE` | Layout catalogue |
| `POST` | `/template-layouts` | `PLATFORM_TEMPLATE_LAYOUTS_MANAGE` | Add layout family |
| `DELETE` | `/template-layouts/:id` | `PLATFORM_TEMPLATE_LAYOUTS_MANAGE` | Remove layout |
| `GET` | `/gallery-settings` | `PLATFORM_GALLERY_SETTINGS` | Global gallery/consent settings |
| `PUT` | `/gallery-settings` | `PLATFORM_GALLERY_SETTINGS` | Update settings |
| `GET` | `/audit` | `PLATFORM_AUDIT_VIEW` | Platform audit log (paginated, filterable) |
| `GET` | `/leads` | `PLATFORM_LEADS_MANAGE` | Website leads |
| `PUT` | `/leads/:id` | `PLATFORM_LEADS_MANAGE` | Update lead status/notes |
| `DELETE` | `/leads/:id` | `PLATFORM_LEADS_MANAGE` | Delete lead |

### 5.1 `POST /api/platform/organizations/:id/suspend`

```json
{ "reason": "Non-payment for 45 days", "notify": true }
```

**200** `{ "ok": true, "organization": { "_id": "…", "status": "suspended", "suspendReason": "…" } }`

**Side effects:** booths locked on next heartbeat (`invalidateCache: true`); mutating org routes
return `ORG_NOT_WRITABLE`; audit row written; optional email via SendGrid.

### 5.2 Discount campaigns (inside `/plans`)

Plans support `discountType: "percent" | "flat" | "none"`, `discountValue`,
`discountStartsAt`, `discountEndsAt`, `discountMaxRedemptions`, `discountRedemptions`.
`website-backend/src/pricing.js` mirrors this logic so the website shows the same effective price
the CRM charges. **Any change to discount rules must be made in both files.**

---

## 6. API reference — organization

Base: `/api/org`. All routes require a JWT whose `organizationId` matches the data.

### 6.1 Dashboard, revenue, wallet

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/dashboard` | `ORG_DASHBOARD_VIEW` | Org KPIs: events, sessions, prints, revenue |
| `GET` | `/revenue` | `ORG_REVENUE_VIEW` | Revenue series, per event, per layout |
| `GET` | `/wallet` | `ORG_REVENUE_VIEW` | Prepaid balance and ledger |
| `POST` | `/wallet/withdraw` | `ORG_REVENUE_VIEW` + writable | Withdrawal request |

### 6.2 Events

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/events` | `EVENTS_DEVICES_MANAGE` | List events (filter: status, date, search) |
| `POST` | `/events` | `EVENT_CREATE` + writable | Create event (clones defaults pricing) |
| `GET` | `/events/:id` | `EVENTS_DEVICES_MANAGE` | Event detail |
| `PUT` | `/events/:id` | `EVENT_EDIT` + writable | Update event |
| `POST` | `/events/:id/pause` | `EVENT_EDIT` + writable | Pause booth operation |
| `POST` | `/events/:id/resume` | `EVENT_EDIT` + writable | Resume |
| `DELETE` | `/events/:id` | `EVENT_EDIT` + writable | Delete (soft rules apply) |

**`POST /api/org/events` body**

```json
{
  "name": "Kapoor × Mehta Reception",
  "clientName": "The Kapoors",
  "location": "Crown Ballroom, Gurugram",
  "startDate": "2026-11-14T12:00:00Z",
  "endDate": "2026-11-14T20:00:00Z",
  "templateIds": ["6651a…", "6651b…"],
  "filters": ["original", "warm", "bw"],
  "digitalCopy": true,
  "layoutPrices": { "46:3": 250, "57:2": 300 }
}
```

**Enforcement:** plan `events` cap counts only `status ∈ {upcoming, live}`. A finished event frees a
slot immediately.

**Frozen pricing:** if `layoutPrices` is omitted, the event inherits a deep clone of
`OrganizationDefaults.layoutPrices`; later default changes do not propagate.

### 6.3 Devices

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/devices` | `EVENTS_DEVICES_MANAGE` | Devices + online/offline + telemetry |
| `POST` | `/devices` | `EVENTS_DEVICES_MANAGE` + writable | Register device |
| `PUT` | `/devices/:id` | `EVENTS_DEVICES_MANAGE` + writable | Rename / relocate / block |
| `POST` | `/devices/:id/assign` | `EVENTS_DEVICES_MANAGE` + writable | Assign to event |
| `POST` | `/devices/:id/unassign` | `EVENTS_DEVICES_MANAGE` + writable | Detach from event |
| `DELETE` | `/devices/:id` | `EVENTS_DEVICES_MANAGE` + writable | Delete (booth receives `410`) |

### 6.4 Guest tickets and platform support

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/tickets` | `TICKETS_RESOLVE` | Guest-raised tickets |
| `GET` | `/tickets/:id` | `TICKETS_RESOLVE` | Thread + attached session context |
| `POST` | `/tickets/:id/reply` | `TICKETS_RESOLVE` | Reply to guest |
| `POST` | `/tickets/:id/resolve` | `TICKETS_RESOLVE` | Resolve |
| `POST` | `/tickets/:id/reopen` | `TICKETS_RESOLVE` | Reopen |
| `GET` | `/platform-support` | `ORG_PLATFORM_SUPPORT` | Org → platform requests |
| `POST` | `/platform-support` | `ORG_PLATFORM_SUPPORT` + writable | New request |
| `GET` | `/platform-support/:id` | `ORG_PLATFORM_SUPPORT` | Detail |
| `POST` | `/platform-support/:id/reply` | `ORG_PLATFORM_SUPPORT` + writable | Reply |
| `POST` | `/platform-support/:id/reapply` | `ORG_PLATFORM_SUPPORT` + writable | Reapply after denial |

### 6.5 Defaults, coupons, team, gallery, audit

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/defaults` | `DEFAULTS_VIEW` | Org defaults |
| `PUT` | `/defaults` | `DEFAULTS_EDIT` + writable | Update defaults (prices, logos, UPI, timeouts) |
| `GET` | `/coupons` | `COUPONS_MANAGE` | List coupons |
| `POST` | `/coupons` | `COUPONS_MANAGE` + writable | Create |
| `PUT` | `/coupons/:id` | `COUPONS_MANAGE` + writable | Edit |
| `POST` | `/coupons/:id/pause` | `COUPONS_MANAGE` + writable | Pause |
| `POST` | `/coupons/:id/activate` | `COUPONS_MANAGE` + writable | Activate |
| `DELETE` | `/coupons/:id` | `COUPONS_MANAGE` + writable | Delete |
| `POST` | `/coupons/validate` | `EVENTS_DEVICES_MANAGE` | Validate a code against a basket |
| `GET` | `/team` | `ORG_TEAM_VIEW` | Org team |
| `POST` | `/team` | `ORG_TEAM_MANAGE` + writable | Invite member |
| `PUT` | `/team/:id` | `ORG_TEAM_MANAGE` + writable | Update member |
| `POST` | `/team/:id/deactivate` | `ORG_TEAM_MANAGE` + writable | Deactivate |
| `POST` | `/team/:id/activate` | `ORG_TEAM_MANAGE` + writable | Reactivate |
| `GET` | `/gallery` | `ORG_GALLERY_VIEW` | Session-grouped gallery |
| `GET` | `/gallery/photo/:id/view` | `ORG_GALLERY_VIEW` | Redirect to presigned photo |
| `GET` | `/templates` | `GLOBAL_TEMPLATES_USE` | Templates available to this org |
| `GET` | `/audit` | `ORG_AUDIT_VIEW` | Org audit log |
| `GET` | `/template-layouts` | auth only | Layout catalogue for the designer |
| `GET` | `/ai-templates` | auth only | Org AI templates |
| `POST` | `/ai-generate` | writable (`aiLimiter`) | Generate a design (preview, not saved) |
| `POST` | `/ai-templates` | auth | Save generated template |
| `PUT/PATCH` | `/ai-templates/:id` | auth | Update |
| `DELETE` | `/ai-templates/:id` | auth | Delete |
| `POST` | `/remove-bg` | auth | Background removal for a photo |

**`GET /api/org/gallery` grouping rule**

```js
// One row per sessionId; composite wins over individual frame
const cover = row.compositeUrl || row.url
const signed = await signedPhotoUrl(cover)
```

Query params: `?eventId=&from=&to=&q=&page=&limit=`. Response:

```json
{
  "items": [
    {
      "sessionId": "sess_9f2…",
      "eventId": "6651b…",
      "eventName": "Kapoor × Mehta Reception",
      "capturedAt": "2026-11-14T14:32:11.000Z",
      "coverUrl": "https://…presigned…",
      "photoIds": ["6652a…", "6652b…", "6652c…"],
      "isComposite": true
    }
  ],
  "total": 218,
  "page": 1,
  "limit": 25
}
```

---

## 7. API reference — booth (device)

Base: `/api/booth`. Auth: `Authorization: Bearer <deviceToken>` unless stated.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/asset-proxy` | none | CORS-safe image proxy for template assets |
| `POST` | `/login` | none | Pair a device (email+password+deviceUuid) → token + snapshot |
| `GET` | `/bootstrap` | soft device | State envelope + full snapshot |
| `GET` | `/config` | soft device | Snapshot only (contract tests) |
| `GET` | `/revision` | device | Cheap revision probe |
| `POST` | `/heartbeat` | soft device | Device health + revision check |
| `POST` | `/checkout/quote` | device | Server-authoritative price for a session |
| `POST` | `/payments` | device | Create Razorpay/Cashfree payment + QR |
| `GET` | `/payments/:id` | device | Poll status |
| `POST` | `/payments/:id/confirm` | device | Client-confirm (still signature-checked) |
| `POST` | `/checkout/free-complete` | device | Complete a ₹0 session |
| `POST` | `/sessions/upload-urls` | device | Presigned S3 PUT URLs |
| `POST` | `/sessions/complete` | device | Persist photos + create 24 h download |
| `POST` | `/sessions/consent` | device | Record guest consent |
| `POST` | `/support` | device | Guest raises an issue → `ticketId` |

### 7.1 `POST /api/booth/login`

```json
{
  "email": "sana@sunsetweddings.com",
  "password": "…",
  "deviceUuid": "9f2c1e4a-…",
  "deviceName": "Booth-01",
  "location": "Crown Ballroom",
  "platform": "electron",
  "appVersion": "0.1.0"
}
```

**200**

```json
{
  "installation": {
    "deviceUuid": "9f2c1e4a-…",
    "deviceToken": "a1b2c3…",
    "deviceId": "6650c…",
    "organizationId": "664ff…",
    "pairedAt": "2026-11-14T09:00:00.000Z",
    "locationLabel": "Crown Ballroom"
  },
  "snapshot": { "revision": "rev_a8f3b2…", "event": { }, "templates": [], "layoutPrices": {} },
  "state": "ACTIVE"
}
```

**Errors:** `400 BAD_PAIRING` · `403 INVALID_CREDENTIALS` · `403 ACCOUNT_DEACTIVATED` ·
`403 BANNED | SUSPENDED | DEVICE_BLOCKED` · `402 DEVICE_LIMIT_REACHED`.

> The token is returned **exactly once**. Re-pairing rotates it and invalidates the old one.

### 7.2 `POST /api/booth/heartbeat`

```json
{
  "currentRevision": "rev_a8f3b2…",
  "hardware": {
    "camera": { "connected": true, "working": true, "model": "Canon EOS R50", "batteryPct": 78 },
    "printer": { "connected": true, "status": "idle", "paperRemaining": 412, "queueDepth": 0 },
    "kioskScreen": { "external": true, "width": 1080, "height": 1920 }
  },
  "counters": { "printsTotal": 1840, "shutterCount": 5621 },
  "appVersion": "0.1.0"
}
```

**200 (up to date)**

```json
{ "state": "ACTIVE", "changed": false, "revision": "rev_a8f3b2…", "serverTime": "…" }
```

**200 (changed)**

```json
{ "state": "ACTIVE", "changed": true, "revision": "rev_c91d4…", "invalidateCache": true }
```

Heartbeats are the **only** source of device liveness. The CRM marks a device `offline` after
3 consecutive misses (6 minutes).

### 7.3 `POST /api/booth/checkout/quote`

```json
{ "eventId": "6651b…", "templateId": "6651a…", "layoutId": "46-v3", "prints": 2, "couponCode": "MEHENDI10" }
```

**200**

```json
{
  "quoteId": "quote-2f9a…",
  "unitPrice": 250, "prints": 2, "gross": 500,
  "discount": 50, "finalAmount": 450,
  "couponCode": "MEHENDI10", "couponMessage": "10% off applied",
  "settlement": "wallet", "currency": "INR",
  "layoutId": "46-v3", "priceKey": "46:3",
  "templateId": "6651a…", "eventId": "6651b…", "deviceId": "6650c…",
  "expiresAt": "2026-11-14T14:37:00.000Z"
}
```

**Price resolution chain (server-authoritative):**
`event.layoutPrices["<family>:<slots>"]` → `OrganizationDefaults.layoutPrices[…]` →
platform `SUGGESTED_PRICES`. The booth never computes the payable amount itself.

**Errors:** `409 NO_EVENT` · `409 EVENT_NOT_LIVE` · `400 TEMPLATE_UNAVAILABLE` ·
`400 LAYOUT_MISMATCH` · `400 COUPON_INVALID`.

### 7.4 `POST /api/booth/payments`

```json
{ "quote": { "finalAmount": 450, "eventId": "6651b…", "prints": 2, "templateId": "6651a…" } }
```

**200**

```json
{
  "paymentId": "6653f…",
  "gateway": "razorpay",
  "amount": 450,
  "currency": "INR",
  "qrData": "upi://pay?pa=…&am=450&cu=INR",
  "paymentLinkUrl": "https://rzp.io/l/…",
  "expiresAt": "2026-11-14T14:40:00.000Z"
}
```

**Errors:** `400 QUOTE_REQUIRED` · `409 FREE_CHECKOUT` (₹0 must use `/checkout/free-complete`) ·
`503 GATEWAY_UNAVAILABLE`.

### 7.5 `POST /api/booth/sessions/upload-urls`

```json
{ "sessionId": "sess_9f2…", "files": [{ "kind": "photo", "contentType": "image/jpeg" }, { "kind": "composite", "contentType": "image/png" }] }
```

**200**

```json
{
  "uploads": [
    { "kind": "photo", "key": "org/664ff/events/6651b/sessions/sess_9f2/1.jpg", "url": "https://…presigned-put…" },
    { "kind": "composite", "key": "org/664ff/events/6651b/sessions/sess_9f2/composite.png", "url": "https://…presigned-put…" }
  ],
  "expiresIn": 900
}
```

### 7.6 `POST /api/booth/sessions/complete`

**Request (recommended shape — individuals + composite explicitly tagged)**

```json
{
  "sessionId": "sess_9f2…",
  "eventId": "6651b…",
  "digitalCopy": true,
  "guestConsent": true,
  "photos": [
    { "key": "…/1.jpg", "url": "https://cdn/…/1.jpg" },
    { "key": "…/2.jpg", "url": "https://cdn/…/2.jpg" },
    { "key": "…/3.jpg", "url": "https://cdn/…/3.jpg" },
    { "key": "…/composite.png", "url": "https://cdn/…/composite.png", "isComposite": true }
  ],
  "compositeUrl": "https://cdn/…/composite.png",
  "prints": 2
}
```

**Alternative (data URLs — server uploads them):**

```json
{ "sessionId": "sess_9f2…", "photos": ["data:image/jpeg;base64,…"], "compositeUrl": "data:image/png;base64,…" }
```

**200**

```json
{
  "success": true,
  "sessionId": "sess_9f2…",
  "photoIds": ["6652a…", "6652b…", "6652c…", "6652d…"],
  "compositeUrl": "https://cdn/…/composite.png",
  "downloadId": "9fQ2x…144bit…",
  "shareUrl": "https://happypix.in/download/9fQ2x…",
  "expiresAt": "2026-11-15T14:32:00.000Z",
  "skipped": []
}
```

**Behaviour notes**

| Rule | Detail |
|---|---|
| Idempotency | Same `sessionId` upserts rather than duplicating; a valid existing `GuestDownload` is reused |
| Composite precedence | An entry with `isComposite: true` sets `Photo.compositeUrl`; top-level `compositeUrl` is the fallback |
| Gallery visibility | `photoVisibleInGallery(record, settings)` applies consent + gallery settings |
| Consent | `requireGuestConsent` from gallery settings; otherwise consent defaults to `true` |
| Caps | Max 40 photo entries per session |
| Counters | `device.telemetry.prints += 1`; `photoTasks` set `compositeUrl` via `updateMany` where needed |

**Errors:** `400 BAD_SESSION` · `403 ORG_NOT_WRITABLE` · `409 EVENT_NOT_LIVE` ·
`413 PAYLOAD_TOO_LARGE` · `502 STORAGE_UNAVAILABLE`.

### 7.7 `POST /api/booth/support`

```json
{
  "category": "printing",
  "name": "Guest 42",
  "email": "guest@example.com",
  "subject": "Print came out blank",
  "message": "The printer made a sound but the sheet was blank.",
  "sessionId": "sess_9f2…",
  "paymentReference": "pay_Q1x…"
}
```

**201** `{ "success": true, "ticketId": "66544…" }`

`holdPhotos` is set automatically when a `sessionId` is supplied, so the org does not purge photos
while investigating. Category values used by the booth UI: `printing | payment | quality | general`.

---

## 8. API reference — payments, sharing, downloads

### 8.1 `POST /api/payments/*` (legacy + webhooks)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/create-order` | optional device | Legacy order creation (new booths use `/booth/payments`) |
| `GET` | `/status/:paymentId` | optional device | Legacy status |
| `POST` | `/verify` | optional device | Verify signature + mark paid |
| `POST` | `/cashfree-webhook` | signature | Cashfree callback (raw body) |
| `POST` | `/razorpay-webhook` | signature | Razorpay callback (raw body) |
| `POST` | `/free-complete` | optional device | Complete a zero-value session |
| `POST` | `/complete-prepaid` | optional device | Complete from org wallet |
| `GET` | `/download/:token` | none | Legacy digital token download |

### 8.2 Sharing

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/share/generate` | public limiter | Create a share token for a photo/session |
| `GET` | `/api/share/view/:token` | public limiter | View shared photos |
| `POST` | `/api/share/deliver/:token` | delivery limiter | Record a delivery (`QR`, `WHATSAPP`, `EMAIL`, …) |

### 8.3 Downloads

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/downloads/:id` | `downloadLimiter` | Metadata + expiry + file list |
| `GET` | `/api/downloads/:id/file/:kind` | `downloadLimiter` | `302` to presigned S3 (`composite` \| index) |
| `POST` | `/api/downloads/internal` | internal secret | Server-to-server creation |

**`GET /api/downloads/:id` → 200**

```json
{
  "downloadId": "9fQ2x…",
  "eventName": "Kapoor × Mehta Reception",
  "organizationName": "Sunset Weddings",
  "compositeUrl": "https://…presigned…",
  "photoUrls": ["https://…presigned…", "…"],
  "expiresAt": "2026-11-15T14:32:00.000Z",
  "views": 3,
  "downloads": 1
}
```

**404 `DOWNLOAD_EXPIRED`** after the TTL index removes the record.

---

## 9. API reference — website backend

Base `https://<website-host>/api`. No user auth.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | `{ ok: true, service, time }` |
| `GET` | `/plans` | Public catalogue with effective (discounted) prices per billing period |
| `POST` | `/checkout/order` | Create a Razorpay order for a plan |
| `POST` | `/checkout/verify` | Verify payment, create org + subscription + owner user |
| `GET` | `/downloads/:id` | Guest download metadata |
| `GET` | `/downloads/:id/file/:kind` | Presigned redirect |
| `POST` | `/internal/downloads` | Server-to-server download creation (secret header) |
| `POST` | `/leads` | Contact / demo request |

**`GET /api/plans` → 200 (excerpt)**

```json
{
  "plans": [
    { "key": "trial", "name": "Free Trial", "priceMonthly": 0, "devices": 1, "events": 1, "aiCredits": 10 },
    { "key": "basic", "name": "Basic", "priceMonthly": 1099, "priceQuarterly": 2847,
      "priceSemiannual": 4794, "priceAnnual": 5988, "devices": 2, "events": 2, "aiCredits": 25 },
    { "key": "pro", "name": "Pro", "priceMonthly": 1299, "priceAnnual": 8388, "devices": 2, "events": 4, "aiCredits": 250 },
    { "key": "premium", "name": "Premium", "priceMonthly": 1499, "priceAnnual": 9588, "devices": 2, "events": 8, "aiCredits": 500 },
    { "key": "custom", "name": "Enterprise", "priceMonthly": null, "devices": 25, "events": 20 }
  ],
  "addons": [{ "key": "addon-extra-device", "priceMonthly": 249 }],
  "gstRate": 0.18
}
```

**`POST /api/checkout/verify`** creates, in one transaction-like sequence:
`Organization` → `User` (ORG_ADMIN, bcrypt hash) → `Subscription` (plan, start, expiry) →
welcome email. Failure after payment is logged and retried by support; the Razorpay payment record
is the source of truth.

---

## 10. Error model and codes

Every error:

```json
{
  "error": {
    "code": "COUPON_INVALID",
    "message": "This coupon has expired.",
    "details": { "couponCode": "MEHENDI10" }
  }
}
```

### 10.1 HTTP status usage

| Status | Meaning in this API |
|---|---|
| `200` | OK |
| `201` | Created (tickets, plans, events) |
| `400` | Validation or business rule (bad input, template mismatch, coupon invalid) |
| `401` | Missing/invalid/expired credential |
| `402` | Plan or wallet prevents the action (`ORG_NOT_WRITABLE`, `DEVICE_LIMIT_REACHED`) |
| `403` | Authenticated but not permitted (role, tenant, blocked device) |
| `404` | Not found (always tenant-scoped) |
| `409` | State conflict (event not live, free checkout mismatched) |
| `410` | Device deleted / download expired — actionable, terminal |
| `413` | Payload too large (photo batch, upload) |
| `429` | Rate limited |
| `500` | Unexpected server error (never leaks internals) |
| `502/503` | Upstream failure (S3, payment gateway, AI provider) |

### 10.2 Code reference

| Code | Status | Meaning / resolution |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing/malformed field; `details` lists fields |
| `INVALID_CREDENTIALS` | 401/403 | Wrong email/password (booth pairing uses 403) |
| `UNAUTHENTICATED` | 401 | No/invalid token |
| `TOKEN_EXPIRED` | 401 | Re-login |
| `FORBIDDEN` | 403 | Role/permission denied (audited) |
| `ACCOUNT_DEACTIVATED` | 403 | Admin must reactivate |
| `ORG_MISSING` | 403 | Tenant record deleted |
| `ORG_SUSPENDED` / `ORG_BANNED` | 403 | Platform action; contact support |
| `ORG_NOT_WRITABLE` | 402 | Subscription expired/suspended — reads still allowed |
| `DEVICE_LIMIT_REACHED` | 402 | Plan device cap; upgrade |
| `EVENT_LIMIT_REACHED` | 402 | Plan parallel-event cap |
| `DEVICE_BLOCKED` | 403 | Blocked in CRM |
| `DEVICE_DELETED` | 410 | Booth must wipe and re-pair |
| `BAD_PAIRING` | 400 | Missing email/password/deviceUuid |
| `NO_EVENT` | 409 | No event assigned to booth |
| `EVENT_NOT_LIVE` | 409 | Event paused/finished/upcoming |
| `TEMPLATE_UNAVAILABLE` | 400 | Template removed from event |
| `LAYOUT_MISMATCH` | 400 | `layoutId` doesn't match the template |
| `COUPON_INVALID` | 400 | Expired, exhausted, min-spend unmet, wrong org |
| `BAD_SESSION` | 400 | Missing `sessionId` |
| `QUOTE_REQUIRED` | 400 | `/booth/payments` without a quote |
| `FREE_CHECKOUT` | 409 | ₹0 must use `/checkout/free-complete` |
| `PAYMENT_NOT_CONFIRMED` | 409 | Provider says pending/failed |
| `SIGNATURE_INVALID` | 400 | Webhook/verify signature mismatch (never trust client) |
| `DOWNLOAD_EXPIRED` | 410 | 24 h passed |
| `STORAGE_UNAVAILABLE` | 502 | S3 rejected the write |
| `GATEWAY_UNAVAILABLE` | 503 | Payment provider unreachable |
| `AI_QUOTA_EXCEEDED` | 429 | Org AI credits exhausted |
| `LAYOUT_IMMUTABLE` | 422 | AI prompt attempted geometry change |
| `RATE_LIMITED` | 429 | Back off; honour `Retry-After` |
| `INTERNAL_ERROR` | 500 | Logged with a correlation id |

---

## 11. Rate limits

| Limiter | Scope | Window | Max | Notes |
|---|---|---|---|---|
| `globalLimiter` | per IP, all `/api` | 15 min | 600 | Protects against scrapers/bugs |
| `authLimiter` | `POST /api/auth/login` | 15 min | 10 | Plus per-email lockout after 5 failures |
| `otpRequestLimiter` | forgot-password, email change | 15 min | 5 | Per IP and per email |
| `otpVerifyLimiter` | reset/confirm | 15 min | 10 | Brute-force protection |
| `leadsLimiter` | `POST /api/leads` | 1 h | 20 | Anti-spam |
| `aiLimiter` | `/api/org/ai-generate` | 1 h | 20 per org | Cost control |
| `downloadLimiter` | `/api/downloads/*` | 15 min | 120 | Per IP |
| `publicRateLimiter` | `/api/share/*` | 15 min | 120 | Per IP |
| `deliveryRateLimiter` | delivery recording | 15 min | 240 | Per IP |
| `checkoutLimiter` | website checkout | 15 min | 20 | Per IP |
| `supportLimiter` | `/api/support` | 1 h | 10 | Per IP |

Responses include `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`; over-limit returns
`429` with `Retry-After`.

---

## 12. Database schema

MongoDB, single database, 23 collections. `_id` is ObjectId unless noted. All schemas use
`timestamps: true` unless stated, so `createdAt`/`updatedAt` exist everywhere.

### 12.1 Identity, tenancy and billing

#### `users`

| Field | Type | Notes |
|---|---|---|
| `name` | String | required |
| `email` | String | unique, lowercase |
| `passwordHash` | String | bcrypt (cost 10–12) |
| `role` | Enum | `OWNER · PLATFORM_ADMIN · SUPPORT_MANAGER · ORG_ADMIN · ORG_MANAGER` |
| `organizationId` | ObjectId → `organizations` | null for platform roles |
| `status` | Enum | `active · inactive · suspended` |
| `phone`, `avatarUrl` | String | optional |
| `lastLoginAt` | Date | updated on login |

#### `organizations`

| Field | Type | Notes |
|---|---|---|
| `name` | String | required |
| `ownerName`, `email`, `phone` | String | `email` unique |
| `country` | String | ISO-2, default `IN` |
| `plan` | String | `trial · basic · pro · premium · custom` |
| `currency` | String | `INR` / `AUD` |
| `planStatus` *(computed)* | — | never stored; derived by `planService` |
| `logoUrl`, `brandTagline` | String | branding |
| `isBanned`, `suspendReason` | Boolean/String | platform control |
| `trialEndsAt`, `planExpiresAt` | Date | entitlement window |
| `walletBalance` | Number | paise |
| `aiCredits` | Number | remaining credits |
| `subdomain` | String | public slug, optional |

#### `organizationdefaults`

| Field | Type | Notes |
|---|---|---|
| `organizationId` | ObjectId | **unique** — one doc per org |
| `name`, `logoUrl` | String | default branding |
| `boothTimeoutSec` | Number | 10–86400, default 60 |
| `qrTimeoutMinutes` | Number | 1–30, default 5 |
| `upiId`, `paymentDisplayName` | String | settlement |
| `payoutMode` | Enum | `upi · wallet` |
| `razorpayKeyId` | String | per-org gateway (optional) |
| `razorpayKeySecret` | String (encrypted) | AES via `utils/crypto.js` |
| `layoutPrices` | Map<String, Number> | key `"<family>:<slots>"` |
| `filters` | [String] | default allowed filters |
| `logos` | [String] | up to 15 sponsor logos |

#### `subscriptionplans`

| Field | Type | Notes |
|---|---|---|
| `key` | String | `trial · basic · pro · premium · custom` |
| `name`, `description` | String | |
| `price` | Number | monthly list price (₹) |
| `priceMonthly/Quarterly/Semiannual/Annual` | Number | billing variants (null = custom) |
| `devices`, `events` | Number | entitlements (−1 = unlimited) |
| `aiCredits` | Number | per period |
| `kind` | Enum | `plan · addon` |
| `discountType`, `discountValue`, `discountStartsAt`, `discountEndsAt`, `discountMaxRedemptions`, `discountRedemptions` | mixed | campaign pricing |
| `active` | Boolean | visibility |

#### `subscriptions`

| Field | Type | Notes |
|---|---|---|
| `organizationId` | ObjectId | |
| `planId` / `planKey` | ObjectId / String | |
| `startDate`, `expiresAt` | Date | expiry drives computed status |
| `status` | Enum | `active · expired · cancelled · pending` |
| `razorpayPaymentId`, `razorpayOrderId` | String | reconciliation |
| `billingPeriod` | Enum | `monthly · quarterly · semiannual · annual` |
| `amountPaid`, `currency`, `gstAmount` | Number | financial record |

#### `roleconfigs`

Stores the persisted permission matrix used by `requirePerm`, keyed by role. Read-mostly; edits are
Owner-only and audited.

### 12.2 Events, devices and hardware

#### `events`

| Field | Type | Notes |
|---|---|---|
| `organizationId` | ObjectId | indexed |
| `name`, `clientName`, `location` | String | |
| `startDate`, `endDate` | Date | required |
| `status` | Enum | `upcoming · live · finished` |
| `paused` | Boolean | booth blocks when true |
| `templateIds` | [ObjectId] → `templates` | allowed set |
| `filters` | [String] | allowed edit styles |
| `digitalCopy` | Boolean | default true |
| `layoutPrices` | Mixed | **frozen** price map |
| `branding.logoUrl/tagline/logos[]` | Mixed | up to 15 logos |
| `shortCode`, `passkey` | String | pairing UX |
| `assignedDeviceIds` | [ObjectId] | |
| `upiId` | String | optional per-event override |

#### `devices`

| Field | Type | Notes |
|---|---|---|
| `organizationId` | ObjectId | indexed |
| `deviceUuid` | String | **unique**, persistent installation id |
| `deviceName`, `location` | String | |
| `deviceToken` | String | transient (raw, never persisted after save) |
| `deviceTokenHash` | String | SHA-256, indexed |
| `status` | Enum | `active · inactive · blocked` |
| `assignedEventId` | ObjectId | |
| `lastSeenAt`, `ipAddress`, `userAgent` | mixed | heartbeat |
| `platform`, `appVersion` | String | `android · electron · macos · win32` |
| `telemetry` | Mixed | camera, printer, kioskScreen, prints, updatedAt |
| `operatorName`, `operatorPhone` | String | shift metadata |

#### `templates`

| Field | Type | Notes |
|---|---|---|
| `layoutId` | String | e.g. `46-v3` |
| `componentId`, `familyId` | String | catalogue linkage |
| `design` | Mixed | background, ornaments, typography, palette |
| `source` | Enum | `designer · playground · ai_generated` |
| `active` | Boolean | publish gate |
| `assets` | [String] | S3 URLs |
| `price` | Number | suggested price |

#### `templatelayouts`

| Field | Type | Notes |
|---|---|---|
| `code` / `id` | String | e.g. `P1-46-T04-V-GRID2X2` |
| `familyId`, `name` | String | |
| `width`, `height` | Number | canvas units (`UNIT = 250`) |
| `orientation` | Enum | `portrait · landscape` |
| `slots` | [Mixed] | `{x, y, w, h}` normalised 0..1 |
| `printSize` | String | `4 × 6` etc. |

#### `orgaitemplates`

| Field | Type | Notes |
|---|---|---|
| `organizationId` | ObjectId | |
| `name`, `category`, `description` | String | |
| `layout` | Mixed | family, slots, print size |
| `design` | Mixed | palette, ornaments, treatment |
| `assets` | [String] | S3 |
| `prompt` | String | the generating prompt (audit) |
| `price` | Number | |

### 12.3 Commerce and content

#### `payments`

| Field | Type | Notes |
|---|---|---|
| `organizationId`, `eventId`, `deviceId`, `sessionId` | ObjectId/String | traceability |
| `gateway` | Enum | `razorpay · cashfree` |
| `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature` | String | |
| `cashfreeOrderId`, `cashfreePaymentId`, `cashfreeQrData` | String | |
| `amount`, `currency` | Number/String | |
| `status` | Enum | `created · pending · paid · failed · refunded` |
| `method` | String | `upi · card · netbanking · wallet` |
| `guestPhone` | String | optional |
| `referenceId` | String | internal receipt |

#### `coupons`

| Field | Type | Notes |
|---|---|---|
| `organizationId` | ObjectId | |
| `code` | String | uppercase, unique per org |
| `type` | Enum | `percentage · fixed` |
| `value` | Number | % or ₹ |
| `minSpend`, `maxDiscount` | Number | guard rails |
| `quantity`, `usedCount`, `maxUses` | Number | redemption accounting |
| `validFrom`, `validUntil` | Date | |
| `status` | Enum | `active · paused · expired` |

#### `photos`

| Field | Type | Notes |
|---|---|---|
| `organizationId`, `eventId`, `deviceId` | ObjectId | |
| `url` | String | required (S3 or data URL persisted) |
| `compositeUrl` | String | set on the composite row **and** back-filled onto session rows |
| `s3Key` | String | for re-signing |
| `sessionId` | String | gallery grouping key |
| `guestConsent` | Boolean | |
| `generatedAt`, `createdAt` | Date | |
| `finalised`, `printStatus`, `digitalStatus` | mixed | lifecycle flags |

#### `guestdownloads`

| Field | Type | Notes |
|---|---|---|
| `downloadId` | String | unique, 144-bit base64url |
| `organizationId`, `eventId`, `deviceId` | ObjectId | |
| `sessionId` | String | indexed |
| `compositeUrl` | String | |
| `photoUrls`, `photoIds` | [String]/[ObjectId] | |
| `eventName`, `organizationName` | String | denormalised for the page |
| `expiresAt` | Date | **TTL index** (`expireAfterSeconds: 0`) |
| `viewCount`, `downloadCount` | Number | |

#### `photoshare`

Share token with `eventId`, `organizationId`, `token`, `expiresAt`, `photoIds`, `views`.
#### `deliveryrecords`

`photoShareId`, `method` (`QR · DOWNLOAD · WHATSAPP · EMAIL · SMS · NATIVE_SHARE · COPY_LINK`),
`deliveredAt`, `metadata`.
#### `digitaltokens`

`token` (unique), `paymentId`, `photoUrls`, `compositeUrl`, `expiresAt` (TTL), `views`.

### 12.4 Support, ops and platform

#### `supporttickets` (guest → org)

| Field | Type | Notes |
|---|---|---|
| `ticketType` | Enum | `end_user` |
| `name`, `email`, `subject`, `message` | String | |
| `organizationId`, `eventId`, `deviceId` | ObjectId | context |
| `sessionId`, `paymentReference` | String | traceability |
| `holdPhotos` | Boolean | prevents purge while investigating |
| `status` | Enum | `open · in_progress · resolved` |
| `replies` | [Mixed] | `{author, role, message, at}` |

#### `tickets` (legacy guest tickets)

Older shape kept for installed APKs: `subject`, `message`, `status`, `priority`, `deviceId`,
`resolvedAt`, `resolution`.

#### `platformsupportrequests` (org → platform)

`organizationId`, `category`, `subject`, `body`, `status`
(`pending · accepted · denied · resolved`), `assignedTo`, `decisionReason`, `replies[]`, `reapplyOf`.

#### `auditlogs`

| Field | Type | Notes |
|---|---|---|
| `actorId`, `actorName`, `actorRole` | mixed | `System` for booth-originated events |
| `organizationId` | ObjectId | null = platform scope |
| `action` | String | `event.update`, `device.paired`, `org.suspend`, … |
| `entity`, `entityId` | String | |
| `summary` | String | human-readable |
| `ip`, `userAgent` | String | |
| `metadata` | Mixed | diff-safe extras |

#### `withdrawals`

`organizationId`, `amount`, `status` (`requested · approved · paid · rejected`), `upiId`,
`processedAt`, `notes`.

#### `websiteleads`

`name`, `email`, `phone`, `company`, `message`, `source`, `status`
(`new · contacted · qualified · won · lost`), `notes`, `assignedTo`.

#### `gallerysettings` / `settings`

Global key-value config: gallery visibility, consent requirement, watermark, retention hints,
default filters.

---

## 13. Indexes and migrations

### 13.1 Index inventory (must exist in production)

| Collection | Index | Purpose |
|---|---|---|
| `users` | `{ email: 1 }` unique | login |
| `users` | `{ organizationId: 1, role: 1 }` | team listing, owner lookup |
| `organizations` | `{ email: 1 }` unique | onboarding uniqueness |
| `organizationdefaults` | `{ organizationId: 1 }` unique | one defaults doc |
| `devices` | `{ deviceUuid: 1 }` unique | pairing |
| `devices` | `{ deviceTokenHash: 1 }` | device auth |
| `devices` | `{ organizationId: 1, assignedEventId: 1 }` | org device lists |
| `events` | `{ organizationId: 1, status: 1, startDate: -1 }` | event lists, plan caps |
| `photos` | `{ organizationId: 1, sessionId: 1 }` | gallery grouping |
| `photos` | `{ eventId: 1, createdAt: -1 }` | event gallery |
| `photos` | `{ deviceId: 1, createdAt: -1 }` | device history |
| `guestdownloads` | `{ downloadId: 1 }` unique | public lookup |
| `guestdownloads` | `{ expiresAt: 1 }` **TTL 0** | 24 h auto-purge |
| `guestdownloads` | `{ sessionId: 1 }` | idempotent re-completion |
| `payments` | `{ organizationId: 1, createdAt: -1 }` | revenue reports |
| `payments` | `{ sessionId: 1 }`, `{ razorpayOrderId: 1 }`, `{ cashfreeOrderId: 1 }` | reconciliation |
| `coupons` | `{ organizationId: 1, code: 1 }` unique | validation |
| `auditlogs` | `{ organizationId: 1, createdAt: -1 }`, `{ actorId: 1 }` | audit views |
| `supporttickets` | `{ organizationId: 1, status: 1, createdAt: -1 }` | ticket queue |
| `templates` | `{ layoutId: 1 }`, `{ active: 1 }` | snapshot building |
| `orgaitemplates` | `{ organizationId: 1 }` | org template list |

### 13.2 Critical migrations

#### Remove the legacy photo TTL index

Older deployments had a TTL on `photos.createdAt` that silently deleted customer galleries.

```bash
node backend/scripts/drop-photo-ttl-index.js
# verify
mongosh "$MONGODB_URI" --eval 'db.photos.getIndexes()'
```

There must be **no** `expireAfterSeconds` index on `photos`. Recreating it destroys customer data.

#### Ensure guest download TTL exists

```js
db.guestdownloads.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

Without it, expired download documents linger (URLs still resolve to deleted S3 objects → 404, but
the page shows "expired" only if the record is gone).

#### Backfill `compositeUrl` onto session rows

If a deployment stored composites only at session level:

```js
// scripts/backfill-composite-url.js (one-off)
const sessions = await Photo.aggregate([
  { $match: { compositeUrl: { $ne: null } } },
  { $group: { _id: '$sessionId', compositeUrl: { $first: '$compositeUrl' } } },
])
for (const s of sessions) {
  await Photo.updateMany({ sessionId: s._id, compositeUrl: null }, { $set: { compositeUrl: s.compositeUrl } })
}
```

#### Rename/adding fields

Never rename in place. Sequence: add new field with default → dual-write → backfill script →
switch reads → remove old field after a release cycle.

### 13.3 Backup and restore expectations

* Atlas continuous backup enabled; PITR window ≥ 7 days (production).
* Weekly logical dump stored outside the cluster (`mongodump` → S3, encrypted).
* Restore drill quarterly; see [`OPERATIONS.md`](OPERATIONS.md#4-backup-and-disaster-recovery).

---

## 14. File storage (S3)

### 14.1 Key layout

```
<orgId>/events/<eventId>/sessions/<sessionId>/<index>.jpg      individual captures
<orgId>/events/<eventId>/sessions/<sessionId>/composite.png    final composed sheet
<orgId>/templates/<templateId>/background.png                  template artwork
<orgId>/branding/<orgId>-logo.png                              org logo
global/templates/<templateId>/…                                platform templates
```

### 14.2 Access model

| Object | ACL | Access path |
|---|---|---|
| Booth photos/composites | private | presigned GET (5–15 min) via API |
| Template art | private or public-read | `asset-proxy` or presigned |
| Download page files | private | website-backend presigns |

### 14.3 Required bucket configuration

**CORS**

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": ["https://happypix.in", "https://crm.happypix.in"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

**Lifecycle (cost control)**

| Prefix | Rule |
|---|---|
| `*/sessions/*` | Transition to Infrequent Access at 30 days |
| `*/sessions/*` | Expire non-composite objects at 400 days (configurable per retention policy) |
| `*/composite.png` | Retain per contract; never auto-expire without legal sign-off |

**Block Public Access** stays ON. No object is served without a signature.

### 14.4 Upload paths

| Path | When | Size guard |
|---|---|---|
| Presigned PUT (`/sessions/upload-urls`) | Preferred — booth uploads directly | 15 MB per object |
| Server-side (`persistSessionPhoto` for data URLs) | Fallback for legacy booths | 10 MB JSON body limit |

---

## 15. Background jobs, webhooks and retries

### 15.1 Scheduled work (`services/CronService.js`)

| Job | Cadence | Purpose |
|---|---|---|
| Subscription expiry sweep | hourly | recompute org status; send expiry reminders |
| Trial reminders | daily | 7/3/1-day emails |
| Device offline sweep | 5 min | mark devices offline after 3 missed heartbeats |
| Guest download purge | hourly (plus TTL) | belt-and-braces cleanup of orphan S3 keys |
| Audit retention | daily | archive/delete logs older than the retention window |
| Lead follow-up digest | daily | notify sales of new leads |

All jobs are **idempotent** and safe to re-run. A crash mid-job is retried on the next tick. Jobs
are not queued (documented limitation; see ARCHITECTURE §9).

### 15.2 Webhooks

| Endpoint | Provider | Verification | On success |
|---|---|---|---|
| `POST /api/payments/razorpay-webhook` | Razorpay | HMAC-SHA256 over raw body | mark `Payment.paid`, unlock session, create receipt |
| `POST /api/payments/cashfree-webhook` | Cashfree | provider signature | same |
| `POST /api/payments/verify` | booth/CRM | signature check | same, client-initiated |

**Idempotency:** payment updates are conditional (`status != 'paid'`), so duplicate deliveries are
harmless. Every webhook writes an audit row with the provider event id.

**Failure handling:** if the handler throws, the provider retries (Razorpay: several attempts). The
booth's own polling provides a second path so a guest is never stuck behind a lost webhook.

### 15.3 External API retries

| Call | Retry policy |
|---|---|
| S3 put/get | 3 attempts, exponential backoff (SDK default) |
| Razorpay order create | 2 attempts; on failure return `503 GATEWAY_UNAVAILABLE` |
| Groq/Together generation | 2 attempts; then `502 AI_UNAVAILABLE` (credits are not consumed) |
| SendGrid email | 1 retry; failures are logged, never block the user's request |

### 15.4 Observability hooks

| Signal | Where |
|---|---|
| Request log | stdout (JSON in production) |
| Errors | stdout + provider log drain, with correlation id |
| Audit trail | `auditlogs` (business-level, queryable in CRM) |
| Device health | `devices.telemetry` + `lastSeenAt` |
| Payment trail | `payments` + provider dashboards |
| Health check | `GET /api/health` (main), `GET /health` (website) |

---

## 16. Versioning and compatibility

### 16.1 Current strategy

* **No URL version prefix** (`/api`, not `/api/v2`). The contract is versioned by *capability*:
  booth apps negotiate via `appVersion` in login/heartbeat, and the server keeps legacy shapes.
* Breaking changes follow a **expand → migrate → contract** sequence across at least one release.
* Clients must tolerate unknown fields (additive changes are not breaking).

### 16.2 Compatibility table

| Client | Minimum supported | Notes |
|---|---|---|
| CRM | current deployment | served together with the API |
| Website | current deployment | served together with website API |
| Booth app (Electron) | 0.1.0 | heartbeat `appVersion` reported |
| Booth app (Android) | 1.0.0 | legacy `/api/events` + `/api/devices` retained for older APKs |

### 16.3 Deprecation policy

1. Announce in the release notes and mark the route `@deprecated` in `openapi.yaml`.
2. Keep it working for ≥ 2 minor releases (≥ 60 days).
3. Log usage with the caller's `appVersion`; contact the operator of any remaining caller.
4. Remove only after usage is zero for 30 days.

### 16.4 Known contract risks

| Risk | Mitigation |
|---|---|
| Older booths send only `compositeUrl` without a tagged photo entry | `sessions/complete` accepts both shapes; composite falls back to the top-level field |
| Legacy APKs call `/api/devices/heartbeat` | Route retained and mapped onto the same telemetry store |
| CRM mock server drifts from the real API | `permissions.parity.test.js` + `api-smoke.mjs` in CI |
| Discount logic duplicated in `planService` and website `pricing.js` | Comment in both files; identical unit-test fixtures |

---

*Machine-readable contract: [`openapi.yaml`](openapi.yaml).*
*Schema rationale and design notes: [`../HAPPYPIX_V2_MASTER_DOCUMENTATION.md`](../HAPPYPIX_V2_MASTER_DOCUMENTATION.md).*
