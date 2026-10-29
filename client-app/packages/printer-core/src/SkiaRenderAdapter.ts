import { RenderEnginePlatformAdapter } from './RenderEngine';

/**
 * Text rendering
 * ──────────────
 * The composite draws two kinds of text: layout copy (footer, tagline) in a text
 * face, and stickers, which are emoji. Skia's `matchFont({fontWeight})` — what
 * this adapter used to do — resolves *one* family and draws the string with it.
 * A text face has no emoji glyphs, so every sticker came out as blank space in
 * the final print even though the on-screen preview (React Native `<Text>`) had
 * shown it fine. iOS and Android both bundle a colour-emoji face, so the fix is
 * to resolve the family that actually has glyphs for the string, and to fall
 * back to a shaped paragraph (which does platform font fallback) when none does.
 */

const EMOJI_PATTERN =
  /[\u203C-\u3299\uFE0F\u200D\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const isEmojiText = (text: string): boolean => EMOJI_PATTERN.test(text);

/** `Arial, "Apple Color Emoji", sans-serif` → ['Arial', 'Apple Color Emoji'] */
const parseFamilies = (fontFamily: string): string[] => {
  const generic = /^(sans-serif|serif|monospace|system|system-ui|cursive|fantasy)$/i;
  return fontFamily
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .filter((part) => part.length > 0 && !generic.test(part));
};

/** Known colour-emoji faces, per platform. Checked after the CSS families. */
const EMOJI_FAMILIES = [
  'Apple Color Emoji',
  'Noto Color Emoji',
  'Noto Emoji',
  'Segoe UI Emoji',
  'Twemoji Mozilla',
];


/**
 * SkiaRenderAdapter
 * Implements RenderEnginePlatformAdapter using @shopify/react-native-skia.
 * This runs natively on iOS and Android inside the React Native JS thread,
 * avoiding the need for an HTML DOM canvas or a WebView.
 */
export class SkiaRenderAdapter implements RenderEnginePlatformAdapter {
  private skia: any;
  /** `${family}|${size}|${weight}` → SkFont, so resolution runs once per style. */
  private fontCache: Map<string, any> = new Map();
  /** Emoji families reported by the platform font manager (resolved lazily). */
  private emojiFamilies: string[] | null = null;

  constructor() {
    try {
      // Lazy load Skia to prevent bundling errors in web environments
      this.skia = require('@shopify/react-native-skia').Skia;
      if (!this.skia) {
        throw new Error('Skia is not available');
      }
    } catch (e) {
      console.warn('SkiaRenderAdapter: @shopify/react-native-skia is not installed or available on this platform.', e);
    }
  }

  createCanvas(width: number, height: number) {
    if (!this.skia) {
      throw new Error('Skia library is not loaded');
    }
    const surface = this.skia.Surface.Make(width, height);
    if (!surface) {
      throw new Error(`SkiaRenderAdapter: Could not create Skia surface of size ${width}x${height}`);
    }
    return {
      surface,
      canvas: surface.getCanvas(),
      width,
      height,
    };
  }

  getContext(canvasObj: any) {
    const { canvas, surface } = canvasObj;
    const skia = this.skia;
    const paint = skia.Paint();

    /* ── text: family resolution, measurement, paragraph fallback ───────── */

    const platformFamilies = (): string[] => {
      if (this.emojiFamilies === null) {
        const found: string[] = [];
        try {
          const skiaPkg = require('@shopify/react-native-skia');
          const list: string[] = typeof skiaPkg.listFontFamilies === 'function' ? skiaPkg.listFontFamilies() : [];
          for (const family of list) {
            if (/emoji/i.test(family)) found.push(family);
          }
        } catch {
          // listFontFamilies is a diagnostic helper — absence is not fatal
        }
        // Apple reports "Apple Color Emoji" only via the CoreText fallback list
        // on some iOS versions, so always append the well-known names.
        this.emojiFamilies = [...found, ...EMOJI_FAMILIES.filter((f) => !found.includes(f))];
      }
      return this.emojiFamilies as string[];
    };

    const match = (family: string | undefined, size: number, weight: string): any => {
      const key = `${family || '*'}|${size}|${weight}`;
      if (this.fontCache.has(key)) return this.fontCache.get(key);
      let font: any = null;
      try {
        const skiaPkg = require('@shopify/react-native-skia');
        if (typeof skiaPkg.matchFont === 'function') {
          font = skiaPkg.matchFont({
            ...(family ? { fontFamily: family } : {}),
            fontSize: size,
            fontWeight: weight === 'bold' ? 'bold' : 'normal',
          });
        }
      } catch {
        font = null;
      }
      if (!font && skia?.Font) {
        try {
          font = skia.Font(undefined, size);
        } catch {
          font = null;
        }
      }
      this.fontCache.set(key, font);
      return font;
    };

    const glyphs = (font: any, text: string): number[] => {
      try {
        return typeof font?.getGlyphIDs === 'function' ? font.getGlyphIDs(text) : [];
      } catch {
        return [];
      }
    };

    const fontHasAllGlyphs = (font: any, text: string): boolean => {
      const ids = glyphs(font, text);
      if (ids.length === 0) return false;
      return ids.every((id) => id !== 0);
    };

    const resolveFont = (text: string, style: { size: number; family: string; weight: string }): any => {
      const families = parseFamilies(style.family);
      // Emoji strings only ever look right in an emoji face, so try those first
      // for them; text strings keep their declared order.
      const candidates = isEmojiText(text)
        ? [...families.filter((f) => /emoji/i.test(f)), ...platformFamilies(), ...families]
        : families;
      for (const family of candidates) {
        const font = match(family, style.size, style.weight);
        if (font && fontHasAllGlyphs(font, text)) return font;
      }
      // Nothing covered the whole string. For plain text the default face is
      // still the best guess; for emoji a partial face would print tofu, so let
      // the paragraph path below do the shredding/fallback instead.
      if (!isEmojiText(text)) {
        const fallback = match(undefined, style.size, style.weight);
        if (fallback) return fallback;
      }
      return null;
    };

    const measure = (font: any, text: string, paintObj: any): number => {
      try {
        const measured = font.measureText(text, paintObj);
        if (measured && typeof measured.width === 'number') return measured.width;
      } catch {
        // fall through to the deprecated accessor
      }
      try {
        return typeof font.getTextWidth === 'function' ? font.getTextWidth(text) : 0;
      } catch {
        return 0;
      }
    };

    /**
     * Draws `text` through SkParagraph, which applies the platform font fallback
     * chain (that is what makes emoji render at all). Returns false if the
     * paragraph API is unavailable so the caller can fall back further.
     */
    const drawParagraph = (
      text: string,
      x: number,
      y: number,
      style: { size: number; family: string; weight: string }
    ): boolean => {
      try {
        if (!skia?.ParagraphBuilder) return false;
        const families = [...parseFamilies(style.family), ...platformFamilies()];
        // The second argument is the font *manager*. Without it Skia has no
        // platform fallback chain, so the run shapes to nothing and `paint()`
        // draws an empty paragraph — text and every emoji sticker silently
        // disappeared from the composite while the photos came out fine.
        let fontMgr: any = null;
        try {
          fontMgr = skia.FontMgr?.System?.() ?? null;
        } catch {
          fontMgr = null;
        }
        const builder = fontMgr ? skia.ParagraphBuilder.Make({}, fontMgr) : skia.ParagraphBuilder.Make({});
        builder.pushStyle({
          color: skia.Color(fillStyle),
          fontFamilies: families,
          fontSize: style.size,
          fontStyle: { weight: style.weight === 'bold' ? 700 : 400 },
        });
        builder.addText(text);
        const paragraph = builder.build();
        // Generous layout box: this is a single line, never wrapped.
        paragraph.layout(Math.max(style.size * 4, style.size * text.length * 3));

        const width = paragraph.getLongestLine ? paragraph.getLongestLine() : 0;
        const metrics: any[] = paragraph.getLineMetrics ? paragraph.getLineMetrics() : [];
        const line = metrics[0];
        const height = paragraph.getHeight ? paragraph.getHeight() : style.size;
        const baseline = line?.baseline ?? height * 0.8;

        let textX = x;
        if (textAlign === 'center') textX = x - width / 2;
        else if (textAlign === 'right' || textAlign === 'end') textX = x - width;

        let textY = y - baseline;
        if (textBaseline === 'middle') textY = y - baseline + height / 2;
        else if (textBaseline === 'top' || textBaseline === 'hanging') textY = y;
        else if (textBaseline === 'bottom' || textBaseline === 'ideographic') textY = y - height;

        paragraph.paint(canvas, textX, textY);
        return true;
      } catch (err) {
        console.warn('SkiaRenderAdapter: paragraph fallback failed:', err);
        return false;
      }
    };
    
    let currentFont = { size: 16, family: 'System', weight: 'normal' };
    let fillStyle = '#ffffff';
    let strokeStyle = '#000000';
    let lineWidth = 1;
    let globalAlpha = 1;
    let textAlign = 'left';
    let textBaseline = 'alphabetic';
    let filterType = 'none';
    let currentPath: any = null;

    const getSkiaColorFilter = (filterName: string) => {
      if (!skia.ColorFilter) return null;
      if (filterName === 'blackwhite') {
        const matrix = [
          0.2126, 0.7152, 0.0722, 0, 0,
          0.2126, 0.7152, 0.0722, 0, 0,
          0.2126, 0.7152, 0.0722, 0, 0,
          0,      0,      0,      1, 0
        ];
        return skia.ColorFilter.MakeMatrix(matrix);
      }
      if (filterName === 'vintage') {
        const matrix = [
          0.393, 0.769, 0.189, 0, 0,
          0.349, 0.686, 0.168, 0, 0,
          0.272, 0.534, 0.131, 0, 0,
          0,     0,     0,     1, 0
        ];
        return skia.ColorFilter.MakeMatrix(matrix);
      }
      if (filterName === 'warm') {
        const matrix = [
          1.06, 0,    0,    0, 0,
          0,    1.01, 0,    0, 0,
          0,    0,    0.93, 0, 0,
          0,    0,    0,    1, 0
        ];
        return skia.ColorFilter.MakeMatrix(matrix);
      }
      if (filterName === 'cool') {
        const matrix = [
          0.93, 0,    0,    0, 0,
          0,    1.01, 0,    0, 0,
          0,    0,    1.06, 0, 0,
          0,    0,    0,    1, 0
        ];
        return skia.ColorFilter.MakeMatrix(matrix);
      }
      if (filterName === 'vivid') {
        const matrix = [
          1.2, 0,   0,   0, 0,
          0,   1.2, 0,   0, 0,
          0,   0,   1.2, 0, 0,
          0,   0,   0,   1, 0
        ];
        return skia.ColorFilter.MakeMatrix(matrix);
      }
      return null;
    };

    return {
      canvas,
      surface,
      set fillStyle(color: string) {
        fillStyle = color;
        try {
          paint.setColor(skia.Color(color));
        } catch {
          // ignore invalid color
        }
      },
      get fillStyle() {
        return fillStyle;
      },
      set strokeStyle(color: string) {
        strokeStyle = color;
      },
      get strokeStyle() {
        return strokeStyle;
      },
      set lineWidth(w: number) {
        lineWidth = w;
      },
      get lineWidth() {
        return lineWidth;
      },
      set globalAlpha(a: number) {
        globalAlpha = a;
        try {
          paint.setAlphaf(a);
        } catch {
          // ignore
        }
      },
      get globalAlpha() {
        return globalAlpha;
      },
      set font(fontStr: string) {
        const match = fontStr.match(/(bold|900)?\s*(\d+)px\s*(.*)/i);
        if (match) {
          const isBold = !!match[1];
          const size = parseInt(match[2], 10);
          const family = match[3] || 'System';
          currentFont = { size, family, weight: isBold ? 'bold' : 'normal' };
        }
      },
      get font() {
        return `${currentFont.weight} ${currentFont.size}px ${currentFont.family}`;
      },
      set textAlign(align: string) {
        textAlign = align;
      },
      get textAlign() {
        return textAlign;
      },
      set textBaseline(baseline: string) {
        textBaseline = baseline;
      },
      get textBaseline() {
        return textBaseline;
      },
      /**
       * Applies the preview's own 4x5 colour matrix (`utils/filters`), or clears
       * it with `null`.
       *
       * The old path took a CSS filter *string* and guessed which of five
       * matrices it meant by matching substrings ("saturate(1.35)" → warm). Any
       * filter that did not happen to match — `soft`, `party` — printed
       * unfiltered, and the ones that did match were a different look from the
       * screen. The matrix is the same value `FilteredImage` renders, so a B&W
       * print is the B&W the guest approved.
       */
      setColorMatrix(matrix: number[] | null) {
        try {
          if (!matrix || !skia.ColorFilter) {
            paint.setColorFilter(null);
            return;
          }
          paint.setColorFilter(skia.ColorFilter.MakeMatrix(matrix));
        } catch (err) {
          console.warn('SkiaRenderAdapter: colour matrix rejected:', err);
        }
      },
      set filter(f: string) {
        filterType = f;
        let resolvedFilter = f;
        if (f.includes('grayscale')) resolvedFilter = 'blackwhite';
        else if (f.includes('sepia')) resolvedFilter = 'vintage';
        else if (f.includes('saturate(1.65)')) resolvedFilter = 'vivid';
        else if (f.includes('saturate(1.35)')) resolvedFilter = 'warm';
        else if (f.includes('saturate(1.15)')) resolvedFilter = 'cool';

        const cf = getSkiaColorFilter(resolvedFilter);
        if (cf) {
          paint.setColorFilter(cf);
        } else {
          paint.setColorFilter(null);
        }
      },
      get filter() {
        return filterType;
      },
      fillRect(x: number, y: number, w: number, h: number) {
        paint.setStyle(0);
        try {
          paint.setColor(skia.Color(fillStyle));
        } catch {}
        canvas.drawRect({ x, y, width: w, height: h }, paint);
      },
      strokeRect(x: number, y: number, w: number, h: number) {
        paint.setStyle(1);
        paint.setStrokeWidth(lineWidth);
        try {
          paint.setColor(skia.Color(strokeStyle));
        } catch {}
        canvas.drawRect({ x, y, width: w, height: h }, paint);
        paint.setStyle(0);
      },
      beginPath() {
        try {
          currentPath = skia.Path.Make();
        } catch {
          currentPath = null;
        }
      },
      closePath() {
        try {
          currentPath?.close();
        } catch {}
      },
      moveTo(x: number, y: number) {
        try {
          currentPath?.moveTo(x, y);
        } catch {}
      },
      lineTo(x: number, y: number) {
        try {
          currentPath?.lineTo(x, y);
        } catch {}
      },
      quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
        try {
          currentPath?.quadTo(cpx, cpy, x, y);
        } catch {}
      },
      bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
        try {
          currentPath?.cubicTo(cp1x, cp1y, cp2x, cp2y, x, y);
        } catch {}
      },
      arc(x: number, y: number, radius: number, _startAngle: number, _endAngle: number) {
        try {
          currentPath?.addCircle(x, y, radius);
        } catch {}
      },
      fill() {
        if (!currentPath) return;
        try {
          paint.setStyle(0);
          paint.setColor(skia.Color(fillStyle));
          canvas.drawPath(currentPath, paint);
        } catch {}
      },
      stroke() {
        if (!currentPath) return;
        try {
          paint.setStyle(1);
          paint.setStrokeWidth(lineWidth);
          paint.setColor(skia.Color(strokeStyle));
          canvas.drawPath(currentPath, paint);
          paint.setStyle(0);
        } catch {}
      },
      clip() {
        if (!currentPath) return;
        try {
          canvas.clipPath(currentPath, 1, true);
        } catch {}
      },
      drawImage(imgWrapper: any, sx: number, sy: number, sw: number, sh: number, dx?: number, dy?: number, dw?: number, dh?: number) {
        const img = imgWrapper?._skImage || imgWrapper;
        if (!img) return;
        const naturalW = typeof img.width === 'function' ? img.width() : Number(imgWrapper?.width || 0);
        const naturalH = typeof img.height === 'function' ? img.height() : Number(imgWrapper?.height || 0);
        if (!naturalW || !naturalH) return;

        paint.setStyle(0);
        if (dx === undefined || dy === undefined || dw === undefined || dh === undefined) {
          const destX = Number.isFinite(sx) ? sx : 0;
          const destY = Number.isFinite(sy) ? sy : 0;
          const destW = Number.isFinite(sw) && sw > 0 ? sw : naturalW;
          const destH = Number.isFinite(sh) && sh > 0 ? sh : naturalH;
          canvas.drawImageRect(
            img,
            { x: 0, y: 0, width: naturalW, height: naturalH },
            { x: destX, y: destY, width: destW, height: destH },
            paint
          );
        } else {
          const srcX = Number.isFinite(sx) ? sx : 0;
          const srcY = Number.isFinite(sy) ? sy : 0;
          const srcW = Number.isFinite(sw) && sw > 0 ? sw : naturalW;
          const srcH = Number.isFinite(sh) && sh > 0 ? sh : naturalH;
          canvas.drawImageRect(
            img,
            { x: srcX, y: srcY, width: srcW, height: srcH },
            { x: dx, y: dy, width: dw, height: dh },
            paint
          );
        }
      },
      fillText(text: string, x: number, y: number) {
        if (!text) return;
        try {
          let textX = x;
          let textY = y;

          const font = resolveFont(text, currentFont);
          let drawn = false;

          if (font) {
            const width = measure(font, text, paint);
            if (textAlign === 'center') {
              textX = x - width / 2;
            } else if (textAlign === 'right' || textAlign === 'end') {
              textX = x - width;
            }
            paint.setStyle(0);
            paint.setColor(skia.Color(fillStyle));
            canvas.drawText(text, textX, textY, paint, font);
            drawn = true;
          }

          // No single family had every glyph (usual case: emoji). Let Skia shape
          // the run with the platform font collection, which performs fallback.
          if (!drawn || (isEmojiText(text) && !fontHasAllGlyphs(font, text))) {
            if (drawParagraph(text, x, y, currentFont)) {
              drawn = true;
            }
          }
        } catch (err) {
          // Never fail composite rendering if platform text is unavailable
          console.warn('SkiaRenderAdapter: fillText skipped:', err);
        }
      },
      save() {
        canvas.save();
      },
      restore() {
        canvas.restore();
      },
      translate(x: number, y: number) {
        canvas.translate(x, y);
      },
      rotate(rad: number) {
        canvas.rotate((rad * 180) / Math.PI, 0, 0);
      }
    };
  }

  canvasToDataUrl(canvasObj: any): string {
    const image = canvasObj.surface.makeImageSnapshot();
    try {
      const jpegFmt = this.skia.ImageFormat?.JPEG ?? 3;
      const data = image.encodeToBase64(jpegFmt, 82);
      if (data) return `data:image/jpeg;base64,${data}`;
    } catch {}
    const pngData = image.encodeToBase64();
    return `data:image/png;base64,${pngData}`;
  }

  async loadImage(uri: string): Promise<any> {
    if (!this.skia) {
      throw new Error('Skia library is not loaded');
    }

    let normalizedUri = String(uri || '').trim();
    if (
      normalizedUri &&
      !normalizedUri.startsWith('data:') &&
      !normalizedUri.startsWith('http://') &&
      !normalizedUri.startsWith('https://') &&
      !normalizedUri.startsWith('file://') &&
      normalizedUri.startsWith('/')
    ) {
      normalizedUri = `file://${normalizedUri}`;
    }

    const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms) loading ${label}`)), ms);
        promise.then(
          (val) => {
            clearTimeout(timer);
            resolve(val);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
      });

    let data: any = null;

    if (normalizedUri.startsWith('data:')) {
      const commaIdx = normalizedUri.indexOf(',');
      const b64 = (commaIdx >= 0 ? normalizedUri.slice(commaIdx + 1) : normalizedUri).replace(/\s/g, '');
      data = this.skia.Data.fromBase64(b64);
    } else if (normalizedUri.startsWith('http://') || normalizedUri.startsWith('https://')) {
      // Never call Skia.Data.fromURI on remote HTTP(S) URLs on Android as it can block indefinitely.
      const response = await withTimeout(fetch(normalizedUri), 5000, normalizedUri);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} loading ${normalizedUri}`);
      }
      const arrayBuffer = await withTimeout(response.arrayBuffer(), 5000, normalizedUri);
      data = this.skia.Data.fromBytes(new Uint8Array(arrayBuffer));
    } else {
      try {
        data = await withTimeout(this.skia.Data.fromURI(normalizedUri), 4000, normalizedUri);
      } catch (err) {
        try {
          const response = await withTimeout(fetch(normalizedUri), 4000, normalizedUri);
          const arrayBuffer = await withTimeout(response.arrayBuffer(), 4000, normalizedUri);
          data = this.skia.Data.fromBytes(new Uint8Array(arrayBuffer));
        } catch (fallbackErr) {
          throw new Error(`SkiaRenderAdapter: Failed to load file from ${normalizedUri}: ${fallbackErr}`);
        }
      }
    }

    if (!data) {
      throw new Error(`SkiaRenderAdapter: Failed to load data: ${normalizedUri}`);
    }
    const image = this.skia.Image.MakeImageFromEncoded(data);
    if (!image) {
      throw new Error(`SkiaRenderAdapter: Failed to decode image from bytes: ${normalizedUri}`);
    }
    const width = typeof image.width === 'function' ? image.width() : Number(image.width || 0);
    const height = typeof image.height === 'function' ? image.height() : Number(image.height || 0);
    return {
      _skImage: image,
      width,
      height,
    };
  }
}
