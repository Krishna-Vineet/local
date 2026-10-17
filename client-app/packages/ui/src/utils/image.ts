/*
 * ─────────────────────────────────────────────────────────────────
 *  SAFE IMAGE SOURCES
 * ─────────────────────────────────────────────────────────────────
 *  A captured photo can arrive in several shapes depending on what
 *  `cameraManager.capture()` resolves to:
 *
 *      'file:///...'                 (string)
 *      { uri: 'file:///...' }        (uri object)
 *      { path: '/data/.../123.jpg' } (local temp path, no scheme)
 *      { base64: '...'}              (encoded buffer)
 *      undefined / null / {}         (a failed capture)
 *
 *  Passing any of the "bad" shapes directly to `<Image source={{uri}}>`
 *  makes the NATIVE image loader throw — and on a kiosk that is a hard
 *  app shutdown, not a recoverable React error.
 *
 *  Every screen must build its image source through `safeImageSource()`
 *  and render a placeholder when it returns `null`. Never pass a raw
 *  `image.uri` to `<Image>`.
 * ─────────────────────────────────────────────────────────────────
 */

export type SafeImageSource = { uri: string };

const ensureFileScheme = (p: string): string =>
  p.startsWith('file://') ? p : `file://${p}`;

/**
 * Normalize a captured photo into a source the native `<Image>` loader
 * will accept, or `null` when no valid source can be produced.
 */
export const safeImageSource = (image: any): SafeImageSource | null => {
  if (!image) {
    return null;
  }

  // Already a URI string.
  if (typeof image === 'string') {
    const s = image.trim();
    return s.length > 0 ? { uri: s } : null;
  }

  if (typeof image === 'object') {
    // { uri }
    if (typeof image.uri === 'string' && image.uri.trim().length > 0) {
      return { uri: image.uri.trim() };
    }

    // { path } — local temp file; RN (esp. Android) wants a file:// scheme.
    if (typeof image.path === 'string' && image.path.trim().length > 0) {
      return { uri: ensureFileScheme(image.path.trim()) };
    }

    // { base64 } — encoded buffer.
    if (typeof image.base64 === 'string' && image.base64.length > 0) {
      const mime =
        typeof image.mimeType === 'string' && image.mimeType.length > 0
          ? image.mimeType
          : 'image/jpeg';
      return { uri: `data:${mime};base64,${image.base64}` };
    }
  }

  return null;
};

/**
 * True when we can build a usable source from this image.
 */
export const hasUsableImageSource = (image: any): boolean =>
  safeImageSource(image) !== null;
