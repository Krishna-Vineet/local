import type { TextStyle, ViewStyle } from 'react-native';
import { fonts } from './theme';

/**
 * Retrofit the kiosk type ramp onto a `StyleSheet` that predates it.
 *
 * Screens written before the Electron pass describe type with `fontWeight`
 * only, which renders in San Francisco/Roboto — visibly different from the
 * Fredoka/Nunito pair the rest of the booth now uses. Rewriting every style by
 * hand is churn with no upside, so this wrapper reads what each style already
 * says and substitutes the matching bundled weight:
 *
 *   · `fontSize >= 17` is a heading  → Fredoka (Display/Medium by weight)
 *   · everything else is body copy   → Nunito (weight-mapped)
 *
 * Any style that already names a `fontFamily` is left untouched, so it is safe
 * to apply to a sheet that is only half converted, and harmless on `View`
 * styles that never render text.
 *
 * Usage (wrap the object, keep `StyleSheet.create`):
 *   const styles = StyleSheet.create(withKioskFonts({ card: { ... }, title: { ... } }));
 */
type StyleMap = Record<string, ViewStyle | TextStyle>;

const bodyFor = (weight?: TextStyle['fontWeight']): string => {
  const w = Number(weight ?? 400);
  if (w >= 900) return fonts.bodyBlack;
  if (w >= 800) return fonts.bodyHeavy;
  if (w >= 700) return fonts.bodyBold;
  if (w >= 600) return fonts.bodyMedium;
  return fonts.body;
};

const displayFor = (weight?: TextStyle['fontWeight']): string => {
  const w = Number(weight ?? 500);
  if (w >= 700) return fonts.displayBold;
  if (w >= 600) return fonts.display;
  return fonts.displayMedium;
};

export const kioskFontFor = (style: TextStyle): string => {
  const size = Number(style.fontSize ?? 14);
  return size >= 17 ? displayFor(style.fontWeight) : bodyFor(style.fontWeight);
};

export const withKioskFonts = <T extends StyleMap>(styles: T): T => {
  const out: StyleMap = {};
  for (const [key, value] of Object.entries(styles)) {
    if (!value || typeof value !== 'object') {
      out[key] = value as ViewStyle;
      continue;
    }
    const style = value as TextStyle;
    if (style.fontFamily) {
      out[key] = style;
      continue;
    }
    const hasText = style.fontSize !== undefined || style.fontWeight !== undefined;
    out[key] = hasText ? { fontFamily: kioskFontFor(style), ...style } : style;
  }
  return out as T;
};

export default withKioskFonts;
