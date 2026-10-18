// ============================================================
// HappyPix website API
//
//   GET  /api/health
//   GET  /api/plans                          public plan catalogue (+ live discounts)
//   POST /api/checkout/order                 register-or-verify + Razorpay order
//   POST /api/checkout/verify                verify signature → activate plan
//   POST /api/checkout/free                  trial / ₹0 activation (no gateway)
//   GET  /api/downloads/:id                  guest digital copy (24h only)
//   GET  /api/downloads/:id/file/:kind       download one file (composite|0..n)
//   POST /api/internal/downloads             booth/other services mint a download
//   POST /api/leads                          contact / demo requests
// ============================================================

import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import Razorpay from 'razorpay';
import rateLimit from 'express-rate-limit';

import {
  SubscriptionPlan, Organization, User, GuestDownload, WebsiteCheckout, WebsiteLead,
} from './models.js';
import { publicPlanView, planPricing, invoiceNumber, periodPrice } from './pricing.js';
import { activateCheckout } from './activate.js';
import { signedPhotoUrl } from './s3.js';

const router = express.Router();

const ok = (res, data, status = 200) => res.status(status).json(data);
const fail = (res, status, error, code) => res.status(status).json({ error, ...(code ? { code } : {}) });

const checkoutLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many checkout attempts. Please try again shortly.' } });
const downloadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please try again shortly.' } });

function razorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keyId || !keySecret) return null;
  return { instance: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId, keySecret };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s-]{7,17}$/;

function passwordPolicyError(password) {
  const value = String(password || '');
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Password must contain at least one letter and one number.';
  return null;
}

async function findSellablePlan(planKey) {
  const key = String(planKey || '').toLowerCase().trim();
  if (!key) return null;
  const plan = await SubscriptionPlan.findOne({ key, active: { $ne: false }, isDeleted: { $ne: true } }).lean()
    || (key === 'trial' ? null : null);
  return plan;
}

// Built-in fallback catalogue — identical defaults to
// backend/services/planService.js (DEFAULT_PLAN_CATALOG + ADDON_CATALOG).
// Used when the shared DB has no plan rows yet, and synced into DB rows
// so 12m / 6m / 3m / 1m pricing + ₹249 add-ons are always current.
const FALLBACK_PLANS = [
  { key: 'trial', name: 'Trial', description: '14-day evaluation — full product, single booth, instant printing & QR downloads.', price: 0, durationMonths: 0, durationLabel: '14 days', devices: 1, events: 1, discountType: 'none', discountValue: 0, kind: 'plan', priceMonthly: 0, priceQuarterly: 0, priceSemiannual: 0, priceAnnual: 0, aiCredits: 10 },
  { key: 'basic', name: 'Starter (Basic)', description: 'For event planners & freelancers: 2 devices included, 2 parallel events, unlimited sessions, live preview, instant printing, QR downloads and the operator dashboard.', price: 1099, durationMonths: 1, durationLabel: 'per month', devices: 2, events: 2, discountType: 'none', discountValue: 0, kind: 'plan', priceMonthly: 1099, priceQuarterly: 2847, priceSemiannual: 4794, priceAnnual: 5988, billingNote: 'excluding GST 18%', aiCredits: 25 },
  { key: 'pro', name: 'Pro (Growth)', description: 'For booth operators & wedding planners: 2 devices included, 4 parallel events, custom branding, premium templates and 30-day cloud gallery.', price: 1299, durationMonths: 1, durationLabel: 'per month', devices: 2, events: 4, discountType: 'none', discountValue: 0, kind: 'plan', priceMonthly: 1299, priceQuarterly: 3447, priceSemiannual: 5994, priceAnnual: 8388, billingNote: 'excluding GST 18%', aiCredits: 250 },
  { key: 'premium', name: 'Business (Premium)', description: 'For rental businesses: 2 devices included, 8 parallel events, analytics, AI templates with 500 credits, survey & lead capture and priority support.', price: 1499, durationMonths: 1, durationLabel: 'per month', devices: 2, events: 8, discountType: 'none', discountValue: 0, kind: 'plan', priceMonthly: 1499, priceQuarterly: 3897, priceSemiannual: 6594, priceAnnual: 9588, billingNote: 'excluding GST 18%', aiCredits: 500 },
  { key: 'custom', name: 'Enterprise (Custom)', description: 'Customisable — volume booths, custom term, dedicated success manager.', price: null, durationMonths: 0, durationLabel: 'Custom term', devices: 25, events: 20, discountType: 'none', discountValue: 0, kind: 'plan', priceMonthly: null, priceQuarterly: null, priceSemiannual: null, priceAnnual: null, aiCredits: 2500 },
  { key: 'addon-headshot', name: 'Professional Headshot Mode', description: 'Studio-style AI headshots for corporate events.', price: 249, durationMonths: 1, durationLabel: 'per add-on', devices: 0, events: 0, discountType: 'none', discountValue: 0, kind: 'addon', priceMonthly: 249, priceQuarterly: 249, priceSemiannual: 249, priceAnnual: 249, billingNote: 'per add-on · excluding GST 18%', aiCredits: 0 },
  { key: 'addon-video', name: 'Video Booth Mode', description: 'Video, GIF & boomerang capture with slow-motion.', price: 249, durationMonths: 1, durationLabel: 'per add-on', devices: 0, events: 0, discountType: 'none', discountValue: 0, kind: 'addon', priceMonthly: 249, priceQuarterly: 249, priceSemiannual: 249, priceAnnual: 249, billingNote: 'per add-on · excluding GST 18%', aiCredits: 0 },
  { key: 'addon-branding', name: 'Custom Start Screen Branding', description: 'Your own start screen, colours and sponsor logos.', price: 249, durationMonths: 1, durationLabel: 'per add-on', devices: 0, events: 0, discountType: 'none', discountValue: 0, kind: 'addon', priceMonthly: 249, priceQuarterly: 249, priceSemiannual: 249, priceAnnual: 249, billingNote: 'per add-on · excluding GST 18%', aiCredits: 0 },
  { key: 'addon-survey', name: 'Survey & Lead Capture', description: 'Guest surveys and marketing opt-ins built into the flow.', price: 249, durationMonths: 1, durationLabel: 'per add-on', devices: 0, events: 0, discountType: 'none', discountValue: 0, kind: 'addon', priceMonthly: 249, priceQuarterly: 249, priceSemiannual: 249, priceAnnual: 249, billingNote: 'per add-on · excluding GST 18%', aiCredits: 0 },
  { key: 'addon-music', name: 'Custom Music & Sound Effects', description: 'Event soundtracks and branded audio cues.', price: 249, durationMonths: 1, durationLabel: 'per add-on', devices: 0, events: 0, discountType: 'none', discountValue: 0, kind: 'addon', priceMonthly: 249, priceQuarterly: 249, priceSemiannual: 249, priceAnnual: 249, billingNote: 'per add-on · excluding GST 18%', aiCredits: 0 },
  { key: 'addon-props', name: 'Fun Event Props & Frames Pack', description: '30 props and 2 premium frames, unlocked forever.', price: 249, durationMonths: 1, durationLabel: 'one-time', devices: 0, events: 0, discountType: 'none', discountValue: 0, kind: 'addon', priceMonthly: 249, priceQuarterly: 249, priceSemiannual: 249, priceAnnual: 249, billingNote: 'one-time · excluding GST 18%', aiCredits: 0 },
  { key: 'addon-extra-device', name: 'Extra Booth Device Slot', description: 'Add 1 additional connected booth device to your active plan.', price: 249, durationMonths: 1, durationLabel: 'per add-on', devices: 0, events: 0, discountType: 'none', discountValue: 0, kind: 'addon', priceMonthly: 249, priceQuarterly: 249, priceSemiannual: 249, priceAnnual: 249, billingNote: 'per booth · excluding GST 18%', aiCredits: 0 },
  { key: 'addon-ai-1000', name: '1,000 AI Studio Credits Pack', description: 'Bulk credit pack for AI background removal & custom frame creation.', price: 249, durationMonths: 1, durationLabel: 'one-time', devices: 0, events: 0, discountType: 'none', discountValue: 0, kind: 'addon', priceMonthly: 249, priceQuarterly: 249, priceSemiannual: 249, priceAnnual: 249, billingNote: 'one-time pack · excluding GST 18%', aiCredits: 1000 },
];

const FALLBACK_BY_KEY = Object.fromEntries(FALLBACK_PLANS.map((p) => [p.key, p]));
let catalogSynced = false;

async function syncFallbackCatalogToDb() {
  if (catalogSynced) return;
  catalogSynced = true;
  try {
    for (const plan of FALLBACK_PLANS) {
      const existing = await SubscriptionPlan.findOne({ key: plan.key });
      if (!existing) {
        await SubscriptionPlan.create(plan);
      } else {
        const updates = {};
        for (const field of ['price', 'priceMonthly', 'priceQuarterly', 'priceSemiannual', 'priceAnnual', 'devices', 'events', 'kind', 'aiCredits', 'billingNote']) {
          if (plan[field] !== undefined && existing[field] !== plan[field]) {
            updates[field] = plan[field];
          }
        }
        if (Object.keys(updates).length > 0) {
          await SubscriptionPlan.updateOne({ _id: existing._id }, { $set: updates });
        }
      }
    }
  } catch {
    catalogSynced = false;
  }
}

async function listPublicPlans() {
  await syncFallbackCatalogToDb();
  const rows = await SubscriptionPlan.find({ active: { $ne: false }, isDeleted: { $ne: true } }).lean().catch(() => []);
  if (!rows || !rows.length) return FALLBACK_PLANS;
  // Overlay fallback multi-period fields if DB row predates 3m/6m/new pricing migration
  return rows.map((row) => {
    const fb = FALLBACK_BY_KEY[row.key];
    if (!fb) return row;
    return {
      ...fb,
      ...row,
      priceQuarterly: row.priceQuarterly ?? fb.priceQuarterly ?? null,
      priceSemiannual: row.priceSemiannual ?? fb.priceSemiannual ?? null,
    };
  });
}

// ─── Health + plans ──────────────────────────────────────────

router.get('/health', (req, res) => ok(res, { ok: true, service: 'happypix-website-backend', time: new Date().toISOString() }));

router.get('/plans', async (req, res) => {
  try {
    const rows = await listPublicPlans();
    const plans = rows.filter((row) => (row.kind || 'plan') !== 'addon');
    const addons = rows.filter((row) => row.kind === 'addon');
    return ok(res, {
      plans: plans.map((plan) => publicPlanView(plan)),
      addons: addons.map((plan) => publicPlanView(plan)),
      currency: 'INR',
    });
  } catch (error) {
    return fail(res, 500, 'Could not load plans right now.');
  }
});

// ─── Checkout: register-or-verify, then pay ──────────────────
//
// One form, two account paths (per product requirement):
//   • email is NEW → we register the account (after payment verifies)
//   • email EXISTS → the supplied password must match the existing
//     account; then this purchase renews/upgrades that organization

router.post('/checkout/order', checkoutLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const planKey = String(body.planKey || '').toLowerCase().trim();
    const organizationName = String(body.organizationName || '').trim();
    const ownerName = String(body.ownerName || body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');

    if (!planKey) return fail(res, 400, 'Please choose a plan.', 'PLAN_REQUIRED');
    if (!organizationName) return fail(res, 400, 'Organization name is required.', 'ORG_REQUIRED');
    if (!ownerName) return fail(res, 400, 'Your name is required.', 'NAME_REQUIRED');
    if (!EMAIL_RE.test(email)) return fail(res, 400, 'Enter a valid email address.', 'BAD_EMAIL');
    if (!phone) return fail(res, 400, 'Phone number is required.', 'PHONE_REQUIRED');
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return fail(res, 400, 'Please enter a valid 10-digit phone number.', 'BAD_PHONE');
    const last10Phone = cleanPhone.slice(-10);
    const phonePattern = new RegExp(last10Phone.split('').join('[\\s\\-\\(\\)]*') + '$');

    const policyError = passwordPolicyError(password);
    if (policyError) return fail(res, 400, policyError, 'WEAK_PASSWORD');

    const plans = await listPublicPlans();
    const plan = plans.find((row) => row.key === planKey && (row.kind || 'plan') !== 'addon');
    if (!plan) return fail(res, 404, 'That plan is not available.', 'PLAN_NOT_FOUND');
    if (plan.price == null) {
      return fail(res, 400, 'This plan is priced by our sales team — tell us about your requirement and we will set it up.', 'CONTACT_SALES');
    }

    // Billing period: monthly (1 month), quarterly (3 months), semiannual (6 months),
    // or annual (12 months upfront). The plan discount campaign applies on top of
    // the period price; add-ons are ₹249 each.
    const VALID_PERIODS = ['monthly', 'quarterly', 'semiannual', 'annual'];
    const billingPeriod = VALID_PERIODS.includes(body.billingPeriod) ? body.billingPeriod : 'monthly';
    const periodListPrice = periodPrice(plan, billingPeriod);
    if (periodListPrice == null) {
      return fail(res, 400, 'This plan is priced by our sales team — tell us about your requirement and we will set it up.', 'CONTACT_SALES');
    }
    const pricing = planPricing({ ...plan, price: periodListPrice });
    const addonKeys = Array.isArray(body.addonKeys) ? [...new Set(body.addonKeys.map((k) => String(k).toLowerCase().trim()))].slice(0, 10) : [];
    const addons = [];
    let addonsTotal = 0;
    for (const addonKey of addonKeys) {
      const addon = plans.find((row) => row.key === addonKey && row.kind === 'addon');
      if (!addon) return fail(res, 400, `Add-on “${addonKey}” is not available.`, 'ADDON_NOT_FOUND');
      const addonAmount = periodPrice(addon, billingPeriod) || 0;
      addons.push({ key: addon.key, name: addon.name, amount: addonAmount });
      addonsTotal += addonAmount;
    }
    const amount = (pricing.effectivePrice || 0) + addonsTotal;

    // ── Phone number uniqueness & anti-abuse checks ──
    const [existingUserWithPhone, existingOrgWithPhone] = await Promise.all([
      User.findOne({ phoneNumber: phonePattern }),
      Organization.findOne({ phone: phonePattern }),
    ]);

    // Check 1: Free Trial Abuse by Phone Number
    // A phone number can only ever be used for ONE free trial across the entire platform
    if (planKey === 'trial' || amount === 0) {
      if (existingUserWithPhone || existingOrgWithPhone) {
        return fail(
          res, 400,
          'This phone number has already been used for a HappyPix account or free trial. Each phone number is eligible for only one free trial. Please select a paid plan (Basic, Pro, or Premium) to continue.',
          'PHONE_TRIAL_ALREADY_USED',
        );
      }
    }

    // ── account resolution ──
    const existingUser = await User.findOne({ email });
    let existingOrganization = null;
    let passwordHash = null;
    let kind = 'new';

    if (existingUser) {
      const matches = await bcrypt.compare(password, existingUser.password || '');
      if (!matches) {
        return fail(
          res, 401,
          'This email is already registered, but the password does not match. Enter the password you use for the HappyPix CRM, or reset it there first.',
          'PASSWORD_MISMATCH',
        );
      }
      if (existingUser.status !== 'active') return fail(res, 403, 'This account is deactivated. Contact HappyPix support.', 'ACCOUNT_DEACTIVATED');

      // Free trial is strictly one-time per account — cannot be renewed
      if (planKey === 'trial' || amount === 0) {
        return fail(
          res, 400,
          'This account has already claimed a 14-day free trial. Free trials cannot be renewed. Please select a paid plan (Basic, Pro, or Premium) to continue.',
          'TRIAL_ALREADY_USED',
        );
      }

      // Check that the phone number doesn't belong to another user
      if (existingUserWithPhone && String(existingUserWithPhone._id) !== String(existingUser._id)) {
        return fail(
          res, 409,
          'This phone number is registered to a different account. Please use your registered phone number.',
          'PHONE_TAKEN_BY_OTHER',
        );
      }

      kind = 'renewal';
      if (existingUser.organizationId) {
        existingOrganization = await Organization.findById(existingUser.organizationId);
        if (existingOrganization && existingOrganization.status === 'banned') {
          return fail(res, 403, 'This organization has been banned. Contact HappyPix support.', 'ORG_BANNED');
        }
      }
    } else {
      // New user signup: phone number must be unique across all users and organizations
      if (existingUserWithPhone || existingOrgWithPhone) {
        return fail(
          res, 409,
          'This phone number is already registered with an existing account. Each account must have a unique phone number. Please sign in with your registered email, or provide a different phone number.',
          'PHONE_ALREADY_EXISTS',
        );
      }

      const orgWithEmail = await Organization.findOne({ email });
      if (orgWithEmail) {
        if (planKey === 'trial' || amount === 0) {
          return fail(
            res, 400,
            'This organization has already claimed a 14-day free trial. Free trials cannot be renewed. Please sign in to the CRM or select a paid plan.',
            'TRIAL_ALREADY_USED',
          );
        }
        // Org exists but no login for this email — don't guess; support can link it.
        return fail(res, 409, 'An organization with this email already exists. Sign in to the CRM to renew, or contact support to link this account.', 'ORG_EMAIL_EXISTS');
      }
      passwordHash = await bcrypt.hash(password, 10);
    }

    const checkout = await WebsiteCheckout.create({
      planKey: plan.key,
      planName: plan.name,
      billingPeriod,
      addons,
      originalAmount: (pricing.originalPrice || 0) + addonsTotal,
      discountAmount: pricing.discountAmount,
      discountType: pricing.discount.discountType,
      discountValue: pricing.discount.discountValue,
      discountLabel: pricing.discount.discountLabel,
      amount,
      organizationName,
      ownerName,
      phone,
      email,
      passwordHash,
      existingUserId: existingUser ? existingUser._id : null,
      existingOrganizationId: existingOrganization ? existingOrganization._id : null,
      kind: amount === 0 ? 'free' : kind,
    });

    // Free / fully-discounted / trial → activate immediately, no gateway.
    if (amount === 0) {
      const fullPlan = (await SubscriptionPlan.findOne({ key: plan.key }).lean()) || plan;
      const activated = await activateCheckout(checkout, fullPlan, {});
      return ok(res, {
        free: true,
        activated: true,
        invoiceNo: activated.subscription?.invoiceNo || null,
        organization: activated.organization ? { id: String(activated.organization._id), name: activated.organization.name } : null,
        plan: { key: plan.key, name: plan.name, endDate: activated.subscription?.endDate || null },
        isExistingAccount: kind === 'renewal',
        message: kind === 'renewal' ? 'Your plan has been renewed.' : 'Your HappyPix account is ready — sign in to the CRM to set up your first event.',
      });
    }

    const gateway = razorpay();
    if (!gateway) return fail(res, 503, 'Payments are not configured yet. Please contact HappyPix support.', 'PAYMENTS_NOT_CONFIGURED');

    let order;
    try {
      const sanitizedReceipt = `hpweb_${String(checkout._id).slice(-20)}`;
      order = await gateway.instance.orders.create({
        amount: Math.round(amount * 100), // paise
        currency: 'INR',
        receipt: sanitizedReceipt,
        notes: {
          planKey: String(plan.key || '').slice(0, 30),
          email: String(email || '').slice(0, 50),
          organizationName: String(organizationName || '').slice(0, 50),
          source: 'happypix-website',
        },
      });
    } catch (rzpError) {
      console.error('Razorpay order creation failed:', rzpError);
      const gatewayMessage =
        rzpError?.error?.description ||
        rzpError?.description ||
        rzpError?.message ||
        (typeof rzpError === 'string' ? rzpError : 'Razorpay order creation failed');
      return fail(res, 502, `Payment gateway error: ${gatewayMessage}`, 'PAYMENT_GATEWAY_ERROR');
    }

    checkout.razorpayOrderId = order.id;
    await checkout.save();

    const periodLabelMap = {
      monthly: '1 month (monthly)',
      quarterly: '3 months',
      semiannual: '6 months',
      annual: '12 months (annual)',
    };
    return ok(res, {
      free: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: gateway.keyId,
      plan: { key: plan.key, name: plan.name, durationLabel: periodLabelMap[billingPeriod] || '1 month' },
      billingPeriod,
      addons,
      pricing,
      isExistingAccount: kind === 'renewal',
      organizationName: existingOrganization ? existingOrganization.name : organizationName,
      prefill: { name: ownerName, email, contact: phone },
      description: `HappyPix ${plan.name} plan (${plan.durationLabel})`,
    });
  } catch (error) {
    console.error('checkout/order failed:', error);
    const detail =
      error?.error?.description ||
      error?.description ||
      error?.message ||
      (typeof error === 'string' ? error : 'Could not start checkout. Please try again.');
    return fail(res, 500, detail);
  }
});

router.post('/checkout/verify', checkoutLimiter, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return fail(res, 400, 'Payment details are incomplete.', 'BAD_PAYMENT');
    }
    const gateway = razorpay();
    if (!gateway) return fail(res, 503, 'Payments are not configured yet.', 'PAYMENTS_NOT_CONFIGURED');

    const expected = crypto
      .createHmac('sha256', gateway.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    const valid = expected.length === String(razorpay_signature).length
      && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(razorpay_signature)));
    if (!valid) return fail(res, 400, 'Payment verification failed. If money was deducted, contact support — do not pay again.', 'BAD_SIGNATURE');

    const checkout = await WebsiteCheckout.findOne({ razorpayOrderId: razorpay_order_id });
    if (!checkout) return fail(res, 404, 'Checkout not found.', 'CHECKOUT_NOT_FOUND');

    const plan = (await SubscriptionPlan.findOne({ key: checkout.planKey }).lean())
      || (await listPublicPlans()).find((row) => row.key === checkout.planKey);
    if (!plan) return fail(res, 404, 'That plan is no longer available.', 'PLAN_NOT_FOUND');

    const activated = await activateCheckout(checkout, plan, {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    return ok(res, {
      activated: true,
      invoiceNo: activated.subscription?.invoiceNo || checkout.invoiceNo,
      organization: activated.organization ? { id: String(activated.organization._id), name: activated.organization.name } : null,
      plan: {
        key: plan.key,
        name: plan.name,
        startDate: activated.subscription?.startDate || null,
        endDate: activated.subscription?.endDate || null,
      },
      isExistingAccount: checkout.kind === 'renewal',
      message: checkout.kind === 'renewal'
        ? 'Payment successful — your HappyPix plan has been renewed.'
        : 'Payment successful — your HappyPix account is ready. Sign in to the CRM with this email and password to set up your first event.',
    });
  } catch (error) {
    console.error('checkout/verify failed:', error);
    return fail(res, 500, 'Could not confirm the payment. If money was deducted, contact support with your payment id.');
  }
});

// ─── Guest downloads (the hidden /download/:id page) ─────────
// Valid for 24 hours from the booth session — enforced here on every
// read, not only by the Mongo TTL sweep.

function downloadState(download, now = new Date()) {
  if (!download) return { status: 404, error: 'This download link is invalid.' };
  if (new Date(download.expiresAt) <= now) {
    return { status: 410, error: 'This download link has expired. Digital copies are available for 24 hours after the booth session.', expired: true, expiresAt: download.expiresAt };
  }
  return null;
}

router.get('/downloads/:id', downloadLimiter, async (req, res) => {
  try {
    if (req.params.id === 'demo') {
      const now = Date.now();
      const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
      return ok(res, {
        downloadId: 'demo',
        compositeUrl: '/images/hero-booth.jpg',
        photoUrls: ['/images/hero-booth.jpg', '/images/wedding-booth.jpg', '/images/guests-party.jpg'],
        eventName: 'Kapur–Verma Sangeet Night',
        organizationName: 'HappyPix Studio Demo',
        createdAt: new Date(now).toISOString(),
        expiresAt,
        remainingMs: 24 * 60 * 60 * 1000,
        downloadCount: 0,
      });
    }
    const download = await GuestDownload.findOne({
      $or: [{ downloadId: req.params.id }, { sessionId: req.params.id }],
    });
    const state = downloadState(download);
    if (state) return fail(res, state.status, state.error, state.expired ? 'DOWNLOAD_EXPIRED' : 'DOWNLOAD_NOT_FOUND');

    download.viewCount = (download.viewCount || 0) + 1;
    await download.save();

    const [compositeUrl, photoUrls] = await Promise.all([
      signedPhotoUrl(download.compositeUrl),
      Promise.all((download.photoUrls || []).map((url) => signedPhotoUrl(url))),
    ]);
    const now = Date.now();
    return ok(res, {
      downloadId: download.downloadId,
      compositeUrl,
      photoUrls,
      eventName: download.eventName || '',
      organizationName: download.organizationName || '',
      createdAt: download.createdAt,
      expiresAt: download.expiresAt,
      remainingMs: Math.max(0, new Date(download.expiresAt).getTime() - now),
      downloadCount: download.downloadCount || 0,
    });
  } catch (error) {
    console.error('downloads/:id failed:', error);
    return fail(res, 500, 'Could not load this download.');
  }
});

// kind = 'composite' or a 0-based photo index. Redirects to a signed
// attachment URL (or streams data: URLs directly).
router.get('/downloads/:id/file/:kind', downloadLimiter, async (req, res) => {
  try {
    const download = await GuestDownload.findOne({
      $or: [{ downloadId: req.params.id }, { sessionId: req.params.id }],
    });
    const state = downloadState(download);
    if (state) return fail(res, state.status, state.error, state.expired ? 'DOWNLOAD_EXPIRED' : 'DOWNLOAD_NOT_FOUND');

    let raw = null;
    let name = 'happypix-photo.jpg';
    if (req.params.kind === 'composite') {
      raw = download.compositeUrl;
      name = 'happypix-final-print.jpg';
    } else {
      const index = Number.parseInt(req.params.kind, 10);
      raw = Number.isInteger(index) ? (download.photoUrls || [])[index] : null;
      name = `happypix-photo-${(index || 0) + 1}.jpg`;
    }
    if (!raw) return fail(res, 404, 'That file is not part of this download.');

    download.downloadCount = (download.downloadCount || 0) + 1;
    await download.save();

    if (raw.startsWith('data:')) {
      const match = raw.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return fail(res, 415, 'This file cannot be downloaded.');
      const buffer = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', match[1]);
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      return res.send(buffer);
    }

    if (raw.includes('/uploads/')) {
      try {
        const urlObj = new URL(raw, 'http://localhost:5000');
        const relativeUploadPath = urlObj.pathname.replace(/^\/uploads\//, '');
        const localPath = path.join(process.cwd(), '..', 'backend', 'uploads', relativeUploadPath);
        if (fs.existsSync(localPath)) {
          return res.download(localPath, name);
        }
      } catch {
        // Fall through to redirect
      }
      return res.redirect(302, raw);
    }

    const signed = await signedPhotoUrl(raw, { downloadName: name });
    return res.redirect(302, signed);
  } catch (error) {
    console.error('downloads file failed:', error);
    return fail(res, 500, 'Could not download this file.');
  }
});

// ─── Internal: mint a download (booth / other HappyPix services) ──
// The main backend already mints these on session completion; this is
// for other producers. Requires the shared internal secret — never
// expose it to a browser.
router.post('/internal/downloads', downloadLimiter, async (req, res) => {
  const secret = process.env.WEBSITE_INTERNAL_SECRET || '';
  const providedSecret = String(req.headers['x-internal-secret'] || '');
  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(providedSecret);

  if (!secret || secretBuf.length !== providedBuf.length || !crypto.timingSafeEqual(secretBuf, providedBuf)) {
    return fail(res, 401, 'Unauthorized.', 'BAD_INTERNAL_SECRET');
  }
  try {
    const { photoUrls = [], compositeUrl = null, eventName = '', organizationName = '', sessionId = null } = req.body || {};
    const urls = [...new Set((Array.isArray(photoUrls) ? photoUrls : []).filter(Boolean).map(String))];
    if (!compositeUrl && urls.length === 0) return fail(res, 400, 'Provide compositeUrl or photoUrls.');
    const downloadId = crypto.randomBytes(18).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const download = await GuestDownload.create({
      downloadId, compositeUrl, photoUrls: urls, eventName, organizationName, sessionId, expiresAt,
    });
    const base = String(process.env.WEBSITE_URL || '').replace(/\/+$/, '');
    return ok(res, { downloadId: download.downloadId, url: `${base}/download/${download.downloadId}`, expiresAt }, 201);
  } catch (error) {
    console.error('internal/downloads failed:', error);
    return fail(res, 500, 'Could not create the download.');
  }
});

// ─── Leads ───────────────────────────────────────────────────

router.post('/leads', checkoutLimiter, async (req, res) => {
  try {
    const { name, email, phone = '', company = '', message = '', type = 'contact' } = req.body || {};
    if (!String(name || '').trim()) return fail(res, 400, 'Your name is required.');
    if (!EMAIL_RE.test(String(email || '').toLowerCase().trim())) return fail(res, 400, 'Enter a valid email address.');
    const lead = await WebsiteLead.create({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      phone: String(phone).trim(),
      company: String(company).trim(),
      message: String(message).slice(0, 4000),
      type: ['demo', 'hardware', 'support'].includes(type) ? type : 'contact',
    });
    return ok(res, { received: true, id: String(lead._id), message: 'Thank you — the HappyPix team will get back within one business day.' }, 201);
  } catch (error) {
    console.error('leads failed:', error);
    return fail(res, 500, 'Could not send your message. Please try again.');
  }
});

export default router;
