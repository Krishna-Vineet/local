// Plan resolution — the single source of truth for an organization's
// effective plan, limits and computed plan status.
//
// Plan status is ALWAYS computed (never stored on the org):
//   suspended / banned  → from organization.status
//   not_subscribed      → no subscription and not on an active trial
//   trial               → sub.plan === 'trial' or amount === 0, not ended
//   expired             → endDate in the past
//   expiring_soon       → ends within 14 days
//   active              → everything else

import Subscription from '../models/Subscription.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import { DEFAULT_PLANS } from './constants.js';

const EXPIRING_SOON_DAYS = 14;

async function planCatalogEntry(key) {
  if (!key) return null;
  return SubscriptionPlan.findOne({ key }).lean();
}

export function fallbackPlan(key) {
  return DEFAULT_PLANS[key] || DEFAULT_PLANS.trial;
}

/**
 * Resolves the full plan context for an organization.
 * @returns {{ org, sub, planKey, planDef: {key,name,devices,events,price,durationMonths,durationLabel}, summary }}
 */
export async function resolvePlanContext(org, { now = new Date() } = {}) {
  const sub = await Subscription.findOne({ organizationId: org._id }).sort({ endDate: -1 }).lean();

  const planKey = sub?.plan || org.plan || 'trial';
  const catalog = await planCatalogEntry(planKey);
  const fb = fallbackPlan(planKey);
  const planDef = {
    key: planKey,
    name: catalog?.name || fb.name,
    devices: catalog?.devices ?? fb.devices,
    events: catalog?.events ?? fb.events,
    price: catalog?.price ?? fb.price ?? null,
    durationMonths: catalog?.durationMonths ?? fb.durationMonths,
    durationLabel: catalog?.durationLabel || (catalog?.durationMonths ? `${catalog.durationMonths} month${catalog.durationMonths === 1 ? '' : 's'}` : fb.durationMonths ? `${fb.durationMonths} month${fb.durationMonths === 1 ? '' : 's'}` : 'Custom term'),
  };

  const status = computePlanStatus(org, sub, now);
  const end = sub ? new Date(sub.extendedTo || sub.endDate || sub.endDate) : null;
  const start = sub ? new Date(sub.startDate) : null;
  const daysLeft = end ? Math.max(0, Math.ceil((end - now) / 86400000)) : null;

  const summary = {
    plan: planKey,
    planName: planDef.name,
    status,
    startDate: start ? start.toISOString() : null,
    endDate: end ? end.toISOString() : null,
    daysLeft,
    amount: sub ? sub.amount : 0,
    invoice: sub ? sub.invoiceNo || null : null,
    deviceLimit: planDef.devices,
    eventLimit: planDef.events,
  };

  return { org, sub, planKey, planDef, summary };
}

export function computePlanStatus(org, sub, now = new Date()) {
  if (!org) return 'not_subscribed';
  if (org.status === 'suspended') return 'suspended';
  if (org.status === 'banned') return 'banned';
  if (!sub) {
    // No purchase yet — trial only while trialEndsAt is in the future.
    if (org.trialEndsAt && new Date(org.trialEndsAt) > now) return 'trial';
    return 'not_subscribed';
  }
  const end = new Date(sub.extendedTo || sub.endDate);
  const start = new Date(sub.startDate);
  if (sub.plan === 'trial' || sub.amount === 0) {
    if (now > end) return 'expired';
    return 'trial';
  }
  if (now < start) return 'not_subscribed';
  if (now > end) return 'expired';
  if (end.getTime() - now.getTime() < EXPIRING_SOON_DAYS * 86400000) return 'expiring_soon';
  return 'active';
}

/**
 * Whether create/assign mutations are blocked for this org
 * (suspended, banned or an expired plan).
 */
export function planBlocked(summary) {
  return ['suspended', 'banned', 'expired'].includes(summary?.status);
}

/**
 * Effective layout price map for an organization:
 * suggested defaults ← org defaults overrides ← explicit event snapshot.
 * Mongoose Maps are converted to plain objects.
 */
export function effectiveLayoutPrices(orgDefaultsDoc, eventPricesMap, { suggested } = {}) {
  const out = { ...(suggested || {}) };
  const defaults = orgDefaultsDoc?.layoutPrices;
  if (defaults) {
    const src = defaults instanceof Map ? Object.fromEntries(defaults) : defaults;
    Object.assign(out, src);
  }
  if (eventPricesMap) {
    const src = eventPricesMap instanceof Map ? Object.fromEntries(eventPricesMap) : eventPricesMap;
    Object.assign(out, src);
  }
  return out;
}
