# Booth UI parity — one design language for the Electron kiosk and the tablets

The desktop kiosk (`electron/`) and the tablet app (`client-app/apps/booth/`) are
the same product, so they now share one visual language. **Electron is the
source of truth** for colour, type, radii, spacing, motion and sound. When the
two disagree, the tablet follows the desktop — the only exception so far is the
hardware telemetry dock, which started on the tablets and was then added to the
desktop login screen.

This note records where each piece lives so the next change lands in both
places instead of drifting.

## 1. Tokens

| Token | Value | Electron | React Native |
| --- | --- | --- | --- |
| app background | `#f8f5fb` (gradient `#fcfafd → #f7f2fa`) | `--bg` in `index.css` | `theme.palette.background` |
| surface / soft | `#ffffff` / `#fbf8fd` | `--surface`, `--surface-soft` | `palette.surface`, `palette.surfaceSoft` |
| line | `#e9e0ef` | `--line` | `palette.line` |
| ink / muted / faint | `#281637` / `#776982` / `#a498aa` | `--ink`, `--muted`, `--faint` | `palette.ink` … |
| pink (primary) | `#ee4c96`, deep `#d52d7b`, soft `#ffedf6` | `--pink*` | `palette.pink*` |
| violet | `#6f4bc5`, soft `#f0eafd` | `--violet*` | `palette.violet*` |
| radix scale | 8 · 11 · 14 · 17 · 22 · 26 · 30 | hard-coded per rule | `radii.*` |
| card shadow | `0 20px 60px rgba(60,32,75,.13)` | `--shadow` | `shadows.card` |
| soft shadow | `0 10px 32px rgba(62,34,79,.08)` | `--shadow-soft` | `shadows.soft` |

Category colours used by the diagrams (`docs/DIAGRAMS.md`) use the same palette,
so a screenshot of the booth and a screenshot of the architecture doc agree.

## 2. Type

Fredoka for display (headlines, numerals, price), Nunito for everything else.
Electron loads them through `@fontsource-variable/*`; the tablet bundles static
instances because React Native cannot use variable fonts on every platform it
ships to.

| Role | Font | RN key |
| --- | --- | --- |
| page/section headings, price | Fredoka SemiBold (`Fredoka-SemiBold`) | `fonts.display` |
| taglines, quotes | Fredoka Regular | `fonts.displayLight` |
| body | Nunito Regular | `fonts.body` |
| body emphasis | Nunito SemiBold / Bold | `fonts.bodyMedium` / `fonts.bodyBold` |
| labels, buttons | Nunito ExtraBold | `fonts.bodyHeavy` |
| eyebrows, pills | Nunito Black, `.13–.18em` tracking | `fonts.bodyBlack` |

The nine TTFs live in three places, all of which must stay in step:

```
client-app/apps/booth/assets/fonts/            # source of truth (9 ttf + OFL)
client-app/apps/booth/android/app/src/main/assets/fonts/
client-app/apps/booth/ios/booth/Fonts/         # + UIAppFonts in Info.plist
```

`fontFamily` must match the **PostScript** name (`Fredoka-SemiBold`), not the
file name. Adding a weight means: drop the TTF in all three folders, add the
file name to `UIAppFonts`, and add it to the Xcode project's Resources phase.

## 3. Components

| Electron | React Native |
| --- | --- |
| `ScreenShell` (`booth-header`, `flow-progress`, `screen-heading`) | `app/components/AppShell.tsx` |
| `Icon.tsx` (20 stroke icons, 24×24 viewBox, 1.8 stroke) | `packages/ui/src/components/Icon.tsx` (react-native-svg) |
| `Controls.tsx` — `PrimaryButton`, `NextButton`, `BackButton`, `Pill` | `packages/ui/src/components/Button.tsx` — `Button`, `NextButton`, `BackButton`, `Pill`, `Card`, `Eyebrow`, `Title`, `Subtitle` |

`AppShell` reads the paired organisation and connectivity from `BoothProvider`
(`useOptionalBooth`) so screens only pass what is local to them — a title, a
countdown, or `night` for the camera step.

Screens, both clients, in flow order:

| Step | Electron | React Native |
| --- | --- | --- |
| welcome | `StartScreen` | `StartScreen` |
| orientation | `OrientationScreen` | `LayoutSelectionScreen` |
| templates | `TemplateScreen` | `SlotSelectionScreen` |
| copies | `PrintCountScreen` | `PrintCountScreen` |
| payment | `PaymentScreen` | `PaymentScreen` |
| camera | `CameraScreen` (dark) | `CaptureScreen` (dark) |
| photos | `PhotoSelectionScreen` | `PhotoSelectionScreen` |
| customise | `CustomizeScreen` | `CustomizeScreen` |
| done + support | `SuccessScreen` | `OrderSuccessScreen` |

The guest-support modal is deliberately identical in both: white card, radius
26, pink chips, Nunito labels in `#655570`. Change one, change the other.

## 4. Sound

Electron synthesises five cues with WebAudio in `electron/src/ui/services/sound.ts`
(a sine at 520 Hz for a tap, a 520→660→880 arpeggio for success, a noise burst
for the shutter). React Native has no WebAudio, so the *same* tones are baked
into WAV files and played natively:

```bash
python3 apps/booth/scripts/generate_tones.py   # run from client-app/
```

The script writes `click`, `select`, `countdown`, `shutter`, `success`, `beep`
into `android/app/src/main/res/raw/` and `ios/booth/Sounds/`, at the same
frequencies, durations and decay curve as the browser. `SoundPool` (Android) and
`AVAudioPlayer` (iOS) play them; `SoundManager.play('<cue>')` is the only API a
screen should touch, and it is silent — never fatal — when the module is missing.

Keep the two lists in sync:

* `electron/src/ui/services/sound.ts` — `sound.click()`, `sound.select()`, …
* `client-app/apps/booth/src/utils/SoundManager.ts` — `SoundManager.play('click')`, `sound.click()`

## 5. Hardware telemetry

The pairing screen shows camera / printer / display / network readiness before an
operator authenticates — a dead printer should be obvious before an event starts,
not after the first guest.

* Tablet: `client-app/apps/booth/src/screens/LoginScreen.tsx` probes
  `cameraManager.autoSelect()` and `printerManager.discover()`.
* Desktop: `electron/src/ui/components/HardwareDock.tsx` reads the snapshot the
  main process already keeps (`booth:system-snapshot`, refreshed every 5 s).

Both use the same three states (ready / attention / probing) and the same
wording, so a support call sounds the same wherever the booth runs.

## 6. Print pipeline parity — the four defects of 2026-10-29

A round of tablet screenshots showed the tablet drifting from the desktop in ways
that looked cosmetic but were not. Each one is recorded here with its cause, so it
is not "fixed" back later.

### 6.1 Photo selection — same state machine as Electron

`PhotoSelectionScreen` is a port of `electron/src/ui/screens/PhotoSelectionScreen.tsx`:
slots start **empty**, tapping a photo fills the active slot and auto-advances,
tapping a photo already in a *different* slot swaps it with the active slot, and
tapping the photo in the active slot clears it. Slot tap = activate — or clear,
when it is the active slot and full. Next stays disabled until the number of
filled slots equals the template's slot count.

A sticker is `{ id, emoji, x, y, scale }` — `x`/`y` are percentages of the print
(clamped 0–100 while dragging) and `scale` is 0.5–4 in 0.25 steps, exactly
Electron's model. One em is 9.6 % of the print width, so the customise preview
and `RenderEngine` both compute `dims.width * 0.096 * scale`
(`STICKER_EM_FRACTION`) and a sticker prints at the size it was placed at. There
are no −/+/× controls on the image: they live in the Stickers list, because a
toolbar pinned to a drag point drifts off the print at the frame edge.

### 6.2 Stickers in the final print

`RenderEngine` draws stickers with `ctx.fillText`. `SkiaRenderAdapter.fillText`
resolved a font with `matchFont({fontSize, fontWeight})` — one family, no
fallback — and a text face has no emoji glyphs, so every sticker printed as
blank space even though the preview was correct. The adapter now:

1. parses the CSS family list off `ctx.font`;
2. for emoji strings, prefers a platform emoji face (`listFontFamilies()` is
   filtered for `/emoji/`, with the well-known names appended as a belt-and-braces
   list);
3. verifies each candidate with `getGlyphIDs(text)` — a candidate with a zero
   glyph id is a tofu box, so it is rejected;
4. falls back to `SkParagraph` (`Skia.ParagraphBuilder`), which applies the
   platform fallback chain and therefore renders what no single family could.

`RenderEngine` also clears the paint's colour filter before the sticker pass:
Skia colour matrices live on the `Paint`, so `save()/restore()` does not undo
them and a B&W session printed grey stickers.

### 6.3 Colour — no tinted surfaces, no scrims

* Filters are colour matrices (`packages/ui/src/utils/filters.ts`). B&W is
  `contrast(1.15) × GRAYSCALE` — a real luma matrix, so it is grey, not brown.
* Where a platform cannot run Skia, `FilteredImage` / `TemplateCanvas` fall back
  to a *weak neutral* overlay (`rgba(250,250,252,.08)`). Earlier fallbacks were
  dark scrims at 55–65 % opacity, which is why "B&W" looked like a grey photo of
  a dark room.
* Template cards are white with a transparent 2 px border that turns pink on
  selection, plus a soft pink shadow — never a pink-filled card.
* Photo slots are `rgba(255,255,255,.14)` with a `.78` white border. Tinting a
  slot with the palette produced the black-slot / mustard-card artefacts.
* Filter swatches in the customise screen render the guest's own photo through
  the real matrix; a flat coloured chip told nobody what B&W would do.
* The ambient background is two `react-native-svg` radial gradients (pink bottom
  left, violet top right). Flat low-opacity circles show their edge on a
  1280 px-wide tablet — a CSS `radial-gradient` cannot be faked with a `View`.

### 6.4 Layout — content fills the screen

Electron's `.screen-content` is `flex: 1` with `.screen-actions` pinned below, so
the body owns the full height. `AppShell` now centres its body by default
(`stretch` opts out for scrolling/table bodies), and each screen wraps its main
row in a `flex: 1` body with the action row outside it. The hand-computed canvas
pixels that let a preview overflow its card are gone: `TemplatePreview` measures
its box and fits the print inside it, and exposes the resolved size through an
`overlay(size)` render prop so the sticker layer shares the print's coordinate
space.

### 6.5 One slot resolver

`packages/ui/src/utils/photoSlots.ts` is the only place that decides which photos
go where. `resolvePhotoSlots`, `resolveSlotCount`, `placeSlot` and
`slotFractions` are used by the preview (`TemplateCanvas`), the selection screens
(`PhotoSelection`, `Capture`) and the print mapper
(`boothTemplateToPrintTemplate`). Before this each derived slot geometry on its
own — and `layout.slots`, which is a *count*, was mistaken for a slot list — so a
photo could sit in slot 2 on screen and slot 1 on paper.

### 6.6 The idle timer: a pill in the header, a toast only at the end

The first attempt over-corrected. Electron *does* keep a clock on screen the
whole time — `.timer-pill` sits beside `.connection-state` for the entire
session — and removing it left the tablet with no idle feedback at all. The pill
is therefore back and always visible: `HH:MM`-less `Ns` on `--red-soft`, turning
solid red (`--red`, white text) at ≤ 10 s, matching `.timer-pill.is-urgent`.

What stays threshold-gated is the *toast*: `InactivityToast` returns `null`
unless `0 < secondsLeft <= 20`, so the modal never appears early. The welcome
screen's "returns in Ns" line is gone for good — that one was invented here,
not in Electron.

Also fixed: `finishAndPrint(patch)` takes the final customisation in the same call
that renders the print, because a `updateSession(...)` immediately before it is
still in flight when the composite is built — the last consent/filter/sticker
edit could miss the print entirely.

## 7. Correction history — the round-3 diff, screen by screen

The user diffed `electron ui.pdf` against `Native UI.pdf` and sent the two files
back with three instructions: the navbar is not at the very top, branding is the
HappyPix mark plus the organisation name and nothing else, and the timer pill is
missing. Everything else in this section is the same exercise carried out across
all nine screens — what the tablet had, what Electron has, what changed. Nothing
here is a redesign: Electron is the source of truth, and every value below was
copied out of `electron/src/ui/App.css`.

### 7.1 Shell and header — `AppShell.tsx`

| | |
|---|---|
| Native had | `paddingTop: insets.top` on the *shell*, so the page background showed above the bar — the "navbar is not on complete top" report. A second `HappyPix` wordmark node beside the logo. No timer. Progress rail was six flat pink dots, 26 × 5. |
| Electron has | `.screen-shell` rows `74px auto 1fr`; the header is the topmost element and owns the safe-area strip. `Brand compact` (mark only — the asset already carries the wordmark) + `.header-divider` + `.org-brand`. `.flow-progress` bars `clamp(18px, 2.6vw, 42px) × 5px`, done = `linear-gradient(90deg, #ee4c96, #a968d9)`. `.connection-state` and `.timer-pill`, both 34 px tall, 11 px/850; timer `min-width: 69px`, `is-urgent` at ≤ 10 s. |
| Now | The header owns the insets (`paddingTop: insets.top + 6`, `height: clamp(58, 11vh, 74) + insets.top`), so it is flush with the top edge on iPad and Android alike. Wordmark removed. Timer pill restored and **always visible**, red + white at ≤ 10 s. Progress bars are `Svg` rects with the real pink→violet gradient. `headerLeft` is `flex: 1; minWidth: 0` so the rail stays centred whatever the org name's length. |

### 7.2 Start screen — `StartScreen.tsx`

| | |
|---|---|
| Native had | Three white frames over flat tinted blocks, an oversized seal, and a fat full-width prompt pill at the bottom. |
| Electron has | `.start-art` at `min(39vw, 570px)` with aspect `0.92`, three flat CSS-shape prints at `3 %/30 %/29 %/3 % #f4a3bd −7°`, `23 %/1 %/7 %/36 % #ef83ab +7°`, `35 %/24 %/2 %/17 % #e4a1bc`, and a 74 px pink heart at `left 47 % / top 42 %`. Type: `WELCOME TO` eyebrow, 52 px event name, `clientName · location`, optional tagline in curly quotes. Bottom right: a quiet "Touch anywhere to begin" with a 42 px pink arrow disc. |
| Now | Rebuilt as one full-screen `Pressable` with exactly those three shapes, the 74 px heart seal, the eyebrow/name/meta/tagline stack and the bottom-right prompt + arrow disc with a nudge animation. Landscape is a two-column split, portrait stacks. |

### 7.3 Orientation screen — `LayoutSelectionScreen.tsx`

| | |
|---|---|
| Native had | Pale flat blocks for the two paper shapes, a grid that stretched edge to edge, and a centred check badge on selection. |
| Electron has | `.paper-shape--portrait` 130 × 200, `.paper-shape--landscape` 210 × 140, both with a 6 px white border and slot placeholders; card grid `max-width: 1050`, gap 30; card padding `0 34`, `min-height: 300`, gap 27; check badge absolute top-right, 35 px. |
| Now | Same geometry: 130 × 200 / 210 × 140 papers with white borders and real slot rows/columns, grid capped at 1050 with 30 gap, cards `minHeight: 300`, badge moved to the top-right at 35 px. |

### 7.4 Template strip — `SlotSelectionScreen.tsx`

| | |
|---|---|
| Native had | A vertically scrolling page of cards, slot borders tinted with the accent (`accent+'70'`), dark 12 % fill, badge top-left, previews that were not clipped to the card. |
| Electron has | `.template-carousel` — horizontal, scroll-snap, `flex: 0 0 clamp(260px, 23vw, 345px)`; preview background `#efe8f2`; `.selected-badge` bottom-centre; `.template-slot` `2px rgba(255,255,255,.78)` + `rgba(255,255,255,.14)` fill, numeral `8cqw`. |
| Now | Page scrolling removed — the screen is a single `stretch` body with a horizontal `ScrollView` carousel, `cardWidth = clamp(260, 23vw, 345)`, `previewHeight = min(41vh, 420)`. Cards carry labelled `PRINT SIZE` / `PHOTOS` chip groups, the "Selected" pill at the bottom centre, the price as a `Pill`, and a proper empty state. **Empty slots now use Electron's white chrome**: 2 px `rgba(255,255,255,.78)` ring, `.14` white fill, white numerals `max(9, 8 %w)` — the mustard/orange rectangles are gone from both the kiosk and the studio, because `TemplateCanvas` is shared and the tinted borders were the bug. |

### 7.5 Print count — `PrintCountScreen.tsx`

| | |
|---|---|
| Native had | The preview computed from the card's own padding and escaping the card; count buttons scaled from the 1024 guideline and read small. |
| Electron has | `.count-options` buttons `clamp(58px, 5vw, 78px)`; the print frame pinned to `min(34vh, 300px)` on the stage; panel padding 34. |
| Now | `previewHeight = min(34vh, 300)` passed to `TemplatePreview` on the stage, `countSize = clamp(58, 5vw, 78)` round buttons, `previewCard` clips (`overflow: 'hidden'`), panel padding 34. |

### 7.6 Payment — `PaymentScreen.tsx`

| | |
|---|---|
| Native had | Oversized mock cards that floated in the middle of the page without a shared baseline. |
| Electron has | `.payment-layout` `max-width: 1030`, gap 54; `.summary-card` padding 42, radius 28, softer shadow, stretching with the column. |
| Now | `mainLayout` capped at 1030 with a 54 gap; summary and coupon cards are `flex: 1` / `alignSelf: 'stretch'` with 42 padding and radius 28; the coupon block gained a 54 px pink-soft ticket disc. |

### 7.7 Camera — `CaptureScreen.tsx`

| | |
|---|---|
| Native had | A bare full-bleed viewfinder, a floating status pill and a right-hand thumbnail rail — none of which exist in Electron. The film rebate and sprocket styles were in the file but **never rendered**. |
| Electron has | `.camera-hud` (55 px: hardware dot + camera name left, `CAPTURE n / total` + 4 px progress bar right), then `.camera-workspace` = `minmax(145px, 18vw)` `.film-reel` + `.viewfinder`. The reel is a 2-column `.film-track` of `.film-cell`s with sprocket strips and a per-frame number, current frame ringed pink. `.viewfinder` is `28px / 1fr / 28px`: top rebate `KODAK PORTRA 400 · HAPPYPIX LIVE · ISO AUTO`, bottom rebate `EXP n/total · LOOK HERE & SMILE · SAFETY FILM`, with 48 px focus corners and a glass shutter pill (white-ringed 58 px disc + "Start shooting"). Countdown is a full-frame wash with a `clamp(90, 16vw, 230)` digit. |
| Now | Rebuilt to that structure. Landscape = reel column left / viewfinder right; portrait = viewfinder on top / 118 px reel strip below, mirroring Electron's `max-height: 720px` media query. The sprocket strips, frame numbers, rebate lines, focus corners, progress bar and glass shutter are all present; countdown washes the whole frame; the old floating pill and side rail are gone. |

### 7.8 Photo selection — selection logic

| | |
|---|---|
| Native had (before round 2) | Auto-selection of the first *N* shots. |
| Electron has | Slot list starts empty; tap a photo → fills the active slot and advances past it; tap a photo already in another slot → swaps it with the active slot; tap the active slot's own photo → clears it; tap a slot → make it active (or clear it when it is active and full). Next is disabled until `filled === slots`. |
| Now | Identical state machine (`handlePhotoTap` / `handleSlotTap`), including the wrap-around "any empty" fallback and the disabled Next. Slot count comes only from `resolveSlotCount`, and the preview is `TemplatePreview` so the canvas can no longer overflow its column. |

### 7.9 Customise — sticker model and controls

| | |
|---|---|
| Native had | `{ x, y, size }` with size in an invented unit, `x`/`y` clamped to 0–90, and −/+/× buttons floating on the image (half of them outside the frame at the edges). |
| Electron has | `{ id, emoji, x, y, scale }`; drag clamps to 0–100 % on both axes; `.placed-sticker` is `translate(-50%,-50%)` at `font-size: scale * 8cqw`; scale is 0.5–4 in 0.25 steps; − / % / + / × live in `.sticker-list-row` inside the Stickers tab. |
| Now | The model is `scale`, clamped 0.5–4 in 0.25 steps and rendered at `9.6 % × scale` of the print width in both the preview and the 300 dpi composite; drag clamps to 0–100; no controls on the print at all; the list rows carry 34 px −/+, the percentage, and the red ×, matching `.sticker-size-btn` / `.sticker-size-value` / `.sticker-delete-btn`. "Preparing your print…" is now Electron's dim wash + pill rather than a floating spinner. |

### 7.10 Success / QR and the guest-support modal — `OrderSuccessScreen.tsx`

| | |
|---|---|
| Native had (before round 2) | A dark screen with a single centred card — it looked like a different product at the most-photographed moment. |
| Electron has | `.success-screen` light, `.success-layout` `1.08fr .72fr` gap `clamp(25, 6vw, 90)`; 100 px success mark, radius 32, rotated −3°; title `clamp(43px, 5vw, 72px)`; `.download-card` padding `clamp(24px, 3vw, 40px)`, radius 29, QR `min(29vh, 270px)`; "⚠ Need Help? Raise a Guest Support Ticket" as a quiet underlined link; the modal is a 600 px card (`radius 26`, 2-column `.cat-chip` grid, 50 px inputs, `.issue-meta` strip, `.ticket-success` state). |
| Now | The light layout, both columns and the whole modal already existed from round 2; this round brings the *measurements* in line — mark 100 px/radius 32, title and QR sized from the real clamps instead of fixed `fontSize()` values, layout gap and card padding from the CSS, `.72` side column, and Electron's exact copy ("Your digital copy", "🔒 Link is secured and valid for 24 hours", the ⚠ help link). Modal categories, contact + name + description fields, session/event meta strip, inline error and the submitted-ticket reference are unchanged and shared verbatim with Electron. |

### 7.11 What was deliberately *not* copied

* Backdrop blur (`backdrop-filter`) — React Native has no equivalent; a
  translucent surface at the same opacity reads identically at kiosk distance.
* The CSS `radial-gradient` page washes — drawn as `react-native-svg` radial
  fills instead, for the reason in §6.3.
* Hover states (`:hover`) — there is no pointer on a tablet; the `:active`
  press transform is kept.

### 7.12 Standing rule

When the tablet and the desktop disagree, **Electron wins** and the change is
made here, not there. The only exception is the support modal, which is shared
design and must be fixed in both. Every value in this section is traceable to a
rule in `electron/src/ui/App.css`; if a future edit cannot name that rule, it is
not parity, it is a new design decision and needs the user's sign-off.

## 8. Correction history — round 4 (device screenshots)

Three reports came back from the tablet with a screenshot each: the camera screen
"is not good", the app still shows a strip of page background above the header,
and the three start-screen photo cards "are just boxes".

### 8.1 The top strip — it was the safe area, and the fix is not to consume it

The header was padded by `insets.top` on top of a 6 px pad. The arithmetic looked
right — the bar's *content* was being kept clear of the status bar — but the
window is not edge-to-edge on every device, so the inset being "protected" was a
real, visible system strip, and the result was a bar floating roughly 25 px below
the top of the screen with a band of page colour above it.

* `AppShell` no longer consumes the top inset at all: the header is `paddingTop 0`
  with `height: clamp(58, 11vh, 74)`, so it owns y = 0 on every platform. The
  bottom inset (home indicator) is still honoured.
* `LoginScreen` and `WaitingScreen` had the same `paddingTop: insets.top`; both
  dropped it.
* New `useEdgeToEdge()` in `apps/booth/App.tsx` re-applies
  `KioskModule.setImmersiveMode(true)` at boot and on every return to the
  foreground (Android only). The strip was not only a layout bug: a status bar
  that reappears after a swipe re-introduces both the bar and the inset, which is
  how it kept coming back.

### 8.2 Camera — the shutter pill was mis-sized, and the reel was empty

| | |
|---|---|
| Reported | "This camera screen is not good." |
| Cause | The shutter pill was a fixed 280 px wide row: a 58 px disc plus two *fixed* 183 px text columns inside 243 px of content, so the copy wrapped under the disc and the pill grew to ~175 px tall. At `rgba(15,10,20,.78)` over a bright live feed it also turned into a muddy blob. Separately the reel used `flexWrap` with `min-height: 72` cells, so four shots hugged the top of a 465 px column and left a dead rectangle underneath. |
| Now | The pill is content-sized (`alignSelf: center` in a full-width dock at `bottom: 8%`), one copy column, `rgba(14,9,19,.90)` so white text holds on any frame, and the shutter disc carries the pink glow. The reel is built as explicit rows of two (`reelRows`), each row `flex: 1`, so N shots fill the column instead of floating at the top; portrait keeps the single strip under the viewfinder. Camera glyphs now come from the shared `Icon` set instead of hand-written SVG paths, and the "no feed" state is a ringed badge rather than a bare glyph. |

### 8.3 Start screen — the frames hold photographs now

Electron draws `.photo-one|two|three` as three flat CSS blocks. On a desktop page
that reads as art direction; on a tablet, on a screen whose only job is to sell a
photograph, it reads as three empty boxes.

* The frames are polaroids: white card, 6 px padding, photo window, a caption
  strip with the location / organisation / client name, soft shadow, and
  Electron's exact three insets and rotations (`3%/30%/29%/3%` at −7°,
  `23%/1%/7%/36%` at +7°, `35%/24%/2%/17%` at −1°) unchanged.
* The photo inside comes from `event.samplePhotos` — the backend's
  `recentSamplePhotos` already sends up to three recent shots of *this* event, and
  the type has carried the field since the first snapshot.
* With no photos yet (a brand-new event) each frame falls back to a gradient
  panel with the brand heart — pink/rose, violet, peach for the three frames —
  and an `onError` on the `Image` falls back the same way, so a dead URL cannot
  leave a white hole. This is a deliberate, recorded departure from Electron:
  the geometry is the desktop's, the contents are better than blank blocks.

### 8.4 Still outstanding

* The screenshot showed the live preview itself as a green test pattern. That is
  the capture simulator, not the chrome — it renders only when no camera device
  is attached, and it is labelled as a simulator in the HUD.
