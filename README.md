# HappyPix

**A complete photo-booth operating system** — public website, multi-tenant CRM, a React Native booth
app for **Android tablets and iPad**, a Windows/macOS kiosk, payments, dye-sublimation printing and
24-hour guest digital delivery, all running on one backend.

<p align="center">
  <b>Website</b> · <b>CRM</b> · <b>Booth (Android + iPad)</b> · <b>Booth (Electron)</b> · <b>Backend</b> · <b>Website backend</b>
</p>

---

## Table of contents

1. [What HappyPix is](#1-what-happypix-is)
2. [The ecosystem](#2-the-ecosystem)
3. [Tech stack and supported platforms](#3-tech-stack-and-supported-platforms)
4. [Documentation index](#4-documentation-index)
5. [Repository layout](#5-repository-layout)
6. [Quick start](#6-quick-start)
7. [Repositories, deployments and environments](#7-repositories-deployments-and-environments)
8. [Owners and responsibility](#8-owners-and-responsibility)
9. [Project status at a glance](#9-project-status-at-a-glance)
10. [Licence and confidentiality](#10-licence-and-confidentiality)

---

## 1. What HappyPix is

HappyPix is a **multi-tenant SaaS platform for professional photo-booth operators**. It replaces the
usual pile of disconnected tools — a booking sheet, a standalone capture app, a printer driver, a
WhatsApp group for photo delivery — with one system where:

* the **operator** manages clients, events, booths, templates, pricing and staff in a CRM;
* the **booth** (Android tablet, iPad, or a Windows/macOS PC) captures, composes, prints and uploads;
* the **guest** pays at the booth, walks away with a physical print and scans a QR code for a
  high-resolution digital copy that self-destructs in 24 hours;
* the **platform owner** sees revenue, subscriptions, support and device telemetry in one console.

### The problem it solves

| Pain in the booth industry | How HappyPix handles it |
|---|---|
| Operators run 3–10 booths across cities with no central view | One CRM, per-event snapshot sync, live device heartbeat and telemetry |
| Templates are designed per event in Photoshop, then printed badly | Deterministic layout engine (16 print families), 300 DPI compositing, 15% branding footer |
| Event Wi-Fi fails mid-reception | Offline-first booth: snapshot cache, local capture/composite/print, queued sync |
| Guests ask "where are my photos?" for weeks | QR → 24-hour expiring download, no login, no app install |
| Guests pay cash, operator reconciles by hand | On-booth UPI/card via Razorpay/Cashfree, per-session receipts, org wallet |
| Printers run out of media silently | DNP telemetry (paper/ribbon/queue) + heartbeat + operator alerts |
| Every new design needs a developer | AI template generation (Groq + FLUX) inside the CRM |

### What is genuinely production-grade today

Verified in this repository (build + typecheck + lint passing on `arena/097e52ae-local`):

* **Backend** — 100+ REST endpoints, 23 Mongoose models, JWT auth, device-token auth, rate limits,
  audit log, payment webhooks with signature verification, S3 uploads, TTL-based guest downloads.
* **CRM** — 5 fixed roles enforced three times (nav, router, API), 21 screens, zero UI dependencies.
* **Booth apps** — one React Native codebase for **Android and iPad** (XState + Skia, Canon CCAPI,
  IPP/AirPrint) plus an Electron kiosk (React 19, PowerShell spooler, CUPS); all three run the same
  session flow, filters, ornaments, payment, print, issue-raising and QR.
* **Website** — marketing, pricing, plan checkout, guest download portal.

Where something is *not* production-ready, it is explicitly marked in
[§9](#9-project-status-at-a-glance) and in the per-feature documents. Nothing is described as
working if it only exists as a stub.

---

## 2. The ecosystem

```
                          ┌──────────────────────────────────────────┐
                          │              HAPPYPIX SAAS               │
                          └────────────────────┬─────────────────────┘
                                               │
        ┌──────────────┬───────────────┬───────┴────────┬─────────────────┐
        ▼              ▼               ▼                ▼                 ▼
  ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌─────────────┐  ┌─────────────┐
  │ Website   │  │    CRM    │  │  Backend   │  │ Booth       │  │ Booth       │
  │ happypix  │  │  crm.     │  │  api.      │  │Android·iPad │  │ Electron    │
  │ React 18  │  │ React 18  │  │ Express 5  │  │ RN + XState │  │ React 19    │
  └─────┬─────┘  └─────┬─────┘  └──────┬─────┘  └──────┬──────┘  └──────┬──────┘
        │              │               │               │                │
        └──────────────┴───────┬───────┴───────────────┘                │
                               ▼                                        │
                  ┌─────────────────────────┐                           │
                  │  MongoDB Atlas (shared) │                           │
                  │  S3 (photos, assets)    │                           │
                  │  Razorpay / Cashfree    │                           │
                  │  Groq / Together / xAI  │                           │
                  └─────────────────────────┘                           │
                                                                        │
                  ┌─────────────────────────────────────────────────────┘
                  ▼
        Camera (Canon CCAPI / USB / device camera)
        Printer (DNP · Citizen · HiTi · Canon SELPHY · any OS driver)
```

### Applications and what each one is for

| # | Application | Path | Who uses it | Purpose |
|---|---|---|---|---|
| 1 | **Public website** | `/website` | Prospective customers, guests | Marketing, pricing, subscription checkout, **guest download portal** (`/download/:id`) |
| 2 | **Website backend** | `/website-backend` | Website (server-to-server) | Public plans API, Razorpay checkout, presigned guest downloads, sales leads |
| 3 | **CRM** | `/crm` | Platform owner/admins, org admins/managers | Tenancy, events, devices, templates, pricing, revenue, support, audit |
| 4 | **Main backend** | `/backend` | CRM, booths, webhooks | Auth, tenancy, snapshots, payments, sessions, photos, support, AI |
| 5 | **React Native booth** | `/client-app` | Booth operators (Android tablet, iPad) | Full kiosk flow with native camera/printer/kiosk packages; iOS target in `apps/booth/ios` |
| 6 | **Electron booth** | `/electron` | Booth operators (PC kiosk) | Same flow on Windows/macOS with spooler printing + DNP telemetry |

---

## 3. Tech stack and supported platforms

### Backend and data

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js (ESM) | 20 LTS / 22 LTS |
| HTTP | Express | 5.2.x |
| Database | MongoDB Atlas + Mongoose | 7.x driver / 9.4.x |
| Files | AWS S3 (`@aws-sdk/client-s3`, `lib-storage`, `s3-request-presigner`) | v3 |
| Imaging | Sharp | 0.35.x |
| Auth | `jsonwebtoken`, `bcryptjs`, device token hashing (SHA-256) | — |
| Payments | Razorpay 2.9.x, Cashfree PG 6.x | — |
| AI | Groq (`openai/gpt-oss-120b`), Together AI (`FLUX.2-pro`), xAI fallback | — |
| Email/SMS | SendGrid 8.x, Twilio 6.x | — |
| Rate limiting | `express-rate-limit` | 8.x |

### Clients

| Client | Stack | Platforms |
|---|---|---|
| CRM | React 18.3, Vite 5.4, hand-rolled SVG/CSS (zero UI libs) | Any modern browser |
| Website | React 18.3, Vite 5.4, React Router 6, Framer Motion 11 | Any modern browser |
| React Native booth | React Native 0.86, TypeScript 5, XState 5, Skia 2.6, VisionCamera 4.6 | Android 13+ (API 33) · iPadOS 15.1+ |
| Electron booth | Electron 44, React 19, Vite 7, TypeScript 5.9 | Windows 10/11, macOS 12+, Linux |

### Hardware platform support

| Device class | RN booth — Android | RN booth — iPad | Electron booth |
|---|---|---|---|
| Device/phone camera | ✅ VisionCamera | ✅ VisionCamera | ✅ `getUserMedia` |
| Canon DSLR (Wi-Fi) | ✅ CCAPI REST | ⚠️ same code, untested | ⚠️ seam only (`canon-sdk-pending`) |
| Nikon (USB PTP) | ⚠️ transport pending | ⚠️ transport pending | ⚠️ transport pending |
| Sony Alpha | ⚠️ interface stub (SDK NDA) | ⚠️ interface stub | ⚠️ interface stub |
| Windows spooler printers | — | — (via Print Bridge) | ✅ PowerShell + `System.Drawing` |
| macOS/Linux CUPS printers | — | — (via Print Bridge) | ✅ `lp` + `lpstat` |
| Network IPP printers | ✅ raw IPP (RFC 8011) | ⚠️ via Print Bridge | ⚠️ via OS driver |
| AirPrint | — | ❌ stub only (needs a native bridge) | — |
| DNP media/ribbon telemetry | ⚠️ no public Android SDK | ⚠️ no public iOS SDK | ✅ `CyStat64.dll` + WMI fallback |
| Kiosk lockdown | ✅ Lock Task Mode (device owner) | ⚠️ Guided Access / MDM only | ✅ `kiosk: true` window |

Full detail, including the tested-model tables and the honest "untested" column, is in
[`docs/HARDWARE_PRINTING.md`](docs/HARDWARE_PRINTING.md) and
[`electron/HARDWARE_SDK_REPORT.md`](electron/HARDWARE_SDK_REPORT.md).

---

## 4. Documentation index

Every document below is versioned in this repository. Start with the owner's order.

| # | Document | What it answers |
|---|---|---|
| 1 | **This README** | What HappyPix is, what exists, how to start |
| 2 | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the system fits together; roles; capture → print → share flows |
| 3 | [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Install, run, test, build, conventions, troubleshooting |
| 4 | [`docs/BACKEND_API_DATABASE.md`](docs/BACKEND_API_DATABASE.md) | Every endpoint, error code, schema, index and migration |
| 4b | [`docs/openapi.yaml`](docs/openapi.yaml) | Machine-readable OpenAPI 3.1 contract |
| 4c | [`docs/BACKEND_REFERENCE.html`](docs/BACKEND_REFERENCE.html) | **Self-contained HTML backend reference** — every endpoint with inputs/outputs, all middleware, utils, services, models and the total system flow. Open it in a browser; no server needed |
| 5 | [`docs/APPLICATIONS_CRM.md`](docs/APPLICATIONS_CRM.md) | Website, CRM, Android, Electron — modules and behaviour |
| 6 | [`docs/HARDWARE_PRINTING.md`](docs/HARDWARE_PRINTING.md) | Cameras, printers, drivers, media, print geometry |
| 7 | [`docs/DEPLOYMENT_RELEASE.md`](docs/DEPLOYMENT_RELEASE.md) | Hosting, DNS, CI/CD, signing, rollout, rollback |
| 8 | [`docs/SECURITY_PRIVACY.md`](docs/SECURITY_PRIVACY.md) | Secrets, RBAC, data retention, incidents, DPDP/GDPR |
| 9 | [`docs/TESTING_RELEASE_CHECKLIST.md`](docs/TESTING_RELEASE_CHECKLIST.md) | Test strategy, matrices, known bugs, sign-off |
| 10 | [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Monitoring, alerts, backups, DR, on-call runbooks |
| 11 | [`docs/USER_ADMIN_GUIDE.md`](docs/USER_ADMIN_GUIDE.md) | Onboarding, event setup, operator workflow, admin |
| 12 | [`business/SCALABILITY_PLAN.md`](business/SCALABILITY_PLAN.md) | 10K → 10M users: architecture and cost at each stage |
| 5b | [`docs/IPAD_SUPPORT.md`](docs/IPAD_SUPPORT.md) | iPad build, behaviour, the 18 review findings and the kiosk/lockdown recipe |
| 12b | [`docs/HOSTING_AND_SCALING.md`](docs/HOSTING_AND_SCALING.md) | Where every component runs today, what each costs, the triggers and stages for growth, and the 30+ situations that force an architecture change |
| 12c | [`docs/DIAGRAMS.md`](docs/DIAGRAMS.md) · [`docs/diagrams/index.html`](docs/diagrams/index.html) | 29 maintained diagrams: ecosystem, ER, DFD L0/L1/L2, HLD/LLD, future architecture. The HTML version is interactive |
| 13 | [`business/FINANCIAL_MODEL.xlsx`](business/FINANCIAL_MODEL.xlsx) | Full expenditure model, forecasts, runway |
| 14 | [`business/UNIT_ECONOMICS.xlsx`](business/UNIT_ECONOMICS.xlsx) | Pricing, cost per print/photo/AI call, margins, break-even |
| 15 | [`business/HANDOVER_REGISTER.xlsx`](business/HANDOVER_REGISTER.xlsx) | Owners, vendors, renewals, credentials, debt, artefacts |

Supporting technical references already in the repo:

* [`HAPPYPIX_V2_MASTER_DOCUMENTATION.md`](HAPPYPIX_V2_MASTER_DOCUMENTATION.md) — deep technical
  handbook (schema rationale, AI pipeline, viva-style Q&A).
* [`electron/HARDWARE_SDK_REPORT.md`](electron/HARDWARE_SDK_REPORT.md) — Windows/macOS SDK parity.
* [`crm/SECURITY.md`](crm/SECURITY.md) — CRM hosting headers and client-side posture.
* [`docs/BACKEND_REFERENCE.html`](docs/BACKEND_REFERENCE.html) — the generated, single-file backend reference
  (rebuild with `python3 docs/scripts/build_backend_doc.py`).
* [`docs/diagrams/src/`](docs/diagrams/src) — the Mermaid sources behind all 29 diagrams
  (`python3 docs/scripts/build_diagrams.py` to rebuild the viewer).
* [`docs/HOSTING_AND_SCALING.md`](docs/HOSTING_AND_SCALING.md) — hosting, unit costs and the scale trigger table.

---

## 5. Repository layout

```
local/
├── README.md                     ← you are here
├── docs/                         ← the 11 engineering/operations documents
├── business/                     ← scalability plan + 3 financial workbooks
│
├── backend/                      ← main REST API (Express 5, ESM)
│   ├── server.js                 ← app bootstrap, CORS, rate limits, price engine
│   ├── routes/                   ← auth, events, coupons, payments, support, devices,
│   │   │                            booth (kiosk API), share, downloads
│   │   └── crm/                  ← auth.js · platform.js · org.js  (CRM v2 API)
│   ├── models/                   ← 23 Mongoose schemas
│   ├── services/                 ← plan, snapshot, coupons, gallery, downloads, delivery, AI
│   ├── middleware/               ← authenticate · requirePerm · authenticateDevice
│   ├── utils/                    ← s3 · crypto · auditLogger · httpError · printHelper
│   ├── scripts/                  ← seed + maintenance scripts
│   └── tests/                    ← node:test suites
│
├── crm/                          ← React 18 admin console (zero UI deps)
│   ├── src/pages/platform/       ← owner & internal team screens
│   ├── src/pages/org/            ← tenant screens
│   ├── src/lib/                  ← roles, layouts, router, plans
│   └── src/api/                  ← client + in-browser mock server
│
├── website/                      ← public marketing site + guest download portal
├── website-backend/              ← public plans/checkout/download service (shared Mongo)
│
├── client-app/                   ← Android booth (pnpm + Turborepo)
│   ├── apps/booth/               ← screens, navigation, offline sync
│   └── packages/                 ← api · camera-core · printer-core · kiosk-core ·
│                                    state-machine · types · ui
│
└── electron/                     ← Windows/macOS PC booth (Electron + React)
    ├── src/electron/             ← main process: hardware, dnpTelemetry, printServer, store
    ├── src/ui/                   ← renderer: screens, components, composite, services
    └── HARDWARE_SDK_REPORT.md
```

---

## 6. Quick start

### Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | ≥ 20 LTS | everything |
| npm | ≥ 10 | backend, CRM, website, website-backend, electron |
| pnpm | 9.x | `client-app` only |
| MongoDB | Atlas free tier or local 7.x | backend, website-backend |
| Java JDK 17 + Android SDK 35 | — | Android booth |
| Xcode 16 + CocoaPods (macOS) | — | iPad booth |
| Python 3 | ≥ 3.10 | optional tooling scripts |
| FFmpeg | any | optional video-booth work |

### 1 · Backend (port 5000)

```bash
cd backend
npm install
cp .env.example .env          # fill MONGODB_URI + JWT_SECRET at minimum
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"   # JWT_SECRET
npm run dev                   # nodemon
npm test                      # node --test tests/*.test.js
```

The server **refuses to boot** without `MONGODB_URI`, `JWT_SECRET`, `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET` — this is intentional (fail-closed auth).

Seed a first owner account:

```bash
node seed_superadmin.js
node seed_admin.js
node seed_templates.js
```

### 2 · CRM (port 5173)

```bash
cd crm
npm install
cp .env.example .env
# Demo data, no backend:            VITE_MOCK=true
# Real backend:                     VITE_MOCK=false  VITE_API_URL=http://localhost:5000
npm run dev
```

Demo logins (mock mode only, password `demo123`):

| Role | Email |
|---|---|
| Owner | `owner@happypix.com` |
| Platform Admin | `priya@happypix.com` |
| Support Manager | `support@happypix.com` |
| Org Admin | `sana@sunsetweddings.com` |
| Org Manager | `rohit@sunsetweddings.com` |

### 3 · Website + website backend (5174 / 5001)

```bash
cd website-backend && npm install && cp .env.example .env && npm run dev
cd ../website      && npm install && cp .env.example .env && npm run dev
```

`website/.env` leaves `VITE_API_URL` empty in development: Vite proxies `/api` to `:5001`.

### 4 · Electron booth

```bash
cd electron
npm ci
npm run verify          # typecheck + lint + vitest + transpile + vite build
npm run dev             # Vite on 8888 + Electron shell
HAPPYPIX_PRINTER_NAME="DNP DS-RX1HS" npm run dev    # pin a printer
npm run dist:win        # NSIS installer
npm run dist:mac        # arm64 DMG
```

### 5 · React Native booth (Android and iPad)

```bash
cd client-app
pnpm install
pnpm --filter com.happypix.booth android
pnpm build:apk          # debug APK
pnpm build:apk:release  # signed release APK
adb shell dpm set-device-owner com.happypix.booth/.kiosk.KioskAdminReceiver   # lock-task kiosk
```

iPad (**macOS only** — the full guide is [`docs/IPAD_SUPPORT.md`](docs/IPAD_SUPPORT.md)):

```bash
cd client-app/apps/booth
bundle install && (cd ios && bundle exec pod install)
pnpm ios --simulator "iPad Pro 13-inch (M4)"     # simulator
pnpm ios --device                                # signed device build
```

Two iPad facts that cost hours if you learn them the hard way: `10.0.2.2` is an **Android emulator**
host and means nothing on iOS (use the laptop's LAN IP in `apps/booth/.env`), and LAN printing needs
the **Local Network** permission, which the first login prompt requests.

### 6 · First end-to-end run

1. Backend + CRM running, logged into the CRM as **Org Admin**.
2. Create an **Event**, pick templates, set prices → note the 6-digit **pairing code**.
3. Boot the booth app, enter the pairing code → snapshot downloads.
4. Run one guest session end-to-end (pay with Razorpay test key), print, scan the QR.
5. Confirm the composite appears in **CRM → Gallery** and the QR resolves to the same image.

Detailed walkthrough: [`docs/USER_ADMIN_GUIDE.md`](docs/USER_ADMIN_GUIDE.md).

---

## 7. Repositories, deployments and environments

### Repository

| Item | Value |
|---|---|
| Single monorepo | `github.com/Krishna-Vineet/local` |
| Default branch | `main` |
| Active development branch | `arena/097e52ae-local` |
| Package managers | npm (5 apps) + pnpm (client-app workspace) |

### Environments

| Environment | Purpose | Backend | CRM | Website |
|---|---|---|---|---|
| Local | Development | `http://localhost:5000` | `http://localhost:5173` | `http://localhost:5174` |
| Preview | Vercel PR previews | Vercel preview | Vercel preview | Vercel preview |
| Production | Live customers | `https://happypix-v2-backend.vercel.app` ⟨custom domain TBC⟩ | `https://happypixcrm.vercel.app` | `https://happypix.in` ⟨verify DNS⟩ |

Production origins currently allowed by CORS (from `backend/server.js`):

```
https://happypix.in          https://www.happypix.in
https://crm.happypix.in      https://booth.happypix.in
https://happypix.vercel.app  https://happypixcrm.vercel.app
https://happypix-v2-backend.vercel.app
```

Any new domain must be added to that array and redeployed — otherwise the browser blocks it.

### Third-party services

| Service | Used for | Owner action |
|---|---|---|
| MongoDB Atlas | Primary datastore (single shared cluster) | Backup policy, IP allowlist |
| AWS S3 | Photos, composites, template art | Bucket policy, CORS, lifecycle |
| Razorpay | Subscription + on-booth payments | Live keys, webhook URL |
| Cashfree | Alternate UPI rail for booth payments | Live keys, webhook URL |
| Groq | Template prompt classification / design JSON | Key rotation, spend cap |
| Together AI | FLUX background image generation | Key rotation, spend cap |
| xAI | Vision/generation fallback | Key rotation |
| SendGrid | Transactional email | Domain authentication |
| Twilio | SMS OTP / notifications | Sender ID registration |
| Vercel | Hosting for web apps + 2 backends | Project + env vars |
| GitHub | Source, Actions | Branch protection |

---

## 8. Owners and responsibility

Filled in detail in [`business/HANDOVER_REGISTER.xlsx`](business/HANDOVER_REGISTER.xlsx).
Summary of **accountable roles** (names to be completed by the business owner — placeholders are
marked `⟨TBC⟩` on purpose so the register can be signed off):

| Area | Accountable | Responsible |
|---|---|---|
| Platform architecture & backend | ⟨TBC⟩ — Engineering Lead | Backend engineer |
| CRM product & tenancy rules | ⟨TBC⟩ — Product Owner | Frontend engineer |
| RN booth — Android + iPad (`client-app`) | ⟨TBC⟩ — Mobile Lead | Mobile engineer |
| Electron booth (`/electron`) | ⟨TBC⟩ — Desktop Lead | Desktop engineer |
| Hardware rigs, printer media, spares | ⟨TBC⟩ — Operations Lead | Field technician |
| Payments, subscriptions, refunds | ⟨TBC⟩ — Finance | Finance associate |
| Security, privacy, incident response | ⟨TBC⟩ — Security Officer | Engineering Lead |
| Customer onboarding & support | ⟨TBC⟩ — Customer Success | Support team |
| Vendor contracts & renewals | ⟨TBC⟩ — Founder | Operations Lead |

**Escalation rule:** any production outage, payment failure, or data-exposure suspicion goes to the
Security Officer *and* the Engineering Lead within 15 minutes, regardless of hour. See
[`docs/OPERATIONS.md`](docs/OPERATIONS.md#6-incident-severity-and-escalation).

---

## 9. Project status at a glance

Last verified: **2026-10-23** on branch `arena/097e52ae-local`
(`npm run typecheck && npm run lint && npm run build:react` in `/electron` — passing).

| Area | Status | Notes |
|---|---|---|
| Multi-tenant backend + RBAC | ✅ Production | 5 fixed roles, three-layer enforcement |
| CRM (platform + org) | ✅ Production | 21 screens, 6 demo orgs, audit trail |
| Website + guest downloads | ✅ Production | 24 h TTL, presigned S3 |
| RN booth flow (Android) | ✅ Production | Capture → edit → print → QR |
| iPad build | ⚠️ Runs, not shipped | Xcode target + iPad config present; printing, kiosk lockdown, icons and signing still open — see [`docs/IPAD_SUPPORT.md`](docs/IPAD_SUPPORT.md) |
| Electron booth flow | ✅ Production | Same flow, cross-platform print |
| Payments (Razorpay/Cashfree) | ✅ Production | Webhook signature verification |
| S3 photo + composite upload | ✅ Fixed 2026-10-23 | Composite now uploaded with individuals |
| DNP telemetry | ✅ Production (Win) / ✅ best-effort (macOS) | CUPS cannot always report media |
| Canon CCAPI camera | ✅ Android / ⚠️ Electron seam | Wi-Fi REST, no native SDK |
| Nikon PTP / Sony SDK | ⚠️ Not shipped | Interfaces ready, transports pending |
| Live video booth mode | ⚠️ Add-on scaffolded | Not shipped to customers |
| iPad distribution | ⚠️ Not started | No App Store record, no icons, no Fastlane — §8 of the iPad doc |
| Automated E2E (Detox/Playwright) | ⚠️ Partial | Unit + contract tests only |

Anything marked ⚠️ is described in its document with the exact gap and the work required.

---

## 10. Licence and confidentiality

This repository is **proprietary and confidential**. All rights reserved by the HappyPix owner.
No part may be redistributed, sublicensed or published without written permission.

Third-party licences that matter operationally:

* **Canon CCAPI** — device-embedded HTTP API, no distribution licence required.
* **Canon EDSDK / Sony Camera Remote SDK / Nikon SDK** — require vendor agreements before shipping
  native bindings. Not currently bundled.
* **DNP `CyStat64.dll`** — ships with the DNP Windows driver; we call it, we do not redistribute it.
* **Inter font / Nunito / Fredoka** — SIL Open Font License 1.1 (bundled via `@fontsource-variable`).
* **Electron, React, Express, Mongoose** — MIT / Apache-2.0; keep attribution in installers.

See [`business/HANDOVER_REGISTER.xlsx`](business/HANDOVER_REGISTER.xlsx) → *Licences* sheet for
renewal dates and contract locations.
