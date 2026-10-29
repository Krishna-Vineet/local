// ============================================================
// HappyPix Photo Booth — Layout Master List (v3 model)
//
// 16 layout families. Each family has a cutout size (what the
// guest keeps), the native media/sheet it is printed on, and a
// set of image-slot iterations. Every iteration exists in BOTH
// orientations (vertical + horizontal) → the full layout
// catalogue the CRM, org defaults and booth app share.
//
// Geometry: canvas units = inches × 250 (≈63.5 dpi preview space;
// proportions are what matter — SVG scales freely). The bottom
// 15% of every layout is the branding footer where the template
// places the event logos (sponsors/host/venue/team) + tagline.
// ============================================================

export const FOOTER_RATIO = 0.15

// families: id, name, print code(s), cutout inches [w,h] (portrait),
// sheet(s) it is cut from, image-slot iterations, suggested base price.
export const LAYOUT_FAMILIES = [
  { id: '46-23',   name: 'Pocket Polaroid',       code: '46-23',            cutout: [2, 3],   sheets: ['4x6'],            slots: [1],       base: 20, blurb: 'Tiny keepable polaroid — giveaways and ice-breakers.' },
  { id: '46-26',   name: 'Classic Duo Strip',     code: '46-26',            cutout: [2, 6],   sheets: ['4x6'],            slots: [3, 4],    base: 30, blurb: 'The classic photo strip, two-up per 4x6 sheet.' },
  { id: '68-38',   name: 'Custom Bookmark',       code: '68-38 / 812-38',   cutout: [3, 8],   sheets: ['6x8', '8x12'],    slots: [3, 4],    base: 40, blurb: 'Tall bookmark cut — event keepsake with room for art.' },
  { id: '46',      name: 'Standard Postcard',     code: '46',               cutout: [4, 6],   sheets: ['4x6'],            slots: [1, 2, 3, 4, 5, 6, 8], base: 30, blurb: 'The everyday 4x6 postcard.' },
  { id: '810-410', name: 'Panoramic Mini',        code: '810-410',          cutout: [4, 10],  sheets: ['8x10'],           slots: [2, 3, 4],    base: 60, blurb: 'Slim panoramic cut from 8x10 stock.' },
  { id: '812-412', name: 'Panoramic Wide',        code: '812-412',          cutout: [4, 12],  sheets: ['8x12'],           slots: [3, 4, 5],    base: 70, blurb: 'Cinematic 4x12 panorama from poster stock.' },
  { id: '57',      name: 'Portrait Keep-Safe',    code: '57',               cutout: [5, 7],   sheets: ['5x7'],            slots: [1, 2, 3, 4, 5, 6, 8], base: 50, blurb: 'Framable 5x7 portrait print.' },
  { id: '57-257',  name: 'Bookmark Strip',        code: '57-257',           cutout: [2.5, 7], sheets: ['5x7'],            slots: [2, 3, 4],    base: 40, blurb: 'Two bookmark strips per 5x7 sheet.' },
  { id: '68',      name: 'Gala Display',          code: '68',               cutout: [6, 8],   sheets: ['6x8'],            slots: [1, 2, 3, 4, 5, 6, 8], base: 60, blurb: 'Gallery-size 6x8 display print.' },
  { id: '68-26',   name: 'Triple Gala Strip',     code: '68-26',            cutout: [2, 6],   sheets: ['6x8'],            slots: [2, 3, 4],    base: 50, blurb: 'Premium strip stock — three 2x6 strips per 6x8.' },
  { id: '68-46',   name: 'Double Postcard Cut',   code: '68-46',            cutout: [4, 6],   sheets: ['6x8'],            slots: [1, 2, 3, 4], base: 50, blurb: 'Two 4x6 postcards ganged on 6x8 stock.' },
  { id: '810',     name: 'Grand Guestbook Print', code: '810',              cutout: [8, 10],  sheets: ['8x10'],           slots: [1, 2, 3, 4, 5, 6, 8, 9], base: 80, blurb: 'Big 8x10 — guestbook signings and group grids.' },
  { id: '810-210', name: 'Collector Strip',       code: '810-210',          cutout: [2, 10],  sheets: ['8x10'],           slots: [2, 3, 4, 5], base: 40, blurb: 'Extra-tall 2x10 collector reel.' },
  { id: '810-258', name: 'Wide Strip Cut',        code: '810-258',          cutout: [2.5, 8], sheets: ['8x10'],           slots: [2, 3, 4],    base: 35, blurb: 'Wide bookmark cut from 8x10 stock.' },
  { id: '812',     name: 'Poster Showcase',       code: '812',              cutout: [8, 12],  sheets: ['8x12'],           slots: [1, 2, 3, 4, 5, 6, 8], base: 90, blurb: 'Full 8x12 poster — the showpiece print.' },
  { id: '812-68',  name: 'Quad Strip Reel',       code: '812-68',           cutout: [2, 6],   sheets: ['8x12'],           slots: [2, 3, 4],    base: 60, blurb: 'Four premium strips ganged on 8x12 poster stock.' },
]

const UNIT = 250 // px per inch in layout space

function buildVariant(family, orientation, slots) {
  const [a, b] = family.cutout
  const vertical = orientation === 'portrait'
  const w = Math.round((vertical ? Math.min(a, b) : Math.max(a, b)) * UNIT)
  const h = Math.round((vertical ? Math.max(a, b) : Math.min(a, b)) * UNIT)
  const o = vertical ? 'v' : 'h'
  return {
    id: `${family.id}-${o}${slots}`,
    familyId: family.id,
    name: family.name,
    code: family.code,
    orientation: vertical ? 'portrait' : 'landscape',
    slots,
    cutout: family.cutout,
    sheets: family.sheets,
    canvas: { w, h },
  }
}

export const LAYOUTS = LAYOUT_FAMILIES.flatMap((f) =>
  ['portrait', 'landscape'].flatMap((o) => f.slots.map((s) => buildVariant(f, o, s)))
)

export const LAYOUT_BY_ID = Object.fromEntries(LAYOUTS.map((l) => [l.id, l]))
export const LAYOUT_IDS = LAYOUTS.map((l) => l.id)

export function layoutById(id) {
  return LAYOUT_BY_ID[id] || null
}

export function resolveLayout(template) {
  if (!template) return null;
  const layout = layoutById(template.layoutId);
  if (layout) return layout;

  if (template.type === 'org' || template.source === 'manual' || template.source === 'ai_generated' || template.layout?.width) {
    const layoutId = template.layoutId || template.layout?.code || 'custom';
    const w = template.layout?.width || 1200;
    const h = template.layout?.height || 1800;
    const parts = String(layoutId).split('-');
    const rawFamily = (parts[0]?.toUpperCase().startsWith('P') && parts[1]) ? parts[1] : parts[0];
    const matchedFamily = LAYOUT_FAMILIES.find((f) => f.id === rawFamily || f.id === parts[0] || f.id === parts[1])?.id || rawFamily || '46';
    let slotCount = template.slots?.length || template.layout?.slotCount;
    if (!slotCount && parts[2]?.toUpperCase().startsWith('T')) {
      slotCount = parseInt(parts[2].replace(/[^0-9]/g, ''), 10) || 1;
    }
    return {
      id: layoutId,
      familyId: matchedFamily,
      name: `Custom Format (${template.originalLayoutCode || layoutId})`,
      orientation: template.layout?.orientation || (layoutId.toUpperCase().includes('-H-') ? 'landscape' : 'portrait'),
      slots: slotCount || 1,
      canvas: { w, h },
      cutout: [Math.round(w / 300 * 10) / 10 || 4, Math.round(h / 300 * 10) / 10 || 6],
      sheets: ['Custom']
    };
  }
  return null;
}

export function layoutsForFamily(familyId) {
  return LAYOUTS.filter((l) => l.familyId === familyId)
}

// human label: "4x6 · Vertical · 3 images"
export function layoutLabel(l) {
  if (!l) return '—'
  const [a, b] = l.cutout
  const dims = l.orientation === 'portrait' ? `${a}×${b}` : `${b}×${a}`
  return `${dims} in · ${l.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} · ${l.slots} image${l.slots > 1 ? 's' : ''}`
}

export function layoutShortLabel(l) {
  if (!l) return '—'
  const [a, b] = l.cutout
  const dims = l.orientation === 'portrait' ? `${a}×${b}` : `${b}×${a}`
  return `${dims} · ${l.slots}img`
}

// ---------- filter option sets (booth + CRM pickers) ----------
export const ORIENTATION_OPTIONS = [
  { id: 'portrait', label: 'Vertical' },
  { id: 'landscape', label: 'Horizontal' },
]
export const SHEET_OPTIONS = [...new Set(LAYOUT_FAMILIES.flatMap((f) => f.sheets))]
export const SLOT_OPTIONS = [...new Set(LAYOUTS.map((l) => l.slots))].sort((a, b) => a - b)
export const TEMPLATE_CATEGORIES = ['Classic', 'Weddings', 'Parties', 'Corporate', 'Celebrations', 'Custom']

// ---------- suggested price per layout iteration ----------
// What the guest pays for the print — org admins override per layout
// in Organization Defaults. Price does not change with orientation
// (same print cost), only with the layout's size and image count.
const SLOT_ADD = { 1: 0, 2: 5, 3: 10, 4: 10, 5: 20, 6: 30, 8: 60, 9: 40 }

export function suggestedPrice(familyId, slots) {
  const f = LAYOUT_FAMILIES.find((x) => x.id === familyId)
  if (!f) return 0
  return (f.base || 0) + (SLOT_ADD[slots] || 0)
}

export const PRICE_KEY = (familyId, slots) => `${familyId}:${slots}`

// full suggested price map — the seed/default for every organization
export function suggestedPriceMap() {
  const out = {}
  for (const f of LAYOUT_FAMILIES) for (const s of f.slots) out[PRICE_KEY(f.id, s)] = suggestedPrice(f.id, s)
  return out
}

// ---------- geometry: photo slots for a layout variant ----------
// Returns { canvas, photoSlots: [{ id, x, y, width, height }], footer: { y, h } }
// in layout units (inches × 250). Footer = bottom 15% (logos + tagline).
export function slotsForLayout(layoutOrId) {
  const l = typeof layoutOrId === 'string' ? LAYOUT_BY_ID[layoutOrId] : layoutOrId;
  if (!l) return { canvas: { w: 1000, h: 1500 }, photoSlots: [], footer: { y: 1275, h: 225 } }
  const { w, h } = l.canvas
  const footerH = Math.round(h * FOOTER_RATIO)
  const photo = { w, h: h - footerH }
  const slots = arrange(photo.w, photo.h, l.slots).map((r, i) => ({
    id: `slot-${i + 1}`,
    x: Math.round(r.x),
    y: Math.round(r.y),
    width: Math.round(r.w),
    height: Math.round(r.h),
  }))
  return { canvas: { w, h }, photoSlots: slots, footer: { y: h - footerH, h: footerH } }
}

function arrange(w, h, n) {
  const g = Math.max(10, Math.round(w * 0.022))
  const aspect = w / h
  const out = []
  const row = (cols, y, rh) => {
    const cw = (w - g * (cols - 1)) / cols
    for (let i = 0; i < cols; i++) out.push({ x: i * (cw + g), y, w: cw, h: rh })
    return out
  }
  const col = (rows, x, cw) => {
    const rh = (h - g * (rows - 1)) / rows
    for (let i = 0; i < rows; i++) out.push({ x, y: i * (rh + g), w: cw, h: rh })
    return out
  }
  const grid = (cols, rows) => {
    const cw = (w - g * (cols - 1)) / cols
    const rh = (h - g * (rows - 1)) / rows
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: c * (cw + g), y: r * (rh + g), w: cw, h: rh })
    return out
  }

  if (n === 1) return [{ x: 0, y: 0, w, h }]
  if (n === 2) return aspect >= 1 ? row(2, 0, h) : col(2, 0, w)
  if (n === 3) {
    if (aspect <= 0.5) return col(3, 0, w)
    if (aspect >= 1.15) {
      const bw = Math.round((w - g) * 0.58)
      const out2 = [{ x: 0, y: 0, w: bw, h }]
      const rh = (h - g) / 2
      out2.push({ x: bw + g, y: 0, w: w - bw - g, h: rh })
      out2.push({ x: bw + g, y: rh + g, w: w - bw - g, h: rh })
      return out2
    }
    const bh = Math.round((h - g) * 0.58)
    const out2 = [{ x: 0, y: 0, w, h: bh }]
    const cw = (w - g) / 2
    out2.push({ x: 0, y: bh + g, w: cw, h: h - bh - g })
    out2.push({ x: cw + g, y: bh + g, w: cw, h: h - bh - g })
    return out2
  }
  if (n === 4) {
    if (aspect <= 0.42) return col(4, 0, w)
    if (aspect >= 2.1) return row(4, 0, h)
    return grid(2, 2)
  }
  if (n === 5) {
    if (aspect <= 0.42) return col(5, 0, w)
    if (aspect >= 2.1) return row(5, 0, h)
    if (aspect >= 1.15) {
      const bw = Math.round((w - g) * 0.52)
      const out2 = [{ x: 0, y: 0, w: bw, h }]
      const gw = w - bw - g
      const cw = (gw - g) / 2
      const rh = (h - g) / 2
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) out2.push({ x: bw + g + c * (cw + g), y: r * (rh + g), w: cw, h: rh })
      return out2
    }
    const bh = Math.round((h - g) * 0.52)
    const out2 = [{ x: 0, y: 0, w, h: bh }]
    const gh = h - bh - g
    const rh = (gh - g) / 2
    const cw = (w - g) / 2
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) out2.push({ x: c * (cw + g), y: bh + g + r * (rh + g), w: cw, h: rh })
    return out2
  }
  if (n === 6) {
    if (aspect <= 0.42) return col(6, 0, w)
    if (aspect >= 1.15) return grid(3, 2)
    return grid(2, 3)
  }
  if (n === 8) return aspect >= 1 ? grid(4, 2) : grid(2, 4)
  if (n === 9) return grid(3, 3)
  // fallback: simple column
  return col(n, 0, w)
}

// convenience: aspect-ratio css for a layout preview box
export function layoutAspect(layoutId) {
  const l = LAYOUT_BY_ID[layoutId]
  return l ? `${l.canvas.w} / ${l.canvas.h}` : '2 / 3'
}

// ============================================================
// Universal Photobooth Geometry & Codeword Engine
// Calculates exact normalized coordinates (0..1) for any media,
// aspect ratio, slot count, orientation, or structure.
// ============================================================

export function computeLayoutGeometry(width, height, count, structure = 'GRID', orientation = 'portrait') {
  const n = Math.max(1, parseInt(count, 10) || 1);
  const s = String(structure || 'GRID').toUpperCase();
  const isLandscape = orientation === 'landscape' || orientation === 'H' || width > height;

  // Reserved branding footer: 16% in portrait, 14% in landscape
  const footerRatio = isLandscape ? 0.14 : 0.16;
  const padX = isLandscape ? 0.035 : 0.04;
  const padY = isLandscape ? 0.035 : 0.04;
  const gap = isLandscape ? 0.02 : 0.025;

  const availX = padX;
  const availY = padY;
  const availW = Number((1.0 - (padX * 2)).toFixed(4));
  const availH = Number(((1.0 - footerRatio) - padY * 1.5).toFixed(4));

  const footer = {
    x: padX,
    y: Number((1.0 - footerRatio).toFixed(4)),
    width: availW,
    height: Number((footerRatio - padY).toFixed(4)),
  };

  const slots = [];
  const round4 = (v) => Number(Number(v).toFixed(4));

  // Pixel aspect ratio = width / height. Used for true square calculations in normalized space.
  const pixelRatio = width / height;

  if (s === 'HERO' || s === 'FULL' || n === 1) {
    slots.push({ id: 'photo-1', x: round4(availX), y: round4(availY), width: round4(availW), height: round4(availH) });
  }
  else if (s === 'SQUARE') {
    // True square in pixel space means: (slot.width * width) === (slot.height * height)
    // => slot.height = slot.width * pixelRatio
    if (pixelRatio < 0.6) {
      // Very tall strip (like 2x6, 1:3): vertical stack of N squares
      const maxCh = (availH - gap * (n - 1)) / n;
      const maxCw = maxCh / pixelRatio;
      const cw = round4(Math.min(availW, maxCw));
      const ch = round4(cw * pixelRatio);
      const totalH = round4(n * ch + (n - 1) * gap);
      const startX = round4(availX + (availW - cw) / 2);
      const startY = round4(availY + (availH - totalH) / 2);
      for (let i = 0; i < n; i++) {
        slots.push({
          id: `photo-${i + 1}`,
          x: startX,
          y: round4(startY + i * (ch + gap)),
          width: cw,
          height: ch,
        });
      }
    } else if (pixelRatio > 1.6) {
      // Very wide strip: horizontal row of N squares
      const maxCw = (availW - gap * (n - 1)) / n;
      const maxCh = maxCw * pixelRatio;
      const ch = round4(Math.min(availH, maxCh));
      const cw = round4(ch / pixelRatio);
      const totalW = round4(n * cw + (n - 1) * gap);
      const startX = round4(availX + (availW - totalW) / 2);
      const startY = round4(availY + (availH - ch) / 2);
      for (let i = 0; i < n; i++) {
        slots.push({
          id: `photo-${i + 1}`,
          x: round4(startX + i * (cw + gap)),
          y: startY,
          width: cw,
          height: ch,
        });
      }
    } else {
      // Standard card (4x6, 5x7, 8x10): Grid of squares
      let cols = n <= 3 ? 1 : (n <= 4 ? 2 : 3);
      if (pixelRatio > 1 && n <= 3) cols = n;
      const rows = Math.ceil(n / cols);
      const maxCw = (availW - gap * (cols - 1)) / cols;
      const maxCh = (availH - gap * (rows - 1)) / rows;
      const cw = round4(Math.min(maxCw, maxCh / pixelRatio));
      const ch = round4(cw * pixelRatio);
      const totalW = round4(cols * cw + (cols - 1) * gap);
      const totalH = round4(rows * ch + (rows - 1) * gap);
      const startX = round4(availX + (availW - totalW) / 2);
      const startY = round4(availY + (availH - totalH) / 2);
      for (let i = 0; i < n; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        slots.push({
          id: `photo-${i + 1}`,
          x: round4(startX + c * (cw + gap)),
          y: round4(startY + r * (ch + gap)),
          width: cw,
          height: ch,
        });
      }
    }
  }
  else if (s === 'VSTACK' || s === 'STRIP' || s === 'STACK' || s === 'FILM' || s === 'POLAROID') {
    const ch = round4((availH - gap * (n - 1)) / n);
    for (let i = 0; i < n; i++) {
      slots.push({
        id: `photo-${i + 1}`,
        x: round4(availX),
        y: round4(availY + i * (ch + gap)),
        width: round4(availW),
        height: ch,
      });
    }
  }
  else if (s === 'HSTACK') {
    const cw = round4((availW - gap * (n - 1)) / n);
    for (let i = 0; i < n; i++) {
      slots.push({
        id: `photo-${i + 1}`,
        x: round4(availX + i * (cw + gap)),
        y: round4(availY),
        width: cw,
        height: round4(availH),
      });
    }
  }
  else if (s === 'CASCADE' || s === 'DIAGONAL') {
    const ch = round4((availH - gap * (n - 1)) / n);
    const cw = round4(availW * 0.72);
    for (let i = 0; i < n; i++) {
      const isLeft = i % 2 === 0;
      slots.push({
        id: `photo-${i + 1}`,
        x: round4(isLeft ? availX : (availX + availW - cw)),
        y: round4(availY + i * (ch + gap)),
        width: cw,
        height: ch,
      });
    }
  }
  else if (s.startsWith('HERO3') || s.startsWith('HERO5') || s.startsWith('HERO7')) {
    const subCount = n - 1;
    const heroH = round4(availH * 0.58 - gap / 2);
    const subH = round4(availH * 0.42 - gap / 2);
    const subW = round4((availW - gap * (subCount - 1)) / subCount);
    slots.push({ id: 'photo-1', x: round4(availX), y: round4(availY), width: round4(availW), height: heroH });
    for (let i = 1; i < n; i++) {
      slots.push({
        id: `photo-${i + 1}`,
        x: round4(availX + (i - 1) * (subW + gap)),
        y: round4(availY + heroH + gap),
        width: subW,
        height: subH,
      });
    }
  }
  else if (s.includes('HERO-R') || s.includes('HERO_R') || s === 'R3' || s === 'R5') {
    const sideCount = n - 1;
    const heroW = round4(availW * 0.60 - gap / 2);
    const sideW = round4(availW * 0.40 - gap / 2);
    const sideH = round4((availH - gap * (sideCount - 1)) / sideCount);
    slots.push({ id: 'photo-1', x: round4(availX), y: round4(availY), width: heroW, height: round4(availH) });
    for (let i = 1; i < n; i++) {
      slots.push({
        id: `photo-${i + 1}`,
        x: round4(availX + heroW + gap),
        y: round4(availY + (i - 1) * (sideH + gap)),
        width: sideW,
        height: sideH,
      });
    }
  }
  else if (s.includes('HERO-L') || s.includes('HERO_L') || s === 'L3' || s === 'L5') {
    const sideCount = n - 1;
    const sideW = round4(availW * 0.40 - gap / 2);
    const heroW = round4(availW * 0.60 - gap / 2);
    const sideH = round4((availH - gap * (sideCount - 1)) / sideCount);
    for (let i = 1; i < n; i++) {
      slots.push({
        id: `photo-${i + 1}`,
        x: round4(availX),
        y: round4(availY + (i - 1) * (sideH + gap)),
        width: sideW,
        height: sideH,
      });
    }
    slots.push({ id: 'photo-1', x: round4(availX + sideW + gap), y: round4(availY), width: heroW, height: round4(availH) });
  }
  else if (s === '3HERO') {
    const cw = round4((availW - gap) / 2);
    const ch = round4((availH - gap * 2) / 3);
    slots.push({ id: 'photo-1', x: round4(availX), y: round4(availY), width: cw, height: ch });
    slots.push({ id: 'photo-2', x: round4(availX + cw + gap), y: round4(availY), width: cw, height: ch });
    slots.push({ id: 'photo-3', x: round4(availX), y: round4(availY + ch + gap), width: round4(availW), height: ch });
    slots.push({ id: 'photo-4', x: round4(availX), y: round4(availY + 2 * (ch + gap)), width: round4(availW), height: ch });
  }
  else if (s === 'MOSAIC' || s === 'COLLAGE' || s === 'MIX') {
    if (n === 4) {
      const halfW = round4((availW - gap) / 2);
      const topH = round4(availH * 0.62 - gap / 2);
      const bottomH = round4(availH * 0.38 - gap / 2);
      const smallH = round4(topH / 2 - gap / 2);
      slots.push({ id: 'photo-1', x: round4(availX), y: round4(availY), width: halfW, height: topH });
      slots.push({ id: 'photo-2', x: round4(availX + halfW + gap), y: round4(availY), width: halfW, height: smallH });
      slots.push({ id: 'photo-3', x: round4(availX + halfW + gap), y: round4(availY + smallH + gap), width: halfW, height: smallH });
      slots.push({ id: 'photo-4', x: round4(availX), y: round4(availY + topH + gap), width: round4(availW), height: bottomH });
    } else if (n === 3) {
      const halfW = round4((availW - gap) / 2);
      const topH = round4(availH * 0.55 - gap / 2);
      const bottomH = round4(availH * 0.45 - gap / 2);
      slots.push({ id: 'photo-1', x: round4(availX), y: round4(availY), width: round4(availW), height: topH });
      slots.push({ id: 'photo-2', x: round4(availX + topH + gap), y: round4(availY), width: halfW, height: bottomH });
      slots.push({ id: 'photo-3', x: round4(availX + halfW + gap), y: round4(availY + topH + gap), width: halfW, height: bottomH });
    } else {
      const cols = 2;
      const rows = Math.ceil(n / cols);
      const cw = round4((availW - gap * (cols - 1)) / cols);
      const ch = round4((availH - gap * (rows - 1)) / rows);
      for (let i = 0; i < n; i++) {
        slots.push({
          id: `photo-${i + 1}`,
          x: round4(availX + (i % cols) * (cw + gap)),
          y: round4(availY + Math.floor(i / cols) * (ch + gap)),
          width: cw,
          height: ch,
        });
      }
    }
  }
  else if (s === 'TRIPTYCH') {
    if (isLandscape || pixelRatio > 0.8) {
      const cw = round4((availW - gap * 2) / 3);
      for (let i = 0; i < 3; i++) {
        slots.push({
          id: `photo-${i + 1}`,
          x: round4(availX + i * (cw + gap)),
          y: round4(availY),
          width: cw,
          height: round4(availH),
        });
      }
    } else {
      const ch = round4((availH - gap * 2) / 3);
      for (let i = 0; i < 3; i++) {
        slots.push({
          id: `photo-${i + 1}`,
          x: round4(availX),
          y: round4(availY + i * (ch + gap)),
          width: round4(availW),
          height: ch,
        });
      }
    }
  }
  else {
    // Standard Grid (GRID, CORNERS, or fallback)
    let cols = 1, rows = 1;
    if (s.startsWith('GRID')) {
      const d = s.replace('GRID', '').split('X');
      if (d.length === 2 && parseInt(d[0], 10) && parseInt(d[1], 10)) {
        cols = parseInt(d[0], 10);
        rows = parseInt(d[1], 10);
      }
    } else if (s === 'CORNERS') {
      cols = 2; rows = 2;
    }
    
    if (!cols || !rows || cols * rows < n) {
      if (isLandscape) {
        cols = n <= 2 ? n : (n <= 4 ? 2 : Math.ceil(Math.sqrt(n * 1.3)));
        rows = Math.ceil(n / cols);
      } else {
        cols = (n <= 3 && pixelRatio < 0.55) ? 1 : (n <= 4 ? 2 : (n <= 6 ? 2 : 3));
        rows = Math.ceil(n / cols);
      }
    }

    const cw = round4((availW - gap * (cols - 1)) / cols);
    const ch = round4((availH - gap * (rows - 1)) / rows);

    for (let r = 0; r < rows; r++) {
      const itemsInThisRow = Math.min(cols, n - r * cols);
      if (itemsInThisRow <= 0) break;
      const rowW = round4(itemsInThisRow * cw + (itemsInThisRow - 1) * gap);
      const rowStartX = round4(availX + (availW - rowW) / 2);
      for (let c = 0; c < itemsInThisRow; c++) {
        const idx = r * cols + c;
        slots.push({
          id: `photo-${idx + 1}`,
          x: round4(rowStartX + c * (cw + gap)),
          y: round4(availY + r * (ch + gap)),
          width: cw,
          height: ch,
        });
      }
    }
  }

  return { slots, footer, availX, availY, availW, availH };
}

export function parseLayoutCodeword(rawWord, existingGrid = null) {
  let cleanWord = String(rawWord || '').split(' ')[0].split('—')[0].trim().toUpperCase();
  cleanWord = cleanWord.replace(/\s*-\s*/g, '-');
  let parts = cleanWord.split('-');

  // Auto-prefix piece if omitted (e.g. "46-T04-V-GRID2X2" -> "P1-46-T04-V-GRID2X2")
  if (parts.length === 4 && parts[1].startsWith('T') && (parts[2] === 'V' || parts[2] === 'H')) {
    cleanWord = `P1-${cleanWord}`;
    parts = cleanWord.split('-');
  }

  const piece = parts[0] || 'P1';
  const rawMedia = parts[1] || '46';
  const media = rawMedia.replace(/X/gi, '');
  const slotsStr = parts[2] || 'T01';
  const orientationPart = parts[3] || 'V';
  const structure = parts.length >= 5 ? parts.slice(4).join('-') : 'GRID';
  const slotsCount = parseInt(slotsStr.replace(/[^0-9]/g, ''), 10) || (typeof existingGrid?.slots === 'number' ? existingGrid.slots : (existingGrid?.slotCount || 1));

  const isLandscape = orientationPart === 'H' || orientationPart === 'LANDSCAPE';

  const MEDIA_SPECS = {
    '46':  { r: [2, 3], w: 1200, h: 1800 },
    '26':  { r: [1, 3], w: 600,  h: 1800 },
    '57':  { r: [5, 7], w: 1500, h: 2100 },
    '68':  { r: [3, 4], w: 1800, h: 2400 },
    '810': { r: [4, 5], w: 2000, h: 2500 },
    '812': { r: [2, 3], w: 2000, h: 3000 },
    '23':  { r: [2, 3], w: 600,  h: 900  },
    '38':  { r: [3, 8], w: 900,  h: 2400 },
    '410': { r: [2, 5], w: 1200, h: 3000 },
    '412': { r: [1, 3], w: 1200, h: 3600 },
    '257': { r: [5, 14], w: 750, h: 2100 },
    '210': { r: [1, 5],  w: 600, h: 3000 },
    '258': { r: [5, 16], w: 750, h: 2400 },
    '916': { r: [9, 16], w: 1080, h: 1920 },
    '169': { r: [16, 9], w: 1920, h: 1080 },
    '11':  { r: [1, 1],  w: 1500, h: 1500 },
  };

  const spec = MEDIA_SPECS[media] || { r: isLandscape ? [3, 2] : [2, 3], w: isLandscape ? 1800 : 1200, h: isLandscape ? 1200 : 1800 };
  
  let width = isLandscape ? Math.max(spec.w, spec.h) : Math.min(spec.w, spec.h);
  let height = isLandscape ? Math.min(spec.w, spec.h) : Math.max(spec.w, spec.h);

  // If media code is 169 or 916, respect exact width & height
  if (media === '169') { width = 1920; height = 1080; }
  if (media === '916') { width = 1080; height = 1920; }

  if (existingGrid?.width && existingGrid?.height) {
    width = Number(existingGrid.width);
    height = Number(existingGrid.height);
  }

  const aspect = width / height;
  const aspectRatio = isLandscape ? `${spec.r[1]}/${spec.r[0]}` : `${spec.r[0]}/${spec.r[1]}`;

  // If existingGrid already has valid computed slotList, use it, otherwise compute fresh geometry
  let slots = existingGrid?.slotList || (Array.isArray(existingGrid?.slots) ? existingGrid.slots : null);
  let footer = existingGrid?.footer;

  const hasValidSlots = Array.isArray(slots) && 
    slots.length > 0 && 
    slots.every(s => s && typeof s.x === 'number' && !isNaN(s.x) && typeof s.y === 'number' && !isNaN(s.y) && s.width > 0 && s.height > 0);

  if (!hasValidSlots) {
    const geo = computeLayoutGeometry(width, height, slotsCount, structure, isLandscape ? 'landscape' : 'portrait');
    slots = geo.slots;
    footer = geo.footer;
  }

  let cols = existingGrid?.cols;
  let rows = existingGrid?.rows;
  if (!cols || !rows) {
    if (structure.startsWith('GRID')) {
      const d = structure.replace('GRID', '').split('X');
      cols = parseInt(d[0], 10) || 1;
      rows = parseInt(d[1], 10) || Math.ceil(slotsCount / cols);
    } else {
      cols = Math.ceil(Math.sqrt(slotsCount));
      rows = Math.ceil(slotsCount / cols);
    }
  }

  return {
    codeword: cleanWord,
    fullCode: cleanWord,
    piece,
    media,
    orientation: isLandscape ? 'landscape' : 'portrait',
    orientationCode: isLandscape ? 'H' : 'V',
    slotCount: slotsCount,
    slotsCount: slotsCount,
    slots: slotsCount,
    structure,
    width,
    height,
    aspect,
    aspectRatio,
    cols,
    rows,
    slotsList: slots,
    slotList: slots,
    slots: slots,
    footer: footer
  };
}
