/**
 * Native asset linking.
 *
 * The kiosk bundles Fredoka and Nunito (Electron's type pair) because a booth
 * never has a usable network font path at an event. The TTFs therefore have to
 * reach both native projects:
 *
 *   android/app/src/main/assets/fonts/   ← fontFamily = file name without .ttf
 *   ios/booth/Fonts/ + UIAppFonts        ← fontFamily = PostScript name
 *
 * `npx react-native-asset` (or `react-native link`) re-copies them if a font is
 * added or replaced. The PostScript names match the file names in this set, so
 * the same `fonts` map in packages/ui works on both platforms.
 */
module.exports = {
  assets: ['./assets/fonts/'],
};
