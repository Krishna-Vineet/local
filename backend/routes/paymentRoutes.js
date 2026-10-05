import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import DigitalToken from '../models/DigitalToken.js';
import PhotoShare from '../models/PhotoShare.js';
import Setting from '../models/Setting.js';
import OrganizationDefaults from '../models/OrganizationDefaults.js';
import Event from '../models/Event.js';
import Coupon from '../models/Coupon.js';
import { printImage } from '../utils/printHelper.js';
import { safeMediaUrl } from '../lib/helpers.js';
import { suggestedPriceMap } from '../lib/layouts.js';
import { authenticateDevice } from '../middleware/deviceAuth.js';

const router = express.Router();

// Client URL for generating QR download links
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Helper: get settings for an organization with global fallback
const getSettingsForOrg = async (organizationId) => {
  if (organizationId) {
    const setting = await Setting.findOne({ organizationId });
    if (setting) return setting;
  }
  return await Setting.findOne({ organizationId: null });
};

// Helper: dynamic Razorpay credentials resolver
const getRazorpayConfig = async (orgId, eventId) => {
  let key_id = process.env.RAZORPAY_KEY_ID;
  let key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
    const event = await Event.findById(eventId);
    if (event && event.razorpayKeyId && event.razorpayKeySecret) {
      return { key_id: event.razorpayKeyId, key_secret: event.razorpayKeySecret };
    }
  }

  if (orgId) {
    const settings = await Setting.findOne({ organizationId: orgId });
    if (settings && settings.razorpayKeyId && settings.razorpayKeySecret) {
      key_id = settings.razorpayKeyId;
      key_secret = settings.razorpayKeySecret;
    }
  }

  return { key_id, key_secret };
};

// ─────────────────────────────────────────────────────────────
// Server-side pricing (P0 security fix: the client no longer
// decides how much to charge). Resolution order:
//   1. event.layoutPrices[layoutKey]  (CRM v2 events, optional key)
//   2. event.printPrice               (legacy events)
//   3. org default layout price       (CRM v2 org defaults, 4x6 single)
//   4. suggested catalogue price      (₹30 fallback)
// ─────────────────────────────────────────────────────────────
const resolveUnitPrice = (event, layoutKey, orgDefaults) => {
  if (layoutKey && event?.layoutPrices) {
    const fromMap = event.layoutPrices instanceof Map ? event.layoutPrices.get(layoutKey) : event.layoutPrices[layoutKey];
    if (typeof fromMap === 'number') return fromMap;
  }
  if (typeof event?.printPrice === 'number') return event.printPrice;

  const orgPrices = orgDefaults?.layoutPrices;
  const orgSingle = orgPrices instanceof Map ? orgPrices.get('46:1') : orgPrices?.['46:1'];
  if (typeof orgSingle === 'number') return orgSingle;

  return suggestedPriceMap()['46:1'];
};

// Validate a coupon against the REAL Coupon schema (status/quantity/
// usedCount/eventIds) and return the discount for a given gross amount.
const validateCouponForAmount = async (orgId, eventId, code, gross) => {
  if (!code) return { discount: 0 };
  const coupon = await Coupon.findOne({ organizationId: orgId, code: String(code).toUpperCase(), status: 'active' });
  if (!coupon) {
    const err = new Error('Invalid or inactive coupon');
    err.status = 400;
    throw err;
  }
  if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate).setHours(23, 59, 59, 999)) {
    const err = new Error('Coupon has expired');
    err.status = 400;
    throw err;
  }
  if ((coupon.usedCount || 0) >= coupon.quantity) {
    const err = new Error('Coupon usage limit reached');
    err.status = 400;
    throw err;
  }
  const eventIds = (coupon.eventIds || []).map(String);
  if (eventIds.length && eventId && !eventIds.includes(String(eventId))) {
    const err = new Error('This coupon is not valid for the current event');
    err.status = 400;
    throw err;
  }

  if (coupon.type === 'percentage') return Math.round(gross * (coupon.value / 100));
  return Math.min(Math.round(coupon.value), gross);
};

// Helper: Increment coupon usage
const incrementCouponUsage = async (couponCode, orgId) => {
  if (!couponCode) return;
  try {
    const orgFilter = orgId ? { organizationId: orgId } : {};
    await Coupon.updateOne(
      { ...orgFilter, code: couponCode.toUpperCase() },
      { $inc: { usedCount: 1 } }
    );
  } catch (err) {
    console.error('Failed to increment coupon usage:', err.message);
  }
};

// Helper: settlement route for new payments (wallet unless the org
// explicitly configured direct UPI payouts)
const settlementForOrg = async (orgId) => {
  if (!orgId) return 'wallet';
  const defaults = await OrganizationDefaults.findOne({ organizationId: orgId }).lean();
  return defaults?.payoutMode === 'upi' ? 'upi' : 'wallet';
};

// Helper: get client URL dynamically (resolves local IP if requested from external local network device)
const getClientUrl = (req) => {
  if (req && req.get('host')) {
    const requestHost = req.get('host'); // e.g. "192.168.31.225:5000"
    const ipOnly = requestHost.split(':')[0];

    // Check if it's an IPv4 address (e.g. 192.168.x.x)
    const isIpAddress = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ipOnly);

    if (isIpAddress && ipOnly !== '127.0.0.1') {
      return `http://${ipOnly}:5173`;
    }
  }

  // For production (Vercel) or localhost, always use the CLIENT_URL env var
  return process.env.CLIENT_URL || 'https://happypix.vercel.app';
};

// Helper: Generate a digital download token (24h expiry)
// ─────────────────────────────────────────────────────────────
const generateDigitalToken = async (paymentId, photoUrls, compositeUrl, req) => {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const digitalToken = new DigitalToken({
    token,
    paymentId: paymentId || null,
    photoUrls: photoUrls || [],
    compositeUrl: compositeUrl || null,
    expiresAt,
  });
  await digitalToken.save();

  const activeClientUrl = getClientUrl(req);
  const qrUrl = `${activeClientUrl}/download/${token}`;
  return { token, qrUrl, expiresAt };
};

// Helper: Generate a new PhotoShare token for multi-channel sharing
// ─────────────────────────────────────────────────────────────
const generatePhotoShare = async (paymentId, photoUrls, compositeUrl, eventId, orgId) => {
  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) return null;
  const tokenHash = crypto.randomBytes(32).toString('hex');

  let expirationDays = 7;
  const event = await Event.findById(eventId);
  if (event && event.sharingConfig && event.sharingConfig.expirationDays) {
    expirationDays = event.sharingConfig.expirationDays;
  }
  const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

  const photoShare = new PhotoShare({
    eventId,
    organizationId: orgId,
    tokenHash,
    photoUrls: photoUrls || [],
    compositeUrl: compositeUrl || null,
    expiresAt,
    status: 'active'
  });
  await photoShare.save();
  return { tokenHash, expiresAt };
};

// Helper: resolve + authorize the event for a device request
const loadEventForDevice = async (req, eventId) => {
  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) return null;
  const event = await Event.findById(eventId);
  if (!event) return null;
  // Cross-tenant guard: devices may only bill their own organization's events
  if (req.organizationId && event.organizationId && String(event.organizationId) !== String(req.organizationId)) {
    const err = new Error('This event belongs to another organization.');
    err.status = 403;
    throw err;
  }
  return event;
};

// ─────────────────────────────────────────────────────────────
// Create Razorpay Order (device-authenticated, server-priced)
// POST /api/payments/create-order
// ─────────────────────────────────────────────────────────────
router.post('/create-order', authenticateDevice, async (req, res) => {
  try {
    const {
      printCount,
      digitalCopy,
      photoUrls,
      compositeUrl,
      couponCode,
      eventId,
      layoutKey,
    } = req.body;

    if (printCount === undefined || printCount === null) {
      return res.status(400).json({ error: 'printCount is required' });
    }
    const copies = Math.max(1, Math.min(10, Math.round(Number(printCount) || 0)));

    const orgId = req.organizationId;
    const event = await loadEventForDevice(req, eventId);

    const orgDefaults = orgId ? await OrganizationDefaults.findOne({ organizationId: orgId }).lean() : null;
    const unitPrice = resolveUnitPrice(event, layoutKey, orgDefaults);
    const gross = Math.round(unitPrice * copies);
    const discount = await validateCouponForAmount(orgId, eventId, couponCode, gross);
    const finalAmount = Math.max(0, gross - discount);

    if (finalAmount <= 0) {
      return res.status(400).json({ error: 'Fully discounted orders must use the free-complete endpoint' });
    }

    const amountInPaise = Math.round(finalAmount * 100); // Razorpay uses paise

    const rzpConfig = await getRazorpayConfig(orgId, eventId);
    if (!rzpConfig.key_id || !rzpConfig.key_secret) {
      return res.status(400).json({ error: 'Razorpay configuration is not set up' });
    }

    const rzpInstance = new Razorpay({
      key_id: rzpConfig.key_id,
      key_secret: rzpConfig.key_secret,
    });

    const order = await rzpInstance.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `hp_${Date.now()}`,
      notes: {
        eventId: String(eventId || ''),
        eventName: event?.name || '',
        printCount: String(copies),
        digitalCopy: String(digitalCopy || false),
      },
    });

    // Generate a Smart Collect UPI QR Code (Direct UPI Scan)
    let paymentLinkId = null;
    let paymentLinkUrl = null;
    let isImageUrl = false;
    try {
      const qrCode = await rzpInstance.qrCode.create({
        type: 'upi_qr',
        name: 'HappyPix Booth',
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: amountInPaise,
        description: 'HappyPix Booth Prints',
        notes: {
          eventId: String(eventId || ''),
          orderId: order.id,
        },
      });
      paymentLinkId = qrCode.id;
      paymentLinkUrl = qrCode.image_url; // Razorpay returns a PNG image URL
      isImageUrl = true;
    } catch (qrErr) {
      console.error('Warning: Failed to create QR Code, falling back to standard payment link:', qrErr.message);
      try {
        const pl = await rzpInstance.paymentLink.create({
          amount: amountInPaise,
          currency: 'INR',
          accept_partial: false,
          description: 'HappyPix Booth Prints',
          reference_id: order.id,
          notes: {
            eventId: String(eventId || ''),
            orderId: order.id,
          },
        });
        paymentLinkId = pl.id;
        paymentLinkUrl = pl.short_url;
        isImageUrl = false;
      } catch (plErr) {
        console.error('Error: Failed to create fallback payment link:', plErr.message);
      }
    }

    // Save pending payment to DB (including photo URLs and org info)
    const payment = new Payment({
      razorpayOrderId: order.id,
      paymentLinkId,
      paymentLinkUrl,
      organizationId: orgId || event?.organizationId || null,
      deviceId: req.device?._id || null,
      eventId: eventId || null,
      eventName: event?.name || 'General',
      amount: finalAmount,
      printCount: copies,
      digitalCopy: digitalCopy || false,
      photoUrls: (photoUrls || []).map((u) => safeMediaUrl(u)).filter(Boolean),
      compositeUrl: safeMediaUrl(compositeUrl),
      couponCode: couponCode || null,
      discountApplied: discount,
      settlement: await settlementForOrg(orgId || event?.organizationId),
      status: 'created',
    });
    await payment.save();

    res.status(201).json({
      orderId: order.id,
      paymentId: payment._id,
      amount: order.amount,
      currency: order.currency,
      key: rzpConfig.key_id,
      paymentLinkUrl,
      isImageUrl,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('❌ Create order error:', err.message);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// ─────────────────────────────────────────────────────────────
// Check Payment Status (Polling endpoint, device-authenticated)
// GET /api/payments/status/:paymentId
// ─────────────────────────────────────────────────────────────
router.get('/status/:paymentId', authenticateDevice, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }
    if (req.organizationId && payment.organizationId && String(payment.organizationId) !== String(req.organizationId)) {
      return res.status(403).json({ error: 'This payment belongs to another organization.' });
    }

    if (payment.status === 'paid') {
      return res.json({ success: true, status: 'paid' });
    }

    if (payment.status === 'failed') {
      return res.json({ success: false, status: 'failed' });
    }

    // Still 'created' locally, check Razorpay directly via Payment Link or Order
    const rzpConfig = await getRazorpayConfig(payment.organizationId, payment.eventId);
    if (!rzpConfig.key_id || !rzpConfig.key_secret) {
      return res.status(400).json({ error: 'Razorpay configuration missing' });
    }

    const rzpInstance = new Razorpay({
      key_id: rzpConfig.key_id,
      key_secret: rzpConfig.key_secret,
    });

    let isPaid = false;

    if (payment.paymentLinkId && payment.paymentLinkId.startsWith('qr_')) {
      const qr = await rzpInstance.qrCode.fetch(payment.paymentLinkId);
      if (qr.status === 'closed' || qr.payments_amount_received >= (payment.amount * 100)) {
        isPaid = true;
      }
    } else if (payment.paymentLinkId) {
      // Fallback if older payment link
      const pl = await rzpInstance.paymentLink.fetch(payment.paymentLinkId);
      if (pl.status === 'paid') {
        isPaid = true;
      }
    } else {
      const payments = await rzpInstance.orders.fetchPayments(payment.razorpayOrderId);
      if (payments && payments.items && payments.items.length > 0) {
        const successfulPayment = payments.items.find((p) => p.status === 'captured' || p.status === 'authorized');
        if (successfulPayment) isPaid = true;
      }
    }

    if (isPaid) {
      payment.status = 'paid';
      payment.paidAt = new Date();

      // If we need to dispatch hardware printing for polling flow:
      try {
        const settings = await getSettingsForOrg(payment.organizationId);
        if (settings && settings.enableHardwarePrinting && payment.compositeUrl) {
          printImage(payment.compositeUrl, payment.printCount, settings.printerName)
            .then(() => console.log('Print job dispatched via polling flow'))
            .catch((err) => console.error('Print job dispatch error:', err.message));
        }
      } catch (printErr) {
        console.error('Failed to trigger hardware printing:', printErr.message);
      }

      await payment.save();
      await incrementCouponUsage(payment.couponCode, payment.organizationId);
      return res.json({ success: true, status: 'paid' });
    }

    return res.json({ success: true, status: 'pending' });
  } catch (err) {
    console.error('❌ Check status error:', err.message);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});


// ─────────────────────────────────────────────────────────────
// Verify Payment (client calls after Razorpay success)
// POST /api/payments/verify
// ─────────────────────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    // Find payment record first to check organization scope
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    const rzpConfig = await getRazorpayConfig(payment.organizationId, payment.eventId);

    // HMAC-SHA256 signature check
    const expectedSignature = crypto
      .createHmac('sha256', rzpConfig.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Mark payment as failed
      payment.status = 'failed';
      await payment.save();
      return res.status(400).json({ error: 'Payment verification failed — signature mismatch' });
    }

    // Mark as paid
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'paid';
    payment.paidAt = new Date();
    const compositeUrl = safeMediaUrl(req.body.compositeUrl);
    if (compositeUrl) payment.compositeUrl = compositeUrl;
    if (Array.isArray(req.body.photoUrls)) {
      payment.photoUrls = req.body.photoUrls.map((u) => safeMediaUrl(u)).filter(Boolean);
    }
    await payment.save();

    await incrementCouponUsage(payment.couponCode, payment.organizationId);

    // Trigger physical print if enabled in settings
    try {
      const settings = await getSettingsForOrg(payment.organizationId);
      if (settings && settings.enableHardwarePrinting && payment.compositeUrl) {
        printImage(payment.compositeUrl, payment.printCount, settings.printerName)
          .then(() => console.log('Print job dispatched for verification success'))
          .catch((err) => console.error('Print job dispatch error:', err.message));
      }
    } catch (printErr) {
      console.error('Failed to trigger hardware printing:', printErr.message);
    }

    // Generate digital download token if user opted in and we have photos
    let qrToken = null;
    let qrUrl = null;
    let tokenExpiresAt = null;

    let shareToken = null;

    if (payment.digitalCopy && payment.photoUrls && payment.photoUrls.length > 0) {
      // Legacy QR token
      const tokenData = await generateDigitalToken(payment._id, payment.photoUrls, payment.compositeUrl, req);
      qrToken = tokenData.token;
      qrUrl = tokenData.qrUrl;
      tokenExpiresAt = tokenData.expiresAt;

      // New PhotoShare token
      const shareData = await generatePhotoShare(payment._id, payment.photoUrls, payment.compositeUrl, payment.eventId, payment.organizationId);
      if (shareData) {
        shareToken = shareData.tokenHash;
      }
    }

    res.json({
      success: true,
      paymentId: payment._id,
      qrToken,
      qrUrl,
      tokenExpiresAt,
      shareToken,
    });
  } catch (err) {
    console.error('❌ Verify payment error:', err.message);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// Complete Free Order (finalPrice === 0) or record offline UPI + UTR
// POST /api/payments/free-complete  (device-authenticated, server-priced)
// ─────────────────────────────────────────────────────────────
router.post('/free-complete', authenticateDevice, async (req, res) => {
  try {
    const {
      printCount,
      digitalCopy,
      photoUrls,
      compositeUrl,
      couponCode,
      eventId,
      layoutKey,
      utr,
    } = req.body;

    if (printCount === undefined || printCount === null) {
      return res.status(400).json({ error: 'printCount is required' });
    }
    const copies = Math.max(1, Math.min(10, Math.round(Number(printCount) || 0)));

    const orgId = req.organizationId;
    const event = await loadEventForDevice(req, eventId);
    const orgDefaults = orgId ? await OrganizationDefaults.findOne({ organizationId: orgId }).lean() : null;
    const unitPrice = resolveUnitPrice(event, layoutKey, orgDefaults);
    const gross = Math.round(unitPrice * copies);
    const discount = await validateCouponForAmount(orgId, eventId, couponCode, gross);
    const amount = Math.max(0, gross - discount);

    // Offline UPI payments (amount > 0) must carry a 12-digit UTR.
    if (amount > 0) {
      if (!utr) {
        return res.status(400).json({ error: 'UPI Ref No. (UTR) is required for UPI QR payments' });
      }
      if (!/^\d{12}$/.test(utr)) {
        return res.status(400).json({ error: 'UTR must be exactly 12 digits' });
      }
      // Check for duplicate UTR
      const existingPayment = await Payment.findOne({ utr, status: 'paid' });
      if (existingPayment) {
        return res.status(400).json({ error: 'This UTR has already been used for a payment.' });
      }
    }

    // Record the free or offline UPI order in DB
    const payment = new Payment({
      razorpayOrderId: amount > 0 ? `upi_${Date.now()}` : `free_${Date.now()}`,
      organizationId: orgId || event?.organizationId || null,
      deviceId: req.device?._id || null,
      eventId: eventId || null,
      eventName: event?.name || 'General',
      amount,
      printCount: copies,
      digitalCopy: digitalCopy || false,
      photoUrls: (photoUrls || []).map((u) => safeMediaUrl(u)).filter(Boolean),
      compositeUrl: safeMediaUrl(compositeUrl),
      couponCode: couponCode || null,
      discountApplied: discount,
      utr: utr || null,
      settlement: await settlementForOrg(orgId || event?.organizationId),
      status: 'paid',
      paidAt: new Date(),
    });
    await payment.save();

    await incrementCouponUsage(payment.couponCode, payment.organizationId);

    // Trigger physical print if enabled in settings
    try {
      const settings = await getSettingsForOrg(orgId);
      if (settings && settings.enableHardwarePrinting && payment.compositeUrl) {
        printImage(payment.compositeUrl, copies, settings.printerName)
          .then(() => console.log('Print job dispatched for free complete'))
          .catch((err) => console.error('Print job dispatch error:', err.message));
      }
    } catch (printErr) {
      console.error('Failed to trigger hardware printing:', printErr.message);
    }

    // Generate digital download token if opted in
    let shareToken = null;
    let qrToken = null;
    let qrUrl = null;
    let tokenExpiresAt = null;

    if (digitalCopy && payment.photoUrls && payment.photoUrls.length > 0) {
      // Legacy QR token
      const tokenData = await generateDigitalToken(payment._id, payment.photoUrls, payment.compositeUrl, req);
      qrToken = tokenData.token;
      qrUrl = tokenData.qrUrl;
      tokenExpiresAt = tokenData.expiresAt;

      // New PhotoShare token
      const shareData = await generatePhotoShare(payment._id, payment.photoUrls, payment.compositeUrl, eventId, payment.organizationId);
      if (shareData) {
        shareToken = shareData.tokenHash;
      }
    }

    res.status(201).json({
      success: true,
      paymentId: payment._id,
      qrToken,
      qrUrl,
      tokenExpiresAt,
      shareToken,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('❌ Free complete error:', err.message);
    res.status(500).json({ error: 'Failed to complete free order' });
  }
});

// ─────────────────────────────────────────────────────────────
// Complete Prepaid Order (attach photos AFTER payment succeeded)
// POST /api/payments/complete-prepaid  (device-authenticated)
// SECURITY: this may no longer flip a payment to `paid` — only
// an already-paid payment can be completed with its photos.
// ─────────────────────────────────────────────────────────────
router.post('/complete-prepaid', authenticateDevice, async (req, res) => {
  try {
    const { paymentId, photoUrls, compositeUrl } = req.body;
    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId is required' });
    }
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    if (req.organizationId && payment.organizationId && String(payment.organizationId) !== String(req.organizationId)) {
      return res.status(403).json({ error: 'This payment belongs to another organization.' });
    }
    if (payment.status !== 'paid') {
      return res.status(409).json({ error: 'This payment has not been confirmed yet and cannot be completed.' });
    }

    const safeComposite = safeMediaUrl(compositeUrl);
    if (Array.isArray(photoUrls)) {
      payment.photoUrls = photoUrls.map((u) => safeMediaUrl(u)).filter(Boolean);
    }
    if (safeComposite) payment.compositeUrl = safeComposite;
    await payment.save();

    // Trigger physical print if enabled in settings
    try {
      const settings = await getSettingsForOrg(payment.organizationId);
      if (settings && settings.enableHardwarePrinting && payment.compositeUrl) {
        printImage(payment.compositeUrl, payment.printCount, settings.printerName)
          .then(() => console.log('Print job dispatched for prepaid complete'))
          .catch((err) => console.error('Print job dispatch error:', err.message));
      }
    } catch (printErr) {
      console.error('Failed to trigger hardware printing:', printErr.message);
    }

    // Generate digital download token if opted in
    let shareToken = null;
    let qrToken = null;
    let qrUrl = null;
    let tokenExpiresAt = null;

    if (payment.digitalCopy && payment.photoUrls && payment.photoUrls.length > 0) {
      // Legacy QR token
      const tokenData = await generateDigitalToken(payment._id, payment.photoUrls, payment.compositeUrl, req);
      qrToken = tokenData.token;
      qrUrl = tokenData.qrUrl;
      tokenExpiresAt = tokenData.expiresAt;

      // New PhotoShare token
      const shareData = await generatePhotoShare(payment._id, payment.photoUrls, payment.compositeUrl, payment.eventId, payment.organizationId);
      if (shareData) {
        shareToken = shareData.tokenHash;
      }
    }

    res.json({
      success: true,
      qrToken,
      qrUrl,
      tokenExpiresAt,
      shareToken,
    });
  } catch (err) {
    console.error('❌ complete-prepaid error:', err.message);
    res.status(500).json({ error: 'Failed to complete prepaid order' });
  }
});

// ─────────────────────────────────────────────────────────────
// Get photos by download token
// GET /api/payments/download/:token
// ─────────────────────────────────────────────────────────────
router.get('/download/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const digitalToken = await DigitalToken.findOne({ token }).populate('paymentId');

    if (!digitalToken) {
      return res.status(404).json({ error: 'This download link has expired or is invalid.' });
    }

    // Double-check expiry (belt-and-suspenders, TTL index handles DB cleanup)
    if (new Date() > digitalToken.expiresAt) {
      return res.status(410).json({ error: 'This download link has expired.' });
    }

    // Increment download counter
    digitalToken.downloadCount += 1;
    await digitalToken.save();

    // Fetch printing settings to know if mobile printing is enabled
    let enableMobilePrinting = true;
    try {
      let orgId = null;
      if (digitalToken && digitalToken.paymentId) {
        orgId = digitalToken.paymentId.organizationId;
      }
      const settings = await getSettingsForOrg(orgId);
      if (settings && settings.enableMobilePrinting !== undefined) {
        enableMobilePrinting = settings.enableMobilePrinting;
      }
    } catch (err) {
      console.warn('Failed to fetch mobile printing setting, defaulting to true.');
    }

    res.json({
      photoUrls: digitalToken.photoUrls,
      compositeUrl: digitalToken.compositeUrl || null,
      expiresAt: digitalToken.expiresAt,
      downloadCount: digitalToken.downloadCount,
      enableMobilePrinting,
    });
  } catch (err) {
    console.error('❌ Download token error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve download link' });
  }
});

export default router;
