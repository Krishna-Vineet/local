# HappyPix Booth (Electron)

Electron kiosk for Windows, macOS and Linux. The React renderer handles the guest flow; privileged
camera, printing, device identity and persistence live in the main process behind the preload IPC
boundary. Camera and printer capabilities are platform-specific; source presence is not physical
hardware certification.

## Current implementation

- Persistent installation/device identity, backend bootstrap and heartbeat, cached session setup,
  capture/composition, print, upload and guest-download flows.
- Host camera through Electron media APIs, with a secondary Canon CCAPI network path.
- Windows Nikon Remote SDK integration through the Electron main-process `NikonAdapter` and
  `resources/nikon/NikonBridge.ps1`; live view, capture/transfer and camera-setting IPC are provided
  by the Nikon service modules. The Nikon SDK path is Windows-only.
- Local HTTP Print Bridge on port `9123` for print status/dispatch and Nikon status/live-view/capture
  access from a tablet on the same LAN. The bridge has no application authentication; keep it on a
  trusted, firewalled LAN and do not port-forward it.
- Windows spooler printing and CUPS-based printing paths where the host OS and printer driver support
  them. Verify the exact printer and camera rig before an event.
- Cloudinary-backed photo delivery is implemented in the backend services; Electron's offline queue
  and local cache remain client-side session mechanisms.

The current implementation snapshot is commit `d0ba133` on 2026-11-06. See
[`HARDWARE_SDK_REPORT.md`](HARDWARE_SDK_REPORT.md) and [`../docs/HARDWARE_PRINTING.md`](../docs/HARDWARE_PRINTING.md)
for platform limits and test record requirements.

## Development and verification

```bash
npm ci
npm run dev                 # Vite renderer + Electron
npm run typecheck
npm run lint
npm test
npm run transpile:electron
npm run build:react
npm run verify              # all checks above in the package's configured sequence
```

The Electron `verify` script runs typecheck, lint, Vitest, Electron transpilation and renderer build.
Nikon camera tests require Windows, PowerShell and an attached compatible camera; a Linux build cannot
validate that hardware path.

## Real backend mode

Create `.env.local` inside this directory and configure the API URL:

```env
VITE_BOOTH_API_URL=https://<your-backend-host>
```

Do not use demo mode as evidence that real API, storage or payment paths are working.

## Packaging

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

`electron-builder.json` copies `resources/` into the packaged app. The Nikon PowerShell SDK is only
started on Windows. Confirm SDK distribution rights, code signing, notarization and release contents
before publishing; verify the actual installer after packaging.

## Security boundary

- `contextIsolation: true`, `nodeIntegration: false`, sandboxed renderer.
- Narrow preload IPC; renderer does not load the Nikon SDK directly.
- Runtime navigation and popup restrictions.
- The local Print Bridge uses permissive CORS and no app-level authentication. Restrict network access
  to the event LAN and never expose port `9123` to the public internet.
- Templates are bundled allow-listed components or validated design data; executable JSX is not
  downloaded from the backend.
