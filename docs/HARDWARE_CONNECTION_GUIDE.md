# HappyPix Booth — Physical Hardware Connection & Setup Guide

> **Purpose:** practical wiring and network instructions for Android, iPad, Windows Electron, and macOS Electron booths. This describes what the current SDK/provider code can do, what still needs configuration, and what must be physically tested. A provider in source is not a certification that a camera/printer model works at an event.
>
> **Related:** [Hardware, Camera & Printing Guide](HARDWARE_PRINTING.md), [iPad Support](IPAD_SUPPORT.md), [Electron Hardware SDK Report](../electron/HARDWARE_SDK_REPORT.md), [Testing & Release Checklist](TESTING_RELEASE_CHECKLIST.md).

---

## 1. Quick recommendation

For the least fragile full-size booth rig, use a **Windows PC running the packaged Electron kiosk**, a Windows-supported printer connected to that PC, and a separate guest-facing monitor/touchscreen. Connect a Nikon camera to the PC by USB if it is supported by the Nikon Remote SDK; connect a Canon CCAPI camera to the event Wi-Fi only after testing image transfer. Android or iPad tablets can be added as companion clients on the same trusted LAN for the Windows print/camera bridge, but the tablet app's bridge address currently needs configuration outside the normal pairing screen.

| Booth host | Camera path to choose first | Printer path to choose first | Important limitation |
|---|---|---|---|
| **Android tablet** | Built-in camera; Canon CCAPI over Wi-Fi; Nikon/compatible PTP camera by USB-OTG for limited capture; or a Windows Electron Nikon bridge over LAN | Windows Electron Print Bridge over LAN; or network IPP when its address is configured | No direct USB printer provider. Network hardware is not automatically scanned across the venue LAN. |
| **iPad** | Built-in camera; Canon CCAPI over Wi-Fi if local HTTP/ATS works; or a Windows Electron Nikon bridge over LAN | Windows Electron Print Bridge over LAN; AirPrint/native iOS print dialog; or configured network IPP | No direct USB PTP camera path. AirPrint uses an iOS print interaction and is not an unattended, no-touch print path. |
| **Windows PC / Electron** | Nikon Remote SDK over USB; built-in or USB UVC webcam; Canon CCAPI network probe | Windows-installed printer driver/spooler; optional bridge for tablets | Electron's Canon path can probe/trigger the shutter, but the current Electron capture screen does not retrieve the Canon image from the camera. Do not use it as a production DSLR capture path until that is fixed and tested. |
| **Mac / Electron** | Built-in or USB UVC webcam; Canon CCAPI probe over Wi-Fi | macOS-installed printer/CUPS queue; optional bridge for tablets | Nikon Remote SDK host integration is Windows-only. Electron Canon capture has the same image-transfer limitation noted above. |

**Known integration gap:** `CameraManager.setCanonConfig`, `setNikonBridgeConfig`, `PrinterManager.setBridgeAddress`, and `setManualIPPAddress` exist in React Native packages, but the normal booth UI does not currently expose a complete hardware-address setup screen. Camera auto-probe checks only a short list of common addresses; printer discovery does not scan the whole LAN. A technician may need to inject these values through app configuration/code, or the product needs a settings UI, before using a non-default physical LAN address.

---

## 2. Camera connection options

### 2.1 Camera/platform matrix

| Camera | Android | iPad | Windows Electron | macOS Electron | What the code actually provides |
|---|---|---|---|---|---|
| Tablet's built-in camera | Yes | Yes | — | — | React Native `PhoneCameraProvider` via VisionCamera. Grant camera permission. |
| PC built-in camera or USB UVC webcam | — | — | Yes | Yes | Electron `getUserMedia`; standard OS camera permission/driver path. |
| Canon CCAPI-enabled camera | Shared React Native provider; Wi-Fi/HTTP | Shared provider; Wi-Fi/HTTP, but test iPad local-network/ATS behavior | CCAPI probe and shutter trigger | CCAPI probe and shutter trigger | RN `CanonCameraProvider` also tries to fetch the latest image from the camera card. Electron currently does not transfer that image into the booth session. |
| Nikon DSLR/mirrorless via Nikon Remote SDK | Through Windows host bridge on LAN | Through Windows host bridge on LAN; validate iPad networking | Yes, USB to Windows host | No Nikon SDK host path | Electron Nikon bridge has device enumeration, live view, capture/transfer and capability controls where supported by that body. No certified model list is in this repository. |
| Nikon or compatible USB PTP camera directly | Android only, USB-OTG | No | Not this provider | Not this provider | Android native PTP capture and latest-JPEG retrieval; no direct-PTP live view or camera-setting controls. Model/firmware compatibility varies. |
| Sony Alpha | No complete integration | No complete integration | No completed integration | No completed integration | React Native `SonyCameraProvider` is a stub awaiting Sony SDK access. Do not plan a Sony tethered rig on this provider. |

### 2.2 Canon CCAPI over event Wi-Fi

The React Native CCAPI provider documents CCAPI-enabled Canon families including EOS R bodies (the source lists R5, R6, R7, R8, R10, R50 and R100), EOS 90D, EOS 850D/Rebel T8i, PowerShot G7 X Mark III and G5 X Mark II. This is a **candidate list from the provider source, not physical certification**; confirm the exact body, firmware and CCAPI version before purchasing or deploying it.

1. Enable the camera's network/remote-control or CCAPI function using that model's Canon menu instructions.
2. Join the camera to the **same booth router/subnet** as the Android/iPad device. Prefer infrastructure/station mode so the tablet and camera can both reach the router; avoid camera AP isolation if it prevents client-to-client traffic.
3. In the router, reserve an address for the camera. CCAPI is accessed at `http://<camera-ip>:8080` by the current provider.
4. From a device on the same LAN, confirm `http://<camera-ip>:8080/ccapi` responds before opening the booth.
5. Configure the actual IP. React Native's `CameraManager.setCanonConfig(ip)` supports this at package level, but there is no general user-facing IP entry in the current pairing screen. Auto-discovery probes only a few common addresses, not every DHCP address.
6. Capture a test photo and verify the returned image is the DSLR file and that it lands in the intended frame slot.

**iPad note:** the iOS app declares local-network usage and `NSAllowsLocalNetworking`, but the CCAPI URL is plain HTTP to a raw IP address. iOS App Transport Security can still block some raw-IP HTTP requests. Test the installed iPad build on the real router; do not turn off ATS globally as a workaround.

**Electron note:** Electron reads `HAPPYPIX_CANON_IP` for the default CCAPI address and has a probe/shutter IPC path. However, its camera screen triggers the Canon shutter and then obtains the displayed frame from the webcam canvas (or may fall back to a simulator image); it does not download the captured file from the Canon card. Treat Canon on Electron as a connectivity/trigger seam, not a complete booth capture integration yet.

### 2.3 Nikon Remote SDK using a Windows host

This is the current Nikon DSLR/mirrorless path for full live view and tethered image retrieval.

1. Use a Windows PC. Install/package Nikon Remote SDK files and configuration under `electron/resources/nikon` as allowed by Nikon's license. The bridge expects `ControlServiceLayer.dll` and `NikonBridge.ps1`.
2. Connect the camera to the PC with a **data-capable USB cable**. Set the camera's USB/PC connection mode as required by its model. Close other tethering apps that may claim the device.
3. Start the packaged Electron booth. On Windows, its main process starts the Nikon adapter and the local Print Bridge on port `9123`.
4. Verify the Nikon camera appears in Electron's camera status, start live view, capture one frame, and verify the original camera JPEG reaches the session.
5. For a tablet companion, connect it to the same trusted LAN and point `NikonBridgeProvider` at the Windows PC's LAN IP, port `9123`. The provider setter is `CameraManager.setNikonBridgeConfig(host, 9123)`. The default probe tests only a handful of common IPs; it is not a subnet scanner, and no ordinary user-facing host field is present in the current pairing UI.
6. Test status, live-view start/frame/stop, capture and reconnect after unplugging/replugging USB. The tablet bridge API does not expose all Electron Nikon setting controls.

There is no repository-owned model certification table for Nikon. Use Nikon's SDK-supported body list and then validate the exact body/firmware/cable on the deployed Windows PC.

### 2.4 Android direct USB PTP

Use this only when the Android tablet is the camera host and the camera supports the PTP operations used by the native module.

1. Confirm the tablet supports USB Host/OTG. Use a data-capable USB-OTG adapter/cable; a powered OTG hub may be needed if the tablet cannot power the camera interface.
2. Connect the camera directly to the Android tablet; accept Android's USB permission prompt.
3. Set the camera USB connection mode to PTP/MTP as required by its menu and firmware.
4. Run a test connection, capture, and verify that the latest JPEG is retrieved and stored in the session.

The native module sends PTP capture operations and retrieves an object. It does **not** implement live view or settings through `PtpCameraProvider`; its preview methods are empty. The reported fallback battery value is not measured telemetry. PTP compatibility is body-specific, so do not infer that every Nikon or PTP camera will work. The Android and Windows Nikon USB paths are alternatives: a camera normally cannot be tethered to both hosts at once.

### 2.5 Built-in camera and webcam

- **Android/iPad:** grant camera permission and use the tablet's integrated camera. This is the lowest-wiring fallback.
- **Windows/macOS Electron:** connect a USB UVC webcam or use the host's built-in camera, allow OS camera access, and confirm Electron shows its live image before the event.
- **Sony:** no completed Sony SDK integration is present. A Sony body may still be used as a separate generic webcam/UVC device if the camera exposes one and the operating system recognizes it; that is not Sony Remote SDK tethering.

---

## 3. Printer connection options

HappyPix's Electron printer path uses the **operating-system queue**, not a proprietary direct camera-booth SDK for each printer model: Windows uses the Windows spooler/PowerShell route; macOS uses CUPS (`lp`/`lpstat`). There is no exhaustive certified model whitelist. DNP DS620A, DS-RX1HS and QW410 are named as bridge examples in the React Native provider; Citizen and other dye-sub models are intended to work through a compatible OS queue/bridge. Canon SELPHY or another printer can be used only if its OS driver exposes a queue and the exact print path is tested. The OS driver and media profile determine real model support, paper sizes and color behavior.

| Printer path | Android | iPad | Windows Electron | macOS Electron | Current implementation / caveat |
|---|---|---|---|---|---|
| Printer attached to Electron PC by USB | Via PC Print Bridge | Via PC Print Bridge | Yes, install Windows driver | Not applicable | Most reliable tablet arrangement. The PC owns the USB cable and OS queue. |
| Printer on Ethernet/Wi-Fi with OS driver | Via PC bridge; or direct IPP if supported/configured | Via PC bridge; or AirPrint/IPP if supported | Yes | Yes | Put printer and booth host on the same LAN; install/add the printer queue on the host. |
| Generic IPP printer over LAN | Package provider exists; set its printer IP | IPP provider exists; set its printer IP | Use OS driver/spooler | Use OS driver/CUPS | React Native provider posts IPP to `http://<printer-ip>:631/ipp/print`. It does not scan the whole subnet; manual address configuration is needed. |
| Apple AirPrint printer | No native Android AirPrint path | iOS native print module | Not relevant | Not relevant | iOS uses `UIPrintInteractionController`, which presents the iOS print UI. The current provider's discovery method returns no devices; this is not a proven unattended kiosk print flow. |
| DNP dye-sub via bridge | Yes, via PC Print Bridge | Yes, via PC Print Bridge | Yes, install vendor driver | OS queue only if a compatible macOS driver exists | Source names DS620A, DS-RX1HS and QW410 as intended bridge models. This is not a physical-compatibility guarantee or a direct DNP SDK integration. |
| Citizen direct SDK | No | No | No | No | Direct `CitizenProvider` is a stub. Use an OS-installed driver via Electron/Print Bridge, or a compatible IPP path instead. |

### Recommended tablet printing: use the Electron Print Bridge

1. Connect the printer to the Windows Electron PC by USB, or connect it to the event LAN and install its driver/queue on that PC.
2. Print a test page from Windows first. Confirm the correct photo paper size, orientation, borderless/fit behavior, color profile and cut settings in the driver.
3. Start Electron; the Print Bridge starts with the app. Default URL: `http://<windows-pc-ip>:9123`.
4. From the tablet on the same LAN, verify `http://<windows-pc-ip>:9123/api/status` returns printer status.
5. Configure the React Native DNP bridge address as `http://<windows-pc-ip>:9123` via `PrinterManager.setBridgeAddress(...)`. Current automatic probes target emulator/loopback addresses, not arbitrary physical PC addresses; the normal UI does not yet offer this setting.
6. Send one 4×6 test job, then one strip/layout job. Check that the host queue receives exactly one job and that the physical print matches the booth preview.

The bridge is an unauthenticated HTTP service with permissive CORS. Allow TCP `9123` only from the trusted booth LAN using the host firewall; never port-forward it to the Internet or expose it on a public/guest Wi-Fi network.

### Direct network printing from Android/iPad

Use only if the printer explicitly supports IPP and its printer URI/format works with this implementation. Reserve the printer's LAN IP, then configure `PrinterManager.setManualIPPAddress('<printer-ip>')`. Current discovery checks this manual address plus emulator/loopback defaults; it does not browse Bonjour/mDNS or scan the venue subnet. The iPad's direct raw-IP HTTP IPP path also needs on-device ATS testing.

For AirPrint, add the printer to the same Wi-Fi network. The native iOS print module can present Apple's print interaction once the AirPrint provider is connected, but the provider's current discovery returns no devices, so the normal booth flow may not expose it yet. The print picker is operator-mediated and may interrupt a guest-flow kiosk. For unattended production, prefer the Electron host bridge and test the full workflow.

### Printer setup on Windows/macOS Electron

- **Windows:** install the manufacturer's printer driver, connect USB or configure the printer on Ethernet/Wi-Fi, then confirm it appears under Windows Printers. Set `HAPPYPIX_PRINTER_NAME` to the exact queue name if the default queue is not the photo printer. The Electron bridge's `/api/status` exposes the OS printer list and selected queue.
- **macOS:** add the USB/network printer in System Settings → Printers & Scanners and confirm a CUPS queue appears (`lpstat -p` / `lpstat -e`). Electron calls `lp`; the queue must accept the generated image and requested options.
- Test with the manufacturer's recommended paper/film and driver profile. Queue detection means the OS knows about a queue; it does not prove paper, ribbon, color or print quality.

---

## 4. Kiosk screen / external touchscreen

### Windows or macOS Electron — recommended for a separate guest-facing screen

1. Connect a monitor/touch display to the PC using HDMI, DisplayPort or USB-C video. For a touchscreen, connect its separate USB touch cable to the same PC; the video cable alone normally carries no touch input.
2. In Windows Display Settings or macOS Displays, choose **Extend** (not duplicate) and arrange the screens. Confirm the touchscreen maps to the physical guest display in the OS.
3. Start the packaged Electron app. `main.ts` selects the non-primary display when one exists, creates the booth window there, and uses full-screen/kiosk mode for packaged builds. With one display, it uses the primary screen.
4. Test guest touches on every screen edge, then reboot the host and ensure the PC launches HappyPix on the intended display.

If the display is not detected during app startup, restart Electron after connecting it. The OS must see the monitor/touch device first. macOS touchscreen support is vendor/driver dependent; verify it before choosing a panel.

### Android/iPad tablet

The tablet's own display is the supported kiosk screen. HDMI/USB-C/Lightning video adapters or wireless screen casting may mirror the tablet, depending on device hardware, but the repository does not implement a separate interactive external-display layout for the RN booth. A touchscreen attached to an external display is not guaranteed to send touch events to the tablet. If you require a large, independently touchable guest screen, use Electron on a PC and attach the touchscreen to that PC.

For iPad unattended operation, use Guided Access or managed Single App Mode; the app's full-screen appearance by itself is not an operating-system kiosk lock.

---

## 5. Recommended full physical layout

```text
                         Internet / venue uplink
                                  │
                    ┌─────────────▼─────────────┐
                    │ Private booth router / AP │
                    │ same LAN; no client isolation
                    └───┬──────────┬─────────┬──┘
                        │          │         │
             Ethernet   │          │ Wi-Fi   │ Wi-Fi (Canon CCAPI only)
             ┌──────────▼───┐  ┌───▼────┐  ┌─▼──────────┐
             │ Windows PC  │  │ Tablet │  │ Canon body │
             │ Electron    │  │ Android│  │ CCAPI      │
             │ Print Bridge│  │ or iPad│  └────────────┘
             └──┬───────┬──┘  └────────┘
                │       │
    USB data    │       └── USB / Ethernet ── Photo printer
    ┌───────────▼──┐
    │ Nikon camera │
    │ Remote SDK   │
    └──────────────┘

    PC ── HDMI/DisplayPort/USB-C video ── Guest touchscreen
    PC ── USB touch cable ─────────────── Touch input
```

Choose one camera attachment path per camera: **Nikon → Windows PC USB (SDK)**, **Nikon → Android OTG (limited PTP)**, or **Canon → Wi-Fi CCAPI**. Do not connect the same camera's USB cable to both the Android tablet and PC. The printer can be USB-attached to the Electron PC or network-attached with a compatible host driver/IPP endpoint.

### Network plan

- Create a dedicated, password-protected booth SSID/VLAN. Do not put guests' phones on the printer/camera control network.
- Connect the Windows/Mac host by Ethernet where possible; connect the tablet and Wi-Fi camera to the booth SSID. Confirm client-to-client traffic is allowed (AP/client isolation blocks local bridges).
- Reserve DHCP addresses for the Electron host, network printer and Canon camera. Write them on the rig sheet. The current tablet app's automatic camera/printer discovery does not cover every address.
- Use a Wi-Fi band supported by every camera/printer. Some older camera radios only support 2.4 GHz; do not configure a 5-GHz-only SSID for them. A dual-band router can still serve 2.4/5 GHz clients on one LAN.
- Provide a reliable WAN uplink for booth pairing, payment-provider calls, Cloudinary uploads and guest QR/download creation. Local camera/printer traffic stays on the LAN, but do not assume payments or cloud upload continue while the Internet is down. The Electron app has a session upload queue; validate recovery and staff workflow before depending on it.
- Keep the Windows firewall enabled. Permit inbound TCP `9123` only on the Private profile and only from the booth subnet. Do not create a public/WAN port-forward. The bridge uses HTTP and currently has no application authentication.
- iPad local-network permission must be accepted. `NSAllowsLocalNetworking` is set, but test every plain-HTTP raw-IP path (Canon `8080`, bridge `9123`, IPP `631`) on the release build; iOS ATS does not guarantee an exemption for raw IP addresses.

---

## 6. Bring-up sequence for a real event

1. **Power and network:** power the router/AP and UPS, then PC, printer, cameras and tablet. Confirm all LAN devices are on the same intended private network.
2. **Printer first:** confirm the printer is online in Windows/macOS, choose the intended queue, confirm paper/media and make a test print from the OS.
3. **Camera:** connect the camera using one of §2's paths. Confirm live view and capture. For Electron Canon, do not accept the CCAPI-connected indicator as proof that the correct camera photo is saved; verify the actual captured image path.
4. **Start host:** launch packaged Electron on the Windows/macOS host. Confirm kiosk display, camera state, printer status, and the local bridge at `http://<host-ip>:9123/api/status` if tablets use it.
5. **Start tablet (if used):** open the RN booth, run hardware discovery, pair the booth, choose the event, and confirm its configured host/printer IP. If auto-discovery misses hardware, set the corresponding provider address through the application configuration/package API; there is no general hardware settings panel yet.
6. **End-to-end dry run:** capture multiple frames, confirm real image files in the correct slots, render the composite, print one paid/free test as permitted, confirm the output is not cropped, and check upload/QR/download while Internet is connected.
7. **Recovery test:** unplug/reconnect the camera and printer, restart the router once before the event, and prove the app returns to a usable state. Do not run this test for the first time during guest service.
8. **Lockdown:** enable Windows kiosk/autologin or the organization's approved kiosk policy; enable iPad Guided Access/MDM if applicable. Secure cables, provide strain relief, keep spare printer media and a known-good USB cable/OTG adapter.

### Normal session flow

```text
Booth launches → device is paired / event snapshot loaded
  → camera preview and countdown → captures → guest selects/customizes
  → composite rendered → print submitted to OS queue or Electron bridge
  → payment/session completion as configured → photos uploaded when backend is reachable
  → QR/download link shown to guest
```

Local capture, rendering and local printing use the booth/LAN path. Pairing, payment-provider calls, Cloudinary media upload and guest-link creation involve backend/Internet services. A running Print Bridge or camera connection alone does not mean the cloud or payment route is online.

---

## 7. Pre-event acceptance checklist

- [ ] Record OS/device model, app build, camera model/firmware, printer model/driver/media and router model.
- [ ] Confirm real camera capture and image transfer; reject simulator/webcam fallback when the rig is supposed to use a DSLR.
- [ ] Confirm printer queue, paper size, cut, orientation, color and copies with physical sample sheets.
- [ ] Test bridge URL and status from the actual Android/iPad—not only from the host PC.
- [ ] Verify no guest Wi-Fi client can access the Print Bridge or camera-control port.
- [ ] Confirm kiosk display/touch behavior after reboot.
- [ ] Verify backend login, payment path, photo upload, QR and guest download with Internet available.
- [ ] Record each failure and workaround in the rig's hardware verification log; do not promote source-level support to “verified” without this test.
