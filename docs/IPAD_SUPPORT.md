# HappyPix Booth on iPad — build, behaviour and review

> **Scope:** the React Native booth (`client-app/apps/booth`) running on **iPadOS** instead of Android.
> What already works, what differs, what is broken or missing, and the exact fix for each finding.
> **Audience:** whoever builds and ships the iPad app, and whoever supports a booth in the field.
> **Companions:** [`APPLICATIONS_CRM.md`](APPLICATIONS_CRM.md) §7 (the booth screens),
> [`HARDWARE_PRINTING.md`](HARDWARE_PRINTING.md) (printers and media),
> [`DEPLOYMENT_RELEASE.md`](DEPLOYMENT_RELEASE.md) (signing and release),
> [`TESTING_RELEASE_CHECKLIST.md`](TESTING_RELEASE_CHECKLIST.md) (QA gates).

**Verdict in one line:** the iPad target exists, is configured for iPad, and the whole guest session
(session → quote → UPI → capture → compose → upload → QR) runs on it through the same API. The parts
that are *not* iPad-ready are the ones that make it a **kiosk appliance** — lockdown, audible feedback,
safe-area layout and above all **physical printing** — plus the App Store packaging (icons, signing).

---

## Table of contents

1. [Status at a glance](#1-status-at-a-glance)
2. [What exists in the repository](#2-what-exists-in-the-repository)
3. [Build and run on an iPad](#3-build-and-run-on-an-ipad)
4. [The session flow on iPad](#4-the-session-flow-on-ipad)
5. [Review findings](#5-review-findings)
6. [Kiosk lockdown on iPad](#6-kiosk-lockdown-on-ipad)
7. [Printing from an iPad](#7-printing-from-an-ipad)
8. [Distribution: TestFlight and the App Store](#8-distribution-testflight-and-the-app-store)
9. [iPad test matrix and QA checklist](#9-ipad-test-matrix-and-qa-checklist)
10. [What is left to do](#10-what-is-left-to-do)

---

## 1. Status at a glance

| Area | Android | iPad | Note |
|---|---|---|---|
| Project & target | ✅ `android/` | ✅ `ios/booth.xcodeproj` | `TARGETED_DEVICE_FAMILY = "1,2"`, iPadOS 15.1+ |
| Orientation | ✅ rotates | ✅ all four, incl. `~ipad` | layout is written for landscape 1024 × 768 |
| Responsive scaling | ✅ | ✅ | `packages/ui/src/utils/responsive.ts` normalises to a landscape basis |
| Camera (built-in) | ✅ VisionCamera | ✅ VisionCamera | front camera preferred, which is what a booth needs |
| Camera (Canon Wi-Fi) | ✅ CCAPI | ⚠️ code is platform-neutral, **untested** | LAN probing needs the Local Network permission (finding IP-3) |
| Printing | ✅ IPP / DNP bridge / OS spooler | ❌ **no working path yet** | AirPrint is a stub; see §7 |
| Kiosk lockdown | ✅ Lock Task Mode | ❌ no native module | Guided Access / MDM or a Swift module; see §6 |
| Screen stays awake | ✅ `keepScreenOn` (native) | ❌ no-op | finding IP-2 |
| Sound / haptics | ✅ native `SimpleSound` | ❌ silent | finding IP-7 |
| Safe areas (home indicator) | n/a | ⚠️ core `SafeAreaView` only, not rotation-safe | finding IP-5 |
| Multitasking lock | n/a | ✅ via `UIRequiresFullScreen` (added) | finding IP-4 |
| Payment | ✅ UPI QR | ✅ UPI QR | same `react-native-qrcode-svg`; no native gateway module involved |
| Offline queue | ✅ AsyncStorage | ✅ AsyncStorage | survives app kill; stops while suspended |
| App icon | ⚠️ default RN robot | ❌ no images at all | finding IP-6 |
| Privacy manifest | n/a | ✅ `PrivacyInfo.xcprivacy` | needs App Store privacy answers alongside it |
| Signing / CI | ✅ APK | ❌ nothing | finding IP-15 |
| Store listing | Google Play (internal) | ❌ none | TestFlight needed first |

Legend: ✅ works · ⚠️ works with caveats / untested · ❌ missing.

---

## 2. What exists in the repository

```
client-app/apps/booth/
├── App.tsx                       ← navigation, provider, idle + back handling
├── ios/
│   ├── Podfile                   ← platform :ios, min_ios_version_supported (15.1)
│   ├── Gemfile                   ← CocoaPods pinning for `bundle exec pod install`
│   └── booth/
│       ├── AppDelegate.swift     ← RN 0.86 RCTReactNativeFactory
│       ├── Info.plist            ← usage strings, ATS, orientations, iPad keys
│       ├── PrivacyInfo.xcprivacy ← required-reason API declarations
│       ├── Images.xcassets/AppIcon.appiconset/  ← declared slots, **no images**
│       └── LaunchScreen.storyboard
└── src/…                         ← 11 screens, shared with Android
```

Relevant build settings (already correct for iPad):

| Setting | Value |
|---|---|
| `TARGETED_DEVICE_FAMILY` | `1,2` — iPhone **and** iPad |
| `IPHONEOS_DEPLOYMENT_TARGET` | `15.1` |
| `SUPPORTED_PLATFORMS` | `iphoneos iphonesimulator` |
| `PRODUCT_BUNDLE_IDENTIFIER` | `com.happypix.booth` |
| `CFBundleDisplayName` | HappyPix Booth |
| iPad orientations | portrait, portrait upside-down, landscape left, landscape right |

Everything above the native shell is shared with Android: the 11 screens, `BoothProvider`,
`@happypix/api`, `camera-core`, `printer-core`, `state-machine`, `ui`. There is **no iOS-specific
code** — that is the good news and also the reason several Android assumptions leak through (§5).

---

## 3. Build and run on an iPad

### 3.1 Prerequisites (macOS only)

| Tool | Version | Why |
|---|---|---|
| macOS | 14+ | Xcode 16 requires it |
| Xcode | 16.x | RN 0.86 needs the iOS 18 SDK |
| CocoaPods | via `bundle exec` | `apps/booth/Gemfile` pins a working combination |
| Ruby | ≥ 2.6.10 | see Gemfile |
| Node / pnpm | 22 / 9 | monorepo tooling |

### 3.2 First build

```bash
cd client-app
pnpm install

cd apps/booth
bundle install
cd ios && bundle exec pod install && cd ..

# simulator (fastest loop)
pnpm ios --simulator "iPad Pro 13-inch (M4)"

# physical iPad, signed, on a local API
pnpm ios --device
```

### 3.3 Pointing the app at an API

`react-native-config` reads `apps/booth/.env`:

```env
BOOTH_API_URL=https://happypix-v2-backend.vercel.app
```

For a laptop-hosted API, the iPad must reach the **LAN IP** of that laptop — `localhost` means the
iPad itself. Android uses `10.0.2.2` for the emulator; **that host does not exist on iOS**, so any
default that points at `10.0.2.2` must be overridden for iPad testing.

### 3.4 Release configuration

`Debug` loads the bundle from Metro; `Release` loads `main.jsbundle` from the app bundle. A TestFlight
build therefore needs the bundle step that `react-native build-ios` performs — do not archive a
`Release` configuration without it, or the app launches to a blank screen.

---

## 4. The session flow on iPad

The flow is identical to Android and to the Electron kiosk, because all three speak the same
`/api/booth` contract. The only iPad-specific step is the print.

| # | Step | Screen | iPad behaviour |
|---|---|---|---|
| 1 | Pair the booth | `LoginScreen` | email + password + location label; device UUID persisted in AsyncStorage |
| 2 | Wait for a live event | `WaitingScreen` | snapshot-driven, polls `GET /api/booth/bootstrap` |
| 3 | Start | `StartScreen` | idle timer runs; resets to `Start` when a guest wanders off |
| 4 | Choose layout | `LayoutSelectionScreen` | template grid from the snapshot |
| 5 | Choose slot / frame | `SlotSelectionScreen` | |
| 6 | Print count | `PrintCountScreen` | quote comes from `POST /api/booth/checkout/quote` |
| 7 | Pay | `PaymentScreen` | UPI QR rendered in-app; polls `GET /api/booth/payments/:id` |
| 8 | Capture | `CaptureScreen` | VisionCamera, front camera preferred, 3–10 shots |
| 9 | Pick photos | `PhotoSelectionScreen` | |
| 10 | Customise | `CustomizeScreen` | Skia compositing, filters, stickers |
| 11 | **Print + upload** | `BoothProvider.finishAndPrint` | compose → print (❌ see §7) → presigned S3 upload → `sessions/complete` |
| 12 | Success | `OrderSuccessScreen` | QR to `/download/<id>`, issue-after-success |

Steps 1–10 and 12 are iPad-ready today. Step 11 prints only if a Reachable printer path exists (§7).

---

## 5. Review findings

Numbered so they can be closed one at a time. Severity is about a **booth in front of paying guests**,
not about code taste.

| ID | Severity | Finding | Where |
|---|---|---|---|
| IP-1 | **High** | No kiosk lockdown on iOS; `KioskModule` silently returns on any non-Android platform, so a guest can press the home button and walk away with the iPad showing Settings. | `packages/kiosk-core/src/KioskModule.ts` |
| IP-2 | **High** | `keepScreenOn()` calls a native module that does not exist on iOS — no effect. The iPad auto-locks mid-event. | `KioskModule.ts:60` |
| IP-3 | **High** | No `NSLocalNetworkUsageDescription`. iOS 14+ blocks LAN access (print bridge, Canon CCAPI at `192.168.1.2`, IPP printers) without it — and the app probes those addresses on the very first login screen. | `ios/booth/Info.plist` |
| IP-4 | **High** | No `UIRequiresFullScreen`, so iPad Split View / Slide Over is allowed. `responsive.ts` assumes a landscape basis, so a Slide Over window (~320 pt) scales everything to ~0.31× — unreadable. | `Info.plist` + `responsive.ts` |
| IP-5 | Medium | `ScreenContainer` imports `SafeAreaView` from core `react-native` (L6). Core `SafeAreaView` does apply iOS insets, but it is deprecated in RN 0.86, only pads the view it wraps, and does **not** re-read insets reliably on rotation — and our screens are landscape-only with an overlay layout, so the bottom home-indicator band can end up under primary buttons. `react-native-safe-area-context@5.5.2` is already a dependency and `SafeAreaProvider` is already mounted (`App.tsx:3`), but `useSafeAreaInsets` is used nowhere in `packages/ui`. | `packages/ui/src/components/ScreenContainer.tsx:6,150`; `apps/booth/App.tsx:3` |
| IP-6 | **High** (distribution) | `AppIcon.appiconset/Contents.json` declares 9 slots with **no image filenames**, and the iPad sizes (76×76, 152×152, 167×167) plus the 1024 marketing icon are absent. An archive will be rejected or ship with the blank icon. | `ios/booth/Images.xcassets/AppIcon.appiconset/` |
| IP-7 | Medium | No booth sounds on iPad: `SoundManager` uses the Android-only `SimpleSound` module, then falls back to `window.AudioContext` (a web API that does not exist in React Native), so shutter/click/success are silent. `Vibration` is a no-op on iPad (no Taptic Engine). | `src/utils/SoundManager.ts:3,27,33` |
| IP-8 | Medium | AirPrint is a stub: `AirPrintProvider.print()` posts a raw bitmap to `http://<printer>:631/ipp/print` with `Content-Type: application/ipp`. That is not a valid IPP request (no operation attributes, no document-attributes group), so a real printer rejects it. AirPrint's actual API is native (`UIPrintInteractionController` / `UIPrinter`). | `packages/printer-core/src/providers/StubProviders.ts` |
| IP-9 | Medium | `IPPProvider` builds a header-only IPP body and appends the image; there is no `attributes-charset` / `document-format` group, so CUPS-class printers answer 400. Works nowhere except a very permissive print server. Also plain `http` to an arbitrary IP, which ATS restricts. | `packages/printer-core/src/providers/IPPProvider.ts` |
| IP-10 | Medium | `androidPreviewViewType="texture-view"` is passed unconditionally to `<Camera>`. Harmless on iOS (unknown props are ignored) but it marks a camera path that has never been exercised on iPad. Verify front-camera selection on iPad Pro, where the front camera is an ultra-wide (Center Stage). | `src/screens/CaptureScreen.tsx:220` |
| IP-11 | Low | `ScreenContainer` renders `<StatusBar hidden={false}>` on every screen, cancelling the `<StatusBar hidden />` in `App.tsx`. A clock appears in the kiosk view. | `ScreenContainer.tsx:157` |
| IP-12 | Low | `appVersion: '1.0.0'` is hardcoded in login and heartbeat, so device telemetry cannot tell builds apart across an iPad fleet. | `src/context/BoothProvider.tsx:517` |
| IP-13 | Low | `isLargeScreen` is computed once at module load and never updates; it is exported but unused. Either delete it or make it a hook. | `responsive.ts:90` |
| IP-14 | Low | `react-native-zeroconf` is a dependency but nothing imports it, so there is no mDNS printer discovery. On iPad that is the natural way to find an AirPrint printer — and it needs `NSBonjourServices` in the plist. | `apps/booth/package.json` |
| IP-15 | **High** (release) | No iOS signing, no Fastlane, no archive scheme, no CI job. `DEPLOYMENT_RELEASE.md` had no iOS section at all before this update. | repo-wide |
| IP-16 | Low | `BackHandler` (Android hardware back) is a no-op on iOS, so there is no system back gesture inside the kiosk. Every screen must rely on its own buttons — check each one has a visible way back. | `App.tsx:152` |
| IP-17 | Low | Launch storyboard declares a 4.7" iPhone device; cosmetic on iPad. | `ios/booth/LaunchScreen.storyboard` |
| IP-18 | Medium | The offline sync queue is AsyncStorage-backed (good, survives a kill) but draining only runs in the foreground; iPadOS suspends the app aggressively, so a session queued at 23:59 may not upload until someone touches the screen. | `src/services/offlineSyncService.ts` |

### 5.1 What already works, and why it matters

Worth stating explicitly, because these were **not** accidents and should not be undone:

* **`TARGETED_DEVICE_FAMILY = "1,2"` and the `~ipad` orientation array** are already in the project.
* **`responsive.ts` normalises to a landscape basis** and re-reads `Dimensions` on rotation — the
  same fix that removed "tiny text when booting in portrait" on Android makes iPad rotation correct.
* **`SafeAreaProvider` is mounted** at the root and `react-native-safe-area-context@5.5.2` is already a
  dependency, so adopting `useSafeAreaInsets` is a small change per component, not a new dependency or
  a refactor (IP-5).
* **Payment never touches a native gateway SDK.** The booth renders a UPI QR and polls. That removes
  the single biggest iPad risk in this class of app (Razorpay's native checkout needs a presenting view
  controller and a popover anchor on iPad). `react-native-razorpay` is in `package.json` but **never
  imported** — do not start using it on iPad without handling popover presentation.
* **Skia, `react-native-svg` and `react-native-qrcode-svg` are all cross-platform**, so compositing,
  logos and the success QR render identically.
* **`ScreenErrorBoundary`** means a JS crash degrades to a recoverable screen instead of closing the app
  — much more important on iPad, where an app killed by the OS cannot be relaunched by a guest.
* **`PrivacyInfo.xcprivacy`** already declares `FileTimestamp`, `UserDefaults` and `SystemBootTime` with
  their required reasons, which is exactly what App Store review checks for since May 2024.

---

## 6. Kiosk lockdown on iPad

iPadOS has no equivalent of Android's Lock Task Mode that an app can switch on by itself. Three
options, in order of robustness:

### 6.1 Guided Access (no MDM, works today, manual per device)

1. Settings → **Accessibility → Guided Access** → on.
2. Set a **Guided Access passcode** (not the device passcode).
3. Settings → **Display & Brightness → Auto-Lock → Never**.
4. Open HappyPix Booth, triple-click the side (or home) button, then **Start**.
5. Optionally disable hardware buttons and touch areas during the session.

Limitations: a guest cannot leave, but **staff must triple-click to exit**, and it survives an app
restart but not a device reboot. For a single booth run this is enough.

### 6.2 Single App Mode via MDM (the right answer for a fleet)

Any MDM (Jamf, Kandji, Mosyle, Apple Business Manager) can push **Single App Mode** with an allow-list
containing only `com.happypix.booth`. Combined with an **Apple Business Manager** enrolment this gives:
auto-launch after boot, no home button, no notifications, no Settings.

Also push: **Auto-Lock: Never**, **disable screenshots**, and if using Guided Access instead, set the
passcode from the MDM.

### 6.3 What still needs code (IP-1, IP-2)

Even with Guided Access, two things should be fixed in the app:

* `isIdleTimerDisabled = true` while a session is on screen. A small Swift module is enough:

  ```swift
  // ios/booth/IdleTimer.swift
  import UIKit
  @objc(IdleTimer)
  class IdleTimer: NSObject {
    @objc func setDisabled(_ disabled: Bool) {
      DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = disabled }
    }
    @objc static func requiresMainQueueSetup() -> Bool { true }
  }
  ```

  …registered with an `RCT_EXTERN_MODULE` bridge file and wired into `KioskModule.keepScreenOn`, which
  currently returns early without touching anything (IP-2).

* `KioskModule.startKiosk()` on iOS should either be a no-op that **logs clearly** ("iOS kiosk requires
  Guided Access / Single App Mode") or, better, call a `UIAccessibility`/`UIAccessibility.isGuidedAccessEnabled`
  check so the app can show a "kiosk not locked" banner on the waiting screen.

**Do not** attempt to hide the home indicator permanently; on iPad it is controlled by the system.

---

## 7. Printing from an iPad

This is the finding that decides whether an iPad booth is viable. Options:

| Path | What it needs | Status |
|---|---|---|
| **A · HappyPix Print Bridge on a PC** | A Windows/macOS machine on the same LAN running `electron/`'s print bridge (`:9123`); the iPad posts the composite to it | **Recommended now.** The `DNPProvider` path is already written; the only iPad-specific work is the Local Network permission (IP-3) and pointing it at the bridge's LAN IP (the current default probe list is emulator-centric: `10.0.2.2`, `127.0.0.1`) |
| **B · Native AirPrint** | A Swift module using `UIPrinter(url:)` + `UIPrintInteractionController.print(to:completionHandler:)`, or `UIPrintInteractionController.shared.print(to:completionHandler:)`; `NSLocalNetworkUsageDescription`; a real AirPrint printer (DNP QW410 and Citizen CX-02W both expose it) | Not implemented; `AirPrintProvider` is the stub in IP-8 |
| **C · Direct IPP from JS** | A correct RFC 8011 body (operation attributes + document-format `image/jpeg`/`image/pwg-raster`) **and** an ATS exception for the printer's host | Not viable as written (IP-9). Do not ship this |
| **D · USB printer via USB-C adapter** | A native driver per printer model; not a realistic path | Rejected |

**Decision for the docs and the product:** on iPad, print through **path A** for photo booths with a
dye-sub printer, and treat **path B** as the roadmap item that removes the PC from the deployment.
The Electron app already contains a print server; the iPad simply becomes another client of it.

Sizing note: the bridge receives a base64 JPEG of the composite — the same payload the Android booth
sends today, so no protocol change is required.

---

## 8. Distribution: TestFlight and the App Store

1. **App ID** — create `com.happypix.booth` in the Apple Developer portal, enable nothing special
   (no push, no IAP, no HealthKit).
2. **Signing** — automatic signing with an organisation team; commit an `ExportOptions.plist` for
   `app-store` distribution. Do **not** commit certificates or provisioning profiles.
3. **Icons (IP-6)** — 1024×1024 marketing icon plus the iPad slots; generate the whole set from one
   source image. Without this the archive fails validation.
4. **Privacy manifest** — already present. Additionally answer the App Store **privacy questions**:
   the app itself collects nothing directly, but photos are uploaded to the organisation's account, so
   declare "Photos or Videos" as *collected, not used for tracking, linked to the organisation*.
5. **Export compliance (added)** — `ITSAppUsesNonExemptEncryption = false` in `Info.plist`, because the
   app only uses HTTPS. Without it every TestFlight upload asks the question again.
6. **Local Network (IP-3)** — declare `NSLocalNetworkUsageDescription` (added) and, if mDNS discovery
   is added later, `NSBonjourServices` (`_ipp._tcp`, `_ipps._tcp`, `_printer._tcp`, `_pdl-datastream._tcp`).
7. **Review notes** — explain that the app is a **kiosk for staff devices**, that account credentials
   are provisioned by the operator, and that there is no public sign-up. Apps whose only login is
   operator-provisioned are accepted, but say so explicitly.
8. **TestFlight** — internal testers first (the operations team), external later. Kiosk behaviour
   (no exit) is exactly the kind of thing a reviewer will question; ship Guided Access instructions in
   the review notes.

Build commands that should become the CI job:

```bash
cd client-app/apps/booth
bundle exec pod install --project-directory=ios
xcodebuild -workspace ios/booth.xcworkspace -scheme booth \
  -configuration Release -sdk iphoneos \
  -archivePath build/booth.xcarchive archive
xcodebuild -exportArchive -archivePath build/booth.xcarchive \
  -exportOptionsPlist ios/ExportOptions.plist -exportPath build/ipa
```

(`booth.xcworkspace` only exists after `pod install`; it is not committed, correctly.)

---

## 9. iPad test matrix and QA checklist

### 9.1 Devices worth testing

| Class | Device | Why |
|---|---|---|
| 10.9" baseline | iPad (10th gen) | Same 4:3 ratio as the Android tablets the layout was tuned for |
| 12.9"/13" | iPad Pro (M4) | 1366 pt wide in landscape — exercises the `INTERACTION_ZONE_MAX_WIDTH = 1000` cap and the 1.33× scale |
| Small | iPad mini (A17) | 1133 pt wide; tightest vertical space |
| Oldest supported | iPad (9th gen), iPadOS 15.1 | The deployment target floor |
| Negative | iPad in Split View / Slide Over | Must be impossible after IP-4 — verify the app refuses to resize |

### 9.2 Checklist (run on a real iPad, not just the simulator)

- [ ] Cold launch in **portrait** — text is not tiny (the `responsive.ts` regression that was fixed).
- [ ] Rotate to landscape and back mid-session — layout reflows, camera preview survives (`key` prop on `<Camera>` forces a remount).
- [ ] Local Network prompt appears once, on first login, with a sensible reason string.
- [ ] Deny Local Network → printing/discovery fails with a **readable** message, not a hang.
- [ ] Home button / swipe up cannot leave the app (Guided Access or Single App Mode active).
- [ ] Screen does not auto-lock during a 10-minute idle on the `Waiting` screen.
- [ ] Bottom buttons clear the home indicator (IP-5).
- [ ] Shutter, click and success sounds are audible at 50 % volume (IP-7).
- [ ] UPI QR scans from a phone at arm's length in landscape.
- [ ] Payment polling recovers when the iPad sleeps and wakes.
- [ ] Print: composite reaches the printer at the right size on 4×6 and 2×6 strip.
- [ ] Session upload finishes on a flaky LAN; the offline queue drains after reconnect.
- [ ] Guest download QR opens on an iPhone and the photo downloads.
- [ ] Raise-an-issue from the success screen creates a ticket visible in the CRM.
- [ ] Airplane mode during a session → physical print still works (path A), upload queues.
- [ ] App Backgrounded for 15 minutes → returns to the same screen with a valid session.
- [ ] Memory: 60 sessions back-to-back without a leak (`Xcode → Debug Memory Graph`).

### 9.3 What the simulator cannot tell you

Camera framing, ring-light behaviour, print quality, Touch ID/passcode prompts, Guided Access,
Local Network permission dialogs, and real thermal throttling. **Every one of those needs a device.**

---

## 10. What is left to do

Ordered so that the first four make an iPad booth usable in a controlled deployment; the rest is
hardening. This is the same list that appears in the chat hand-off, kept here so it does not get lost.

| # | Task | Closes | Effort |
|---|---|---|---|
| 1 | Add `NSLocalNetworkUsageDescription`, `UIRequiresFullScreen`, `ITSAppUsesNonExemptEncryption` | IP-3, IP-4, §8.5 | **done in this change** |
| 2 | Generate the full `AppIcon` set (iPhone + iPad + 1024 marketing) from one source | IP-6 | 1 hour |
| 3 | Swift `IdleTimer` module + wire `KioskModule.keepScreenOn`; log clearly when kiosk lockdown is not active | IP-1, IP-2 | half a day |
| 4 | Adopt `useSafeAreaInsets` in `ScreenContainer`; remove the `StatusBar` override | IP-5, IP-11 | 2 hours |
| 5 | Point the DNP bridge probe at a configurable LAN host; document path A for iPad | §7 | 2 hours |
| 6 | Native AirPrint module (`UIPrinter` + `UIPrintInteractionController`) | IP-8, §7 path B | 3–5 days |
| 7 | Add an iOS sound module (or `react-native-sound`) for shutter/click/success | IP-7 | half a day |
| 8 | Read `appVersion`/`build` from `CFBundleShortVersionString` + `CFBundleVersion`; remove `10.0.2.2` defaults on iOS | IP-12, §3.3 | 2 hours |
| 9 | Fastlane `beta` lane + GitHub Actions macOS runner → TestFlight | IP-15 | 1–2 days |
| 10 | Rewrite `IPPProvider` against RFC 8011 properly, or delete it and rely on AirPrint/bridge | IP-9 | 2–3 days |
| 11 | Decide on `react-native-zeroconf`: use it with `NSBonjourServices`, or delete the dependency | IP-14 | 1 day |
| 12 | Foreground/background drain strategy for the offline queue (`BGTaskScheduler` or a "sync now" prompt) | IP-18 | 2 days |
| 13 | Audit every screen for a visible back/exit affordance now that there is no hardware back | IP-16 | 2 hours |
| 14 | iPad-specific golden-path recording + add the devices above to the QA matrix | §9 | 1 day |
| 15 | Guided Access / Single App Mode runbook for field staff — §5.2.1 of `USER_ADMIN_GUIDE.md` now covers first-run permissions and lockdown; the reboot / locked-out / passcode-lost cases still need writing | §6 | 2 hours |

Everything in rows 1–5 and 7 is small; row 6 is the only piece that is a genuine feature build, and it
is only needed to remove the PC from a booth deployment.
