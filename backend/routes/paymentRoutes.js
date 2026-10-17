import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Cashfree } from 'cashfree-pg';
import Payment from '../models/Payment.js';
import DigitalToken from '../models/DigitalToken.js';
import PhotoShare from '../models/PhotoShare.js';
import Setting from '../models/Setting.js';
import Event from '../models/Event.js';
import Coupon from '../models/Coupon.js';
import { printImage } from '../utils/printHelper.js';
import OrganizationDefaults from '../models/OrganizationDefaults.js';
import { authenticate, getOrgFilter } from '../middleware/auth.js';
import { optionalDeviceAuth } from '../middleware/deviceAuth.js';
import { resolveLayoutPrices } from '../config/layouts.js';
import { applyCoupon, findCouponForOrg, recordCouponRedemption } from '../services/couponService.js';

const router = express.Router();

// Client URL for generating QR download links
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ─── Helper: get settings for an organization with global fallback ──────────
const getSettingsForOrg = async (organizationId) => {
  if (organizationId) {
    const setting = await Setting.findOne({ organizationId });
    if (setting) return setting;
  }
  return await Setting.findOne({ organizationId: null });
};

// ─── Helper: Resolve gateway config (event → org settings → platform env) ──
/**
 * Returns: {
 *   priority: 'razorpay' | 'cashfree',
 *   razorpay: { key_id, key_secret } | null,
 *   cashfree: { appId, secretKey, env } | null,
 * }
 */
const getGatewayConfig = async (orgId, eventId) => {
  let razorpay = null;
  let cashfree = null;
  let priority = 'razorpay';

  // Event-level override (highest priority)
  if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
    const event = await Event.findById(eventId).lean();
    if (event) {
      if (event.razorpayKeyId && event.razorpayKeySecret) {
        razorpay = { key_id: event.razorpayKeyId, key_secret: event.razorpayKeySecret };
      }
      if (event.cashfreeAppId && event.cashfreeSecretKey) {
        cashfree = { appId: event.cashfreeAppId, secretKey: event.cashfreeSecretKey, env: event.cashfreeEnv || 'production' };
      }
      if (event.gatewayPriority) priority = event.gatewayPriority;
    }
  }

  // Org-level override (second priority)
  if (orgId) {
    const [settings, defaults] = await Promise.all([
      Setting.findOne({ organizationId: orgId }).lean(),
      OrganizationDefaults.findOne({ organizationId: orgId }).lean(),
    ]);
    const rzpId = settings?.razorpayKeyId || defaults?.razorpayKeyId;
    const rzpSecret = settings?.razorpayKeySecret || defaults?.razorpayKeySecret;
    const cfApp = settings?.cashfreeAppId || defaults?.cashfreeAppId;
    const cfSecret = settings?.cashfreeSecretKey || defaults?.cashfreeSecretKey;
    const cfEnv = settings?.cashfreeEnv || defaults?.cashfreeEnv || 'production';
    const orgPriority = settings?.gatewayPriority || defaults?.gatewayPriority;

    if (rzpId && rzpSecret) {
      if (!eventId || !razorpay?.key_id) {
        razorpay = { key_id: rzpId, key_secret: rzpSecret };
      }
    }
    if (cfApp && cfSecret) {
      if (!eventId || !cashfree?.appId) {
        cashfree = { appId: cfApp, secretKey: cfSecret, env: cfEnv };
      }
    }
    if (orgPriority && (!eventId || priority === 'razorpay')) priority = orgPriority;
  }

  return {
    priority,
    razorpay: (razorpay && razorpay.key_id && razorpay.key_secret) ? razorpay : null,
    cashfree: (cashfree && cashfree.appId && cashfree.secretKey) ? cashfree : null,
  };
};

// Legacy helper kept for backward-compat with status check
const getRazorpayConfig = async (orgId, eventId) => {
  const cfg = await getGatewayConfig(orgId, eventId);
  return cfg.razorpay || { key_id: '', key_secret: '' };
};

// ─── Cashfree SDK initializer ────────────────────────────────────────────────
const getCashfreeInstance = (config) => {
  Cashfree.XClientId = config.appId;
  Cashfree.XClientSecret = config.secretKey;
  Cashfree.XEnvironment = config.env === 'production'
    ? Cashfree.Environment.PRODUCTION
    : Cashfree.Environment.SANDBOX;
  return Cashfree;
};

/**
 * Issues #103/#106/#107: the price a legacy booth sends is only ever a hint.
 * The server recomputes the acceptable amounts from the resolved price chain
 * (event → organization defaults → platform suggested) and applies the shared
 * coupon rules before any order is created.
 */
const verifyClientAmount = async ({ eventId, printCount, amount, couponCode }) => {
  const count = Number(printCount);
  const sent = Number(amount);
  if (!Number.isFinite(count) || count < 1) {
    return { ok: false, status: 400, code: 'BAD_PRINT_COUNT', message: 'printCount must be a whole number of 1 or more.' };
  }
  if (!Number.isFinite(sent) || sent < 0) {
    return { ok: false, status: 400, code: 'BAD_AMOUNT', message: 'amount must be a non-negative number.' };
  }

  const event = eventId && mongoose.Types.ObjectId.isValid(eventId) ? await Event.findById(eventId) : null;
  const organizationId = event ? event.organizationId : null;
  if (!organizationId) {
    return { ok: false, status: 400, code: 'EVENT_REQUIRED', message: 'A valid event is required to price this order.' };
  }

  const defaults = await OrganizationDefaults.findOne({ organizationId });
  const prices = resolveLayoutPrices({
    eventPrices: (event.layoutPrices instanceof Map ? Object.fromEntries(event.layoutPrices) : event.layoutPrices) || {},
    orgPrices: (defaults && (defaults.layoutPrices instanceof Map ? Object.fromEntries(defaults.layoutPrices) : defaults.layoutPrices)) || {},
  });
  const units = [...new Set(Object.values(prices).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 0))];

  let coupon = null;
  let discount = 0;
  if (couponCode) {
    coupon = await findCouponForOrg({ organizationId, code: couponCode, eventId: event._id });
    const applied = applyCoupon(coupon, { gross: sent, eventId: String(event._id) });
    if (!applied.ok) {
      return { ok: false, status: 400, code: 'COUPON_REJECTED', message: applied.message };
    }
    discount = applied.discount;
  }

  const expected = units.map((unit) => unit * count);
  const expectedAfterCoupon = discount > 0 && coupon
    ? [...new Set([
        ...expected,
        ...expected.map((gross) => Math.max(0, gross - (coupon.type === 'percentage' ? Math.round(gross * coupon.value / 100) : Math.min(coupon.value, gross)))),
      ])]
    : expected;
  const acceptable = new Set([...expected, ...expectedAfterCoupon].map((value) => Math.round(value * 100)));

  if (!acceptable.has(Math.round(sent * 100))) {
    return {
      ok: false,
      status: 409,
      code: 'PRICE_MISMATCH',
      message: `The price sent by the booth (₹${sent}) does not match the event pricing table. Refresh the booth configuration and try again.`,
      allowed: expected,
    };
  }
  return { ok: true, event, organizationId, prices, coupon, discount };
};

// Helper: dynamic Razorpay credentials resolver (kept for backward compat)
const getRazorpayConfig_legacy = async (orgId, eventId) => {
  return getRazorpayConfig(orgId, eventId);
};

// Helper: get client URL dynamically (resolves local IP if requested from external local network device)
const getClientUrl = (req) => {
  if (req && req.get('host')) {
    const requestHost = req.get('host');
    const ipOnly = requestHost.split(':')[0];
    const isIpAddress = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ipOnly);
    if (isIpAddress && ipOnly !== '127.0.0.1') {
      return `http://${ipOnly}:5173`;
    }
  }
  return process.env.CLIENT_URL || 'https://happypix.vercel.app';
};

// Helper: Generate a digital download token (24h expiry)
const generateDigitalToken = async (paymentId, photoUrls, compositeUrl, req) => {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
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
const generatePhotoShare = async (paymentId, photoUrls, compositeUrl, eventId, orgId) => {
  if (!eventId) return null;
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
    status: 'active',
  });
  await photoShare.save();
  return { tokenHash, expiresAt };
};

// ─────────────────────────────────────────────────────────────────────────────
// CASHFREE: Create a fixed-amount UPI QR order
// Returns: { cfOrderId, qrPayload, qrImageUrl }
// qrPayload = raw UPI string (upi://pay?...) → booth generates QR from this
// qrImageUrl = pre-rendered image from Cashfree (if available)
// ─────────────────────────────────────────────────────────────────────────────
const createCashfreeQR = async (cfConfig, { amount, orderId, eventId, eventName, printCount }) => {
  const cf = getCashfreeInstance(cfConfig);
  const amountStr = amount.toFixed(2);
  const cfOrderId = `hp_${orderId}`;

  // Step 1: Create order
  const orderReq = {
    order_id: cfOrderId,
    order_amount: parseFloat(amountStr),
    order_currency: 'INR',
    order_note: `HappyPix Booth - ${eventName || 'Event'} - ${printCount} print(s)`,
    customer_details: {
      customer_id: `guest_${Date.now()}`,
      customer_phone: '9999999999',
      customer_email: 'guest@happypix.in',
    },
    order_meta: {
      notify_url: process.env.CASHFREE_WEBHOOK_URL || '',
    },
  };

  const orderResp = await cf.PGCreateOrder('2023-08-01', orderReq);
  const cfOrder = orderResp.data;

  // Step 2: Create UPI QR for this order
  const qrReq = {
    qr_size: 800, // pixels
  };
  const qrResp = await cf.PGOrderFetchQRCode('2023-08-01', cfOrderId);
  const qrData = qrResp.data;

  return {
    cfOrderId,
    qrPayload: qrData[0]?.payload || qrData?.payload || null,
    qrImageUrl: qrData[0]?.image_data || qrData?.image_data || null,
  };
};

// ─── Check Cashfree payment status ──────────────────────────────────────────
const checkCashfreeStatus = async (cfConfig, cfOrderId) => {
  const cf = getCashfreeInstance(cfConfig);
  const resp = await cf.PGFetchOrder('2023-08-01', cfOrderId);
  const order = resp.data;
  if (order.order_status === 'PAID') return 'paid';
  if (order.order_status === 'EXPIRED' || order.order_status === 'CANCELLED') return 'failed';
  return 'pending';
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Create Payment Order (Razorpay primary, Cashfree fallback or vice versa)
// POST /api/payments/create-order
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-order', optionalDeviceAuth, async (req, res) => {
  try {
    const {
      amount,
      printCount,
      digitalCopy,
      photoUrls,
      compositeUrl,
      couponCode,
      discountApplied,
      eventId,
      eventName,
    } = req.body;

    if (amount === undefined || amount === null || printCount === undefined || printCount === null) {
      return res.status(400).json({ error: 'amount and printCount are required' });
    }

    let orgId = req.organizationId;
    if (!orgId && eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      const event = await Event.findById(eventId);
      if (event && event.organizationId) {
        orgId = event.organizationId;
      }
    }

    const verification = await verifyClientAmount({ eventId, printCount, amount, couponCode });
    if (!verification.ok) {
      return res.status(verification.status).json({ error: verification.message, code: verification.code, allowedAmounts: verification.allowed || undefined });
    }

    let finalAmount = amount;
    let actualDiscount = verification.discount || discountApplied || 0;
    if (orgId && !verification.organizationId) orgId = verification.organizationId;

    const amountInPaise = Math.round(finalAmount * 100);
    const gatewayConfig = await getGatewayConfig(orgId, eventId);

    // Determine ordered list of gateways to attempt
    const primaryGateway = gatewayConfig.priority;
    const gateways = primaryGateway === 'razorpay'
      ? [
          gatewayConfig.razorpay ? { name: 'razorpay', config: gatewayConfig.razorpay } : null,
          gatewayConfig.cashfree ? { name: 'cashfree', config: gatewayConfig.cashfree } : null,
        ]
      : [
          gatewayConfig.cashfree ? { name: 'cashfree', config: gatewayConfig.cashfree } : null,
          gatewayConfig.razorpay ? { name: 'razorpay', config: gatewayConfig.razorpay } : null,
        ];
    const orderedGateways = gateways.filter(Boolean);

    if (orderedGateways.length === 0) {
      return res.status(400).json({
        error: 'No payment gateway is configured. Please set up Razorpay or Cashfree credentials in your organization settings.',
        code: 'NO_GATEWAY',
      });
    }

    let usedGateway = null;
    let paymentLinkId = null;
    let paymentLinkUrl = null;
    let isImageUrl = false;
    let qrPayload = null; // For Cashfree raw UPI string
    let razorpayOrderId = null;
    let cfOrderId = null;
    let lastError = null;

    const internalOrderId = new mongoose.Types.ObjectId().toString();

    for (const gw of orderedGateways) {
      try {
        if (gw.name === 'razorpay') {
          const rzp = new Razorpay({ key_id: gw.config.key_id, key_secret: gw.config.key_secret });

          const order = await rzp.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `hp_${internalOrderId}`,
            notes: {
              eventId: eventId || '',
              eventName: eventName || '',
              printCount: String(printCount),
              digitalCopy: String(digitalCopy || false),
            },
          });
          razorpayOrderId = order.id;

          // Try UPI QR first, fallback to payment link
          try {
            const qrCode = await rzp.qrCode.create({
              type: 'upi_qr',
              name: 'HappyPix Booth',
              usage: 'single_use',
              fixed_amount: true,
              payment_amount: amountInPaise,
              description: 'HappyPix Booth Prints',
              notes: { eventId: String(eventId || ''), orderId: order.id },
            });
            paymentLinkId = qrCode.id;
            paymentLinkUrl = qrCode.image_url;
            isImageUrl = true;
          } catch (qrErr) {
            console.warn('⚠️ Razorpay QR failed, using payment link fallback:', qrErr.message);
            try {
              const pl = await rzp.paymentLink.create({
                amount: amountInPaise,
                currency: 'INR',
                accept_partial: false,
                description: 'HappyPix Booth Prints',
                reference_id: order.id,
                notes: { eventId: String(eventId || ''), orderId: order.id },
              });
              paymentLinkId = pl.id;
              paymentLinkUrl = pl.short_url;
              isImageUrl = false;
            } catch (plErr) {
              console.warn('⚠️ Razorpay payment link also failed:', plErr.message);
            }
          }

          usedGateway = 'razorpay';
          break;

        } else if (gw.name === 'cashfree') {
          const result = await createCashfreeQR(gw.config, {
            amount: finalAmount,
            orderId: internalOrderId,
            eventId,
            eventName,
            printCount,
          });
          cfOrderId = result.cfOrderId;
          qrPayload = result.qrPayload;
          paymentLinkUrl = result.qrImageUrl;
          isImageUrl = !!result.qrImageUrl;
          usedGateway = 'cashfree';
          break;
        }
      } catch (gwErr) {
        console.error(`❌ Gateway ${gw.name} failed:`, gwErr.message);
        lastError = gwErr;
        // Try next gateway
        continue;
      }
    }

    if (!usedGateway) {
      console.error('❌ All gateways failed. Last error:', lastError?.message);
      return res.status(502).json({
        error: 'Payment gateway unavailable. Please try again in a moment.',
        code: 'GATEWAY_FAILED',
      });
    }

    // Save pending payment to DB
    const payment = new Payment({
      razorpayOrderId: razorpayOrderId || `${usedGateway}_${internalOrderId}`,
      paymentLinkId: paymentLinkId || cfOrderId || null,
      paymentLinkUrl: paymentLinkUrl || null,
      organizationId: orgId || null,
      eventId: eventId || null,
      eventName: eventName || 'General',
      amount: finalAmount,
      printCount,
      digitalCopy: digitalCopy || false,
      photoUrls: photoUrls || [],
      compositeUrl: compositeUrl || null,
      couponCode: couponCode || null,
      discountApplied: actualDiscount || discountApplied || 0,
      status: 'created',
      gateway: usedGateway,
      cashfreeOrderId: cfOrderId || null,
      cashfreeQrData: qrPayload || null,
    });
    await payment.save();

    res.status(201).json({
      orderId: razorpayOrderId || cfOrderId || internalOrderId,
      paymentId: payment._id,
      amount: amountInPaise,
      currency: 'INR',
      key: (usedGateway === 'razorpay' && gatewayConfig.razorpay) ? gatewayConfig.razorpay.key_id : null,
      paymentLinkUrl,
      isImageUrl,
      // For Cashfree: raw UPI string so booth can render its own QR
      qrPayload: usedGateway === 'cashfree' ? qrPayload : null,
      gateway: usedGateway,
    });
  } catch (err) {
    console.error('❌ Create order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Check Payment Status (Polling endpoint for frictionless payment)
// GET /api/payments/status/:paymentId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status/:paymentId', optionalDeviceAuth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    if (payment.status === 'paid') {
      return res.json({ success: true, status: 'paid' });
    }

    if (payment.status === 'failed') {
      return res.json({ success: false, status: 'failed' });
    }

    // Still 'created' — check gateway directly
    let isPaid = false;

    if (payment.gateway === 'cashfree' && payment.cashfreeOrderId) {
      // ── Cashfree status check ──────────────────────────────────
      const gatewayConfig = await getGatewayConfig(payment.organizationId, payment.eventId);
      if (!gatewayConfig.cashfree) {
        return res.status(400).json({ error: 'Cashfree configuration missing' });
      }
      const status = await checkCashfreeStatus(gatewayConfig.cashfree, payment.cashfreeOrderId);
      if (status === 'paid') isPaid = true;
      else if (status === 'failed') {
        payment.status = 'failed';
        await payment.save();
        return res.json({ success: false, status: 'failed' });
      }
    } else {
      // ── Razorpay status check ──────────────────────────────────
      const rzpConfig = await getRazorpayConfig(payment.organizationId, payment.eventId);
      if (!rzpConfig.key_id || !rzpConfig.key_secret) {
        return res.status(400).json({ error: 'Razorpay configuration missing' });
      }
      const rzpInstance = new Razorpay({ key_id: rzpConfig.key_id, key_secret: rzpConfig.key_secret });

      if (payment.paymentLinkId && payment.paymentLinkId.startsWith('qr_')) {
        const qr = await rzpInstance.qrCode.fetch(payment.paymentLinkId);
        if (qr.status === 'closed' || qr.payments_amount_received >= (payment.amount * 100)) {
          isPaid = true;
        }
      } else if (payment.paymentLinkId) {
        const pl = await rzpInstance.paymentLink.fetch(payment.paymentLinkId);
        if (pl.status === 'paid') isPaid = true;
      } else if (payment.razorpayOrderId && !payment.razorpayOrderId.startsWith('cashfree_') && !payment.razorpayOrderId.startsWith('free_') && !payment.razorpayOrderId.startsWith('upi_')) {
        const payments = await rzpInstance.orders.fetchPayments(payment.razorpayOrderId);
        if (payments && payments.items && payments.items.length > 0) {
          const successfulPayment = payments.items.find((p) => p.status === 'captured' || p.status === 'authorized');
          if (successfulPayment) isPaid = true;
        }
      }
    }

    if (isPaid) {
      payment.status = 'paid';
      payment.paidAt = new Date();

      try {
        const settings = await getSettingsForOrg(payment.organizationId);
        if (settings && settings.enableHardwarePrinting && payment.compositeUrl) {
          printImage(payment.compositeUrl, payment.printCount, settings.printerName)
            .then(() => console.log('Print job dispatched via polling flow'))
            .catch((err) => console.error('Print job dispatch error:', err));
        }
      } catch (printErr) {
        console.error('Failed to trigger hardware printing:', printErr);
      }

      await payment.save();
      await recordCouponRedemption(payment);
      return res.json({ success: true, status: 'paid' });
    }

    return res.json({ success: true, status: 'pending' });
  } catch (err) {
    console.error('❌ Check status error:', err);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Verify Razorpay Payment (client calls after Razorpay success)
// POST /api/payments/verify
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', optionalDeviceAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    const rzpConfig = await getRazorpayConfig(payment.organizationId, payment.eventId);
    const expectedSignature = crypto
      .createHmac('sha256', rzpConfig.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature);
    const providedBuf = Buffer.from(String(razorpay_signature || ''));
    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      payment.status = 'failed';
      await payment.save();
      return res.status(400).json({ error: 'Payment verification failed — signature mismatch' });
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'paid';
    payment.paidAt = new Date();
    if (req.body.compositeUrl) payment.compositeUrl = req.body.compositeUrl;
    if (req.body.photoUrls) payment.photoUrls = req.body.photoUrls;
    await payment.save();
    await recordCouponRedemption(payment);

    try {
      const settings = await getSettingsForOrg(payment.organizationId);
      if (settings && settings.enableHardwarePrinting && payment.compositeUrl) {
        printImage(payment.compositeUrl, payment.printCount, settings.printerName)
          .then(() => console.log('Print job dispatched for verification success'))
          .catch((err) => console.error('Print job dispatch error:', err));
      }
    } catch (printErr) {
      console.error('Failed to trigger hardware printing:', printErr);
    }

    let qrToken = null, qrUrl = null, tokenExpiresAt = null, shareToken = null;
    if (payment.digitalCopy && payment.photoUrls && payment.photoUrls.length > 0) {
      const tokenData = await generateDigitalToken(payment._id, payment.photoUrls, payment.compositeUrl, req);
      qrToken = tokenData.token;
      qrUrl = tokenData.qrUrl;
      tokenExpiresAt = tokenData.expiresAt;
      const shareData = await generatePhotoShare(payment._id, payment.photoUrls, payment.compositeUrl, payment.eventId, payment.organizationId);
      if (shareData) shareToken = shareData.tokenHash;
    }

    res.json({ success: true, paymentId: payment._id, qrToken, qrUrl, tokenExpiresAt, shareToken });
  } catch (err) {
    console.error('❌ Verify payment error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Cashfree Webhook
// POST /api/payments/cashfree-webhook
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cashfree-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)));
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];

    // Verify Cashfree webhook signature — MANDATORY. An unsigned webhook
    // could mark any order paid; reject when unconfigured or unsigned
    // (this check used to be optional, which silently accepted forgeries).
    const secret = process.env.CASHFREE_SECRET_KEY || '';
    if (!secret) {
      console.error('❌ CASHFREE_SECRET_KEY is not configured. Rejecting webhook.');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    if (!signature || !timestamp) {
      return res.status(400).json({ error: 'Missing webhook signature' });
    }
    const signedPayload = `${timestamp}${rawBody}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('base64');
    const expectedBuf = Buffer.from(expectedSig);
    const providedBuf = Buffer.from(String(signature));
    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      console.warn('⚠️ Cashfree webhook signature mismatch');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody);
    const { type, data } = event;

    if (type === 'PAYMENT_SUCCESS' || (type === 'ORDER_PAID')) {
      const cfOrderId = data?.order?.order_id || data?.order_id;
      if (!cfOrderId) return res.json({ ok: true });

      const payment = await Payment.findOne({ cashfreeOrderId: cfOrderId, status: { $ne: 'paid' } });
      if (!payment) return res.json({ ok: true });

      payment.status = 'paid';
      payment.paidAt = new Date();
      payment.cashfreePaymentId = data?.payment?.cf_payment_id || data?.cf_payment_id || null;
      await payment.save();
      await recordCouponRedemption(payment);

      try {
        const settings = await getSettingsForOrg(payment.organizationId);
        if (settings && settings.enableHardwarePrinting && payment.compositeUrl) {
          printImage(payment.compositeUrl, payment.printCount, settings.printerName)
            .then(() => console.log('Print job dispatched via Cashfree webhook'))
            .catch((err) => console.error('Print job dispatch error:', err));
        }
      } catch (printErr) {
        console.error('Failed to trigger hardware printing:', printErr);
      }

      console.log(`✅ Cashfree webhook: payment ${payment._id} marked paid`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Cashfree webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Razorpay Webhook
// POST /api/payments/razorpay-webhook
// ─────────────────────────────────────────────────────────────────────────────
router.post('/razorpay-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)));
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('❌ RAZORPAY_WEBHOOK_SECRET is not configured on the server. Rejecting webhook.');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    if (!webhookSignature) {
      console.warn('⚠️ Missing x-razorpay-signature header on Razorpay webhook');
      return res.status(400).json({ error: 'Missing signature' });
    }

    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSig);
    const signatureBuf = Buffer.from(webhookSignature);

    if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
      console.warn('⚠️ Razorpay webhook signature mismatch');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody);
    if (event.event === 'payment.captured' || event.event === 'qr_code.closed') {
      const rzpPayment = event.payload?.payment?.entity;
      const orderId = rzpPayment?.order_id || event.payload?.qr_code?.entity?.notes?.orderId;
      if (!orderId) return res.json({ ok: true });

      const payment = await Payment.findOne({ razorpayOrderId: orderId, status: { $ne: 'paid' } });
      if (!payment) return res.json({ ok: true });

      payment.status = 'paid';
      payment.paidAt = new Date();
      payment.razorpayPaymentId = rzpPayment?.id || null;
      await payment.save();
      await recordCouponRedemption(payment);

      try {
        const settings = await getSettingsForOrg(payment.organizationId);
        if (settings && settings.enableHardwarePrinting && payment.compositeUrl) {
          printImage(payment.compositeUrl, payment.printCount, settings.printerName)
            .then(() => console.log('Print job dispatched via Razorpay webhook'))
            .catch((err) => console.error('Print job dispatch error:', err));
        }
      } catch (printErr) {
        console.error('Failed to trigger hardware printing:', printErr);
      }

      console.log(`✅ Razorpay webhook: payment ${payment._id} marked paid`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Razorpay webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Complete Free Order (finalPrice === 0)
// POST /api/payments/free-complete
// ─────────────────────────────────────────────────────────────────────────────
router.post('/free-complete', optionalDeviceAuth, async (req, res) => {
  try {
    const {
      amount = 0,
      printCount,
      digitalCopy,
      photoUrls,
      compositeUrl,
      couponCode,
      discountApplied,
      eventId,
      eventName,
      utr,
    } = req.body;

    if (printCount === undefined || printCount === null) {
      return res.status(400).json({ error: 'printCount is required', code: 'BAD_PRINT_COUNT' });
    }

    const preShoot = req.body.preShoot === true;
    const verification = preShoot && Number(amount) === 0
      ? { ok: true, event: null, organizationId: null, coupon: null, discount: 0 }
      : await verifyClientAmount({ eventId, printCount, amount, couponCode });
    if (!verification.ok) {
      return res.status(verification.status).json({ error: verification.message, code: verification.code });
    }

    // Validate UTR for paid offline UPI payments
    if (amount > 0) {
      if (!utr) {
        return res.status(400).json({ error: 'UPI Ref No. (UTR) is required for UPI QR payments' });
      }
      if (!/^\d{12}$/.test(utr)) {
        return res.status(400).json({ error: 'UTR must be exactly 12 digits' });
      }
      const existingPayment = await Payment.findOne({ utr, status: 'paid' });
      if (existingPayment) {
        return res.status(400).json({ error: 'This UTR has already been used for a payment.' });
      }
    }

    let orgId = req.organizationId;
    if (!orgId && eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      const event = await Event.findById(eventId);
      if (event && event.organizationId) orgId = event.organizationId;
    }

    let recordedDiscount = 0;
    if (couponCode && !preShoot) {
      const coupon = await findCouponForOrg({ organizationId: orgId, code: couponCode, eventId });
      const applied = applyCoupon(coupon, { gross: Number(amount) + Number(verification.discount || 0), eventId });
      if (!applied.ok) {
        return res.status(400).json({ error: applied.message, code: 'COUPON_REJECTED' });
      }
      recordedDiscount = applied.discount;
    }

    const payment = new Payment({
      razorpayOrderId: amount > 0 ? `upi_${Date.now()}` : `free_${Date.now()}`,
      organizationId: orgId || null,
      eventId: eventId || null,
      eventName: eventName || 'General',
      amount,
      printCount,
      digitalCopy: digitalCopy || false,
      photoUrls: photoUrls || [],
      compositeUrl: compositeUrl || null,
      couponCode: couponCode || null,
      discountApplied: recordedDiscount || discountApplied || 0,
      utr: utr || null,
      status: 'paid',
      paidAt: new Date(),
      gateway: 'razorpay', // free/offline payments don't use a gateway
    });
    await payment.save();
    await recordCouponRedemption(payment);

    try {
      const settings = await getSettingsForOrg(orgId);
      if (settings && settings.enableHardwarePrinting && compositeUrl) {
        printImage(compositeUrl, printCount, settings.printerName)
          .then(() => console.log('Print job dispatched for free complete'))
          .catch((err) => console.error('Print job dispatch error:', err));
      }
    } catch (printErr) {
      console.error('Failed to trigger hardware printing:', printErr);
    }

    let shareToken = null, qrToken = null, qrUrl = null, tokenExpiresAt = null;
    if (digitalCopy && photoUrls && photoUrls.length > 0) {
      const tokenData = await generateDigitalToken(payment._id, photoUrls, compositeUrl, req);
      qrToken = tokenData.token;
      qrUrl = tokenData.qrUrl;
      tokenExpiresAt = tokenData.expiresAt;
      const shareData = await generatePhotoShare(payment._id, photoUrls, compositeUrl, eventId, payment.organizationId);
      if (shareData) shareToken = shareData.tokenHash;
    }

    res.status(201).json({ success: true, paymentId: payment._id, qrToken, qrUrl, tokenExpiresAt, shareToken });
  } catch (err) {
    console.error('❌ Free complete error:', err);
    res.status(500).json({ error: 'Failed to complete free order' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Complete Prepaid Order (post-shoot update)
// POST /api/payments/complete-prepaid
// ─────────────────────────────────────────────────────────────────────────────
router.post('/complete-prepaid', optionalDeviceAuth, async (req, res) => {
  try {
    const { paymentId, photoUrls, compositeUrl } = req.body;
    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId is required' });
    }
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    payment.photoUrls = photoUrls || [];
    payment.compositeUrl = compositeUrl || null;
    payment.status = 'paid';
    await payment.save();

    try {
      const settings = await getSettingsForOrg(payment.organizationId);
      if (settings && settings.enableHardwarePrinting && compositeUrl) {
        printImage(compositeUrl, payment.printCount, settings.printerName)
          .then(() => console.log('Print job dispatched for prepaid complete'))
          .catch((err) => console.error('Print job dispatch error:', err));
      }
    } catch (printErr) {
      console.error('Failed to trigger hardware printing:', printErr);
    }

    let shareToken = null, qrToken = null, qrUrl = null, tokenExpiresAt = null;
    if (payment.digitalCopy && photoUrls && photoUrls.length > 0) {
      const tokenData = await generateDigitalToken(payment._id, photoUrls, compositeUrl, req);
      qrToken = tokenData.token;
      qrUrl = tokenData.qrUrl;
      tokenExpiresAt = tokenData.expiresAt;
      const shareData = await generatePhotoShare(payment._id, photoUrls, compositeUrl, payment.eventId, payment.organizationId);
      if (shareData) shareToken = shareData.tokenHash;
    }

    res.json({ success: true, qrToken, qrUrl, tokenExpiresAt, shareToken });
  } catch (err) {
    console.error('❌ complete-prepaid error:', err);
    res.status(500).json({ error: 'Failed to complete prepaid order' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Get photos by download token
// GET /api/payments/download/:token
// ─────────────────────────────────────────────────────────────────────────────
router.get('/download/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const digitalToken = await DigitalToken.findOne({ token }).populate('paymentId');

    if (!digitalToken) {
      return res.status(404).json({ error: 'This download link has expired or is invalid.' });
    }
    if (new Date() > digitalToken.expiresAt) {
      return res.status(410).json({ error: 'This download link has expired.' });
    }

    digitalToken.downloadCount += 1;
    await digitalToken.save();

    let enableMobilePrinting = true;
    try {
      let orgId = null;
      if (digitalToken && digitalToken.paymentId) orgId = digitalToken.paymentId.organizationId;
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
    console.error('❌ Download token error:', err);
    res.status(500).json({ error: 'Failed to retrieve download link' });
  }
});

export default router;
