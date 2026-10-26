# HappyPix — Developer Setup & Codebase Guide

> **Audience:** anyone who needs to run, modify or review this codebase.
> **Assumes:** macOS, Linux or Windows with a POSIX-ish shell (Git Bash/WSL works on Windows).
> **Last verified:** 2026-10-23, branch `arena/097e52ae-local`.

---

## Table of contents

1. [Repository structure](#1-repository-structure)
2. [Required software and versions](#2-required-software-and-versions)
3. [Installation](#3-installation)
4. [Environment variables](#4-environment-variables)
5. [Running each application](#5-running-each-application)
6. [Testing](#6-testing)
7. [Building](#7-building)
8. [Git workflow](#8-git-workflow)
9. [Coding standards](#9-coding-standards)
10. [Common tasks (recipes)](#10-common-tasks-recipes)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Repository structure

### 1.1 Top level

```
local/
├── backend/            Node/Express API — the system of record
├── website-backend/    Public API for website + guest downloads (shared Mongo)
├── crm/                React admin console
├── website/            React marketing site + download portal
├── client-app/         React Native booth — Android and iPad (pnpm workspace)
├── electron/           Electron Windows/macOS kiosk
├── docs/               Engineering & operations documentation
├── business/           Scalability plan + financial workbooks
└── HAPPYPIX_V2_MASTER_DOCUMENTATION.md    Deep technical handbook
```

There is **no root `package.json`**. Each app is installed and run independently. This is
intentional: four different toolchains (npm, pnpm, Vite, Metro) in one workspace would fight over
lockfiles and hoisting.

### 1.2 `backend/`

```
backend/
├── server.js              App bootstrap: CORS, rate limits, price engine, route mounting
├── routes/
│   ├── crm/auth.js        /api/auth      — login, /me, password, OTP, email change
│   ├── crm/platform.js    /api/platform  — owner & internal team
│   ├── crm/org.js         /api/org       — tenant console (events, devices, gallery, …)
│   ├── boothRoutes.js     /api/booth     — device login, bootstrap, heartbeat, sessions
│   ├── paymentRoutes.js   /api/payments  — orders, verify, webhooks
│   ├── downloadRoutes.js  /api/downloads — guest download resolution
│   ├── photoShareRoutes.js/api/share     — share tokens + delivery tracking
│   ├── supportRoutes.js   /api/support   — guest issue tickets
│   ├── eventRoutes.js, couponRoutes.js, deviceRoutes.js, settingRoutes.js
│   └── usageAccessRoutes.js
├── models/                23 Mongoose schemas (see BACKEND_API_DATABASE.md)
├── services/
│   ├── planService.js          plan catalogue, billing prices, computed status
│   ├── boothSnapshotService.js snapshot build + revision hash
│   ├── couponService.js        validation & redemption accounting
│   ├── guestDownloadService.js 24 h download creation
│   ├── gallerySettingsService.js org gallery visibility rules
│   ├── DeliveryService.js      share delivery records
│   ├── photoUrlService.js      presigned/direct URL resolution
│   ├── eventService.js         event lifecycle helpers
│   ├── CronService.js          scheduled maintenance
│   ├── backgroundRemovalService.js
│   └── ai/                     PromptClassifier, TemplateGenerationService, providers
├── middleware/            auth.js (authenticate/requirePerm) · deviceAuth.js
├── utils/                 s3.js · crypto.js · auditLogger.js · httpError.js · printHelper.js
├── scripts/               seed + maintenance (payment config, TTL index, artwork restore)
├── tests/                 node:test suites
└── uploads/               local-only fallback storage (git-ignored in production)
```

### 1.3 `crm/`

```
crm/src/
├── api/
│   ├── client.js          fetch wrapper; picks mock vs real by VITE_MOCK/VITE_API_URL
│   └── mock/              full in-browser implementation of the v2 contract
├── components/            shared UI (layout, tables, charts, modals) — hand-rolled
├── context/               AppContext (session, org, theme, toasts)
├── lib/
│   ├── roles.js           ⚠️ THE permission matrix — single source of truth
│   ├── layouts.js         print families, slot geometry
│   ├── plans.js           plan display helpers
│   ├── router.jsx         custom push-state router
│   └── icons.jsx, format.js, theme.js, qr.js, clipboard.js, brandPaths.js
├── pages/platform/        11 owner/internal screens
├── pages/org/             11 tenant screens
└── templates/designer/    template editor + AI playground
```

### 1.4 `client-app/` (pnpm + Turborepo)

```
client-app/
├── apps/booth/                 the RN app (screens, navigation, offline sync)
└── packages/
    ├── api/                    typed backend client
    ├── camera-core/            CameraManager + Canon/Phone/Sony/PTP providers
    ├── printer-core/           PrinterManager + IPP/DNP providers + RenderEngine (Skia)
    ├── kiosk-core/             Kotlin native module (lock task / device owner)
    ├── state-machine/          XState boothMachine
    ├── types/                  shared DTOs
    └── ui/                     shared components, TemplateCanvas, pricing
```

### 1.5 `electron/`

```
electron/src/
├── electron/                 MAIN PROCESS (Node, privileged)
│   ├── main.ts               windows, display discovery, IPC, kiosk, permissions
│   ├── preload.cts           contextBridge → window.booth (the only renderer API)
│   ├── hardware.ts           printer discovery, print dispatch, hardwareSnapshot()
│   ├── dnpTelemetry.ts       CyStat64.dll (Win) + CUPS (macOS) telemetry
│   ├── printServer.ts        LAN print bridge on :9123 for tablets
│   ├── store.ts              installation identity + counters (JSON on disk)
│   ├── pathResolver.ts, util.ts
│   └── tsconfig.json         separate compile target (CommonJS)
└── ui/                       RENDERER (React 19)
    ├── App.tsx               screen router + session orchestration + finishAndPrint
    ├── screens/              Camera, Choice, Connection, Customize, Payment,
    │                         PhotoSelection, Success
    ├── components/           Brand, Controls, Icon, ScreenShell, TemplateCanvas
    ├── context/BoothContext.tsx
    ├── hooks/                useIdleTimer, useQrCode
    ├── services/             api.ts, bridge.ts, cache.ts, sound.ts
    ├── utils/                composite.ts (renderer), pricing.ts
    └── types.ts
```

---

## 2. Required software and versions

### 2.1 Minimum

| Tool | Minimum | Recommended | Check |
|---|---|---|---|
| Node.js | 20.11 | 22 LTS | `node -v` |
| npm | 10 | 10.9+ | `npm -v` |
| pnpm | 9.0 | 9.12 | `pnpm -v` |
| Git | 2.40 | latest | `git --version` |
| MongoDB | Atlas (any tier) | Atlas M10+ for production | — |

### 2.2 Only for the React Native booth — Android

| Tool | Version |
|---|---|
| JDK | 17 (Temurin/OpenJDK) |
| Android SDK Platform | 35 |
| Android Build Tools | 35.0.0 |
| Android device / emulator | API 33+ (Android 13) |
| `adb` | from platform-tools |

### 2.2.1 Only for the React Native booth — iPad

| Tool | Version | Notes |
|---|---|---|
| macOS | 14+ | Xcode only runs on macOS; there is no Linux/Windows path to an `.ipa` |
| Xcode | 16.x | iOS 18 SDK; deployment target is 15.1 |
| CocoaPods | 1.15+ | via `bundle exec` — `apps/booth/Gemfile` pins it |
| Ruby | 3.x | for Bundler and the `Gemfile` |
| Simulator | iPad Pro 13" (M4) | fast layout checks only — it cannot validate camera, print, or local-network prompts |
| Apple Developer Program | $99/year | needed to sign, TestFlight or install on a physical iPad beyond 7 days |

The Xcode project (`apps/booth/ios/booth.xcworkspace`) is generated by `pod install` from the
committed `Podfile`; do not commit the workspace. The full iPad status and open findings are in
[`IPAD_SUPPORT.md`](IPAD_SUPPORT.md).

### 2.3 Only for the Electron booth

| Tool | Version | Notes |
|---|---|---|
| Windows 10/11 | 19045+ | needed to *test* the PowerShell spooler path |
| macOS | 12+ | needed to test the CUPS path |
| Python | 3.10+ | `electron-builder` native dep on some setups |

### 2.4 Optional

| Tool | Why |
|---|---|
| Docker | disposable MongoDB for integration tests |
| `mongosh` | inspecting Atlas collections |
| Postman/Insomnia | exercising endpoints by hand |
| AWS CLI | checking bucket policy and CORS |

### 2.5 Dependency pins that matter

| Package | Pin | Why it matters |
|---|---|---|
| `express` | 5.2.x | v5 changes error handling and router behaviour — do not "upgrade" casually |
| `mongoose` | 9.4.x | v9 removed several v7 defaults (strictQuery, callbacks) |
| `sharp` | 0.35.x | native binary; must match Node ABI |
| `electron` | 44.x | `screen`, `session` APIs and builder target must stay in sync |
| `react` | 18 in web/CRM, 19 in Electron | do **not** unify — Electron renderer intentionally on 19 |
| `react-native` | 0.86.x | New Architecture; native modules compiled against this |
| `@shopify/react-native-skia` | 2.6.x | must match RN 0.86 |
| `vite` | 5.x (CRM/website), 7.x (electron) | separate major versions per app |

---

## 3. Installation

### 3.1 Clone and install everything

```bash
git clone https://github.com/Krishna-Vineet/local.git
cd local

# npm apps (independent installs — run each)
(cd backend         && npm ci)
(cd website-backend && npm ci)
(cd crm             && npm ci)
(cd website         && npm ci)
(cd electron        && npm ci)

# pnpm workspace
(cd client-app      && pnpm install)
```

First install takes ~6–10 minutes (Electron and RN native deps dominate).

### 3.2 Seed a working backend

```bash
cd backend
cp .env.example .env            # then edit (see §4)
node seed_superadmin.js         # platform owner account
node seed_admin.js              # example org + org admin
node seed_templates.js          # layout/template catalogue
npm run dev
```

Expected boot output:

```
✅ MongoDB connected
💳 Razorpay mode: 🟡 TEST (key: rzp_test_...)
🚀 HappyPix API listening on :5000
```

If the process exits immediately with *"Missing required environment variables"*, that is the
fail-closed guard — fill `.env`, don't patch the check.

### 3.3 Verify each app

| App | Command | Expected |
|---|---|---|
| backend | `npm test` | all `node:test` suites pass |
| crm | `VITE_MOCK=true npm run dev` | login screen; `owner@happypix.com` / `demo123` works |
| website | `npm run dev` | marketing home renders, `/download/test` shows a friendly 404 |
| website-backend | `npm test` | passes |
| electron | `npm run verify` | typecheck + lint + vitest + build all pass |
| client-app | `pnpm typecheck` | no TS errors |

---

## 4. Environment variables

Never commit a real `.env`. Every app ships a `.env.example` with inline documentation. Values
marked **secret** are server-only and must never be exposed to a Vite bundle.

### 4.1 `backend/.env`

| Variable | Required | Example | Notes |
|---|---|---|---|
| `PORT` | no (5000) | `5000` | Server port |
| `MONGODB_URI` | **yes** | `mongodb+srv://user:pass@cluster.mongodb.net/happypix` | App refuses to boot without it |
| `JWT_SECRET` | **yes** | 64-byte hex | Generate with `crypto.randomBytes(64).toString('hex')` |
| `AWS_ACCESS_KEY_ID` | for S3 | `AKIA…` | Secret — IAM user with bucket-scoped policy |
| `AWS_SECRET_ACCESS_KEY` | for S3 | — | Secret |
| `AWS_REGION` | for S3 | `ap-southeast-2` | Must match bucket region |
| `S3_BUCKET_NAME` | for S3 | `happypix-production-assets` | Bucket must exist before boot |
| `RAZORPAY_KEY_ID` | **yes** | `rzp_test_…` | `rzp_live_…` in production; boot logs the mode |
| `RAZORPAY_KEY_SECRET` | **yes** | — | Secret |
| `CASHFREE_APP_ID` | optional | — | Alternate UPI rail |
| `CASHFREE_SECRET_KEY` | optional | — | Secret |
| `CASHFREE_ENV` | optional | `sandbox` \| `production` | |
| `GROQ_API_KEY` | for AI templates | `gsk_…` | Secret |
| `TOGETHER_API_KEY` | for AI images | — | Secret |
| `XAI_API_KEY` | optional | — | Vision fallback |
| `SENDGRID_API_KEY` | for email | `SG.…` | Secret |
| `TWILIO_*` | for SMS | — | Secrets |
| `CLIENT_URL` | yes in prod | `https://crm.happypix.in` | Used in emails/redirects |
| `WEBSITE_URL` | yes | `https://happypix.in` | Used to build `/download/:id` links |
| `ENABLE_DNS_OVERRIDE` | optional | `true` | Forces 8.8.8.8/1.1.1.1 for Atlas SRV (some ISPs) |

### 4.2 `crm/.env`

| Variable | Default | Meaning |
|---|---|---|
| `VITE_MOCK` | `false` | `true` = in-browser demo backend, `false` = real API (mock not bundled) |
| `VITE_API_URL` | empty | Base URL of the main API; empty = same origin (`/api` proxied) |
| `VITE_SESSION_TTL_MIN` | `480` | Client-side session hint |
| `VITE_MAX_LOGIN_ATTEMPTS` | `5` | Lockout hint (backend enforces independently) |
| `VITE_WEBSITE_URL` | — | "Upgrade on website" link |
| `VITE_SUPPORT_EMAIL` | — | Lockout contact |
| `VITE_LOG_LEVEL` | `error` | `silent` \| `error` \| `debug` |

> All `VITE_*` values are **baked at build time** and visible in the browser. Secrets belong in the
> backend only.

### 4.3 `website/.env`

| Variable | Meaning |
|---|---|
| `VITE_API_URL` | Empty in dev → Vite proxies `/api` to `:5001`. In production this is `/api` on the same host. |
| `VITE_CRM_URL` | Where buyers are sent after checkout |

### 4.4 `website-backend/.env`

| Variable | Required | Notes |
|---|---|---|
| `PORT` | no (5001) | |
| `MONGODB_URI` | **yes** | **Must be the same database as `backend/`** |
| `RAZORPAY_KEY_ID` / `_SECRET` | **yes** | Same account as backend |
| `WEBSITE_PUBLIC_URL` | **yes** | `https://happypix.in` — used to build download links |
| `CRM_URL` | **yes** | Post-checkout redirect |
| `ALLOWED_ORIGINS` | optional | Comma-separated extras (preview URLs) |
| `WEBSITE_INTERNAL_SECRET` | **yes** | Shared secret for `POST /api/internal/downloads` |
| `AWS_*`, `S3_BUCKET_NAME` | for private buckets | Only needed to sign photo URLs |

### 4.5 `client-app/apps/booth/.env`

| Variable | Notes |
|---|---|
| `BOOTH_API_URL` | `https://api.happypix.in` in production |
| `BOOTH_DEVICE_TOKEN` | Provisioned by pairing; can be pre-seeded for factory imaging |

### 4.6 `electron/.env.local`

| Variable | Notes |
|---|---|
| `VITE_BOOTH_API_URL` | Empty = built-in demo simulator; set = real backend |
| `HAPPYPIX_PRINTER_NAME` | Exact spooler name (`Get-Printer` / `lpstat -p`) |
| `HAPPYPIX_PRINT_SERVER_PORT` | Default `9123` |
| `VITE_WEBSITE_URL` | Base for QR download links |

### 4.7 Safe `.env.example` (copy-paste starter)

A minimal, working-per-app set. **No real credentials.**

```env
# ───────────── backend/.env ─────────────
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/happypix
JWT_SECRET=replace_with_64_hex_chars
AWS_REGION=ap-southeast-2
S3_BUCKET_NAME=happypix-dev-assets
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=replace_me
CLIENT_URL=http://localhost:5173
WEBSITE_URL=http://localhost:5174

# ───────────── crm/.env ─────────────
VITE_MOCK=true
VITE_API_URL=
VITE_LOG_LEVEL=debug

# ───────────── website/.env ─────────────
VITE_API_URL=
VITE_CRM_URL=http://localhost:5173

# ───────────── website-backend/.env ─────────────
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/happypix
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=replace_me
WEBSITE_PUBLIC_URL=http://localhost:5174
CRM_URL=http://localhost:5173
WEBSITE_INTERNAL_SECRET=dev_only_shared_secret

# ───────────── electron/.env.local ─────────────
VITE_BOOTH_API_URL=http://localhost:5000
HAPPYPIX_PRINTER_NAME=
VITE_WEBSITE_URL=http://localhost:5174
```

---

## 5. Running each application

| App | Dev command | Port | Notes |
|---|---|---|---|
| backend | `npm run dev` | 5000 | nodemon; `npm start` for prod |
| website-backend | `npm run dev` | 5001 | `node --watch` |
| crm | `npm run dev` | 5173 | mock by default |
| website | `npm run dev` | 5174 | proxies `/api` → 5001 |
| electron | `npm run dev` | 8888 + Electron | Vite renderer + main process |
| client-app | `pnpm --filter com.happypix.booth android` | Metro 8081 | needs device/emulator |

### 5.1 Running the Electron renderer in a browser only

```bash
cd electron
npm run dev:react -- --host 0.0.0.0     # http://localhost:8888
```

The preload bridge is absent there, so hardware calls return safe fallbacks — useful for UI work.

### 5.2 Running two backends on one machine

```bash
cd backend         && PORT=5000 npm run dev
cd website-backend && PORT=5001 npm run dev
cd crm             && VITE_API_URL=http://localhost:5000 npm run dev
cd website         && npm run dev            # proxies /api → :5001
```

Both must point at the **same** `MONGODB_URI`, otherwise plan checkout creates a subscription the
CRM cannot see.

### 5.3 Pairing a booth against local backend

1. CRM (mock **off**): create org → event → note pairing code.
2. Electron: `VITE_BOOTH_API_URL=http://localhost:5000`.
3. On the pairing screen, enter the 6-digit code.
4. Watch backend logs for `POST /api/booth/login 200`.

---

## 6. Testing

### 6.1 Backend

```bash
cd backend
npm test                    # node --test tests/*.test.js
npm test -- --grep coupon   # single suite
```

| Suite | Covers |
|---|---|
| `boothSnapshot.test.js` | snapshot building, revision stability, coordinate normalisation |
| `coupons.test.js` | percentage/fixed, min spend, expiry, max uses, stacking rules |
| `crypto.test.js` | token hashing, HMAC verification helpers |
| `permissions.parity.test.js` | CRM matrix ↔ backend route guards agree |
| `planService.test.js` | computed status, billing price maths, entitlement caps |

### 6.2 Electron

```bash
cd electron
npm run typecheck           # tsc -b
npm run lint                # eslint (flat config)
npm test                    # vitest run
npm run verify              # all of the above + transpile + vite build
```

`src/ui/services/api.test.ts` covers the API client contract, including the
`CompleteSessionInput` union (`string | { url, isComposite }`).

### 6.3 CRM

```bash
cd crm
node scripts/api-smoke.mjs        # API contract against the mock server
node scripts/render-test.mjs      # role × screen render matrix
```

### 6.4 Website / website-backend

```bash
cd website-backend && npm test
cd website && npm run build        # build failure is the smoke test
```

### 6.5 Manual smoke (10 minutes, before any release)

1. CRM login as each of the 5 roles → confirm sidebar matches the matrix.
2. Create event → boot booth → one free session → print → QR download.
3. Create paid event → Razorpay test card → confirm print unlocks only after payment.
4. Kill venue internet (airplane mode) → capture and print → confirm session still completes.
5. Raise an issue from the success screen → confirm ticket appears in CRM Guest Support.

Full checklist: [`TESTING_RELEASE_CHECKLIST.md`](TESTING_RELEASE_CHECKLIST.md).

---

## 7. Building

### 7.1 Web apps

```bash
cd crm     && npm run build      # dist/
cd website && npm run build      # dist/
```

Both are pure static output — deploy to any static host. `website/vercel.json` and
`backend/vercel.json` define routing/rewrites.

### 7.2 Backend

No build step (ESM, run directly). Deploy = `npm ci --omit=dev` + `node server.js`.

### 7.3 Electron

```bash
cd electron
npm run dist:win     # NSIS installer, x64
npm run dist:mac     # DMG, arm64
npm run dist:linux   # AppImage/deb, x64
```

Outputs land in `electron/release/` (git-ignored). Each target runs `transpile:electron` (main
process → `dist-electron/`) then `build:react` (renderer → `dist-react/`) first.

Signing is **not** configured in-repo. Without signing:

* Windows SmartScreen shows "Unknown publisher";
* macOS Gatekeeper blocks the app (right-click → Open, or `xattr -dr com.apple.quarantine`).

Production signing steps: [`DEPLOYMENT_RELEASE.md`](DEPLOYMENT_RELEASE.md#6-signing-and-distribution).

### 7.4 Android

```bash
cd client-app
pnpm build:apk                        # debug
pnpm build:apk:release                # signed (requires keystore + gradle properties)
```

The release keystore must **never** be committed. Location and password belong in the handover
register, not the repo. The root `client-app` scripts only cover Android; iOS has no script yet
(finding IP-15).

### 7.4.1 iPad

```bash
cd client-app
pnpm install
cd apps/booth
bundle install
bundle exec pod install --project-directory=ios
# then either: open ios/booth.xcworkspace in Xcode and Run on an iPad simulator/device
# or from the CLI:
xcodebuild -workspace ios/booth.xcworkspace -scheme booth \
  -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)'
```

Signing uses automatic signing against `com.happypix.booth`; commit `ios/ExportOptions.plist`, never
certificates or provisioning profiles. Certificates, TestFlight and the archive steps are in
[`DEPLOYMENT_RELEASE.md`](DEPLOYMENT_RELEASE.md#64-ipados).

---

## 8. Git workflow

### 8.1 Branches

| Branch | Purpose |
|---|---|
| `main` | Deployable; protected |
| `arena/097e52ae-local` | Current active development branch |
| `feat/<slug>` | Feature work, branched from `main` |
| `fix/<slug>` | Bug fixes |
| `chore/<slug>` | Tooling, deps, docs |

### 8.2 Commit messages (Conventional Commits)

```
feat(electron): raise issue after success + send final frame to S3
fix(backend): keep compositeUrl when session retries complete
docs(business): add unit economics workbook
chore(deps): bump sharp to 0.35.3
```

Scope = the app or package (`backend`, `crm`, `electron`, `client-app`, `website`, `docs`).

### 8.3 Pull requests

1. Rebase on `main` (merge commits are acceptable but prefer rebase).
2. `npm run verify` (or the app's equivalent) must pass.
3. PR description states: what changed, why, how verified, and any migration/env change.
4. One approving review for `backend/` or `crm/src/lib/roles.js` changes.
5. Squash-merge is **not** used — history is kept linear via rebase where possible, because
   `boothSnapshot` revision and migration notes are often traced to a commit.

### 8.4 Protected-path rules

| Path | Rule |
|---|---|
| `backend/models/**` | Schema changes require a migration note in the PR |
| `crm/src/lib/roles.js` | Requires a parity test update in the same PR |
| `backend/services/boothSnapshotService.js` | Changes bump snapshot contract version if coordinates change |
| `.env*` | Never commit real values; `.env` is git-ignored everywhere |
| `client-app/**/android/**` sig files | Never commit keystores |

---

## 9. Coding standards

### 9.1 General

* **TypeScript** in `electron/`, `client-app/`; **JavaScript (ESM)** in `backend/`,
  `website-backend/`, `crm/`, `website/`. Do not mix module systems in one app.
* 2-space indent, single quotes, no semicolon-less code, LF line endings.
* Prefer named exports; avoid default exports except React components.
* No `any` without a comment explaining why.
* Comments explain **why**, not **what**. Existing code follows this — match it.

### 9.2 Backend conventions

```js
// Route handler shape used everywhere
router.post('/thing', requirePerm(PERMS.THING_EDIT), asyncRoute(async (req, res) => {
  const orgId = req.user.organizationId;      // ALWAYS scope by tenant
  const doc = await Thing.findOne({ _id: req.params.id, organizationId: orgId });
  if (!doc) throw notFound('Thing not found.', 'THING_NOT_FOUND');
  // … mutate …
  await audit(req, { action: 'thing.update', entity: 'Thing', entityId: doc._id });
  res.json({ ok: true, thing: doc });
}));
```

Rules:

1. **Every** tenant query includes `organizationId`.
2. Errors go through `httpError` (`notFound`, `badRequest`, `forbidden`) with a stable `code`.
3. Mutations write an `AuditLog` row.
4. Never trust a client-supplied price, amount, or `organizationId`.
5. Money is integer minor units (paise/cents) internally; format at the edge.

### 9.3 CRM conventions

* Icons/charts are hand-rolled SVG in `src/lib/icons.jsx` — do not add a UI library.
* All permission checks come from `roles.js` via `can(role, PERM)`; never inline a role string.
* Screen components are lazy-free and small; heavy tables paginate server-side.
* Class names are semantic (`org-card`, `platform-table`), not utility-soup.

### 9.4 Electron conventions

* Renderer **never** touches Node APIs. Anything privileged goes through `preload.cts` →
  `ipcRenderer.invoke('booth:…')` → `ipcMain.handle` in `main.ts`.
* Hardware code fails loudly. No `return { success: true }` without a real dispatch.
* Long shell calls always have a timeout (`execAsync(cmd, { timeout })`).
* Any new bridge method must be typed in `src/ui/services/bridge.ts` and guarded when running in a
  plain browser.

### 9.5 React Native booth conventions (Android and iPad)

* Screens are pure presentational; flow logic lives in `boothMachine.ts`.
* Native calls wrapped in `packages/*` — screens never call native modules directly.
* Never block the JS thread with image work; use Skia or `runOnJS` for heavy tasks.
* **Platform branches must degrade, not crash.** Every `Platform.OS === 'android'` path needs a
  defined iOS fallback; `NativeKiosk` and `SimpleSound` are today's counter-examples (they silently
  no-op on iOS — see `IPAD_SUPPORT.md` IP-1, IP-2, IP-7).
* **Never hardcode an Android emulator address.** `10.0.2.2` and `127.0.0.1` exist on the Android
  emulator and nowhere else; LAN hosts must be configurable for iPad.
* Layout is validated at 1024×768 landscape and normalised by `responsive.ts`; test any new screen on
  the iPad 13" and the iPad mini, not only on the Android tablet.

### 9.6 Security hygiene

* No secrets in client bundles, logs, or error messages.
* Presigned URLs are short-lived; never log them.
* Validate and clamp every numeric input (copies, amounts, slot counts).
* Escape user-supplied strings rendered into HTML/email.

---

## 10. Common tasks (recipes)

### Add a new CRM permission

1. Add the constant to `PERMS` in `crm/src/lib/roles.js` **and** the backend permission map.
2. Grant it to roles in the matrix.
3. Use `can(role, PERMS.X)` in the sidebar/router and `requirePerm(PERMS.X)` on the route.
4. Extend `backend/tests/permissions.parity.test.js`.
5. Verify by logging in as each role.

### Add a new layout family

1. Add the family + print size in `backend/server.js` (`LAYOUT_FAMILIES`) with a `base` price.
2. Mirror geometry in `crm/src/lib/layouts.js` (`arrange()` handles slot maths).
3. Seed templates (`seed_templates.js`) or create one in the CRM designer.
4. Rebuild snapshot; booths receive new coordinates on next revision bump.
5. Test a real print at the target size — coordinates that look right on screen can clip on paper.

### Add a new booth screen (Electron)

1. Add a screen id to the screen union in `App.tsx` / `types.ts`.
2. Create `screens/MyScreen.tsx` using `ScreenShell`.
3. Add transitions in the flow switch, and idle-reset behaviour if it is a guest screen.
4. Wire any data through `BoothContext` — not through ad-hoc props.
5. Verify with `npm run verify` and a browser-only run (`dev:react`).

### Add a database field

1. Add it to the Mongoose schema with a safe default.
2. Backfill existing rows with a script in `backend/scripts/`.
3. Never rename a field in place — add, dual-write, migrate, then remove.
4. Document it in [`BACKEND_API_DATABASE.md`](BACKEND_API_DATABASE.md).

### Rotate a credential

1. Create the new key at the provider.
2. Add it to the hosting environment (Vercel project settings) as a **new** variable if dual-running
   is required, else replace.
3. Redeploy; confirm boot logs and one live request.
4. Revoke the old key.
5. Update the handover register with the rotation date.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Missing required environment variables` on boot | `.env` missing keys | Fill `MONGODB_URI`, `JWT_SECRET`, `RAZORPAY_*`; the guard is intentional |
| `MongooseServerSelectionError: querySrv` | ISP DNS blocking Atlas SRV | `ENABLE_DNS_OVERRIDE=true`, or use a non-SRV connection string |
| CORS error in browser | Origin not in allowlist | Add origin to `staticAllowedOrigins` in `server.js` and redeploy |
| CRM logs in but every screen is empty | `VITE_MOCK=false` with no reachable API | Check `VITE_API_URL`; network tab should show `/api/...` 200 |
| CRM sidebar shows fewer items than expected | Role mismatch | Check the 5-role matrix; legacy role aliases are normalised in `roles.js` |
| `VITE_MOCK` still shows demo data in prod build | `VITE_MOCK=true` at build time | Rebuild with `VITE_MOCK=false`; mock code is excluded from the bundle |
| Booth pairing returns 404 | Event finished/paused, or code expired | Resume the event in CRM; re-read the pairing code |
| Booth gets `410 DEVICE_DELETED` | Device removed in CRM | Expected — the app wipes and re-pairs |
| Print does nothing on Windows | Printer name mismatch | `Get-Printer` → exact name → `HAPPYPIX_PRINTER_NAME` |
| Print does nothing on macOS | No CUPS queue | `lpstat -p` must list the printer as enabled/idle |
| Print succeeds but page is blank | `bitmapDataUrl` empty | Fixed by honesty rule — check renderer composite step |
| DNP media shows `null` | Driver/SDK not exposing counters | Expected on CUPS; install DNP Windows driver for full telemetry |
| Electron window shows white screen | Preload failed to compile | `npm run transpile:electron`; check `dist-electron/` |
| `contextBridge` undefined | Running renderer in a plain browser | Expected; guard bridge calls |
| Android build fails on Skia | RN/Skia version mismatch | Match `react-native 0.86` with `skia 2.6.x` |
| `adb dpm set-device-owner` fails | Account already on device | Factory reset, skip Google account, retry |
| Vite dev server not reachable from another machine | Bound to localhost | `--host 0.0.0.0` |
| Sharp install fails | Node ABI / missing build tools | Use Node 20/22 LTS; `npm rebuild sharp` |
| `npm ci` fails in electron | Lockfile drift | `npm install` once, commit `package-lock.json` |
| Typecheck passes locally, fails in CI | Stale `tsc -b` cache | `rm -rf *.tsbuildinfo dist-react dist-electron` then rebuild |

---

*Next: [`BACKEND_API_DATABASE.md`](BACKEND_API_DATABASE.md) for the API contract, or
[`OPERATIONS.md`](OPERATIONS.md) if you are on call.*
