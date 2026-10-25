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
    ├── camera-core/     ← Camera integration (Phone, Canon CCAPI, Sony/PTP stubs)
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

## 🛠️ SDK Stubs (Hardware Integrations)

We are actively integrating with various hardware SDKs. Here is the current status:

| Integration | Status |
|-------------|--------|
| **Sony Camera Remote SDK** | Stub ready — awaiting NDA |
| **DNP Printer SDK** | Stub ready — awaiting developer license |
| **AirPrint (iOS)** | ⚠️ Stub only — `AirPrintProvider` posts a raw bitmap, which is not a valid IPP job. iPad booths print through the Electron Print Bridge on the LAN; the native `UIPrintInteractionController` bridge is the roadmap item (`docs/IPAD_SUPPORT.md` IP-8) |

---

**Built with ❤️ for Happypix.**
