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

Sizing type is an emoji, and an emoji's size is a *proportion of the print*, not
a font size. Both the customise preview and `RenderEngine` now compute
`dims.width * size / STICKER_UNIT` (`STICKER_UNIT = 500`), so a sticker has the
same footprint on screen and on paper.

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

### 6.6 Idle timer is invisible until it matters

The header used to render a red `{secondsLeft}s` pill from the first second of a
session, and the welcome screen printed "returns in Ns" — both read as errors.
Electron shows no idle clock at all. The countdown now surfaces only through
`InactivityToast`, which returns `null` unless `0 < secondsLeft <= 20` (red at
10 s or less), and the header pill and welcome countdown are gone.

Also fixed: `finishAndPrint(patch)` takes the final customisation in the same call
that renders the print, because a `updateSession(...)` immediately before it is
still in flight when the composite is built — the last consent/filter/sticker
edit could miss the print entirely.
