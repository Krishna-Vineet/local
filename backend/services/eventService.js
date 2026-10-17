// ============================================================
// Event helpers shared by the CRM routes, the booth snapshot and the
// plan-limit checks.
//
// Issues #51–#54 (org admins/managers manage events + devices, always
// scoped to their own organization), #58/#59 (branding de-duplication).
// ============================================================

import Event from '../models/Event.js';
import { dedupeLogos } from './boothSnapshotService.js';
import { layoutMeta, resolveLayoutPrices, validateLayoutPrices } from '../config/layouts.js';

/** Derived event status — never trust a stored string alone. */
export function computeEventStatus(event) {
  if (!event) return 'finished';
  if (event.paused) return 'paused';
  const now = Date.now();
  const start = event.startDate ? new Date(event.startDate).getTime() : 0;
  const end = event.endDate ? new Date(event.endDate).getTime() : 0;
  if (start && now < start) return 'upcoming';
  if (end && now > end) return 'finished';
  return 'active';
}

export function isActiveEvent(event) {
  return computeEventStatus(event) === 'active';
}

/** Issue #58: an event can never carry the same logo twice. */
export function normalizeEventBranding(branding = {}, organization = null) {
  const incoming = Array.isArray(branding.logos) ? branding.logos : [];
  const orgFingerprints = new Set(
    dedupeLogos([organization && organization.logoUrl, organization && organization.brandLogoUrl])
      .map((url) => url.toLowerCase()),
  );
  const logos = dedupeLogos([...incoming, branding.logoUrl])
    .filter((url) => !orgFingerprints.has(url.toLowerCase()));
  return {
    logoUrl: logos[0] || null,
    logos,
    tagline: String(branding.tagline || '').trim(),
  };
}

/** Event → CRM response shape (identical to the mock contract). */
export function eventView(event, { devices = [], organization = null, gallerySettings = null } = {}) {
  const status = computeEventStatus(event);
  const assigned = devices
    .filter((device) => String(device.assignedEventId || '') === String(event._id))
    .map((device) => ({
      id: String(device._id),
      name: device.deviceName,
      online: isDeviceOnline(device),
      status: device.status,
    }));
  return {
    id: String(event._id),
    organizationId: event.organizationId ? String(event.organizationId) : null,
    name: event.name,
    clientName: event.clientName || '',
    location: event.location || '',
    startDate: toISO(event.startDate),
    endDate: toISO(event.endDate),
    status,
    storedStatus: event.status,
    paused: !!event.paused,
    templateIds: (event.templateIds || []).map((id) => String(id._id || id)),
    filters: event.filters || [],
    digitalCopy: event.digitalCopy !== false,
    layoutPrices: resolveLayoutPrices({
      eventPrices: event.layoutPrices,
      orgPrices: null,
    }),
    overrideTemplatePrices: !!event.overrideTemplatePrices,
    templatePrices: event.templatePrices instanceof Map
      ? Object.fromEntries(event.templatePrices)
      : (event.templatePrices || {}),
    branding: {
      logoUrl: event.branding?.logoUrl || null,
      logos: dedupeLogos(event.branding?.logos || []),
      tagline: event.branding?.tagline || '',
    },
    assignedDevices: assigned,
    gatewayPriority: event.gatewayPriority || 'razorpay',
    razorpayKeyId: event.razorpayKeyId || '',
    hasRazorpayKeySecret: !!event.razorpayKeySecret,
    cashfreeAppId: event.cashfreeAppId || '',
    hasCashfreeSecretKey: !!event.cashfreeSecretKey,
    cashfreeEnv: event.cashfreeEnv || 'production',
    boothTimeout: event.boothTimeout || 60,
    qrTimeoutMinutes: event.qrTimeoutMinutes || 5,
    shortCode: event.shortCode || null,
    createdAt: toISO(event.createdAt),
    updatedAt: toISO(event.updatedAt),
    gallery: gallerySettings
      ? { galleryEnabled: gallerySettings.galleryEnabled, requireGuestConsent: gallerySettings.requireGuestConsent }
      : undefined,
    organization: organization ? { id: String(organization._id), name: organization.name, logoUrl: organization.logoUrl || null } : undefined,
  };
}

/** Validate a create/update payload coming from the CRM. */
export function eventPatch(body = {}, { organization, existing = null, defaults = null } = {}) {
  const patch = {};
  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw Object.assign(new Error('Event name is required.'), { status: 400, code: 'BAD_EVENT' });
    patch.name = name.slice(0, 120);
  }
  for (const field of ['clientName', 'location']) {
    if (body[field] !== undefined) patch[field] = String(body[field] || '').trim().slice(0, 160);
  }
  if (body.startDate !== undefined) patch.startDate = new Date(body.startDate);
  if (body.endDate !== undefined) patch.endDate = new Date(body.endDate);
  if ((patch.startDate && Number.isNaN(patch.startDate.getTime())) || (patch.endDate && Number.isNaN(patch.endDate.getTime()))) {
    throw Object.assign(new Error('Start and end dates must be valid dates.'), { status: 400, code: 'BAD_EVENT' });
  }
  const start = patch.startDate || (existing && existing.startDate);
  const end = patch.endDate || (existing && existing.endDate);
  if (start && end && new Date(start) >= new Date(end)) {
    throw Object.assign(new Error('End time must be after start time.'), { status: 400, code: 'BAD_EVENT' });
  }
  if (body.templateIds !== undefined) {
    patch.templateIds = Array.isArray(body.templateIds) ? body.templateIds : [];
  }
  if (body.filters !== undefined) patch.filters = Array.isArray(body.filters) ? body.filters.map(String) : [];
  if (body.digitalCopy !== undefined) patch.digitalCopy = body.digitalCopy !== false;
  if (body.gatewayPriority !== undefined) {
    patch.gatewayPriority = body.gatewayPriority === 'cashfree' ? 'cashfree' : 'razorpay';
  }
  if (body.razorpayKeyId !== undefined) {
    patch.razorpayKeyId = String(body.razorpayKeyId || '').trim();
  }
  if (body.razorpayKeySecret !== undefined && body.razorpayKeySecret !== '********') {
    patch.razorpayKeySecret = String(body.razorpayKeySecret || '').trim();
  }
  if (body.cashfreeAppId !== undefined) {
    patch.cashfreeAppId = String(body.cashfreeAppId || '').trim();
  }
  if (body.cashfreeSecretKey !== undefined && body.cashfreeSecretKey !== '********') {
    patch.cashfreeSecretKey = String(body.cashfreeSecretKey || '').trim();
  }
  if (body.cashfreeEnv !== undefined) {
    patch.cashfreeEnv = body.cashfreeEnv === 'sandbox' ? 'sandbox' : 'production';
  }
  if (body.qrTimeoutMinutes !== undefined) {
    const mins = Number(body.qrTimeoutMinutes);
    patch.qrTimeoutMinutes = Number.isFinite(mins) && mins >= 1 && mins <= 30 ? Math.round(mins) : 5;
  }
  if (body.boothTimeout !== undefined) {
    const secs = Number(body.boothTimeout);
    patch.boothTimeout = Number.isFinite(secs) && secs >= 10 && secs <= 600 ? Math.round(secs) : 60;
  }
  if (body.branding !== undefined) patch.branding = normalizeEventBranding(body.branding, organization);
  if (body.layoutPrices !== undefined) {
    const base = resolveLayoutPrices({
      eventPrices: existing ? existing.layoutPrices : {},
      orgPrices: defaults ? defaults.layoutPrices : {},
    });
    patch.layoutPrices = validateLayoutPrices(body.layoutPrices, base);
  }
  if (body.overrideTemplatePrices !== undefined) {
    patch.overrideTemplatePrices = !!body.overrideTemplatePrices;
  }
  if (body.templatePrices !== undefined) {
    const rawTpl = typeof body.templatePrices === 'object' && body.templatePrices !== null ? body.templatePrices : {};
    const sanitized = {};
    for (const [tplId, pr] of Object.entries(rawTpl)) {
      const num = Number(pr);
      if (Number.isFinite(num) && num >= 0) {
        sanitized[tplId] = Math.round(num);
      }
    }
    patch.templatePrices = sanitized;
  }
  if (body.status !== undefined && existing) {
    // Explicit status from the CRM maps onto pause/resume semantics.
    if (body.status === 'paused') patch.paused = true;
    if (body.status === 'active' || body.status === 'live') patch.paused = false;
  }
  return patch;
}

/** Price key for a template/layout — used by quotes and booth config. */
export function priceKeyForLayout(layoutId) {
  return layoutMeta(layoutId).priceKey;
}

export function isDeviceOnline(device, windowMs = 90 * 1000) {
  if (!device || !device.lastSeenAt) return false;
  return Date.now() - new Date(device.lastSeenAt).getTime() < windowMs;
}

function toISO(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function loadEventForOrg({ organizationId, eventId }) {
  const event = await Event.findOne({ _id: eventId, organizationId });
  if (!event) throw Object.assign(new Error('Event not found.'), { status: 404, code: 'EVENT_NOT_FOUND' });
  return event;
}

export function eventPublicShape(event) {
  return {
    id: String(event._id),
    name: event.name,
    status: computeEventStatus(event),
    startDate: toISO(event.startDate),
    endDate: toISO(event.endDate),
  };
}

export default {
  computeEventStatus, isActiveEvent, normalizeEventBranding, eventView, eventPatch,
  priceKeyForLayout, isDeviceOnline, loadEventForOrg, eventPublicShape,
};
