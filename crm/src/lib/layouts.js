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
  { id: '46',      name: 'Standard Postcard',     code: '46',               cutout: [4, 6],   sheets: ['4x6'],            slots: [1, 3, 4], base: 30, blurb: 'The everyday 4x6 postcard.' },
  { id: '810-410', name: 'Panoramic Mini',        code: '810-410',          cutout: [4, 10],  sheets: ['8x10'],           slots: [3, 4],    base: 60, blurb: 'Slim panoramic cut from 8x10 stock.' },
  { id: '812-412', name: 'Panoramic Wide',        code: '812-412',          cutout: [4, 12],  sheets: ['8x12'],           slots: [4, 5],    base: 70, blurb: 'Cinematic 4x12 panorama from poster stock.' },
  { id: '57',      name: 'Portrait Keep-Safe',    code: '57',               cutout: [5, 7],   sheets: ['5x7'],            slots: [1, 3],    base: 50, blurb: 'Framable 5x7 portrait print.' },
  { id: '57-257',  name: 'Bookmark Strip',        code: '57-257',           cutout: [2.5, 7], sheets: ['5x7'],            slots: [3, 4],    base: 40, blurb: 'Two bookmark strips per 5x7 sheet.' },
  { id: '68',      name: 'Gala Display',          code: '68',               cutout: [6, 8],   sheets: ['6x8'],            slots: [1, 3, 4], base: 60, blurb: 'Gallery-size 6x8 display print.' },
  { id: '68-26',   name: 'Triple Gala Strip',     code: '68-26',            cutout: [2, 6],   sheets: ['6x8'],            slots: [3, 4],    base: 50, blurb: 'Premium strip stock — three 2x6 strips per 6x8.' },
  { id: '68-46',   name: 'Double Postcard Cut',   code: '68-46',            cutout: [4, 6],   sheets: ['6x8'],            slots: [1, 3, 4], base: 50, blurb: 'Two 4x6 postcards ganged on 6x8 stock.' },
  { id: '810',     name: 'Grand Guestbook Print', code: '810',              cutout: [8, 10],  sheets: ['8x10'],           slots: [1, 4, 6, 9], base: 80, blurb: 'Big 8x10 — guestbook signings and group grids.' },
  { id: '810-210', name: 'Collector Strip',       code: '810-210',          cutout: [2, 10],  sheets: ['8x10'],           slots: [3, 4, 5], base: 40, blurb: 'Extra-tall 2x10 collector reel.' },
  { id: '810-258', name: 'Wide Strip Cut',        code: '810-258',          cutout: [2.5, 8], sheets: ['8x10'],           slots: [3, 4],    base: 35, blurb: 'Wide bookmark cut from 8x10 stock.' },
  { id: '812',     name: 'Poster Showcase',       code: '812',              cutout: [8, 12],  sheets: ['8x12'],           slots: [1, 6, 8], base: 90, blurb: 'Full 8x12 poster — the showpiece print.' },
  { id: '812-68',  name: 'Quad Strip Reel',       code: '812-68',           cutout: [2, 6],   sheets: ['8x12'],           slots: [3, 4],    base: 60, blurb: 'Four premium strips ganged on 8x12 poster stock.' },
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
const SLOT_ADD = { 1: 0, 3: 10, 4: 10, 5: 20, 6: 30, 8: 60, 9: 40 }

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
export function slotsForLayout(layoutId) {
  const l = LAYOUT_BY_ID[layoutId]
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
