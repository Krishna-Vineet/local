import express from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import Device from '../models/Device.js';
import Organization from '../models/Organization.js';
import OrganizationDefaults from '../models/OrganizationDefaults.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Photo from '../models/Photo.js';
import Template from '../models/Template.js';
import Payment from '../models/Payment.js';
import Coupon from '../models/Coupon.js';
import Ticket from '../models/Ticket.js';
import PhotoShare from '../models/PhotoShare.js';
import { uploadToS3 } from '../utils/s3.js';
import { effectiveLayoutPrices, resolvePlanContext } from '../lib/planService.js';
import { computeEventStatus, roleLabel, safeMediaUrl, safeStr, writeAudit } from '../lib/helpers.js';
import { TICKET_CATEGORIES } from '../lib/constants.js';
import { PRICE_KEY, layoutById, slotsForLayout, suggestedPriceMap } from '../lib/layouts.js';

const router = express.Router();

// Multer-style base64 photo upload limit (10 MB decoded)
const MAX_BASE64_BYTES = 10 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// Middleware: booth authentication (Authorization: Device <token> + X-Device-UUID)
// ─────────────────────────────────────────────────────────────────────────────
export const authenticateBooth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Device ')) {
      return res.status(401).json({ error: 'Device token required.' });
    }
    const token = authHeader.substring(7).trim();
    const deviceUuid = req.headers['x-device-uuid'];

    const device = await Device.findOne({ deviceToken: token, deviceUuid });
    if (!device) {
      return res.status(401).json({ error: 'Invalid or inactive device.' });
    }
    if (device.status !== 'active') {
      return res.status(401).json({ error: 'This booth has been deactivated. Contact your administrator.' });
    }

    const org = await Organization.findById(device.organizationId);
    if (!org) return res.status(403).json({ error: 'Organization not found. Contact support.' });
    if (org.status === 'banned') {
      return res.status(403).json({ error: 'Your account has been banned. Please contact HappyPix support.' });
    }
    // suspended orgs: the booth may connect in read-only mode — controllers
    // decide based on the snapshot's event status.

    req.device = device;
    req.organization = org;
    next();
  } catch (error) {
    console.error('Booth auth error:', error.message);
    res.status(500).json({ error: 'Authentication failed.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Template + snapshot builders
// ─────────────────────────────────────────────────────────────────────────────

function mapTemplate(t) {
  const layout = layoutById(t.layoutId) || { id: t.layoutId || '46-v1', familyId: '46', orientation: 'portrait', slots: 1, cutout: [4, 6], sheets: ['4x6'], canvas: { w: 1000, h: 1500 } };
  const printSize = layout.cutout ? `${layout.cutout[0]} × ${layout.cutout[1]}` : '4 × 6';
  const { canvas, photoSlots, footer } = slotsForLayout(t.layoutId);
  const canvasPx = { width: canvas.w, height: canvas.h };

  let bg = t.design?.bg || t.design?.background || { type: 'solid', colors: ['#ffffff'] };
  if (typeof bg === 'string') {
    if (bg.startsWith('http') || bg.startsWith('data:')) {
      bg = { type: 'image', colors: [], url: bg };
    } else {
      bg = { type: 'solid', colors: [bg] };
    }
  } else if (bg && !bg.type) {
    bg = { type: 'solid', colors: bg.colors || ['#ffffff'] };
  }

  return {
    id: t._id.toString(),
    name: t.name || 'Custom Template',
    category: t.category || 'Custom',
    description: t.description || `${printSize} ${layout.slots}-photo ${layout.orientation}`,
    source: t.source || 'designer',
    componentId: t.componentId || undefined,
    active: t.active ?? true,
    layout: {
      id: t.layoutId,
      familyId: layout.familyId,
      label: `${printSize} · ${layout.slots} photo${layout.slots === 1 ? '' : 's'}`,
      printSize,
      sheetSize: (layout.sheets && layout.sheets[0]) || printSize,
      orientation: layout.orientation,
      slots: layout.slots,
      canvas: canvasPx,
      photoSlots,
      footer,
    },
    design: {
      background: bg,
      accent: t.design?.accent || '#ff4f9a',
      textColor: t.design?.textColor || '#000000',
      ornament: t.design?.ornament || 'none',
      font: t.design?.font || 'sans',
      slotShape: t.design?.slotShape || 'square',
      title: t.design?.title || 'HappyPix',
      subtitle: t.design?.subtitle || t.design?.tagline || '',
    },
  };
}

async function buildSnapshot(device, org) {
  const defaults = await OrganizationDefaults.findOne({ organizationId: org._id }).lean();
  const now = new Date();

  let eventPayload = null;
  if (device.assignedEventId) {
    const event = await Event.findById(device.assignedEventId).populate('templateIds').lean();
    if (event) {
      const prices = effectiveLayoutPrices(defaults, event.layoutPrices, { suggested: suggestedPriceMap() });
      const templates = (event.templateIds || []).filter((t) => t && t._id);

      eventPayload = {
        id: event._id.toString(),
        organizationId: org._id.toString(),
        name: event.name,
        clientName: event.clientName || '',
        location: event.location || '',
        startDate: event.startDate,
        endDate: event.endDate,
        // Booth only serves guests while the event is genuinely live.
        status: computeEventStatus(event, now) === 'active' ? 'live' : computeEventStatus(event, now),
        digitalCopy: event.digitalCopy ?? true,
        filters: event.filters?.length ? event.filters : ['original'],
        branding: {
          logos: (event.branding?.logos || []).map((src) => safeMediaUrl(src)).filter(Boolean),
          tagline: event.branding?.tagline || '',
        },
        layoutPrices: prices,
        templates: templates.map(mapTemplate),
        revision: event.updatedAt?.toISOString() || now.toISOString(),
        templateContractVersion: 1,
      };
    }
  }

  return {
    device: { id: device._id.toString(), name: device.deviceName, uuid: device.deviceUuid },
    organization: { id: org._id.toString(), name: org.name || 'Organization' },
    event: eventPayload,
    settings: {
      organizationName: org.name || 'HappyPix Org',
      boothTimeoutSec: defaults?.boothTimeoutSec ?? 90,
      payoutMode: defaults?.payoutMode === 'upi' ? 'upi' : 'wallet',
      upiId: defaults?.upiId || null,
      paymentDisplayName: org.name || 'HappyPix',
      currency: 'INR',
      maximumPrints: 10,
    },
    revision: eventPayload ? eventPayload.revision : now.toISOString(),
    serverTime: now.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/booth/login — pair a booth with org credentials
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, deviceUuid, deviceName, location, platform, appVersion } = req.body || {};

    if (!email || !password || !deviceUuid) {
      return res.status(400).json({ error: 'Email, password and deviceUuid are required.' });
    }

    const admin = await User.findOne({ email: String(email).toLowerCase().trim(), role: { $in: ['ORG_ADMIN', 'ORG_MANAGER'] } });
    if (!admin || admin.status !== 'active') return res.status(401).json({ error: 'Invalid admin credentials.' });

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid admin credentials.' });

    const org = await Organization.findById(admin.organizationId);
    if (!org) return res.status(403).json({ error: 'Organization not found.' });
    if (org.status === 'banned') {
      return res.status(403).json({ error: 'Your account has been banned. Please contact HappyPix support.' });
    }

    // Enforce the plan device limit before linking/creating a device
    const { summary } = await resolvePlanContext(org);
    let device = await Device.findOne({ deviceUuid, organizationId: org._id });
    if (!device) {
      const foreign = await Device.findOne({ deviceUuid });
      if (!foreign && summary.deviceLimit >= 0) {
        const count = await Device.countDocuments({ organizationId: org._id, status: { $ne: 'blocked' } });
        if (count >= summary.deviceLimit) {
          return res.status(403).json({
            error: `Device limit reached for the ${summary.planName} plan (max ${summary.deviceLimit}). Upgrade to add more devices.`,
          });
        }
      }
      if (foreign) {
        // Physical booth re-paired to a different organization: transfer it.
        if (foreign.status === 'blocked') {
          return res.status(403).json({ error: 'This booth has been blocked. Contact HappyPix support.' });
        }
        await Event.updateMany(
          { assignedDeviceIds: foreign._id },
          { $pull: { assignedDeviceIds: foreign._id } }
        );
        device = foreign;
        device.organizationId = org._id;
        device.assignedEventId = null;
      } else {
        device = new Device({
          organizationId: org._id,
          deviceUuid,
          deviceName: deviceName || 'New Booth',
          location: location?.label || '',
          deviceToken: Device.generateToken(),
          platform,
          appVersion,
          status: 'active',
        });
      }
    }

    if (device.status === 'blocked') {
      return res.status(403).json({ error: 'This booth has been blocked. Contact your administrator.' });
    }

    // Rotate the token on every pairing (the previous token becomes invalid).
    device.deviceToken = Device.generateToken();
    device.platform = platform;
    device.appVersion = appVersion;
    await device.save();

    const installation = {
      deviceUuid: device.deviceUuid,
      deviceToken: device.deviceToken,
      deviceId: device._id.toString(),
      organizationId: org._id.toString(),
      pairedAt: new Date().toISOString(),
      locationLabel: location?.label || '',
    };

    await writeAudit({
      actorId: admin._id,
      organizationId: org._id,
      action: 'booth.paired',
      entity: 'device',
      summary: `Booth "${device.deviceName}" paired by ${admin.name}`,
    });

    const snapshot = await buildSnapshot(device, org);
    res.json({ installation, snapshot });
  } catch (error) {
    console.error('Booth login error:', error.message);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/booth/bootstrap — full snapshot on startup
// ─────────────────────────────────────────────────────────────────────────────
router.get('/bootstrap', authenticateBooth, async (req, res) => {
  try {
    const snapshot = await buildSnapshot(req.device, req.organization);
    res.json(snapshot);
  } catch (error) {
    console.error('Booth bootstrap error:', error.message);
    res.status(500).json({ error: 'Bootstrap failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/booth/heartbeat — telemetry + snapshot refresh
// ─────────────────────────────────────────────────────────────────────────────
const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));

router.post('/heartbeat', authenticateBooth, async (req, res) => {
  try {
    const device = req.device;
    const now = new Date();

    device.lastSeenAt = now;
    device.ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
    device.userAgent = req.headers['user-agent'] || null;

    const hw = req.body?.hardware;
    if (hw) {
      const prev = device.telemetry || {};
      device.telemetry = {
        prints: hw.printer?.printsTotal != null ? clampInt(hw.printer.printsTotal, 0, 10_000_000) : (prev.prints || 0),
        shutters: hw.camera?.shutterCount != null ? clampInt(hw.camera.shutterCount, 0, 10_000_000) : (prev.shutters || 0),
        batteryPct: hw.camera?.batteryPct != null ? clampInt(hw.camera.batteryPct, 0, 100) : (prev.batteryPct ?? 100),
        updatedAt: now,
      };
      device.connections = {
        camera: hw.camera?.connected === true,
        printer: hw.printer?.connected === true,
        kioskScreen: hw.kioskScreen?.connected === true,
        updatedAt: now,
      };
    }
    await device.save();

    // Only ship a new snapshot when the event configuration changed.
    const snapshot = await buildSnapshot(device, req.organization);
    const known = req.body?.knownRevision;
    const changed = !known || known !== snapshot.revision;
    res.json({ changed, snapshot: changed ? snapshot : undefined });
  } catch (error) {
    console.error('Booth heartbeat error:', error.message);
    res.status(500).json({ error: 'Heartbeat failed.' });
  }
});

// Legacy telemetry push route (CRM v2.1 contract: /api/booth/devices/:uuid/telemetry)
router.post('/devices/:deviceUuid/telemetry', authenticateBooth, async (req, res) => {
  try {
    if (req.params.deviceUuid !== req.device.deviceUuid) {
      return res.status(403).json({ error: 'Telemetry can only be pushed for this device.' });
    }
    const b = req.body || {};
    const now = new Date();
    const prev = req.device.telemetry || {};
    req.device.telemetry = {
      prints: b.printsTotal != null ? clampInt(b.printsTotal, 0, 10_000_000) : (prev.prints || 0),
      shutters: b.shutterCount != null ? clampInt(b.shutterCount, 0, 10_000_000) : (prev.shutters || 0),
      batteryPct: b.batteryPct != null ? clampInt(b.batteryPct, 0, 100) : (prev.batteryPct ?? 100),
      updatedAt: now,
    };
    if (b.connections && typeof b.connections === 'object') {
      req.device.connections = {
        camera: b.connections.camera === true,
        printer: b.connections.printer === true,
        kioskScreen: b.connections.kioskScreen === true,
        updatedAt: now,
      };
    }
    req.device.lastSeenAt = now;
    await req.device.save();
    res.json({ ok: true, telemetry: req.device.telemetry, connections: req.device.connections });
  } catch (error) {
    res.status(500).json({ error: 'Telemetry update failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Coupon validation + server-side discount computation (P0 SEC-07)
// ─────────────────────────────────────────────────────────────────────────────
async function validateAndApplyCoupon(orgId, eventId, code, gross) {
  if (!code) return { discount: 0, validCoupon: null, couponMessage: null };
  const clean = String(code).trim().toUpperCase();

  const coupon = await Coupon.findOne({ organizationId: orgId, code: clean, status: 'active' });
  if (!coupon) {
    const err = new Error('That coupon is invalid, expired, exhausted, or not available for this event.');
    err.status = 400;
    throw err;
  }
  if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate).setHours(23, 59, 59, 999)) {
    const err = new Error('That coupon has expired.');
    err.status = 400;
    throw err;
  }
  if ((coupon.usedCount || 0) >= coupon.quantity) {
    const err = new Error('That coupon has been fully redeemed.');
    err.status = 400;
    throw err;
  }
  const eventIds = (coupon.eventIds || []).map(String);
  if (eventIds.length && eventId && !eventIds.includes(String(eventId))) {
    const err = new Error('That coupon is not valid for the current event.');
    err.status = 400;
    throw err;
  }

  let discount;
  if (coupon.type === 'percentage') {
    discount = Math.round(gross * (coupon.value / 100));
    return { discount, validCoupon: clean, couponMessage: `${clean} applied · ${coupon.value}% off`, coupon };
  }
  discount = Math.min(Math.round(coupon.value), gross);
  return { discount, validCoupon: clean, couponMessage: `${clean} applied · ₹${coupon.value} off`, coupon };
}

async function incrementCouponUsage(couponCode, orgId) {
  if (!couponCode) return;
  try {
    await Coupon.updateOne(
      { organizationId: orgId, code: String(couponCode).toUpperCase() },
      { $inc: { usedCount: 1 } }
    );
  } catch (err) {
    console.error('Failed to increment coupon usage:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/booth/checkout/quote — server-computed pricing
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/quote', authenticateBooth, async (req, res) => {
  try {
    const { eventId, templateId, layoutId, prints, digitalCopy, couponCode } = req.body || {};
    if (!eventId || !templateId || !layoutId || !prints) {
      return res.status(400).json({ error: 'eventId, templateId, layoutId and prints are required.' });
    }
    const event = await Event.findById(eventId).populate('templateIds');
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    if (String(event.organizationId) !== String(req.organization._id)) {
      return res.status(403).json({ error: 'Event not available for this organization.' });
    }
    if (computeEventStatus(event) !== 'active') {
      return res.status(409).json({ error: 'This event is not currently active.' });
    }

    const template = event.templateIds.find((t) => t._id.toString() === templateId);
    if (!template || template.layoutId !== layoutId) {
      return res.status(400).json({ error: 'Template not available for this event.' });
    }
    if (template.active === false) {
      return res.status(400).json({ error: 'This template has been disabled by the platform.' });
    }

    const layout = layoutById(layoutId);
    if (!layout) return res.status(400).json({ error: 'Unknown layout.' });
    const priceKey = PRICE_KEY(layout.familyId, layout.slots);

    const defaults = await OrganizationDefaults.findOne({ organizationId: req.organization._id }).lean();
    const prices = effectiveLayoutPrices(defaults, event.layoutPrices, { suggested: suggestedPriceMap() });
    let unitPrice = prices[priceKey];
    if (typeof unitPrice !== 'number') unitPrice = event.printPrice ?? 0;
    if (unitPrice == null) unitPrice = 0;

    const printCount = clampInt(prints, 1, 10);
    const gross = Math.round(unitPrice * printCount);

    const { discount, validCoupon, couponMessage } = await validateAndApplyCoupon(
      req.organization._id, eventId, couponCode, gross
    );

    const finalAmount = Math.max(0, gross - discount);
    const payoutMode = defaults?.payoutMode === 'upi' ? 'upi' : 'wallet';

    res.json({
      quoteId: `quote-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      unitPrice,
      prints: printCount,
      gross,
      discount,
      finalAmount,
      couponCode: validCoupon,
      couponMessage,
      settlement: payoutMode,
      expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Booth quote error:', error.message);
    res.status(500).json({ error: 'Failed to generate quote' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay helpers
// ─────────────────────────────────────────────────────────────────────────────
function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
}

async function createRazorpayPaymentLink(rzp, amountInPaise, eventId, orderId) {
  // 1) Try a UPI QR (single-use, fixed amount) → its image_url is a hosted
  //    PNG we cannot return as `qrPayload`; instead we rely on the payment
  //    link whose short_url IS QR-encodable by the booth renderer.
  // 2) Payment link (hosted page, works with every UPI app + cards).
  try {
    const pl = await rzp.paymentLink.create({
      amount: amountInPaise,
      currency: 'INR',
      accept_partial: false,
      description: 'HappyPix Booth Prints',
      reference_id: orderId,
      notes: { eventId: String(eventId || ''), orderId },
    });
    return { paymentLinkId: pl.id, paymentLinkUrl: pl.short_url };
  } catch (err) {
    console.error('Razorpay payment link creation failed:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/booth/payments — create a real payment order + payable QR payload
// ─────────────────────────────────────────────────────────────────────────────
router.post('/payments', authenticateBooth, async (req, res) => {
  try {
    const quote = req.body?.quote;
    if (!quote || quote.finalAmount === undefined) {
      return res.status(400).json({ error: 'Quote required.' });
    }
    if (!(quote.finalAmount > 0)) {
      return res.status(400).json({ error: 'Free checkouts must use the free completion endpoint.' });
    }

    const rzp = getRazorpayInstance();
    if (!rzp) {
      return res.status(503).json({ error: 'Payments are not configured on the server (missing Razorpay keys). Contact HappyPix support.' });
    }

    const amountInPaise = Math.round(Number(quote.finalAmount) * 100);
    const order = await rzp.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `hp_${Date.now()}`,
      notes: {
        eventId: String(quote.eventId || req.device.assignedEventId || ''),
        deviceId: String(req.device._id),
        printCount: String(quote.prints ?? 1),
      },
    });

    const link = await createRazorpayPaymentLink(rzp, amountInPaise, req.device.assignedEventId, order.id);
    if (!link) {
      return res.status(502).json({ error: 'The payment provider rejected this order. Please try again.' });
    }

    const defaults = await OrganizationDefaults.findOne({ organizationId: req.organization._id }).lean();
    const settlement = defaults?.payoutMode === 'upi' ? 'upi' : 'wallet';

    const payment = new Payment({
      organizationId: req.organization._id,
      deviceId: req.device._id,
      eventId: req.device.assignedEventId,
      razorpayOrderId: order.id,
      paymentLinkId: link.paymentLinkId,
      paymentLinkUrl: link.paymentLinkUrl,
      amount: Number(quote.finalAmount),
      currency: 'INR',
      printCount: quote.prints ?? 1,
      digitalCopy: quote.digitalCopy !== false,
      couponCode: quote.couponCode || null,
      discountApplied: quote.discount || 0,
      settlement,
      status: 'created',
    });
    await payment.save();

    res.json({
      paymentId: payment._id.toString(),
      amount: payment.amount,
      qrPayload: link.paymentLinkUrl,
      status: 'pending',
    });
  } catch (error) {
    console.error('Booth payment create error:', error.message);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/booth/payments/:id — poll the payment provider (NO auto-pay mocks)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/payments/:id', authenticateBooth, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      $or: [
        { deviceId: req.device._id },
        { organizationId: req.organization._id },
      ],
    });
    if (!payment) return res.status(404).json({ error: 'Not found' });

    if (payment.status === 'paid') return res.json({ status: 'paid' });
    if (payment.status === 'failed') return res.json({ status: 'failed' });

    const rzp = getRazorpayInstance();
    if (!rzp) return res.status(503).json({ error: 'Payments are not configured on the server.' });

    let isPaid = false;
    try {
      if (payment.paymentLinkId) {
        const pl = await rzp.paymentLink.fetch(payment.paymentLinkId);
        if (pl.status === 'paid') isPaid = true;
      } else if (payment.razorpayOrderId) {
        const payments = await rzp.orders.fetchPayments(payment.razorpayOrderId);
        if (payments?.items?.some((p) => p.status === 'captured' || p.status === 'authorized')) isPaid = true;
      }
    } catch (err) {
      console.error('Razorpay status check failed:', err.message);
      return res.json({ status: 'pending' });
    }

    if (isPaid) {
      payment.status = 'paid';
      payment.paidAt = new Date();
      await payment.save();
      await incrementCouponUsage(payment.couponCode, payment.organizationId);
      return res.json({ status: 'paid' });
    }

    res.json({ status: 'pending' });
  } catch (error) {
    console.error('Booth payment status error:', error.message);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/booth/checkout/free-complete — ₹0 orders (and offline UPI + UTR)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/free-complete', authenticateBooth, async (req, res) => {
  try {
    const { quote, utr } = req.body || {};
    const q = quote || {};

    // Offline UPI payments (amount > 0) must carry a 12-digit UTR.
    if (Number(q.finalAmount) > 0) {
      if (!utr || !/^\d{12}$/.test(utr)) {
        return res.status(400).json({ error: 'UPI Ref No. (UTR) is required for direct UPI payments.' });
      }
      const existing = await Payment.findOne({ utr, status: 'paid' });
      if (existing) return res.status(400).json({ error: 'This UTR has already been used for a payment.' });
    }

    const defaults = await OrganizationDefaults.findOne({ organizationId: req.organization._id }).lean();
    const settlement = defaults?.payoutMode === 'upi' ? 'upi' : 'wallet';

    const payment = new Payment({
      organizationId: req.organization._id,
      deviceId: req.device._id,
      eventId: req.device.assignedEventId,
      razorpayOrderId: Number(q.finalAmount) > 0 ? `upi_${Date.now()}` : `free_${Date.now()}`,
      amount: Number(q.finalAmount) || 0,
      currency: 'INR',
      printCount: q.prints ?? 1,
      digitalCopy: q.digitalCopy !== false,
      couponCode: q.couponCode || null,
      discountApplied: q.discount || 0,
      utr: utr || null,
      settlement,
      status: 'paid',
      paidAt: new Date(),
    });
    await payment.save();
    await incrementCouponUsage(payment.couponCode, payment.organizationId);

    res.json({ success: true, paymentId: payment._id });
  } catch (error) {
    console.error('Booth free-complete error:', error.message);
    res.status(500).json({ error: 'Failed to complete free checkout' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/booth/upload — upload a capture/composite for a session
// multipart (photo) or JSON { photoBase64, eventId, sessionId, isComposite,
// guestConsent, filename }. Device-scoped, org/event/session-aware S3 path.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload', authenticateBooth, express.json({ limit: '12mb' }), async (req, res) => {
  try {
    let fileBuffer;
    let mimeType = 'image/png';
    let originalName = 'capture.png';

    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
      originalName = req.file.originalname;
    } else if (req.body?.photoBase64) {
      const matches = String(req.body.photoBase64).match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: 'Invalid base64 image data format.' });
      fileBuffer = Buffer.from(matches[2], 'base64');
      if (fileBuffer.length > MAX_BASE64_BYTES) return res.status(413).json({ error: 'Image exceeds the 10 MB limit.' });
      mimeType = matches[1];
      originalName = req.body.filename || (req.body.isComposite === true ? 'composite.png' : 'capture.png');
    } else {
      return res.status(400).json({ error: 'No photo provided.' });
    }

    const eventId = req.body?.eventId || req.device.assignedEventId || 'no-event';
    const sessionId = req.body?.sessionId || `session-${Date.now()}`;
    const isComposite = req.body?.isComposite === true || req.body?.isComposite === 'true';

    const folder = `happypix/${req.organization._id}/${eventId}/${sessionId}`;
    const uploaded = await uploadToS3({ buffer: fileBuffer, mimetype: mimeType, folder, originalname: originalName });
    const url = uploaded.url;

    const photo = new Photo({
      organizationId: req.organization._id,
      eventId: eventId && mongoose.Types.ObjectId.isValid(eventId) ? eventId : undefined,
      deviceId: req.device._id,
      sessionId,
      s3Key: uploaded.key,
      url,
      compositeUrl: isComposite ? url : null,
      guestConsent: req.body?.guestConsent === true || req.body?.guestConsent === 'true',
      capturedAt: new Date(),
    });
    await photo.save();

    res.status(201).json({
      message: 'Upload successful',
      url,
      id: photo._id,
      isComposite,
    });
  } catch (error) {
    console.error('Booth upload error:', error.message);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/booth/sessions/complete — finalize a guest session
// Body: { sessionId, digitalCopy, compositeUrl?, photoUrls?, guestConsent? }
// Generates a real PhotoShare token + share URL for the digital copy.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sessions/complete', authenticateBooth, async (req, res) => {
  try {
    const { sessionId, digitalCopy } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required.' });

    let shareUrl = null;

    if (digitalCopy) {
      const eventId = req.device.assignedEventId;
      const compositeUrl = safeMediaUrl(req.body?.compositeUrl);
      const photoUrls = (Array.isArray(req.body?.photoUrls) ? req.body.photoUrls : [])
        .map((u) => safeMediaUrl(u))
        .filter(Boolean);

      if (eventId && (compositeUrl || photoUrls.length)) {
        const event = await Event.findById(eventId);
        if (event && event.digitalCopy !== false) {
          const expirationDays = event.sharingConfig?.expirationDays || 7;
          const rawToken = crypto.randomBytes(32).toString('hex');

          await PhotoShare.create({
            eventId,
            organizationId: req.organization._id,
            tokenHash: rawToken,
            photoUrls,
            compositeUrl,
            expiresAt: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000),
            status: 'active',
          });

          const clientUrl = process.env.CLIENT_URL || 'https://happypix.vercel.app';
          shareUrl = `${clientUrl.replace(/\/$/, '')}/share/${rawToken}`;
        }
      }
    }

    res.json({ shareUrl });
  } catch (error) {
    console.error('Booth session complete error:', error.message);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/booth/tickets — guest support ticket raised at the booth
// (CRM v2.1 contract — full session context snapshot)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tickets', authenticateBooth, async (req, res) => {
  try {
    const b = req.body || {};
    const subject = safeStr(b.subject, 200);
    const session = b.session;
    if (!subject) return res.status(400).json({ error: 'Subject is required.' });
    if (!session || !session.phone) {
      return res.status(400).json({ error: 'Session context with the guest phone number is required.' });
    }

    const category = TICKET_CATEGORIES.includes(b.category) ? b.category : 'general';
    const priority = ['low', 'medium', 'high', 'urgent'].includes(b.priority) ? b.priority : 'medium';

    const sessionSnapshot = {
      ...session,
      eventId: b.eventId || req.device.assignedEventId || null,
      deviceId: b.deviceId || String(req.device._id),
    };

    const t = new Ticket({
      organizationId: req.organization._id,
      eventId: b.eventId || req.device.assignedEventId || null,
      deviceId: req.device._id,
      category,
      subject,
      priority,
      status: 'open',
      guest: {
        name: safeStr(b.guestName, 120) || 'Guest',
        contact: safeStr(session.phone, 20),
      },
      session: sessionSnapshot,
      messages: [
        { author: 'Guest (booth)', at: new Date(), text: safeStr(b.message, 2000) || subject },
      ],
    });
    await t.save();

    await writeAudit({
      organizationId: req.organization._id,
      action: 'ticket.created_from_booth',
      entity: 'ticket',
      summary: `Ticket "${t.subject}" raised from booth (session ${session.id || 'n/a'})`,
    });

    res.status(201).json({ ticket: { id: t._id, subject: t.subject, status: t.status } });
  } catch (error) {
    console.error('Booth ticket error:', error.message);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

export default router;
