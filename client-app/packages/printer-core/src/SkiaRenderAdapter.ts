import { RenderEnginePlatformAdapter } from './RenderEngine';

/**
 * SkiaRenderAdapter
 * Implements RenderEnginePlatformAdapter using @shopify/react-native-skia.
 * This runs natively on iOS and Android inside the React Native JS thread,
 * avoiding the need for an HTML DOM canvas or a WebView.
 */
export class SkiaRenderAdapter implements RenderEnginePlatformAdapter {
  private skia: any;

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
        try {
          const skiaPkg = require('@shopify/react-native-skia');
          let font: any = null;
          if (typeof skiaPkg.matchFont === 'function') {
            try {
              font = skiaPkg.matchFont({
                fontSize: currentFont.size,
                fontWeight: currentFont.weight === 'bold' ? 'bold' : 'normal',
              });
            } catch {
              font = null;
            }
          }
          if (!font && typeof skia.Font === 'function') {
            try {
              font = skia.Font(undefined, currentFont.size);
            } catch {
              font = null;
            }
          }
          if (!font) return;

          paint.setStyle(0);
          paint.setColor(skia.Color(fillStyle));
          let textX = x;
          try {
            const measured = font.measureText(text, paint);
            const width = measured?.width ?? (typeof font.getTextWidth === 'function' ? font.getTextWidth(text) : 0);
            if (textAlign === 'center') {
              textX = x - width / 2;
            } else if (textAlign === 'right') {
              textX = x - width;
            }
          } catch {}
          canvas.drawText(text, textX, y, paint, font);
        } catch (err) {
          // Never fail composite rendering if platform font is unavailable
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
      const data = image.encodeToBase64(this.skia.ImageFormat.JPEG, 88);
      if (data) return `data:image/jpeg;base64,${data}`;
    } catch {}
    const pngData = image.encodeToBase64();
    return `data:image/png;base64,${pngData}`;
  }

  async loadImage(uri: string): Promise<any> {
    if (!this.skia) {
      throw new Error('Skia library is not loaded');
    }

    let normalizedUri = uri;
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

    let data;
    try {
      data = await this.skia.Data.fromURI(normalizedUri);
    } catch (err) {
      try {
        const response = await fetch(normalizedUri);
        const arrayBuffer = await response.arrayBuffer();
        data = this.skia.Data.fromBytes(new Uint8Array(arrayBuffer));
      } catch (fallbackErr) {
        throw new Error(`SkiaRenderAdapter: Failed to load file from ${normalizedUri}: ${fallbackErr}`);
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
