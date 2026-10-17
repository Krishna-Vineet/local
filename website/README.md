# HappyPix — Display Website (happypix.in)

The public HappyPix website: marketing pages, live plan pricing with
CRM-managed discounts, Razorpay buy/renew checkout, and the hidden
24-hour guest download page that booth QR codes point to.

Built with React + Vite + **Framer Motion** (scroll reveals, parallax
hero, the playable retro booth). No component library — the design
system lives in `src/index.css`.

## Run

```bash
npm install
npm run dev        # http://localhost:5174  (proxies /api → website-backend :5001)
npm run build
```

Copy `.env.example` to `.env` for production values:

| Var | Meaning |
|---|---|
| `VITE_API_URL` | Origin of `website-backend` (empty in dev = vite proxy) |
| `VITE_CRM_URL` | Where buyers are sent to sign in after checkout |

## Structure

```
src/
  pages/      Home · Booth · Software · Hardware · Pricing · Contact · Download (hidden)
  components/ ui.jsx (nav/footer/icons) · RetroBooth.jsx (playable demo)
              PricingCards.jsx · Checkout.jsx (Razorpay buy/renew)
  data/       content.js — all copy, compatibility lists, demo plans
  lib/        api.js — website-backend client (+ demo fallbacks)
public/images/  editorial photos (replace with real event shots anytime)
```

Key behaviours:

- **`/download/:id`** is deliberately chrome-less and `noindex`; links
  expire 24 hours after the booth session. `/download/demo` is a
  labelled sample of the same page.
- **Pricing** reads live plans from the website backend, so discount
  campaigns set in the platform CRM appear (and expire) automatically.
  If the API is unreachable the page falls back to a demo catalogue.
- **Checkout** is one form for new + returning customers: new emails
  register on payment; existing emails must match their CRM password
  and then renew (extended from current expiry).

See `../docs/New_Display_Website_and_Gallery_Fixes.md` for the full picture.
