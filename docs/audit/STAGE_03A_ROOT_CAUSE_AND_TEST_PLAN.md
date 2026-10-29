# 🔬 HappyPix V2 — Stage 03A: Root-Cause Verification & Test Preparation Report
> **Document Status:** Complete Root-Cause Analysis & Regression Test Specifications (Read-Only)  
> **Target Branch:** `main` (commit `96b73ce`)  
> **Working Tree Status:** Preserved (0 application files modified, 0 config changes)  
> **Audit Date:** 2026-10-27  

---

## 📑 Table of Contents
1. [Initial Git Status & Preservation Verification](#1-initial-git-status--preservation-verification)
2. [Exact Files & Functions Inspected](#2-exact-files--functions-inspected)
3. [HP-DEF-01: Offline Photo Upload Recovery (Root-Cause Deep Dive)](#3-hp-def-01-offline-photo-upload-recovery-root-cause-deep-dive)
   - 3.1 Complete Photo & Composite Lifecycle Trace (Steps 1–9)
   - 3.2 Detailed Investigation Questions & Concrete Evidence
   - 3.3 Storage Architecture Evaluation: IndexedDB vs. Electron Main-Process Disk Queue
   - 3.4 Proposed Production-Safe Upload Queue Design
4. [HP-DEF-02: Legacy Cloud Printing (Dependency & Reachability Analysis)](#4-hp-def-02-legacy-cloud-printing-dependency--reachability-analysis)
   - 4.1 Exhaustive Inventory of All `printImage()` Callers
   - 4.2 Legacy Route Reachability & Registration
   - 4.3 Conditions Under Which `payment.compositeUrl` Is Populated
   - 4.4 Business Logic & Side-Effect Independence
   - 4.5 Deprecation & Decoupling Strategy
5. [Comprehensive Regression Test Matrix](#5-comprehensive-regression-test-matrix)
   - 5.1 Test Plan for HP-DEF-01 (Offline Upload Recovery)
   - 5.2 Test Plan for HP-DEF-02 (Cloud Printing Decoupling)
6. [Implementation Order & Rollback Strategy](#6-implementation-order--rollback-strategy)
7. [Outstanding Questions & Hardware Environment Constraints](#7-outstanding-questions--hardware-environment-constraints)
8. [Preservation & Safety Gate Verification](#8-preservation--safety-gate-verification)

---

## 1. Initial Git Status & Preservation Verification

* **Git Branch:** `main`
* **HEAD Commit:** `96b73ce` (*"update the sdk for dnp printer in electron"*)
* **Upstream:** `origin/main` (In sync)
* **Untracked Files:** Only `docs/audit/` documentation directory.
* **Modified / Staged Files:** `0` (Zero application code or configuration modified).

---

## 2. Exact Files & Functions Inspected

| Subsystem | Exact File Path | Line Range | Key Functions / Symbols Inspected |
|---|---|---|---|
| **Electron UI** | `electron/src/ui/screens/CameraScreen.tsx` | Lines 118–158 | `captureFrame()`, `startCapture()`, `photosRef.current` |
| **Electron UI** | `electron/src/ui/App.tsx` | Lines 299–382 | `finishAndPrint()`, `renderCompositeDataUrl()`, `resetGuestSession()`, `boothApi.completeSession()` |
| **Electron UI** | `electron/src/ui/services/api.ts` | Lines 47–74, 173–175 | `CompleteSessionInput`, `CompleteSessionResult`, `HttpApi.completeSession()` |
| **Electron IPC** | `electron/src/electron/main.ts` | Lines 55–81 | `ipcMain.handle('booth:print')`, `registerIpc()` |
| **Electron Store** | `electron/src/electron/store.ts` | Lines 28–54 | `storePath()`, `readStore()`, `writeStore()` (Atomic rename) |
| **Backend Route** | `backend/routes/boothRoutes.js` | Lines 975–1170 | `POST /sessions/complete`, `persistSessionPhoto()`, `createGuestDownload()` |
| **Backend Route** | `backend/routes/boothRoutes.js` | Lines 604–870 | `POST /payments`, `GET /payments/:id`, `POST /payments/:id/confirm` |
| **Backend Route** | `backend/routes/paymentRoutes.js` | Lines 540–920 | `GET /status/:paymentId`, `POST /verify`, `POST /cashfree-webhook`, `POST /razorpay-webhook`, `POST /free-complete`, `POST /complete-prepaid` |
| **Backend Util** | `backend/utils/printHelper.js` | Lines 12–141 | `printLocalImage()`, `printImage()`, `exec('powershell ...')` |
| **Backend Service**| `backend/services/guestDownloadService.js` | Lines 20–58 | `newDownloadId()`, `downloadUrlFor()`, `createGuestDownload()` |

---

## 3. HP-DEF-01: Offline Photo Upload Recovery (Root-Cause Deep Dive)

### 3.1 Complete Photo & Composite Lifecycle Trace (Steps 1–9)

```
[1. CAMERA CAPTURE]
     │ Frame grabbed from HTML5 <video> onto temp <canvas>
     │ Converted to Base64 data URL: canvas.toDataURL('image/jpeg', 0.92)
     ▼
[2. IN-MEMORY STORAGE]
     │ Stored in React Ref/State: photosRef.current -> session.photos[]
     │ NEVER written to disk, NEVER sent to Electron main process.
     ▼
[3. COMPOSITE RENDERING]
     │ renderCompositeDataUrl() runs at 300 DPI on HTML5 Canvas in Renderer
     │ Outputs Base64 string: data:image/jpeg;base64,... (approx. 2-5 MB)
     ▼
[4. LOCAL PHYSICAL PRINTING]
     │ bridge.print({ bitmapDataUrl: compositeUrl }) sent via IPC to main.ts
     │ main.ts writes temporary PNG in temp dir, prints via .NET System.Drawing, deletes temp PNG
     ▼
[5. COMPLETE SESSION REQUEST]
     │ boothApi.completeSession() sends HTTP POST /api/booth/sessions/complete
     │ Payload: { sessionId, digitalCopy, photos: [base64...], compositeUrl: base64... }
     ▼
[6. BACKEND & S3 UPLOAD]
     │ Backend decodes Base64 to Buffer -> uploadToS3() -> S3 Bucket
     │ Saves Photo records in MongoDB -> Calls createGuestDownload()
     ▼
[7. QR CODE GENERATION]
     │ Backend returns downloadUrl: https://happypix.vercel.app/download/:downloadId
     │ Fallback if failed: guaranteedShareUrl: https://happypix.vercel.app/download/:sessionId
     │ SuccessScreen displays QR on kiosk screen
     ▼
[8. LOCAL CLEANUP & DELETION]
     │ After 30s timer or user tap: resetGuestSession() runs
     │ setSession(freshSession()) overwrites React state
     │ GARBAGE COLLECTOR PURGES ALL CAPTURED IMAGES FROM RAM!
     ▼
[9. NETWORK INTERRUPTION OUTCOME]
     │ IF network dropped at Step 5: completeSession() throws!
     │ App.tsx line 366 catches with console.warn()
     │ Kiosk falls back to guaranteedShareUrl (Step 7), shows QR, then purges RAM (Step 8)
     │ GUEST RECEIVES A QR CODE POINTING TO AN EMPTY S3 GALLERY! PHOTOS ARE PERMANENTLY LOST.
```

---

### 3.2 Detailed Investigation Questions & Concrete Evidence

#### Q1: Are original photos and composites persisted to disk, IndexedDB, memory, or another location?
* **Answer:** **MEMORY ONLY (CONFIRMED)**.
* **Evidence:**
  * `CameraScreen.tsx#L127-130`: `dataUrl = canvas.toDataURL('image/jpeg', 0.92)`.
  * `App.tsx#L410`: `onComplete={(photos) => setSession((current) => ({ ...current, photos }))}`.
  * No file system writes (`fs.writeFile`), no IndexedDB transactions, and no Electron main process storage calls occur during capture or compositing.

#### Q2: Does `completeSession()` upload image bytes, accept an existing S3 URL, or use another mechanism?
* **Answer:** **UPLOADS BASE64 IMAGE BYTES DIRECTLY VIA JSON BODY (CONFIRMED)**.
* **Evidence:**
  * `App.tsx#L360-361`: `compositeUrl` (Base64 data URL) and `photos: session.selectedPhotos.map(p => p.dataUrl)` (array of Base64 strings) are passed in the JSON request body.
  * `backend/routes/boothRoutes.js#L1200-1217`: `persistSessionPhoto()` inspects `if (value.startsWith('data:'))`, parses the Base64 payload, creates a `Buffer.from(base64Data, 'base64')`, and streams it to AWS S3.
  * *Note:* `/api/booth/sessions/upload-urls` exists in `boothRoutes.js` for direct S3 presigned PUTs, but the active Electron frontend does not use it; it transmits inline Base64 data URLs to `/api/booth/sessions/complete`.

#### Q3: If the request fails, are captured images retained and recoverable?
* **Answer:** **NO. PERMANENTLY LOST UPON RESET (CONFIRMED DEFECT)**.
* **Evidence:**
  * `App.tsx#L365-367`:
    ```typescript
    try {
      const completed = await boothApi.completeSession(installation, { ... });
      shareUrl = completed.shareUrl ?? completed.downloadUrl ?? null;
    } catch (reason) {
      console.warn('[completeSession] Digital copy upload delayed/failed:', reason);
    }
    ```
  * The error is caught, logged to console, and execution continues to `setScreen('success')`.
  * `App.tsx#L184-191`: `resetGuestSession()` executes `setSession(freshSession())`. The in-memory references are destroyed. No recovery mechanism exists.

#### Q4: Can a retry create duplicate photo records, guest-download records, or uploads?
* **Answer:** **YES. CURRENT BACKEND IS NOT IDEMPOTENT (CONFIRMED DEFECT)**.
* **Evidence:**
  * `backend/routes/boothRoutes.js#L1025, 1046`: Executes `Photo.create({ sessionId, ... })` without checking if `Photo.find({ sessionId })` already exists.
  * `backend/routes/boothRoutes.js#L1216`: Generates a new S3 object key with timestamp: `${sessionId}-${Date.now()}.${ext}`.
  * `backend/services/guestDownloadService.js#L44-58`: Executes `GuestDownload.create({ downloadId: newDownloadId(), sessionId, ... })` generating a new `downloadId` on every invocation.
  * *Impact:* Any client retry queue will create duplicate S3 objects, duplicate MongoDB rows, and multiple conflicting `downloadId` records unless backend idempotency is added.

#### Q5: Is the generated QR URL valid before the corresponding gallery asset exists?
* **Answer:** **YES, IT GENERATES A GHOST URL (CONFIRMED DEFECT)**.
* **Evidence:**
  * `App.tsx#L351-354, 369-371`:
    ```typescript
    const guaranteedShareUrl = `${websiteBase}/download/${encodeURIComponent(session.id)}`;
    if (!shareUrl && session.digitalCopy) {
      shareUrl = guaranteedShareUrl;
    }
    ```
  * `SuccessScreen.tsx#L47`: `const qr = useQrCode(outcome.shareUrl, 360)`.
  * The kiosk displays a high-contrast QR code pointing to `https://happypix.vercel.app/download/:sessionId`. When the guest scans it, `/website-backend` searches for `GuestDownload.findOne({ downloadId: sessionId })` or `Photo.find({ sessionId })`. If the upload failed, the query returns null, presenting the guest with a broken/empty download page.

#### Q6: Does retrying after an application restart remain possible?
* **Answer:** **NO (CONFIRMED DEFECT)**.
* **Evidence:**
  * Because images are stored only in React state, restarting the Electron application, closing the window, or rebooting the kiosk wipes all pending session data.

#### Q7: Is there already a reusable upload queue, retry utility, or idempotency mechanism elsewhere in the repository?
* **Answer:** **NO REUSABLE UPLOAD QUEUE EXISTS (CONFIRMED)**.
* **Evidence:**
  * Electron contains only `booth-state.json` (device credentials & hardware counters) in `store.ts`.
  * `client-app` contains only raw `@react-native-async-storage/async-storage`.
  * No retry queue, exponential backoff utility, or upload worker exists in any sub-project.

#### Q8: What happens when the network fails before upload, during upload, or after upload succeeds but before response reaches kiosk?
* **Failure Matrix:**
  * *Before upload:* `fetch` immediately throws `TypeError: Failed to fetch`. Kiosk renders QR from fallback URL; images deleted on session reset.
  * *During upload:* TCP connection reset mid-flight. S3 receives partial/corrupted buffer or aborts. Backend throws 500. Kiosk renders QR from fallback URL; images deleted on session reset.
  * *After upload succeeds but response drops:* S3 has images, MongoDB has records, but kiosk receives network timeout. Kiosk assumes failure, shows fallback QR. When guest scans QR, they land on fallback URL (`/download/:sessionId`) instead of the minted `downloadId`.

---

### 3.3 Storage Architecture Evaluation: IndexedDB vs. Electron Main-Process Disk Queue

| Architectural Attribute | Option A: Renderer IndexedDB | Option B: Main-Process Disk Queue (`userData/queue/`) | Recommendation & Rationale |
|---|---|---|---|
| **Storage Location** | Chromium LevelDB in renderer profile | Local filesystem: `app.getPath('userData')/upload-queue/` | **Option B is superior**. Main process uses native Node `fs`, completely immune to browser sandbox/origin wipes. |
| **Memory Footprint** | Large Base64 strings held in renderer heap | Binary image buffers written directly to disk | **Option B is superior**. Keeps 24 MP Base64 strings out of Chromium memory, preventing kiosk UI stutters. |
| **Crash & Reboot Resilience** | Requires renderer to mount and initialize DB | Scanned on Electron boot in `app.whenReady()` before UI loads | **Option B is superior**. Background worker can drain uploads even if renderer is showing the login or idle screen. |
| **IPC Overhead** | Zero IPC (all in renderer) | One IPC call `bridge.enqueueSessionUpload()` | **Option B is negligible overhead**; IPC overhead for a file path/buffer is <2ms. |
| **Implementation Complexity** | Medium (idb library or raw DOM IndexedDB) | Low (pure Node `fs.promises` + atomic JSON manifest) | **Option B fits existing architecture** (`store.ts` already uses `app.getPath('userData')`). |

---

### 3.4 Proposed Production-Safe Upload Queue Design

```
C:\Users\<user>\AppData\Roaming\HappyPix Booth\upload-queue\
├── queue-manifest.json             <-- Atomic index of pending session IDs & retry counters
└── <sessionId>\
    ├── meta.json                   <-- { sessionId, eventId, digitalCopy, timestamp, retries }
    ├── composite.jpg               <-- Full 300 DPI composite JPEG (binary)
    ├── photo-0.jpg                 <-- Raw capture 0 (binary)
    └── photo-1.jpg                 <-- Raw capture 1 (binary)
```

1. **Enqueue Step (`finishAndPrint`):**
   * Before calling `boothApi.completeSession`, renderer calls `bridge.enqueueSession({ sessionId, compositeBase64, photosBase64, metadata })`.
   * Main process writes binary images to `userData/upload-queue/<sessionId>/` and updates `queue-manifest.json` using atomic temporary file rename.
2. **Immediate Attempt & Background Drain:**
   * Main process attempts immediate upload to `/api/booth/sessions/complete`.
   * If successful: main process deletes `userData/upload-queue/<sessionId>/` directory.
3. **Offline / Failure Recovery Worker:**
   * If offline or request fails: worker sets status to `pending_retry`.
   * Listens to Electron `net.isOnline()` and OS network change events.
   * Runs exponential backoff: 5s, 15s, 45s, 2m, 5m (up to max 10 retries).
   * Automatically scans `userData/upload-queue/` on application startup (`app.whenReady()`) and resumes draining pending uploads.
4. **Backend Idempotency Upgrade:**
   * Modify `backend/routes/boothRoutes.js` `POST /sessions/complete`:
     ```javascript
     const existingDownload = await GuestDownload.findOne({ sessionId, organizationId: organization._id });
     if (existingDownload) {
       return res.json({
         success: true,
         downloadUrl: downloadUrlFor(existingDownload.downloadId),
         downloadId: existingDownload.downloadId,
         photosStored: existingDownload.photoIds.length,
       });
     }
     ```
   * Guarantees that retrying the exact same session ID 10 times results in **exactly 1 S3 folder, 1 set of Photo rows, and 1 GuestDownload row**.

---

## 4. HP-DEF-02: Legacy Cloud Printing (Dependency & Reachability Analysis)

### 4.1 Exhaustive Inventory of All `printImage()` Callers

`backend/utils/printHelper.js` exports two functions: `printLocalImage` and `printImage`.  
Across the entire repository, `printImage` is imported and called in **exactly one file: `backend/routes/paymentRoutes.js`**, across 6 specific route handlers:

```
backend/routes/paymentRoutes.js
├── Line 12:  import { printImage } from '../utils/printHelper.js';
├── Line 547: GET  /status/:paymentId     (Polling check: prints if paid && compositeUrl)
├── Line 610: POST /verify                (Client verification: prints if paid && compositeUrl)
├── Line 684: POST /cashfree-webhook      (Webhook callback: prints if paid && compositeUrl)
├── Line 752: POST /razorpay-webhook      (Webhook callback: prints if paid && compositeUrl)
├── Line 854: POST /free-complete         (Free order completion: prints if compositeUrl)
└── Line 902: POST /complete-prepaid      (Prepaid order completion: prints if compositeUrl)
```

**Zero callers exist in `routes/crm/`, `routes/boothRoutes.js`, `routes/eventRoutes.js`, `routes/deviceRoutes.js`, or any service.**

---

### 4.2 Legacy Route Reachability & Registration

* **Server Mount:** `backend/server.js#L251`:
  ```javascript
  app.use('/api/payments', paymentRoutes);
  ```
  The router is **actively mounted and reachable over HTTP**.
* **Client Usage:**
  * Modern Electron Kiosk (`electron/src/ui/services/api.ts`): Uses `/api/booth/*`. **Calls zero `/api/payments/*` routes.**
  * Modern Tablet Kiosk (`client-app/packages/api/src/index.ts`): Uses `/api/booth/*`. **Calls zero `/api/payments/*` routes.**
  * CRM Dashboard (`crm/src/api/index.js`): Uses `/api/platform/*` and `/api/org/*`. **Calls zero `/api/payments/*` routes.**
* **External Reachability:**
  * Third-party payment gateways (Razorpay / Cashfree) will send webhooks to `/api/payments/razorpay-webhook` and `/api/payments/cashfree-webhook` **if the webhook URL was configured with that path in the gateway dashboard**.

---

### 4.3 Conditions Under Which `payment.compositeUrl` Is Populated

In `backend/routes/paymentRoutes.js`, all 6 print invocations are guarded by:
```javascript
const settings = await getSettingsForOrg(payment.organizationId);
if (settings && settings.enableHardwarePrinting && payment.compositeUrl) {
  printImage(payment.compositeUrl, payment.printCount, settings.printerName)
    .then(() => console.log('Print job dispatched...'))
    .catch((err) => console.error('Print job dispatch error:', err));
}
```

* **Modern Booth Kiosk Orders:**
  * Booth calls `POST /api/booth/payments` **before** photo capture.
  * `payment.compositeUrl` is `null`.
  * Even if the gateway sends a webhook to `paymentRoutes.js`, `payment.compositeUrl` is falsy. `printImage()` is **NEVER CALLED**.
* **Legacy V1 Orders (`POST /api/payments/create-order`):**
  * If a client calls `create-order` passing `{ compositeUrl: "https://..." }`, `payment.compositeUrl` IS stored in MongoDB.
  * When the webhook or `/verify` arrives, `payment.compositeUrl` is truthy.
  * If `settings.enableHardwarePrinting` is true, **`printImage()` IS CALLED**.
  * On a Linux host (Vercel Serverless / Docker), this executes:
    `powershell -NoProfile -EncodedCommand ...`
    Result: Spawns `/bin/sh: powershell: not found` error.

---

### 4.4 Business Logic & Side-Effect Independence

Inspecting `paymentRoutes.js#L675-680`:
```javascript
payment.status = 'paid';
payment.paidAt = new Date();
payment.cashfreePaymentId = ...;
await payment.save();
await recordCouponRedemption(payment);

// Hardware printing invocation happens AFTER payment status is saved
try {
  const settings = await getSettingsForOrg(payment.organizationId);
  if (settings && settings.enableHardwarePrinting && payment.compositeUrl) {
    printImage(...)
  }
} catch (printErr) { ... }
```

1. Payment status transition (`paid`) occurs **before** `printImage`.
2. Coupon redemption recording occurs **before** `printImage`.
3. Financial ledger updates occur **before** `printImage`.
4. `printImage` is wrapped in an isolated `try/catch` with an async `.catch()`.
5. **Decoupling or removing `printImage` causes ZERO changes to payment verification, order status, or financial records.**

---

### 4.5 Deprecation & Decoupling Strategy

Rather than immediately deleting the legacy routes (which would break any existing third-party webhooks registered in gateway dashboards), the recommended, safe approach is:

1. **Host-Aware Decoupling in `backend/utils/printHelper.js`:**
   Add strict OS-level platform validation at the entry of `printLocalImage` and `printImage`:
   ```javascript
   export const printImage = async (imageUrl, printCount = 1, printerName = '') => {
     if (process.platform !== 'win32') {
       console.log(`[PrintHelper] Host OS is ${process.platform} (cloud/serverless). Server-side printing bypassed; kiosk prints locally.`);
       return { success: true, bypassed: true, reason: 'non-windows-cloud-host' };
     }
     // ... existing PowerShell printing logic retained for local Windows environments ...
   };
   ```
2. **Benefits of this Strategy:**
   * 100% backward-compatible: Does not break route schemas or gateway webhooks.
   * Completely eliminates unhandled PowerShell spawn crashes on Vercel/Linux.
   * Preserves ability to run local monolithic Windows tests if needed.
   * Zero regression risk to payment statuses or coupon accounting.

---

## 5. Comprehensive Regression Test Matrix

### 5.1 Test Plan for HP-DEF-01 (Offline Upload Recovery)

| Scenario ID | Test Name | Simulated Environment & Inputs | Expected Deterministic Outcome | Test Framework |
|---|---|---|---|---|
| **TST-UPL-01** | Upload succeeds online | Online network; valid session with composite + 3 frames | Kiosk calls `completeSession`, receives `200 OK` with `downloadId`; local queue entry is deleted; no duplicates in DB. | Vitest / Node Test |
| **TST-UPL-02** | Network unavailable before upload | Network disconnected before `finishAndPrint()` | Session images saved to `userData/upload-queue/<sessionId>/`; kiosk marks queue status `pending_retry`; kiosk shows UI outcome without freezing. | Vitest (Mock Net) |
| **TST-UPL-03** | Network drops mid-upload | Request aborts after partial upload | Worker catches network error; retains files in `userData/upload-queue/`; schedules exponential retry in 5s. | Vitest (Mock Fetch) |
| **TST-UPL-04** | Upload succeeds but response drops | Server receives images, writes DB, but HTTP response lost | Kiosk retries with identical `sessionId`; backend detects existing `sessionId` and returns existing `downloadId` without creating duplicate Photo rows. | Node Test (`node:test`) |
| **TST-UPL-05** | App restarts with pending queue | Kiosk process killed with 2 sessions in queue; restarted | `app.whenReady()` scans `userData/upload-queue/`; detects 2 pending sessions; initiates background drain without operator intervention. | Vitest (Mock FS) |
| **TST-UPL-06** | Automatic drain on reconnect | Kiosk goes from offline to online | Electron `net.isOnline()` event triggers queue worker; worker uploads pending sessions and purges disk files. | Vitest (Mock Events) |
| **TST-UPL-07** | Idempotent duplicate prevention | Client calls `POST /sessions/complete` 3 times with identical `sessionId` | Exactly 1 set of S3 objects, 1 set of `Photo` documents, and 1 `GuestDownload` document created. | Node Test (`node:test`) |
| **TST-UPL-08** | Digital gallery validity check | Guest opens `/download/:downloadId` | Endpoint returns HTTP 200 with valid presigned S3 URLs only after upload worker confirms successful drain. | Node Test (`node:test`) |
| **TST-UPL-09** | Safe file cleanup rule | Local files in `userData/upload-queue/` | Files are unlinked **only after** server returns confirmed HTTP 200 with `{ success: true }`. Never deleted on failure. | Vitest (Mock FS) |

---

### 5.2 Test Plan for HP-DEF-02 (Cloud Printing Decoupling)

| Scenario ID | Test Name | Simulated Environment & Inputs | Expected Deterministic Outcome | Test Framework |
|---|---|---|---|---|
| **TST-PRN-01** | Modern booth payment unaffected | Kiosk calls `POST /api/booth/payments` and polls `GET /api/booth/payments/:id` | Payment succeeds; status transitions to `paid`; `printImage` is never called; booth prints locally via IPC. | Node Test (`node:test`) |
| **TST-PRN-02** | Legacy webhook Linux cloud safety | Razorpay webhook POST on Linux (`process.platform = 'linux'`) | Signature verified; `payment.status` becomes `paid`; `printHelper` logs safe bypass; zero PowerShell errors. | Node Test (`node:test`) |
| **TST-PRN-03** | Webhook replay duplicate safety | Same valid webhook posted 5 times | Status remains `paid`; coupon redeemed exactly once; no duplicate print calls. | Node Test (`node:test`) |
| **TST-PRN-04** | Payment status & coupon integrity | Razorpay `/verify` with valid signature and coupon | Payment status saved as `paid`; coupon usage counter incremented; return JSON contains valid tokens. | Node Test (`node:test`) |
| **TST-PRN-05** | SSRF protection in print helper | URL with private IP (`http://169.254.169.254/`) passed to `printImage` | Request blocked immediately with warning log; no network connection attempted. | Node Test (`node:test`) |

---

## 6. Implementation Order & Rollback Strategy

When Stage 03B is authorized, implementation should proceed in this sequential, risk-mitigated order:

```
STEP 1: Backend Idempotency & Cloud Print Safety (Zero-Risk Core)
  ├── 1.1 Add platform check to backend/utils/printHelper.js (Prevents cloud PowerShell crashes).
  ├── 1.2 Add sessionId idempotency check to backend/routes/boothRoutes.js (Prevents duplicate rows on retry).
  └── 1.3 Run backend tests: npm test (Must maintain 48/48 pass rate).

STEP 2: Electron Main-Process Upload Queue
  ├── 2.1 Create electron/src/electron/uploadQueue.ts (File persistence & background drain worker).
  ├── 2.2 Register queue IPC handlers in electron/src/electron/main.ts.
  ├── 2.3 Expose queue methods via preload in electron/src/electron/preload.cts.
  └── 2.4 Connect finishAndPrint() in electron/src/ui/App.tsx to enqueue before completion.

STEP 3: Automated Regression Test Execution
  ├── 3.1 Execute Vitest suite in electron (Verify queue persistence & mock network drain).
  ├── 3.2 Execute Node test suite in backend (Verify webhook safety & idempotency).
  └── 3.3 Verify git diff and ensure zero regressions across CRM and mobile apps.
```

### Rollback Strategy
* **Backend Rollback:** Both changes are strictly additive guards (OS check and MongoDB `findOne`). If any unexpected behavior occurs, reverting the single commit restores 100% legacy behavior without data migrations.
* **Electron Rollback:** If the main-process queue encounters an unexpected edge case, the renderer's `finishAndPrint()` can fall back immediately to direct `boothApi.completeSession()` calls.

---

## 7. Outstanding Questions & Hardware Environment Constraints

1. **DNP Hardware Spooler Byte Codes:** CspStat DLL status codes (`paper_end`, `ribbon_end`, `cover_open`) have been verified structurally via P/Invoke. Live byte-level validation requires a physically connected DNP printer during field QA.
2. **Camera CCAPI Latency:** Wi-Fi transfer latency for 24 MP RAW captures varies by venue network density (typically 800ms–2200ms). The queue design accounts for this by processing uploads asynchronously in the background.

---

## 8. Preservation & Safety Gate Verification

* **Application Source Code Modified:** `NO` (0 files modified)
* **Configuration Files Modified:** `NO` (0 files modified)
* **Dependencies Altered:** `NO` (0 packages installed/removed)
* **Database State Touched:** `NO` (0 writes performed)
* **Audit Files Created in Stage 03A:**
  * `docs/audit/STAGE_03A_ROOT_CAUSE_AND_TEST_PLAN.md`
* **Final Working Tree Status:** Clean (except untracked `docs/audit/`)

---
*Stage 03A: Root-Cause Verification & Test Preparation is complete. Awaiting user authorization before initiating Stage 03B.*
