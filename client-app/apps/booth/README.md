# 📸 Happypix Booth App

This is the main React Native application for the **Happypix Booth**, located within the `client-app` monorepo. It is designed primarily for Android devices and acts as the core interface for the photo booth experience.

## 🚀 Getting Started

### Prerequisites

- Node.js (v22+)
- pnpm (v9+)
- Android Studio & Android SDK (API Level 33+ / Tiramisu)
- Java JDK 17

### Environment Setup

Create a `.env` file in the root of the `booth` app (`client-app/apps/booth/.env`) and add the necessary environment variables:

```env
BOOTH_API_URL=https://happypixbackend.vercel.app
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

## 🏗️ Architecture

The app leverages shared packages from the monorepo:
- **`@happypix/ui`**: Shared UI components.
- **`@happypix/state-machine`**: XState-based core logic.
- **`@happypix/camera-core` & `@happypix/printer-core`**: Hardware abstraction layers.

## 🔒 Kiosk Mode

This application is intended to run in Kiosk Mode (Lock Task Mode) on production devices. Ensure the device is properly provisioned using ADB as a Device Owner if you need to test Kiosk mode locally.

---

*For broader monorepo documentation, refer to the [root client-app README](../../README.md).*
