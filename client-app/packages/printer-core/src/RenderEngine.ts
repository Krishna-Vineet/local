// ─────────────────────────────────────────────────────────────────
//  RenderEngine
//  Composites photos + template JSON → 300/600 DPI bitmap
//  Output is a base64 data URI ready to hand to any PrinterProvider.
//
//  RULE: PrinterProviders receive ONLY a ready bitmap.
//        They never touch photos, templates, or layout logic.
// ─────────────────────────────────────────────────────────────────

import type {
  CapturedPhoto,
  FilterType,
  PaperSize,
  PhotoShape,
  Sticker,
  PrintTemplate,
} from '../../types/src/index';
import { PATTERNS } from '../../ui/src/constants/patterns';

// Fallback typings for React Native / Node compile targets lacking DOM definitions
declare global {
  interface HTMLCanvasElement {
    width: number;
    height: number;
    getContext(contextId: "2d"): any;
    toDataURL(type?: string, quality?: any): string;
  }
  interface CanvasRenderingContext2D {
    fillStyle: any;
    font: string;
    textAlign: string;
    filter: string;
    fillRect(x: number, y: number, w: number, h: number): void;
    drawImage(image: any, sx: number, sy: number, sw: number, sh: number, dx?: number, dy?: number, dw?: number, dh?: number): void;
    fillText(text: string, x: number, y: number): void;
    save(): void;
    restore(): void;
    translate(x: number, y: number): void;
    rotate(angle: number): void;
    beginPath(): void;
    closePath(): void;
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
    clip(): void;
    createPattern(image: any, repetition: string): any;
  }
  interface HTMLImageElement {
    width: number;
    height: number;
    src: string;
  }
}


// Paper size to pixel dimensions at 300 DPI
const PAPER_DIMENSIONS: Record<PaperSize, { width: number; height: number }> = {
  '4x6':      { width: 1800, height: 1200 },  // 6"×4" @300dpi
  '5x7':      { width: 2100, height: 1500 },  // 7"×5" @300dpi
  '6x8':      { width: 2400, height: 1800 },  // 8"×6" @300dpi
  '2x6_strip': { width: 1800, height: 600 },  // 6"×2" strip @300dpi
};

// CSS filter map (same as web client for consistency)
const FILTER_CSS: Record<FilterType, string> = {
  none:       'none',
  original:   'none',
  vintage:    'sepia(0.6) contrast(1.15) brightness(0.95) hue-rotate(-10deg)',
  blackwhite: 'grayscale(1) contrast(1.25) brightness(1.05)',
  bw:         'grayscale(1) contrast(1.25) brightness(1.05)',
  warm:       'sepia(0.25) saturate(1.35) hue-rotate(5deg) contrast(1.05)',
  cool:       'saturate(1.15) hue-rotate(-15deg) brightness(1.05) contrast(1.02)',
  soft:       'brightness(1.05) contrast(0.95) saturate(1.1)',
  party:      'saturate(1.5) contrast(1.2) hue-rotate(15deg)',
  vivid:      'saturate(1.65) contrast(1.15) brightness(1.05)',
};

export interface RenderInput {
  template: PrintTemplate;
  photos: CapturedPhoto[];
  filter?: FilterType;
  logoUrl?: string;
  logo?: string;
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  tagline?: string;
  backgroundColor?: string;
  overlayUrl?: string;
  photoShape?: PhotoShape;
  framePatternUrl?: string;
  framePatternId?: string;
  stickers?: Sticker[];
}

export interface RenderOutput {
  /** base64 PNG data URI — 300 DPI, ready to print */
  bitmap: string;
  width: number;
  height: number;
  dpi: 300 | 600;
}

export interface RenderEnginePlatformAdapter {
  createCanvas: (width: number, height: number) => any;
  getContext: (canvas: any) => any;
  canvasToDataUrl: (canvas: any) => string;
  loadImage: (uri: string) => Promise<any>;
}

/**
 * RenderEngine.compose() — the only function printers call.
 *
 * In React Native, Canvas operations run via react-native-skia or
 * react-native-canvas. This implementation uses the web Canvas API
 * for compatibility during web testing. The RN app will swap in
 * Skia canvas in the screen-level hook.
 */
export class RenderEngine {
  private adapter?: RenderEnginePlatformAdapter;

  setAdapter(adapter: RenderEnginePlatformAdapter) {
    this.adapter = adapter;
  }

  async compose(input: RenderInput): Promise<RenderOutput> {
    const { template, photos, filter = 'none', tagline, backgroundColor, photoShape = 'rectangle', framePatternUrl, framePatternId, stickers = [], logoUrl, logo } = input;
    const activeLogoUrl = logoUrl || logo;
    const dims = (PAPER_DIMENSIONS as Record<string, { width: number; height: number }>)[template.paperSize] || PAPER_DIMENSIONS['4x6'];

    // In a React Native context, canvas is provided by react-native-skia.
    // This base implementation works in web/test environments.
    const canvas = this.createCanvas(dims.width, dims.height);
    const ctx = this.getContext(canvas);

    // 1. Background
    const selectedPattern = framePatternId ? PATTERNS.find(p => p.id === framePatternId) : undefined;

    if (selectedPattern && selectedPattern.type === 'procedural') {
        const p = selectedPattern.primary || '#000000';
        const s = selectedPattern.secondary || backgroundColor || '#ffffff';
        ctx.fillStyle = s;
        ctx.fillRect(0, 0, dims.width, dims.height);

        const tileSize = Math.max(120, Math.min(240, dims.width / 15));
        const cols = Math.ceil(dims.width / tileSize);
        const rows = Math.ceil(dims.height / tileSize);
        // Simple deterministic pseudo-random
        const rand = (i: number, range: number) => ((i * 1664525 + 1013904223) & 0x7fffffff) % range;

        for (let row = 0; row <= rows; row++) {
           for (let col = 0; col <= cols; col++) {
              const x = col * tileSize;
              const y = row * tileSize;
              const cx = x + tileSize / 2;
              const cy = y + tileSize / 2;
              const cellIdx = row * (cols + 1) + col;
              const t = selectedPattern.skiaType;

              ctx.fillStyle = p;
              ctx.strokeStyle = p;

              if (t === 'dots') {
                  ctx.beginPath();
                  ctx.arc(cx, cy, tileSize / 5, 0, Math.PI * 2);
                  ctx.fill();
              } else if (t === 'grid') {
                  ctx.lineWidth = 4;
                  ctx.strokeRect(x, y, tileSize, tileSize);
              } else if (t === 'stripes') {
                  ctx.lineWidth = tileSize / 3;
                  ctx.beginPath();
                  ctx.moveTo(x, y);
                  ctx.lineTo(x + tileSize, y + tileSize);
                  ctx.stroke();
              } else if (t === 'vstripes') {
                  ctx.fillRect(x, y, tileSize * 0.5, tileSize);
              } else if (t === 'checker') {
                  if ((col + row) % 2 === 0) ctx.fillRect(x, y, tileSize, tileSize);
              } else if (t === 'hearts' || t === 'diamond') {
                  ctx.fillRect(x + tileSize * 0.3, y + tileSize * 0.3, tileSize * 0.4, tileSize * 0.4);
                  ctx.beginPath();
                  ctx.arc(cx, y + tileSize * 0.3, tileSize * 0.2, 0, Math.PI * 2);
                  ctx.arc(x + tileSize * 0.3, cy, tileSize * 0.2, 0, Math.PI * 2);
                  ctx.fill();
              } else if (t === 'stars' || t === 'argyle') {
                  ctx.save();
                  ctx.translate(cx, cy);
                  ctx.rotate(Math.PI / 4);
                  ctx.fillRect(-tileSize * 0.2, -tileSize * 0.2, tileSize * 0.4, tileSize * 0.4);
                  ctx.restore();
              } else if (t === 'chevron') {
                  ctx.lineWidth = tileSize / 4;
                  ctx.beginPath();
                  ctx.moveTo(x, y + tileSize / 2);
                  ctx.lineTo(cx, y);
                  ctx.lineTo(x + tileSize, y + tileSize / 2);
                  ctx.stroke();
              } else if (t === 'glitter') {
                  const size = tileSize * 0.08 + rand(cellIdx, 6) * tileSize * 0.03;
                  const ox = (rand(cellIdx * 3, tileSize) - tileSize / 2) * 0.8;
                  const oy = (rand(cellIdx * 7 + 1, tileSize) - tileSize / 2) * 0.8;
                  ctx.globalAlpha = 0.55 + rand(cellIdx, 5) * 0.09;
                  ctx.beginPath();
                  ctx.arc(cx + ox, cy + oy, size, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.globalAlpha = 1;
              } else if (t === 'confetti') {
                  const w2 = tileSize * 0.25; const h2 = tileSize * 0.12;
                  const angle = (rand(cellIdx * 5, 314) / 100) - 1.57;
                  ctx.save();
                  ctx.translate(cx, cy);
                  ctx.rotate(angle);
                  ctx.fillRect(-w2 / 2, -h2 / 2, w2, h2);
                  ctx.restore();
              } else if (t === 'waves') {
                  const amp = tileSize * 0.3;
                  const freq = (2 * Math.PI) / (tileSize * 2);
                  const y1 = cy + Math.sin(x * freq) * amp;
                  const y2 = cy + Math.sin((x + tileSize) * freq) * amp;
                  ctx.lineWidth = tileSize * 0.18;
                  ctx.beginPath();
                  ctx.moveTo(x, y1);
                  ctx.lineTo(x + tileSize, y2);
                  ctx.stroke();
              } else if (t === 'floral') {
                  for (let petal = 0; petal < 5; petal++) {
                    const angle = (petal / 5) * Math.PI * 2;
                    const pr = tileSize * 0.22;
                    ctx.beginPath();
                    ctx.arc(cx + Math.cos(angle) * pr, cy + Math.sin(angle) * pr, tileSize * 0.16, 0, Math.PI * 2);
                    ctx.fill();
                  }
                  ctx.fillStyle = s;
                  ctx.beginPath();
                  ctx.arc(cx, cy, tileSize * 0.1, 0, Math.PI * 2);
                  ctx.fill();
              } else if (t === 'triangles') {
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(cx, y + tileSize * 0.1);
                  ctx.lineTo(x + tileSize * 0.1, y + tileSize * 0.9);
                  ctx.lineTo(x + tileSize * 0.9, y + tileSize * 0.9);
                  ctx.closePath();
                  ctx.stroke();
              } else if (t === 'hexagons') {
                  const hr = tileSize * 0.42;
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  for (let k = 0; k < 6; k++) {
                    const a = (Math.PI / 3) * k - Math.PI / 6;
                    const px = cx + hr * Math.cos(a); const py = cy + hr * Math.sin(a);
                    k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                  }
                  ctx.closePath();
                  ctx.stroke();
              } else if (t === 'quilt') {
                  ctx.lineWidth = 1;
                  ctx.strokeRect(x, y, tileSize, tileSize);
                  ctx.beginPath();
                  ctx.moveTo(x, y); ctx.lineTo(x + tileSize, y + tileSize); ctx.stroke();
                  ctx.beginPath();
                  ctx.moveTo(x + tileSize, y); ctx.lineTo(x, y + tileSize); ctx.stroke();
              } else if (t === 'scales') {
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.arc(cx, y + tileSize * 0.75, tileSize * 0.5, Math.PI, 0);
                  ctx.stroke();
              } else if (t === 'cow') {
                  if (rand(cellIdx, 3) === 0) {
                    const blobW = tileSize * (0.4 + rand(cellIdx, 4) * 0.1);
                    const blobH = tileSize * (0.3 + rand(cellIdx * 2, 3) * 0.1);
                    ctx.fillRect(cx - blobW / 2, cy - blobH / 2, blobW, blobH);
                  }
              } else if (t === 'leopard') {
                  ctx.beginPath();
                  ctx.arc(cx, cy, tileSize * 0.18, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.globalAlpha = 0.7;
                  ctx.beginPath();
                  ctx.arc(cx + tileSize * 0.2, cy - tileSize * 0.15, tileSize * 0.1, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.beginPath();
                  ctx.arc(cx - tileSize * 0.2, cy + tileSize * 0.15, tileSize * 0.1, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.globalAlpha = 1;
              }
           }
        }
    } else if (framePatternUrl) {
      try {
        const patternImg = await this.loadImage(framePatternUrl);
        // We use objectCoverCrop for background images so they scale to fit any canvas
        // without stretching or showing repeating seams.
        const { sx, sy, sw, sh } = this.objectCoverCrop(
          patternImg.width,
          patternImg.height,
          dims.width,
          dims.height
        );
        ctx.drawImage(patternImg, sx, sy, sw, sh, 0, 0, dims.width, dims.height);
      } catch (err) {
        ctx.fillStyle = backgroundColor ?? '#ffffff';
        ctx.fillRect(0, 0, dims.width, dims.height);
      }
    } else {
      ctx.fillStyle = backgroundColor ?? '#ffffff';
      ctx.fillRect(0, 0, dims.width, dims.height);
    }

    // 2. Place each photo into its template slot
    for (let i = 0; i < template.slots.length && i < photos.length; i++) {
      const slot = template.slots[i];
      const photo = photos[i];

      try {
        const img = await this.loadImage(photo.uri);

        // Apply filter via canvas (if supported)
        if (filter !== 'none') {
          (ctx as any).filter = FILTER_CSS[filter];
        }

        ctx.save();
        
        // Handle slot rotation
        if (slot.rotation) {
          const cx = slot.x + slot.width / 2;
          const cy = slot.y + slot.height / 2;
          ctx.translate(cx, cy);
          ctx.rotate((slot.rotation * Math.PI) / 180);
          ctx.translate(-cx, -cy);
        }

        // Apply Photo Shape Clipping
        if (photoShape !== 'rectangle') {
          ctx.beginPath();
          if (photoShape === 'circle') {
            const radius = Math.min(slot.width, slot.height) / 2;
            const cx = slot.x + slot.width / 2;
            const cy = slot.y + slot.height / 2;
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          } else if (photoShape === 'rounded') {
            const radius = Math.min(slot.width, slot.height) * 0.1;
            const { x, y, width: w, height: h } = slot;
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
          } else if (photoShape === 'heart') {
            const { x, y, width: w, height: h } = slot;
            const topCurveHeight = h * 0.3;
            ctx.moveTo(x + w / 2, y + topCurveHeight);
            ctx.bezierCurveTo(x + w / 2, y, x, y, x, y + topCurveHeight);
            ctx.bezierCurveTo(x, y + (h + topCurveHeight) / 2, x + w / 2, y + (h + topCurveHeight) / 2, x + w / 2, y + h);
            ctx.bezierCurveTo(x + w / 2, y + (h + topCurveHeight) / 2, x + w, y + (h + topCurveHeight) / 2, x + w, y + topCurveHeight);
            ctx.bezierCurveTo(x + w, y, x + w / 2, y, x + w / 2, y + topCurveHeight);
          }
          ctx.closePath();
          ctx.clip();
        }

        // Object-cover: crop to fill slot
        const { sx, sy, sw, sh } = this.objectCoverCrop(
          img.width,
          img.height,
          slot.width,
          slot.height,
        );
        ctx.drawImage(img, sx, sy, sw, sh, slot.x, slot.y, slot.width, slot.height);
        ctx.restore();
        (ctx as any).filter = 'none';
      } catch (err) {
        console.warn(`RenderEngine: Could not load photo ${i}:`, err);
      }
    }

    // 3. Stickers
    for (const sticker of stickers) {
      try {
        ctx.save();
        const cx = sticker.x + sticker.width / 2;
        const cy = sticker.y + sticker.height / 2;
        ctx.translate(cx, cy);
        if (sticker.rotation) {
          ctx.rotate((sticker.rotation * Math.PI) / 180);
        }
        ctx.translate(-cx, -cy);

        if (sticker.emoji) {
          ctx.font = `${sticker.height * 0.75}px Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sticker.emoji, cx, cy);
        } else if (sticker.url) {
          const sImg = await this.loadImage(sticker.url);
          ctx.drawImage(sImg, 0, 0, sImg.width, sImg.height, sticker.x, sticker.y, sticker.width, sticker.height);
        }
        ctx.restore();
      } catch (err) {
        console.warn(`RenderEngine: Could not load sticker ${sticker.id}:`, err);
      }
    }
    // 4. Branding Footer
    const footerHeight = dims.height * 0.15; // Matches the 15% reserved in DefaultTemplates.ts
    const footerY = dims.height - footerHeight;
    const margin = dims.width * 0.05;

    // Draw Event Logo (Bottom Left)
    if (activeLogoUrl) {
      try {
        const eventLogoImg = await this.loadImage(activeLogoUrl);
        const logoMaxHeight = footerHeight * 0.6;
        const logoMaxWidth = dims.width * 0.3;
        
        const aspect = eventLogoImg.width / eventLogoImg.height;
        let lw = logoMaxWidth;
        let lh = lw / aspect;
        if (lh > logoMaxHeight) {
           lh = logoMaxHeight;
           lw = lh * aspect;
        }
        
        ctx.drawImage(eventLogoImg, margin, footerY + (footerHeight - lh) / 2, lw, lh);
      } catch (err) {
        console.warn('RenderEngine: Could not load event logo', err);
      }
    }

    // Draw Company Text (Bottom Right)
    ctx.fillStyle = (framePatternUrl || framePatternId || backgroundColor === '#000000') ? '#ffffff' : '#444444';
    ctx.font = `900 ${Math.round(dims.height * 0.028)}px Arial`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('HAPPY PIX', dims.width - margin, footerY + footerHeight / 2);

    // Draw Tagline (Center)
    if (tagline) {
      ctx.fillStyle = (framePatternUrl || framePatternId || backgroundColor === '#000000') ? '#ffffff' : '#222222';
      ctx.font = `italic bold ${Math.round(dims.height * 0.035)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagline, dims.width / 2, footerY + footerHeight / 2);
    }

    const bitmap = this.canvasToDataUrl(canvas);
    return {
      bitmap,
      width: dims.width,
      height: dims.height,
      dpi: template.dpi,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private objectCoverCrop(
    imgW: number, imgH: number,
    targetW: number, targetH: number,
  ): { sx: number; sy: number; sw: number; sh: number } {
    const imgAspect = imgW / imgH;
    const targetAspect = targetW / targetH;
    let sw: number, sh: number, sx: number, sy: number;
    if (imgAspect > targetAspect) {
      sh = imgH;
      sw = imgH * targetAspect;
      sx = (imgW - sw) / 2;
      sy = 0;
    } else {
      sw = imgW;
      sh = imgW / targetAspect;
      sx = 0;
      sy = (imgH - sh) / 2;
    }
    return { sx, sy, sw, sh };
  }

  // These are overridden in RN context to use Skia canvas
  protected createCanvas(width: number, height: number): HTMLCanvasElement {
    if (this.adapter) {
      return this.adapter.createCanvas(width, height);
    }
    if (typeof document === 'undefined') {
      // Return a minimal fallback object to prevent crashing on boot/execution in React Native/Node
      return {
        width,
        height,
        getContext: () => ({
          fillRect: () => {},
          drawImage: () => {},
          fillText: () => {},
          save: () => {},
          restore: () => {},
          translate: () => {},
          rotate: () => {},
          beginPath: () => {},
          closePath: () => {},
          arc: () => {},
          moveTo: () => {},
          lineTo: () => {},
          quadraticCurveTo: () => {},
          bezierCurveTo: () => {},
          clip: () => {},
          createPattern: () => null,
        }),
        toDataURL: () => '',
      } as any;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  protected getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    if (this.adapter) {
      return this.adapter.getContext(canvas);
    }
    if (typeof document === 'undefined') {
      return (canvas as any).getContext('2d');
    }
    return canvas.getContext('2d')!;
  }

  protected canvasToDataUrl(canvas: HTMLCanvasElement): string {
    if (this.adapter) {
      return this.adapter.canvasToDataUrl(canvas);
    }
    if (typeof document === 'undefined') {
      return '';
    }
    return canvas.toDataURL('image/png');
  }

  protected loadImage(uri: string): Promise<HTMLImageElement> {
    if (this.adapter) {
      return this.adapter.loadImage(uri);
    }
    if (typeof document === 'undefined') {
      return Promise.resolve({
        width: 100,
        height: 100,
        src: uri,
      } as any);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = uri;
    });
  }
}

export const renderEngine = new RenderEngine();
