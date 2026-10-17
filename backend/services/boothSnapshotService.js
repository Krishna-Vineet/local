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
        assets: template.assets || [],
      };
    });
}

function normalizeDesign(design, template) {
  const fallback = {
    background: { type: 'solid', colors: ['#ffffff'] },
    accent: '#ff4f9a',
    textColor: '#251530',
    ornament: 'none',
    slotShape: 'square',
    title: template.name || '',
    subtitle: '',
  };
  if (!design || typeof design !== 'object') return fallback;

  // Resolve background URL from design or template.assets
  let rawBg = design.background || design.bg;
  let bgUrl = null;
  let bgAssetId = null;

  if (typeof rawBg === 'string') {
    if (rawBg.startsWith('http') || rawBg.startsWith('data:')) {
      bgUrl = rawBg;
    }
  } else if (rawBg && typeof rawBg === 'object') {
    bgUrl = rawBg.url || null;
    bgAssetId = rawBg.assetId || null;
  }

  // If no URL directly on background object, resolve from template.assets or backend uploads
  if (!bgUrl && Array.isArray(template.assets) && template.assets.length > 0) {
    const matchedAsset = (bgAssetId && template.assets.find(a => a.assetId === bgAssetId)) ||
      template.assets.find(a => a.role === 'background' || a.type === 'background');
    if (matchedAsset && matchedAsset.url) {
      bgUrl = matchedAsset.url;
    }
  }

  if (!bgUrl && bgAssetId && !bgAssetId.startsWith('temp-')) {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    bgUrl = `${backendUrl}/uploads/${bgAssetId.replace(/^(\/?uploads\/|\/)/, '')}`;
  }

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
  const decorations = Array.isArray(design.decorations)
    ? design.decorations.map((dec) => {
        if (!dec.url && dec.assetId) {
          const matched = Array.isArray(template.assets) && template.assets.find((a) => a.assetId === dec.assetId);
          if (matched && matched.url) {
            return { ...dec, url: matched.url };
          }
          if (!dec.assetId.startsWith('temp-')) {
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            return { ...dec, url: `${backendUrl}/uploads/${dec.assetId.replace(/^(\/?uploads\/|\/)/, '')}` };
          }
        }
        return dec;
      })
    : [];

  return {
    ...fallback,
    ...design,
    background,
    accent: design.accent || design.palette?.accent || design.palette?.primary || fallback.accent,
    textColor: design.textColor || design.palette?.text || fallback.textColor,
    ornament: design.ornament || 'none',
    slotShape: design.slotShape || 'square',
    title: design.title || template.name || '',
    subtitle: design.subtitle || '',
    decorations,
    palette: design.palette || null,
    theme: design.theme || null,
  };
}

/** Bottom-15% branding footer, grid slots inside the photo area (CRM parity). */
function autoSlots(meta, template) {
  const { canvas, slots } = meta;
  const footer = Math.round(canvas.height * 0.15);
  const width = canvas.width;
  const height = canvas.height - footer;
  const gap = Math.max(10, Math.round(width * 0.022));
  const columns = slots <= 1 ? 1 : slots <= 4 ? 2 : 3;
  const rows = Math.ceil(slots / columns);
  const cellW = (width - gap * (columns - 1)) / columns;
  const cellH = (height - gap * (rows - 1)) / rows;
  const out = [];
  for (let index = 0; index < slots; index += 1) {
    out.push({
      id: `slot-${index + 1}`,
      x: Math.round((index % columns) * (cellW + gap)),
      y: Math.round(Math.floor(index / columns) * (cellH + gap)),
      width: Math.round(cellW),
      height: Math.round(cellH),
    });
  }
  return out;
}

/**
 * Booth settings: every value the booth needs, sourced from the org's
 * defaults — never from hard-coded platform fallbacks when the org has
 * configured something (issues #69–#71, #105, #106).
 */
export function buildSettings({ organization = {}, defaults = null, event = null }) {
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
  const settings = buildSettings({ organization, defaults, event });

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
