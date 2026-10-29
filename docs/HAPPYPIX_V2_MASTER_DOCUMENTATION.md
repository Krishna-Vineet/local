# 📸 HAPPYPIX V2 — Master Technical Architecture & Developer Handbook

---

## 📑 Table of Contents
1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
2. [Sub-Project Tech Stack Breakdown](#2-sub-project-tech-stack-breakdown)
   - 2.1 [CRM Dashboard (`/crm`)](#21-crm-dashboard-crm)
   - 2.2 [Main Backend API (`/backend`)](#22-main-backend-api-backend)
   - 2.3 [Client Apps (`/client-app` & `/electron`)](#23-client-apps-client-app--electron)
   - 2.4 [Public Display Website (`/website`)](#24-public-display-website-website)
   - 2.5 [Website Backend Microservice (`/website-backend`)](#25-website-backend-microservice-website-backend)
3. [Database Architecture & Collections Deep-Dive](#3-database-architecture--collections-deep-dive)
4. [End-to-End System Working Flow](#4-end-to-end-system-working-flow)
5. [CRM Template Engine & Layout Inheritance](#5-crm-template-engine--layout-inheritance)
   - 5.1 [16 Layout Families & Coordinate Standards](#51-16-layout-families--coordinate-standards)
   - 5.2 [The 15% Branding Footer Golden Rule](#52-the-15-branding-footer-golden-rule)
   - 5.3 [Owner to Organization to Booth Inheritance](#53-owner-to-organization-to-booth-inheritance)
6. [AI Template Generation Engine & Flow](#6-ai-template-generation-engine--flow)
   - 6.1 [AI Tech Stack (Groq + Together AI FLUX)](#61-ai-tech-stack-groq--together-ai-flux)
   - 6.2 [Step-by-Step AI Execution Pipeline](#62-step-by-step-ai-execution-pipeline)
   - 6.3 [Copyright Sanitization & Asset Handling](#63-copyright-sanitization--asset-handling)
7. [CRM to Client App (Booth) Template Sync Mechanism](#7-crm-to-client-app-booth-template-sync-mechanism)
8. [Hardware & SDK Implementation (Camera, Printer, Kiosk)](#8-hardware--sdk-implementation-camera-printer-kiosk)
   - 8.1 [Camera Subsystem (Phone, Canon CCAPI, Nikon PTP, Sony)](#81-camera-subsystem-phone-canon-ccapi-nikon-ptp-sony)
   - 8.2 [Printer Subsystem (Windows Spooler, CUPS, IPP, DNP)](#82-printer-subsystem-windows-spooler-cups-ipp-dnp)
   - 8.3 [Android Kiosk Mode & Device Owner](#83-android-kiosk-mode--device-owner)
9. [Developer Core Knowledge & Ground Rules](#9-developer-core-knowledge--ground-rules)
10. [Live Production Deployment & Infrastructure Checklist](#10-live-production-deployment--infrastructure-checklist)
    - 10.1 [Environment Variables Reference](#101-environment-variables-reference)
    - 10.2 [AWS S3 & Cloud Infrastructure](#102-aws-s3--cloud-infrastructure)
    - 10.3 [Hardware Rig Requirements](#103-hardware-rig-requirements)
11. [Developer Viva & Technical Interview (Q&A)](#11-developer-viva--technical-interview-qa)
    - 11.1 [Technical & Architectural Questions](#111-technical--architectural-questions)
    - 11.2 [Practical, Hardware & Offline Edge Cases](#112-practical-hardware--offline-edge-cases)
    - 11.3 [Business Logic, Rules & Security Strictness](#113-business-logic-rules--security-strictness)

---

## 1. Executive Summary & System Architecture

HappyPix V2 ek enterprise-grade multi-tenant photobooth platform hai jo physical hardware (DSLR cameras, dye-sublimation photo printers, tablet kiosks, PC kiosks) ko modern cloud services (AI template generation, real-time telemetry, expiring guest digital delivery, dynamic pricing engine) ke sath integrate karta hai.

```
                            ┌────────────────────────────────────────┐
                            │          HAPPYPIX V2 ECOSYSTEM         │
                            └───────────────────┬────────────────────┘
                                                │
         ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
         ▼                  ▼                   ▼                   ▼                  ▼
   [ 1. CRM ]      [ 2. MAIN BACKEND ]   [ 3. CLIENT APPS ]   [ 4. WEBSITE ]   [ 5. WEB BACKEND ]
  React 18 + Vite     Express 5 (ESM)    • React Native (RN)   React 18 + Vite   Express 5 (ESM)
  Zero external UI    MongoDB/Mongoose   • Electron Kiosk      Framer Motion     Mongoose + S3
  Hand-rolled SVG     Sharp, S3, Groq    XState FSM, Skia      QR Code, Router   Razorpay Checkout
```

---

## 2. Sub-Project Tech Stack Breakdown

### 2.1 CRM Dashboard (`/crm`)
* **Purpose**: Platform Owner, Platform Admins, Support Managers aur Photobooth Rental Organizations ke liye master role-aware SaaS portal.
* **Core Framework**: **React 18.3.1**, **Vite 5.4.11**, Native ES Modules.
* **Design System & Aesthetics**: **Zero External UI Dependencies**. Koi Tailwind, Bootstrap ya Material UI nahi hai. Sabhi charts (bar, line, radial), icons, dynamic template frame cards aur interactive previews hand-rolled CSS aur pure SVG se banaye gaye hain. Iska fayda: zero bundle bloat aur instant rendering.
* **State & Navigation**: React Context API (`AppContext`), Lightweight Custom Push/Hash Router (`router.jsx`).
* **API Bridge Layer**: `src/api/client.js` jo context-aware switch karta hai:
  * In-Browser Local Mock Server (`src/api/mock/server.js` + `localStorage`) agar `VITE_API_URL` set na ho.
  * Real Production REST Backend calls (`fetch` with JWT Bearer token).

### 2.2 Main Backend API (`/backend`)
* **Purpose**: Platform ka primary REST API engine jo CRM, Booth Kiosks, aur Payment Webhooks ko serve karta hai.
* **Core Framework**: **Node.js (v20+ / v22+)**, **Express v5.2.1** (Modern Native ES Modules: `"type": "module"`).
* **Database Driver**: **Mongoose v9.4.1** / MongoDB Driver v7.7.0.
* **Object Storage**: **AWS SDK v3** (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/lib-storage`).
* **Image Processing Engine**: **Sharp v0.35.3** (High-performance multi-layer compositing, PNG rendering, image format conversion, watermark embedding).
* **AI & LLM Services**:
  * **Groq SDK / REST**: Model `openai/gpt-oss-120b` (Prompt classification & Template Design JSON spec generation).
  * **Together AI REST**: Model `black-forest-labs/FLUX.2-pro` / `schnell` (High-res background generation).
  * **xAI SDK**: Grok vision/generation fallback.
* **Payment Gateways**: **Cashfree PG SDK v6.0.6**, **Razorpay v2.9.6**.
* **Communications**: SendGrid (`@sendgrid/mail`), Twilio SMS (`twilio`).
* **Security & Auth**: `jsonwebtoken` (JWT), `bcryptjs`, `cookie-parser`, `express-rate-limit`, `cors`.

### 2.3 Client Apps (`/client-app` & `/electron`)

#### A. Mobile/Tablet Kiosk (`/client-app` - pnpm + Turborepo Monorepo)
* **Target OS**: Android (API Level 33+ / Android 13 Tiramisu), Java JDK 17.
* **Core Framework**: **React Native 0.86.0**, **TypeScript 5.x**.
* **State Machine**: **XState v5.14.0** & `@xstate/react` (Finite State Machine jo booth ke lifecycle ko handle karti hai: Start ➔ Layout Select ➔ Pricing ➔ Payment ➔ Camera ➔ Composite ➔ Print).
* **Vector & 2D Graphics**: **@shopify/react-native-skia v2.6.8** (Hardware-accelerated 2D graphics, live frame cutouts, and image filters).
* **Camera Driver**: **react-native-vision-camera v4.6.4** (In-built tablet camera) + **Canon CCAPI** (Wi-Fi REST).
* **Printer Discovery & Driver**: **react-native-zeroconf** (mDNS discovery) + **IPP driver** (Raw IPP packets over port 631).
* **Kiosk Control**: Custom **Kotlin Native Module** (`@happypix/kiosk-core`) with Android Lock Task Mode (`DeviceAdminReceiver`).

#### B. Desktop PC Kiosk (`/electron`)
* **Target OS**: Windows 10/11 Pro (Primary for DNP photo printers), macOS, Linux.
* **Core Framework**: **Electron v44.4.3**, **React 19**, **Vite v7**, **TypeScript 5.9**.
* **Security Architecture**: `contextIsolation: true`, `nodeIntegration: false`, preload script (`preload.cts`) IPC bridge.
* **Printing Pipeline**: Native Windows Silent Printing via PowerShell `.NET System.Drawing.Printing.PrintDocument` (for DNP, Citizen, Canon SELPHY drivers), macOS/Linux via CUPS `lp`.

### 2.4 Public Display Website (`/website`)
* **Purpose**: Public-facing marketing website, subscription plan checkout, and **24-hour guest digital photo download portal**.
* **Core Framework**: **React 18.3.1**, **Vite 5.4.11**, **React Router DOM v6.28.0**.
* **Animations**: **Framer Motion v11.11.17** (Smooth micro-animations and page transitions).
* **QR Generator**: `qrcode` (Dynamic sharing links).

### 2.5 Website Backend Microservice (`/website-backend`)
* **Purpose**: Dedicated public backend for marketing site and guest digital downloads.
* **Core Framework**: **Express v5.2.1**, **Node.js**.
* **Database**: **Shared MongoDB** (Main backend ke sath same Database share karta hai: `subscriptions`, `plans`, `guestdownloads`, `organizations`).
* **Storage & Checkout**: `@aws-sdk/s3-request-presigner` (Guest photo temporary secure download links generate karne ke liye), `razorpay` (Customer subscription purchase verification).

---

## 3. Database Architecture & Collections Deep-Dive

HappyPix MongoDB use karta hai. Relational-style integrity (multi-tenancy) application layer aur Mongoose schemas ke through enforce ki gayi hai.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          MONGODB COLLECTIONS                           │
├─────────────────────────┬─────────────────────────┬────────────────────┤
│ PLATFORM & TENANCY      │ EVENT & HARDWARE        │ ASSETS & SESSIONS  │
├─────────────────────────┼─────────────────────────┼────────────────────┤
│ • users                 │ • events                │ • templates        │
│ • organizations         │ • devices               │ • orgaitemplates   │
│ • organizationdefaults  │ • payments              │ • photos           │
│ • subscriptionplans     │ • coupons               │ • guestdownloads   │
│ • subscriptions         │ • supporttickets        │ • auditlogs        │
└─────────────────────────┴─────────────────────────┴────────────────────┘
```

| Collection Name | Purpose & Kis Kaam Aata Hai | Key Fields |
|---|---|---|
| `users` | Sabhi platform aur org accounts (Owner, Platform Admin, Support, Org Admin, Org Manager). | `email`, `passwordHash`, `role`, `organizationId`, `status` (`active`/`suspended`) |
| `organizations` | Tenant accounts (Photo booth rental businesses). Platform status aur limits track karta hai. | `name`, `subdomain`, `planStatus`, `planId`, `logoUrl`, `brandTagline`, `isBanned` |
| `organizationdefaults` | Org ka master pricing baseline, UPI id, default logos, booth idle timeout (seconds). | `organizationId`, `idleTimeoutSeconds`, `layoutPrices` (Map of prices per layout), `upiId` |
| `subscriptionplans` | Platform owner dwara banaye gaye plans (Starter, Pro, Enterprise). | `name`, `maxActiveParallelEvents`, `maxDevices`, `priceMonthly`, `features` |
| `subscriptions` | Active subscription details, expiry date, Razorpay payment ID. | `organizationId`, `planId`, `startDate`, `expiresAt`, `status` |
| `events` | Har ek wedding/party/corporate event. Booth is event se bind hota hai. | `organizationId`, `name`, `eventCode`, `startDate`, `endDate`, `layoutPrices` (Overrides), `branding` |
| `devices` | Booth hardware record (Tablet ya PC). Booth ka heartbeat aur telemetry store karta hai. | `installationUuid`, `pairingCode`, `token`, `activeEventId`, `hardwareStatus` (camera, printer) |
| `templates` | Global master templates (Platform owner dwara published). | `layoutId` (e.g. `46-v3`), `componentId`, `design` (JSON), `source` (`designer`/`playground`/`ai_generated`), `active` |
| `orgaitemplates` | Kisi specific Organization dwara AI se create ki gayi private templates. | `organizationId`, `layout` (code, width, height, slots), `design`, `assets` (S3 URLs), `prompt` |
| `photos` | Har session me li gayi individual photos aur final merged composite photo. | `organizationId`, `eventId`, `deviceId`, `sessionId`, `url`, `compositeUrl`, `guestConsent` |
| `guestdownloads` | 24-Hour expiring digital download copy jo guest phone se scan karke download karta hai. | `downloadId` (144-bit base64url), `compositeUrl`, `photoUrls`, `expiresAt` (Session + 24 hrs), `sessionId` |
| `payments` | Booth par guest dwara print ke liye ki gayi UPI/Card transactions. | `sessionId`, `amount`, `currency`, `provider` (Cashfree/Razorpay), `status`, `referenceId` |
| `coupons` | Organization dwara banaye gaye discount codes jo booth screen par enter kiye ja sakte hain. | `organizationId`, `code`, `discountType`, `discountValue`, `validUntil`, `usedCount`, `maxUses` |
| `auditlogs` | Immutable security log. Har mutating action (ban, price change, delete) log hota hai. | `organizationId`, `actorId`, `actorName`, `action`, `entity`, `summary`, `ip` |

---

## 4. End-to-End System Working Flow

```
1. SETUP (CRM)
Owner/Org Admin ──> Creates Event ──> Overrides Prices ──> Assigns Templates & Logos
                                                                   │
                                                                   ▼
2. PAIRING & SYNC                                          [ Backend API ]
Booth App Power Up ──> Enter 6-digit Code ──> Issues Token ──> /booths/snapshot
                                                                   │
                                                                   ▼
3. GUEST SESSION (Offline Kiosk)
Touch Screen ──> Choose Orientation & Layout ──> Enter Coupon / UPI Pay ──> Shutter Countdown
                                                                   │
                                                                   ▼
4. PHOTO PROCESSING
VisionCamera / Canon CCAPI ──> Skia / Sharp Composite Engine ──> Prints to DNP/System Spooler
                                                                   │
                                                                   ▼
5. DIGITAL DELIVERY & CLOUD SYNC
Uploads Photos & Composite to S3 ──> Creates GuestDownload (24h TTL) ──> QR Code on Screen
                                                                   │
                                                                   ▼
6. GUEST ACCESS
Guest Scans QR ──> Website /download/:id ──> Direct High-Res Download (Auto-expires in 24h)
```

1. **Event Creation (CRM)**:
   * Org Admin CRM login karta hai aur naya Event banata hai.
   * Event create karte waqt pricing baseline automatically `OrganizationDefaults` se copy ho kar event ke snapshot me lock ho jaati hai (taaki baad me defaults change hone par ongoing event disturb na ho).
   * Event ko ek 6-digit unique Pairing Code milta hai.
2. **Device Bootstrap & Pairing (Booth)**:
   * Booth App start hoti hai. Pehli baar start hone par unique `installationUuid` generate karke secure storage me save karti hai.
   * Screen par pairing code enter kiya jata hai. Backend validation ke baad device ko `BOOTH_DEVICE_TOKEN` milta hai.
3. **Snapshot Download (Offline Capability)**:
   * Booth `/api/booths/snapshot` call karke event ki complete state download kar leta hai: allowed templates, layout coordinate geometry, prices, branding logos, timeout seconds.
   * Har 2 minute me booth ek **Heartbeat** bhejta hai with telemetry (Camera connected? Printer connected? Shutter count, paper status).
   * Snapshot me ek `revision` hash hota hai. Jab tak revision change na ho, booth backend se dobara template data nahi mangta.
4. **Guest Photo Session**:
   * Guest screen touch karta hai ➔ Orientation (Vertical/Horizontal) select karta hai ➔ Template chunta hai ➔ Print copies choose karta hai.
   * Agar print paid hai, toh dynamic Razorpay/Cashfree UPI QR code generate hota hai. Payment confirm hote hi camera start hota hai.
   * Camera countdown chalta hai (3..2..1.. Snap). Frame slots ke hisab se photos capture hoti hain.
5. **Compositing & Printing**:
   * Skia engine (Mobile) ya Sharp engine (Backend/Electron) photos ko exact print resolution (300 DPI) par template ke slots me clip karta hai.
   * Bottom 15% me branding logos aur tagline overlay hoti hai.
   * File Windows Spooler / IPP Printer ko dispatch hoti hai.
6. **Digital Delivery (24-Hour TTL)**:
   * Session complete hote hi background worker S3 par final composite aur individual photos upload karta hai.
   * `GuestDownload` collection me naya record banta hai with `expiresAt = Date.now() + 24 Hours`.
   * Booth success screen par ek QR code display hota hai: `https://happypix.in/download/<downloadId>`.
   * Guest apne mobile se scan karke high-res image download karta hai bina kisi login ke.

---

## 5. CRM Template Engine & Layout Inheritance

### 5.1 16 Layout Families & Coordinate Standards
Layout coordinate calculations `crm/src/lib/layouts.js` aur `backend/config/layouts.js` me standardized hain:
* **Base Unit**: `UNIT = 250` (Canvas units = Inches × 250 preview scale; 4x6 inch = 1000 × 1500 px).
* **Catalogue**:
  1. `46` (Standard 4x6 Postcard)
  2. `46-26` (Classic Duo Strip - 2x6 strips two-up on 4x6 sheet)
  3. `46-23` (Pocket Polaroid - 2x3 cutout)
  4. `57` (5x7 Framable Portrait), `57-257` (Bookmark Strip)
  5. `68` (6x8 Gala Display), `68-26` (Triple Gala Strip), `68-46` (Double Postcard)
  6. `810` (8x10 Grand Guestbook Print), `810-210`, `810-410`, `810-258`
  7. `812` (8x12 Poster Showcase), `812-412`, `812-68`

### 5.2 The 15% Branding Footer Golden Rule
```javascript
export const FOOTER_RATIO = 0.15; // Bottom 15% strictly reserved
```
Har template ke canvas ka **bottom 15% area strictly reserved** hota hai:
* Is area me photos kabhi place nahi hoti.
* Yahan event sponsors, host logo, venue logo aur tagline automatically place hote hain.
* Remaining 85% area me layout slot algorithm (`arrange(w, h, slots)`) slots ko calculate karta hai.

### 5.3 Owner to Organization to Booth Inheritance
```
┌──────────────────────────────────────────────────────────────────┐
│ PLATFORM TEMPLATE LIBRARY (Platform Owner / Platform Admin)      │
│ • Creates global template with layoutId (e.g. "46-v3")           │
│ • Defines Design JSON (Background, Ornaments, Font, Palette)     │
│ • active: true / false (Publish Gate)                            │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼ Available to all active tenants
┌──────────────────────────────────────────────────────────────────┐
│ ORGANIZATION LEVEL (Org Admin)                                   │
│ • Baseline pricing defined in OrganizationDefaults               │
│ • Org can select active global templates for events              │
│ • Org can create private custom templates via AI (OrgAiTemplate) │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼ Frozen at event launch
┌──────────────────────────────────────────────────────────────────┐
│ EVENT LEVEL (Booth Instance)                                     │
│ • Event snapshot stores effective layoutPrices + allowed templates│
│ • Booth downloads pre-computed coordinates (x, y, w, h)          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. AI Template Generation Engine & Flow

AI Template feature pure code-level modular design par bana hai (`backend/services/ai/`):

```
                                  USER PROMPT 
                      ("Superhero Comic style with 3 photos")
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │    1. PromptClassifier.js     │
                       │    Groq: openai/gpt-oss-120b  │
                       └───────────────┬───────────────┘
                                       │
                    Categorizes intent: THEME_CHANGE,
                    COLOR_CHANGE, BACKGROUND_CHANGE, etc.
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │ 2. TemplateGenerationService  │
                       │ Generates Design Spec JSON    │
                       │ (Sanitizes Marvel/Disney IP)  │
                       └───────────────┬───────────────┘
                                       │
                         Generates asset prompt for FLUX
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │  3. TogetherImageProvider     │
                       │  FLUX.2-pro (Together AI)     │
                       └───────────────┬───────────────┘
                                       │
                        Outputs 1024x1024 Base64 Image
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │ 4. Preview in CRM (IndexedDB) │
                       │ On Save ──> Uploaded to S3    │
                       │ Saved to `orgaitemplates`     │
                       └───────────────────────────────┘
```

### 6.1 AI Tech Stack (Groq + Together AI FLUX)
1. **Groq API (`openai/gpt-oss-120b`)**: Intent classification aur Design JSON spec generation. Temperature = 0 for deterministic structural JSON.
2. **Together AI API (`black-forest-labs/FLUX.2-pro` / `schnell`)**: 1024x1024 image diffusion model for high-res backgrounds.
3. **xAI API (`grok`)**: Vision / generation fallback.
4. **AWS S3**: Permanent asset storage upon save.

### 6.2 Step-by-Step AI Execution Pipeline
1. **Prompt Classification (`PromptClassifier.js`)**:
   * Prompt ko classify karta hai: `THEME_CHANGE`, `COLOR_CHANGE`, `BACKGROUND_CHANGE`, `FRAME_CHANGE`, `STYLE_REFINEMENT`, `DECORATION_CHANGE`, ya `LAYOUT_CHANGE`.
   * **Rule**: Layout geometry immutable hai. Agar user bolta hai *"make photo 1 bigger"*, toh system `LAYOUT_CHANGE` error throw karta hai: *"Layout geometry immutable hai, kripya layout editor use karein."*
2. **Design Spec Generation (`TemplateGenerationService.js`)**:
   * Groq LLM strict JSON schema return karta hai (palette, background type, photoTreatment borders, typography, asset prompts).
3. **Copyright Sanitization Rule**:
   * FLUX trademarked IPs (Marvel, Disney, Star Wars) ko reject karta hai. Prompt classifier prompts ko auto-sanitize karta hai (e.g. *"Iron Man"* ➔ *"comic book superhero style with red and gold metallic elements"*).
4. **Base64 Preview & S3 Persistence**:
   * Generation ke baad base64 data-URL CRM ko preview ke liye di jaati hai.
   * User jab **"Save Template"** click karta hai, tabhi file S3 par upload hoti hai aur MongoDB `orgaitemplates` me save hoti hai.

---

## 7. CRM to Client App (Booth) Template Sync Mechanism

```
[ CRM Dashboard ]
  Org Admin adds Template to Event
         │
         ▼
[ MongoDB: Event.templates ]
         │
         ▼
[ Backend: boothSnapshotService.js ]
  • Normalizes template slots into exact canvas pixels
  • Reads local assets / S3 URLs
  • Computes MD5 Hash ──> snapshot.revision (e.g. "rev_a8f3b2...")
         │
         ▼ HTTP GET /api/booths/snapshot (Bearer Token)
[ Client App (Booth) ]
  • Stores full JSON in Local Storage / Disk Cache
  • Downloads and caches background images offline
         │
         ▼ Every 2 Minutes
[ Heartbeat: POST /api/booths/heartbeat ]
  • Sends: { currentRevision: "rev_a8f3b2..." }
  • Backend replies: { upToDate: true } ➔ NO NETWORK USAGE
  • If CRM changed: { upToDate: false, newRevision: "rev_c91d..." } ➔ Triggers re-fetch
```

* **Snapshot Builder**: `backend/services/boothSnapshotService.js` template ke relative coordinates (0..1) ko device canvas ke absolute pixel units me convert karta hai.
* **Content Revision**: Pure snapshot ka MD5 crypto hash banta hai (`snapshot.revision`).
* **Heartbeat Contract**: Booth har 2 minute me heartbeat bhejta hai. Jab tak revision change na ho, koi redundant download nahi hota.

---

## 8. Hardware & SDK Implementation (Camera, Printer, Kiosk)

HappyPix hardware layer me ek strict **"Honesty Rule"** follow karta hai: **Koi bhi mock ya fake success live production me nahi chalega.** Agar hardware physically connect nahi hai, toh system clearly error throw karega.

```
                               ┌────────────────────────────────┐
                               │   HAPPYPIX HARDWARE LAYER      │
                               └───────────────┬────────────────┘
                                               │
             ┌─────────────────────────────────┴─────────────────────────────────┐
             ▼                                                                   ▼
    [ CAMERA SUBSYSTEM ]                                                [ PRINTER SUBSYSTEM ]
    • PhoneCameraProvider (VisionCamera)                                • IPPProvider (RFC 8011, Port 631)
    • CanonCameraProvider (Canon CCAPI)                                 • Windows Driver Spooler (.NET PowerShell)
    • PtpCameraProvider (Nikon - Desktop only)                          • CUPS `lp` (macOS/Linux)
    • SonyCameraProvider (Awaiting SDK)                                 • DNP / Citizen / AirPrint Stubs
```

### 8.1 Camera Subsystem (Phone, Canon CCAPI, Nikon PTP, Sony)
1. **Phone Camera (`PhoneCameraProvider.ts`)**:
   * **Status**: **100% Complete & Working**.
   * **Tech**: `react-native-vision-camera v4`. In-built tablet/phone camera frames, live view preview, capture sound.
2. **Canon DSLR/Mirrorless (`CanonCameraProvider.ts`)**:
   * **Status**: **100% Working (Network/Wi-Fi)**.
   * **Tech**: **Canon CCAPI (Camera Control API)**. Isme kisi native binary SDK (.so/.dll) ki zarurat nahi hoti. Camera aur Booth same Wi-Fi network par hote hain. HTTP REST calls (`http://<camera-ip>:8080/ccapi`) se camera control hota hai.
   * Supported: Remote shooting, live view polling (`/ccapi/ver110/shooting/liveview/flipdetail`), shutter release (`/ccapi/ver110/shooting/control/shutterbutton`), SD image download, battery check.
3. **Nikon / PTP USB Camera (`PtpCameraProvider.ts`)**:
   * **Status**: **Hardware Seam Ready / Transport Pending**.
   * PTP 1.1 aur Nikon vendor opcodes mapped hain. Android USB Host transport pipeline pending hai. Electron desktop par Nikon SDK directly use ho sakti hai.
4. **Sony Alpha Mirrorless (`SonyCameraProvider.ts`)**:
   * **Status**: **Architecture Stub Ready**.
   * Awaiting Sony Camera Remote SDK NDA/license. Interface fully ready hai.

### 8.2 Printer Subsystem (Windows Spooler, CUPS, IPP, DNP)
1. **Windows Native Silent Spooler (`electron/src/electron/hardware.ts`)**:
   * **Status**: **100% Complete & Working**.
   * **Tech**: PowerShell + `.NET System.Drawing.Printing.PrintDocument`.
   * Windows par installed kisi bhi standard driver (DNP DS620A, RX1HS, Citizen CY-02, Canon SELPHY, Epson) par background me silently bina kisi print dialog ke multiple copies dispatch kar deta hai.
2. **IPP Network Printing (`IPPProvider.ts`)**:
   * **Status**: **Core Implemented**.
   * **Tech**: Internet Printing Protocol (RFC 8011) over HTTP/HTTPS (Port 631). Network par kisi bhi IPP-enabled photo printer ko raw IPP binary request bhejta hai.
3. **macOS / Linux Printing (`hardware.ts`)**:
   * **Status**: **100% Working**.
   * **Tech**: CUPS command line (`lp -n <copies> -o fit-to-page <tempFile>`).
4. **DNP Direct SDK (`StubProviders.ts`)**:
   * **Status**: **Stub (Honest Failure)**.
   * DNP ka koi public open-source Android SDK exist nahi karta (sirf Windows/macOS drivers aate hain). Isliye mobile Android booth par DNP printer chalane ke liye DNP Wireless Print Server (WPS) ya router ke sath IPP use hota hai, jabki Windows Booth par direct official DNP Windows Driver use hota hai.

### 8.3 Android Kiosk Mode & Device Owner
* Kiosk security ke liye `@happypix/kiosk-core` me custom Kotlin code likha hai.
* Production setup command via ADB:
  ```bash
  adb shell dpm set-device-owner com.happypix.booth/.kiosk.KioskAdminReceiver
  ```
* Isse app **Android Lock Task Mode** me chali jaati hai aur bina admin password ke exit nahi ho sakti.

---

## 9. Developer Core Knowledge & Ground Rules

1. **Role-Based Access Control (RBAC) Strictness**:
   * Platform par 5 fixed roles hain: `Owner`, `Platform Admin`, `Support Manager`, `Organization Admin`, `Organization Manager`.
   * **Rule**: Database me koi `BOOTH_OPERATOR` role nahi hai. Booth koi user nahi hai; **Booth ek UUID-paired Device hai**.
2. **Computed Plan Status (Never Stored Directly)**:
   * Organization ka subscription status (`active`, `trial`, `expiring_soon`, `expired`, `suspended`, `banned`) database me static string ki tarah save nahi hota.
   * `backend/services/planService.js` har request par current timestamp, plan limits, aur suspension flags ko evaluate karke dynamically compute karta hai.
3. **Event Pricing Immutability**:
   * Jab koi Event banta hai, toh Organization Defaults ki pricing us event ke snapshot me lock ho jaati hai. Agar kal ko Org Admin defaults me 4x6 print ka price change kare, toh purane ya ongoing events par uska asar nahi padega.
4. **Honesty Rule (No Fake Telemetry / Prints)**:
   * Agar printer me paper khatam hai ya printer disconnect hai, toh code kabhi fake success return nahi karega.
   * Empty URI capture return karna strictly forbidden hai kyunki wo gallery aur guest download pipeline ko corrupt kar deta hai.
5. **Security Boundary in Electron**:
   * `contextIsolation: true`, `nodeIntegration: false`.
   * Renderer process ko direct Node.js APIs (`fs`, `child_process`) ka access nahi hai. Sabhi privileged actions `preload.cts` ke IPC handlers ke peeche hain.

---

## 10. Live Production Deployment & Infrastructure Checklist

### 10.1 Environment Variables Reference

#### Main Backend (`/backend/.env`)
```env
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/happypix?retryWrites=true&w=majority
JWT_SECRET=super_secure_random_64_char_secret_key

# AWS S3 Storage
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-south-1
S3_BUCKET_NAME=happypix-production-assets

# AI Services
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
TOGETHER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Payment Gateways
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
CASHFREE_APP_ID=xxxxxxxxxxxx
CASHFREE_SECRET_KEY=xxxxxxxxxxxxxxxxxxxx
CASHFREE_ENV=production

# URLs & Communications
WEBSITE_URL=https://happypix.in
CRM_URL=https://crm.happypix.in
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
```

#### CRM Frontend (`/crm/.env`)
```env
VITE_MOCK=false
VITE_API_URL=https://api.happypix.in
```

#### Website Backend (`/website-backend/.env`)
```env
PORT=5001
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/happypix?retryWrites=true&w=majority
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-south-1
S3_BUCKET_NAME=happypix-production-assets
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
```

#### Android Booth App (`client-app/apps/booth/.env`)
```env
BOOTH_API_URL=https://api.happypix.in
BOOTH_DEVICE_TOKEN=<provisioned_token>
```

#### Electron Desktop Booth (`electron/.env.local`)
```env
VITE_BOOTH_API_URL=https://api.happypix.in
HAPPYPIX_PRINTER_NAME=DNP DS620
```

### 10.2 AWS S3 & Cloud Infrastructure
* **S3 CORS Configuration**:
  ```json
  [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
      "AllowedOrigins": ["https://happypix.in", "https://crm.happypix.in"],
      "ExposeHeaders": ["ETag"]
    }
  ]
  ```
* **MongoDB Atlas TTL Index on GuestDownload**:
  ```javascript
  db.guestdownloads.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 })
  ```

### 10.3 Hardware Rig Requirements
* **Tablet Rig**: Android Tablet (Samsung Galaxy Tab S8/S9 / iPad 10th Gen), Min 4GB RAM, Android 13+.
* **PC Rig**: Intel i5 11th Gen+, 8GB RAM, Windows 11 Pro (for PowerShell printing support).
* **Printer**: DNP DS620A / Citizen CY-02 (Dye-sublimation, 300 DPI, ~8 sec per print).
* **Camera**: Canon EOS M50 Mark II / R50 / R100 with CCAPI firmware or standard AC power adapter dummy battery.

---

## 11. Developer Viva & Technical Interview (Q&A)

### 11.1 Technical & Architectural Questions

#### Q1: "Database me multi-tenancy kaise implement ki gayi hai? Kya har Organization ka alag database hai?"
> **Answer**:
> "Nahi, HappyPix single-database multi-tenant architecture use karta hai. Har tenant document (events, devices, photos, coupons, custom templates) ke paas ek mandatory `organizationId` reference hota hai.
> Backend API layer me authenticated JWT token se `req.user.organizationId` extract kiya jata hai aur har MongoDB query me tenancy filter automatically inject hota hai. Platform Owner aur Admins ke paas tenant bypass permissions hoti hain, jabki Organization Admins sirf apne `organizationId` se bound data hi dekh ya edit kar sakte hain."

#### Q2: "Template system me Fabric.js ya heavy canvas libraries kyu use nahi ki gayi? Pure SVG aur Layout Engine kyu banaya gaya?"
> **Answer**:
> "Fabric.js jaisi libraries DOM aur heavy canvas context par depend karti hain, jo SSR, headless backend rendering aur low-spec Android tablets par memory leaks aur performance drops create karti hain.
> HappyPix ne ek deterministic pure-math Layout Engine (`layouts.js`) banaya hai jo proportional coordinate geometry par kaam karta hai (`UNIT = 250`). CRM me SVG use karne se zero-dependency render milta hai jo vectorially infinite zoom par bhi sharp rehta hai. Mobile par Skia engine aur Backend par Sharp engine inhi pre-computed coordinates ko exact 300 DPI physical print buffer me convert kar dete hain."

#### Q3: "AI Template feature me Groq aur Together AI dono kyu use kiye gaye? Ek hi model se sab kyu nahi karwaya?"
> **Answer**:
> "Dono ka role bilkul alag hai:
> 1. **Groq (`openai/gpt-oss-120b`)**: Yeh ultra-fast LLM inference provide karta hai. Iska kaam user ke natural language prompt ko samajhna, intent classify karna, aur strict Design JSON spec generate karna hai. LLM images draw nahi kar sakta.
> 2. **Together AI (`FLUX.2-pro`)**: Yeh State-of-the-art diffusion image generation model hai jo high-resolution (1024x1024) realistic backgrounds aur textures render karta hai.
> Dono ko combine karke hume structured JSON control bhi milta hai aur photorealistic visual assets bhi."

#### Q4: "Booth App me Finite State Machine (XState) kyu use kiya gaya hai? Normal React useState kyu nahi?"
> **Answer**:
> "Kiosk environment me guest continuous screen tap karte hain. Normal `useState` ya boolean flags (`isCapturing`, `isPaying`) me race conditions create hoti hain (e.g. payment confirm hone se pehle camera trigger ho jana ya timeout par state corrupt ho jana).
> XState finite states (`idle`, `layout_select`, `payment_pending`, `countdown`, `capturing`, `compositing`, `printing`, `success`) define karta hai jisme invalid transitions mathematically impossible hoti hain. Isse kiosk kabhi crash ya illegal state me nahi jaata."

---

### 11.2 Practical, Hardware & Offline Edge Cases

#### Q5: "Event ke beech me agar venue ka Wi-Fi / Internet cut ho jaye, toh kya photobooth ruk jayega?"
> **Answer**:
> "Nahi. HappyPix Booth **Offline-First** design par bana hai:
> 1. Booth power-on hote hi pura event snapshot (templates, coordinates, branding, layout prices) local storage me cache kar leta hai.
> 2. Photo capture, Skia composition, aur physical DNP printing local LAN/hardware par hoti hai, jisme internet ki zarurat nahi hoti.
> 3. Captures aur logs local disk par queue ho jaate hain.
> 4. Jaise hi internet wapas connect hota hai, background worker photos ko S3 par sync karta hai aur guest download links emit karta hai."

#### Q6: "Camera aur Printer me 'Honesty Rule' kya hai? Explain karo."
> **Answer**:
> "Early prototypes me developers hardware available na hone par code me mock response bhej dete the (e.g. fake photo URL generate karna ya printer success return kar dena jabki printer connect hi nahi tha).
> Live production me isse disaster hota tha: guest ke paise kat jaate the, screen par 'Printed Successfully' likha aata tha aur printer se kuch nahi nikalta tha.
> 'Honesty Rule' ke mutabik: Agar hardware ready nahi hai, toh code fail-loudly karega (`throw new Error('Printer unreachable')`). System guest ko fake confirmation nahi dega aur session ko fail mark karke audit log create karega."

#### Q7: "Canon Camera ko connect karne ke liye native C++ SDK ki jagah CCAPI kyu prefer kiya gaya?"
> **Answer**:
> "Canon ka official EDSDK C++ binary format me aata hai, jo sirf Windows aur macOS ko support karta hai; Android tablets par uski native libraries compile aur maintain karna extremely difficult hai.
> Canon CCAPI (Camera Control API) camera me embedded HTTP REST server provide karta hai. React Native aur Electron dono standard HTTP fetch calls (`GET /ccapi/ver110/shooting/liveview`, `POST /ccapi/ver110/shooting/control/shutterbutton`) se camera ko directly control kar sakte hain bina kisi native dependency ke."

---

### 11.3 Business Logic, Rules & Security Strictness

#### Q8: "Guest Download link 24 hours me expire kyu hota hai? Isko permanent kyu nahi rakha gaya?"
> **Answer**:
> "Iske do main reasons hain:
> 1. **Data Privacy & Compliance**: Photobooths public events par lagte hain jahan log personal photos click karte hain. Permanent public URLs privacy liability create karte hain.
> 2. **S3 Storage & Cloud Cost Optimization**: Agar har booth session ke uncompressed composites aur RAW photos permanently hot-storage me rahenge, toh S3 hosting cost exponentially badh jayegi.
> 24 hours ke baad MongoDB TTL index download record ko auto-purge kar deta hai, jabki event gallery me sirf authorized organization admin ke paas retention policy ke mutabik photos rehti hain."

#### Q9: "Organization Defaults aur Event Pricing me kya rishta hai? Agar Org Admin default price badalta hai toh chalte hue event par kya asar padega?"
> **Answer**:
> "Organization Defaults ek baseline template hai. Jab naya Event banta hai, toh Defaults ki pricing us Event ke document me deep-clone ho kar store hoti hai.
> Event ke paas apna independent `layoutPrices` snapshot hota hai. Isliye, Defaults me koi bhi badlav ongoing ya scheduled events ko affect **nahi** karta. Event hamesha apne frozen snapshot prices par hi run hota hai."

#### Q10: "Kya Organization Admin kisi Platform Admin ka account ya doosre Organization ka data dekh sakta hai?"
> **Answer**:
> "Bilkul nahi. System me strict tenancy isolation hai:
> 1. Frontend level par, sidebar aur routing matrix (`src/lib/roles.js`) forbidden routes ko render hi nahi karta.
> 2. API level par, backend middleware JWT role aur tenant claim verify karta hai. Agar koi Org Admin platform route ya kisi aur org ki ID access karne ki koshish kare, toh API turant `403 Forbidden` return karti hai aur `AuditLog` me security incident write karti hai."

---

### 💡 Quick Summary Cheatsheet for Developers

```text
┌──────────────────────┬──────────────────────────────────────────────────────────────────┐
│ MODULE               │ PRIMARY TECH                                                     │
├──────────────────────┼──────────────────────────────────────────────────────────────────┤
│ CRM Frontend         │ React 18, Vite, Zero-dep SVG/CSS, Context API                    │
│ Main Backend         │ Node.js (ESM), Express 5, Mongoose 9, MongoDB 7, Sharp           │
│ Website & Downloads  │ React 18, Framer Motion, Express 5, Razorpay, S3 Presigner       │
│ Android Booth App    │ React Native 0.86, TypeScript 5, XState 5, Skia 2D, VisionCamera │
│ Desktop Booth App    │ Electron 44, React 19, PowerShell .NET Spooler, CUPS lp          │
│ AI Engine            │ Groq (openai/gpt-oss-120b) + Together AI (FLUX.2-pro)            │
│ Storage & Media      │ AWS S3 (Bucket ap-south-1), Sharp (300 DPI Compositing)          │
│ Hardware Protocols   │ Canon CCAPI (HTTP 8080), IPP (HTTP 631), Android Kiosk Mode      │
└──────────────────────┴──────────────────────────────────────────────────────────────────┘
```
