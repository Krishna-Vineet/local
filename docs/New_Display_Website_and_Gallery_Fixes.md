# HappyPix — Plan Discounts, Gallery Fix & the New Display Website

*Shipped: Oct 2026 · Branch: `arena/de88b5d9-local`*

This document covers three pieces of work:

1. **Discounts on subscription plans** (platform CRM)
2. **"Can't see images from booth in gallery"** — root causes & fixes
3. **The new HappyPix display website** (`website/` + `website-backend/`)

---

## 1. Discounts on subscription plans (Platform CRM → Subscription Plans)

Each plan can now carry **one discount campaign**:

| Field | Meaning |
|---|---|
| `discountType` | `none` · `percent` (% off) · `flat` (a static ₹ amount off) |
| `discountValue` | Percent (1–100) or flat ₹ amount |
| `discountLabel` | Buyer-facing label, e.g. "Launch Week" |
| `discountStartsAt` / `discountEndsAt` | **The discount duration** — the window in which it is live. Either side may be empty (open-ended). |

Rules (enforced identically everywhere):

- A discount is live only while *now* is inside its window.
- Free (₹0) and contact-sales (`price: null`) plans are never discounted.
- Percent rounds to the nearest rupee; flat can never exceed the price.
- All maths lives in **one place**: `backend/services/planService.js`
  (`normalizeDiscount`, `isDiscountActive`, `planPricing`,
  `parseDiscountInput`). The CRM page mirrors it only for instant
  preview; the public website re-implements it in
  `website-backend/src/pricing.js` (kept in sync, same tests).

Where it shows up:

- **CRM** (`crm/src/pages/platform/SubscriptionPlans.jsx`): plan cards show
  the effective price, the struck-through list price, a `−20%` chip and
  "ends in …" — the edit modal has a full Discount campaign section with a
  live price preview. Works in both the real API and the CRM mock
  (`crm/src/api/mock/*`; seeded example: Professional at −20% "Launch Week").
- **Platform API**: `GET/POST /api/platform/plans`, `PUT /api/platform/plans/:id`
  accept/return the discount fields plus a computed `pricing` block.
- **Website checkout**: charges `pricing.effectivePrice` and snapshots
  `originalAmount` / `discountAmount` / `discountType` / `discountValue` /
  `discountLabel` onto the `Subscription` record, so invoices and platform
  revenue never change when a campaign later edits.

Re-seeding plans (`node seed_plans.js`) deliberately **never overwrites**
an existing plan's discount — campaigns are managed live from the CRM.

---

## 2. Why booth images were missing from the org Gallery — and the fix

There were **three independent bugs**, any one of which empties or breaks
the gallery:

### Bug A — Photo records deleted themselves after 24 hours
`Photo.createdAt` carried `expires: 86400`, a Mongo TTL index. Every booth
photo record vanished 24h after the session (the S3 files survived; the
gallery rows did not).
**Fix:** TTL removed from `backend/models/Photo.js`. The 24-hour limit now
applies only to the *guest download link* (below), never to the org's
gallery.
**⚠️ One-time migration per database** (removing the schema flag does not
drop the index Mongo already created):

```bash
cd backend && node scripts/drop-photo-ttl-index.js
```

### Bug B — the Electron booth never sent its photos
`POST /api/booth/sessions/complete` only stores what it receives. The
React-Native booth sent `photos`, but the Electron booth's
`completeSession` contract was `{ sessionId, digitalCopy }` — so Electron
sessions "completed" with **zero** photos stored.
**Fix:** `electron/src/ui/services/api.ts` now has a real
`CompleteSessionInput` (`photos`, `compositeUrl`, `guestConsent`,
`eventId`), and `App.tsx → finishAndPrint` sends the selected photos'
data URLs. The RN client-app contract gained the same optional fields.
Also in the same handler: a session composite submitted separately is
persisted and attached to the session's records, and `photosStored` now
reports records actually stored (it previously reported only
consent-visible ones).

### Bug C — private S3 URLs rendered as broken images
Booth photos live in a **private** bucket, so the stored
`https://<bucket>.s3…` URL returns `403 AccessDenied` in a browser `<img>`
(the codebase already had a one-off logo proxy "to bypass AccessDenied").
Relatedly, `Photo.compositeUrl` was written by `/api/upload` and read by
the gallery but was never declared in the schema, so Mongoose silently
dropped it.
**Fix:** `compositeUrl` is a real field now, and the gallery API returns
**short-lived signed URLs** (`backend/services/photoUrlService.js`,
`@aws-sdk/s3-request-presigner`, 1-hour expiry, refreshed per page load;
data-URLs and external URLs pass through untouched). The CRM Gallery page
also got a proper broken-image fallback card (a photo whose file fails
loads as an explained placeholder, never as a mystery), plus event/booth
filter validation (malformed ids no longer CastError the whole page).

---

## 3. The new HappyPix display website

Two new deployables; everything else is untouched:

```
website/           React + Vite + Framer Motion — the public site
website-backend/   Express — the site's OWN backend (port 5001)
backend/           unchanged booth/CRM API (+ the fixes above)
crm/               unchanged CRM (+ discount UI, gallery robustness)
```

### Same database, on purpose
`website-backend` connects to the **same `MONGODB_URI`** as `backend/`.
Plans (with discounts), organizations, users, subscriptions and guest
downloads are shared collections — `website-backend/src/models.js`
mirrors the schemas; keep the two in sync when fields change. Only
`websitecheckouts` and `websiteleads` are owned by the website backend.

### Pages
| Route | What it is |
|---|---|
| `/` | Hero ("Happy moment. Every pixel…"), features, the interactive retro booth, how-it-works, platforms teaser, live pricing preview, testimonials, FAQ |
| `/booth` | The booth experience — playable demo, anatomy of a session, the digital-copy story |
| `/software` | Android tablets / iPad / Windows kiosk (**all "Launching soon"** + waitlist), booth-app features, the CRM |
| `/hardware` | HappyPix Booth **"Coming soon"** + notify-me, **DNP printer** table (DS620A, DS820A, DS-RX1HS, QW410, DS40, DS80), **Canon camera** table (EOS R/RP/M50 Mk II/90D/250D/2000D/G7 X III…) |
| `/pricing` | Live plans (discounts included) + the buy/renew checkout |
| `/contact` | Contact / demo / hardware / support leads → `websiteleads` |
| `/download/:id` | **Hidden** guest page (no nav, `noindex`, chrome-less). Not linked anywhere on the site. |

Design language: the brand palette from happypix.com.au / the logo
(magenta `#EA097F`, blue `#3871C1`, green `#85C536`, purple `#5F4CAA` on
ink `#141020` + warm cream paper), Fraunces italic display type for the
retro heart, generous whitespace, film-strip motifs, grain, Framer
Motion reveals/parallax and a fully playable booth (countdown → flash ×3
→ strip prints → QR). Content structure takes its cues from the best
booth platforms (Foto Master et al.) — every "live" claim maps to a real
HappyPix capability; roadmap items are badged honestly.

### The 24-hour guest download (`/download/:id`)
1. Booth finishes a session → main backend stores the photos, creates a
   `GuestDownload` (`backend/models/GuestDownload.js`,
   `services/guestDownloadService.js`) with an unguessable 144-bit id
   and `expiresAt = now + 24h` (Mongo TTL + explicit checks on read).
2. The booth's response now returns `downloadUrl` / `shareUrl` pointing
   at `<WEBSITE_URL>/download/<id>` — the existing booth success screens
   (Electron + RN) already render that URL as a QR. **Set `WEBSITE_URL`
   in `backend/.env`** (default `https://happypix.in`).
3. The guest scans → the website asks `website-backend`
   `GET /api/downloads/:id` (410 after expiry, signed S3 URLs when the
   bucket is private) and renders the final print + frames with a live
   expiry countdown and per-file download endpoints.
4. Other producers can mint links via
   `POST /api/internal/downloads` with the `WEBSITE_INTERNAL_SECRET`.

Try it without any booth: **`/download/demo`** renders a labelled sample.

### Buy / renew (`/pricing` → checkout)
One form (organization, owner name, phone, email, password):

- **New email** → password is hashed at order time; the Organization +
  `ORG_ADMIN` User are created **only after payment verifies** (abandoned
  checkouts leave no orphan accounts).
- **Existing email** → the password is bcrypt-checked against the existing
  CRM account. Wrong password → a specific error (never a duplicate
  account). Right password → renewal/upgrade: the new term **extends
  from the current expiry**, so no paid day is lost.
- Payment is **Razorpay** (same keys as the platform): `POST
  /api/checkout/order` snapshots the discounted price, the browser pays,
  `POST /api/checkout/verify` checks the HMAC signature and activates —
  writing exactly the `Subscription` the CRM revenue pages read, with a
  `HAP-INV-…` invoice number.
- ₹0 outcomes (trial / 100% campaign) activate immediately with no gateway.
- `price: null` (Enterprise) plans are contact-sales only, online.

### Running it
```bash
# terminal 1 — website backend (same .env values as backend/)
cd website-backend && cp .env.example .env && npm install && npm start   # :5001

# terminal 2 — website
cd website && npm install && npm run dev                                 # :5174 (proxies /api → :5001)
```
Without the backend running, the site still renders: plans fall back to a
clearly-labelled demo catalogue and checkout runs in demo mode.

Deploy: both folders carry Vercel configs like the existing apps
(`website-backend/vercel.json`); set `VITE_API_URL` for the site build
and `WEBSITE_URL`/`ALLOWED_ORIGINS` on the backends.

### Media note
The repo contained no usable photos from the old site (and the old site
can't be fetched from every environment), so the site ships with four
new AI-generated editorial images in `website/public/images/`
(`hero-booth`, `retro-booth`, `wedding-booth`, `guests-party`). Drop in
real event photography with the same filenames whenever ready — no code
changes needed. Everything else (strips, QR, motifs) is drawn in
code/CSS/canvas.

---

## Verification performed

- `backend`: `npm test` — 37 pass; 1 pre-existing failure in
  `boothSnapshot.test.js` ("layout price validation rejects unknown
  iterations") that also fails on unmodified `main`. New discount +
  guest-download tests pass.
- `website-backend`: `npm test` — pricing/period tests pass.
- `website`: `npm run build` ✓ · `crm`: `npm run build` ✓ ·
  `electron`: `npx tsc -b` ✓ (booth photo-sending change typechecks).
- Both test scripts' `node --test tests/` glob was fixed to
  `tests/*.test.js` (the old form fails on current Node).

## Follow-ups worth doing next

1. Run `backend/scripts/drop-photo-ttl-index.js` against production.
2. Set `WEBSITE_URL` in the main backend env so booth QR codes point at
   the real domain; set the website-backend's AWS keys if the bucket
   stays private (needed to sign download-page photos).
3. Point happypix.in DNS at the `website/` deployment and the API
   subdomain at `website-backend/`.
