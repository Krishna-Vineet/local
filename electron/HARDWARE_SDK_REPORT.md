# HappyPix Booth — Hardware SDK & Device Integration Report

> **Implementation snapshot:** 2026-11-06, commit `d0ba133` (`sdk and final testing`) on the active
> Arena branch. This report describes code present in that snapshot; it does not certify a camera or
> printer model as physically tested. Enter real-device results in the verification checklist in
> [`../docs/HARDWARE_PRINTING.md`](../docs/HARDWARE_PRINTING.md).
> **Scope:** Electron kiosk, React Native camera-core, Android native PTP, photo storage adapters.

---

## 1. Current implementation at a glance

| Area | Implemented path | Platform limits / validation |
|---|---|---|
| Nikon Remote SDK | Electron main process → `NikonAdapter` → `powershell.exe` + `resources/nikon/NikonBridge.ps1` → Nikon SDK DLLs | Windows only; camera must be attached by USB. The build packages `electron/resources` as extra resources. Physical model coverage is not claimed here. |
| Nikon over LAN | RN `NikonBridgeProvider` calls the Electron Print Bridge on port `9123` (`/api/camera/status`, `/liveview`, `/capture`) | Tablet and Windows booth PC must share a LAN. Tablet bridge API currently covers status/live-view/capture; camera setting controls are Electron IPC only. iPad HTTP/ATS behavior must be checked on-device. |
| Direct USB PTP | Android native `PtpUsbModule` enumerates a USB Host/OTG camera, sends PTP capture commands and retrieves the latest JPEG | Android only; capture path only. No direct-USB live view or setting controls are implemented. Battery value is a placeholder (85), not measured telemetry. |
| Canon CCAPI | React Native `CanonCameraProvider`; Electron `canonCcapi` is a secondary network path | Wi-Fi / HTTP; exact model and firmware validation is required. |
| Built-in / UVC | React Native phone camera; Electron `getUserMedia` | Host camera APIs; actual device availability and permissions vary by OS. |
| Sony | `SonyCameraProvider` interface | Not a completed camera SDK integration. |
| Photo storage | Cloudinary-backed adapters in backend and website-backend; local disk and data-URL fallbacks in backend upload utility | Requires Cloudinary credentials for hosted uploads. AWS-named S3 adapters remain compatibility aliases, not an active S3 transport. |

**Do not conflate code presence with device certification.** TypeScript/Kotlin implementations and protocol
handling can be present while a particular body, firmware, cable, or host still needs a physical test.
The repository snapshot does not establish a Nikon supported-model list or prove measured battery,
printer-media, or camera performance values.

---

## 2. Electron Nikon Remote SDK path

### 2.1 Source and process boundary

- `src/electron/camera/nikonAdapter.ts` starts `powershell.exe` with
  `resources/nikon/NikonBridge.ps1` as a child process. Commands and results use newline-delimited
  JSON over stdin/stdout; the SDK stays out of the renderer process.
- `resources/nikon/NikonBridge.ps1` loads `ControlServiceLayer.dll`, applies Nikon configuration files
  when present, and hosts the Remote SDK calls. `electron-builder.json` copies the `resources` folder
  into packaged applications.
- `src/electron/camera/cameraManager.ts` initializes the Nikon SDK only when
  `process.platform === 'win32'`. It then probes Canon CCAPI as a secondary network path.
- Main/renderer operations are exposed through `cameraIpc.ts` and `preload.cts` using Nikon IPC
  channels for status, device list, connection, live view, capture, camera settings and raw
  capabilities.
- `captureService.ts`, `liveViewService.ts`, `settingsService.ts`, and `transferService.ts` separate
  capture, frames, camera controls and image transfer.

### 2.2 Implemented controls (Windows Electron)

The TypeScript/PowerShell integration has code paths for device listing and connect/disconnect,
shutter capture and image transfer, live-view frames, battery capability reads, ISO, exposure mode,
shutter speed, aperture, and generic capability read/write. The adapter has request timeouts and
reconnect handling. These are implementation claims, not a guarantee that every control is supported
by every Nikon model or that all values have been physically validated.

### 2.3 Requirements and troubleshooting

1. Use a supported Windows host with PowerShell 5.1+ and a Nikon camera connected by a data-capable
   USB cable.
2. Keep the Nikon SDK files and configuration files under `electron/resources/nikon`; the bridge
   reports a startup error if `ControlServiceLayer.dll` is missing.
3. Ensure Windows, the Nikon driver/SDK, and camera firmware permit the USB connection. Close any
   other tethering application that may own the camera.
4. Check Electron logs for `[CameraManager]`, `[NikonAdapter]`, and `[CameraIPC]` messages. A bridge
   startup failure falls back to the secondary Canon probe or an unconnected state; it is not evidence
   of a connected Nikon.
5. Verify one live-view session, one captured JPEG, camera-setting read/write, reconnect after USB
   removal, and camera model/firmware before event use.

The Nikon SDK and its bundled files are vendor materials. Confirm applicable Nikon terms and
redistribution permissions before publishing or distributing installers containing them.

---

## 3. React Native camera providers

### 3.1 Android direct USB PTP

`client-app/apps/booth/android/app/src/main/java/com/happypix/booth/ptp/` contains
`PtpUsbModule.kt`, `PtpUsbPackage.kt`, and `PtpConstants.kt`. The native module:

- Uses Android `UsbManager` and requests runtime USB permission.
- Opens a PTP session and attempts Nikon `InitiateCaptureRecInMedia`, falling back to standard
  `InitiateCapture`.
- Retrieves the newest object, writes a cache JPEG, and returns its file URI and JPEG data URL.
- Reports connection/model metadata. Its current battery result is a fixed placeholder, and the
  React Native provider does not implement PTP live view or camera-settings control.

This is Android USB Host / OTG functionality; it does not apply to iPadOS. Test each camera/firmware
combination physically; PTP opcode support alone does not establish compatible capture or image
transfer.

### 3.2 Nikon Kiosk Bridge provider

`client-app/packages/camera-core/src/providers/NikonBridgeProvider.ts` connects to the Windows
Electron bridge over HTTP (default port `9123`). `CameraManager` probes bridge candidates first,
then Canon CCAPI, direct USB PTP, and the built-in tablet camera. The bridge API currently exposes
camera status, start/stop and retrieval of live-view frames, and capture. It is not a generic
network-control API for all Electron camera settings.

For physical iPad deployment, verify local-network permission, App Transport Security behavior for
the bridge URL, and the actual iPad app's configured bridge address; the source provider alone does
not prove that a particular iPad can reach an HTTP IP address.

### 3.3 Canon, phone and Sony providers

- `CanonCameraProvider` implements Canon CCAPI HTTP discovery/control in camera-core. Electron's
  `canonCcapi.ts` is a secondary Wi-Fi path. Use a camera with CCAPI enabled and verify the selected
  model and firmware; no full Canon model certification is stated here.
- `PhoneCameraProvider` uses the tablet camera. Electron uses browser media capture through
  `getUserMedia`.
- `SonyCameraProvider` is an interface/provider path, not a completed Sony Remote SDK integration.

---

## 4. Print Bridge and current printer boundary

Electron starts `printServer.ts` on `0.0.0.0:<HAPPYPIX_PRINT_SERVER_PORT>` (default `9123`). The
service exposes health/status, print dispatch, and the Nikon camera status/live-view/capture routes.
It enables permissive CORS and has no application authentication; keep it on a trusted event LAN,
never port-forward it, and apply host/network firewall controls.

Printer dispatch is OS-specific: Windows uses the Windows spooler/PowerShell path in `hardware.ts`;
macOS/Linux use CUPS commands where supported by the implementation. `dnpTelemetry.ts` has a Windows
DNP/PowerShell path and a best-effort CUPS path. Driver-reported media levels are not universally
available. An OS code path or successful test stub is not the same as a physically verified printer
model; record the printer model, driver, OS, media, result and date in the hardware verification log.

---

## 5. Cloud photo storage and delivery

The current server-side adapters are `backend/utils/cloudinary.js` and
`website-backend/src/cloudinary.js`. `backend/utils/s3.js` preserves legacy export names (for example
`uploadToS3`) but delegates those names to Cloudinary; its `s3` export is a throwing compatibility
stub. The website-backend `s3.js` also re-exports Cloudinary helpers.

- With `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` configured,
  backend uploads and signed booth uploads use Cloudinary.
- Backend upload utilities can fall back to local `uploads/` storage; if disk writing fails, a data
  URL fallback is returned. Local fallback URLs require a reachable backend URL and persistent disk.
- Cloudinary delivery URLs are returned directly; `signedPhotoUrl` does not create an expiring S3
  object URL. Guest-link expiry and access checks remain the application-level control.
- Cloudinary credentials are server secrets. Booth clients receive only the signed upload parameters
  intended for a specific upload, never the API secret.

Do not deploy with missing/placeholder Cloudinary credentials and assume uploads are durable in a
serverless filesystem. Confirm the chosen fallback and retention behavior for the target host.

---

## 6. Verification status and commands

The latest repository commit is `d0ba133` (`sdk and final testing`). Its name and code presence do
not constitute a device test record. To run the Electron verification suite in a dependency-installed
checkout:

```bash
cd electron
npm ci
npm run verify
```

`npm run verify` runs TypeScript project checks, ESLint, Vitest, Electron transpilation and the React
renderer build. Android native PTP requires a physical Android device or a correctly configured USB
PTP test rig; Electron Nikon capture requires Windows, PowerShell and an attached supported Nikon.
Neither can be established by a Linux-only static build. Record real-device results separately.
