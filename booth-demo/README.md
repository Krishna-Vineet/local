# HappyPix — Booth session demo

A frontend-only walkthrough of the HappyPix booth app, built to pitch clients
without installing the Android or Electron builds. No backend, no API calls.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

## What it does

1. **Setup** (`/`) — organisation name + logo, event name, event type, and up to
   three template logos. The print preview on the right updates live.
2. **Session** — the guest flow mirrors the native booth:
   Welcome → Format → Template → Prints → Payment (coupon + demo QR) →
   Camera → Shot selection → Finishing touches → Success (QR to
   `happypix.in/download/demo`).

`Start session` initialises the session in `BoothContext` and drops you into the
welcome screen. Every step can be revisited with the back controls.

## Notes for pitching

- The camera uses `getUserMedia` when it is available. If permission is denied
  the flow continues with the event's sample frames, so a demo never stalls.
- Payment is simulated: the QR is a placeholder and **Done** marks the order paid.
  Demo coupons are `HAPPY18`, `PARTY20`, `WELCOME10`, `GALA15`.
- Branding is in-memory only — reloading returns to the setup screen, which is
  what you want between clients.

## Structure

```
src/
  pages/Setup.jsx            branding form + live print preview
  pages/booth/               the nine session screens
  components/TemplateCanvas  print renderer (palette, slots, caption, band)
  components/Logo.jsx        HappyPix lockup, lifted from the native AppLogo
  data/templates.js          event types, 80+ print designs, filters, stickers
  context/BoothContext.jsx   session state
  index.css                  all styling
```

Sample photographs in `public/samples/` are AI-generated stand-ins so the demo
works offline; swap them for licensed event photography before a public launch.
