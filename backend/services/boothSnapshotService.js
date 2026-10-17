// ============================================================
// Booth snapshot builder (Electron issues #62–#75, CRM #45–#50).
//
// ONE place decides what a booth knows:
//   • organization name + logo            • event logos (deduplicated)
//   • tagline                             • booth timeout (real, not 90s)
//   • layout prices (event → org → platform fallback chain)
//   • UPI id / payout mode / payment display name / print limits
//   • platform gallery policy + guest consent requirement
//   • a content `revision` so the booth only refreshes when something
//     actually changed (issue #72/#79)
// ============================================================

import crypto from 'crypto';
import { layoutMeta, resolveLayoutPrices, suggestedPriceMap, parseLayoutId } from '../config/layouts.js';
import { getGallerySettings, photoVisibleInGallery } from './gallerySettingsService.js';
import Photo from '../models/Photo.js';
import OrganizationDefaults from '../models/OrganizationDefaults.js';

export const BOOTH_TIMEOUT_DEFAULT = 60;
export const MAX_PRINTS_DEFAULT = 10;

/**
 * Issue #58/#59/#67: logos are compared case/whitespace-insensitively and
 * de-duplicated before rendering or storing, so an event logo can never be
 * added twice.
 */
export function dedupeLogos(list = []) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const url = typeof item === 'string' ? item.trim() : String(item && item.url ? item.url : '').trim();
    if (!url) continue;
    const fingerprint = url.toLowerCase();
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    out.push(url);
  }
  return out;
}

/** Organization/event branding layers, never duplicated, always orderable. */
export function buildBranding(organization = {}, event = null) {
  const happyPix = { kind: 'happypix', url: '/brand/happypix-logo.svg', alwaysVisible: true };
  const orgLogos = dedupeLogos([organization.logoUrl, organization.brandLogoUrl]);
  const eventLogos = dedupeLogos([
    ...(event && event.branding ? event.branding.logos || [] : []),
    event && event.branding ? event.branding.logoUrl : null,
  ]);
  // An event logo that is really the organization logo appears once.
  const orgFingerprints = new Set(orgLogos.map((url) => url.toLowerCase()));
  const uniqueEventLogos = eventLogos.filter((url) => !orgFingerprints.has(url.toLowerCase()));
  return {
    // Issue #62/#63/#64: both layers available at the same time.
    platform: happyPix,
    organization: {
      name: organization.name || 'HappyPix Organization',
      logo: orgLogos[0] || null,
      logos: orgLogos,
      tagline: (organization.brandTagline || '').trim() || null,
    },
    event: {
      logos: uniqueEventLogos,
      logo: uniqueEventLogos[0] || null,
      tagline: (event && event.branding ? String(event.branding.tagline || '').trim() : '') || null,
    },
    // Issue #66: the booth falls back to HappyPix branding cleanly.
    fallback: happyPix.url,
  };
}

/** Templates the event allows, in booth shape, with true print geometry. */
export function mapTemplates(templates = []) {
  return templates
    .filter((template) => template && template.active !== false)
    .map((template) => {
      const layoutId = template.layoutId || template.layout?.code || '46-v1';
      const meta = layoutMeta(layoutId);
      
      let canvasW = meta.canvas.width;
      let canvasH = meta.canvas.height;
      let orientation = meta.orientation;
      let slotsCount = meta.slots;
      let printSize = meta.printSize;

      const tLayout = template.originalLayout || template.layout;
      if (tLayout && tLayout.width && tLayout.height) {
        canvasW = Number(tLayout.width) || canvasW;
        canvasH = Number(tLayout.height) || canvasH;
        orientation = tLayout.orientation || (canvasW > canvasH ? 'landscape' : 'portrait');
        slotsCount = template.photoSlots?.length || template.slots?.length || tLayout.slotCount || slotsCount;
      } else if (String(layoutId).toUpperCase().includes('-H-')) {
        orientation = 'landscape';
      }

      // Standardize orientation string for booth app compatibility
      const oStr = String(orientation || '').toLowerCase();
      if (oStr === 'h' || oStr === 'landscape' || oStr === 'horizontal') {
        orientation = 'landscape';
      } else {
        orientation = 'portrait';
      }

      // Convert relative slots (0..1) to absolute canvas coordinates if needed
      const rawSlots = (template.photoSlots && template.photoSlots.length) ? template.photoSlots : (template.slots || []);
      let photoSlots = [];
      if (Array.isArray(rawSlots) && rawSlots.length > 0) {
        photoSlots = rawSlots.map((s, idx) => {
          const isRelative = Number(s.width) <= 1.0 && Number(s.height) <= 1.0 && Number(s.x) <= 1.0 && Number(s.y) <= 1.0;
          return {
            id: s.id || `slot-${idx + 1}`,
            x: isRelative ? Math.round(Number(s.x) * canvasW) : Math.round(Number(s.x)),
            y: isRelative ? Math.round(Number(s.y) * canvasH) : Math.round(Number(s.y)),
            width: isRelative ? Math.round(Number(s.width) * canvasW) : Math.round(Number(s.width)),
            height: isRelative ? Math.round(Number(s.height) * canvasH) : Math.round(Number(s.height)),
          };
        });
      } else {
        photoSlots = autoSlots({ ...meta, canvas: { width: canvasW, height: canvasH }, slots: slotsCount }, template);
      }

      return {
        id: String(template._id || template.id),
        name: template.name,
        category: template.category || 'Custom',
        description: template.description || '',
        price: template.price != null && !isNaN(Number(template.price)) ? Number(template.price) : null,
        source: template.source || 'playground',
        componentId: template.componentId || null,
        active: template.active !== false,
        layout: {
          id: layoutId,
          familyId: meta.familyId,
          label: `${printSize} · ${slotsCount} photo${slotsCount === 1 ? '' : 's'}`,
          printSize,
          sheetSize: printSize,
          orientation,
          slots: slotsCount,
          canvas: { width: canvasW, height: canvasH },
          photoSlots,
        },
        design: normalizeDesign(template.design, template),
        assets: Array.isArray(template.assets)
          ? template.assets.map((a) => ({
              ...a,
              url: resolveAssetUrlForBooth(a?.url, a?.assetId) || a?.url || null,
            }))
          : [],
      };
    });
}

function resolveAssetUrlForBooth(rawUrl, assetId = null) {
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  const cleanAssetId = typeof assetId === 'string' ? assetId.trim() : '';

  if (url.startsWith('data:')) return url;

  if (url.includes('/api/org/asset-proxy') || url.includes('/api/booth/asset-proxy')) {
    const qIdx = url.indexOf('?');
    return qIdx !== -1 ? `/api/booth/asset-proxy${url.slice(qIdx)}` : url;
  }

  if (url.includes('amazonaws.com') || url.includes('happypix-bucket')) {
    const key = cleanAssetId || url.replace(/^https?:\/\/[^/]+\//, '').split('?')[0];
    if (key) return `/api/booth/asset-proxy?key=${encodeURIComponent(key)}`;
  }

  if (url.startsWith('http://localhost:5000/uploads/') || url.startsWith('http://127.0.0.1:5000/uploads/') || url.startsWith('/uploads/')) {
    const key = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?uploads\//, '');
    if (key) return `/api/booth/asset-proxy?key=${encodeURIComponent(key)}`;
  }

  if (url) return url;

  if (cleanAssetId && !cleanAssetId.startsWith('temp-')) {
    if (cleanAssetId.startsWith('data:') || cleanAssetId.startsWith('http://') || cleanAssetId.startsWith('https://')) {
      return resolveAssetUrlForBooth(cleanAssetId, null);
    }
    const key = cleanAssetId.replace(/^(\/?uploads\/|\/)/, '');
    return `/api/booth/asset-proxy?key=${encodeURIComponent(key)}`;
  }

  return null;
}

const DESIGNER_COMPONENT_DESIGNS = {
  ClassicPostcard: {
    background: { type: 'solid', colors: ['#FFFFFF'] },
    accent: '#2A2338',
    textColor: '#191424',
    ornament: 'frame',
    slotShape: 'rect',
    title: 'HAPPYPIX',
    subtitle: '',
  },
  MinimalMono: {
    background: { type: 'solid', colors: ['#FAFAF8'] },
    accent: '#191424',
    textColor: '#403952',
    ornament: 'none',
    slotShape: 'rect',
    title: 'UNTITLED',
    subtitle: '',
  },
  PanoramaStory: {
    background: { type: 'gradient', colors: ['#241E33', '#14101F'] },
    accent: '#A99BE8',
    textColor: '#FFFFFF',
    ornament: 'none',
    slotShape: 'round',
    title: 'PANORAMA',
    subtitle: '',
  },
  RoyalWedding: {
    background: { type: 'gradient', colors: ['#5F4CAA', '#3A3170'] },
    accent: '#D9B44A',
    textColor: '#F3D9A4',
    ornament: 'flourish',
    slotShape: 'arch',
    titleBand: true,
    title: 'Royal Wedding',
    subtitle: '',
  },
  VintageBookmark: {
    background: { type: 'solid', colors: ['#F5EEDC'] },
    accent: '#6B5B3E',
    textColor: '#4C3F26',
    ornament: 'dots',
    slotShape: 'rect',
    title: 'A Keepsake',
    subtitle: '',
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
    subtitle: '',
  },
  LegacyGuestbook: {
    background: { type: 'gradient', colors: ['#1E3E70', '#12264A'] },
    accent: '#D9B44A',
    textColor: '#F3D9A4',
    ornament: 'frame',
    slotShape: 'round',
    titleBand: true,
    title: 'The Guest Book',
    subtitle: '',
  },
  NeonParty: {
    background: { type: 'gradient', colors: ['#EA097F', '#5F4CAA'] },
    accent: '#FF7AC1',
    textColor: '#FFFFFF',
    ornament: 'glow',
    slotShape: 'round',
    title: 'NEON NIGHT',
    subtitle: '',
  },
  SunsetStrip: {
    background: { type: 'gradient', colors: ['#F7B733', '#EA097F'] },
    accent: '#FFFFFF',
    textColor: '#FFFFFF',
    ornament: 'dots',
    slotShape: 'round',
    title: 'SUNSET',
    subtitle: '',
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
    subtitle: '',
  },
  KidsSplash: {
    background: { type: 'gradient', colors: ['#DDEBFF', '#FFE9F2'] },
    accent: '#2A6FBE',
    textColor: '#2A6FBE',
    ornament: 'dots',
    slotShape: 'round',
    title: 'Splash Time!',
    subtitle: '',
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

function normalizeDesign(rawDesign, template) {
  const designerPreset = (template.componentId && DESIGNER_COMPONENT_DESIGNS[template.componentId]) || null;
  const fallback = {
    background: designerPreset?.background || { type: 'solid', colors: ['#ffffff'] },
    accent: designerPreset?.accent || template.accent || '#ff4f9a',
    textColor: designerPreset?.textColor || '#251530',
    ornament: designerPreset?.ornament || 'none',
    slotShape: designerPreset?.slotShape || 'square',
    titleBand: Boolean(designerPreset?.titleBand),
    title: designerPreset?.title || template.name || '',
    subtitle: designerPreset?.subtitle || '',
    decorations: [],
  };
  const design = rawDesign && typeof rawDesign === 'object'
    ? { ...designerPreset, ...rawDesign }
    : (designerPreset ? { ...designerPreset } : null);
  if (!design) return fallback;

  // Resolve background URL from design or template.assets
  let rawBg = design.background || design.bg;
  let bgUrl = null;
  let bgAssetId = null;

  if (typeof rawBg === 'string') {
    if (rawBg.startsWith('http') || rawBg.startsWith('data:') || rawBg.startsWith('/')) {
      bgUrl = rawBg;
    }
  } else if (rawBg && typeof rawBg === 'object') {
    bgUrl = rawBg.url || null;
    bgAssetId = rawBg.assetId || null;
  }

  // If no URL directly on background object, resolve from template.assets or backend uploads
  if (!bgUrl && Array.isArray(template.assets) && template.assets.length > 0) {
    const matchedAsset = (bgAssetId && template.assets.find((a) => a.assetId === bgAssetId)) ||
      template.assets.find((a) => a.role === 'background' || a.type === 'background');
    if (matchedAsset) {
      bgUrl = matchedAsset.url || null;
      bgAssetId = bgAssetId || matchedAsset.assetId || null;
    }
  }

  bgUrl = resolveAssetUrlForBooth(bgUrl, bgAssetId);

  let background;
  if (bgUrl) {
    background = { type: 'image', url: bgUrl, assetId: bgAssetId };
  } else if (typeof rawBg === 'string') {
    background = { type: 'solid', colors: [rawBg] };
  } else if (rawBg && rawBg.type && rawBg.type !== 'generated') {
    background = rawBg;
  } else if (design.palette?.background) {
    background = { type: 'solid', colors: [design.palette.background] };
  } else if (rawBg?.colors && Array.isArray(rawBg.colors) && rawBg.colors.length > 0) {
    background = { type: rawBg.type || 'solid', colors: rawBg.colors };
  } else {
    background = fallback.background;
  }

  // Resolve decorations with their asset URLs
  const rawDecorations = Array.isArray(design.decorations) ? [...design.decorations] : [];
  if (Array.isArray(template.assets)) {
    for (const asset of template.assets) {
      if (!asset || asset.role === 'background' || asset.type === 'background') continue;
      if (asset.role === 'overlay' || asset.role === 'frame' || asset.type === 'overlay') {
        const alreadyInDecs = rawDecorations.some((d) => (d.assetId && d.assetId === asset.assetId) || (d.url && d.url === asset.url));
        if (!alreadyInDecs) {
          rawDecorations.push({
            assetId: asset.assetId,
            url: asset.url,
            type: 'decoration',
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            overlay: true,
          });
        }
      }
    }
  }

  const decorations = rawDecorations.map((dec) => {
    let decUrl = dec.url || null;
    const decAssetId = dec.assetId || null;
    if (!decUrl && decAssetId && Array.isArray(template.assets)) {
      const matched = template.assets.find((a) => a.assetId === decAssetId);
      if (matched && matched.url) decUrl = matched.url;
    }
    const resolvedUrl = resolveAssetUrlForBooth(decUrl, decAssetId);
    return {
      ...dec,
      ...(resolvedUrl ? { url: resolvedUrl } : {}),
    };
  });

  return {
    ...fallback,
    ...design,
    background,
    accent: design.accent || design.palette?.accent || design.palette?.primary || fallback.accent,
    textColor: design.textColor || design.palette?.text || fallback.textColor,
    ornament: design.ornament || fallback.ornament || 'none',
    slotShape: design.slotShape || fallback.slotShape || 'square',
    titleBand: design.titleBand !== undefined ? Boolean(design.titleBand) : fallback.titleBand,
    title: design.title || fallback.title || template.name || '',
    subtitle: design.subtitle || design.tagline || fallback.subtitle || '',
    decorations,
    palette: design.palette || null,
    theme: design.theme || null,
  };
}

/** Bottom-15% branding footer, grid/strip slots inside the photo area (CRM parity). */
function autoSlots(meta, template) {
  const { canvas, slots } = meta;
  const footer = Math.round(canvas.height * 0.15);
  const designerPreset = (template?.componentId && DESIGNER_COMPONENT_DESIGNS[template.componentId]) || null;
  const hasTitleBand = Boolean(template?.design?.titleBand || designerPreset?.titleBand);
  const padX = Math.round(Math.min(36, canvas.width * 0.04));
  const topInset = hasTitleBand ? Math.round(canvas.height * 0.12) : Math.round(Math.min(36, canvas.height * 0.035));
  const bottomInset = Math.round(Math.min(28, canvas.height * 0.025));

  const areaX = padX;
  const areaY = topInset;
  const w = Math.max(100, canvas.width - padX * 2);
  const h = Math.max(100, canvas.height - footer - topInset - bottomInset);
  const g = Math.max(12, Math.round(w * 0.025));
  const aspect = canvas.width / canvas.height;

  const row = (cols, y, rh) => {
    const cw = (w - g * (cols - 1)) / cols;
    const out = [];
    for (let i = 0; i < cols; i += 1) out.push({ x: areaX + i * (cw + g), y: areaY + y, w: cw, h: rh });
    return out;
  };
  const col = (rows, x, cw) => {
    const rh = (h - g * (rows - 1)) / rows;
    const out = [];
    for (let i = 0; i < rows; i += 1) out.push({ x: areaX + x, y: areaY + i * (rh + g), w: cw, h: rh });
    return out;
  };
  const grid = (cols, rows) => {
    const cw = (w - g * (cols - 1)) / cols;
    const rh = (h - g * (rows - 1)) / rows;
    const out = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        out.push({ x: areaX + c * (cw + g), y: areaY + r * (rh + g), w: cw, h: rh });
      }
    }
    return out;
  };

  let rects = [];
  const n = Math.max(1, Number(slots) || 1);
  if (n === 1) {
    rects = [{ x: areaX, y: areaY, w, h }];
  } else if (n === 2) {
    rects = aspect >= 1 ? row(2, 0, h) : col(2, 0, w);
  } else if (n === 3) {
    if (aspect <= 0.55 || template?.componentId === 'RoyalWedding') {
      rects = col(3, 0, w);
    } else if (aspect >= 1.15) {
      if (template?.componentId === 'KidsSplash') {
        rects = row(3, 0, h);
      } else {
        const bw = Math.round((w - g) * 0.58);
        const rh = (h - g) / 2;
        rects = [
          { x: areaX, y: areaY, w: bw, h },
          { x: areaX + bw + g, y: areaY, w: w - bw - g, h: rh },
          { x: areaX + bw + g, y: areaY + rh + g, w: w - bw - g, h: rh },
        ];
      }
    } else {
      const bh = Math.round((h - g) * 0.58);
      const cw = (w - g) / 2;
      rects = [
        { x: areaX, y: areaY, w, h: bh },
        { x: areaX, y: areaY + bh + g, w: cw, h: h - bh - g },
        { x: areaX + cw + g, y: areaY + bh + g, w: cw, h: h - bh - g },
      ];
    }
  } else if (n === 4) {
    if (aspect <= 0.45) rects = col(4, 0, w);
    else if (aspect >= 2.1) rects = row(4, 0, h);
    else rects = grid(2, 2);
  } else if (n === 5) {
    if (aspect <= 0.45) rects = col(5, 0, w);
    else if (aspect >= 2.1) rects = row(5, 0, h);
    else {
      const bh = Math.round((h - g) * 0.48);
      const gh = h - bh - g;
      const rh = (gh - g) / 2;
      const cw = (w - g) / 2;
      rects = [{ x: areaX, y: areaY, w, h: bh }];
      for (let r = 0; r < 2; r += 1) {
        for (let c = 0; c < 2; c += 1) {
          rects.push({ x: areaX + c * (cw + g), y: areaY + bh + g + r * (rh + g), w: cw, h: rh });
        }
      }
    }
  } else if (n === 6) {
    rects = aspect >= 1 ? grid(3, 2) : grid(2, 3);
  } else if (n === 8) {
    rects = aspect >= 1 ? grid(4, 2) : grid(2, 4);
  } else if (n === 9) {
    rects = grid(3, 3);
  } else {
    const columns = n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / columns);
    rects = grid(columns, rows).slice(0, n);
  }

  return rects.slice(0, n).map((r, index) => ({
    id: `slot-${index + 1}`,
    x: Math.round(r.x),
    y: Math.round(r.y),
    width: Math.round(r.w),
    height: Math.round(r.h),
  }));
}

/**
 * Booth settings: every value the booth needs, sourced from the org's
 * defaults — never from hard-coded platform fallbacks when the org has
 * configured something (issues #69–#71, #105, #106).
 */
export function buildSettings({ organization = {}, defaults = null, event = null, gallery = null }) {
  const orgName = organization.name || 'HappyPix';
  const payoutMode = defaults && defaults.payoutMode === 'upi' ? 'upi' : 'wallet';
  const upiId = (defaults && defaults.upiId) || organization.upiId || null;
  const timeoutRaw = (event && event.boothTimeout) || (defaults && defaults.boothTimeoutSec);
  const timeout = Number.isFinite(Number(timeoutRaw)) && Number(timeoutRaw) >= 10
    ? Number(timeoutRaw)
    : BOOTH_TIMEOUT_DEFAULT;
  const qrTimeoutMinsRaw = (event && event.qrTimeoutMinutes) || (defaults && defaults.qrTimeoutMinutes) || 5;
  const qrTimeoutMinutes = Number.isFinite(Number(qrTimeoutMinsRaw)) && Number(qrTimeoutMinsRaw) >= 1
    ? Number(qrTimeoutMinsRaw)
    : 5;
  const qrTimeoutSeconds = Math.round(qrTimeoutMinutes * 60);
  const paymentDisplayName = (defaults && defaults.paymentDisplayName)
    || organization.paymentDisplayName
    || `${orgName} · HappyPix`;
  const maximumPrints = Number(defaults && defaults.maximumPrints) > 0
    ? Number(defaults.maximumPrints)
    : MAX_PRINTS_DEFAULT;
  return {
    organizationName: orgName,
    organizationLogo: organization.logoUrl || null,
    tagline: (defaults && defaults.tagline) || organization.brandTagline || null,
    boothTimeoutSec: timeout,
    qrTimeoutMinutes,
    qrTimeoutSeconds,
    idleWarningSec: 10,
    payoutMode,
    upiId,
    paymentDisplayName,
    currency: 'INR',
    maximumPrints,
    printOptions: Array.isArray(defaults && defaults.printOptions) && defaults.printOptions.length
      ? defaults.printOptions
      : [1, 2, 4, 6, 8, 10].filter((value) => value <= maximumPrints),
    layoutPrices: resolveLayoutPrices({
      eventPrices: event ? event.layoutPrices : {},
      orgPrices: defaults ? defaults.layoutPrices : {},
    }),
    templatePrices: defaults?.templatePrices instanceof Map
      ? Object.fromEntries(defaults.templatePrices)
      : (defaults?.templatePrices || {}),
    suggestedPrices: suggestedPriceMap(),
    galleryEnabled: gallery ? gallery.galleryEnabled !== false : true,
    requireGuestConsent: gallery ? gallery.requireGuestConsent === true : false,
  };
}

/** Stable content hash — the booth refreshes only when this changes. */
export function computeRevision(payload) {
  const stable = JSON.stringify(payload, (key, value) => {
    if (value instanceof Map) return Object.fromEntries(value);
    return value;
  });
  return crypto.createHash('sha1').update(stable).digest('hex').slice(0, 20);
}

async function loadDefaults(organizationId) {
  try {
    return await OrganizationDefaults.findOne({ organizationId }).lean();
  } catch {
    return null;
  }
}

/**
 * Build the complete booth snapshot.
 *
 * @param {object} args
 * @param {object} args.device        Device document/lean object
 * @param {object} args.organization  Organization document/lean object
 * @param {object|null} args.event    Assigned event with populated templateIds
 */
/**
 * Up to three recent photos for the event's Start screen. Only https URLs are
 * sent (stored S3 files). Inline data URLs are never pushed to the booth, and
 * gallery consent rules still apply.
 */
async function recentSamplePhotos(event, organization, gallery) {
  const photos = await Photo.find({
    organizationId: organization._id || organization.id,
    eventId: event._id || event.id,
    url: { $regex: '^https?://' },
  }).sort({ generatedAt: -1, createdAt: -1 }).limit(12).lean();
  return photos
    .filter((photo) => photoVisibleInGallery(photo, gallery))
    .slice(0, 3)
    .map((photo) => photo.url);
}

export async function buildBoothSnapshot({ device, organization, event = null }) {
  const defaults = await loadDefaults(organization._id || organization.id);
  const gallery = await getGallerySettings();
  const samplePhotos = event ? await recentSamplePhotos(event, organization, gallery) : [];

  const branding = buildBranding(organization, event);
  const settings = buildSettings({ organization, defaults, event, gallery });

  const orgTemplatePrices = defaults?.templatePrices instanceof Map
    ? Object.fromEntries(defaults.templatePrices)
    : (defaults?.templatePrices || {});

  const eventTemplatePrices = event?.templatePrices instanceof Map
    ? Object.fromEntries(event.templatePrices)
    : (event?.templatePrices || {});

  const isOverride = !!(event && event.overrideTemplatePrices);
  const effectiveTemplatePrices = isOverride
    ? { ...orgTemplatePrices, ...eventTemplatePrices }
    : { ...orgTemplatePrices };

  const rawTemplates = mapTemplates((event && event.templateIds) || []);
  const templates = rawTemplates.map((t) => {
    let price = null;
    if (isOverride && eventTemplatePrices[t.id] != null && !isNaN(Number(eventTemplatePrices[t.id]))) {
      price = Number(eventTemplatePrices[t.id]);
    } else if (orgTemplatePrices[t.id] != null && !isNaN(Number(orgTemplatePrices[t.id]))) {
      price = Number(orgTemplatePrices[t.id]);
    } else if (t.price != null && !isNaN(Number(t.price)) && Number(t.price) > 0) {
      price = Number(t.price);
    } else if (t.layout?.familyId && t.layout?.slots) {
      const key = `${t.layout.familyId}:${t.layout.slots}`;
      price = settings.layoutPrices[key] ?? null;
    }
    return {
      ...t,
      price: price != null && Number.isFinite(price) ? price : 0,
    };
  });

  const eventPayload = event
    ? {
        id: String(event._id || event.id),
        organizationId: String(event.organizationId || organization._id || organization.id),
        name: event.name,
        clientName: event.clientName || '',
        location: event.location || '',
        startDate: toISO(event.startDate),
        endDate: toISO(event.endDate),
        status: storedEventStatus(event),
        digitalCopy: event.digitalCopy !== false,
        filters: (event.filters && event.filters.length ? event.filters : ['original', 'warm', 'cool', 'bw', 'vintage', 'soft', 'party']),
        branding: {
          logos: branding.event.logos,
          tagline: branding.event.tagline || branding.organization.tagline || '',
        },
        layoutPrices: settings.layoutPrices,
        overrideTemplatePrices: isOverride,
        templatePrices: effectiveTemplatePrices,
        templates,
        samplePhotos,
        revision: '',
        templateContractVersion: 1,
      }
    : null;

  const revision = computeRevision({
    device: { id: String(device._id || device.id), name: device.deviceName, status: device.status },
    organization: { id: String(organization._id || organization.id), name: organization.name, status: organization.status },
    branding,
    settings,
    gallery,
    event: eventPayload && { ...eventPayload, revision: undefined },
  });

  if (eventPayload) eventPayload.revision = revision;

  return {
    device: {
      id: String(device._id || device.id),
      name: device.deviceName || 'Booth',
      uuid: device.deviceUuid,
      assignedEventId: device.assignedEventId ? String(device.assignedEventId) : null,
    },
    organization: {
      id: String(organization._id || organization.id),
      name: organization.name,
      status: organization.status || 'active',
      logoUrl: organization.logoUrl || null,
      plan: organization.plan || 'trial',
      activeAddons: Array.isArray(organization.addons)
        ? organization.addons.filter((a) => !a.expiresAt || new Date(a.expiresAt) > new Date()).map((a) => a.key)
        : [],
    },
    event: eventPayload,
    branding,
    settings,
    gallery,
    revision,
    serverTime: new Date().toISOString(),
  };
}

function storedEventStatus(event) {
  if (event.paused) return 'paused';
  const now = Date.now();
  const start = event.startDate ? new Date(event.startDate).getTime() : 0;
  const end = event.endDate ? new Date(event.endDate).getTime() : 0;
  if (start && now < start) return 'upcoming';
  if (end && now > end) return 'finished';
  return 'live';
}

function toISO(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Heartbeat helpers (issues #76–#81). */

// The booth sends only *changed* hardware fields; the server merges them.
export function mergeHardware(device, patch = {}) {
  const previousTelemetry = device.telemetry || {};
  const previousConnections = device.connections || {};
  const telemetry = {
    prints: pickNumber(patch.printsTotal, previousTelemetry.prints, 0, 10_000_000),
    shutters: pickNumber(patch.shutterCount, previousTelemetry.shutters, 0, 10_000_000),
    batteryPct: pickNumber(patch.batteryPct, previousTelemetry.batteryPct, 0, 100),
    updatedAt: new Date(),
  };
  const camera = pickBool(patch.cameraConnected, previousConnections.camera, false);
  const printer = pickBool(patch.printerConnected, previousConnections.printer, false);
  const kioskScreen = pickBool(patch.kioskScreenConnected, previousConnections.kioskScreen, false);
  return {
    telemetry,
    connections: { camera, printer, kioskScreen, updatedAt: new Date() },
    changed: {
      telemetry: JSON.stringify({ ...telemetry, updatedAt: undefined }) !== JSON.stringify({ ...previousTelemetry, updatedAt: undefined }),
      connections: camera !== previousConnections.camera
        || printer !== previousConnections.printer
        || kioskScreen !== previousConnections.kioskScreen,
    },
  };
}

function pickNumber(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') return Number(fallback) || 0;
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return Number(fallback) || 0;
  return Math.max(min, Math.min(max, number));
}

function pickBool(value, fallback, defaultValue) {
  if (value === undefined || value === null) return typeof fallback === 'boolean' ? fallback : defaultValue;
  return value === true || value === 'true';
}

/** Issues #80/#81: what the booth must do with a heartbeat response. */
export const BOOTH_STATES = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
  DEVICE_DELETED: 'device_deleted',
  DEVICE_BLOCKED: 'device_blocked',
  UNPAIRED: 'unpaired',
};

export function boothStateFor({ device, organization }) {
  if (!device) return BOOTH_STATES.DEVICE_DELETED;
  if (device.status === 'blocked') return BOOTH_STATES.DEVICE_BLOCKED;
  if (device.status === 'inactive') return BOOTH_STATES.DEVICE_BLOCKED;
  if (!organization) return BOOTH_STATES.UNPAIRED;
  if (organization.status === 'banned') return BOOTH_STATES.BANNED;
  if (organization.status === 'suspended') return BOOTH_STATES.SUSPENDED;
  return BOOTH_STATES.ACTIVE;
}

/** A booth may run guest sessions only when the server says active. */
export function boothCanOperate(state) {
  return state === BOOTH_STATES.ACTIVE;
}

export { parseLayoutId };

export default {
  buildBoothSnapshot, buildBranding, buildSettings, dedupeLogos, mapTemplates,
  computeRevision, mergeHardware, boothStateFor, boothCanOperate, BOOTH_STATES,
  BOOTH_TIMEOUT_DEFAULT, MAX_PRINTS_DEFAULT,
};
