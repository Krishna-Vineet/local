// ============================================================
// Booth (Electron / kiosk) API — v2 contract.
//
// Fixes covered here:
//   #2/#74/#75  suspended or banned organizations cannot keep operating;
//               the booth hears about it on every heartbeat
//   #57         deleted devices are rejected (410) so cached config dies
//   #69–#73     full booth configuration: org name + logo, event logos,
//               tagline, real booth timeout, layout prices (event → org →
//               platform), UPI id, payout mode, payment display name,
//               print limits — refreshed only when `revision` changes
//   #76–#81     heartbeat sends/accepts only changed hardware fields and
//               distinguishes network failure from banned/suspended/
//               deleted/blocked/unpaired states
//   #103–#107   payment config comes from CRM settings, free checkout
//               passes the complete quote object
//   #60/#61     gallery consent captured at session completion
// ============================================================

import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
import { decryptSecret } from '../utils/crypto.js';

import Device from '../models/Device.js';
import Organization from '../models/Organization.js';
import OrganizationDefaults from '../models/OrganizationDefaults.js';
import Setting from '../models/Setting.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Template from '../models/Template.js';
import OrgAiTemplate from '../models/OrgAiTemplate.js';
import Payment from '../models/Payment.js';
import Photo from '../models/Photo.js';
import { uploadToS3, s3KeyFromUrl } from '../utils/s3.js';
import SupportTicket from '../models/SupportTicket.js';
import Coupon from '../models/Coupon.js';

import { softDeviceAuth, authenticateDevice } from '../middleware/deviceAuth.js';
import { asyncRoute, badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import { writeAudit } from '../utils/auditLogger.js';
import {
  buildBoothSnapshot, mergeHardware, boothStateFor, computeRevision, BOOTH_STATES,
} from '../services/boothSnapshotService.js';
import { getGallerySettings, photoVisibleInGallery } from '../services/gallerySettingsService.js';
import { createGuestDownload, downloadUrlFor } from '../services/guestDownloadService.js';
import { applyCoupon, recordCouponRedemption } from '../services/couponService.js';
import { resolveLayoutPrices, layoutMeta } from '../config/layouts.js';
import { orgLimits, assertDeviceLimit, computePlanStatus } from '../services/planService.js';
import { computeEventStatus } from '../services/eventService.js';

const router = express.Router();

// ─── helpers ───────────────────────────────────────────────────

async function defaultsFor(organizationId) {
  return OrganizationDefaults.findOne({ organizationId }).lean();
}

/**
 * Resolve payment gateway config for a given org/event.
 * Strictly Organization-owned (event override > organization defaults/settings).
 * No .env fallback — each organization must configure its own gateway keys in CRM.
 * Returns { priority, qrTimeoutMinutes, razorpay, cashfree }
 */
async function resolveGatewayConfig(organizationId, eventId) {
  let rzp = null;
  let cf = null;
  let priority = 'razorpay';
  let qrTimeoutMinutes = 5;

  let eventOverrodeRzp = false;
  let eventOverrodeCf = false;
  let eventOverrodePriority = false;

  // 1. Event-level override (if this event has custom keys)
  if (eventId) {
    const ev = await Event.findById(eventId).lean();
    if (ev) {
      const evRzpSecret = decryptSecret(ev.razorpayKeySecret);
      const evCfSecret = decryptSecret(ev.cashfreeSecretKey);
      if (ev.razorpayKeyId && evRzpSecret) {
        rzp = { key_id: ev.razorpayKeyId, key_secret: evRzpSecret };
        eventOverrodeRzp = true;
      }
      if (ev.cashfreeAppId && evCfSecret) {
        cf = { appId: ev.cashfreeAppId, secretKey: evCfSecret, env: ev.cashfreeEnv || 'production' };
        eventOverrodeCf = true;
      }
      if (ev.gatewayPriority) {
        priority = ev.gatewayPriority;
        eventOverrodePriority = true;
      }
      if (ev.qrTimeoutMinutes) {
        qrTimeoutMinutes = ev.qrTimeoutMinutes;
      }
    }
  }

  // 2. Org-level configuration (entered by Org Admin in CRM -> Organization Defaults)
  if (organizationId) {
    const [settings, defaults] = await Promise.all([
      Setting.findOne({ organizationId }).lean(),
      OrganizationDefaults.findOne({ organizationId }).lean(),
    ]);
    const rzpId = settings?.razorpayKeyId || defaults?.razorpayKeyId;
    const rzpSecret = decryptSecret(settings?.razorpayKeySecret || defaults?.razorpayKeySecret);
    const cfApp = settings?.cashfreeAppId || defaults?.cashfreeAppId;
    const cfSecret = decryptSecret(settings?.cashfreeSecretKey || defaults?.cashfreeSecretKey);
    const cfEnv = settings?.cashfreeEnv || defaults?.cashfreeEnv || 'production';
    const orgPriority = settings?.gatewayPriority || defaults?.gatewayPriority;

    if (!eventOverrodeRzp && rzpId && rzpSecret) {
      rzp = { key_id: rzpId, key_secret: rzpSecret };
    }
    if (!eventOverrodeCf && cfApp && cfSecret) {
      cf = { appId: cfApp, secretKey: cfSecret, env: cfEnv };
    }
    if (!eventOverrodePriority && orgPriority) {
      priority = orgPriority;
    }
    if (!eventId && defaults?.qrTimeoutMinutes) {
      qrTimeoutMinutes = defaults.qrTimeoutMinutes;
    }
  }

  const hasRzp = !!(rzp && rzp.key_id && rzp.key_secret);
  const hasCf = !!(cf && cf.appId && cf.secretKey);

  console.log(`[Gateway Resolved] Priority: ${priority} | Razorpay: ${hasRzp ? 'READY' : 'NOT_CONFIGURED'} | Cashfree: ${hasCf ? 'READY' : (cf?.appId ? 'MISSING_SECRET_KEY' : 'NOT_CONFIGURED')}`);

  return {
    priority,
    qrTimeoutMinutes,
    razorpay: hasRzp ? rzp : null,
    cashfree: hasCf ? cf : null,
  };
}

/** Create a Cashfree UPI QR for the given order using cashfree-pg v6 instance. */
async function createCashfreeUpiQr(cfConfig, { amountRupees, paymentId, eventName, printCount, expirySeconds = 300 }) {
  const env = (cfConfig.env === 'production' || cfConfig.env === 'live') ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
  const cashfree = new Cashfree(env, cfConfig.appId, cfConfig.secretKey);

  const cfOrderId = `hp_booth_${paymentId}`;
  const orderReq = {
    order_id: cfOrderId,
    order_amount: parseFloat(amountRupees.toFixed(2)),
    order_currency: 'INR',
    order_note: `HappyPix Booth - ${eventName || 'Event'} - ${printCount} print(s)`,
    order_meta: {
      order_expiry_time: new Date(Date.now() + expirySeconds * 1000).toISOString(),
    },
    customer_details: { customer_id: `guest_${Date.now()}`, customer_phone: '9876543210', customer_email: 'guest@happypix.in' },
  };

  await cashfree.PGCreateOrder(orderReq);
  const qrResp = await cashfree.PGOrderFetchQRCode(cfOrderId);
  const qrData = Array.isArray(qrResp.data) ? qrResp.data[0] : qrResp.data;

  return {
    cfOrderId,
    qrPayload: qrData?.payload || null,
    qrImageUrl: qrData?.image_data || null,
  };
}

/** Check Cashfree order status using cashfree-pg v6 instance. */
async function checkCashfreeStatus(cfConfig, cfOrderId) {
  const env = (cfConfig.env === 'production' || cfConfig.env === 'live') ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
  const cashfree = new Cashfree(env, cfConfig.appId, cfConfig.secretKey);
  const resp = await cashfree.PGFetchOrder(cfOrderId);
  const order = resp.data;
  if (order.order_status === 'PAID') return 'paid';
  if (order.order_status === 'EXPIRED' || order.order_status === 'CANCELLED') return 'failed';
  return 'pending';
}

/** Every booth response carries a machine-readable state (issue #80/#81). */
function stateEnvelope(state, extra = {}) {
  return { state, serverTime: new Date().toISOString(), ...extra };
}

function failureStatus(state) {
  switch (state) {
    case BOOTH_STATES.DEVICE_DELETED: return 410;
    case BOOTH_STATES.DEVICE_BLOCKED: return 403;
    case BOOTH_STATES.BANNED: return 403;
    case BOOTH_STATES.UNPAIRED: return 401;
    default: return 403;
  }
}

/** Device must be active and the org must not be suspended/banned. */
async function requireOperationalBooth(req) {
  const { device, organization } = req;
  const state = boothStateFor({ device, organization });
  if (state !== BOOTH_STATES.ACTIVE) {
    const error = new Error(
      state === BOOTH_STATES.SUSPENDED
        ? 'This organization is suspended. The booth is locked until it is restored.'
        : state === BOOTH_STATES.BANNED
          ? 'This organization has been banned. Contact HappyPix support.'
          : 'This booth can no longer operate. Re-pair it from the booth app.',
    );
    error.status = failureStatus(state);
    error.code = state;
    throw error;
  }
  const subscription = await mongooseSubscription(organization._id);
  const planStatus = computePlanStatus(organization, subscription);
  if (planStatus === 'expired') {
    const error = new Error('The organization subscription has expired. The booth is locked until it is renewed.');
    error.status = 402;
    error.code = 'PLAN_EXPIRED';
    throw error;
  }
  return { device, organization };
}

async function mongooseSubscription(organizationId) {
  const { default: Subscription } = await import('../models/Subscription.js');
  return Subscription.findOne({ organizationId }).sort({ createdAt: -1 }).lean();
}

export async function populateAllTemplates(event) {
  if (!event) return null;
  const rawIds = (event.templateIds || []).map((id) => String(id?._id || id));
  if (rawIds.length === 0) {
    event.templateIds = [];
    return event;
  }
  const [platformTemplates, orgTemplates] = await Promise.all([
    Template.find({ _id: { $in: rawIds } }).lean(),
    OrgAiTemplate.find({ _id: { $in: rawIds } }).lean(),
  ]);
  const map = new Map();
  for (const t of platformTemplates) {
    map.set(String(t._id), {
      ...t,
      id: String(t._id),
      active: t.active !== false,
      source: t.source || 'designer',
      layoutId: t.layoutId || '46-v1',
    });
  }
  for (const t of orgTemplates) {
    map.set(String(t._id), {
      ...t,
      id: String(t._id),
      active: true,
      source: t.source === 'manual' ? 'manual' : 'ai_generated',
      layoutId: t.layout?.code || t.layoutCode || 'custom',
      originalLayout: t.layout,
      photoSlots: t.slots || [],
    });
  }
  event.templateIds = rawIds.map((id) => map.get(id)).filter(Boolean);
  return event;
}

async function loadAssignedEvent(device) {
  if (!device.assignedEventId) return null;
  const event = await Event.findById(device.assignedEventId).lean();
  return populateAllTemplates(event);
}

/** Build a fresh snapshot for a device (used by bootstrap + revision changes). */
async function snapshotFor(device, organization) {
  const event = await loadAssignedEvent(device);
  return buildBoothSnapshot({ device, organization, event });
}

// ================================================================
// PAIRING
// ================================================================

router.post('/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const deviceUuid = String(req.body.deviceUuid || '').trim();
  if (!email || !password || !deviceUuid) {
    throw badRequest('Email, password and deviceUuid are required.', 'BAD_PAIRING');
  }

  const user = await User.findOne({ email, role: { $in: ['ORG_ADMIN', 'ORG_MANAGER'] } });
  if (!user || !(await user.comparePassword(password))) {
    throw forbidden('Invalid organization credentials.', 'INVALID_CREDENTIALS');
  }
  if (user.status !== 'active') throw forbidden('This account is deactivated.', 'ACCOUNT_DEACTIVATED');

  const organization = await Organization.findById(user.organizationId);
  if (!organization) throw forbidden('Organization not found. Contact support.', 'ORG_MISSING');

  const state = boothStateFor({ device: { status: 'active' }, organization });
  if (state === BOOTH_STATES.BANNED) {
    throw forbidden('This organization has been banned. Contact HappyPix support.', BOOTH_STATES.BANNED);
  }
  if (state === BOOTH_STATES.SUSPENDED) {
    throw forbidden('This organization is suspended — booths are locked until it is restored.', BOOTH_STATES.SUSPENDED);
  }

  let device = await Device.findOne({ deviceUuid, organizationId: organization._id });
  if (device && (device.status === 'blocked' || device.status === 'inactive')) {
    throw forbidden('This booth has been blocked by an administrator.', BOOTH_STATES.DEVICE_BLOCKED);
  }
  // The raw token is returned to the booth exactly once (here); only its
  // SHA-256 hash is persisted (models/Device.js pre-save).
  const rawDeviceToken = Device.generateToken();
  if (!device) {
    // Issue #55: pairing a new booth counts against the plan's device limit.
    const used = await Device.countDocuments({ organizationId: organization._id });
    await assertDeviceLimit(organization, used);
    device = await Device.create({
      organizationId: organization._id,
      deviceUuid,
      deviceName: String(req.body.deviceName || 'HappyPix Booth').slice(0, 60),
      location: (req.body.location && (req.body.location.label || req.body.location)) || '',
      deviceToken: rawDeviceToken,
      platform: req.body.platform || null,
      appVersion: req.body.appVersion || null,
      status: 'active',
      lastSeenAt: new Date(),
    });
    await writeAudit({
      actorId: user._id, actorName: user.name, actorRole: user.role,
      organizationId: organization._id,
      action: 'device.paired', entity: 'device',
      ip: req.ip,
      summary: `Booth “${device.deviceName}” paired (${device.deviceUuid.slice(0, 8)}…)`,
    });
  } else {
    // Re-pairing rotates the token — old cached credentials stop working.
    device.deviceToken = rawDeviceToken;
    device.platform = req.body.platform || device.platform;
    device.appVersion = req.body.appVersion || device.appVersion;
    device.lastSeenAt = new Date();
    await device.save();
  }

  const snapshot = await snapshotFor(device, organization);
  res.json({
    installation: {
      deviceUuid: device.deviceUuid,
      deviceToken: rawDeviceToken,
      deviceId: String(device._id),
      organizationId: String(organization._id),
      pairedAt: new Date().toISOString(),
      locationLabel: device.location || '',
    },
    snapshot,
    state: BOOTH_STATES.ACTIVE,
  });
}));

// ================================================================
// CONFIG / BOOTSTRAP  (#69–#73)
// ================================================================

/**
 * Soft auth so a blocked/suspended booth still learns *why* it is blocked
 * (issue #81) instead of silently running from stale cache (issue #75).
 */
router.get('/bootstrap', softDeviceAuth, asyncRoute(async (req, res) => {
  const auth = req.deviceAuth;
  if (!req.device || auth.state !== BOOTH_STATES.ACTIVE) {
    if (auth.state === BOOTH_STATES.SUSPENDED && req.device && req.organization) {
      const snapshot = await snapshotFor(req.device, req.organization);
      return res.json(stateEnvelope(BOOTH_STATES.SUSPENDED, {
        message: 'This organization is suspended. The booth is locked until HappyPix restores it.',
        snapshot: { ...snapshot, event: null, suspendReason: req.organization.suspendReason || null },
      }));
    }
    return res.status(failureStatus(auth.state)).json(stateEnvelope(auth.state, { error: auth.message }));
  }

  const snapshot = await snapshotFor(req.device, req.organization);
  res.json(stateEnvelope(BOOTH_STATES.ACTIVE, snapshot));
}));

/** Same payload as /bootstrap — used for end-to-end config tests (issue #60). */
router.get('/config', softDeviceAuth, asyncRoute(async (req, res) => {
  if (!req.device || req.deviceAuth.state !== BOOTH_STATES.ACTIVE) {
    return res.status(failureStatus(req.deviceAuth.state)).json(stateEnvelope(req.deviceAuth.state, { error: req.deviceAuth.message }));
  }
  res.json(await snapshotFor(req.device, req.organization));
}));

/** Revision-only probe — lets a client check cheaply whether it must refresh. */
router.get('/revision', authenticateDevice, asyncRoute(async (req, res) => {
  const snapshot = await snapshotFor(req.device, req.organization);
  res.json({ revision: snapshot.revision, serverTime: snapshot.serverTime });
}));

// ================================================================
// HEARTBEAT  (#76–#81)
// ================================================================

router.post('/heartbeat', softDeviceAuth, asyncRoute(async (req, res) => {
  const auth = req.deviceAuth;

  // The booth reports "I could not reach the server" itself — never here.
  if (!req.device || auth.state !== BOOTH_STATES.ACTIVE) {
    if (auth.state === BOOTH_STATES.SUSPENDED && req.device && req.organization) {
      return res.json(stateEnvelope(BOOTH_STATES.SUSPENDED, {
        changed: false,
        message: 'This organization is suspended. The booth is locked.',
        // Issue #74/#75: the booth must drop its cached operating snapshot.
        invalidateCache: true,
        snapshot: null,
      }));
    }
    return res.status(failureStatus(auth.state)).json(stateEnvelope(auth.state, {
      changed: false,
      invalidateCache: true,
      error: auth.message,
    }));
  }

  const device = req.device;
  const organization = req.organization;

  // Issues #76/#77: only the fields the booth actually marked as changed.
  const hardwarePatch = req.body && req.body.hardwarePatch ? req.body.hardwarePatch : (req.body && req.body.hardware) || {};
  const { telemetry, connections, changed: hardwareChanged } = mergeHardware(device, hardwarePatch);
  if (hardwareChanged.telemetry || hardwareChanged.connections) {
    device.telemetry = telemetry;
    device.connections = connections;
  }
  device.lastSeenAt = new Date();
  device.ipAddress = req.ip || null;
  device.userAgent = req.headers['user-agent'] || null;
  if (req.body && req.body.appVersion) device.appVersion = String(req.body.appVersion).slice(0, 40);
  if (req.body && req.body.platform) device.platform = String(req.body.platform).slice(0, 40);
  await device.save();

  // Issues #79/#72: compare revisions, return a snapshot only when it differs.
  const knownRevision = req.body && req.body.knownRevision ? String(req.body.knownRevision) : null;
  const snapshot = await snapshotFor(device, organization);
  const changed = snapshot.revision !== knownRevision;

  await writeAudit({
    organizationId: organization._id, actorId: null, actorName: 'Booth',
    action: 'booth.heartbeat', entity: 'device',
    summary: `${device.deviceName} heartbeat${changed ? ' (configuration changed)' : ''}`,
  });

  res.json(stateEnvelope(BOOTH_STATES.ACTIVE, {
    changed,
    snapshot: changed ? snapshot : null,
    revision: snapshot.revision,
    hardware: { telemetry, connections, accepted: hardwareChanged },
    // The booth stops normal operation when this ever becomes false.
    canOperate: true,
  }));
}));

// ================================================================
// CHECKOUT  (#103–#107, #44)
// ================================================================

router.post('/checkout/quote', authenticateDevice, asyncRoute(async (req, res) => {
  const { device, organization } = await requireOperationalBooth(req);
  const prints = Math.max(1, Math.min(50, parseInt(req.body.prints, 10) || 1));
  const eventId = req.body.eventId || (device.assignedEventId ? String(device.assignedEventId) : null);
  if (!eventId) throw conflict('No event is assigned to this booth.', 'NO_EVENT');

  const rawEvent = await Event.findOne({ _id: eventId, organizationId: organization._id }).lean();
  if (!rawEvent) throw notFound('Event not found.', 'EVENT_NOT_FOUND');
  const event = await populateAllTemplates(rawEvent);
  const status = computeEventStatus(event);
  if (status !== 'active') throw conflict('This event is not running right now.', 'EVENT_NOT_LIVE');

  const templateId = req.body.templateId ? String(req.body.templateId) : null;
  const allowed = (event.templateIds || []).filter((template) => template && template.active !== false);
  const template = templateId
    ? allowed.find((row) => String(row._id || row.id) === templateId)
    : req.body.layoutId
      ? allowed.find((row) => row.layoutId === req.body.layoutId || row.layout?.code === req.body.layoutId || row.layout?.id === req.body.layoutId)
      : null;
  if (!template) throw badRequest('This template is no longer available for the event.', 'TEMPLATE_UNAVAILABLE');

  const tplLayoutId = template.layoutId || template.layout?.code || template.layout?.id || req.body.layoutId || '46-v1';
  if (req.body.layoutId && tplLayoutId && req.body.layoutId !== tplLayoutId) {
    if (template.layoutId !== req.body.layoutId && template.layout?.code !== req.body.layoutId) {
      throw badRequest('Template and layout do not match.', 'LAYOUT_MISMATCH');
    }
  }

  const defaults = await defaultsFor(organization._id);
  // Event template price → org template price → layout baseline price.
  const prices = resolveLayoutPrices({ eventPrices: event.layoutPrices, orgPrices: defaults && defaults.layoutPrices });
  const meta = layoutMeta(tplLayoutId);
  const layoutPrice = Number(prices[meta.priceKey] ?? 0);

  const tplId = String(template._id || template.id);
  const isOverride = !!event.overrideTemplatePrices;
  const evTplPrices = event.templatePrices instanceof Map ? Object.fromEntries(event.templatePrices) : (event.templatePrices || {});
  const orgTplPrices = defaults?.templatePrices instanceof Map ? Object.fromEntries(defaults.templatePrices) : (defaults?.templatePrices || {});

  let unitPrice = null;
  if (isOverride && evTplPrices[tplId] != null && !isNaN(Number(evTplPrices[tplId]))) {
    unitPrice = Number(evTplPrices[tplId]);
  } else if (orgTplPrices[tplId] != null && !isNaN(Number(orgTplPrices[tplId]))) {
    unitPrice = Number(orgTplPrices[tplId]);
  } else {
    unitPrice = layoutPrice;
  }
  if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice < 0) {
    unitPrice = layoutPrice;
  }

  const gross = unitPrice * prints;
  let discount = 0;
  let couponMessage = null;
  let validCoupon = null;

  if (req.body.couponCode) {
    const coupon = await Coupon.findOne({
      organizationId: organization._id,
      code: String(req.body.couponCode).trim().toUpperCase(),
    });
    const result = applyCoupon(coupon, { gross, eventId });
    if (!result.ok) throw badRequest(result.message, 'COUPON_INVALID');
    discount = result.discount;
    couponMessage = result.message;
    validCoupon = result.coupon.code;
  }

  const payoutMode = defaults && defaults.payoutMode === 'upi' ? 'upi' : 'wallet';
  const finalAmount = Math.max(0, gross - discount);

  res.json({
    quoteId: `quote-${crypto.randomUUID()}`,
    unitPrice,
    prints,
    gross,
    discount,
    finalAmount,
    couponCode: validCoupon,
    couponMessage,
    settlement: payoutMode,
    currency: 'INR',
    layoutId: meta.id,
    priceKey: meta.priceKey,
    templateId: String(template._id),
    eventId: String(event._id),
    deviceId: String(device._id),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
}));



/**
 * Issues #105/#106: Create a payment with Razorpay or Cashfree gateway QR.
 * Priority: org settings → event override → fallback to UPI string.
 * The booth polls /payments/:id to detect payment completion.
 */
router.post('/payments', authenticateDevice, asyncRoute(async (req, res) => {
  const { device, organization } = await requireOperationalBooth(req);
  const quote = req.body && req.body.quote;
  if (!quote || quote.finalAmount === undefined) throw badRequest('A complete quote is required.', 'QUOTE_REQUIRED');
  const amountRupees = Number(quote.finalAmount) || 0;
  const amountPaise = Math.round(amountRupees * 100);
  if (amountRupees <= 0) throw conflict('Free checkouts must use the free completion endpoint.', 'FREE_CHECKOUT');

  const eventId = quote.eventId || (device.assignedEventId ? String(device.assignedEventId) : null);
  const event = eventId ? await Event.findById(eventId).lean() : null;
  const defaults = await defaultsFor(organization._id);
  const payoutMode = defaults && defaults.payoutMode === 'upi' ? 'upi' : 'wallet';
  const payeeUpi = (event && event.upiId) || (defaults && defaults.upiId) || process.env.PLATFORM_FALLBACK_UPI || 'payments@happypix.in';
  const payeeName = (defaults && defaults.paymentDisplayName) || (event && event.name) || `${organization.name} · HappyPix`;

  // Create the DB record first so we have a paymentId for the QR reference
  const payment = await Payment.create({
    organizationId: organization._id,
    eventId,
    deviceId: device._id,
    sessionId: quote.sessionId || null,
    razorpayOrderId: `booth_${crypto.randomUUID()}`,
    amount: amountRupees,
    currency: 'INR',
    printCount: Math.max(1, Number(quote.prints) || 1),
    digitalCopy: quote.digitalCopy !== false,
    couponCode: quote.couponCode || null,
    discountApplied: Number(quote.discount) || 0,
    settlement: payoutMode,
    status: 'pending',
    gateway: 'razorpay', // will be updated below
  });

  // Attempt gateway QR generation (Razorpay or Cashfree)
  const gwConfig = await resolveGatewayConfig(organization._id, eventId);
  const priority = gwConfig.priority;
  const qrExpirySeconds = Math.max(60, (gwConfig.qrTimeoutMinutes || 5) * 60);

  const orderedGateways = (priority === 'cashfree'
    ? [gwConfig.cashfree ? { name: 'cashfree', cfg: gwConfig.cashfree } : null, gwConfig.razorpay ? { name: 'razorpay', cfg: gwConfig.razorpay } : null]
    : [gwConfig.razorpay ? { name: 'razorpay', cfg: gwConfig.razorpay } : null, gwConfig.cashfree ? { name: 'cashfree', cfg: gwConfig.cashfree } : null]
  ).filter(Boolean);

  if (orderedGateways.length === 0) {
    throw badRequest(
      'Payment gateway is not configured for your organization. Please enter Razorpay or Cashfree credentials in CRM -> Organization Defaults.',
      'GATEWAY_NOT_CONFIGURED'
    );
  }

  let qrPayload = null;      // raw UPI string (Cashfree or fallback)
  let qrImageUrl = null;     // pre-rendered image PNG (Razorpay / Cashfree)
  let usedGateway = null;
  let cfOrderId = null;
  let rzpOrderId = null;
  let lastGatewayError = null;

  for (const gw of orderedGateways) {
    try {
      if (gw.name === 'razorpay') {
        const rzp = new Razorpay({ key_id: gw.cfg.key_id, key_secret: gw.cfg.key_secret });
        // Create Razorpay order
        const order = await rzp.orders.create({
          amount: amountPaise,
          currency: 'INR',
          receipt: String(payment._id),
          notes: { eventId: eventId || '', paymentId: String(payment._id), printCount: String(quote.prints) },
        });
        rzpOrderId = order.id;

        // Try single-use UPI QR first
        try {
          const qrCode = await rzp.qrCode.create({
            type: 'upi_qr',
            name: payeeName,
            usage: 'single_use',
            fixed_amount: true,
            payment_amount: amountPaise,
            description: 'HappyPix Booth Prints',
            close_by: Math.floor((Date.now() + qrExpirySeconds * 1000) / 1000),
            notes: { orderId: order.id, paymentId: String(payment._id) },
          });
          qrImageUrl = qrCode.image_url || null;
          qrPayload = qrCode.payload;
          payment.paymentLinkId = qrCode.id;
        } catch (qrErr) {
          const qrErrMsg = qrErr?.error?.description || qrErr?.error?.message || qrErr?.message || JSON.stringify(qrErr);
          console.warn('⚠️ Razorpay direct qrCode.create not enabled/failed:', qrErrMsg);
          
          // If another gateway (like Cashfree) is configured, try it first so guests get a real UPI QR code!
          const nextGw = orderedGateways.find((g) => g.name !== 'razorpay');
          if (nextGw) {
            console.log(`ℹ️ Razorpay direct UPI QR not supported on this merchant account; falling over to ${nextGw.name} for native UPI QR.`);
            continue;
          }

          // Otherwise, fall back to Razorpay Payment Link
          console.warn('⚠️ No alternative gateway; using Razorpay Payment Link as last resort.');
          const linkExpirySeconds = Math.max(960, qrExpirySeconds);
          const link = await rzp.paymentLink.create({
            amount: amountPaise,
            currency: 'INR',
            description: `HappyPix Booth - ${quote.prints || 1} print(s)`,
            customer: { name: 'Booth Guest', email: 'guest@happypix.in' },
            notify: { sms: false, email: false },
            reminder_enable: false,
            expire_by: Math.floor((Date.now() + linkExpirySeconds * 1000) / 1000),
            notes: { orderId: order.id, paymentId: String(payment._id) },
          });
          qrPayload = link.short_url;
          payment.paymentLinkId = link.id;
        }

        usedGateway = 'razorpay';
        payment.razorpayOrderId = order.id;
        payment.paymentLinkUrl = qrImageUrl || qrPayload;
        payment.gateway = 'razorpay';
        await payment.save();
        break;

      } else if (gw.name === 'cashfree') {
        const result = await createCashfreeUpiQr(gw.cfg, {
          amountRupees,
          paymentId: String(payment._id),
          eventName: quote.eventName || '',
          printCount: quote.prints,
          expirySeconds: qrExpirySeconds,
        });
        cfOrderId = result.cfOrderId;
        qrPayload = result.qrPayload;
        qrImageUrl = result.qrImageUrl;
        usedGateway = 'cashfree';

        // Update payment with Cashfree IDs
        payment.cashfreeOrderId = cfOrderId;
        payment.cashfreeQrData = qrPayload;
        payment.paymentLinkUrl = qrImageUrl;
        payment.gateway = 'cashfree';
        await payment.save();
        break;
      }
    } catch (gwErr) {
      lastGatewayError = gwErr?.error?.description || gwErr?.error?.message || gwErr?.message || (typeof gwErr === 'object' ? JSON.stringify(gwErr) : String(gwErr));
      console.warn(`⚠️ Gateway ${gw.name} QR creation failed:`, lastGatewayError);
      // Try the next gateway
    }
  }

  // If all configured gateways failed, return clear error
  if (!usedGateway) {
    throw badRequest(
      `Payment gateway error: ${lastGatewayError || 'Failed to generate QR code from your organization credentials.'}`,
      'GATEWAY_ERROR'
    );
  }

  res.status(201).json({
    paymentId: String(payment._id),
    amount: amountRupees,
    amountPaise,
    qrPayload,                   // raw UPI string → booth renders as QR
    qrImageUrl,                  // pre-rendered PNG (Razorpay/Cashfree) if available
    gateway: usedGateway || 'fallback',
    upiId: payeeUpi,
    payeeName,
    settlement: payoutMode,
    status: 'pending',
  });
}));

/**
 * Poll payment status — checks the actual gateway for real-time verification.
 * Razorpay: checks QR code / order payments.
 * Cashfree: checks order status via API.
 * Fallback: auto-confirm after 6.5 s in sandbox mode.
 */
router.get('/payments/:id', authenticateDevice, asyncRoute(async (req, res) => {
  const { organization } = await requireOperationalBooth(req);
  const payment = await Payment.findOne({ _id: req.params.id, organizationId: organization._id });
  if (!payment) throw notFound('Payment not found.', 'PAYMENT_NOT_FOUND');

  if (payment.status === 'paid') {
    return res.json({ status: 'paid', settlement: payment.settlement, gateway: payment.gateway });
  }
  if (payment.status === 'failed') {
    return res.json({ status: 'failed', settlement: payment.settlement, gateway: payment.gateway });
  }

  // Real gateway verification
  let isPaid = false;
  try {
    const gwConfig = await resolveGatewayConfig(organization._id, payment.eventId);

    if (payment.gateway === 'cashfree' && payment.cashfreeOrderId) {
      if (gwConfig.cashfree) {
        const status = await checkCashfreeStatus(gwConfig.cashfree, payment.cashfreeOrderId);
        if (status === 'paid') isPaid = true;
        else if (status === 'failed') {
          payment.status = 'failed';
          await payment.save();
          return res.json({ status: 'failed', settlement: payment.settlement, gateway: payment.gateway });
        }
      }
    } else if (payment.gateway === 'razorpay' && gwConfig.razorpay) {
      const rzp = new Razorpay({ key_id: gwConfig.razorpay.key_id, key_secret: gwConfig.razorpay.key_secret });
      if (payment.paymentLinkId && payment.paymentLinkId.startsWith('qr_')) {
        const qr = await rzp.qrCode.fetch(payment.paymentLinkId);
        if (qr.payments_count > 0 || qr.payments_amount_received >= (payment.amount * 100)) isPaid = true;
      } else if (payment.paymentLinkId && payment.paymentLinkId.startsWith('plink_')) {
        const link = await rzp.paymentLink.fetch(payment.paymentLinkId);
        if (link.status === 'paid') isPaid = true;
      } else if (payment.razorpayOrderId && payment.razorpayOrderId.startsWith('order_')) {
        const payments = await rzp.orders.fetchPayments(payment.razorpayOrderId);
        if (payments?.items?.some((p) => p.status === 'captured' || p.status === 'authorized')) isPaid = true;
      }
    }
  } catch (checkErr) {
    console.warn('⚠️ Gateway status check failed:', checkErr.message);
    // Don't fail — just return pending
  }

  if (isPaid) {
    payment.status = 'paid';
    payment.paidAt = new Date();
    await payment.save();
    await recordCouponRedemption(payment);
    return res.json({ status: 'paid', settlement: payment.settlement, gateway: payment.gateway });
  }

  res.json({ status: 'pending', settlement: payment.settlement, gateway: payment.gateway });
}));

/** Webhook/callback helper for a real gateway (bank UTR or Razorpay id). */
router.post('/payments/:id/confirm', authenticateDevice, asyncRoute(async (req, res) => {
  const { device, organization } = await requireOperationalBooth(req);
  const payment = await Payment.findOne({ _id: req.params.id, organizationId: organization._id });
  if (!payment) throw notFound('Payment not found.', 'PAYMENT_NOT_FOUND');

  // Verify the confirming device owns this payment session
  if (payment.deviceId && String(payment.deviceId) !== String(device._id)) {
    throw forbidden('This payment was initiated on a different booth device.', 'DEVICE_MISMATCH');
  }

  if (payment.status === 'paid') {
    return res.json({ ok: true, status: payment.status });
  }

  if (payment.status !== 'pending') {
    throw conflict(`Cannot confirm payment in ${payment.status} state.`, 'PAYMENT_STATE_INVALID');
  }

  payment.status = 'paid';
  payment.paidAt = new Date();
  if (req.body && req.body.utr) {
    payment.utr = String(req.body.utr).trim().slice(0, 64);
  }
  await payment.save();
  await recordCouponRedemption(payment);

  await writeAudit({
    organizationId: organization._id,
    actorId: null,
    actorName: device.deviceName || 'Booth',
    action: 'booth.payment.confirmed',
    entity: 'payment',
    summary: `Payment ${payment._id} confirmed by booth ${device.deviceName} (UTR: ${payment.utr || 'N/A'})`,
  });

  res.json({ ok: true, status: payment.status });
}));

/** Issue #107: the booth passes the complete quote object. */
router.post('/checkout/free-complete', authenticateDevice, asyncRoute(async (req, res) => {
  const { device, organization } = await requireOperationalBooth(req);
  const quote = req.body && req.body.quote;
  if (!quote || typeof quote !== 'object') {
    throw badRequest('The complete quote object is required to complete a free checkout.', 'QUOTE_REQUIRED');
  }
  const amount = Math.round(Number(quote.finalAmount) || 0);

  const payment = await Payment.create({
    organizationId: organization._id,
    eventId: quote.eventId || device.assignedEventId || null,
    deviceId: device._id,
    sessionId: quote.sessionId || null,
    razorpayOrderId: `free_${crypto.randomUUID()}`,
    amount,
    currency: 'INR',
    printCount: Math.max(1, Number(quote.prints) || 1),
    digitalCopy: quote.digitalCopy !== false,
    couponCode: quote.couponCode || null,
    discountApplied: Number(quote.discount) || 0,
    settlement: 'wallet',
    status: 'paid',
    paidAt: new Date(),
  });

  await recordCouponRedemption(payment);
  res.json({ success: true, paymentId: String(payment._id), amount: payment.amount, printCount: payment.printCount });
}));

// ================================================================
// SESSION COMPLETION + GALLERY CONSENT  (#60, #61, #18)
// ================================================================

router.post('/sessions/complete', authenticateDevice, asyncRoute(async (req, res) => {
  const { device, organization } = await requireOperationalBooth(req);
  const sessionId = String(req.body.sessionId || '').trim();
  if (!sessionId) throw badRequest('sessionId is required.', 'BAD_SESSION');
  const digitalCopy = req.body.digitalCopy !== false;

  device.telemetry = device.telemetry || {};
  device.telemetry.prints = (Number(device.telemetry.prints) || 0) + 1;
  device.telemetry.updatedAt = new Date();
  await device.save();

  const settings = await getGallerySettings();
  const consent = req.body.guestConsent === true || (req.body.consent && req.body.consent.publish === true);
  let eventId = req.body.eventId || device.assignedEventId || null;
  // If not provided on device or payload, auto-link to the organization's current active event
  if (!eventId) {
    const activeEvent = await Event.findOne({
      organizationId: organization._id,
      status: { $ne: 'cancelled' },
    }).sort({ startDate: -1, createdAt: -1 });
    if (activeEvent) {
      eventId = activeEvent._id;
      device.assignedEventId = activeEvent._id;
      await device.save().catch(() => {});
    }
  } else if (!device.assignedEventId && mongoose.Types.ObjectId.isValid(eventId)) {
    device.assignedEventId = eventId;
    await device.save().catch(() => {});
  }
  const submitted = Array.isArray(req.body.photos) ? req.body.photos.slice(0, 40) : [];
  // The final composited output (print strip/page), when the booth sends it
  // separately from the individual frames.
  const submittedComposite = typeof req.body.compositeUrl === 'string' ? req.body.compositeUrl
    : typeof req.body.composite === 'string' ? req.body.composite
    : (req.body.composite && (req.body.composite.url || req.body.composite.dataUrl)) || null;

  const stored = [];
  const storedRecords = [];
  const skipped = [];
  for (const photo of submitted) {
    const raw = typeof photo === 'string' ? photo : photo && (photo.url || photo.dataUrl);
    if (!raw) continue;
    const saved = await persistSessionPhoto(String(raw), { organizationId: organization._id, eventId, sessionId });
    if (!saved || !saved.url) {
      skipped.push('photo could not be stored');
      continue;
    }
    const isComposite = photo && typeof photo === 'object' && photo.isComposite === true;
    const record = await Photo.create({
      organizationId: organization._id,
      eventId,
      deviceId: device._id,
      s3Key: saved.key || s3KeyFromUrl(saved.url) || '',
      url: saved.url,
      // Photo.compositeUrl is a real schema field now — previously this was
      // silently dropped and the gallery could only show raw frames.
      compositeUrl: isComposite ? saved.url : null,
      sessionId,
      guestConsent: consent,
      generatedAt: new Date(),
      finalised: true,
    });
    storedRecords.push(record);
    if (photoVisibleInGallery(record, settings)) stored.push(String(record._id));
  }

  // Persist a separately-submitted composite and attach it to the session's
  // records so gallery + guest download lead with the final print image.
  let compositeUrl = null;
  if (submittedComposite) {
    const savedComposite = await persistSessionPhoto(String(submittedComposite), { organizationId: organization._id, eventId, sessionId });
    if (savedComposite && savedComposite.url) {
      compositeUrl = savedComposite.url;
      if (storedRecords.length > 0) {
        await Photo.updateMany(
          { _id: { $in: storedRecords.map((record) => record._id) } },
          { $set: { compositeUrl } },
        );
      } else {
        const record = await Photo.create({
          organizationId: organization._id,
          eventId,
          deviceId: device._id,
          s3Key: savedComposite.key || s3KeyFromUrl(savedComposite.url) || '',
          url: savedComposite.url,
          compositeUrl,
          sessionId,
          guestConsent: consent,
          generatedAt: new Date(),
          finalised: true,
        });
        storedRecords.push(record);
        if (photoVisibleInGallery(record, settings)) stored.push(String(record._id));
      }
    }
  }
  if (!compositeUrl) {
    const compositeRecord = storedRecords.find((record) => record.compositeUrl);
    compositeUrl = compositeRecord ? compositeRecord.compositeUrl : null;
  }

  // Digital copy: one 24-hour download link per session. The booth shows
  // its QR on the success screen (existing behaviour renders `shareUrl`);
  // the guest lands on the display website's hidden /download/:id page.
  let guestDownload = null;
  if (digitalCopy && storedRecords.length > 0) {
    const event = eventId ? await Event.findById(eventId).select('name').lean().catch(() => null) : null;
    guestDownload = await createGuestDownload({
      organizationId: organization._id,
      eventId,
      deviceId: device._id,
      sessionId,
      compositeUrl,
      photoUrls: storedRecords.map((record) => record.url),
      photoIds: storedRecords.map((record) => record._id),
      eventName: event ? event.name : '',
      organizationName: organization.name || '',
    }).catch((error) => {
      console.error('⚠️ Could not create guest download:', error.message);
      return null;
    });
  }

  await writeAudit({
    organizationId: organization._id, actorId: null, actorName: 'Booth',
    action: 'booth.session.completed', entity: 'session',
    summary: `Session ${sessionId} completed on ${device.deviceName}${settings.requireGuestConsent ? ` — guest consent ${consent ? 'given' : 'not given'}` : ''}`,
  });

  const downloadUrl = guestDownload ? downloadUrlFor(guestDownload.downloadId) : null;
  res.json({
    // `shareUrl` stays the booth contract (Success screen QR). It now points
    // at the real, expiring download page instead of a guessed /share path.
    shareUrl: downloadUrl,
    downloadUrl,
    downloadId: guestDownload ? guestDownload.downloadId : null,
    downloadExpiresAt: guestDownload ? guestDownload.expiresAt : null,
    galleryEnabled: settings.galleryEnabled,
    requireGuestConsent: settings.requireGuestConsent,
    guestConsent: consent,
    galleryPhotoIds: stored,
    photosStored: storedRecords.length,
    photosVisibleInGallery: stored.length,
    photosSkipped: skipped.length,
  });
}));

/**
 * Session photos arrive as data URLs or remote URLs from the booth.
 * With AWS S3 configured they are uploaded and the stored S3 URL + key is kept
 * (this is what the CRM gallery and digital share use).
 */
const INLINE_PHOTO_MAX_CHARS = 25 * 1024 * 1024;
async function persistSessionPhoto(value, { organizationId, eventId, sessionId }) {
  if (!value || typeof value !== 'string') return null;

  const s3Ready = Boolean(process.env.S3_BUCKET_NAME && process.env.AWS_REGION);

  // 1. Data URLs (e.g. from camera capture or canvas composite)
  if (value.startsWith('data:')) {
    const commaIndex = value.indexOf(',');
    if (commaIndex === -1) return null;
    const header = value.slice(0, commaIndex);
    const base64Data = value.slice(commaIndex + 1).replace(/\s/g, '');
    const mimeMatch = header.match(/^data:([^;]+);base64/);
    const mimetype = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = mimetype.includes('png') ? 'png' : 'jpg';

    if (s3Ready) {
      try {
        const buffer = Buffer.from(base64Data, 'base64');
        const uploadResult = await uploadToS3({
          buffer,
          mimetype,
          folder: `photos/${organizationId}/${eventId || 'no-event'}`,
          originalname: `${sessionId}-${Date.now()}.${ext}`,
        });
        return { url: uploadResult.url, key: uploadResult.key };
      } catch (err) {
        console.error('⚠️ S3 upload failed for session photo data URL:', err.message);
      }
    }
    return value.length <= INLINE_PHOTO_MAX_CHARS ? { url: value, key: '' } : null;
  }

  // 2. HTTP/HTTPS URLs (e.g. demo palette photos or pre-uploaded images)
  if (value.startsWith('http://') || value.startsWith('https://')) {
    let parsedUrl;
    try {
      parsedUrl = new URL(value);
    } catch {
      return null;
    }

    // SSRF Protection: Block private IPs, AWS metadata (169.254), loopback (127.0.0.1, localhost)
    const hostname = parsedUrl.hostname.toLowerCase();
    const isPrivateOrLoopback =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local');

    if (isPrivateOrLoopback) {
      console.warn('⚠️ Blocked SSRF attempt to internal/loopback address in session photo:', hostname);
      return null;
    }

    if (process.env.S3_BUCKET_NAME && value.includes(process.env.S3_BUCKET_NAME)) {
      return { url: value, key: s3KeyFromUrl(value) || '' };
    }
    if (s3Ready) {
      try {
        const resp = await fetch(value, { signal: AbortSignal.timeout(10000) });
        if (resp.ok) {
          const arrayBuffer = await resp.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mimetype = resp.headers.get('content-type') || 'image/jpeg';
          const ext = mimetype.includes('png') ? 'png' : 'jpg';
          const uploadResult = await uploadToS3({
            buffer,
            mimetype,
            folder: `photos/${organizationId}/${eventId || 'no-event'}`,
            originalname: `${sessionId}-${Date.now()}.${ext}`,
          });
          return { url: uploadResult.url, key: uploadResult.key };
        }
      } catch (err) {
        console.warn('Could not re-upload external image to S3, using source URL:', err.message);
      }
    }
    return { url: value, key: '' };
  }

  return null;
}

/** Explicit consent endpoint for booths that ask before finishing. */
router.post('/sessions/consent', authenticateDevice, asyncRoute(async (req, res) => {
  const { device, organization } = await requireOperationalBooth(req);
  const sessionId = String(req.body.sessionId || '').trim();
  if (!sessionId) throw badRequest('sessionId is required.', 'BAD_SESSION');
  const consent = req.body.allow === true;
  const result = await Photo.updateMany({ organizationId: organization._id, sessionId }, { $set: { guestConsent: consent } });
  const settings = await getGallerySettings();
  res.json({
    ok: true,
    updated: result.modifiedCount || 0,
    guestConsent: consent,
    galleryEnabled: settings.galleryEnabled,
    requireGuestConsent: settings.requireGuestConsent,
    visibleInGallery: settings.galleryEnabled && (!settings.requireGuestConsent || consent),
    device: String(device._id),
  });
}));

// Guest support ticket raised from the booth (kept from the v1 booth contract —
// the electron and client-app booth apps call POST /api/booth/support).
router.post('/support', authenticateDevice, asyncRoute(async (req, res) => {
  const { name, email, subject, message, category, sessionId, paymentReference } = req.body || {};
  const ticket = new SupportTicket({
    ticketType: 'end_user',
    name: (name || 'Booth Guest').trim(),
    email: (email || 'guest@happypix.in').trim().toLowerCase(),
    subject: (subject || `Issue reported from ${category || 'Booth'}`).trim(),
    message: (message || 'No description provided.').trim(),
    organizationId: req.organization._id,
    eventId: req.device.assignedEventId || null,
    deviceId: req.device._id,
    sessionId: sessionId || null,
    paymentReference: paymentReference || null,
    holdPhotos: Boolean(sessionId),
  });
  await ticket.save();
  res.status(201).json({ success: true, ticketId: ticket._id.toString() });
}));

export default router;
