# 📸 Happypix Booth Platform (client-app)

Welcome to the **Happypix Booth** client monorepo! This is a React Native CLI monorepo for the Happypix production photo booth.

**Targets: Android tablets and iPad (iPadOS).** Android was the first target and is the most exercised; the iOS target is committed and runs the full guest session, but kiosk lockdown, icons, signing and native printing are still being finished. Current state, findings and the remaining-task list live in [`docs/IPAD_SUPPORT.md`](../docs/IPAD_SUPPORT.md).

---

## 🏗️ Project Structure

This monorepo uses `pnpm` workspaces and `turbo` for managing packages and applications.

```text
client-app/
├── apps/
│   └── booth/          ← React Native app (Android + iPad)
└── packages/
    ├── types/           ← Shared TypeScript interfaces and types
    ├── api/             ← Server API client for backend communication
    ├── state-machine/   ← XState-based finite state machine for booth logic
    ├── camera-core/     ← Phone, Canon CCAPI, Nikon LAN bridge, Android PTP and Sony provider seam
    ├── printer-core/    ← Printer integration (IPP, DNP stub, AirPrint stub)
    ├── kiosk-core/      ← Kiosk mode: Android Lock Task Mode; iOS is a no-op today
    └── ui/              ← Shared React Native UI components
```

## 🌐 Server Details

The app connects to the deployed backend server.
- **Production Backend API**: `https://happypix-v2-backend.vercel.app`
- **Production Frontend**: `https://happypixfrontend.vercel.app`

## 🚀 Getting Started

Follow these steps to set up the development environment.

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v22+
- **pnpm**: v9+ (`npm install -g pnpm`)
**Android:**
- **Android Studio & Android SDK**: API Level 33+ (Tiramisu)
- **Java JDK**: 17

**iPad:** (macOS only — there is no Linux or Windows path to an iOS build)
- **Xcode** 16.x with the iOS 18 SDK (deployment target 15.1)
- **CocoaPods** 1.15+ via `bundle exec` (pinned in `apps/booth/Gemfile`); Ruby 3.x
- **Apple Developer Program** membership to sign and install on a physical iPad

### Installation

Navigate to the `client-app` directory and install the dependencies:

```bash
pnpm install
```

### Environment Variables

Before running the application, set up the required environment variables. Create a `.env` file inside `apps/booth/`:

```env
BOOTH_API_URL=https://happypix-v2-backend.vercel.app
BOOTH_DEVICE_TOKEN=your_device_token_here
```

### Running the App (Android)

To start the Metro bundler and run the application on an Android emulator or connected device:

```bash
# Run from the root of client-app
pnpm android

# Alternatively, navigate to the booth app directly:
cd apps/booth
pnpm start
```

### Running the App (iPad)

The root scripts only cover Android today — there are no `ios` or `build:ipa` scripts yet.

```bash
cd client-app
pnpm install
cd apps/booth
bundle install
bundle exec pod install --project-directory=ios

# then either open ios/booth.xcworkspace in Xcode and Run, or:
xcodebuild -workspace ios/booth.xcworkspace -scheme booth \
  -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)'
```

The simulator is fine for layout but cannot validate the camera framing, printing, the Local Network
prompt, Guided Access or thermal behaviour — those need a real iPad. Release signing and TestFlight
are covered in [`docs/DEPLOYMENT_RELEASE.md`](../docs/DEPLOYMENT_RELEASE.md#64-ipados).

---

## 🔒 Kiosk Mode (Android Lockdown)

**Android:** the app supports a full kiosk mode using Android's Lock Task Mode. To enable this, the app must be set as the **Device Owner**.

Connect your device via ADB and run:
```bash
adb shell dpm set-device-owner com.happypix.booth/.kiosk.KioskAdminReceiver
```

### Setting up the Kiosk Native Module

After running `pnpm install`, if you need to manually copy the native Kotlin files for the Kiosk mode into the Android project, run:

**Windows:**
```cmd
copy packages\kiosk-core\android\*.kt apps\booth\android\app\src\main\java\com\happypix\booth\kiosk\
```

*Don't forget to register `KioskPackage` in `MainApplication.kt` (refer to `KioskPackage.kt` for instructions).*

**iPad:** there is no in-app lockdown yet — `KioskModule` resolves to `null` on iOS, so
`keepScreenOn` and `startKiosk` are silent no-ops. Until a native idle-timer module lands, use
**Guided Access** (plus Auto-Lock → Never) for a single device, or **MDM Single App Mode** for a
fleet. Details and the native fix are in [`docs/IPAD_SUPPORT.md`](../docs/IPAD_SUPPORT.md) §6.

---

## Camera provider status

`@happypix/camera-core` currently discovers the Windows Electron Nikon bridge over the LAN, Canon CCAPI over Wi-Fi, direct USB PTP, then the tablet camera. Platform capabilities differ:

| Path | Android | iPad |
|---|---|---|
| Tablet camera | VisionCamera provider | VisionCamera provider; validate on device |
| Canon CCAPI | Provider implementation; verify exact body/firmware | Shared provider code; physical iPad/network validation required |
| Nikon Remote SDK | Use Nikon camera connected to a Windows Electron PC via the LAN bridge | Provider code can call the LAN bridge; validate local network permission and ATS on device |
| Direct USB PTP | Android USB Host/OTG capture and JPEG retrieval only | Not supported by this native module |

Direct USB PTP currently has no live view or settings support, and its reported battery value is a fixed placeholder. Sony remains an unintegrated provider seam. See [`docs/HARDWARE_PRINTING.md`](../docs/HARDWARE_PRINTING.md) and [`electron/HARDWARE_SDK_REPORT.md`](../electron/HARDWARE_SDK_REPORT.md).

## Printer limitations

- The iPad target does not have a completed native AirPrint implementation; use the Electron Print Bridge on the trusted LAN when printing is required. Confirm print delivery on the actual iPad/bridge rig.
- DNP telemetry and vendor printer SDK support are OS/driver-specific. Do not assume every printer model is certified by the presence of an adapter.

---

**Built with ❤️ for Happypix.**
