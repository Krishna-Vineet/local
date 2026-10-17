# Native hardware integration plan

## Priority selected

1. Windows
2. DNP printer SDK
3. Canon camera SDK
4. macOS and Linux fallback/ports

Exact printer/camera models, SDK archives, redistribution terms, and test hardware are still required.
Vendor SDKs must not be guessed or downloaded from unofficial mirrors.

## Adapter rule

UI code never imports a vendor library. Vendor code belongs in Electron's main process (or a signed
sidecar process) and implements a stable local contract:

```ts
interface CameraAdapter {
  discover(): Promise<CameraDevice[]>
  connect(id: string): Promise<void>
  startLiveView(): AsyncIterable<Frame>
  capture(destination: string): Promise<CaptureResult>
  status(): Promise<CameraStatus>
}

interface PrinterAdapter {
  discover(): Promise<PrinterDevice[]>
  connect(id: string): Promise<void>
  capabilities(): Promise<PrintCapabilities>
  print(bitmapPath: string, copies: number, media: string): Promise<PrintResult>
  status(): Promise<PrinterStatus>
}
```

IPC should return copied frame buffers or a local custom protocol URL, never native pointers.
Long-running SDK work must not block Electron's main event loop; use worker threads or a sidecar.

## Windows DNP

Remaining work after receiving the licensed SDK and target models:

- Validate x64 DLL architecture and redistribution rights.
- Add DLL loading through a small N-API module or signed sidecar.
- Discover printers by model/serial and map Windows spooler names.
- Query ready/error/media state and SDK-supported lifetime print counter.
- Convert the final composition to the exact DPI, color space, dimensions, and media cut mode.
- Submit copies idempotently and persist job IDs before dispatch.
- Distinguish connected, ready, printing, paper/ribbon depleted, recoverable error, and fatal error.
- Test unplug/replug, spooler restart, paper-out, app crash during job, and duplicate dispatch recovery.

## Windows Canon

Remaining work after receiving EDSDK and target models:

- Confirm each camera model and firmware appears in Canon's compatibility matrix.
- Load EDSDK on a dedicated worker/sidecar and implement camera discovery/session lifecycle.
- Stream live-view frames to the renderer with bounded buffering.
- Trigger capture, download full-resolution files atomically, and retain EXIF orientation.
- Query battery and shutter count only where officially supported. Report unsupported as `null`.
- Handle camera sleep, storage full, USB disconnect, capture timeout, and reconnect.

The current media-device preview is useful for generic webcams and UI development but is not a Canon
EDSDK implementation.

## macOS and Linux

DNP/Canon vendor support differs by model and SDK. Fallback candidates must be validated on hardware:

- macOS camera: vendor SDK where available, otherwise PTP/Image Capture bridge.
- Linux camera: libgphoto2/PTP for supported models.
- macOS/Linux printing: CUPS/IPP where the vendor supplies a compatible driver.

Do not claim counter or battery support until the adapter receives it from the actual device.

## External kiosk screen

Electron's `screen.getAllDisplays()` reports connected displays. Telemetry records display count,
selected kiosk display, resolution, scale factor, and whether it differs from the primary display.
This is an OS-level connectivity signal, not proof that the physical panel is showing a healthy image.
