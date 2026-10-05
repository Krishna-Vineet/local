# HappyPix Backend + Booth Audit — Findings & Changes

**Scope:** `backend/` and `electron/` only. `client/` and `client-app/` were ignored
per instruction, and no UI was changed (electron changes are logic/wiring only).
**Date:** 2026-10-04 · **Branch:** `arena/01a1074f-local`

The CRM (`crm/`, mock server = contract) was treated as the finished, authoritative
spec. Every page contract was cross-checked against the backend route-by-route.

**Verification status:** `node --check` passes on every backend file, the full
Express app imports and boots cleanly (all modules link), `Origin: null` booth
CORS preflight verified live, electron `tsc -b` clean, electron test suite
**7/7 green** (demo contract tests untouched in behavior).

---

## 1. CRM feature coverage — what was missing (now implemented)

The backend previously implemented almost none of the CRM v2 contract. The
following were **missing APIs** and have been built:

| Area | Implemented now |
|---|---|
| **Auth** | `/api/auth`: login (JWT `{id, tv}` in httpOnly cookie `hp_admin_token`), logout (tokenVersion bump = kill-all), `GET /me`, `PUT /profile`, `POST /password`, forgot/reset password via 6-digit bcrypt-hashed OTP, email change request/confirm. Login throttling fires **before** the user lookup. |
| **Platform** | `/api/platform`: dashboard (computed plan statuses, expiring-soon, near-limits, alerts, recent signups), revenue (OWNER-only), organizations list/detail/suspend/ban/restore, plans CRUD, templates CRUD + publish/unpublish + `ai-generate`, users CRUD (OWNER), support accept/deny/reply/resolve/reopen with `HPX-YYMM-NNNN` ticket numbers + decision history, gallery-settings (persisted), audit log with actors. |
| **Org** | `/api/org`: dashboard, events CRUD + pause/resume (validated branding/filters/layoutPrices, plan limits), templates, devices (rename/operator/assign/unassign, telemetry), guest tickets inbox (reply/resolve/reopen — merges legacy `SupportTicket`s), platform-support (create/reapply/reply), revenue (event×booth matrix, month split FY-Apr, settlement split), wallet + withdrawals (`HPX-PO-…` refs, ≥₹500), defaults (payout mode, UPI, booth timeout, org layout prices), coupons CRUD + pause/activate, team CRUD + deactivation guards, gallery (gated by platform gallery + guest consent), audit. |
| **Booth (electron)** | `/api/booth`: login/bootstrap/heartbeat (45 s cadence inside the 90 s online window), telemetry, server-priced checkout quote, Razorpay payment-link QR, payment status polling, free/offline-UPI completion with UTR dedupe, photo upload (S3 + `Photo` record), session complete → `PhotoShare` token → share URL, guest tickets. |
| **Shared contracts** | `lib/layouts.js` (1:1 port of the CRM layout engine incl. slot geometry + price keys `family:slots`), `lib/constants.js` (roles, perms, plans, filters), `lib/planService.js` (computed plan status, effective price resolution), `lib/mailService.js`, models `Withdrawal` / `PlatformSetting` / `Counter`. |

## 2. Logical-flow bugs found & fixed

1. **`POST /api/org/sessions/:id/pay` free-completion recorded nothing** (legacy): the
   whole org router was stubbed. Fixed by the full org implementation above.
2. **`complete-prepaid` let anyone flip a payment to `paid`** by sending a
   `paymentId` (`payment.status = 'paid'` unconditionally). Now rejects with 409
   unless the payment is already paid; photos only attach to paid orders.
3. **`complete-prepaid` crashed** with a `ReferenceError` (`qrToken`/`qrUrl` assigned
   without `let`) whenever a digital copy was requested — guests silently lost QR
   codes. Fixed.
4. **CRM `/password` + `/email/change-request` could never succeed**: `authenticate`
   selects `-password`, so `comparePassword` (which reads `this.password`) always
   failed. They now re-fetch the full document by id.
5. **`CronService` was a silent no-op**: it queried `Organization.status: 'trial'`
   and wrote `'expired'` — neither is in the schema enum, so nothing ever matched.
   Replaced with real maintenance jobs (expire abandoned `created` payments after
   24 h; flip expired PhotoShares to `expired`). Plan expiry is now computed on
   read by design.
6. **`utils/auditLogger.js` wrote fields that don't exist** on the `AuditLog`
   schema (`performedBy`, `targetId`, `targetModel`, `details`, `ipAddress`) —
   every legacy audit write silently lost its data. Now maps onto the canonical
   schema via `lib/helpers.writeAudit`.
7. **Electron `completeFree` sent `quote.quoteId`** (a string) where the backend
   expects the full quote — a ₹0 record would be written for paid offline-UPI
   orders. App now sends the whole quote object (test updated accordingly, still
   green because the demo impl ignores the argument).
8. **Electron heartbeat ran every 2 minutes** while the server's online window is
   90 s — booths constantly flapped offline in the CRM. Now 45 s.
9. **Electron regenerated `deviceUuid` on every manual login** → duplicate device
   rows, burned plan seats, orphaned booth history. The UUID is now persisted
   locally (survives unpairing) and re-pairing reuses/rotates the same device.
10. **Booth re-pairing to a different org** would hit the `deviceUuid` unique index
    (E1100). Both booth login paths now transfer the device and detach it from the
    old org's events.
11. **`/api/events/public/live|list` never saw CRM v2 events** because v2 computes
    status from dates and never writes the denormalized `status` field. The
    `syncEventStatuses()` helper (defined but never called anywhere) is now invoked
    by the legacy endpoints.
12. **Legacy coupon routes used fields that don't exist** (`isActive`, `maxUses`,
    `eventId` singular) against the real `Coupon` schema (`status`, `quantity`,
    `usedCount`, `eventIds[]`) — coupon validation could never succeed correctly.
    Fixed in couponRoutes and paymentRoutes.
13. **Dead files removed**: `routes/authRoutes.js`, `routes/usageAccessRoutes.js`,
    `models/RoleConfig.js`, `seed_admin.js` (unused, unreachable, or superseded).

## 3. "Should be in the DB but wasn't" — data-model gaps fixed

* **Photos were TTL-deleted and unscoped.** `Photo` is now multi-tenant
  (`organizationId/eventId/deviceId/sessionId`, indexed) with `compositeUrl`,
  `guestConsent`, `capturedAt`, and **no TTL** — the org gallery and guest shares
  depend on photos surviving. ⚠️ Existing deployments must drop the legacy
  `createdAt_1` TTL index (see `backend/PRODUCTION_SETUP.md` § 4.1).
* **Wallet balance was never persisted anywhere** — computed now from
  `Payment.settlement` (new field) minus `Withdrawal` records (new model), with
  legacy payments defaulting to wallet.
* **Device operator changes / coupon edits / template publishes / org suspend
  reasons / support decisions** had no audit trail — all now written to `AuditLog`
  via the canonical `writeAudit`.
* **Payment records were missing device + settlement context**; booth orders now
  record `deviceId`, `settlement`, coupon, discount, UTR (deduped).
* **Platform gallery policy had no storage** — `PlatformSetting` singleton with
  `galleryEnabled` / `requireGuestConsent` (persisted, editable in the CRM).
* **Support decisions were lost on status change** — `PlatformSupportRequest`
  now keeps `decisionHistory[]` + `reapplyCount`.

## 4. Security issues found & fixed

| # | Issue | Fix |
|---|---|---|
| S1 | **Client-controlled payment amount** (`POST /api/payments/create-order` trusted `req.body.amount`) — a booth or MITM could pay ₹1 for ₹500 prints | Server-side pricing (event layoutPrices → org defaults → catalogue), client amount ignored |
| S2 | **`/api/share/generate` and `PUT /api/share/:token` were unauthenticated** — anyone could mint share links for any event or hijack any share | Device-token auth + org scoping |
| S3 | **`/api/upload` was unauthenticated** and trusted client `orgId` | Device auth; org/event/device scoping from the token |
| S4 | **`/api/upload/logo` was unauthenticated** and trusted client `orgId` | CRM-user auth (org roles only), S3 path scoped to `req.user.organizationId` |
| S5 | **`GET /api/devices/current-event` leaked `razorpayKeyId`, `razorpayKeySecret` and `passkey`** to the booth client | Secrets stripped from every event payload (also `/public/join`) |
| S6 | **`/api/events/public/join` accepted empty-string passkeys** (default `''`) — full event disclosure for CRM v2 events | Events without a passkey are rejected (403) |
| S7 | **`/api/payments/status/:id` exposed any payment's state** to anyone | Device auth + org scope |
| S8 | **OTP codes were returned in API responses in production** whenever SendGrid wasn't configured (mail "demo" fallback) | Production fails closed (503); demo delivery only outside prod or with explicit `DEMO_MODE=true` |
| S9 | **`/api/support` accepted a spoofable `organizationId`** from the body | Org derived from device token only; rate limited; email validated |
| S10 | **Stolen JWTs stayed valid forever** after password change/deactivation | `tokenVersion` check on every request; bumped on logout/password change/reset/email-confirm/deactivation |
| S11 | **Payment/coupon cross-tenant gaps** (device could bill another org's event) | Org-match enforcement in booth quote, payments, share generate, coupon validate |
| S12 | **Booth payments had no real provider integration** (mock auto-pay) | Razorpay order + payment link; status polled server-side; `short_url` used as the QR payload (electron QR-encodes a string; `qrCode.create` only returns a PNG `image_url`) |
| S13 | `/api/proxy/logo` could be pointed at arbitrary hosts | Restricted to S3 hostnames only |
| S14 | `express-rate-limit` + login throttling are in-process | Documented: add Redis store for multi-instance deploys (setup guide § 7) |

## 5. Mock / demo behavior removed (production readiness)

* Booth payment auto-success (pay after ~6.5 s) → real Razorpay polling.
* Fake pricing/coupons in booth checkout → server-computed quote.
* Electron printer simulator (`dnp-sdk-simulator`, always "success", fake job ids) →
  real silent printing through the OS driver pipeline via a hidden
  `webContents.print` window; printer telemetry now enumerates actual system
  printers instead of hard-coding "connected: true".
* Electron login created throwaway UUIDs → persistent installation identity.
* `finishAndPrint` sent no bitmap and no upload → canvas rasterizer
  (`compose.ts`) renders the true print (background, ornaments, filtered slots,
  footer logo + text, stickers), prints it, uploads the composite to S3, and the
  server issues a real share URL.
- `mailService` demo fallback in production → fails closed (see S8).
- `CronService` fake status writes → real maintenance jobs.
- Removed dead `authRoutes` / `usageAccessRoutes` / `RoleConfig` / `seed_admin`.
- `server.js`: exports the app for Vercel, binds the port only when not on
  Vercel, quiet request logging in prod, booth CORS (`Origin: null`, no
  credentials) separated from cookie CORS.

## 6. Electron app ↔ backend ↔ CRM flow (verified end-to-end contracts)

`login → bootstrap → heartbeat(45s) → quote → payment link QR → poll → capture →
select → customize → compose → print → upload → session complete → share QR` —
every step now has a real backend counterpart; `api.test.ts` (5 demo contract
tests) + `pricing.test.ts` remain green, `tsc -b` clean. `.env.example` added:
set `VITE_BOOTH_API_URL` before packaging (unset = demo API, dev/test only).

## 7. Improvement suggestions (NOT implemented — per instruction)

1. **Razorpay webhooks** (`payment_link.paid`) to mark payments paid instantly
   instead of booth polling; keeps status authoritative if the booth dies mid-order.
2. **Redis-backed rate limiting / login throttle** for multi-instance deploys.
3. **Guest consent prompt** on the booth success screen — consent is currently
   inferred from "digital copy requested"; an explicit checkbox would be cleaner
   for the gallery consent filter.
4. **`SupportTicket` resolved-doc TTL (24 h)** deletes resolved guest tickets —
   consider raising it to 30–90 days so orgs keep a support history.
5. **Legacy `/public/live` without a device token** still returns *some* org's
   live event (single-tenant legacy behavior); require device auth once all
   booths run the new app.
6. **S3 CORS + signed URLs** for gallery/composites instead of public buckets.
7. **Payment reconciliation job**: a daily cron comparing Razorpay settlements
   vs `Payment` docs would catch missed polls (pairs well with #1).
8. **Idempotency keys** for `free-complete`/`create-order` to make booth retries
   safe under flaky networks.
9. **`scratch/` directory** in backend contains ad-hoc scripts — move out of the
   deployable repo or gitignore it.
10. **The legacy client's grid-price formats** (`gridPrices`) aren't part of the
    CRM v2 price namespace; migrate remaining legacy booths to the electron app,
    after which `printPrice`/`gridPrices` fallbacks can be retired.
11. **Add automated backend tests** (the repo has none) — the electron demo
    contract tests proved valuable; mirroring them against the real API with an
    in-memory Mongo would catch regressions cheaply.

## 8. Files changed

**Backend — new:** `lib/{layouts,constants,helpers,planService,mailService}.js`,
`models/{Withdrawal,PlatformSetting,Counter}.js`, `services/ai/AiDraftService.js`,
`routes/crm/{auth,platform,org}.js`, `seed_plans.js`, `PRODUCTION_SETUP.md`.
**Backend — rewritten/edited:** `server.js`, `routes/boothRoutes.js`,
`routes/paymentRoutes.js`, `routes/couponRoutes.js`, `routes/photoShareRoutes.js`,
`routes/supportRoutes.js`, `routes/eventRoutes.js`, `routes/deviceRoutes.js`,
`routes/settingRoutes.js`, `services/CronService.js`, `utils/auditLogger.js`,
`middleware/auth.js`, `models/{User,Organization,Payment,Photo,PlatformSupportRequest,SubscriptionPlan,SupportTicket}.js`,
`seed_superadmin.js`, `.env.example`, `package.json` (seed scripts).
**Backend — deleted:** `routes/authRoutes.js`, `routes/usageAccessRoutes.js`,
`models/RoleConfig.js`, `seed_admin.js`.
**Electron:** `ui/services/compose.ts` (new canvas rasterizer),
`ui/services/api.ts` (uploadPhoto + full-quote completeFree),
`ui/App.tsx` (print pipeline, heartbeat, persistent UUID),
`electron/{store,main,hardware}.ts`, `preload.cts`, `ui/services/bridge.ts`,
`ui/types/electron.d.ts`, `ui/services/api.test.ts`, `.env.example`.
