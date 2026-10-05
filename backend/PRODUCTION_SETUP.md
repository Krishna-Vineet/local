# HappyPix Backend — Production Setup Guide

This document describes how to stand up the HappyPix backend (Express + MongoDB + S3 + Razorpay) for production, and the **migration steps required on existing databases** after the CRM v2 backend rework.

---

## 1. Environment

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | ≥ 32 random chars (`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | ✅ | Live keys must start with `rzp_live` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET_NAME` | ✅ | Photo + logo storage |
| `CLIENT_URL` | ✅ | Public guest app URL (share links point here) |
| `CRM_URL` | recommended | Shown by seed scripts |
| `SENDGRID_API_KEY` | ✅ in prod | **OTP emails fail closed without it** — reset codes are never leaked in responses |
| `EMAIL_FROM_ADDRESS` | recommended | Verified SendGrid sender |
| `ALLOWED_ORIGINS` | optional | Extra CORS origins (comma separated) |
| `TOGETHER_API_KEY` | optional | AI template backgrounds (Together.ai FLUX). Falls back to SVG backgrounds if unset |
| `SESSION_TTL_MIN` | optional | CRM JWT lifetime, default 480 |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | seeds only | Bootstrap OWNER account |

`NODE_ENV=production` on the deployed host switches on: secure cookies, real-only email delivery, quiet request logging.

## 2. Seeding (one-time)

```bash
npm run seed          # plans catalogue + platform settings + OWNER account
npm run seed:templates   # optional: starter designer templates
```

The plan catalogue mirrors `lib/constants.js → DEFAULT_PLANS` (trial / starter / basic / professional / business / custom / enterprise). Prices stay editable in the CRM; the seed only refreshes structural fields.

## 3. Deployment

### Vercel (current setup)
`vercel.json` routes everything to `server.js`, which exports the Express app
(`export default app`) and only binds a port when `VERCEL` is not set. Deploy the
`backend/` directory as the project root.

### Standalone (Docker / VM)
```bash
npm ci
NODE_ENV=production node server.js   # binds PORT (default 5000)
```

## 4. Required migration steps on existing databases

### 4.1 Drop the legacy Photo TTL index  ⚠️ REQUIRED
Photos are now permanent organization assets (org/event/device/session indexed,
`compositeUrl`, `guestConsent`, `capturedAt`). The old schema had a TTL index on
`createdAt` that auto-deleted photos after a period — **if your existing
`photos` collection still has it, every new photo will eventually vanish**:

```js
// mongosh
db.photos.getIndexes()                 // look for createdAt_1 with expireAfterSeconds
db.photos.dropIndex("createdAt_1")     // remove it if present
```

### 4.2 Upgrade the OWNER account
```bash
npm run seed:superadmin   # upgrades legacy 'admin'/'superadmin' users to role OWNER
```

### 4.3 Plan catalogue + platform settings
```bash
npm run seed:plans
```

### 4.4 Notes on legacy data
* Legacy `SupportTicket`s (created via `/api/support`) surface in the CRM org
  ticket inbox automatically; booth-raised tickets use the new `Ticket` model.
* Legacy payments created before the `settlement` field existed are treated as
  `wallet`-settled in revenue/wallet calculations.
* Events created by the legacy admin keep working; CRM v2 events compute status
  from dates (`lib/helpers.js → computeEventStatus`).

## 5. S3 bucket configuration

1. **Lifecycle rule**: the `PhotoShare`/`DigitalToken` share links expire after
   `sharingConfig.expirationDays` (default 7 days). If you want hosted composites
   garbage-collected, set an S3 lifecycle rule on `happypix/*` with an expiry
   **≥ 30 days** (must exceed the longest share expiry; remember tickets can put
   photos on hold).
2. **CORS**: the booth app composites prints in a canvas and uploads them; if you
   also render S3-hosted logos/backgrounds in that canvas, the bucket must allow
   `GET` from `null` (Electron `file://` origin):
   ```json
   [{"AllowedOrigins": ["*"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"]}]
   ```
3. `make_bucket_public.js` exists for making the bucket readable; prefer
   bucket-policy reads over per-object ACLs.

## 6. Razorpay

* Booth (Electron) payments create a **Razorpay payment link** and use its
  `short_url` as the QR payload (the booth renders the QR client-side). Polling
  hits `GET /api/booth/payments/:id`, which checks the payment link / order status
  server-side — there is no auto-payment mock in production.
* The legacy client flow (Razorpay Checkout + UPI QR image) remains on
  `/api/payments/*` with device authentication and **server-side pricing**.
* Webhooks are not required for the booth flow (polling), but configuring
  `payment_link.paid` / `payment.captured` webhooks later removes the poll window
  (see improvement suggestions).

## 7. Rate limiting / throttling

Login throttling (`loginGuard`) is in-process. On a multi-instance deployment
(Vercel serverless), install a shared store so counts are global:

* Suggested: `rate-limit-redis` + `connect-redis` with `REDIS_URL`
* Same for the express-rate-limit instances on `/api/share/*` and `/api/support`.

## 8. Booth (Electron) packaging

1. `cd electron && cp .env.example .env` → set `VITE_BOOTH_API_URL` to the public
   API URL. **Without it the app runs against the built-in demo API and never
   talks to a server** — never package a build without it.
2. `npm run dist:mac` (or the Windows/Linux equivalent in `electron-builder.json`).
3. Booth identity: the app persists a `deviceUuid` locally and reuses it when
   re-pairing, so re-login rotates the token but keeps the same device record.
4. Printing uses the OS print pipeline (`webContents.print`, silent) — install
   the dye-sub printer driver (DNP / Citizen / Hiti) and set it as the default
   printer. The app auto-detects booth printers for telemetry.

## 9. Health checks

* `GET /` → 200 when the API is up.
* Any route returns `503 {error: 'Database unavailable...'}` if MongoDB is down.
* Watch the logs for `💳 Razorpay mode:` at boot — a `TEST` key in production is
  a config mistake.
