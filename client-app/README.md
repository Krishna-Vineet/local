# 📸 Happypix Booth Platform (client-app)

Welcome to the **Happypix Booth** client monorepo! This is a React Native CLI monorepo designed for the Happypix production photo booth, prioritizing an Android-first experience.

---

## 🏗️ Project Structure

This monorepo uses `pnpm` workspaces and `turbo` for managing packages and applications.

```text
client-app/
├── apps/
│   └── booth/          ← React Native app (Main Android Application)
└── packages/
    ├── types/           ← Shared TypeScript interfaces and types
    ├── api/             ← Server API client for backend communication
    ├── state-machine/   ← XState-based finite state machine for booth logic
    ├── camera-core/     ← Camera integration (Phone, Canon CCAPI, Sony/PTP stubs)
    ├── printer-core/    ← Printer integration (IPP, DNP stub, AirPrint stub)
    ├── kiosk-core/      ← Android Lock Task Mode native module for kiosk mode
    └── ui/              ← Shared React Native UI components
```

## 🌐 Server Details

The app connects to the deployed backend server.
- **Production Backend API**: `https://happypixbackend.vercel.app`
- **Production Frontend**: `https://happypixfrontend.vercel.app`

## 🚀 Getting Started

Follow these steps to set up the development environment.

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v22+
- **pnpm**: v9+ (`npm install -g pnpm`)
- **Android Studio & Android SDK**: API Level 33+ (Tiramisu)
- **Java JDK**: 17

### Installation

Navigate to the `client-app` directory and install the dependencies:

```bash
pnpm install
```

### Environment Variables

Before running the application, set up the required environment variables. Create a `.env` file inside `apps/booth/`:

```env
BOOTH_API_URL=https://happypixbackend.vercel.app
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

---

## 🔒 Kiosk Mode (Android Lockdown)

The app supports a full kiosk mode using Android's Lock Task Mode. To enable this, the app must be set as the **Device Owner**.

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

---

## 🛠️ SDK Stubs (Hardware Integrations)

We are actively integrating with various hardware SDKs. Here is the current status:

| Integration | Status |
|-------------|--------|
| **Sony Camera Remote SDK** | Stub ready — awaiting NDA |
| **DNP Printer SDK** | Stub ready — awaiting developer license |
| **AirPrint (iOS)** | Stub ready — Android-first V1 priority |

---

**Built with ❤️ for Happypix.**
