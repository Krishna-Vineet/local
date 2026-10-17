# Electron booth implementation

`docs/PreDevelopmentPhases/phase1.md` is intentionally not used; it describes an obsolete flow.

## Processes

### Renderer (`src/ui`)

Owns guest UI, ephemeral session state, camera preview/capture through the browser media API, event
snapshot cache, API orchestration, template preview, idle timers, payment polling, and sounds. It has
no direct Node.js, filesystem, process, or printer access.

### Preload (`src/electron/preload.cts`)

Exposes a narrow `window.booth` contract. Inputs remain plain serializable objects. Do not expose raw
`ipcRenderer`, filesystem paths, shell execution, environment variables, or vendor SDK objects.

### Main process (`src/electron`)

Owns the kiosk window, persistent installation state, external-display discovery, cumulative hardware
counters, local print adapter, and future native camera/printer SDK bridges.

## Guest state flow

```text
boot ── valid stored device token ──> bootstrap ──> waiting | start
  └── missing/revoked pairing ──> login

start → orientation → templates → prints → payment
      → camera → photos → customize → print/share → success → start
```

Payment is intentionally before capture. A non-zero order cannot enter capture until a server payment
status is `paid`. A zero-value coupon order must still be registered through the backend first.

The booth does not expose the tablet app's start-screen coupon or event-exit controls. Coupon entry is
available only at checkout.

## Event and template cache

A successful bootstrap stores the complete hydrated booth snapshot in local storage. The heartbeat
runs every two minutes and submits hardware telemetry plus the known config revision. A production
backend should return a replacement snapshot only when the revision changed.

Designer templates resolve through the local `componentId` registry in `TemplateCanvas.tsx`.
Playground/AI templates use declarative `design` fields. Unknown designer IDs must eventually block
that template and report telemetry; never evaluate downloaded JavaScript.

## Responsive policy

Layouts use CSS grid, fluid typography, bounded dimensions, `orientation` media queries, and
aspect-ratio-specific overrides. Primary guest actions remain at the bottom edge. The UI targets
portrait and landscape kiosks from 720 px minimum up to high-DPI 4K displays.

## Simulator boundaries

Without `VITE_BOOTH_API_URL`, `services/api.ts` supplies deterministic demo data and simulates:

- login/bootstrap/heartbeat
- authoritative pricing and coupons (`PIX20`, `FREEPIX`)
- server-created UPI QR and webhook-style payment completion
- free checkout registration
- digital share URL creation

The main-process printer adapter accepts a job and increments counters but does not yet send a bitmap
to a real DNP driver. The generic media camera provides live preview; the native Canon bridge remains
an adapter seam. These limitations are visible in telemetry and are not represented as production
hardware success.
