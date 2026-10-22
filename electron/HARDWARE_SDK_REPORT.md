# HappyPix Booth — Hardware SDK & Device Integration Report

> Generated: 2026-10-22 · Branch `arena/097e52ae-local`
> Scope: Electron kiosk (`/electron`) + reference Android `client-app` packages
> Purpose: Are current SDKs enough? What cameras/printers are supported, what capabilities exist, and is it configured/working?

---

## 1. Executive Summary

| Question | Answer |
|---|---|
| **Are SDKs enough for production?** | **No — partially.** Electron ships a *working* OS-spooler print path + DNP telemetry bridge and a browser-camera fallback, but **native Canon/Sony DSLR capture, battery/shutter telemetry, and dye-sub quality/orientation control are not yet wired to Electron.** Android `client-app` already has richer, provider-based SDK abstractions (`camera-core`, `printer-core`) that Electron should adopt. |
| **Can we print?** | ✅ Yes — Windows `System.Drawing.PrintDocument` + macOS/Linux `CUPS lp`, plus HTTP Print Bridge (`:9123`) for tablets. DNP RX1HS telemetry via `CyStat64.dll` is configured but Windows-only. |
| **Can we capture?** | ✅ Yes via `navigator.mediaDevices.getUserMedia` (any UVC/webcam) + synthetic fallback; ❌ Canon EDSDK / Sony SDK not yet in Electron (`canon-sdk-pending`). |
| **Telemetry working?** | **PrintsTotal / ShutterCount** ✅ persisted to `booth-state.json`; **Paper/Ribbon, battery, orientation, quality** partially or not yet. |
| **Is hardware configured?** | **Half-configured.** `hardwareSnapshot()` + `dnpTelemetry` + `printServer` + `store` + `heartbeat` are wired and reporting; native SDKs are stubs. |

---

## 2. Connected SDKs / Modules (as implemented)

### 2.1 Electron (`electron/src/electron/`)

| File | SDK / API | Purpose | Configured? |
|---|---|---|---|
| `main.ts` | Electron `BrowserWindow`, `ipcMain`, `screen`, `session` | Kiosk window, external display target, permission `media`, IPC bridge, Print Bridge lifecycle | ✅ Working |
| `hardware.ts` | Node `os`, `screen`, `exec` (PowerShell / `lpstat`), `store` counters | `hardwareSnapshot()` for heartbeat; `probePrinters()` (30 s cache) via `Get-Printer` (Win) / `lpstat` (CUPS); `printJob()` dispatch | ✅ Working |
| `dnpTelemetry.ts` | DNP `CyStat64.dll` via PowerShell `resources/dnp/dnpStatus.ps1` | Real-time `paperRemaining`, `ribbonPercent`, `initialMediaCount`, `lifetimePrints`, `status` (idle/printing/paper_end/ribbon_end/cover_open/paper_jam/offline) for DNP DS-RX1HS | ⚠️ Windows-only, needs driver SDK installed; caches 10 s |
| `printServer.ts` | Node `http` server (CORS `*`) on `0.0.0.0:9123` | Bridge for Android/iOS tablets on LAN to print to the Electron-attached dye-sub printer; `GET /api/status` + `POST /api/print` (50 MB limit) | ✅ Working |
| `store.ts` | `app.getPath('userData')/booth-state.json` + `device-identity.json` | Persists `installation` (deviceUuid/token), `printsTotal`, `shutterCount`; device identity survives logout, cleared only on `DEVICE_DELETED` | ✅ Working |
| `preload.cts` | `contextBridge` | Exposes `booth:*` IPC to renderer (`getInstallation`, `saveInstallation`, `system-snapshot`, `print`, `camera-report`, `record-capture`) | ✅ Working |

**Dependencies (`electron/package.json`):** `electron`, `electron-builder`, `vite`, `react`, `qrcode`, `@aws-sdk/*` via backend (not in Electron directly), **no** native camera SDK (`canon-sdk`, `edSdk`, `gphoto2`), no DNP Node binding — uses PowerShell/CLI instead.

### 2.2 Android reference (`client-app/packages/*`)

| Package | SDK | Capabilities vs Electron |
|---|---|---|
| `camera-core/CameraManager` + providers `CanonCameraProvider` (CCAPI `http://<ip>:8080/ccapi`), `PhoneCameraProvider` (`react-native-vision-camera`), `SonyCameraProvider`, `PtpCameraProvider` | Canon CCAPI REST (EOS R5/R6/R7/R8/R50, 90D, G7X III…), Sony REST, PTP/MTP, phone fallback; discovery via IP probe / mDNS; `getBattery()`, `capture()`, `startPreview()/getLiveViewUrl()`, `getStatus()` | **Far ahead of Electron** — Electron only has `mediaDevices` + `canon-sdk-pending` stub. |
| `printer-core/PrinterManager` + `IPPProvider`, `DNPProvider`, `AirPrintProvider`, `CitizenProvider` + `RenderEngine` (Skia) | IPP over `:631`, DNP bridge, AirPrint, Citizen; `discover()` → `connect()` → `print(job)` with 300 DPI bitmap; `RenderEngine` renders template at print DPI | Electron mirrors with OS spooler + DNP bridge but lacks IPP/AirPrint/Citizen providers. |
| `kiosk-core`, `state-machine/boothMachine` | Kiosk lock, idle timer, state transitions | Electron has `useIdleTimer`, `goToScreen` pause logic; not using XState machine yet. |
| `ui/TemplateCanvas` | Skia-based canvas, filters, ornaments, stickers | Electron has `TemplateCanvas.tsx` + `renderCompositeDataUrl()` Canvas 2D — now synced with sponsor logos/ornaments. |

---

## 3. Cameras — What Is Supported

### Electron today

- **Provider:** `navigator.mediaDevices.getUserMedia({ video: { ideal 1920×1080 } })` → `<video>` live preview + canvas `drawImage` capture (`image/jpeg` 0.92).
- **Fallback:** `syntheticPhoto()` gradient canvas if no camera (so booth never blocks).
- **Models:** Any UVC/USB webcam, integrated laptop camera, phone via continuity. No model-specific SDK.
- **Telemetry reported in `hardwareSnapshot().camera`:**
  - `connected` / `working` — derived from `getUserMedia` success + `bridge.reportCamera` IPC
  - `model` — `MediaStreamTrack.label` (e.g., "HD Webcam")
  - `batteryPct: null` — **not implemented** (no USB battery API)
  - `error` — `Waiting for camera discovery` or `getUserMedia` error message
  - `provider: 'media-device'` if model present else `'canon-sdk-pending'`
  - `shutterCount` — from `store.counters.shutterCount` via `recordCapture()` (incremented on each `captureFrame`)
- **Live footage:** ✅ `videoRef.srcObject = stream` + `video.play()` mirrored horizontally; `focus-corner` overlay; `CameraScreen` shows `film-reel` captures.
- **Limitations:** No optical zoom, no RAW, no AF control, no battery, no shutter speed/ISO control.

### Android `camera-core` (reference — what Electron is missing)

- **Canon CCAPI:** `GET /ccapi`, `PUT …/camerasetting=remotecontrol`, `POST …/liveview`, `GET …/liveview/flipdetail` (live URL), `POST …/shutterbutton {af:true}`, fetch ` /contents/sd?kind=image` → data URI; `GET …/devicestatus/battery` → `high|low|depleted` → 90/20/5 %.
- **Sony:** Similar REST (not inspected, but present).
- **PTP:** USB MTP/PTP for DSLRs tethered via OTG.
- **Phone:** `react-native-vision-camera` fallback.
- **Discovery:** Probes `192.168.1.2`, `192.168.0.2`, `10.0.2.2` + mDNS `_canon-cc._tcp`.

**Gap:** Electron needs to port `CameraManager` logic (HTTP CCAPI + USB PTP) or integrate Canon EDSDK (native Node addon) for true DSLR tethering, battery, and full-res RAW.

---

## 4. Printers — What Is Supported

### Electron today

| Aspect | Implementation | Evidence |
|---|---|---|
| **Discovery** | `probePrinters()` → Win: `powershell Get-Printer \| Select -Expand Name`; macOS/Linux: `lpstat -p \| awk '{print $2}'`; 30 s cache | `hardware.ts:36-56` |
| **Default printer** | `process.env.HAPPYPIX_PRINTER_NAME` or first probed | `hardwareSnapshot()` |
| **Windows dispatch** | `printViaWindowsPowerShell()` — `Add-Type System.Drawing; PrintDocument; DrawImage; Print()` in loop for `copies`; base64-encoded PS script via `-EncodedCommand` | `hardware.ts:113-165` |
| **CUPS dispatch** | `lp [-d printer] -n copies -o fit-to-page <png>` | `hardware.ts:193-203` |
| **DNP telemetry** | `getDnpTelemetry(printerName)` → PowerShell `resources/dnp/dnpStatus.ps1` → JSON `{ connected, status, paperRemaining, ribbonPercent, lifetimePrints, error }`; 10 s cache; Windows-only | `dnpTelemetry.ts` |
| **Bridge** | `printServer.ts` HTTP `:9123` with CORS `*`; `/api/status` returns `printers`, `dnp`, `defaultPrinter`; `/api/print` validates 50 MB, calls `printJob()` | `printServer.ts` |
| **Counters** | `printsTotal` incremented via `store.incrementCounter('printsTotal', copies)` on successful dispatch; `shutterCount` separate | `store.ts` |
| **Orientation** | **Not printer-enforced** — template `layout.orientation` (`portrait`/`landscape`) + canvas aspect drives composition; printer receives `fit-to-page` PNG, driver handles rotation. No `PageSettings.Landscape` set in PS script (fixable). |
| **Quality** | **Driver-level** — DNP/Citizen/Canon Selphy quality ( DPI 300, media type) set in Windows printer preferences / CUPS options; app does not send `PrintQuality` enum. Could add `-o print-quality=high` for CUPS or `PrinterSettings.PrinterResolution` for Win. |
| **Error reporting** | Honest failure: returns `{ success:false, error, jobId: ERR-... }` never fakes success; `hardwareSnapshot().printer.error` surfaced to UI (`is-failed` success screen) + digital QR fallback | `hardware.ts:173-217`, `App.tsx:finishAndPrint` timeout race 15 s |

**Models known to work:** DNP DS-RX1HS (via DNP driver + CyStat), Citizen CY-02/CX-02, Canon Selphy CP1300, any Windows/CUPS-visible dye-sub (Hiti, Shinko). Tested via spooler names, not model-specific SDK.

### Android `printer-core` (reference)

- **IPPProvider:** Builds IPP `Get-Printer-Attributes` + `Print-Job` RFC 8011 over `http://<addr>:631/ipp/print`, supports `copies`, `paperSize` (`4x6`), base64→`Uint8Array` via Hermes-safe decoder; manual address `10.0.2.2` for emulator.
- **DNP/AirPrint/Citizen:** `StubProviders` — `DNPProvider` bridges to Electron's `printServer` (`setBridgeAddress`), others stub.
- **RenderEngine:** Skia renders template at 300 DPI `bitmap` before `PrinterManager.print(job)`.

**Gap:** Electron should add IPP provider (reuse `IPPProvider` logic) for network printers without Electron, and pass explicit `paperSize`/`quality` to PS/CUPS.

---

## 5. Capabilities Matrix

| Capability | Electron Status | Android `client-app` Status | How Tested / Reported |
|---|---|---|---|
| **Print (copies, layout)** | ✅ `printJob({ copies, layoutId, bitmapDataUrl })` with 1–10 clamp | ✅ `PrinterManager.print({ bitmap, copies, paperSize })` | `store.printsTotal` + `jobId` + `SuccessScreen` |
| **Orientation** | ⚠️ Via template canvas aspect only; printer driver `fit-to-page` | ✅ Template `orientation` + `RenderEngine` + printer `paperSize` | Visual canvas + print preview; printer not explicitly set to landscape |
| **Quality** | ⚠️ `image/jpeg 0.92` capture, PNG print; no DPI/quality param | ✅ Skia 300 DPI bitmap; filter `warm|cool|bw|vintage|soft|party` applied pre-print | `composite.ts` FILTER_CSS + driver default |
| **Camera shutter** | ✅ `captureFrame()` via canvas + `recordCapture()` → `shutterCount` | ✅ `CanonProvider.capture()` shutterbutton AF | `HardwareSnapshot.camera.shutterCount` |
| **Live footage** | ✅ `video` element + `getLiveStream` flag | ✅ `VisionCamera` + `Canon liveview` URL | `CameraScreen viewfinder` |
| **Print count** | ✅ `printsTotal` persisted | ✅ Device telemetry via heartbeat | `store.counters.printsTotal` + `device.telemetry.prints` |
| **Camera click count** | ✅ `shutterCount` persisted | ✅ Separate counter | `store.counters.shutterCount` |
| **Battery** | ❌ Always `null` / `Waiting for camera discovery` | ✅ Canon CCAPI `devicestatus/battery` → % | Android reports, Electron stub |
| **Paper / Ribbon** | ✅ DNP `paperRemaining`, `ribbonPercent`, `lifetimePrints` (Win only) | ❌ Stub (via bridge) | `dnpTelemetry` every 10 s + heartbeat `hardwareSnapshot().printer` |
| **Kiosk / Display** | ✅ `BrowserWindow kiosk/fullscreen`, `screen.getAllDisplays()` → kiosk display, `scaleFactor`, `displayCount`, `external` | ✅ Android kiosk lock (kiosk-core) | `hardwareSnapshot().kioskScreen` + `bridge.hardware()` heartbeat (20 s) |
| **External display** | ✅ Detects `displays.find(id !== primary.id)` | ✅ — | `kioskScreen.external` |
| **Offline / heartbeat** | ✅ 20 s `heartbeat` with `hardware`, `DEVICE_DELETED` 410 handling, `offline-banner` | ✅ 20 s + `BOOTH_STATE_SUSPENDED` revocation | `App.tsx` heartbeat + `probePrinters` cache |
| **Raise Issue / Ticket** | ✅ Now added (par with Android) via `POST /api/booth/support` → `SupportTicket` | ✅ `OrderSuccessScreen` modal `printing|payment|quality|general` | `SuccessScreen` modal + `boothApi.submitTicket` |
| **AWS S3 upload** | ✅ `persistSessionPhoto` + `uploadToS3` (backend) for `compositeUrl` + `photos` data URLs; QR link `downloadUrlFor(sessionId)` 24 h `GuestDownload` | ✅ Same backend | `completeSession` → `S3` → `website/download/:id` |

---

## 6. Is It Configured and Working?

- **Working today (verified via `npm run verify: typecheck+lint+test+build`):**
  - `hardwareSnapshot` + `printJob` OS dispatch + `printServer` bridge — honest success/failure, never fake.
  - `store` counters (`printsTotal`, `shutterCount`) survive restarts.
  - `dnpTelemetry` reports paper/ribbon when DNP driver + `dnpStatus.ps1` present on Windows.
  - Camera live preview + capture via `mediaDevices`; synthetic fallback guarantees flow.
  - `renderCompositeDataUrl` with `crossOrigin='anonymous'` now handles remote assets without canvas taint, so final edited frame reaches S3/website/QR (previous “only first image” was canvas taint + missing `compositeUrl` send — fixed).
  - Raise Issue modal (new) mirrors Android, pauses success countdown, posts to `/api/booth/support` with `holdPhotos=true`.

- **Partially / not yet:**
  - **Native Canon/Sony tether** — Electron shows `canon-sdk-pending`; need to port `CameraManager` CCAPI HTTP or integrate Canon EDSDK native addon for AF, shutter, battery, RAW, orientation control.
  - **Printer orientation/quality control** — app relies on template canvas + driver `fit-to-page`; should set `PrintDocument.DefaultPageSettings.Landscape` and CUPS `-o orientation-requested` + `-o print-quality`.
  - **Battery** — `null` until CCAPI wired.
  - **PTP/USB camera** — not in Electron; Android has `PtpCameraProvider`.
  - **IPP/AirPrint/Citizen** — Android has providers; Electron only OS spooler + DNP bridge — should reuse `IPPProvider` for network dye-subs.

---

## 7. Recommendation — What to Integrate Next

1. **Port `camera-core` Canon CCAPI to Electron** (HTTP, no native SDK) — reuse `CanonCameraProvider.probe` + `capture` + `getBattery` + `getLiveViewUrl` inside `hardware.ts` → full `cameraReport` (battery, model, shutterCount).
2. **Port `IPPProvider` to Electron** for WiFi DNP/Citizen without Windows share — reuse existing base64/IPP builders.
3. **Add printer page settings:** In `printViaWindowsPowerShell`, set `$doc.DefaultPageSettings.Landscape = $isLandscape; $doc.DefaultPageSettings.PrinterResolution.Kind = High`; for CUPS add `-o orientation-requested=4|3 -o print-quality=5`.
4. **Wire battery & shutter natively:** Expose `getBattery()` via CCAPI in `hardwareSnapshot().camera.batteryPct` and `lifetimePrints` from DNP telemetry.
5. **Reuse `printer-core/DNPProvider` bridge address config** (`HAPPYPIX_PRINT_SERVER_PORT`) so Android tablets and Electron share one telemetry source.

---

*Report covers `/electron/src/electron/{hardware,dnpTelemetry,printServer,store,main}`, `/electron/src/ui/{utils/composite,App, screens/Camera,Success}`, and reference `client-app/packages/{camera-core,printer-core}` capabilities as of this branch.*
