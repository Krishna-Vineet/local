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
    let textAlign = 'left';
    let filterType = 'none';

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
        paint.setColor(skia.Color(color));
      },
      get fillStyle() {
        return fillStyle;
      },
      set font(fontStr: string) {
        // Match e.g. "bold 48px Arial"
        const match = fontStr.match(/(bold)?\s*(\d+)px\s*(.*)/);
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
        paint.setStyle(0); // 0 corresponds to Fill in Skia PaintStyle
        canvas.drawRect({ x, y, width: w, height: h }, paint);
      },
      drawImage(img: any, sx: number, sy: number, sw: number, sh: number, dx?: number, dy?: number, dw?: number, dh?: number) {
        // img is a SkImage
        if (dx === undefined || dy === undefined || dw === undefined || dh === undefined) {
          // 5 arguments: drawImage(image, dx, dy, dw, dh)
          const destX = sx;
          const destY = sy;
          const destW = sw;
          const destH = sh;
          canvas.drawImageRect(
            img,
            { x: 0, y: 0, width: img.width(), height: img.height() },
            { x: destX, y: destY, width: destW, height: destH },
            paint
          );
        } else {
          // 9 arguments: drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
          canvas.drawImageRect(
            img,
            { x: sx, y: sy, width: sw, height: sh },
            { x: dx, y: dy, width: dw, height: dh },
            paint
          );
        }
      },
      fillText(text: string, x: number, y: number) {
        const font = skia.Font(null, currentFont.size);
        let textX = x;
        if (textAlign === 'center') {
          const width = font.measureText(text, paint).width;
          textX = x - width / 2;
        } else if (textAlign === 'right') {
          const width = font.measureText(text, paint).width;
          textX = x - width;
        }
        canvas.drawText(text, textX, y, paint, font);
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
        // Skia rotate takes degrees
        canvas.rotate((rad * 180) / Math.PI, 0, 0);
      }
    };
  }

  canvasToDataUrl(canvasObj: any): string {
    const image = canvasObj.surface.makeImageSnapshot();
    // Use JPEG with 85% quality to drastically reduce the base64 string size 
    // This prevents the React Native fetch API from silently dropping the request due to JS bridge memory limits.
    const data = image.encodeToBase64(this.skia.ImageFormat.JPEG, 85);
    return `data:image/jpeg;base64,${data}`;
  }

  async loadImage(uri: string): Promise<any> {
    if (!this.skia) {
      throw new Error('Skia library is not loaded');
    }
    
    let data;
    try {
      // Skia natively supports fromURI for local file:// paths on React Native
      data = await this.skia.Data.fromURI(uri);
    } catch (err) {
      // Fallback for remote URLs or if fromURI fails
      try {
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        data = this.skia.Data.fromBytes(new Uint8Array(arrayBuffer));
      } catch (fallbackErr) {
        throw new Error(`SkiaRenderAdapter: Failed to load file from ${uri}: ${fallbackErr}`);
      }
    }

    if (!data) {
      throw new Error(`SkiaRenderAdapter: Failed to load data: ${uri}`);
    }
    const image = this.skia.Image.MakeImageFromEncoded(data);
    if (!image) {
      throw new Error(`SkiaRenderAdapter: Failed to decode image from bytes: ${uri}`);
    }
    return image;
  }
}
