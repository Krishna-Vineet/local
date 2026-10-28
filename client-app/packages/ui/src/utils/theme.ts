/**
 * Happypix design tokens — the React Native mirror of `electron/src/ui/index.css`
 * and `electron/src/ui/App.css`.
 *
 * The Electron kiosk is the design reference: warm off-white surfaces, a pink
 * primary, a violet secondary, generous radii and two typefaces (Fredoka for
 * display, Nunito for everything else). Those values are copied here verbatim
 * so a screen built for one client can be read against the other without
 * translation, and so a palette change in one place is a deliberate decision.
 *
 * Rules of the road:
 *  · never hardcode a hex in a screen — import from here;
 *  · `fonts.*` are PostScript names that exist on BOTH platforms (the TTFs are
 *    bundled at `apps/booth/assets/fonts`, mirrored into the Android assets and
 *    the iOS bundle), so no `Platform.select` is needed at call sites;
 *  · sizes come from the existing `responsive.ts` helpers, not from this file.
 */

import type { TextStyle } from 'react-native';

/* ── colours ──────────────────────────────────────────────────────────────
 * Light is the default kiosk skin (Electron ships light). Dark exists for
 * venues that ask for it and for the camera screen, which is always dark.
 */
export interface Palette {
  /** app background */
  background: string;
  /** page gradient stand-ins (RN has no gradients without a dependency) */
  backgroundTop: string;
  backgroundBottom: string;
  /** cards and panels */
  surface: string;
  surfaceSoft: string;
  surfaceMuted: string;
  /** text */
  ink: string;
  muted: string;
  faint: string;
  /** lines */
  line: string;
  lineStrong: string;
  /** brand */
  pink: string;
  pinkDeep: string;
  pinkSoft: string;
  violet: string;
  violetSoft: string;
  green: string;
  greenSoft: string;
  red: string;
  redSoft: string;
  amber: string;
  amberSoft: string;
  /** always-dark chrome (camera screen, splash, modals over photos) */
  night: string;
  nightSoft: string;
  nightLine: string;
  nightText: string;
  nightMuted: string;
  white: string;
  /** photo-film furniture */
  film: string;
  hole: string;
}

export const lightPalette: Palette = {
  background: '#f8f5fb',
  backgroundTop: '#fcfafd',
  backgroundBottom: '#f7f2fa',
  surface: '#ffffff',
  surfaceSoft: '#fbf8fd',
  surfaceMuted: '#f2edf5',
  ink: '#281637',
  muted: '#776982',
  faint: '#a498aa',
  line: '#e9e0ef',
  lineStrong: '#ded3e6',
  pink: '#ee4c96',
  pinkDeep: '#d52d7b',
  pinkSoft: '#ffedf6',
  violet: '#6f4bc5',
  violetSoft: '#f0eafd',
  green: '#21956d',
  greenSoft: '#e7f7f1',
  red: '#d84b64',
  redSoft: '#fff0f2',
  amber: '#d58b22',
  amberSoft: '#fdf3e3',
  night: '#0b0810',
  nightSoft: '#17131b',
  nightLine: '#3c3342',
  nightText: '#f3edf6',
  nightMuted: '#9b8da4',
  white: '#ffffff',
  film: '#17131a',
  hole: '#756878',
};

export const darkPalette: Palette = {
  background: '#12101a',
  backgroundTop: '#171420',
  backgroundBottom: '#12101a',
  surface: '#1a1724',
  surfaceSoft: '#221e2e',
  surfaceMuted: '#221e2e',
  ink: '#ece9f2',
  muted: '#a29bb4',
  faint: '#8a8199',
  line: '#2f2939',
  lineStrong: '#3a3345',
  pink: '#f472b6',
  pinkDeep: '#f9a8d4',
  pinkSoft: '#3a1f2e',
  violet: '#a78bfa',
  violetSoft: '#2a2340',
  green: '#4ade80',
  greenSoft: '#16301f',
  red: '#fb7185',
  redSoft: '#3a1e26',
  amber: '#fbbf24',
  amberSoft: '#3a2f14',
  night: '#07060b',
  nightSoft: '#12101a',
  nightLine: '#332d42',
  nightText: '#f3edf6',
  nightMuted: '#a29bb4',
  white: '#ffffff',
  film: '#0d0b12',
  hole: '#52525b',
};

/* ── shape ────────────────────────────────────────────────────────────────
 * Electron: cards 24–29, panels 18–25, buttons 17, chips/pills 999, inputs 14.
 */
export const radii = {
  xs: 8,
  sm: 11,
  md: 14,
  lg: 17,
  xl: 22,
  card: 26,
  hero: 30,
  pill: 999,
};

/* ── type ─────────────────────────────────────────────────────────────────
 * PostScript names. Fredoka = display (headings, numerals, price), Nunito =
 * body. Electron uses 800/850/900 for captions and buttons, which maps to
 * Nunito-ExtraBold / Nunito-Black here.
 */
export const fonts = {
  display: 'Fredoka-SemiBold',
  displayLight: 'Fredoka-Regular',
  displayMedium: 'Fredoka-Medium',
  displayBold: 'Fredoka-Bold',
  body: 'Nunito-Regular',
  bodyMedium: 'Nunito-SemiBold',
  bodyBold: 'Nunito-Bold',
  bodyHeavy: 'Nunito-ExtraBold',
  bodyBlack: 'Nunito-Black',
};

/** Letter-spaced uppercase label — Electron's `.eyebrow` / `.section-kicker`. */
export const eyebrow = (color: string, size = 11): TextStyle => ({
  fontFamily: fonts.bodyBlack,
  fontSize: size,
  letterSpacing: size * 0.16,
  textTransform: 'uppercase',
  color,
});

/** Big screen title — Electron's `.screen-heading h1`. */
export const display = (size: number, color: string): TextStyle => ({
  fontFamily: fonts.display,
  fontSize: size,
  lineHeight: Math.round(size * 1.08),
  letterSpacing: -size * 0.02,
  color,
});

/** Supporting copy under a title. */
export const body = (size: number, color: string): TextStyle => ({
  fontFamily: fonts.body,
  fontSize: size,
  lineHeight: Math.round(size * 1.5),
  color,
});

/* ── elevation ────────────────────────────────────────────────────────────
 * Electron: --shadow 0 20px 60px rgba(60,32,75,.13), --shadow-soft 0 10px 32px .08
 */
export const shadows = {
  soft: {
    shadowColor: '#3e224f',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  card: {
    shadowColor: '#3c204b',
    shadowOpacity: 0.13,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  lifted: {
    shadowColor: '#d83585',
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
};

/* ── spacing ──────────────────────────────────────────────────────────────*/
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 44 };

/* ── legacy shape ─────────────────────────────────────────────────────────
 * The old `AppTheme` is still what `ThemeContext` hands out, and older
 * components (ScreenContainer, LayoutContainer, GlassCard, BoothButton,
 * ThemeToggle) read `theme.colors.*`. Keep those keys as aliases of the new
 * tokens so nothing has to be rewritten twice.
 */
export interface AppTheme {
  colors: {
    background: string;
    surface: string;
    surfaceSecondary: string;
    text: string;
    textSecondary: string;
    primary: string;
    secondary: string;
    accent: string;
    border: string;
    error: string;
    success: string;
    film: string;
    hole: string;
    glass: string;
  };
  spacing: typeof spacing;
  palette: Palette;
  radii: typeof radii;
  fonts: typeof fonts;
  shadow: typeof shadows;
}

export type ThemeMode = 'light' | 'dark';

const legacy = (palette: Palette): AppTheme['colors'] => ({
  background: palette.background,
  surface: palette.surface,
  surfaceSecondary: palette.surfaceSoft,
  text: palette.ink,
  textSecondary: palette.muted,
  primary: palette.pink,
  secondary: palette.violet,
  accent: palette.green,
  border: palette.line,
  error: palette.red,
  success: palette.green,
  film: palette.film,
  hole: palette.hole,
  glass: 'rgba(255, 255, 255, 0.72)',
});

export const lightTheme: AppTheme = {
  colors: legacy(lightPalette),
  spacing,
  palette: lightPalette,
  radii,
  fonts,
  shadow: shadows,
};

export const darkTheme: AppTheme = {
  colors: legacy(darkPalette),
  spacing,
  palette: darkPalette,
  radii,
  fonts,
  shadow: shadows,
};

/** Electron's own default: light. A kiosk in a bright hall wants light. */
export const defaultTheme = lightTheme;

/** The always-dark look used by the camera screen and the splash. */
export const nightPalette = lightPalette;
