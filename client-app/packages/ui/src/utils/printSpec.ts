// ─────────────────────────────────────────────────────────────────────────────
//  printSpec — one description of a finished print, shared by both renderers.
//
//  There are two renderers in the booth and they drifted:
//
//    · `TemplateCanvas` (a React Native view tree) draws the preview the guest
//      edits;  it is what "customisation" looks like on screen.
//    · `RenderEngine` (a Skia canvas) draws the 300 dpi bitmap that is printed
//      and uploaded. It is what the guest actually gets.
//
//  They disagreed about the filter (a Skia colour matrix on screen, a CSS
//  filter string parsed by substring on paper), the footer (a 13 % centred
//  block on screen, a 15 % block with an invented "HAPPY PIX" caption on paper),
//  the logo (centred beside the copy on screen, 5 % from the left edge on
//  paper), the title (drawn on screen, never drawn on paper) and the stickers
//  (a 9.6 % em on screen, a hard-coded 90 px on paper). The guest saw one
//  design and collected another.
//
//  `buildPrintSpec` resolves all of that **once**, into normalised 0..1
//  geometry. Both renderers then multiply by their own pixel size, so a
//  difference between preview and print is no longer possible — there is only
//  one set of numbers. Anything that must differ per surface (a blur, a hover
//  state) belongs here as an explicit field, not as a separate calculation.
//
//  Geometry follows Electron's `.template-footer` / `.placed-sticker` rules
//  (`electron/src/ui/App.css`), which are the reference implementation.
// ─────────────────────────────────────────────────────────────────────────────

import type { BoothTemplate, Customization, FilterId } from '@happypix/types';
import { filterMatrix, type ColorMatrix } from './filters';
import { resolvePhotoSlots, slotFractions } from './photoSlots';

/** A rectangle in canvas space: 0..1 of width/height, origin top-left. */
export interface SpecRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface SpecText {
  text: string;
  /** vertical centre of the line, 0..1 of the canvas height */
  centreY: number;
  /** font size as a fraction of the canvas width (CSS `cqw` base) */
  fontSize: number;
}

export interface PrintSpec {
  canvas: { width: number; height: number };
  background: {
    kind: 'solid' | 'gradient' | 'image';
    color: string;
    /** second stop for a gradient; identical to `color` when solid */
    secondary: string;
    url: string | null;
  };
  slots: SpecRect[];
  slotShape: string;
  filter: FilterId;
  /** the exact matrix the preview uses; null for "original" */
  filterMatrix: ColorMatrix | null;
  stickers: Array<{ id: string; emoji: string; cx: number; cy: number; size: number }>;
  /**
   * Template artwork: `under` is painted before the photos (background frames),
   * `over` after them (vignettes, borders). Boxes are normalised; `contain`
   * mirrors the preview's `resizeMode="contain"` for non-full-frame images.
   */
  decorations: Array<{
    url: string;
    over: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    contain: boolean;
  }>;
  /**
   * Some designs (RoyalWedding, FestiveMaroon, LegacyGuestbook, …) carry a
   * centred title band across the top instead of — or as well as — the footer
   * copy. It lives in the spec for the same reason as the footer: the guest's
   * title is typed once and must appear where the preview showed it.
   */
  titleBand: {
    text: string;
    color: string;
    accent: string;
    /** centring box: left/right 6 %, top 3.2 % */
    box: SpecRect;
    /** font size, fraction of the canvas width */
    fontSize: number;
    /** the accent rule under the title, fraction of the canvas width */
    ruleWidth: number;
  } | null;
  footer: {
    color: string;
    /** logo images, left cell, in draw order (the guest's chosen logo first) */
    logos: string[];
    /** the whole footer band (Electron: left/right 4 %, bottom 1 %, height 11 %) */
    box: SpecRect;
    /** left cell: logos, `object-fit: contain`, height = 70 % of the band */
    logoArea: SpecRect;
    /** right cell edge — text is right-aligned here */
    textRight: number;
    maxTextWidth: number;
    title: SpecText | null;
    subtitle: SpecText | null;
  };
}

/** One em of a sticker as a fraction of the print width (Electron: 8cqw × 1.2). */
export const STICKER_EM_FRACTION = 0.096;

/** Fallback look for a designer template that ships no styling of its own. */
export const DESIGNER_PRESETS: Record<string, any> = {
  ClassicPostcard: {
    background: { type: 'solid', colors: ['#FFFFFF'] },
    accent: '#2A2338',
    textColor: '#191424',
    ornament: 'frame',
    slotShape: 'rect',
    title: 'HAPPYPIX',
  },
  MinimalMono: {
    background: { type: 'solid', colors: ['#FAFAF8'] },
    accent: '#191424',
    textColor: '#403952',
    ornament: 'none',
    slotShape: 'rect',
    title: 'UNTITLED',
  },
  PanoramaStory: {
    background: { type: 'gradient', colors: ['#241E33', '#14101F'] },
    accent: '#A99BE8',
    textColor: '#FFFFFF',
    ornament: 'none',
    slotShape: 'round',
    title: 'PANORAMA',
  },
  RoyalWedding: {
    background: { type: 'gradient', colors: ['#5F4CAA', '#3A3170'] },
    accent: '#D9B44A',
    textColor: '#F3D9A4',
    ornament: 'flourish',
    slotShape: 'arch',
    titleBand: true,
    title: 'Royal Wedding',
  },
  VintageBookmark: {
    background: { type: 'solid', colors: ['#F5EEDC'] },
    accent: '#6B5B3E',
    textColor: '#4C3F26',
    ornament: 'dots',
    slotShape: 'rect',
    title: 'A Keepsake',
  },
  GalaGold: {
    background: { type: 'solid', colors: ['#191420'] },
    accent: '#D9B44A',
    textColor: '#F3D9A4',
    ornament: 'frame',
    slotShape: 'rect',
    title: 'Gala Night',
    subtitle: 'Presented with joy',
  },
  FestiveMaroon: {
    background: { type: 'solid', colors: ['#6E1F2A'] },
    accent: '#D9B44A',
    textColor: '#FFE9D6',
    ornament: 'stripes',
    slotShape: 'round',
    titleBand: true,
    title: 'Festive Wishes',
  },
  LegacyGuestbook: {
    background: { type: 'gradient', colors: ['#1E3E70', '#12264A'] },
    accent: '#D9B44A',
    textColor: '#F3D9A4',
    ornament: 'frame',
    slotShape: 'round',
    titleBand: true,
    title: 'The Guest Book',
  },
  NeonParty: {
    background: { type: 'gradient', colors: ['#EA097F', '#5F4CAA'] },
    accent: '#FF7AC1',
    textColor: '#FFFFFF',
    ornament: 'glow',
    slotShape: 'round',
    title: 'NEON NIGHT',
  },
  SunsetStrip: {
    background: { type: 'gradient', colors: ['#F7B733', '#EA097F'] },
    accent: '#FFFFFF',
    textColor: '#FFFFFF',
    ornament: 'dots',
    slotShape: 'round',
    title: 'SUNSET',
  },
  FilmStrip: {
    background: { type: 'solid', colors: ['#141414'] },
    accent: '#FFB000',
    textColor: '#FFB000',
    ornament: 'sprockets',
    slotShape: 'rect',
    title: 'HAPPYPIX FILM',
    subtitle: 'FRAME 04 · 2026',
  },
  CollectorReel: {
    background: { type: 'gradient', colors: ['#DFF2F2', '#B7DFDF'] },
    accent: '#0E7490',
    textColor: '#0B5D73',
    ornament: 'frame',
    slotShape: 'round',
    title: 'COLLECTOR 2026',
  },
  KidsSplash: {
    background: { type: 'gradient', colors: ['#DDEBFF', '#FFE9F2'] },
    accent: '#2A6FBE',
    textColor: '#2A6FBE',
    ornament: 'dots',
    slotShape: 'round',
    title: 'Splash Time!',
  },
  CorporateGrid: {
    background: { type: 'solid', colors: ['#FFFFFF'] },
    accent: '#3871C1',
    textColor: '#403952',
    ornament: 'headerBand',
    slotShape: 'round',
    titleBand: true,
    title: 'Team Offsite 2026',
    subtitle: 'HappyPix · captured & printed on site',
  },
};

/**
 * The design a template actually renders with: its preset defaults overlaid by
 * whatever the template itself specifies.
 *
 * Both the preview and the print read this, so a designer template whose
 * appearance lives in the preset (background, accent, title band) looks the same
 * on paper as on the glass instead of falling back to the print's own defaults.
 *
 * A template that still carries the unstyled white placeholder palette is
 * treated as "preset wins", because that palette is not a decision anybody made.
 */
export function resolveDesign(template: BoothTemplate): any {
  const raw: any = (template as any).design || {};
  const preset = (template.componentId && DESIGNER_PRESETS[template.componentId]) || null;
  const isUnstyledWhiteFallback =
    preset &&
    raw.background?.type === 'solid' &&
    raw.background?.colors?.[0]?.toLowerCase() === '#ffffff' &&
    raw.accent === '#ff4f9a' &&
    template.componentId !== 'ClassicPostcard';
  return isUnstyledWhiteFallback ? { ...raw, ...preset } : { ...preset, ...raw };
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Resolves the background exactly as `TemplateCanvas` resolves it. */
function resolveBackground(template: BoothTemplate): PrintSpec['background'] {
  // The resolved design, so a preset-only template prints its own palette
  // instead of the renderer's default dark canvas.
  const design: any = resolveDesign(template);
  const templateAssets: any[] = Array.isArray((template as any).assets) ? (template as any).assets : [];
  const assetId = design.background?.assetId || design.bg?.assetId;
  const matchedAsset =
    (assetId && templateAssets.find((a: any) => a.assetId === assetId)) ||
    templateAssets.find((a: any) => a.role === 'background' || a.type === 'background');

  const url =
    design.background?.url ||
    (typeof design.background === 'string' &&
    (design.background.startsWith('http') ||
      design.background.startsWith('data:') ||
      design.background.startsWith('/'))
      ? design.background
      : null) ||
    design.bg?.url ||
    matchedAsset?.url ||
    null;

  const bgObj = design.background?.colors ? design.background : design.bg?.colors ? design.bg : null;
  const paletteBg = design.palette?.background || design.theme?.background;
  const colors: string[] =
    (Array.isArray(bgObj?.colors) && bgObj.colors.length > 0 && bgObj.colors) ||
    (paletteBg ? [paletteBg] : ['#1e1b2e']);

  const isGradient = !url && (bgObj?.type === 'gradient' || colors.length > 1);

  return {
    kind: url ? 'image' : isGradient ? 'gradient' : 'solid',
    color: colors[0] || '#ffffff',
    secondary: colors[1] || colors[0] || '#ffffff',
    url,
  };
}

/**
 * Builds the single description of the print.
 *
 * Pure: no React, no image loading, no platform APIs — which is what makes it
 * testable, and what lets the preview (which has measured sizes) and the print
 * (which has 300 dpi paper sizes) agree.
 */
export function buildPrintSpec(input: {
  template: BoothTemplate;
  customization?: Partial<Customization> | null;
}): PrintSpec {
  const { template } = input;
  const customization: any = input.customization || {};
  // The *resolved* design (preset defaults + template overrides), not the raw
  // one — otherwise a designer template prints with none of its own styling.
  const design: any = resolveDesign(template);
  const canvas = (template as any)?.layout?.canvas || { width: 1000, height: 1500 };
  const canvasW = Number(canvas.width) || 1000;
  const canvasH = Number(canvas.height) || 1500;

  // ── slots: the shared resolver, normalised ────────────────────────────────
  const rawSlots = resolvePhotoSlots(template as any);
  const slots: SpecRect[] = rawSlots.map((slot: any) => {
    const f = slotFractions(slot, canvas);
    return {
      x: clamp01(f.x),
      y: clamp01(f.y),
      width: clamp01(f.width),
      height: clamp01(f.height),
      rotation: Number(slot.rotation) || 0,
    };
  });

  // ── filter: the same matrix on both surfaces ──────────────────────────────
  const filter = (customization.filter || 'original') as FilterId;

  // ── decorations: the same list, resolved the same way, as the preview ─────
  const templateAssets: any[] = Array.isArray((template as any).assets) ? (template as any).assets : [];
  const rawDecs: any[] = Array.isArray(design.decorations) ? [...design.decorations] : [];
  for (const asset of templateAssets) {
    if (!asset || asset.role === 'background' || asset.type === 'background') continue;
    if (asset.role === 'overlay' || asset.role === 'frame' || asset.type === 'overlay') {
      const exists = rawDecs.some(
        (d: any) => (d.assetId && d.assetId === asset.assetId) || (d.url && d.url === asset.url)
      );
      if (!exists && asset.url) {
        rawDecs.push({ assetId: asset.assetId, url: asset.url, overlay: true, x: 0, y: 0, width: 1, height: 1 });
      }
    }
  }

  const decorations = rawDecs
    .map((d: any) => {
      if (!d) return null;
      let url = d.url;
      if (!url && d.assetId) url = templateAssets.find((a: any) => a.assetId === d.assetId)?.url;
      return url ? { ...d, url } : null;
    })
    .filter(Boolean)
    .map((d: any) => {
      const over = d.overlay !== false && d.position !== 'background';
      const num = (value: unknown) => (value === undefined || value === null || Number.isNaN(Number(value)) ? null : Number(value));
      const x = num(d.x);
      const y = num(d.y);
      const w = num(d.width);
      const h = num(d.height);
      const asFraction = (value: number | null, axis: 'x' | 'y') => {
        if (value === null) return 0;
        // Values <= 4 are already fractions (Electron's rule); larger numbers
        // are canvas units.
        return Math.abs(value) <= 4 ? value : value / (axis === 'x' ? canvasW : canvasH);
      };

      let rect = {
        x: asFraction(x, 'x'),
        y: asFraction(y, 'y'),
        width: w === null || w <= 0 ? 1 : asFraction(w, 'x'),
        height: h === null || h <= 0 ? 1 : asFraction(h, 'y'),
      };
      if (d.position === 'top-right') rect = { x: 0.7, y: 0, width: 0.3, height: 0.3 };
      if (d.position === 'bottom-left') rect = { x: 0, y: 0.7, width: 0.3, height: 0.3 };

      const isFullFrame =
        rect.width >= 0.95 && rect.height >= 0.95 && Math.abs(rect.x) <= 0.05 && Math.abs(rect.y) <= 0.05;

      return {
        url: String(d.url),
        over,
        x: clamp01(rect.x),
        y: clamp01(rect.y),
        width: clamp01(Math.min(1, rect.width)),
        height: clamp01(Math.min(1, rect.height)),
        contain: !isFullFrame,
      };
    });

  // ── stickers: Electron's percentage model ─────────────────────────────────
  const stickers = (Array.isArray(customization.stickers) ? customization.stickers : [])
    .filter((s: any) => s && (s.emoji || s.url))
    .map((s: any, index: number) => {
      const scale = Number(s.scale ?? (s.size ? Number(s.size) / 34 : 1)) || 1;
      return {
        id: s.id || `sticker-${index}`,
        emoji: s.emoji || '',
        cx: clamp01(Number(s.x) / 100),
        cy: clamp01(Number(s.y) / 100),
        size: STICKER_EM_FRACTION * Math.max(0.5, Math.min(4, scale)),
      };
    });

  // ── footer: Electron `.template-footer` ───────────────────────────────────
  // left 4 %, right 4 %, bottom 1 %, height 11 %
  const box: SpecRect = { x: 0.04, y: 0.88, width: 0.92, height: 0.11 };
  const gap = box.width * 0.03; // CSS `gap: 3%`
  const leftWidth = (box.width - gap) * (1 / 2.8); // grid-template-columns: 1fr 1.8fr
  const textRight = box.x + box.width;
  const title = customization.title || design.title;
  const subtitle = customization.subtitle || design.subtitle || design.tagline;
  const textColor = design.textColor || design.palette?.text || '#ffffff';
  // A design that wears a title band prints the title up there; repeating it in
  // the footer would show the guest's words twice on the paper.
  const bandTitle =
    design.titleBand && template.componentId !== 'CorporateGrid' && title ? String(title) : null;

  return {
    canvas: { width: canvasW, height: canvasH },
    background: resolveBackground(template),
    slots,
    slotShape: String(design.slotShape || 'square').toLowerCase(),
    filter,
    filterMatrix: filterMatrix(filter),
    stickers,
    decorations,
    titleBand: bandTitle
      ? {
          text: bandTitle,
          color: textColor,
          accent: String(design.accent || design.palette?.accent || design.palette?.primary || '#8b5cf6'),
          box: { x: 0.06, y: 0.032, width: 0.88, height: 0.09 },
          fontSize: 0.042,
          ruleWidth: 0.36,
        }
      : null,
    footer: {
      color: textColor,
      logos: customization.logo ? [String(customization.logo)] : [],
      box,
      logoArea: {
        x: box.x,
        y: box.y + box.height * 0.15,
        width: leftWidth,
        height: box.height * 0.7,
      },
      textRight,
      maxTextWidth: box.width - leftWidth - gap,
      title:
        !bandTitle && title
          ? { text: String(title), centreY: box.y + box.height * 0.38, fontSize: 0.05 }
          : null,
      subtitle: subtitle
        ? { text: String(subtitle), centreY: box.y + box.height * 0.76, fontSize: 0.025 }
        : null,
    },
  };
}

/**
 * The logo box for a logo of `aspect` (w/h) inside the footer.
 *
 * Widths are fractions of the canvas *width* and heights fractions of the
 * canvas *height*, so the aspect has to be resolved in pixels and converted
 * back — otherwise a 4:3 logo is squeezed by the canvas aspect (`contain`
 * semantics, exactly what the preview's `resizeMode="contain"` does).
 */
export function logoRect(spec: PrintSpec, aspect: number): SpecRect {
  const area = spec.footer.logoArea;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const canvasW = spec.canvas.width || 1000;
  const canvasH = spec.canvas.height || 1500;

  const maxHeightPx = area.height * canvasH;
  const maxWidthPx = area.width * canvasW;
  let heightPx = maxHeightPx;
  let widthPx = heightPx * safeAspect;
  if (widthPx > maxWidthPx) {
    widthPx = maxWidthPx;
    heightPx = widthPx / safeAspect;
  }
  return {
    x: area.x,
    y: area.y + (maxHeightPx - heightPx) / 2 / canvasH,
    width: widthPx / canvasW,
    height: heightPx / canvasH,
  };
}
