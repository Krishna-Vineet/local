import { Dimensions, PixelRatio, Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────
//  Responsive scaling — Happypix Booth
//
//  All sizes in the app are authored against a 10" tablet held in
//  LANDSCAPE (1024 × 768) and scaled up/down for the real device.
//
//  FIX (root cause of "small text when booting in portrait"):
//   · The window size is no longer frozen at module load. We keep a
//     live copy that updates whenever the window changes (rotation,
//     kiosk window resize, orientation change at cold boot).
//   · We always normalise to LANDSCAPE (larger side = width basis),
//     so the scale factor is identical no matter which orientation
//     the app cold-boots in.
//
//  All existing exports keep the same names/signatures.
// ─────────────────────────────────────────────────────────────────

const GUIDELINE_BASE_WIDTH = 1024;
const GUIDELINE_BASE_HEIGHT = 768;

// Live window size, updated on every 'change' event.
let _window = Dimensions.get('window');
let _w = _window.width;
let _h = _window.height;

try {
  Dimensions.addEventListener('change', ({ window }) => {
    if (window && window.width > 0 && window.height > 0) {
      _w = window.width;
      _h = window.height;
    }
  });
} catch (_) {
  /* older RN runtimes without addEventListener — fall back to static values */
}

/**
 * Live, orientation-normalised screen size (landscape basis).
 */
export const getScreenDimensions = () => {
  const isLandscape = _w > _h;
  return {
    width: isLandscape ? _w : _h,
    height: isLandscape ? _h : _w,
    isLandscape,
  };
};

/**
 * Scales a size based on the device width.
 * Best for spacing, widths, and margins.
 */
export const scale = (size: number): number =>
  (getScreenDimensions().width / GUIDELINE_BASE_WIDTH) * size;

/**
 * Scales a size based on the device height.
 * Best for vertical spacing, heights.
 */
export const verticalScale = (size: number): number =>
  (getScreenDimensions().height / GUIDELINE_BASE_HEIGHT) * size;

/**
 * Moderate scaling for a balanced look.
 * Useful for components that shouldn't grow as fast as width.
 */
export const moderateScale = (size: number, factor = 0.5): number =>
  size + (scale(size) - size) * factor;

/**
 * Optimized font scaling.
 * Includes a maximum scale cap to prevent text from becoming too big
 * on massive screens. (Raise MAX_SCALE if you want larger text on
 * 20"–30" kiosk monitors.)
 */
export const fontSize = (size: number): number => {
  const MAX_SCALE = 1.5;
  const scaled = scale(size);
  const capped = Math.min(scaled, size * MAX_SCALE);
  const rounded = Math.round(PixelRatio.roundToNearestPixel(capped));
  const result = Platform.OS === 'ios' ? rounded : rounded - 2;
  return Math.max(1, result);
};

/**
 * Detects if the device is a "Large Screen" (Tablet/Kiosk).
 */
export const isLargeScreen: boolean = getScreenDimensions().width >= 768;

/**
 * Returns a constrained width for interaction zones on wide screens.
 */
export const INTERACTION_ZONE_MAX_WIDTH = 1000;
