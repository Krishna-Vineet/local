// ============================================================
// Plan & subscription limits — the ONLY place device/event limits
// are decided (issue #5: no hard-coded limits anywhere else).
//
// Limits come from the organization's assigned subscription plan:
//   * the `SubscriptionPlan` collection when the plan exists in CRM
//   * otherwise the built-in catalogue below (Trial → Enterprise/custom)
// ============================================================

import SubscriptionPlan from '../models/SubscriptionPlan.js';
import { conflict, sendError } from '../utils/httpError.js';

// The plan catalogue (Basic / Pro / Premium / Custom + Trial) and the
// add-on catalogue. `devices`/`events` are the plan limits used for
// enforcement + display. Pricing is dual-currency, monthly or annual:
//
//   Basic    ₹799/mo or ₹5,988/yr (₹499/mo)  ·  A$15/mo or A$144/yr (A$12/mo)
//   Pro      ₹999/mo or ₹9,588/yr (₹799/mo)  ·  A$20/mo or A$180/yr (A$15/mo)
//   Premium  ₹1,299/mo or ₹11,988/yr (₹999/mo) · A$25/mo or A$240/yr (A$20/mo)
//            + AI templates with 500 credits
//   Add-ons  priced per add-on in the CRM catalogue — props pack is one-time.
//
// `price` mirrors the INR monthly price for legacy readers; website and
// checkout use priceMonthly/priceAnnual (+ AUD twins).
export const DEFAULT_PLAN_CATALOG = [
  {
    key: 'trial',
    name: 'Trial',
    description: '14-day evaluation — full product, single booth, instant printing & QR downloads.',
    price: 0,
    durationMonths: 0,
    durationLabel: '14 days',
    devices: 1,
    events: 1,
    active: true,
    kind: 'plan',
    priceMonthly: 0,
    priceAnnual: 0,
    aiCredits: 10,
  },
  {
    key: 'basic',
    name: 'Basic',
    description: 'For solo event planners & freelancers: 2 booths, 2 parallel events, unlimited sessions, instant printing, QR downloads and operator dashboard.',
    price: 799,
    durationMonths: 1,
    durationLabel: 'per month',
    devices: 2,
    events: 2,
    active: true,
    kind: 'plan',
    priceMonthly: 799,
    priceAnnual: 5988,
    aiCredits: 25,
  },
  {
    key: 'pro',
    name: 'Pro',
    description: 'For booth operators & wedding planners: 2 booths included, 4 parallel events, custom branding, AI templates (250 credits), and 30-day cloud gallery.',
    price: 999,
    durationMonths: 1,
    durationLabel: 'per month',
    devices: 2,
    events: 4,
    active: true,
    kind: 'plan',
    priceMonthly: 999,
    priceAnnual: 9588,
    aiCredits: 250,
  },
  {
    key: 'premium',
    name: 'Premium',
    description: 'For rental businesses & fleets: 2 booths included, 8 parallel events, analytics, AI templates with 500 credits, own payment gateways, and priority support.',
    price: 1299,
    durationMonths: 1,
    durationLabel: 'per month',
    devices: 2,
    events: 8,
    active: true,
    kind: 'plan',
    priceMonthly: 1299,
    priceAnnual: 11988,
    aiCredits: 500,
  },
  {
    key: 'custom',
    name: 'Enterprise',
    description: 'Custom fleet scale — 25+ volume booths, custom limits, dedicated success manager, and white-label branding.',
    price: null,
    durationMonths: 0,
    durationLabel: 'Custom term',
    devices: 25,
    events: 20,
    active: true,
    kind: 'plan',
    priceMonthly: null,
    priceAnnual: null,
    aiCredits: 2500,
  },
];

// Add-ons: priced per add-on in the catalogue, props pack one-time. Sold alongside any
// plan; managed in the same CRM catalogue (kind: 'addon').
export const ADDON_CATALOG = [
  { key: 'addon-headshot', name: 'Professional Headshot Mode', description: 'Studio-style AI headshots for corporate events.', priceMonthly: 299, priceAnnual: 2990, billingNote: 'per user / month' },
  { key: 'addon-video', name: 'Video Booth Mode', description: 'Video, GIF & boomerang capture with slow-motion.', priceMonthly: 299, priceAnnual: 2990, billingNote: 'per user / month' },
  { key: 'addon-branding', name: 'Custom Start Screen Branding', description: 'Your own start screen, colours and sponsor logos.', priceMonthly: 299, priceAnnual: 2990, billingNote: 'per user / month' },
  { key: 'addon-survey', name: 'Survey & Lead Capture', description: 'Guest surveys and marketing opt-ins built into the flow.', priceMonthly: 299, priceAnnual: 2990, billingNote: 'per user / month' },
  { key: 'addon-music', name: 'Custom Music & Sound Effects', description: 'Event soundtracks and branded audio cues.', priceMonthly: 299, priceAnnual: 2990, billingNote: 'per user / month' },
  { key: 'addon-props', name: 'Fun Event Props & Frames Pack', description: '30 props and 2 premium frames, unlocked forever.', priceMonthly: 2999, priceAnnual: 2999, billingNote: 'one-time' },
  { key: 'addon-extra-device', name: 'Extra Booth Device Slot', description: 'Add 1 additional connected booth device to your active plan.', priceMonthly: 499, priceAnnual: 4990, billingNote: 'per booth / month' },
  { key: 'addon-ai-1000', name: '1,000 AI Studio Credits Pack', description: 'Bulk credit pack for AI background removal & custom frame creation.', priceMonthly: 999, priceAnnual: 999, billingNote: 'one-time pack', aiCredits: 1000 },
].map((addon) => ({
  ...addon,
  description: addon.description,
  price: addon.priceMonthly,
  durationMonths: 1,
  durationLabel: 'per month',
  devices: 0,
  events: 0,
  active: true,
  kind: 'addon',
  aiCredits: addon.aiCredits || 0,
}));

const DEFAULT_BY_KEY = Object.fromEntries(DEFAULT_PLAN_CATALOG.map((plan) => [plan.key, plan]));

// ─── Plan discounts ────────────────────────────────────────────
// A plan may carry ONE discount campaign, managed from the platform CRM
// (Subscription Plans page):
//   discountType  'none' | 'percent' (% off) | 'flat' (₹ off — "static")
//   discountValue the percent (1–100) or the flat ₹ amount
//   discountStartsAt / discountEndsAt — the discount *duration* window.
//   Either bound may be null (open-ended on that side).
// The discount applies only while `now` is inside the window. All price
// maths lives here so CRM, checkout and the public website never disagree.

export const NO_DISCOUNT = Object.freeze({
  discountType: 'none',
  discountValue: 0,
  discountLabel: '',
  discountStartsAt: null,
  discountEndsAt: null,
  discountMaxRedemptions: 0,
});

// Catalogue plans start with no discount; platform admins add campaigns.
for (const plan of DEFAULT_PLAN_CATALOG) {
  plan.discountType = plan.discountType || NO_DISCOUNT.discountType;
  plan.discountValue = plan.discountValue ?? NO_DISCOUNT.discountValue;
  plan.discountLabel = plan.discountLabel ?? NO_DISCOUNT.discountLabel;
  plan.discountStartsAt = plan.discountStartsAt ?? null;
  plan.discountEndsAt = plan.discountEndsAt ?? null;
}

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Normalise the discount fields of a raw plan row/catalogue entry. */
export function normalizeDiscount(plan = {}) {
  const type = ['percent', 'flat'].includes(plan.discountType) ? plan.discountType : 'none';
  const value = Number(plan.discountValue);
  const maxRedemptions = Number(plan.discountMaxRedemptions);
  return {
    discountType: type,
    discountValue: type === 'none' || !Number.isFinite(value) || value < 0 ? 0 : value,
    discountLabel: String(plan.discountLabel || '').trim(),
    discountStartsAt: toDateOrNull(plan.discountStartsAt),
    discountEndsAt: toDateOrNull(plan.discountEndsAt),
    // Client-count cap: the campaign stops after this many purchases
    // (0/absent = unlimited). `discountRedemptions` on the plan row is
    // the live counter, incremented by checkout on each activation.
    discountMaxRedemptions: Number.isFinite(maxRedemptions) && maxRedemptions > 0 ? Math.floor(maxRedemptions) : 0,
    discountRedemptions: Math.max(0, Math.floor(Number(plan.discountRedemptions) || 0)),
  };
}

/** Is the plan's discount campaign live at `now`? */
export function isDiscountActive(plan = {}, now = new Date()) {
  const discount = normalizeDiscount(plan);
  if (discount.discountType === 'none' || discount.discountValue <= 0) return false;
  if (plan.price == null || Number(plan.price) <= 0) return false; // free / contact-sales
  const at = now instanceof Date ? now : new Date(now);
  // Time-based window
  if (discount.discountStartsAt && at < discount.discountStartsAt) return false;
  if (discount.discountEndsAt && at > discount.discountEndsAt) return false;
  // Number-of-clients cap
  if (discount.discountMaxRedemptions > 0 && discount.discountRedemptions >= discount.discountMaxRedemptions) return false;
  return true;
}

/**
 * Full pricing picture for one plan at `now`.
 * Returns { price, originalPrice, effectivePrice, discountAmount,
 *           discountPercent, discount: {...normalised, active} }.
 * `price`/`originalPrice` are the list price (null = contact sales);
 * `effectivePrice` is what a buyer pays right now.
 */
export function planPricing(plan = {}, now = new Date()) {
  const discount = normalizeDiscount(plan);
  const active = isDiscountActive(plan, now);
  const listPrice = plan.price == null ? null : Number(plan.price);
  let discountAmount = 0;
  if (active && listPrice != null && listPrice > 0) {
    discountAmount = discount.discountType === 'percent'
      ? Math.round((listPrice * Math.min(100, discount.discountValue)) / 100)
      : Math.min(listPrice, Math.round(discount.discountValue));
  }
  const effectivePrice = listPrice == null ? null : Math.max(0, listPrice - discountAmount);
  return {
    price: listPrice,
    originalPrice: listPrice,
    effectivePrice,
    discountAmount,
    discountPercent: listPrice && discountAmount > 0
      ? Math.round((discountAmount / listPrice) * 100)
      : 0,
    discount: {
      ...discount,
      discountStartsAt: discount.discountStartsAt ? discount.discountStartsAt.toISOString() : null,
      discountEndsAt: discount.discountEndsAt ? discount.discountEndsAt.toISOString() : null,
      active,
    },
  };
}

/**
 * Validate + normalise discount input from an admin/checkout request body.
 * Throws an Error with .status/.code (same shape as utils/httpError).
 */
export function parseDiscountInput(body = {}, listPrice) {
  const discount = normalizeDiscount({
    discountType: body.discountType,
    discountValue: body.discountValue,
    discountLabel: body.discountLabel,
    discountStartsAt: body.discountStartsAt || null,
    discountEndsAt: body.discountEndsAt || null,
    discountMaxRedemptions: body.discountMaxRedemptions,
    discountRedemptions: body.discountRedemptions,
  });
  const fail = (message) => {
    throw Object.assign(new Error(message), { status: 400, code: 'BAD_PLAN_DISCOUNT' });
  };
  if (discount.discountType === 'percent') {
    if (!(discount.discountValue > 0 && discount.discountValue <= 100)) {
      fail('Percent discount must be between 1 and 100.');
    }
  }
  if (discount.discountType === 'flat') {
    if (!(discount.discountValue > 0)) fail('Flat discount must be more than ₹0.');
    if (listPrice != null && listPrice > 0 && discount.discountValue >= listPrice) {
      fail('Flat discount must be less than the plan price.');
    }
    if (listPrice == null || listPrice === 0) {
      fail('A flat discount needs a priced plan (not free / contact-sales).');
    }
  }
  if (discount.discountType === 'percent' && (listPrice == null || listPrice === 0)) {
    fail('A percent discount needs a priced plan (not free / contact-sales).');
  }
  if (discount.discountStartsAt && discount.discountEndsAt
      && discount.discountEndsAt <= discount.discountStartsAt) {
    fail('Discount end must be after its start.');
  }
  return discount;
}

const TRIAL_DAYS = 14;
const EXPIRING_SOON_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

let cache = { at: 0, plans: null };
const CACHE_MS = 30 * 1000;

/** All plan definitions: DB rows (if any) overlaid on the built-in catalogue. */
export async function listPlans({ fresh = false } = {}) {
  if (!fresh && cache.plans && Date.now() - cache.at < CACHE_MS) return cache.plans;
  let rows = [];
  try {
    rows = await SubscriptionPlan.find().lean();
  } catch (error) {
    rows = []; // DB unavailable → built-in catalogue still works
  }
  const byKey = new Map(
    [...DEFAULT_PLAN_CATALOG, ...ADDON_CATALOG].map((plan) => [plan.key, { ...plan }]),
  );
  for (const row of rows) {
    const key = String(row.key || row.name || '').toLowerCase();
    if (!key) continue;
    if (row.isDeleted) {
      byKey.delete(key);
      continue;
    }
    byKey.set(key, {
      ...(byKey.get(key) || {}),
      ...row,
      key,
      devices: toLimit(row.devices, byKey.get(key)?.devices),
      events: toLimit(row.events, byKey.get(key)?.events),
    });
  }
  const plans = [...byKey.values()];
  cache = { at: Date.now(), plans };
  return plans;
}

function toLimit(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return fallback ?? 1;
  return Math.floor(number);
}

/** Resolve the definition for one plan key (DB first, then catalogue). */
export async function resolvePlan(key) {
  const wanted = String(key || 'trial').toLowerCase();
  const plans = await listPlans();
  return plans.find((plan) => plan.key === wanted) || DEFAULT_BY_KEY[wanted] || DEFAULT_BY_KEY.trial;
}

/**
 * Billing-period prices (₹ only). Monthly = pay per month; annual =
 * one upfront payment for 12 months (perMonth = annual / 12).
 * Discounts apply on top of the period price via planPricing.
 */
export function billingPrices(plan = {}) {
  const num = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const monthly = num(plan.priceMonthly ?? plan.price);
  const annual = num(plan.priceAnnual ?? (monthly != null ? monthly * 12 : null));
  return {
    kind: plan.kind || 'plan',
    aiCredits: Number(plan.aiCredits) || 0,
    billingNote: plan.billingNote || '',
    inr: {
      monthly,
      annual,
      annualPerMonth: annual != null ? Math.round(annual / 12) : null,
    },
  };
}

/** Synchronous fallback (booth snapshot hot path, seeds, tests). */
export function planSync(key) {
  const wanted = String(key || 'trial').toLowerCase();
  return (cache.plans && cache.plans.find((plan) => plan.key === wanted)) || DEFAULT_BY_KEY[wanted] || DEFAULT_BY_KEY.trial;
}

/** Issues #3, #5, #56: the org's real limits (plan + active add-ons). */
export async function orgLimits(org) {
  const plan = await resolvePlan(org && org.plan);
  const now = new Date();
  const activeAddons = Array.isArray(org?.addons)
    ? org.addons.filter((a) => !a.expiresAt || new Date(a.expiresAt) > now)
    : [];
  const extraDevices = activeAddons.filter((a) => a.key === 'addon-extra-device').length;
  const baseDevices = plan.devices;
  const totalDevices = Math.max(baseDevices + extraDevices, Number(org?.allowedDevices) || 0);
  const totalEvents = Math.max(plan.events, Number(org?.allowedEvents) || 0);

  return {
    plan: plan.key,
    planName: plan.name,
    baseDevices,
    extraDevices,
    devices: totalDevices,
    events: totalEvents,
    activeAddons,
    durationLabel: plan.durationLabel,
    price: plan.price,
    pricing: planPricing(plan),
  };
}

/** Issue #3: derive plan status the same way the CRM mock does. */
export function computePlanStatus(org, subscription) {
  if (!org) return 'not_subscribed';
  if (org.status === 'suspended') return 'suspended';
  if (org.status === 'banned') return 'banned';
  if (!subscription) {
    if (org.trialEndsAt && new Date() < new Date(org.trialEndsAt)) return 'trial';
    return 'not_subscribed';
  }
  const now = Date.now();
  const start = subscription.startDate ? new Date(subscription.startDate).getTime() : 0;
  const end = new Date(subscription.extendedTo || subscription.endDate || 0).getTime();
  const isTrial = subscription.plan === 'trial' || Number(subscription.amount) === 0;
  if (isTrial) return now > end ? 'expired' : 'trial';
  if (start && now < start) return 'not_subscribed';
  if (now > end) return 'expired';
  if (end - now < EXPIRING_SOON_DAYS * DAY_MS) return 'expiring_soon';
  return 'active';
}

/** The `plan` block every CRM screen reads (#3, #56). */
export async function planSummary(org, subscription) {
  const limits = await orgLimits(org);
  const status = computePlanStatus(org, subscription);
  const end = subscription
    ? new Date(subscription.extendedTo || subscription.endDate || 0)
    : org && org.trialEndsAt
      ? new Date(org.trialEndsAt)
      : null;
  const start = subscription && subscription.startDate
    ? new Date(subscription.startDate)
    : org && org.createdAt
      ? new Date(org.createdAt)
      : null;
  const daysLeft = end && !Number.isNaN(end.getTime())
    ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY_MS))
    : null;
  return {
    plan: limits.plan,
    planName: limits.planName,
    status,
    startDate: start && !Number.isNaN(start.getTime()) ? start.toISOString() : null,
    endDate: end && !Number.isNaN(end.getTime()) ? end.toISOString() : null,
    daysLeft,
    amount: subscription ? Number(subscription.amount) || 0 : 0,
    invoice: subscription ? subscription.invoiceNo || null : null,
    deviceLimit: limits.devices,
    baseDeviceLimit: limits.baseDevices,
    extraDeviceLimit: limits.extraDevices,
    eventLimit: limits.events,
    activeAddons: limits.activeAddons,
    aiCredits: Number(org?.aiCredits) || 0,
  };
}

export function trialEndDate(from = new Date()) {
  return new Date(from.getTime() + TRIAL_DAYS * DAY_MS);
}

// ─── Limit enforcement ─────────────────────────────────────────

export class PlanLimitError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'PlanLimitError';
    this.status = 409;
    this.code = 'PLAN_LIMIT_REACHED';
    this.details = details;
  }
  send(res) {
    return sendError(res, this);
  }
}

/**
 * Issue #5/#55: enforce the device limit before creating, registering or
 * assigning a device. `used` counts devices that already exist for the org.
 */
export async function assertDeviceLimit(org, used, { extra = 0 } = {}) {
  const limits = await orgLimits(org);
  if (used + extra >= limits.devices) {
    throw new PlanLimitError(
      `Your ${limits.planName} plan allows ${limits.devices} connected device${limits.devices === 1 ? '' : 's'} (${used} in use). Upgrade the plan to add more booths.`,
      { limit: limits.devices, used, resource: 'devices', plan: limits.plan },
    );
  }
  return limits;
}

/** Issue #5/#55: enforce the parallel active-event limit before creating one. */
export async function assertEventLimit(org, usedActiveEvents, { extra = 0 } = {}) {
  const limits = await orgLimits(org);
  if (usedActiveEvents + extra >= limits.events) {
    throw new PlanLimitError(
      `Your ${limits.planName} plan allows ${limits.events} active event${limits.events === 1 ? '' : 's'} at a time (${usedActiveEvents} running). Pause or finish an event, or upgrade the plan.`,
      { limit: limits.events, used: usedActiveEvents, resource: 'events', plan: limits.plan },
    );
  }
  return limits;
}

/** Guard used by write routes when the plan itself is no longer valid. */
export function assertPlanUsable(org, planStatus) {
  if (org && org.status === 'banned') {
    throw conflict('This organization is banned. Contact HappyPix support.', 'ORG_BANNED');
  }
  if (org && org.status === 'suspended') {
    throw conflict('This organization is suspended — changes are disabled until it is restored.', 'ORG_SUSPENDED');
  }
  if (planStatus === 'expired') {
    throw conflict('The subscription has expired. Renew the plan to enable this action.', 'PLAN_EXPIRED');
  }
  return true;
}

export default {
  DEFAULT_PLAN_CATALOG, ADDON_CATALOG, listPlans, resolvePlan, planSync, orgLimits, planSummary,
  computePlanStatus, assertDeviceLimit, assertEventLimit, assertPlanUsable, trialEndDate,
  normalizeDiscount, isDiscountActive, planPricing, billingPrices, parseDiscountInput, NO_DISCOUNT,
  PlanLimitError,
};
