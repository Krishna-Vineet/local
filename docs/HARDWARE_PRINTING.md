# HappyPix — Hardware, Camera & Printing Guide

> **Scope:** what cameras and printers HappyPix supports, how they are driven, what is verified
> versus merely implemented, and how to recover from failures at a live event.
> **Companion:** [`../electron/HARDWARE_SDK_REPORT.md`](../electron/HARDWARE_SDK_REPORT.md) (Windows/macOS SDK parity detail).
> **Last verified:** 2026-10-23, branch `arena/097e52ae-local`.

---

## Compatibility legend

This document separates three very different claims. Read the legend before trusting a table.

| Mark | Meaning |
|---|---|
| ✅ **Verified** | Exercised on real hardware by the HappyPix team; output checked physically (a print was produced and inspected) |
| ☑️ **OS-verified** | The code path is complete and verified against the operating system's own device stack (Windows spooler / CUPS), but the specific model has not been physically validated by us |
| ⚠️ **Implemented, unverified** | Code exists and follows the vendor protocol, but no hardware validation has been recorded |
| ✖ **Not supported** | Explicitly out of scope today |

> **Honesty rule.** No component reports success it did not achieve. If a printer does not accept a
> job, the booth says so. If a camera cannot be reached, capture does not silently fall back to a
> fake image in production builds.

---

## Table of contents

1. [Hardware architecture](#1-hardware-architecture)
2. [Cameras — supported models](#2-cameras--supported-models)
3. [Camera protocols and SDKs](#3-camera-protocols-and-sdks)
4. [Camera discovery, capture, live view, reconnect](#4-camera-discovery-capture-live-view-reconnect)
5. [Printers — supported models](#5-printers--supported-models)
6. [Printer drivers, SDKs and licences](#6-printer-drivers-sdks-and-licences)
7. [Print pipeline (how a job really flows)](#7-print-pipeline)
8. [Print sizes, layouts, DPI, margins](#8-print-sizes-layouts-dpi-margins)
9. [Branding and the 15% footer](#9-branding-and-the-15-footer)
10. [Media, ribbons and consumables](#10-media-ribbons-and-consumables)
11. [Telemetry and monitoring](#11-telemetry-and-monitoring)
12. [Print queues and job control](#12-print-queues-and-job-control)
13. [Errors, recovery and troubleshooting](#13-errors-recovery-and-troubleshooting)
14. [Rig specifications and site checklist](#14-rig-specifications-and-site-checklist)
15. [Firmware, licences and update policy](#15-firmware-licences-and-update-policy)

---

## 1. Hardware architecture

```
                    ┌─────────────────────────────────────────┐
                    │              BOOTH HOST                 │
                    │  Android tablet  ·  Windows PC  ·  Mac   │
                    └───────┬──────────────────────┬──────────┘
                            │                      │
             ┌──────────────▼─────────┐   ┌────────▼──────────────┐
             │     CAMERA SUBSYSTEM   │   │   PRINTER SUBSYSTEM   │
             ├────────────────────────┤   ├───────────────────────┤
             │ PhoneCameraProvider    │   │ Windows spooler       │
             │ CanonCameraProvider    │   │ CUPS (macOS/Linux)    │
             │   (CCAPI over Wi-Fi)   │   │ IPP :631 (Android)    │
             │ PtpCameraProvider      │   │ DNP bridge / WPS      │
             │   (Nikon, USB)         │   │ Print bridge :9123    │
             │ SonyCameraProvider     │   │   (tablet → PC)       │
             └────────────────────────┘   └───────────────────────┘
```

Design constraints that shaped this layer:

1. **A kiosk must never hang.** Every hardware call has a timeout and a visible failure state.
2. **No fake success.** Simulators exist only when no device endpoint is configured (demo mode).
3. **Print output must match the preview.** Coordinates are shared; a preview that clips is a bug.
4. **The host is replaceable.** Camera and printer choices are configuration, not code.

---

## 2. Cameras — supported models

### 2.1 Summary matrix

| Camera | Connection | Android booth | Electron (Windows) | Electron (macOS) | Status |
|---|---|---|---|---|---|
| Device / tablet camera | built-in | ✅ VisionCamera | — | — | ✅ Verified |
| USB webcam (any UVC) | USB | ⚠️ via RN UVC lib | ✅ `getUserMedia` | ✅ `getUserMedia` | ☑️ OS-verified |
| Canon EOS R50 | Wi-Fi CCAPI | ✅ | ⚠️ seam | ⚠️ seam | ⚠️ Implemented (CCAPI) |
| Canon EOS R100 | Wi-Fi CCAPI | ✅ | ⚠️ seam | ⚠️ seam | ⚠️ Implemented (CCAPI) |
| Canon EOS R10 / R7 / R8 | Wi-Fi CCAPI | ✅ | ⚠️ seam | ⚠️ seam | ⚠️ Implemented (CCAPI) |
| Canon EOS R5 / R6 / R6 II | Wi-Fi CCAPI | ✅ | ⚠️ seam | ⚠️ seam | ⚠️ Implemented (CCAPI) |
| Canon EOS 90D / 80D | Wi-Fi CCAPI | ✅ | ⚠️ seam | ⚠️ seam | ⚠️ Implemented (CCAPI) |
| Canon PowerShot G7X III | Wi-Fi CCAPI | ✅ | ⚠️ seam | ⚠️ seam | ⚠️ Implemented (CCAPI) |
| Canon EOS M50 II | Wi-Fi CCAPI | ✅ | ⚠️ seam | ⚠️ seam | ⚠️ Implemented (CCAPI) |
| Canon DSLR over USB | USB (EDSDK) | ✖ | ⚠️ not wired | ⚠️ not wired | ✖ EDSDK not bundled |
| Nikon DSLR / Z series | USB PTP | ⚠️ transport pending | ⚠️ transport pending | ⚠️ transport pending | ⚠️ Opcodes mapped |
| Sony Alpha (A7/A6xxx) | USB (Sony SDK) | ⚠️ stub | ⚠️ stub | ⚠️ stub | ⚠️ Awaiting SDK licence |
| iPhone / iPad camera | built-in | ✖ (no iOS app) | — | — | ✖ |

> **Read this carefully.** "Implemented (CCAPI)" means the code issues the correct Canon CCAPI
> requests and handles the documented responses. It does **not** mean every listed body has been
> physically validated. Verify your exact model before an event — see §2.3.

### 2.2 Why CCAPI instead of native SDKs

| Option | Verdict | Reason |
|---|---|---|
| **Canon CCAPI** (HTTP REST on the camera) | ✅ Chosen for Android | No native binary, no per-ABI builds, works over venue Wi-Fi, upgradeable without recompiling the app |
| Canon EDSDK (C++) | ✖ Not bundled | Windows/macOS only; unusable on Android; licence restricts redistribution |
| Sony Camera Remote SDK | ⚠️ Stub | NDA/licence required; interface reserved |
| Nikon SDK | ⚠️ Stub | Per-model binaries; PTP path mapped but transport not shipped |
| gPhoto2 | ✖ Not used | Linux-centric, no Android target, unstable on newer bodies |

CCAPI endpoints used:

```
GET  http://<camera-ip>:8080/ccapi/ver110/deviceinformation
GET  http://<camera-ip>:8080/ccapi/ver110/devicestatus/battery
POST http://<camera-ip>:8080/ccapi/ver110/shooting/control/shutterbutton   { "af": true }
GET  http://<camera-ip>:8080/ccapi/ver110/shooting/liveview/flipdetail
GET  http://<camera-ip>:8080/ccapi/ver110/shooting/liveview?kind=video
```

### 2.3 Verifying a camera before an event (30-minute check)

Run this once per body/lens/firmware combination:

1. Camera → **Wi-Fi settings** → connect to the booth network (not camera AP mode unless standalone).
2. Enable **Connect to smartphone/PC** and note the IP shown on the camera.
3. From the booth host: `curl http://<ip>:8080/ccapi/ver110/deviceinformation` — must return XML/JSON
   with the model name.
4. Fire a test shot from the booth app; confirm the image lands in the session and is sharp.
5. Check battery reporting and the live-view refresh rate (target ≥ 15 fps).
6. Print one sheet and compare colour/sharpness with the preview.
7. Record the result in the verification log (§2.4).

**Do not skip step 3.** A camera that responds to ping but not CCAPI will appear "connected" and
fail at capture time — the exact worst moment.

### 2.4 Verification log (fill in per rig)

| Field | Value |
|---|---|
| Body model / serial | |
| Lens | |
| Firmware version | |
| IP / connection mode | |
| CCAPI version reported | |
| Live-view fps observed | |
| Battery reporting | |
| Print colour match (ΔE or visual) | |
| Tested by / date | |
| Event used at | |

Keep this log in the handover register so a replacement body is not a surprise at 7 pm on a Saturday.

---

## 3. Camera protocols and SDKs

### 3.1 Android (`client-app/packages/camera-core`)

| Provider | Protocol | Capture | Live view | Battery | Discovery |
|---|---|---|---|---|---|
| `PhoneCameraProvider` | Camera2 / VisionCamera | ✅ | ✅ | device API | n/a |
| `CanonCameraProvider` | CCAPI HTTP | ✅ | ✅ polling | ✅ | IP probe / mDNS |
| `PtpCameraProvider` | PTP over USB | ⚠️ transport | ⚠️ | ⚠️ | USB enumeration |
| `SonyCameraProvider` | Sony SDK | ⚠️ stub | ⚠️ | ⚠️ | USB |

`CameraManager` picks a provider in priority order (configured → CCAPI → phone), exposes
`getStatus()`, `capture()` and `startPreview()/getLiveViewUrl()`, and normalises battery to
`high|low|depleted` → `90|20|5 %`.

### 3.2 Electron (`electron/src/electron/hardware.ts`)

| Path | Mechanism |
|---|---|
| Capture | `navigator.mediaDevices.getUserMedia` → `<video>` → canvas → JPEG (0.92) |
| Model | `MediaStreamTrack.label` |
| Battery | `navigator.getBattery()` where available; otherwise `null` (honest) |
| Telemetry | Renderer → `booth:camera-report` → `hardwareSnapshot().camera` |
| Counter | `booth:record-capture` → `shutterCount` persisted to disk |
| Canon seam | `provider: 'canon-sdk-pending'` — reserving the field, no fake data |

### 3.3 What is *not* implemented

| Capability | Status | Notes |
|---|---|---|
| Canon USB tether on Windows/macOS | ✖ | Requires EDSDK binaries + licence; can be added behind `hardware.ts` |
| Sony remote control | ✖ | SDK licence pending |
| Nikon USB capture | ⚠️ | PTP opcodes mapped; USB transport not shipped |
| Camera-side exposure control from UI | ✖ | Set on the body; CCAPI supports it but the UI does not expose it yet |
| Wireless tethering of RAW files | ✖ | JPEG only today |

---

## 4. Camera discovery, capture, live view, reconnect

### 4.1 Discovery order

```
1. Configured device (env / settings)           — fastest, deterministic
2. Canon CCAPI probe on the last-known IP       — 1.5 s timeout
3. mDNS/SSDP sweep on the local subnet          — Android via Zeroconf
4. Host camera via getUserMedia / VisionCamera  — always available fallback
```

A discovered device is not considered *usable* until one real capture succeeds. The UI shows
**Connected** only after that, which prevents the classic "camera is green but nothing works" state.

### 4.2 Capture sequence (per slot)

```
trigger
  → pre-flight: device ready? battery > 10 %? storage writable?
  → countdown 3 · 2 · 1 (cancellable)
  → optional flash/pre-flash
  → capture frame → validate (non-zero length, decodable)
  → store local copy → update shutter counter
  → advance slot
```

If validation fails, the frame is rejected and the guest is asked to retake — an empty or corrupt
image is never pushed into the session (it would poison the gallery and the guest download).

### 4.3 Live view

| Host | Mechanism | Target |
|---|---|---|
| Android + Canon | CCAPI `liveview` polling (JPEG frames) | ≥ 15 fps at 480×320 preview |
| Android device camera | VisionCamera preview | native |
| Electron | `<video srcObject>` | native |

Live view is a **preview only**; the captured still always comes from the full-resolution path.

### 4.4 Reconnect behaviour

| Event | Behaviour |
|---|---|
| Camera sleeps (auto power-off) | Provider retries every 3 s; UI shows "Reconnecting camera…" |
| Camera IP changes (DHCP) | Discovery re-probes the subnet; session waits at the capture screen, does not abort |
| Wi-Fi drops | Captures fall back to the host camera if enabled; otherwise the session pauses with a clear message |
| Camera removed mid-session | Already-captured slots are preserved; only the missing slot is retaken |
| Camera replaced between events | Re-run the 30-minute verification; update the log |

---

## 5. Printers — supported models

### 5.1 Dye-sublimation (the intended booth class)

| Printer | Media | Android | Windows | macOS | Status |
|---|---|---|---|---|---|
| **DNP DS-RX1HS** | 4×6, 4×8, 6×8 | ⚠️ via WPS/IPP | ✅ driver + CyStat | ☑️ CUPS | ⚠️ Driver path implemented |
| DNP DS620A | 4×6, 5×7, 6×8, 6×9 | ⚠️ via WPS/IPP | ✅ driver + CyStat | ☑️ CUPS | ⚠️ Implemented |
| DNP DS820A | 8×10, 8×12 | ⚠️ via WPS/IPP | ✅ | ☑️ CUPS | ⚠️ Implemented |
| DNP QW410 | 4×6 | ⚠️ | ✅ | ☑️ CUPS | ⚠️ Implemented |
| Citizen CY-02 / CX-02 | 4×6, 6×8 | ⚠️ | ✅ | ☑️ CUPS | ⚠️ Implemented |
| Citizen CY-01 | 4×6 | ⚠️ | ✅ | ☑️ CUPS | ⚠️ Implemented |
| HiTi P525L | 4×6 | ⚠️ | ✅ | ☑️ CUPS | ⚠️ Implemented |
| HiTi P910L | 6×8 | ⚠️ | ✅ | ☑️ CUPS | ⚠️ Implemented |
| Shinko S1245 / S6145 | 4×6, 6×8 | ⚠️ | ✅ | ☑️ CUPS | ⚠️ Implemented |
| Canon Selphy CP1300 / CP1500 | 4×6 postcard | ⚠️ | ✅ | ☑️ CUPS | ⚠️ Implemented |
| Mitsubishi CP-D70DW / CP-M15 | 4×6, 6×8 | ⚠️ | ✅ | ☑️ CUPS | ⚠️ Implemented |

**Note on macOS/Android media telemetry:** dye-sub counters (paper remaining, ribbon %) come from
vendor SDKs that exist mainly for Windows. On macOS the CUPS path usually reports `null` for media
levels — honest, not a bug. See §11.

### 5.2 Office / inkjet / laser printers

Supported through the OS driver, with caveats:

| Class | Support | Caveat |
|---|---|---|
| Any Windows driver printer | ☑️ | Print quality and speed unsuitable for high volume; margins may clip |
| Any CUPS printer | ☑️ | Same caveat; `fit-to-page` helps but cannot fix hardware margins |
| AirPrint | ☑️ on macOS | Good for emergencies |
| Network IPP | ✅ Android raw IPP | Requires the printer to accept `image/jpeg` or `image/pwg-raster` |

**Do not sell an inkjet rig as a booth solution.** Dye-sub is the product: dry prints, no smearing,
~8 s per 4×6, consistent colour.

### 5.3 Multi-printer (contingency) setups

The Electron booth can target a specific printer via `HAPPYPIX_PRINTER_NAME`. For events needing
redundancy, run two booths (two devices in the CRM) rather than two printers on one host — the OS
queue becomes ambiguous otherwise.

---

## 6. Printer drivers, SDKs and licences

### 6.1 Windows

| Item | Detail |
|---|---|
| Driver | Vendor Windows driver (DNP, Citizen, HiTi, Canon, Mitsubishi) |
| Install | Vendor installer → **Devices and Printers** → verify the exact name with `Get-Printer` |
| Telemetry SDK | DNP `CyStat64.dll` (installed with the DNP driver), called via PowerShell `resources/dnp/dnpStatus.ps1` |
| Dispatch | PowerShell + `System.Drawing.Printing.PrintDocument` (no third-party print library) |
| Licence | We **call** the vendor DLL; we do not redistribute it. Booths must have the driver installed |
| Fallback | WMI `Win32_Printer` + `Get-PrintJob` when `CyStat64.dll` is absent |

```powershell
# Confirm discovery and exact name
Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus

# Confirm queue and configuration
Get-PrintJob -PrinterName "DNP DS-RX1HS"
Get-PrintConfiguration -PrinterName "DNP DS-RX1HS"
```

### 6.2 macOS / Linux

| Item | Detail |
|---|---|
| Driver | Vendor CUPS/PPD driver (DNP ships a macOS driver; Citizen/HiTi similarly) |
| Install | System Settings → Printers & Scanners → add → select the correct PPD |
| Dispatch | `lp -d "<queue>" -n <copies> -o orientation-requested=<3\|4> -o print-quality=<3\|4\|5> -o fit-to-page "<file>"` |
| Discovery | `lpstat -e`, `lpstat -p` |
| Telemetry | `lpstat -o` (queue), `lpoptions -p` (media/orientation/quality), `lpstat -l` (marker if exposed) |
| Licence | Vendor driver licence; no SDK redistribution |

```bash
lpstat -p -d                       # printers and default
lpoptions -p "DNP_DS-RX1HS" -l     # capabilities (media, quality, orientation)
lpstat -o "DNP_DS-RX1HS"           # queue depth
```

### 6.3 Android

| Path | Detail |
|---|---|
| IPP | Raw IPP over TCP 631 (RFC 8011), no vendor SDK |
| DNP bridge | Vendor wireless print server (WPS) or a PC running the Electron print bridge on `:9123` |
| Why | DNP publishes no public Android SDK; a native Android integration is not possible without a vendor agreement |

### 6.4 What is *not* possible today

| Wish | Reality |
|---|---|
| Native Android DNP SDK | Does not exist publicly |
| macOS media counters for all drivers | CUPS does not expose them uniformly |
| Printing without any driver | Not possible on Windows/macOS; the OS queues are the contract |
| Reliable 8×12 on consumer inkjet | Hardware margin limits make edge-to-edge impossible |

---

## 7. Print pipeline

### 7.1 End-to-end

```
[1] Renderer composes the sheet
    • canvas at layout print size (e.g. 1000×1500 units → 4×6 in)
    • photos clipped with cover-fit
    • filter applied
    • ornaments + sponsor logos in the footer band
        │  composite PNG/JPEG data URL
        ▼
[2] IPC  booth:print { bitmapDataUrl, copies, layoutId, orientation, quality }
        │
        ▼
[3] MAIN PROCESS
    • resolve printer (env → first available → default)
    • clamp copies 1..10 (UI) / 1..50 (server bridge)
    • reject empty bitmap (never print a blank page "successfully")
    • write temp file
        │
        ├── Windows: PowerShell PrintDocument
        │     PrinterSettings.PrinterName
        │     DefaultPageSettings.Landscape
        │     DefaultPageSettings.PrinterResolution.Kind (High/Draft/Normal)
        │     Margins(0,0,0,0)
        │     InterpolationMode.HighQualityBicubic
        │     DrawImage(fit-to-page, centred)
        │     loop for N copies
        │
        └── macOS/Linux: lp with orientation/quality/fit-to-page
        │
        ▼
[4] RESULT
    success → printsTotal += copies, jobId returned
    failure → real error, no counter increment, UI shows "Print failed"
        │
        ▼
[5] Temp file deleted (always, in a finally block)
```

### 7.2 Why PowerShell + `System.Drawing`

* Ships with Windows — no extra runtime, no native addon to rebuild per Electron version.
* Produces a real spooler job, so the vendor driver applies colour management.
* Honors page orientation and resolution kind, which a naive `print` call does not.
* Cost: slow first invocation (~300–600 ms) and awkward escaping (we use base64
  `-EncodedCommand` to avoid quoting bugs).

### 7.3 Print timing expectations

| Stage | Typical | Notes |
|---|---|---|
| Composite render (12 MP, 6 slots) | 0.8–2.5 s | Canvas 2D on a mid-range PC |
| IPC + temp write | 50–150 ms | |
| Spooler submission | 300–800 ms first call, < 200 ms after | PowerShell startup dominates the first call |
| Physical 4×6 dye-sub | ~8 s (DNP RX1HS) | Device-dependent |
| **Guest-perceived total** | **~10–13 s** | Show a progress state; never a frozen screen |

### 7.4 Idempotency and duplicates

* One print job per successful session completion.
* A retry after a *reported failure* is allowed.
* A retry after a *reported success* is blocked for 60 s (prevents double prints from double taps).
* The LAN bridge rejects duplicate payload hashes within 30 s.

---

## 8. Print sizes, layouts, DPI, margins

### 8.1 Pixel dimensions at 300 DPI

Dye-sub printers expect 300 DPI. Compose at these sizes:

| Print size | Pixels @300 DPI | Canvas units (×250/in) |
|---|---|---|
| 2 × 6 in (strip) | 600 × 1800 | 500 × 1500 |
| 2 × 3 in (pocket) | 600 × 900 | 500 × 750 |
| 4 × 6 in | 1200 × 1800 | 1000 × 1500 |
| 4 × 8 in | 1200 × 2400 | 1000 × 2000 |
| 5 × 7 in | 1500 × 2100 | 1250 × 1750 |
| 6 × 8 in | 1800 × 2400 | 1500 × 2000 |
| 6 × 9 in | 1800 × 2700 | 1500 × 2250 |
| 8 × 10 in | 2400 × 3000 | 2000 × 2500 |
| 8 × 12 in | 2400 × 3600 | 2000 × 3000 |

The renderer works in canvas units and scales at export; this keeps one geometry definition for
preview, print and server rendering.

### 8.2 Bleed and safe area

| Zone | Rule |
|---|---|
| Bleed | 0 (dye-sub prints full-bleed on the media; no bleed trim needed) |
| Safe margin | Keep text ≥ 3 mm (≈ 35 px at 300 DPI) from any trim edge |
| Cut lines | For multi-up strips, a 2 mm gutter between cells; the physical cut is by the operator |
| Footer band | Bottom 15% reserved — never place photos there |

Consumer inkjet/laser: expect 3–5 mm unprintable margins. `fit-to-page` shrinks the composition,
which can clip the footer — check one physical print before using such a printer at an event.

### 8.3 Slot geometry

```
usable_height = canvas_height × (1 − FOOTER_RATIO)
family layout → arrange(usable_width, usable_height, slot_count)
   → list of { x, y, w, h } normalised 0..1
```

`arrange()` decides grid vs strip vs collage per family. Examples:

| Family | 3 slots | Arrangement |
|---|---|---|
| `46` | 3 | Vertical stack of 3 landscape cells |
| `46-26` | 3 | Two 2×6 strips side by side, one split |
| `810` | 3 | 1 large + 2 stacked small (hero layout) |
| `812` | 4 | 2 × 2 grid, wide cells |

Photos are **cover-fit** (scale to fill, centre-crop) — never stretched. A face is never distorted.

### 8.4 Resolution and quality settings

| Setting | Effect |
|---|---|
| `high` | Windows `PrinterResolutionKind.High`, CUPS `print-quality=5` |
| `normal` | `Normal` / `print-quality=4` |
| `draft` | `Draft` / `print-quality=3` — for proofing only |

Dye-sub drivers often ignore resolution hints (the device is fixed at 300 DPI). Setting them is
harmless and helps on inkjet fallbacks.

---

## 9. Branding and the 15% footer

```
┌──────────────────────────────────────────┐
│                                          │
│              PHOTO AREA                  │  ← 85% of canvas height
│         (slots laid out here)            │
│                                          │
├──────────────────────────────────────────┤
│  [sponsor]  [host logo]  [venue]         │  ← bottom 15%, reserved
│  tagline text                            │
└──────────────────────────────────────────┘
```

| Rule | Detail |
|---|---|
| Constant | `FOOTER_RATIO = 0.15` in the shared layout config |
| Who uses it | CRM designer (preview), Skia (Android), Canvas 2D (Electron), Sharp (server) |
| Content | Up to 15 sponsor logos, org logo, event/host tagline |
| Overlap | Photos are clipped to the 85% area; the AI designer is blocked from placing slots there |
| Contrast | A brand-approved light or dark band; text must pass 4.5:1 against the band |
| Print check | Verify the footer is not cut off on a physical print — the most common branding failure |

---

## 10. Media, ribbons and consumables

### 10.1 Typical dye-sub media

| Printer class | Media | Prints per roll | Ribbon |
|---|---|---|---|
| DNP DS-RX1HS | 4×6 | ~700 | Included in the media kit (one ribbon per roll) |
| DNP DS620A | 4×6 | ~700 | Per-roll ribbon |
| DNP DS820A | 8×10 | ~350 | Per-roll ribbon |
| Citizen CY-02 | 4×6 | ~600–700 | Per-roll |
| HiTi P525L | 4×6 | ~700 | Per-roll |
| Canon Selphy | 4×6 | ~108 (KP-108IN) | Integrated |

These are vendor figures — verify against the media box before an event and keep a spare roll.

### 10.2 Consumption planning

```
sheets_needed = expected_guests × sessions_per_guest × copies_per_session
spare_rolls   = ceil(sheets_needed × 0.15 / prints_per_roll)     ← 15% waste/retry margin
```

Worked example — 200 guests, 1.2 sessions each, 2 copies:

```
sheets = 200 × 1.2 × 2 = 480
rolls  = ceil(480 × 1.15 / 700) = 1 roll (plus one spare = 2)
```

Always carry a spare. A jammed roll with 50 guests still in line is an operational failure, not a
technical one.

### 10.3 Media handling

| Do | Don't |
|---|---|
| Store rolls flat, away from heat and direct sun | Leave in a car boot |
| Load with clean hands; avoid touching the ribbon surface | Reuse a partially used ribbon |
| Let prints cool 10 s before stacking | Stack hot prints (they stick and mottle) |
| Keep a dust cover on the printer overnight | Blow into the mechanism — dust lands on the head |

---

## 11. Telemetry and monitoring

### 11.1 Fields reported in every heartbeat

```json
{
  "printer": {
    "connected": true,
    "working": true,
    "provider": "windows-driver-spooler",
    "model": "DNP DS-RX1HS",
    "status": "idle",
    "statusCode": null,
    "paperRemaining": 412,
    "ribbonPercent": 58,
    "initialMediaCount": 700,
    "lifetimePrints": 18420,
    "printsTotal": 1840,
    "queueDepth": 0,
    "orientation": "portrait",
    "quality": "high",
    "paperSize": "4x6",
    "isDefault": true,
    "error": null
  }
}
```

### 11.2 Source of each field

| Field | Windows | macOS/Linux |
|---|---|---|
| `connected` | `Get-Printer`/`wmic` + `dnp.connected` | `lpstat -e/-p` |
| `status` | CyStat `status` → WMI `PrinterStatus` mapping | `lpstat -p` (idle/printing/enabled) |
| `paperRemaining` | CyStat only | driver-specific; often `null` |
| `ribbonPercent` | CyStat only | usually `null` |
| `initialMediaCount`, `lifetimePrints` | CyStat only | `null` |
| `printsTotal` | local counter (`booth-state.json`) | same |
| `queueDepth` | `Get-PrintJob` count | `lpstat -o | wc -l` |
| `orientation`, `quality`, `paperSize` | `Get-PrintConfiguration` + print request | `lpoptions` |

**Null means "not reported", not zero.** The CRM renders `—` for nulls and never implies a paper
level it does not know.

### 11.3 Alert thresholds (recommended)

| Condition | Severity | Action |
|---|---|---|
| `paperRemaining < 50` | Warning | Notify operator to load a new roll |
| `paperRemaining < 15` | Critical | Change media before the queue grows |
| `queueDepth > 5` | Warning | Printer may be paused or paper-jammed |
| `status ∈ {paper_end, ribbon_end}` | Critical | Stop admitting new sessions on that booth |
| `status = paper_jam` | Critical | Operator intervention required |
| `connected = false` for > 2 min | Critical | Check USB/network/power |
| No heartbeat > 6 min | Critical | Device may be off or offline |

These are implemented as CRM indicators; automated SMS/email alerting is configured per deployment
(see [`OPERATIONS.md`](OPERATIONS.md)).

---

## 12. Print queues and job control

| Topic | Behaviour |
|---|---|
| Queue ownership | Windows spooler / CUPS. HappyPix never bypasses the queue |
| Ordering | FIFO; dye-sub printers are serial devices |
| Priority | Not exposed — a booth prints one session at a time |
| Cancellation | Not exposed in the UI; cancel from the OS if a job is stuck |
| Paused queue | Detected via `queueDepth` growth; surfaced as a warning |
| Long queue | If `queueDepth > 5`, the booth shows "printer busy" and slows new sessions |
| Retries | Manual (guest retry button) after a reported failure; automatic retry is not used to avoid duplicate sheets |
| Duplicate suppression | Payload hash within 30 s on the LAN bridge |

Operating instruction for a jammed queue:

1. Do not power-cycle the printer while a job is spooling (it can print a partial sheet).
2. Clear the physical jam.
3. On Windows: open the queue, delete stuck jobs, then resume.
4. On macOS: `cancel -a <queue>` then retry from the booth.
5. Test with one sheet before resuming guest flow.

---

## 13. Errors, recovery and troubleshooting

### 13.1 Printer

| Symptom | Likely cause | Fix |
|---|---|---|
| "No printer found" | Driver not installed / queue absent | Install vendor driver; verify `Get-Printer` / `lpstat -p` |
| Job accepted, nothing prints | Wrong printer selected | Set `HAPPYPIX_PRINTER_NAME` to the exact queue name |
| Blank page printed | Empty bitmap (bug) | Fixed by validation — check the composite step; report if it recurs |
| Print offset / clipped | Wrong paper size or margins | Set the printer's default media to the layout size; verify at 300 DPI |
| Wrong orientation | `layoutId` mismatch | Confirm the layout's orientation; the booth derives it from the layout, not the guest |
| Colours too dark | Driver colour management | Use the vendor ICC profile; do not double-apply colour correction |
| Prints stick together | Stacked hot | Let them cool; use the output tray |
| `paper_end` | Roll exhausted | Load new media, clear the queue, retry |
| `ribbon_end` | Ribbon exhausted | Replace ribbon+media kit together |
| `cover_open` | Door ajar | Close fully; some models require a power cycle |
| `paper_jam` | Mis-feed / humidity | Clear path, trim the leading edge, reload |
| Queue grows, nothing moves | Printer paused or offline | Check device panel, resume the queue |
| macOS reports no paper level | CUPS limitation | Expected — expected media by print count |

### 13.2 Camera

| Symptom | Likely cause | Fix |
|---|---|---|
| "Waiting for camera discovery" | Not connected / wrong IP | Connect camera Wi-Fi; verify CCAPI with `curl` |
| Preview shows, capture is black | Body in a mode CCAPI cannot shoot | Set Manual or P; disable silent mode |
| Capture is slow (> 3 s) | Large JPEG / slow Wi-Fi | Reduce JPEG quality on the body; use 5 GHz |
| Battery drops fast | Live view + Wi-Fi | Use a dummy battery/AC adapter for events |
| Auto power-off mid-session | Camera sleep setting | Set auto power-off to "Off" |
| Live view freezes | Wi-Fi congestion | Move to a less congested channel; prefer 5 GHz |
| Frames out of order for slots | Sequential capture not awaited | Retake; report if it recurs |

### 13.3 Power and environment

| Risk | Mitigation |
|---|---|
| Venue power fluctuation | UPS for PC + printer (a mid-print power loss wastes a sheet and can jam) |
| Heat / humidity | Keep printers ventilated; dye-sub media is humidity-sensitive |
| Dust | Cover printers when idle; clean heads per vendor schedule |
| Cable trip hazard | Gaffer tape all runs; route behind the booth |
| Theft | Lock the booth frame; record serials |

### 13.4 Field diagnostic checklist (5 minutes)

1. `Get-Printer` / `lpstat -p` — is the printer present and not paused?
2. `Get-PrintJob` / `lpstat -o` — is the queue clear?
3. Physical media — roll present, ribbon present, cover closed?
4. Camera — `curl http://<ip>:8080/ccapi/ver110/deviceinformation`
5. Booth UI — device panel shows camera + printer as connected?
6. Print one test sheet from the booth's operator menu.
7. Confirm the last session appears in the CRM gallery.

---

## 14. Rig specifications and site checklist

### 14.1 Reference rigs

| Rig | Components | Best for | Notes |
|---|---|---|---|
| **Tablet rig** | Android tablet (Samsung Tab S8/S9 class), 4 GB+ RAM, Android 13+, DNP/Citizen printer over Wi-Fi/LAN, Canon CCAPI body | Weddings, parties | Cheapest; IPP printing only |
| **PC rig (recommended)** | Intel i5 11th gen+, 8 GB RAM, Windows 11 Pro, SSD, DNP DS-RX1HS/DS620A via USB, Canon CCAPI body | High-volume events | Full telemetry, fastest prints |
| **Mac rig** | Apple silicon Mac, macOS 12+, CUPS driver, DNP printer | Design-led venues | No CyStat telemetry; plan media manually |
| **Hybrid** | Tablet booth + PC print bridge on `:9123` | Multi-booth venues | One PC drives the printer for several tablets |

### 14.2 Minimum specs

| Role | Minimum | Recommended |
|---|---|---|
| CPU | 4 cores | 6+ cores, 2.5 GHz+ |
| RAM | 8 GB | 16 GB |
| Storage | 128 GB SSD | 256 GB SSD |
| Display | 1920×1080 | 1920×1080 touch or 1080×1920 portrait |
| USB | 2× USB 3.0 | Powered hub |
| Network | 5 GHz Wi-Fi or Ethernet | Ethernet where possible |
| Power | Stable mains | 1 kVA UPS |

### 14.3 Site readiness checklist

**Before the event (day before)**

- [ ] Both booths boot and complete a full test session
- [ ] Printer: new media installed, one test sheet printed and inspected
- [ ] Spare media roll on site
- [ ] Camera: charged batteries + dummy battery/AC adapter, test shot
- [ ] Templates and prices confirmed in the CRM for the correct event
- [ ] Event start/end times correct; event not paused
- [ ] Booth assigned to the event and showing **online**
- [ ] Internet available (for uploads); hotspot fallback tested
- [ ] UPS charged; cables taped
- [ ] Operator trained on pairing, retake, reprint and issue escalation

**At the event (15 minutes before)**

- [ ] Booth at the correct screen (entry form)
- [ ] One live test session end-to-end (capture → print → QR → open on a phone)
- [ ] Gallery check: the test session shows the **composite**, not a single frame
- [ ] Paper level / ribbon confirmed
- [ ] Idle timeout behaving (guest screens reset, admin screens do not)

**After the event**

- [ ] All sessions synced (no pending queue)
- [ ] Photo count reconciled with the CRM gallery
- [ ] Media remaining recorded
- [ ] Any failures logged in the handover register
- [ ] Printer cleaned and covered

---

## 15. Firmware, licences and update policy

### 15.1 Firmware

| Device | Policy |
|---|---|
| Canon bodies | Update before an event season, not the week of; re-run the 30-minute verification after any firmware change |
| DNP / Citizen / HiTi printers | Update only if a specific issue requires it; printer firmware changes have broken CUPS PPDs before |
| Android tablets | Pin the OS version per fleet; test the APK after any OS update |
| Windows PCs | Delay feature updates (defer 30 days); allow security updates |

### 15.2 Licences at a glance

| Component | Licence | Our obligation |
|---|---|---|
| Canon CCAPI | Device-embedded API | None (no redistribution) |
| Canon EDSDK | Proprietary, per-developer | Agreement required before bundling |
| Sony Camera Remote SDK | Proprietary, NDA | Agreement required |
| Nikon SDK | Proprietary | Agreement required |
| DNP `CyStat64.dll` | Ships with the driver | Do not redistribute; require driver install |
| CUPS | Apache 2.0 | Attribution |
| Electron / Chromium | MIT / BSD | Attribution in installer |
| React / Vite | MIT | Attribution |
| Inter / Nunito / Fredoka | SIL OFL 1.1 | Keep the licence text |

Full vendor list, renewal dates and contract locations:
[`../business/HANDOVER_REGISTER.xlsx`](../business/HANDOVER_REGISTER.xlsx).

### 15.3 Supported device lifecycle

| Phase | Meaning | Duration |
|---|---|---|
| **Supported** | Tested, documented, bugs fixed | Until EOL announced |
| **Maintenance** | Works, no new features | 12 months after successor ships |
| **Unsupported** | Best-effort only | After maintenance |

Announce end-of-support at least 90 days before a firmware/OS change that would break a supported
device.

---

*Next: [`TESTING_RELEASE_CHECKLIST.md`](TESTING_RELEASE_CHECKLIST.md) for the acceptance matrix, or
[`OPERATIONS.md`](OPERATIONS.md) for field support procedures.*
