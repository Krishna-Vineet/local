# 📸 Happypix Booth App

This is the main React Native application for the **Happypix Booth**, located within the `client-app` monorepo. It is the core interface for the photo booth experience, and builds for **Android tablets and iPad**. Android is the more exercised target; the iPad target runs the full guest session but still needs kiosk lockdown, an icon set, signing and a native print path — see [`docs/IPAD_SUPPORT.md`](../../../docs/IPAD_SUPPORT.md).

## 🚀 Getting Started

### Prerequisites

- Node.js (v22+)
- pnpm (v9+)
**Android:**
- Android Studio & Android SDK (API Level 33+ / Tiramisu)
- Java JDK 17

**iPad:** (macOS only)
- Xcode 16.x (iOS 18 SDK, deployment target 15.1)
- CocoaPods via `bundle exec` (see `Gemfile`)
- Apple Developer Program for on-device signing

### Environment Setup

Create a `.env` file in the root of the `booth` app (`client-app/apps/booth/.env`) and add the necessary environment variables:

```env
BOOTH_API_URL=https://happypix-v2-backend.vercel.app
BOOTH_DEVICE_TOKEN=your_device_token_here
```

### Installation

Dependencies should be installed from the root of the `client-app` monorepo:

```bash
cd ../../
pnpm install
```

### Running the App

To start the Metro bundler and launch the app on your connected Android device or emulator:

```bash
# Start the Metro bundler
pnpm start

# In a new terminal, build and run the Android app
pnpm android
```

### Running on iPad

```bash
bundle install
bundle exec pod install --project-directory=ios
open ios/booth.xcworkspace      # then Run on an iPad simulator or device
```

## 🏗️ Architecture

The app leverages shared packages from the monorepo:
- **`@happypix/ui`**: Shared UI components.
- **`@happypix/state-machine`**: XState-based core logic.
- **`@happypix/camera-core` & `@happypix/printer-core`**: Hardware abstraction layers.

## 🔒 Kiosk Mode

**Android:** the app is intended to run in Kiosk Mode (Lock Task Mode) on production devices. Ensure the device is properly provisioned using ADB as a Device Owner if you need to test Kiosk mode locally.

**iPad:** not implemented. `KioskModule` is a no-op on iOS; use Guided Access or MDM Single App Mode. See [`docs/IPAD_SUPPORT.md`](../../../docs/IPAD_SUPPORT.md) §6.

---

*For broader monorepo documentation, refer to the [root client-app README](../../README.md).*
