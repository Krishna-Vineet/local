# HappyPix Client App - Tech Stack & Setup Guide

यह डॉक्यूमेंट HappyPix Client App (`client-app`) में इस्तेमाल होने वाली सभी languages, frameworks, libraries, modules और setup steps को आसान शब्दों में समझाता है।

---

## 1. Languages (भाषाएं)

*   **TypeScript (TypeScript 5.x)**: 
    *   **क्यों और किसलिए?** पूरे React Native और packages के JavaScript कोड को type-safe बनाने के लिए। इससे compile-time पर ही errors का पता चल जाता है और autocomplete-linting बेहतर काम करती है।
*   **Kotlin / Java**:
    *   **क्यों और किसलिए?** Android के native functions (जैसे Kiosk Mode, Lock Task System) को implement करने के लिए, जो standard React Native APIs में उपलब्ध नहीं होते।
*   **Gradle**:
    *   **क्यों और किसलिए?** Android build system को config करने और native libraries/packages को integrate करने के लिए।

---

## 2. Main Frameworks (मुख्य फ्रेमवर्क्स)

*   **React Native (v0.86.0)**:
    *   **क्यों और किसलिए?** यह core mobile application framework है। इसकी मदद से single codebase (TypeScript/React) से Android (और भविष्य में iOS) के लिए native performance वाली booth application बनाई गई है।
*   **Turborepo (turbo)**:
    *   **क्यों और किसलिए?** यह एक high-performance monorepo management tool है। यह multiple packages और apps के builds, tests और custom scripts को manage और speed up करता है।
*   **pnpm (Workspace)**:
    *   **क्यों और किसलिए?** Node modules को handle करने का तेज़ package manager। monorepo architecture में custom internal packages (जैसे UI, API, state machine) को आपस में link करने के लिए workspaces का उपयोग करता है।

---

## 3. Libraries & Dependencies (महत्वपूर्ण लाइब्रेरीज़ और उनका उपयोग)

### State & Logic Management
*   **XState (v5.14.0) & `@xstate/react`**:
    *   **क्यों और किसलिए?** HappyPix Photo Booth का flow (Photo click -> filter -> payment -> print) एक finite sequence में काम करता है। XState की मदद से Finite State Machine (FSM) बनाई गई है ताकि application logic bugs-free रहे और state flow manage करना आसान हो।

### UI, Graphics & Rendering
*   **@shopify/react-native-skia (v2.6.8)**:
    *   **क्यों और किसलिए?** High-performance 2D vector graphics और image editing/effects rendering के लिए। Skia engine फोटो के ऊपर overlays, filters, dynamic editing को smoothly rendering करने में मदद करता है।
*   **react-native-svg (v15.0.0) & react-native-qrcode-svg (v6.3.3)**:
    *   **क्यों और किसलिए?** Vector graphics को render करने के लिए और payments/image download links के लिए dynamic QR Codes screen पर generate करने के लिए।

### Device Hardware / Camera
*   **react-native-vision-camera (v4.6.4)**:
    *   **क्यों और किसलिए?** Tablet/Phone के built-in camera से frames capture करने, previews दिखाने और high-quality photos click करने के लिए सबसे robust camera library।

### Navigation
*   **@react-navigation/native (v7.0.0) & @react-navigation/native-stack**:
    *   **क्यों और किसलिए?** App में एक screen से दूसरी screen पर navigate करने (जैसे start page -> checkout page) के लिए optimized navigation container।

### Payment Gateway
*   **react-native-razorpay (v2.3.1)**:
    *   **क्यों और किसलिए?** कस्टमर से पेमेंट collect करने के लिए Razorpay checkout sdk का native integration।

### Networking & Device Discovery
*   **react-native-zeroconf (v0.13.8)**:
    *   **क्यों और किसलिए?** Local Area Network (LAN) पर IPP printers या cameras को auto-discover (बिना IP address डाले खोजना) करने के लिए Zeroconf protocol का उपयोग होता है।

### Storage
*   **@react-native-async-storage/async-storage (v2.1.0)**:
    *   **क्यों और किसलिए?** Device token, temporary offline logs, या booth configuration parameters को key-value store में device storage पर save रखने के लिए।

### Environment Config
*   **react-native-config (v1.5.3)**:
    *   **क्यों और किसलिए?** Build के समय `.env` variables (जैसे API URLs) को JS और java levels तक access देने के लिए।

---

## 4. Shared Monorepo Packages (Internal Packages)

*   `@happypix/types`: Shared TypeScript typings और interface definitions.
*   `@happypix/api`: Node and Vercel backend (`https://happypix-gzy6.vercel.app`) से बात करने के लिए API client class wrapper.
*   `@happypix/state-machine`: Booth logical states और navigation steps (photo capture flow) को control करने वाली XState machinery.
*   `@happypix/camera-core`: Phone Camera, Canon CCAPI, Sony (stub) and PTP (stub) cameras के connections को manage करने वाली layer.
*   `@happypix/printer-core`: Prints print commands manage करने के लिए IPP Protocol driver wrapper.
*   `@happypix/kiosk-core`: Custom Kotlin native application module जो Android lock mode controls enable करता है।
*   `@happypix/ui`: React Native custom buttons, layouts, themes, sliders, modals components.

---

## 5. System Requirements (ज़रूरी चीज़ें)

1.  **Node.js**: `v22.11.0` या उससे ऊपर (Recommended `v22.x LTS`).
2.  **pnpm**: Version `9.x` (Dependencies install करने के लिए pnpm का ही इस्तेमाल करें, npm/yarn नहीं).
3.  **JDK (Java Development Kit)**: JDK `17` (React Native Gradle build requirements के अनुसार).
4.  **Android Studio**: Android SDK, tools, Build-tools Installed (Target SDK `33` or higher).
5.  **ADB (Android Debug Bridge)**: CLI setup और debugging / device mode configurations के लिए path में setup होना चाहिए।

---

## 6. Project Setup & How to Run (प्रोजेक्ट कैसे चलाएं)

### Step 1: Dependencies Setup
Root directory (`client-app/`) में open terminal करें और command चलाएं:
```bash
pnpm install
```

### Step 2: Configure Environment Variables
`client-app/apps/booth/` फ़ोल्डर के अंदर `.env` फ़ाइल बनाएं:
```env
BOOTH_API_URL=https://happypix-gzy6.vercel.app
BOOTH_DEVICE_TOKEN=your_device_token_here
```

### Step 3: Copy Kiosk Native Module Files (Android only)
Kiosk mode enable करने के लिए package logic को android directory में copy करें (Windows CMD/Powershell):
```powershell
copy packages\kiosk-core\android\*.kt apps\booth\android\app\src\main\java\com\happypix\booth\kiosk\
```
*(नोट: इसके बाद `MainApplication.kt` में custom package initialize करें जैसी instruction code में दी हुई है)*

### Step 4: React Native App Run करें
अपने android device/emulator को computer से connect करें, और run करें:
*   **Root Folder (client-app/) से:**
    ```bash
    pnpm android
    ```
*   **या `apps/booth` Folder में जाकर:**
    ```bash
    cd apps/booth
    npx react-native run-android
    ```
इससे Metro Bundler backend start हो जाएगा और app Android Device / Emulator पर install और running हो जाएगी।

### Step 5: Android Full Kiosk Lock Mode Setup (Optional - Live Booth Setup के लिए)
अगर आप चाहते हैं कि customer app से बाहर न निकल पाए, तो device को lock mode में setup करें:
```bash
adb shell dpm set-device-owner com.happypix.booth/.kiosk.KioskAdminReceiver
```
