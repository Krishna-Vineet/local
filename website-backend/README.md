# HappyPix — Website Backend

The public API behind `website/` (happypix.in). A **separate service**
from `backend/` (booth/CRM API) with its own rate limits and CORS list,
connected to the **same MongoDB database** — plans, discounts,
organizations, users, subscriptions and guest downloads are shared
collections. See `src/models.js` for the mirrored schemas (only
`websitecheckouts` + `websiteleads` are owned here) and
`../docs/New_Display_Website_and_Gallery_Fixes.md` for the full design.

## Run

```bash
cp .env.example .env   # MONGODB_URI must match backend/'s database
npm install
npm start              # http://localhost:5001
npm test               # pricing / subscription-period tests
```

## API

| Method & route | Purpose |
|---|---|
| `GET /api/health` | Service health |
| `GET /api/plans` | Public catalogue with live discount pricing |
| `POST /api/checkout/order` | Validate details → register-or-verify account → Razorpay order (₹0 activates instantly) |
| `POST /api/checkout/verify` | Verify Razorpay signature → create/renew org + subscription (idempotent) |
| `GET /api/downloads/:id` | Guest digital copy — 410 once the 24h window closes |
| `GET /api/downloads/:id/file/:kind` | Download `composite` or frame `0..n` (attachment) |
| `POST /api/internal/downloads` | Mint a download link (header `x-internal-secret`; server-to-server only) |
| `POST /api/leads` | Contact / demo / hardware / support messages |

Account rules at checkout:

- **New email** → Organization + ORG_ADMIN user created only *after*
  payment verifies (password stored bcrypt-hashed on the pending
  checkout, wiped on activation).
- **Existing email** → supplied password must bcrypt-match the CRM
  account; purchase renews that organization, extending from its
  current expiry so no paid day is lost. Banned orgs are refused.

Deploy: `vercel.json` mirrors the main backend's setup (`VERCEL=1`
skips the listener; the DB connection is awaited per-request).
