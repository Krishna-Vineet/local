# Merge notes — bringing the friend's branch back into `local`

**Date:** 2026-10-29
**Sources:** `Krishna-Vineet/local` (this branch — UI, docs, booth-demo, the tablet
parity work) and `Krishna-Vineet/friend` (bug-fix track — backend correctness,
Electron durable upload queue, Canon live view, session hardening).
**Common ancestor:** `c1b72e0` (“done final”, 2026-10-18), the last snapshot both
sides worked from.

Nothing was thrown away on either side. This document records *how* that was
checked and the handful of places where one side's implementation had to win,
because two people had solved the same problem.

---

## 1. Why a normal `git merge` could not do this

The friend's history is a single commit (`c984969 first commit`) with no shared
ancestor, so Git sees every file as independently added. A default merge would
have produced hundreds of add/add conflicts and, worse, would have called an
“edit on both sides” a conflict even when both edits were identical.

So the merge was done as a **file-level three-way merge with `c1b72e0` as the
base** (`git merge-file` per path), then the conflicts were resolved by reading
both intents:

| Category | Files | Decision |
|---|---|---|
| changed on both sides, non-overlapping | 49 | Automatic three-way merge. 48 came out byte-identical to ours (his fix was already here); 1 gained his work (`guestDownloadService.js`). |
| changed on both sides, same lines | 16 | Resolved by hand — see §3. |
| only he changed it | 6 | Took his file. |
| only he added it | 15 | Took his files. |
| both added the same path | 73 | 67 were identical; 6 compared and chosen (§4). |
| only we changed it / only we added it | 115 | Kept ours, untouched. |
| both deleted it | 53 | Stays deleted. |
| we deleted, he left it | 5 | Stays deleted (superseded files, see §5). |

---

## 2. What the merge brings in from his side

* **`electron/src/electron/uploadQueue.ts` + its 17 tests** — a durable on-disk
  session queue: a finished session is staged to `userData/upload-queue` before
  the UI forgets it, retried with backoff, and uploads even if the network or the
  app dies mid-session.
* **`electron/src/electron/main.ts` / `preload.cts`** — the IPC surface for that
  queue (`booth:enqueue-session`, `booth:get-queue-status`,
  `booth:get-session-status`) and the worker's lifecycle. Also declared in
  `src/ui/types/electron.d.ts` so the renderer is typed, not `any`.
* **`electron/src/ui/App.tsx` / `SuccessScreen.tsx`** — the guest-visible half of
  the same fix: `enqueueFailed` / `isSavedDurable` on the print outcome, a
  “photos not saved” alert with **Retry Saving Photos**, and the success screen
  no longer auto-resets while the session exists only in memory.
* **`backend/routes/boothRoutes.js`** — session-completion hardening: an
  in-flight lock per session, normalised SHA-256 photo hashing with size/format
  validation, and idempotent composite handling.
* **`backend/services/guestDownloadService.js`** — atomic `findOneAndUpdate`
  upsert so two concurrent completions cannot create two download links.
* **`backend/models/{Photo,GuestDownload}.js`, `config/layouts.js`,
  `routes/paymentRoutes.js`, `utils/printHelper.js`** — accompanying fixes.
* **New tests** — `backend/tests/printHelper.test.js`,
  `backend/tests/sessionCompletion.test.js` (the “Fix 1–4” regression suites).
* **`docs/audit/`** — his seven-stage audit set (discovery, feature/API audit,
  root cause, implementation, independent review, targeted safety fixes).

All of it is additive with respect to our track: the tablet, the docs set, the
booth demo and the print-spec work are untouched.

---

## 3. The sixteen hand resolutions

Most were the same change made twice. Where they differed, the rule was: **keep
the behaviour both people wanted, take the newer implementation of it.**

| File | What happened |
|---|---|
| `backend/server.js` | Ours already contained his `/api/leads` endpoint *and* the schema-guard boot; kept ours. |
| `backend/routes/boothRoutes.js` | Took his hardened session-completion, then re-applied our device-token rework (`Device.createToken()` → `deviceTokenHash`). His copy still wrote the raw token through the removed schema path, which would have failed validation. |
| `electron/src/electron/main.ts`, `preload.cts` | Took his (they are ours + the queue IPC). |
| `electron/src/ui/App.tsx` | Took his durable-queue flow, then re-applied our guaranteed download URL: when the online upload is delayed the QR still points at `/download/<sessionId>` instead of being empty. |
| `electron/src/ui/screens/SuccessScreen.tsx` | Ours (light-theme support sheet, per the design decision) **plus** his save-safety block: `hasUnsavedPhotos`, the storage alert, Retry Saving, and a disabled “Finish” until the session is durable. |
| `electron/src/ui/types.ts` | His (`enqueueFailed` / `enqueueError` / `isSavedDurable`). |
| `client-app/apps/booth/App.tsx` | Ours (the `useEdgeToEdge()` root); his interaction handler was already identical. |
| `…/LoginScreen.tsx` | Ours — it already connects to the discovered printer, which was his fix. |
| `…/PhotoSelectionScreen.tsx` | Ours — it already uses `StyleSheet.absoluteFill` and the measured strip. |
| `…/SoundManager.ts` | Ours — the rewrite already plays on both platforms via the native module, so his `Platform.OS === 'android'` gate is gone by construction. |
| `…/CustomizeScreen.tsx` | Ours — the tab set is already `filters/stickers/logos/text` with `resetIdleTimer()` on every tab press, i.e. his change. |
| `…/CaptureScreen.tsx` | Ours — the rebuilt camera chrome already hosts his `CanonLiveView` and Canon capture path. |
| `…/InactivityToast.tsx` | Ours — already has the tap sound, `pointerEvents="box-none"` and hit slop. |
| `packages/ui/src/components/FilteredImage.tsx` | Ours — the four-strategy Skia loader supersedes his fetch-based one and covers the same `file://` cases. |
| `electron/src/ui/App.css` | Ours — it is his block *plus* the later light-theme support modal; every selector he added is present. |
| `README.md` | Ours — see §4. |

---

## 4. Two places where one side's *content* had to win

**README documentation index.** Both sides rewrote it. His version, however,
lists twenty `docs/*.md` files that do not exist in either repository
(`PROJECT_OVERVIEW.md`, `SYSTEM_ARCHITECTURE.md`, …). Ours lists the documents
that are actually in the tree. Ours was kept so the README does not send a reader
to missing files; his §4.2 “interactive tools” pointers (OpenAPI, generated HTML,
`business/*.xlsx`) were already covered.

**Generated documentation.** `docs/DIAGRAMS.md`, `docs/diagrams/index.html`,
`docs/BACKEND_REFERENCE.html` and the two `docs/scripts/build_*.py` exist on both
sides with slightly different byte counts. Ours were regenerated after the
connector-colour work (`docs/scripts/edge_colors.js`, inlined into both viewers),
so our build scripts are a strict superset and the artefacts were kept as ours.

`client-app/apps/booth/ios/booth/SimpleSoundModule.swift` also differed: his
played Apple's system sounds via `AudioToolbox`, ours plays the six generated WAV
cues with cached `AVAudioPlayer`s (so iOS matches Android and Electron). Ours was
kept; his file's intent — audio on iOS at all — is satisfied, and better, by it.

---

## 5. Deliberately not carried over

* `client-app/apps/booth/src/components/ScreenHeader.tsx` — superseded by
  `AppShell` on our side (we deleted it; the friend's snapshot still had it).
* `client-app/apps/booth/android/app/src/main/res/raw/*.mp3` — replaced by the
  generated `.wav` cues.
* `backend/uploads/photos/…/*.jpg` — four test uploads from running the app
  locally, i.e. runtime data rather than source. They stay out of the repository.

---

## 6. How the merge was verified

| Check | Result |
|---|---|
| `node --check` on every changed backend file | pass |
| `backend: npm test` (79 tests, incl. his two new suites and our device-token/schema-guard suites) | 79/79 pass |
| `client-app`: `tsc --noEmit` for `packages/ui`, `packages/printer-core`, `apps/booth` | clean |
| `electron`: `tsc -b` | clean |
| `electron`: `vitest run` (incl. his 17 `uploadQueue` tests) | 22/22 pass |
| `electron`: `eslint` on the touched files | clean |
| conflict-marker sweep over the whole tree | none |

No device build (Xcode/Gradle/pod) or physical print was possible in this
environment; native changes are verified by type-check and unit tests only, as
before.
