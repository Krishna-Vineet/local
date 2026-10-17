// ============================================================
// Layout / print pricing model — the shared price vocabulary between
// CRM, the backend, the booth snapshot and the booth client.
//
// A price is always keyed "<familyId>:<slots>" (e.g. "46:2", "57:3").
// The fallback chain (issue #50) is:
//
//   1. Event-specific prices    (event.layoutPrices)
//   2. Organization defaults    (OrganizationDefaults.layoutPrices)
//   3. Platform suggested price (SUGGESTED_PRICES below)
//
// Keep these family ids in sync with `crm/src/lib/layouts.js`.
// ============================================================

// familyId → { name, sheets, slots, base, printSize }
export const LAYOUT_FAMILIES = [
  { id: '46-23',   name: 'Pocket Polaroid',       sheets: ['4x6'],  slots: [1, 2], base: 20, printSize: '4 × 6' },
  { id: '46-26',   name: 'Classic Duo Strip',     sheets: ['4x6'],  slots: [2, 3, 4], base: 30, printSize: '4 × 6' },
  { id: '68-38',   name: 'Custom Bookmark',       sheets: ['6x8'],  slots: [2, 3, 4], base: 40, printSize: '6 × 8' },
  { id: '46',      name: 'Standard Postcard',     sheets: ['4x6'],  slots: [1, 2, 3, 4, 5, 6, 8], base: 30, printSize: '4 × 6' },
  { id: '810-410', name: 'Panoramic Mini',        sheets: ['8x10'], slots: [2, 3, 4], base: 60, printSize: '8 × 10' },
  { id: '812-412', name: 'Panoramic Wide',        sheets: ['8x12'], slots: [3, 4, 5], base: 70, printSize: '8 × 12' },
  { id: '57',      name: 'Portrait Keep-Safe',    sheets: ['5x7'],  slots: [1, 2, 3, 4, 5, 6, 8], base: 50, printSize: '5 × 7' },
  { id: '57-257',  name: 'Bookmark Strip',        sheets: ['5x7'],  slots: [2, 3, 4], base: 40, printSize: '5 × 7' },
  { id: '68',      name: 'Gala Display',          sheets: ['6x8'],  slots: [1, 2, 3, 4, 5, 6, 8], base: 60, printSize: '6 × 8' },
  { id: '68-26',   name: 'Triple Gala Strip',     sheets: ['6x8'],  slots: [2, 3, 4], base: 50, printSize: '6 × 8' },
  { id: '68-46',   name: 'Double Postcard Cut',   sheets: ['6x8'],  slots: [1, 2, 3, 4], base: 50, printSize: '6 × 8' },
  { id: '810',     name: 'Grand Guestbook Print', sheets: ['8x10'], slots: [1, 2, 3, 4, 5, 6, 8, 9], base: 80, printSize: '8 × 10' },
  { id: '810-210', name: 'Collector Strip',       sheets: ['8x10'], slots: [2, 3, 4, 5], base: 40, printSize: '8 × 10' },
  { id: '810-258', name: 'Wide Strip Cut',        sheets: ['8x10'], slots: [2, 3, 4], base: 35, printSize: '8 × 10' },
  { id: '812',     name: 'Poster Showcase',       sheets: ['8x12'], slots: [1, 2, 3, 4, 5, 6, 8], base: 90, printSize: '8 × 12' },
  { id: '812-68',  name: 'Quad Strip Reel',       sheets: ['8x12'], slots: [2, 3, 4], base: 60, printSize: '8 × 12' },
];

const FAMILY_BY_ID = Object.fromEntries(LAYOUT_FAMILIES.map((f) => [f.id, f]));

export const priceKey = (familyId, slots) => `${familyId}:${slots}`;

/** Platform suggested price for an iteration (base + per-extra-slot bump). */
export function suggestedPrice(familyId, slots) {
  const family = FAMILY_BY_ID[familyId];
  if (!family) return 0;
  const extra = Math.max(0, Number(slots) - 1) * 10;
  return family.base + extra;
}

export function suggestedPriceMap() {
  const out = {};
  for (const family of LAYOUT_FAMILIES) {
    for (const slots of family.slots) out[priceKey(family.id, slots)] = suggestedPrice(family.id, slots);
  }
  return out;
}

/**
 * Layout id format used by CRM/templates:
 * 1. Legacy: "<familyId>-v<slots>" (portrait) or "<familyId>-h<slots>" (landscape)
 * 2. Standard Codewords: "P1-46-T04-V-GRID2X2", "P1-26-T03-V-SQUARE", etc.
 */
export function parseLayoutId(layoutId) {
  const raw = String(layoutId || '').trim();
  if (!raw) return null;

  // 1. Check legacy format: "<familyId>-v<slots>" or "<familyId>-h<slots>"
  const legacyMatch = raw.match(/^(.+?)-([vh])(\d+)$/i);
  if (legacyMatch) {
    const [, familyId, orientationCode, slotsText] = legacyMatch;
    const family = FAMILY_BY_ID[familyId] || LAYOUT_FAMILIES.find((f) => f.id === familyId || f.code.includes(familyId));
    if (family) {
      const slots = Number(slotsText);
      if (Number.isInteger(slots) && slots >= 1) {
        return { familyId: family.id, slots, orientation: orientationCode.toLowerCase() === 'h' ? 'landscape' : 'portrait', family };
      }
    }
  }

  // 2. Check standard codeword format: e.g. "P1-46-T04-V-GRID2X2" or "26-T03-V-SQUARE"
  const clean = raw.split(' ')[0].split('—')[0].toUpperCase().replace(/\s*-\s*/g, '-');
  let parts = clean.split('-');
  if (parts.length === 4 && parts[1].startsWith('T') && (parts[2] === 'V' || parts[2] === 'H')) {
    parts = ['P1', ...parts];
  }

  if (parts.length >= 4) {
    const mediaPart = (parts[0].startsWith('P') && parts[1]) ? parts[1] : parts[0];
    const slotsPart = (parts[0].startsWith('P') && parts[2]) ? parts[2] : parts[1];
    const orientPart = (parts[0].startsWith('P') && parts[3]) ? parts[3] : parts[2];

    const slotsNum = parseInt(slotsPart.replace(/[^0-9]/g, ''), 10) || 1;
    const isLandscape = orientPart === 'H' || orientPart === 'LANDSCAPE';

    // Match family
    const family = FAMILY_BY_ID[mediaPart] ||
      LAYOUT_FAMILIES.find((f) => f.id === mediaPart || f.id.endsWith(`-${mediaPart}`) || f.code.includes(mediaPart)) ||
      FAMILY_BY_ID['46'];

    return {
      familyId: family.id,
      slots: slotsNum,
      orientation: isLandscape ? 'landscape' : 'portrait',
      family
    };
  }

  return null;
}

/** Canvas + slots for a layout id, using print-true aspect ratios (issue #95). */
export function layoutGeometry(layoutId) {
  const parsed = parseLayoutId(layoutId) || { familyId: '46', slots: 1, orientation: 'portrait', family: FAMILY_BY_ID['46'] };
  const { family, slots, orientation } = parsed;
  const sheet = family.sheets?.[0] || '4x6';
  const [cutW, cutH] = sheet.split('x').map(Number);
  const dpi = 300;
  const portrait = orientation === 'portrait';
  
  let w = portrait ? cutW * dpi : cutH * dpi;
  let h = portrait ? cutH * dpi : cutW * dpi;
  if (family.id === '26' || family.id === '46-26' || family.id === '68-26' || family.id === '812-68' || String(layoutId).includes('-26-')) {
    w = portrait ? 2 * dpi : 6 * dpi;
    h = portrait ? 6 * dpi : 2 * dpi;
  } else if (family.id === '57' || String(layoutId).includes('-57-')) {
    w = portrait ? 5 * dpi : 7 * dpi;
    h = portrait ? 7 * dpi : 5 * dpi;
  } else if (family.id === '68' || String(layoutId).includes('-68-')) {
    w = portrait ? 6 * dpi : 8 * dpi;
    h = portrait ? 8 * dpi : 6 * dpi;
  } else if (family.id === '810' || String(layoutId).includes('-810-')) {
    w = portrait ? 8 * dpi : 10 * dpi;
    h = portrait ? 10 * dpi : 8 * dpi;
  } else if (family.id === '812' || String(layoutId).includes('-812-')) {
    w = portrait ? 8 * dpi : 12 * dpi;
    h = portrait ? 12 * dpi : 8 * dpi;
  }

  return { width: w, height: h, orientation, slots, printSize: family.printSize || `${cutW} × ${cutH}`, familyId: family.id };
}

export function layoutMeta(layoutId) {
  const geometry = layoutGeometry(layoutId);
  const family = FAMILY_BY_ID[geometry.familyId];
  return {
    id: layoutId,
    familyId: geometry.familyId,
    name: family ? family.name : 'Layout',
    orientation: geometry.orientation,
    slots: geometry.slots,
    printSize: geometry.printSize,
    canvas: { width: geometry.width, height: geometry.height },
    priceKey: priceKey(geometry.familyId, geometry.slots),
  };
}

/** Validate a CRM-supplied { "familyId:slots": price } map. */
export function validateLayoutPrices(raw, base = {}) {
  if (raw == null) return { ...base };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw Object.assign(new Error('layoutPrices must be an object of "familyId:slots" → price.'), { status: 400, code: 'BAD_LAYOUT_PRICES' });
  }
  const prices = { ...base };
  for (const [key, value] of Object.entries(raw)) {
    const [familyId, slotsText] = String(key).split(':');
    const slots = Number(slotsText);
    const family = FAMILY_BY_ID[familyId];
    if (!family || !Number.isInteger(slots) || slots < 1 || slots > 24) {
      throw Object.assign(new Error(`Unknown layout iteration "${key}".`), { status: 400, code: 'BAD_LAYOUT_PRICES' });
    }
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0 || price > 100000) {
      throw Object.assign(new Error(`Price for "${key}" must be between 0 and 100000.`), { status: 400, code: 'BAD_LAYOUT_PRICES' });
    }
    prices[key] = Math.round(price);
  }
  return prices;
}

/**
 * The fallback chain (#45, #50): event prices → org defaults → platform.
 * Always returns the full suggested map, overlaid by org overrides, then
 * overlaid by event overrides, so the booth can price any layout.
 */
export function resolveLayoutPrices({ eventPrices = {}, orgPrices = {} } = {}) {
  const toPlain = (value) => {
    if (!value) return {};
    if (value instanceof Map) return Object.fromEntries(value);
    return { ...value };
  };
  return {
    ...suggestedPriceMap(),
    ...toPlain(orgPrices),
    ...toPlain(eventPrices),
  };
}
