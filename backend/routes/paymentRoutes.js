import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import DigitalToken from '../models/DigitalToken.js';
import PhotoShare from '../models/PhotoShare.js';
import Setting from '../models/Setting.js';
import Event from '../models/Event.js';
import Coupon from '../models/Coupon.js';
import { printImage } from '../utils/printHelper.js';
import { authenticate, getOrgFilter } from '../middleware/auth.js';
import { optionalDeviceAuth } from '../middleware/deviceAuth.js';

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
    console.error('Failed to increment coupon usage:', err);
  }
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
    status: 'active'
  });
  await photoShare.save();
  return { tokenHash, expiresAt };
};

// ─────────────────────────────────────────────────────────────
// PUBLIC: Create Razorpay Order
// POST /api/payments/create-order
// ─────────────────────────────────────────────────────────────
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

    let finalAmount = amount;
    let actualDiscount = 0;

    if (couponCode) {
      const coupon = await Coupon.findOne({ 
        organizationId: orgId, 
        code: couponCode.toUpperCase(), 
        isActive: true 
      });

      if (!coupon) {
        return res.status(400).json({ error: 'Invalid or inactive coupon' });
      }
      if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate).setHours(23, 59, 59, 999)) {
        return res.status(400).json({ error: 'Coupon has expired' });
      }
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return res.status(400).json({ error: 'Coupon usage limit reached' });
      }

      // Re-calculate the expected final amount based on the provided finalAmount being the already-discounted amount by the frontend?
      // Actually, since the frontend is now passing `amount: finalTotal`, the backend doesn't know the `baseTotal`.
      // To be safe, the backend can just trust the `amount` for now but still record `couponCode` and validate its active status.
      actualDiscount = discountApplied || 0;
      finalAmount = amount;
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
        eventId: eventId || '',
        eventName: eventName || '',
        printCount: String(printCount),
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
      console.error('Warning: Failed to create QR Code, falling back to standard payment link', qrErr);
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
        console.error('Error: Failed to create fallback payment link', plErr);
      }
    }

    // Save pending payment to DB (including photo URLs and org info)
    const payment = new Payment({
      razorpayOrderId: order.id,
      paymentLinkId,
      paymentLinkUrl,
      organizationId: orgId || null,
      eventId: eventId || null,
      eventName: eventName || 'General',
      amount,
      printCount,
      digitalCopy: digitalCopy || false,
      photoUrls: photoUrls || [],
      compositeUrl: compositeUrl || null,
      couponCode: couponCode || null,
      discountApplied: discountApplied || 0,
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
    console.error('❌ Create order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUBLIC: Check Payment Status (Polling endpoint for frictionless payment)
// GET /api/payments/status/:paymentId
// ─────────────────────────────────────────────────────────────
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
            .catch((err) => console.error('Print job dispatch error:', err));
        }
      } catch (printErr) {
        console.error('Failed to trigger hardware printing:', printErr);
      }

      await payment.save();
      await incrementCouponUsage(payment.couponCode, payment.organizationId);
      return res.json({ success: true, status: 'paid' });
    }

    return res.json({ success: true, status: 'pending' });
  } catch (err) {
    console.error('❌ Check status error:', err);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});


// ─────────────────────────────────────────────────────────────
// PUBLIC: Verify Payment (client calls after Razorpay success)
// POST /api/payments/verify
// ─────────────────────────────────────────────────────────────
router.post('/verify', optionalDeviceAuth, async (req, res) => {
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
    if (req.body.compositeUrl) payment.compositeUrl = req.body.compositeUrl;
    if (req.body.photoUrls) payment.photoUrls = req.body.photoUrls;
    await payment.save();
    
    await incrementCouponUsage(payment.couponCode, payment.organizationId);

    // Trigger physical print if enabled in settings
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
    console.error('❌ Verify payment error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUBLIC: Complete Free Order (finalPrice === 0)
// POST /api/payments/free-complete
// ─────────────────────────────────────────────────────────────
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
      return res.status(400).json({ error: 'printCount is required' });
    }

    // Validate UTR for paid offline UPI payments
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

    let orgId = req.organizationId;
    if (!orgId && eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      const event = await Event.findById(eventId);
      if (event && event.organizationId) {
        orgId = event.organizationId;
      }
    }

    if (couponCode) {
      const coupon = await Coupon.findOne({ 
        organizationId: orgId, 
        code: couponCode.toUpperCase(), 
        isActive: true 
      });

      if (!coupon) {
        return res.status(400).json({ error: 'Invalid or inactive coupon' });
      }
      if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate).setHours(23, 59, 59, 999)) {
        return res.status(400).json({ error: 'Coupon has expired' });
      }
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return res.status(400).json({ error: 'Coupon usage limit reached' });
      }
    }

    // Record the free or offline UPI order in DB
    const payment = new Payment({
      razorpayOrderId: amount > 0 ? `upi_${Date.now()}` : `free_${Date.now()}`,
      organizationId: orgId || null,
      eventId: eventId || null,
      eventName: eventName || 'General',
      amount: amount,
      printCount,
      digitalCopy: digitalCopy || false,
      photoUrls: photoUrls || [],
      compositeUrl: compositeUrl || null,
      couponCode: couponCode || null,
      discountApplied: discountApplied || 0,
      utr: utr || null,
      status: 'paid',
      paidAt: new Date(),
    });
    await payment.save();
    
    await incrementCouponUsage(payment.couponCode, payment.organizationId);

    // Trigger physical print if enabled in settings
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

    // Generate digital download token if opted in
    let shareToken = null;
    let qrToken = null;
    let qrUrl = null;
    let tokenExpiresAt = null;

    if (digitalCopy && photoUrls && photoUrls.length > 0) {
      // Legacy QR token
      const tokenData = await generateDigitalToken(payment._id, photoUrls, compositeUrl, req);
      qrToken = tokenData.token;
      qrUrl = tokenData.qrUrl;
      tokenExpiresAt = tokenData.expiresAt;
      
      // New PhotoShare token
      const shareData = await generatePhotoShare(payment._id, photoUrls, compositeUrl, eventId, payment.organizationId);
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
    console.error('❌ Free complete error:', err);
    res.status(500).json({ error: 'Failed to complete free order' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUBLIC: Complete Prepaid Order (post-shoot update)
// POST /api/payments/complete-prepaid
// ─────────────────────────────────────────────────────────────
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
    payment.status = 'paid'; // Ensure it's paid
    await payment.save();

    // Trigger physical print if enabled in settings
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

    // Generate digital download token if opted in
    let shareToken = null;

    if (payment.digitalCopy && photoUrls && photoUrls.length > 0) {
      // Legacy QR token
      const tokenData = await generateDigitalToken(payment._id, photoUrls, compositeUrl, req);
      qrToken = tokenData.token;
      qrUrl = tokenData.qrUrl;
      tokenExpiresAt = tokenData.expiresAt;

      // New PhotoShare token
      const shareData = await generatePhotoShare(payment._id, photoUrls, compositeUrl, payment.eventId, payment.organizationId);
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
    console.error('❌ complete-prepaid error:', err);
    res.status(500).json({ error: 'Failed to complete prepaid order' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUBLIC: Get photos by download token
// GET /api/download/:token
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
    console.error('❌ Download token error:', err);
    res.status(500).json({ error: 'Failed to retrieve download link' });
  }
});

// Removed old admin CRM protected endpoints

export default router;
