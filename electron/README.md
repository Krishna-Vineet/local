# HappyPix Booth

Cross-platform Electron kiosk application for HappyPix photo booths. The renderer is React +
TypeScript; privileged persistence, display discovery, printing, and future vendor SDK bridges live
in Electron's main process behind a narrow preload IPC API.

## Current milestone

The app currently provides a complete functional booth simulator:

- Persistent installation UUID and automatic bootstrap on power-up
- Login/pairing fallback with timestamp, location, display, and installation metadata
- Cached event/settings snapshot and two-minute heartbeat contract
- Responsive horizontal/vertical kiosk UI
- Start → orientation → template filters → print count → payment → camera → photo selection →
  customization → print/download success flow
- Server-style event pricing, coupon validation, ₹0 completion, UPI QR, and payment polling simulator
- Live browser camera preview with extra captures and a deterministic fallback simulator
- Bundled designer template registry plus declarative AI/playground designs
- Simulated DNP print adapter, Canon adapter seam, display enumeration, and telemetry counters
- Idle-session reset on guest selection/customization screens

The simulator is intentionally used when `VITE_BOOTH_API_URL` is not set. Demo credentials:

```text
booth@happypix.in
password: demo123
```

## Development

```bash
npm ci
npm run dev
```

`npm run dev` starts Vite on port 8888 and the Electron shell in parallel. To preview only the
responsive renderer in a browser:

```bash
npm run dev:react -- --host 0.0.0.0
```

## Verification

```bash
npm run verify       # typecheck + lint + Vitest + Electron compile + renderer build
npm test             # 7 booth contract/pricing tests
npm run build:react
npm run transpile:electron
```

## Real backend mode

Create `.env.local` inside `electron/`:

```env
VITE_BOOTH_API_URL=https://happypixbackend.vercel.app
```

The required production endpoints are documented in the root `BACKEND_CHANGES.md`, section
**v2.5 TODO — Electron booth application contract**. The app does not silently fall back to legacy
CRM routes when a real URL is configured.

## Packaging

Build on the target operating system whenever native SDK binaries are included:

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

Artifacts are written to `electron/release/`. Code signing/notarization and vendor SDK redistribution
licenses must be configured before production distribution.

## Security boundary

- `contextIsolation: true`
- `nodeIntegration: false`
- sandboxed renderer
- only allow-listed IPC methods exposed by `preload.cts`
- runtime navigation and popup restrictions
- templates are bundled allow-listed components or validated design data; executable JSX is never
  downloaded from the backend

See `docs/IMPLEMENTATION.md` and `docs/HARDWARE-INTEGRATION.md` for architecture and remaining work.
