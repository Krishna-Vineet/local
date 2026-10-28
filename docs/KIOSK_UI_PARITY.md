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
