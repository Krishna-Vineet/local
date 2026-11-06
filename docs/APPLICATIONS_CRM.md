# HappyPix — Application & CRM Documentation

> **Covers:** public website, website backend, CRM (platform + organization), Android booth,
> Electron booth, shared components and offline behaviour.
> **Companions:** [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`HARDWARE_PRINTING.md`](HARDWARE_PRINTING.md) · [`USER_ADMIN_GUIDE.md`](USER_ADMIN_GUIDE.md)
> **Last verified:** 2026-10-23, branch `main`.

---

## Table of contents

1. [Application map](#1-application-map)
2. [Public website](#2-public-website)
3. [Website backend](#3-website-backend)
4. [CRM — platform console](#4-crm--platform-console)
5. [CRM — organization workspace](#5-crm--organization-workspace)
6. [CRM architecture](#6-crm-architecture)
7. [Android booth application](#7-android-booth-application)
8. [Electron booth application](#8-electron-booth-application)
9. [Shared components and configuration](#9-shared-components-and-configuration)
10. [Offline behaviour, sync and recovery](#10-offline-behaviour-sync-and-recovery)
11. [Feature dependency matrix](#11-feature-dependency-matrix)

---

## 1. Application map

| App | Tech | Entry point | Deploy target | Primary user |
|---|---|---|---|---|
| Website | React 18 + Vite | `website/src/main.jsx` | Vercel static | Prospect, guest |
| Website backend | Express 5 | `website-backend/src/server.js` | Vercel serverless | Website |
| CRM | React 18 + Vite | `crm/src/main.jsx` | Vercel static | Owner, admins, operators |
| Android booth | RN 0.86 + XState | `client-app/apps/booth/index.js` | APK / Play Store | Booth operator (tablet) |
| Electron booth | Electron 44 + React 19 | `electron/src/electron/main.ts` | NSIS / DMG | Booth operator (PC) |

---

## 2. Public website

`/website` — marketing and the guest download portal. Static SPA, no auth.

### 2.1 Routes

| Route | Page | Purpose |
|---|---|---|
| `/` | `Home.jsx` | Hero, product story, social proof, primary CTA |
| `/software` | `Software.jsx` | Product features: CRM, booth app, AI templates, gallery |
| `/hardware` | `Hardware.jsx` | Recommended rigs: cameras, printers, tablets, PCs |
| `/pricing` | `Pricing.jsx` | Plan comparison, billing-period switch, add-ons, checkout |
| `/business` | `Business.jsx` | Partner / reseller / franchise pitch |
| `/contact` | `Contact.jsx` | Lead form → `POST /api/leads` |
| `/download/:id` | `Download.jsx` | **Guest portal** — 24-hour photo delivery |
| `/booth` | `Booth.jsx` | Booth mode landing / QR hand-off |

### 2.2 Pricing page behaviour

* Plans are fetched from `GET /api/plans`; nothing is hard-coded, so a CRM discount campaign shows
  up immediately.
* Four billing periods: monthly, quarterly, semi-annual, annual; the page displays the per-month
  equivalent and the total.
* GST 18% is added at checkout and shown as a separate line.
* Add-ons (₹249 each) are selectable and folded into the order.
* The selected period is persisted in the URL (`?billing=annual`) so a shared link keeps context.

Reference prices (INR, excluding GST) from `backend/services/planService.js`:

| Plan | Monthly | Quarterly | Semi-annual | Annual | Devices | Parallel events | AI credits |
|---|---|---|---|---|---|---|---|
| Free Trial (14 days) | 0 | — | — | — | 1 | 1 | 10 |
| Basic | 1,099 | 2,847 | 4,794 | 5,988 | 2 | 2 | 25 |
| Pro | 1,299 | 3,447 | 5,994 | 8,388 | 2 | 4 | 250 |
| Premium | 1,499 | 3,897 | 6,594 | 9,588 | 2 | 8 | 500 |
| Enterprise | custom | custom | custom | custom | 25 | 20 | 2,500 |

### 2.3 Checkout flow

```
Choose plan + period → POST /api/checkout/order
      → Razorpay Checkout (modal / UPI intent)
      → POST /api/checkout/verify (signature check)
      → organization + ORG_ADMIN user + subscription created
      → redirect to CRM with a first-login prompt
```

Failure after payment is treated as a support case: the Razorpay payment record is authoritative and
the org is provisioned manually if automatic provisioning fails. The page never silently swallows a
failed verification.

### 2.4 Guest download portal (`/download/:id`)

| Element | Behaviour |
|---|---|
| Hero | Event name + organization name from `GET /api/downloads/:id` |
| Composite | Large preview, primary "Download" button |
| Individual frames | Thumbnail grid, each downloadable |
| Expiry banner | "Available until <time>" derived from `expiresAt` |
| Expired state | Friendly explanation + "ask the operator" guidance (no error stack) |
| Share | Native share / copy link where supported |
| Tracking | `viewCount` increment on load, `downloadCount` on file fetch |

No login, no app install, no email capture required. This is a deliberate guest-experience decision.

---

## 3. Website backend

`/website-backend` — a deliberately small Express service so marketing traffic cannot affect booth
heartbeats.

| Module | File | Responsibility |
|---|---|---|
| Server | `src/server.js` | CORS, JSON limits, `/api` mount, error handler, startup env checks |
| Routes | `src/routes.js` | plans, checkout, downloads, internal downloads, leads |
| Pricing | `src/pricing.js` | Mirrors `planService.js`: billing prices, discounts, GST |
| Models | `src/models.js` | Read/write models over the shared database |
| Provisioning | `src/activate.js` | Creates org, user, subscription after verified payment |
| Storage | `src/s3.js` | Presigned GET for private buckets |

**Shared-database rule:** `MONGODB_URI` must be the same database as `backend/`. A mismatch produces
subscriptions the CRM cannot see — the most common deployment mistake. Startup logs the database
host so the mismatch is visible.

---

## 4. CRM — platform console

Visible to **Owner**, **Platform Admin**, **Support Manager** (permission matrix applies).

| Screen | Path | Purpose | Key actions |
|---|---|---|---|
| Platform Dashboard | `pages/platform/PlatformDashboard.jsx` | Platform health | KPIs, org growth, device online, support load |
| Platform Revenue | `PlatformRevenue.jsx` | Money | MRR, plan mix, refunds, per-org ledger |
| Organizations | `Organizations.jsx` | Tenancy | View, suspend, ban, restore (Owner) |
| Platform Support | `PlatformSupport.jsx` | Org → platform queue | Accept, deny, reply, resolve, reopen |
| Subscription Plans | `SubscriptionPlans.jsx` | Catalogue | Create/edit plans, add-ons, discount campaigns |
| Template Library | `Templates.jsx` | Global designs | Create, publish/unpublish, AI generate |
| Template Layouts | `TemplateLayouts.jsx` | Print geometry | Add/remove layout families |
| Gallery Settings | `GallerySettings.jsx` | Global policy | Consent requirement, watermark, retention |
| Team & Roles | `TeamAndRoles.jsx` | Internal staff | Invite, change role, deactivate |
| Audit & Logs | `AuditLogs.jsx` | Forensics | Filter by actor, action, org, date |
| Website Leads | `WebsiteLeads.jsx` | Sales | Status pipeline, notes, assignment |

### 4.1 Organizations screen (the most consequential screen)

| Action | Permission | Effect |
|---|---|---|
| View list/detail | `PLATFORM_ORGS_VIEW` | Read-only |
| Suspend | Owner only | Booths locked on next heartbeat; mutations blocked; reads preserved |
| Ban | Owner only | Same, plus flagged as fraud/abuse; login refused |
| Restore | Owner only | Clears flag; booths unlock on next heartbeat |

Every action requires a reason (stored in `suspendReason`, shown to the tenant) and writes an audit
row with actor, IP and timestamp.

### 4.2 Subscription Plans screen

* Edit list price, per-period prices, device/event/credit entitlements.
* Discount campaign fields: type (percent/flat), value, start/end window, max redemptions, label.
* Plans cannot be hard-deleted while any subscription references them — archive instead.
* Edits take effect immediately on the website (both read the same catalogue).

### 4.3 Template Library

| Capability | Detail |
|---|---|
| List global templates | Layout family, slot count, source (designer/playground/AI), active state |
| Create / edit | Opens the designer (`src/templates/designer`) |
| Publish gate | `active: false` hides a template from all booths on next revision bump |
| AI generate | Prompt → Groq classification → FLUX background → editable design |
| Orphans | Deleting a template used by an event is blocked; unpublish instead |

---

## 5. CRM — organization workspace

Visible to **Org Admin** (all) and **Org Manager** (operations only).

| Screen | Path | Org Admin | Org Manager |
|---|---|---|---|
| Org Dashboard | `org/OrgDashboard.jsx` | ✅ | ✅ |
| Org Revenue | `OrgRevenue.jsx` | ✅ | ❌ |
| Events & Devices | `EventsDevices.jsx` | ✅ | ✅ |
| Gallery | `Gallery.jsx` | ✅ | ✅ |
| Guest Support | `Support.jsx` | ✅ | ✅ |
| HappyPix Support | `PlatformSupport.jsx` | ✅ | ✅ |
| Organization Defaults | `OrgDefaults.jsx` | edit | read-only |
| Coupons | `Coupons.jsx` | ✅ | ❌ |
| Team | `Team.jsx` | ✅ | ❌ |
| Templates (org AI) | `OrgTemplates.jsx`, `OrgCustomTemplates.jsx` | ✅ | view |
| Audit | (org scope) | ✅ | ❌ |

### 5.1 Events & Devices

**Event fields**

| Field | Required | Notes |
|---|---|---|
| Name | ✅ | Shown on the booth entry screen |
| Client name | — | Internal reference |
| Location | — | Venue |
| Start / end date-time | ✅ | Drives `upcoming → live → finished` |
| Templates | ✅ (≥1) | Only these are usable at this event |
| Filters | — | Subset of original/warm/cool/bw/vintage/soft/party |
| Digital copy | — | Enables the 24 h QR download |
| Layout prices | — | Overrides; auto-filled from defaults |
| Branding | — | Logo, tagline, up to 15 sponsor logos |

**Device panel** shows for each booth: name, location, assigned event, online/offline, last seen,
platform, app version, and telemetry (camera connected/working/model/battery, printer
connected/status/paper/ribbon/queue). It is the first place an operator looks when a booth misbehaves.

### 5.2 Gallery

* Grouped **one row per session**, cover = `compositeUrl || url`.
* Filters: event, date range, search by session id.
* Click → full-size viewer with individual frames of the same session.
* Download → presigned redirect (never a public URL).
* Bulk actions are limited by design (delete requires confirmation + audit).

> This grouping is why the booth must upload the final composite. A 3-slot template with only raw
> frames shows one frame as the cover — the exact bug fixed on 2026-10-23.

### 5.3 Organization Defaults

| Group | Fields |
|---|---|
| Branding | Org name, logo, tagline |
| Money | Per-layout prices, UPI id, payout mode (`upi`/`wallet`), display name |
| Gateway | Razorpay key id/secret (per-org, encrypted at rest) |
| Booth behaviour | Idle timeout (10–86400 s), QR timeout (1–30 min) |
| Content | Default filters, sponsor logos (≤15) |

Changing defaults affects **future** events only. Existing events keep their frozen snapshot. This is
shown explicitly in the UI ("applies to new events").

### 5.4 Coupons

| Field | Notes |
|---|---|
| Code | Uppercase, unique per org |
| Type | percentage / fixed |
| Value | % or ₹ |
| Min spend | Optional floor |
| Max discount | Caps a percentage coupon |
| Quantity / used | Redemption accounting |
| Valid window | from/until |
| Status | active / paused / expired |

Validation happens server-side at quote time (`POST /api/org/coupons/validate` and, in the booth,
`POST /api/booth/checkout/quote` with `couponCode`). The booth never computes a discount locally.

### 5.5 Team

Org Admin can invite `ORG_MANAGER`s, deactivate them, and change roles. Deactivation is instant
(middleware checks `user.status`), but their sessions are not force-revoked — a known limitation;
the token expires within 8 hours.

### 5.6 Guest Support

Tickets raised from the success screen, with the full context attached: event, device, session,
payment reference, and whether photos are held. Replies notify the guest by email if an address was
provided. Resolving sets `status: resolved` and releases any photo hold.

### 5.7 Revenue and wallet

* Session revenue by event/day/layout.
* Print counts, free vs paid split.
* Wallet balance and withdrawal requests (payout mode `wallet`).
* Settlement mode `upi` sends money directly to the org's UPI id at the booth — the platform records
  the payment for reporting but does not hold funds.

---

## 6. CRM architecture

### 6.1 Layer diagram

```
pages/*  ──►  components/*  ──►  lib/format, lib/icons
   │
   ├──► context/AppContext (session, org, toasts, theme)
   ├──► lib/router.jsx  (push-state, role-guarded)
   └──► api/client.js   ──►  mock server (VITE_MOCK=true)
                        └─►  fetch → main API (JWT)
```

### 6.2 The permission matrix

`src/lib/roles.js` exports `ROLES`, `PERMS`, `can(role, perm)`, `normalizeRole()`, and the sidebar
definition. Rules:

1. **No permission editor** in the product — the matrix is code, reviewed by humans.
2. Legacy role strings are normalised (`SUPER_ADMIN → OWNER`, `CLIENT → ORG_ADMIN`, …) so an old
   record never causes a false "role does not permit this".
3. The same constants drive nav, routing and API guards.

### 6.3 The mock backend

`src/api/mock/server.js` implements the full v2 contract in-browser with seeded data persisted to
`localStorage` under `happypix_crm_v2_db`. It exists so:

* sales can demo without a backend;
* UI work is not blocked by API availability;
* contract tests (`scripts/api-smoke.mjs`) run in CI.

When `VITE_MOCK=false`, the mock module is **not bundled at all** — no demo code ships to production.

Seeded organizations exercise every plan state: active, trial, expiring in 11 days, expired,
suspended (billing dispute), banned (fraud).

### 6.4 Design system

No Tailwind, no Bootstrap, no component library. Charts, icons and frames are hand-rolled SVG/CSS.
Consequences (all intentional):

* bundle size stays small and load is instant on a 3G venue connection;
* no dependency churn or supply-chain surface;
* every visual detail is under our control;
* cost: designers cannot use a component marketplace, and new UI needs code.

### 6.5 Router

`lib/router.jsx` is a small push-state router with hash fallback (`hashchange` listener) so the app
works when hosted on a static host without rewrite rules. Forbidden paths redirect to the role's home
rather than rendering an empty shell.

---

## 7. Android booth application

`/client-app` — React Native monorepo (pnpm + Turborepo).

### 7.1 Packages

| Package | Responsibility |
|---|---|
| `@happypix/types` | Shared DTOs, layout types, pricing types |
| `@happypix/api` | Typed client: auth, bootstrap, heartbeat, quote, payments, sessions |
| `@happypix/state-machine` | XState `boothMachine` — the only place flow logic lives |
| `@happypix/camera-core` | `CameraManager` + Canon CCAPI / Phone / Sony / PTP providers |
| `@happypix/printer-core` | `PrinterManager`, `RenderEngine` (Skia), IPP / DNP providers |
| `@happypix/kiosk-core` | Kotlin native module: lock task mode, device owner |
| `@happypix/ui` | Screens, `TemplateCanvas`, controls, theme, pricing helpers |

### 7.2 Screens

| Screen | Purpose |
|---|---|
| `StartScreen` | Attract loop / touch to begin |
| `LayoutSelectionScreen` | Print family + slot count |
| `SlotSelectionScreen` | Which slot layout |
| `PrintCountScreen` | Copies |
| `PaymentScreen` | UPI/card, polling, coupon entry |
| `CaptureScreen` | Countdown, live preview, retake |
| `PhotoSelectionScreen` | Choose frames per slot |
| `CustomizeScreen` | Filters, stickers, ornaments |
| `OrderSuccessScreen` | Print status, QR, category chips, raise issue |
| `WaitingScreen` | Between-session idle state |
| `LoginScreen` | Pairing (6-digit code / credentials) |

### 7.3 State machine

```
idle
 └─► layout_select ─► slot_select ─► print_count ─► payment
                                                     │
                                        ┌────────────┴────────────┐
                                        ▼                         ▼
                                    (free / paid)            payment_failed
                                        │
                                        ▼
                                    countdown ─► capturing ─► photo_select
                                                                  │
                                                                  ▼
                                                             customize
                                                                  │
                                                                  ▼
                                                             compositing
                                                                  │
                                                                  ▼
                                                              printing
                                                                  │
                                                                  ▼
                                                              success ─► idle
```

Invalid transitions (e.g. capture before payment) are structurally impossible. Timers are part of
the machine, so a timeout cannot leave a half-paid session in limbo.

### 7.4 Native modules

| Module | Platform | Notes |
|---|---|---|
| VisionCamera | Android **and iPadOS** | Device camera; front camera preferred for a booth |
| Canon CCAPI | Android, iPad (same TS provider) | HTTP REST over Wi-Fi, no native SDK; untested on iPad |
| IPP printer | Android | Raw IPP over TCP 631; the request body is not RFC-complete, so real printers reject it |
| Print Bridge (DNP) | Android, iPad | Posts the composite to the Electron app's `:9123` server on the same LAN — **the only working iPad print path** |
| AirPrint | iPad | `AirPrintProvider` is a stub; a native `UIPrintInteractionController` bridge is still to be written |
| Kiosk (Kotlin) | Android | `DeviceAdminReceiver`, lock task allowlist |
| Kiosk lockdown | iPad | No native module — Guided Access or MDM Single App Mode |
| Zeroconf | dependency present, unused | mDNS printer/camera discovery; needs `NSBonjourServices` to work on iPad |
| Skia | Android **and iPadOS** | Compositing and filters |

### 7.5 Build and deployment

Android:

```bash
pnpm install
pnpm --filter com.happypix.booth android       # dev on device
pnpm build:apk                                  # debug APK
pnpm build:apk:release                          # signed release
adb shell dpm set-device-owner com.happypix.booth/.kiosk.KioskAdminReceiver
```

Kiosk provisioning requires a **factory-reset device with no Google account** — Android refuses
device-owner assignment otherwise. This is an OS rule, not a HappyPix limitation.

iPad (macOS build host only):

```bash
cd client-app/apps/booth
bundle install && (cd ios && bundle exec pod install)
pnpm ios --simulator "iPad Pro 13-inch (M4)"
pnpm ios --device
```

### 7.6 iPadOS status

**The target exists and the guest session runs.** `client-app/apps/booth/ios` contains a real Xcode
project — `booth.xcodeproj`, `Podfile`, `AppDelegate.swift` (RN 0.86 `RCTReactNativeFactory`),
`Info.plist`, `PrivacyInfo.xcprivacy`, launch storyboard — with `TARGETED_DEVICE_FAMILY = "1,2"`,
iPadOS 15.1 deployment and all four iPad orientations declared. All 11 screens, `BoothProvider`, the
API client, Skia compositing and the UPI-QR payment path are shared with Android and are platform
neutral.

What is **not** iPad-ready is everything that turns a tablet into a booth appliance:

* **Printing** — AirPrint is a stub and the IPP client sends an incomplete request, so the only
  working path is the Electron **Print Bridge** on a PC in the same LAN.
* **Kiosk lockdown** — no Swift module; use Guided Access or MDM Single App Mode.
* **Keep-awake and sounds** — both call Android-only native modules and silently do nothing.
* **Safe areas, app icons, signing/TestFlight** — see the findings table.

Full detail, with file-and-line findings, the lockdown recipe, the print path decision and a QA
checklist: [`IPAD_SUPPORT.md`](IPAD_SUPPORT.md).

---

## 8. Electron booth application

`/electron` — Electron 44 + React 19 + Vite 7.

### 8.1 Process split

```
┌─────────────────────────── MAIN PROCESS (Node) ───────────────────────────┐
│ main.ts        windows, displays, IPC handlers, media permissions         │
│ hardware.ts    printer discovery, snapshot, print dispatch                │
│ dnpTelemetry   CyStat64.dll (Windows) / CUPS (macOS)                      │
│ printServer.ts LAN bridge :9123 for tablets                               │
│ store.ts       installation identity + counters (JSON)                    │
└───────────────────────────────▲───────────────────────────────────────────┘
                                │ ipcMain.handle / ipcRenderer.invoke
┌───────────────────────────────┴───────────────────────────────────────────┐
│ preload.cts  →  window.booth { getInstallation, saveInstallation,          │
│                 systemSnapshot, print, reportCamera, recordCapture }       │
└───────────────────────────────▲───────────────────────────────────────────┘
                                │ typed bridge (services/bridge.ts)
┌───────────────────────────────┴───────────────────────────────────────────┐
│ RENDERER (React 19)  App.tsx → screens → services/api → backend           │
└───────────────────────────────────────────────────────────────────────────┘
```

`contextIsolation: true`, `nodeIntegration: false`. The renderer cannot read files, spawn processes
or reach the network outside `fetch`.

### 8.2 Screens and flow

| Screen | File | Purpose |
|---|---|---|
| Connection | `ConnectionScreens.tsx` | Boot state, pairing, offline notice |
| Entry | `ChoiceScreens.tsx` | Event details form (org name, logo, event name, sponsor logos, event type) + Start |
| Orientation / template | `ChoiceScreens.tsx` | Portrait/landscape, layout family, price |
| Print count | `ChoiceScreens.tsx` | Copies |
| Payment | `PaymentScreen.tsx` | UPI QR, polling, coupon |
| Camera | `CameraScreen.tsx` | Countdown, live preview, capture per slot, retake |
| Photo selection | `PhotoSelectionScreen.tsx` | Assign frames to slots (tappable cards) |
| Customize | `CustomizeScreen.tsx` | Filters, stickers, ornaments, branding preview |
| Success | `SuccessScreen.tsx` | Print result, QR, issue modal with category chips |

**Entry screen design rule (product constraint):** the booth starts directly at the event details
form. It is **not** another marketing site — no hero, no pricing page, no feature grid. The operator
sees org name, org logo, event name, template logos, event type, and **Start Session**.

### 8.3 IPC surface

| Channel | Direction | Purpose |
|---|---|---|
| `booth:getInstallation` | invoke | Read device UUID/token/location |
| `booth:saveInstallation` | invoke | Persist after pairing |
| `booth:system-snapshot` | invoke | `hardwareSnapshot()` for heartbeat/UI |
| `booth:print` | invoke | Print a rendered bitmap |
| `booth:camera-report` | send | Renderer → main: camera telemetry |
| `booth:record-capture` | invoke | Increment shutter counter |

Each handler validates its payload; unknown channels are not exposed.

### 8.4 Hardware integration

Full detail in [`HARDWARE_PRINTING.md`](HARDWARE_PRINTING.md). Summary:

| Capability | Windows | macOS | Linux |
|---|---|---|---|
| Printer discovery | `Get-Printer` (+ `wmic` fallback) | `lpstat -e/-p` | `lpstat` |
| Print dispatch | PowerShell `PrintDocument` | `lp` | `lp` |
| Orientation | `DefaultPageSettings.Landscape` | `-o orientation-requested` | same |
| Quality | `PrinterResolution.Kind` | `-o print-quality` | same |
| Queue depth | `Get-PrintJob` | `lpstat -o` | `lpstat -o` |
| Media counters | DNP `CyStat64.dll` → WMI fallback | CUPS (often `null`) | CUPS |
| Camera | `getUserMedia` (UVC) | `getUserMedia` | `getUserMedia` |

### 8.5 Print bridge (`printServer.ts`)

An HTTP server on `0.0.0.0:9123` lets an Android/iPad booth on the same LAN print through the PC's
printer:

```
GET  /api/status   → { printers, dnp, defaultPrinter }
POST /api/print    → { bitmapDataUrl, copies, layoutId }  (50 MB limit)
```

It is LAN-scoped and unauthenticated by design (a venue LAN with no internet), documented as a
deliberate trade-off: do not expose port 9123 to the internet.

### 8.6 Session orchestration (`App.tsx`)

`finishAndPrint()` is the highest-risk function in the app:

1. Render the final composite from the selected frames, layout, filter, ornaments and branding.
2. Request print (with a 15 s timeout race) — never block the guest forever.
3. Upload individuals **and** the composite to S3.
4. `POST /api/booth/sessions/complete` with `photos: [...individuals, { url: compositeUrl, isComposite: true }]`
   **and** top-level `compositeUrl`.
5. Render the QR from `shareUrl` (fall back to a locally built URL if the response is late).
6. Show print outcome honestly; offer issue-raising.

---

## 9. Shared components and configuration

### 9.1 Layout geometry (all clients)

`backend/config/layouts.js` + `crm/src/lib/layouts.js` + `client-app/packages/ui/src/utils` +
`electron/src/ui/utils` share the same model:

| Constant | Value | Meaning |
|---|---|---|
| `UNIT` | 250 | Canvas units per inch (4×6 in → 1000×1500) |
| `FOOTER_RATIO` | 0.15 | Bottom band reserved for branding |
| Slot rect | `{x, y, w, h}` | Normalised 0..1 within the usable area |

Print families:

| Family | Name | Sheet | Slots available |
|---|---|---|---|
| `46` | Standard Postcard | 4×6 | 1, 2, 3, 4, 5, 6, 8 |
| `46-26` | Classic Duo Strip | 4×6 | 2, 3, 4 |
| `46-23` | Pocket Polaroid | 4×6 | 1, 2 |
| `57` | Portrait Keep-Safe | 5×7 | 1, 2, 3, 4, 5, 6, 8 |
| `57-257` | Bookmark Strip | 5×7 | 2, 3, 4 |
| `68` | Gala Display | 6×8 | 1, 2, 3, 4, 5, 6, 8 |
| `68-26` | Triple Gala Strip | 6×8 | 2, 3, 4 |
| `68-38` | Custom Bookmark | 6×8 | 2, 3, 4 |
| `68-46` | Double Postcard Cut | 6×8 | 1, 2, 3, 4 |
| `810` | Grand Guestbook Print | 8×10 | 1, 2, 3, 4, 5, 6, 8, 9 |
| `810-210` | Collector Strip | 8×10 | 2, 3, 4, 5 |
| `810-258` | Wide Strip Cut | 8×10 | 2, 3, 4 |
| `810-410` | Panoramic Mini | 8×10 | 2, 3, 4 |
| `812` | Poster Showcase | 8×12 | 1, 2, 3, 4, 5, 6, 8 |
| `812-412` | Panoramic Wide | 8×12 | 3, 4, 5 |
| `812-68` | Quad Strip Reel | 8×12 | 2, 3, 4 |

### 9.2 Filters

| Key | Effect |
|---|---|
| `original` | None |
| `warm` | +saturation, +warmth |
| `cool` | −temperature, slight contrast |
| `bw` | Grayscale + contrast |
| `vintage` | Sepia + soft contrast + vignette |
| `soft` | Blur-glow / beauty |
| `party` | Saturated, high-contrast, colour-boost |

Implementation differs per renderer (CSS filter on Canvas 2D/Skia `ColorMatrix`, Sharp on the server)
but the visual intent is shared. A filter must look acceptably similar in preview and print — they
are tuned together.

### 9.3 Pricing vocabulary

A price key is `"<familyId>:<slots>"` (e.g. `46:3`). Resolution chain:

```
event.layoutPrices[key]
  → organizationdefaults.layoutPrices[key]
    → platform suggested (family.base + 10 × (slots − 1))
```

Suggested bases: `46` → 30, `57` → 50, `68` → 60, `810` → 80, `812` → 90 (INR per sheet).

### 9.4 Branding

* Org logo, tagline, up to 15 sponsor logos.
* Rendered in the reserved 15% footer, never overlapped by photos.
* Logos are fetched through `asset-proxy` (or presigned) so canvas export is not tainted.

### 9.5 Configuration surfaces

| Config | Where | Applies to |
|---|---|---|
| Global gallery/consent | CRM → Platform → Gallery Settings | All orgs |
| Plan entitlements | CRM → Platform → Subscription Plans | All orgs |
| Global templates | CRM → Platform → Template Library | All orgs |
| Org defaults | CRM → Org → Defaults | Future events of one org |
| Event overrides | CRM → Org → Events | One event |
| Device identity | Booth pairing | One device |
| Local env | `.env` per app | One deployment |

---

## 10. Offline behaviour, sync and recovery

### 10.1 What works with no internet

| Capability | Offline? | Notes |
|---|---|---|
| Show event branding/templates | ✅ | From cached snapshot |
| Capture photos | ✅ | Local camera |
| Compose/customise | ✅ | Local renderer |
| Print | ✅ | Local spooler/CUPS |
| Local currency math | ✅ | Priced from snapshot |
| Take payment | ⚠️ | UPI QR can render; confirmation requires network unless pre-authorised |
| Upload photos | ❌ | Queued |
| Guest QR download | ⚠️ | QR renders from a local fallback URL; file available after sync |

### 10.2 Queue and retry

**Android** — `offlineSyncService.ts`:
1. Session completes → record written to AsyncStorage with a status queue.
2. Upload attempts run with exponential backoff (5 s → 15 s → 60 s → 5 min).
3. On success: mark synced, discard local blobs (configurable retention).
4. On permanent failure (4xx other than 401/410): keep the record, surface in diagnostics.

**Electron** — `services/cache.ts` + `store.ts`:
1. Snapshot cached on disk with its revision.
2. Completed sessions queued in the userData directory.
3. Retry on heartbeat success and on app start.
4. Counters (`printsTotal`, `shutterCount`) persist across restarts so telemetry does not reset.

### 10.3 Conflict handling

* A snapshot is only replaced when its `revision` differs and is fetched completely — never a
  partial merge.
* Session uploads are idempotent by `sessionId`; a retry after partial success cannot duplicate
  gallery rows.
* If an event is paused or deleted while a booth is offline, the next heartbeat returns
  `invalidateCache: true` and the booth blocks new sessions.

### 10.4 Recovery procedures

| Situation | Procedure |
|---|---|
| Booth crashed mid-session | Restart; the app resumes idle. Un-uploaded session is retried from the queue |
| Tablet replaced | Pair the new device; delete the old one in CRM (it returns `410` if it ever reconnects) |
| Event ended, photos still queued | Keep the device online on any network; sync completes. Do not wipe the app |
| Snapshot corrupt | Delete local cache; next bootstrap re-downloads (requires network) |
| Printer jam mid-print | Guest sees "Print failed", retries after clearing; no duplicate charge because payment is per session |
| Wrong event assigned | Reassign in CRM → heartbeat invalidates → booth reloads |

---

## 11. Feature dependency matrix

| Feature | Backend | CRM | Website | Android | Electron |
|---|---|---|---|---|---|
| Plan checkout | plans + subscription | displays | ✅ checkout | — | — |
| Event creation | events | ✅ | — | — | — |
| Template sync | snapshot service | ✅ | — | ✅ | ✅ |
| Pricing | quote/price engine | ✅ defaults | ✅ plan prices | ✅ | ✅ |
| Coupons | coupon service | ✅ | — | ✅ | ✅ |
| Payments | Razorpay/Cashfree | revenue | subscriptions | ✅ | ✅ |
| Capture | — | — | — | ✅ | ✅ |
| Composite + filters | Sharp (server path) | preview | — | Skia | Canvas 2D |
| Printing | — | telemetry | — | IPP/DNP | Spooler/CUPS |
| S3 upload | sessions/complete | gallery | preview | ✅ | ✅ |
| Guest QR | guestdownloads | — | ✅ portal | ✅ | ✅ |
| Issue raising | supporttickets | guest support | — | ✅ | ✅ |
| AI templates | ai services | ✅ | — | — | — |
| Telemetry | heartbeat | device panel | — | partial | ✅ |
| Offline | snapshot | — | — | ✅ | ✅ |
| Kiosk lock | — | — | — | Android device owner | BrowserWindow kiosk |

---

*Next: [`HARDWARE_PRINTING.md`](HARDWARE_PRINTING.md) for device compatibility, or
[`USER_ADMIN_GUIDE.md`](USER_ADMIN_GUIDE.md) for the operational walkthrough.*
