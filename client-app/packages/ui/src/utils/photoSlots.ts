/**
 * One resolver for "where do the photos go".
 *
 * Three places used to answer that question independently, and each answered it
 * slightly differently:
 *
 *  · `TemplateCanvas` (the on-screen preview) fell back to `template.slots`;
 *  · `boothTemplateToPrintTemplate` (the final print) fell back to
 *    `template.slots` too but re-derived paper pixels on its own;
 *  · the selection screens counted slots from `layout.slots`, which is a
 *    *number* (the slot count) in some templates and an array in others.
 *
 * That is how a preview could show a photo in slot 2 while the print put it in
 * slot 1 — or the screens asked for two photos for a three-slot template. Every
 * consumer now reads this module, so preview, selection and print agree by
 * construction.
 */

export interface PhotoSlot {
  /** Slot rectangle in canvas units (not normalised). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Radius in canvas units, or a percentage-style fraction (<= 1). */
  radius?: number;
  rotation?: number;
  shape?: string;
  [key: string]: unknown;
}

export interface SlotCanvas {
  width: number;
  height: number;
}

type AnyTemplate = {
  layout?: {
    canvas?: SlotCanvas;
    photoSlots?: unknown;
    slots?: unknown;
  } | null;
  slots?: unknown;
  [key: string]: unknown;
};

const asArray = (value: unknown): PhotoSlot[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((slot): slot is PhotoSlot => Boolean(slot) && typeof slot === 'object');
};

const isRelative = (slot: PhotoSlot): boolean =>
  Number(slot.width) <= 1 &&
  Number(slot.height) <= 1 &&
  Number(slot.x) <= 1 &&
  Number(slot.y) <= 1;

export const DEFAULT_SLOT_CANVAS: SlotCanvas = { width: 1200, height: 1800 };

/** The template's canvas, with a sane fallback when it is missing. */
export function resolveSlotCanvas(template: AnyTemplate | null | undefined): SlotCanvas {
  const canvas = template?.layout?.canvas;
  const width = Number(canvas?.width);
  const height = Number(canvas?.height);
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { width, height };
  }
  return DEFAULT_SLOT_CANVAS;
}

/**
 * The template's photo slots in drawing order, always normalised to the
 * template canvas. `layout.photoSlots` wins; `template.slots` is the legacy
 * field; `layout.slots` is only ever a *count* and never lists geometry.
 */
export function resolvePhotoSlots(template: AnyTemplate | null | undefined): PhotoSlot[] {
  const layoutSlots = template?.layout?.photoSlots;
  const candidates =
    Array.isArray(layoutSlots) && layoutSlots.length > 0
      ? asArray(layoutSlots)
      : asArray(template?.slots);
  if (candidates.length > 0) return candidates;

  // Nothing declarative: honour a bare count so sessions still collect as many
  // photos as the layout asks for.
  const count = Number(template?.layout?.slots);
  if (Number.isFinite(count) && count > 0) {
    const { width, height } = resolveSlotCanvas(template);
    const columns = count > 3 ? 2 : 1;
    const rows = Math.ceil(count / columns);
    const gap = 0.04;
    const cellW = (1 - gap * (columns + 1)) / columns;
    const cellH = (1 - gap * (rows + 1)) / rows;
    return Array.from({ length: Math.floor(count) }, (_, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
        x: (gap + column * (cellW + gap)) * width,
        y: (gap + row * (cellH + gap)) * height,
        width: cellW * width,
        height: cellH * height,
      };
    });
  }
  return [];
}

/** How many photos the guest must place for this template. */
export function resolveSlotCount(template: AnyTemplate | null | undefined): number {
  const slots = resolvePhotoSlots(template);
  if (slots.length > 0) return slots.length;
  const declared = Number(template?.layout?.slots);
  if (Number.isFinite(declared) && declared > 0) return Math.floor(declared);
  return 1;
}

/**
 * Maps a slot onto a destination box (preview or print), returning absolute
 * coordinates in that box. Handles both the relative (0–1) and the absolute
 * (canvas-pixel) conventions that the template library contains.
 */
export function placeSlot(
  slot: PhotoSlot,
  source: SlotCanvas,
  target: SlotCanvas
): { x: number; y: number; width: number; height: number } {
  if (isRelative(slot)) {
    return {
      x: Number(slot.x) * target.width,
      y: Number(slot.y) * target.height,
      width: Number(slot.width) * target.width,
      height: Number(slot.height) * target.height,
    };
  }
  return {
    x: (Number(slot.x) / source.width) * target.width,
    y: (Number(slot.y) / source.height) * target.height,
    width: (Number(slot.width) / source.width) * target.width,
    height: (Number(slot.height) / source.height) * target.height,
  };
}

/** The slot's rectangle as 0–1 fractions of the canvas, for percentage layout. */
export function slotFractions(
  slot: PhotoSlot,
  source: SlotCanvas = DEFAULT_SLOT_CANVAS
): { x: number; y: number; width: number; height: number } {
  if (isRelative(slot)) {
    return {
      x: Number(slot.x),
      y: Number(slot.y),
      width: Number(slot.width),
      height: Number(slot.height),
    };
  }
  return {
    x: Number(slot.x) / source.width,
    y: Number(slot.y) / source.height,
    width: Number(slot.width) / source.width,
    height: Number(slot.height) / source.height,
  };
}
