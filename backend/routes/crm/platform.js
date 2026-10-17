// ============================================================
// Platform workspace API — v2 contract, real persistence.
//
// Fixes covered here:
//   #1/#2  suspend (read-only) vs ban (immediate lockout + session kill)
//   #3/#4/#5 plans: real limit definitions, real subscription state
//   #8/#9/#11 Platform Team & Roles accessible to Platform Admin and
//             Support Manager, read-only; Owner manages
//   #12/#13 gallery settings permission
//   #16–#20 gallery policy persisted, propagated to orgs + booths
//   #21–#25 audit logs with actor, real `at` timestamp, severity, IP
//   #37–#39 platform support request lifecycle
//   #118/#119 no placeholder responses — everything reads/writes Mongo
// ============================================================

import express from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';

import {
  authenticate, requirePerm, requireWritableOrg, bumpSessionVersion,
} from '../../middleware/auth.js';
import { ROLES, PERMS, normalizeRole, isPlatformTeamReadOnly } from '../../config/permissions.js';
import Organization from '../../models/Organization.js';
import OrganizationDefaults from '../../models/OrganizationDefaults.js';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Device from '../../models/Device.js';
import Subscription from '../../models/Subscription.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Template from '../../models/Template.js';
import TemplateLayout from '../../models/TemplateLayout.js';
import PlatformSupportRequest from '../../models/PlatformSupportRequest.js';
import AuditLog from '../../models/AuditLog.js';
import Payment from '../../models/Payment.js';

import { writeAudit, auditView, byAtDesc } from '../../utils/auditLogger.js';
import { asyncRoute, badRequest, conflict, notFound, forbidden } from '../../utils/httpError.js';
import {
  listPlans, planSummary, computePlanStatus, DEFAULT_PLAN_CATALOG, ADDON_CATALOG, trialEndDate,
  planPricing, billingPrices, parseDiscountInput, normalizeDiscount,
} from '../../services/planService.js';
import { getGallerySettings, saveGallerySettings } from '../../services/gallerySettingsService.js';
import { computeEventStatus, isDeviceOnline } from '../../services/eventService.js';
import { layoutMeta, resolveLayoutPrices } from '../../config/layouts.js';

const router = express.Router();

// Every route needs a platform role.
router.use(authenticate, requirePerm(PERMS.PLATFORM_DASHBOARD_VIEW));

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── helpers ───────────────────────────────────────────────────

function paginate(items, { page = 1, limit = 10 } = {}) {
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, parseInt(limit, 10) || 10);
  return {
    items: items.slice((currentPage - 1) * perPage, currentPage * perPage),
    total: items.length,
    page: currentPage,
    pages: Math.max(1, Math.ceil(items.length / perPage)),
  };
}

async function subscriptionOf(organizationId) {
  return Subscription.findOne({ organizationId }).sort({ createdAt: -1 });
}

async function organizationRow(org, subscriptions = null) {
  const subs = subscriptions || await Subscription.find({ organizationId: org._id }).sort({ createdAt: -1 }).lean();
  const sub = subs.find((row) => String(row.organizationId) === String(org._id));
  const plan = await planSummary(org, sub);
  const [devices, events] = await Promise.all([
    Device.find({ organizationId: org._id }).lean(),
    Event.find({ organizationId: org._id }).lean(),
  ]);
  const owner = await User.findOne({ organizationId: org._id, role: ROLES.ORG_ADMIN }).select('name email').lean();
  return {
    id: String(org._id),
    name: org.name,
    ownerName: org.ownerName || (owner && owner.name) || 'Unknown',
    email: org.email || (owner && owner.email) || 'N/A',
    phone: org.phone || '',
    country: org.country || 'IN',
    plan: org.plan,
    planName: plan.planName,
    planStatus: plan.status,
    planExpiry: plan.endDate,
    planDaysLeft: plan.daysLeft,
    status: org.status,
    suspendReason: org.suspendReason || null,
    devices: devices.length,
    onlineDevices: devices.filter((device) => isDeviceOnline(device)).length,
    activeEvents: events.filter((event) => computeEventStatus(event) === 'active').length,
    totalEvents: events.length,
    deviceLimit: plan.deviceLimit,
    eventLimit: plan.eventLimit,
    createdAt: org.createdAt ? new Date(org.createdAt).toISOString() : null,
    lastActiveAt: devices.reduce((latest, device) => {
      const at = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
      return at > latest ? at : latest;
    }, 0) || null,
  };
}

// ================================================================
// DASHBOARD
// ================================================================

router.get('/dashboard', requirePerm(PERMS.PLATFORM_DASHBOARD_VIEW), asyncRoute(async (req, res) => {
  const [orgs, devices, events, subscriptions] = await Promise.all([
    Organization.find().lean(),
    Device.find().lean(),
    Event.find().lean(),
    Subscription.find().lean(),
  ]);

  const planStatusOf = (org) => computePlanStatus(org, subscriptions.find((sub) => String(sub.organizationId) === String(org._id)));
  const online = devices.filter((device) => isDeviceOnline(device)).length;

  const rows = await Promise.all(orgs.map(async (org) => {
    const plan = await planSummary(org, subscriptions.find((sub) => String(sub.organizationId) === String(org._id)));
    const deviceUsed = devices.filter((device) => String(device.organizationId) === String(org._id)).length;
    const eventUsed = events.filter((event) => String(event.organizationId) === String(org._id) && computeEventStatus(event) === 'active').length;
    return { org, plan, deviceUsed, eventUsed };
  }));

  const expiringSoon = rows
    .filter((row) => row.plan.status === 'expiring_soon')
    .sort((a, b) => (a.plan.daysLeft ?? 0) - (b.plan.daysLeft ?? 0));
  const nearLimits = rows.filter((row) =>
    row.deviceUsed >= row.plan.deviceLimit * 0.8 || row.eventUsed >= row.plan.eventLimit * 0.8);

  const alerts = [
    ...expiringSoon.map((row) => ({
      kind: 'plan_expiring',
      text: `${row.org.name}: ${row.plan.planName} plan expires in ${row.plan.daysLeft} day(s)`,
      tone: 'warn',
    })),
    ...orgs.filter((org) => org.status === 'suspended').map((org) => ({
      kind: 'suspended', text: `Organization ${org.name} is suspended`, tone: 'warn',
    })),
    ...orgs.filter((org) => org.status === 'banned').map((org) => ({
      kind: 'banned', text: `Organization ${org.name} is banned`, tone: 'danger',
    })),
  ].slice(0, 6);

  res.json({
    orgs: {
      total: orgs.length,
      active: orgs.filter((org) => planStatusOf(org) === 'active').length,
      trial: orgs.filter((org) => planStatusOf(org) === 'trial').length,
      suspended: orgs.filter((org) => org.status === 'suspended').length,
      banned: orgs.filter((org) => org.status === 'banned').length,
    },
    devices: { total: devices.length, online, offline: devices.length - online, operational: devices.filter((device) => device.status === 'active').length },
    events: {
      active: events.filter((event) => computeEventStatus(event) === 'active').length,
      upcoming: events.filter((event) => computeEventStatus(event) === 'upcoming').length,
      finished: events.filter((event) => computeEventStatus(event) === 'finished').length,
    },
    expiringSoon: expiringSoon.map((row) => ({ id: String(row.org._id), name: row.org.name, plan: row.plan.planName, status: row.plan.status, daysLeft: row.plan.daysLeft })),
    nearLimits: nearLimits.map((row) => ({
      id: String(row.org._id), name: row.org.name,
      deviceUsed: row.deviceUsed, deviceLimit: row.plan.deviceLimit,
      eventUsed: row.eventUsed, eventLimit: row.plan.eventLimit,
    })),
    recentSignups: [...orgs]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((org) => {
        const sub = subscriptions.find((row) => String(row.organizationId) === String(org._id));
        return {
          id: String(org._id), name: org.name, createdAt: org.createdAt,
          plan: sub ? (sub.plan || 'trial') : 'trial',
        };
      }),
    alerts,
  });
}));

// ================================================================
// REVENUE (subscription revenue)
// ================================================================

router.get('/revenue', requirePerm(PERMS.PLATFORM_REVENUE_VIEW), asyncRoute(async (req, res) => {
  const [subscriptions, organizations] = await Promise.all([
    Subscription.find().lean(),
    Organization.find().lean(),
  ]);
  const paid = subscriptions.filter((sub) => Number(sub.amount) > 0 && sub.status !== 'failed');
  const now = new Date();
  const fyStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidAt = (sub) => new Date(sub.paidAt || sub.createdAt || sub.startDate);

  const months = [];
  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const start = date;
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleString('en-IN', { month: 'short' }),
      value: paid.filter((sub) => { const at = paidAt(sub); return at >= start && at < end; }).reduce((sum, sub) => sum + sub.amount, 0),
    });
  }

  const quarters = [0, 1, 2, 3].map((index) => ({
    label: `Q${index + 1}`,
    value: paid
      .filter((sub) => {
        const at = paidAt(sub);
        const fyYear = at.getMonth() >= 3 ? at.getFullYear() : at.getFullYear() - 1;
        return fyYear === fyStart.getFullYear() && Math.floor(((at.getMonth() + 9) % 12) / 3) === index;
      })
      .reduce((sum, sub) => sum + sub.amount, 0),
  }));

  const rows = organizations.map((org) => {
    const sub = paid.filter((row) => String(row.organizationId) === String(org._id))
      .sort((a, b) => paidAt(b) - paidAt(a))[0];
    return {
      id: String(org._id),
      name: org.name,
      email: org.email,
      plan: org.plan,
      planStatus: computePlanStatus(org, sub),
      expiry: sub ? new Date(sub.endDate).toISOString() : null,
      daysLeft: sub ? Math.max(0, Math.ceil((new Date(sub.endDate) - now) / DAY_MS)) : null,
      revenue: sub ? sub.amount : 0,
      revenueThisMonth: sub && paidAt(sub) >= monthStart ? sub.amount : 0,
      revenueFY: sub && paidAt(sub) >= fyStart ? sub.amount : 0,
    };
  });

  res.json({
    net: paid.reduce((sum, sub) => sum + sub.amount, 0),
    fyRevenue: paid.filter((sub) => paidAt(sub) >= fyStart).reduce((sum, sub) => sum + sub.amount, 0),
    monthRevenue: paid.filter((sub) => paidAt(sub) >= monthStart).reduce((sum, sub) => sum + sub.amount, 0),
    monthWise: months.map((month) => ({ ...month })),
    quarterWise: quarters,
    orgs: rows,
    yearOptions: [now.getFullYear(), now.getFullYear() - 1],
  });
}));

// ================================================================
// ORGANIZATIONS
// ================================================================

router.get('/organizations', requirePerm(PERMS.PLATFORM_ORGS_VIEW), asyncRoute(async (req, res) => {
  const orgs = await Organization.find().sort({ createdAt: -1 }).lean();
  const subscriptions = await Subscription.find().lean();
  let rows = await Promise.all(orgs.map((org) => organizationRow(org, subscriptions.filter((sub) => String(sub.organizationId) === String(org._id)))));

  if (req.query.status) rows = rows.filter((row) => row.planStatus === req.query.status);
  if (req.query.plan) rows = rows.filter((row) => row.plan === req.query.plan);
  if (req.query.search) {
    const search = String(req.query.search).toLowerCase();
    rows = rows.filter((row) =>
      row.name.toLowerCase().includes(search)
      || String(row.email || '').toLowerCase().includes(search)
      || String(row.ownerName || '').toLowerCase().includes(search));
  }
  res.json(paginate(rows, { page: req.query.page, limit: req.query.limit || 25 }));
}));

router.get('/organizations/:id', requirePerm(PERMS.PLATFORM_ORGS_VIEW), asyncRoute(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) throw notFound('Organization not found.', 'ORG_NOT_FOUND');

  const [devices, events, subscription, subscriptions, payments, plan] = await Promise.all([
    Device.find({ organizationId: org._id }).lean(),
    Event.find({ organizationId: org._id }).lean(),
    subscriptionOf(org._id),
    Subscription.find({ organizationId: org._id }).sort({ createdAt: -1 }).lean(),
    Payment.find({ organizationId: org._id }).lean(),
    planSummary(org, await subscriptionOf(org._id)),
  ]);
  const row = await organizationRow(org, subscriptions);
  const paid = payments.filter((payment) => payment.status === 'paid');
  const activeEvents = events.filter((event) => computeEventStatus(event) === 'active');

  res.json({
    ...row,
    plan: {
      plan: plan.plan,
      planName: plan.planName,
      status: plan.status,
      startDate: plan.startDate,
      endDate: plan.endDate,
      daysLeft: plan.daysLeft,
      deviceLimit: plan.deviceLimit,
      eventLimit: plan.eventLimit,
    },
    subscription: subscription
      ? {
          id: String(subscription._id),
          plan: subscription.plan,
          amount: subscription.amount,
          invoiceNo: subscription.invoiceNo,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          status: subscription.status,
        }
      : null,
    subscriptions: subscriptions.map((sub) => ({
      id: String(sub._id), plan: sub.plan, amount: sub.amount, invoiceNo: sub.invoiceNo,
      startDate: sub.startDate, endDate: sub.endDate, status: sub.status,
    })),
    usage: { devicesUsed: devices.length, deviceLimit: plan.deviceLimit, eventsUsed: activeEvents.length, eventLimit: plan.eventLimit },
    devices: devices.map((device) => ({
      id: String(device._id),
      name: device.deviceName,
      deviceUuid: device.deviceUuid,
      status: device.status,
      online: isDeviceOnline(device),
      lastSeenAt: device.lastSeenAt,
      assignedEventId: device.assignedEventId ? String(device.assignedEventId) : null,
    })),
    events: events.map((event) => ({
      id: String(event._id),
      name: event.name,
      status: computeEventStatus(event),
      startDate: event.startDate,
      endDate: event.endDate,
    })),
    revenue: {
      total: paid.reduce((sum, payment) => sum + payment.amount, 0),
      prints: paid.reduce((sum, payment) => sum + (payment.printCount || 0), 0),
      transactions: paid.length,
    },
    limits: { devices: plan.deviceLimit, events: plan.eventLimit },
  });
}));

/**
 * Issue #1/#2: suspend keeps CRM access (read-only), ban removes it instantly
 * (sessions revoked, booths blocked). Registered as three explicit routes —
 * Express 5 no longer supports inline regex parameters.
 */
router.post(['/organizations/:id/suspend', '/organizations/:id/ban', '/organizations/:id/restore'],
  requirePerm(PERMS.PLATFORM_ORG_SUSPEND), asyncRoute(async (req, res) => {
  const action = req.path.split('/').pop();
  const reason = String((req.body && req.body.reason) || '').trim().slice(0, 300);
  const org = await Organization.findById(req.params.id);
  if (!org) throw notFound('Organization not found.', 'ORG_NOT_FOUND');
  if (action !== 'restore' && !reason) throw badRequest(`A reason is required to ${action} an organization.`, 'REASON_REQUIRED');

  if (action === 'suspend') {
    org.status = 'suspended';
    org.suspendReason = reason;
    org.suspendedAt = new Date();
    org.suspendedBy = req.user._id;
    await org.save();
    await writeAudit({ req, organizationId: org._id, action: 'platform.organization.suspended', entity: 'organization', summary: `Organization “${org.name}” suspended — ${reason}`, severity: 'warn' });
  } else if (action === 'ban') {
    org.status = 'banned';
    org.suspendReason = reason;
    org.suspendedAt = new Date();
    org.suspendedBy = req.user._id;
    await org.save();
    // Issue #2/#30: every cached CRM session is invalidated immediately and
    // every booth pairing for this organization stops working.
    await bumpSessionVersion(org._id);
    await writeAudit({ req, organizationId: org._id, action: 'platform.organization.banned', entity: 'organization', summary: `Organization “${org.name}” banned — ${reason}`, severity: 'danger' });
  } else {
    org.status = 'active';
    org.suspendReason = null;
    org.suspendedAt = null;
    org.suspendedBy = null;
    await org.save();
    await writeAudit({ req, organizationId: org._id, action: 'platform.organization.restored', entity: 'organization', summary: `Organization “${org.name}” restored` });
  }

  res.json({ ok: true, organization: { id: String(org._id), name: org.name, status: org.status, suspendReason: org.suspendReason || null } });
}));

// ================================================================
// SUBSCRIPTION PLANS (#3, #4, #5)
// ================================================================

// Serialise a plan + its live discount pricing for the CRM. `pricing` is
// computed once here (services/planService.js) so the card, the edit modal
// and public checkout can never disagree about the effective price.
function planAdminView(plan, doc, organizations, subscriptions) {
  const pricing = planPricing(plan);
  return {
    id: doc ? String(doc._id) : null,
    key: plan.key,
    name: plan.name,
    description: plan.description || '',
    kind: plan.kind || 'plan',
    priceMonthly: plan.priceMonthly ?? plan.price ?? null,
    priceAnnual: plan.priceAnnual ?? null,
    billingNote: plan.billingNote || '',
    aiCredits: Number(plan.aiCredits) || 0,
    billing: billingPrices(plan),
    price: plan.price,
    ...normalizeDiscount(plan),
    discountStartsAt: pricing.discount.discountStartsAt,
    discountEndsAt: pricing.discount.discountEndsAt,
    pricing,
    durationMonths: plan.durationMonths ?? 0,
    durationLabel: plan.durationLabel || '—',
    devices: plan.devices,
    events: plan.events,
    active: plan.active !== false,
    organizations: organizations.filter((org) => org.plan === plan.key).length,
    subscriptions: subscriptions.filter((sub) => sub.plan === plan.key).length,
    updatedAt: doc ? doc.updatedAt : null,
  };
}

const DISCOUNT_FIELDS = ['discountType', 'discountValue', 'discountLabel', 'discountStartsAt', 'discountEndsAt', 'discountMaxRedemptions'];
const hasDiscountInput = (body) => DISCOUNT_FIELDS.some((field) => body[field] !== undefined);

router.get('/plans', requirePerm(PERMS.SUBSCRIPTION_PLANS_MANAGE), asyncRoute(async (req, res) => {
  const [catalog, organizations, subscriptions, docs] = await Promise.all([
    listPlans({ fresh: true }),
    Organization.find().select('plan').lean(),
    Subscription.find().select('plan').lean(),
    SubscriptionPlan.find().lean(),
  ]);
  res.json({
    plans: catalog.map((plan) => planAdminView(
      plan,
      docs.find((row) => row.key === plan.key),
      organizations,
      subscriptions,
    )),
  });
}));

router.post('/plans', requirePerm(PERMS.SUBSCRIPTION_PLANS_MANAGE), asyncRoute(async (req, res) => {
  const key = String(req.body.key || '').toLowerCase().trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) throw badRequest('Plan key may contain lowercase letters, numbers and single hyphens.', 'BAD_PLAN_KEY');
  if (await SubscriptionPlan.findOne({ key })) throw conflict('A plan with this key already exists.', 'PLAN_EXISTS');
  const price = req.body.price === null || req.body.price === '' ? 0 : Number(req.body.price) || 0;
  const discount = hasDiscountInput(req.body) ? parseDiscountInput(req.body, price) : normalizeDiscount({});
  const plan = await SubscriptionPlan.create({
    key,
    name: String(req.body.name || '').trim() || key,
    description: String(req.body.description || '').trim(),
    price,
    ...discount,
    durationMonths: Number(req.body.durationMonths) || 0,
    durationLabel: String(req.body.durationLabel || '').trim() || 'Custom term',
    devices: req.body.kind === 'addon' ? Math.max(0, Number(req.body.devices) || 0) : Math.max(1, Number(req.body.devices) || 1),
    events: req.body.kind === 'addon' ? Math.max(0, Number(req.body.events) || 0) : Math.max(1, Number(req.body.events) || 1),
    active: req.body.active !== false,
    kind: req.body.kind === 'addon' ? 'addon' : 'plan',
    priceMonthly: req.body.priceMonthly === undefined ? price : Number(req.body.priceMonthly) || null,
    priceAnnual: req.body.priceAnnual === undefined ? null : Number(req.body.priceAnnual) || null,
    billingNote: String(req.body.billingNote || '').trim(),
    aiCredits: Math.max(0, Number(req.body.aiCredits) || 0),
  });
  await writeAudit({ req, action: 'platform.plan.created', entity: 'subscription_plan', summary: `Subscription plan “${plan.name}” created (${plan.devices} devices / ${plan.events} events)` });
  res.status(201).json({ plan: { id: String(plan._id), ...plan.toObject(), pricing: planPricing(plan) } });
}));

router.put('/plans/:id', requirePerm(PERMS.SUBSCRIPTION_PLANS_MANAGE), asyncRoute(async (req, res) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) throw notFound('Subscription plan not found.', 'PLAN_NOT_FOUND');
  for (const field of ['name', 'description', 'durationLabel']) {
    if (req.body[field] !== undefined) plan[field] = String(req.body[field] || '').trim();
  }
  if (req.body.price !== undefined) plan.price = req.body.price === null ? 0 : Number(req.body.price) || 0;
  if (req.body.durationMonths !== undefined) plan.durationMonths = Number(req.body.durationMonths) || 0;
  for (const field of ['devices', 'events']) {
    if (req.body[field] !== undefined) {
      const value = Number(req.body[field]);
      const minVal = (plan.kind === 'addon' || req.body.kind === 'addon') ? 0 : 1;
      if (!Number.isInteger(value) || value < minVal || value > 1000) throw badRequest(`${field} must be a whole number from ${minVal} to 1000.`, 'BAD_PLAN_LIMIT');
      plan[field] = value;
    }
  }
  // Discount campaign: validate against the (possibly just-updated) price
  // and store the normalised window. Sending discountType 'none' clears it.
  if (hasDiscountInput(req.body)) {
    const merged = {
      discountType: req.body.discountType !== undefined ? req.body.discountType : plan.discountType,
      discountValue: req.body.discountValue !== undefined ? req.body.discountValue : plan.discountValue,
      discountLabel: req.body.discountLabel !== undefined ? req.body.discountLabel : plan.discountLabel,
      discountStartsAt: req.body.discountStartsAt !== undefined ? req.body.discountStartsAt : plan.discountStartsAt,
      discountEndsAt: req.body.discountEndsAt !== undefined ? req.body.discountEndsAt : plan.discountEndsAt,
      discountMaxRedemptions: req.body.discountMaxRedemptions !== undefined ? req.body.discountMaxRedemptions : plan.discountMaxRedemptions,
      discountRedemptions: plan.discountRedemptions,
    };
    Object.assign(plan, parseDiscountInput(merged, plan.price));
  }
  if (req.body.active !== undefined) plan.active = !!req.body.active;
  if (req.body.kind !== undefined && ['plan', 'addon'].includes(req.body.kind)) plan.kind = req.body.kind;
  for (const field of ['priceMonthly', 'priceAnnual']) {
    if (req.body[field] !== undefined) {
      const value = req.body[field] === null || req.body[field] === '' ? null : Number(req.body[field]);
      if (value !== null && (!Number.isFinite(value) || value < 0)) throw badRequest(`${field} must be a non-negative amount.`, 'BAD_PLAN_PRICE');
      plan[field] = value;
    }
  }
  if (req.body.billingNote !== undefined) plan.billingNote = String(req.body.billingNote || '').trim();
  if (req.body.aiCredits !== undefined) plan.aiCredits = Math.max(0, Number(req.body.aiCredits) || 0);
  // Keep the legacy `price` mirror in step with the monthly INR price.
  if (plan.priceMonthly != null) plan.price = plan.priceMonthly;
  await plan.save();

  // Issue #5: organizations on this plan immediately inherit the new limits.
  await Organization.updateMany(
    { plan: plan.key },
    { $set: { allowedDevices: plan.devices, allowedEvents: plan.events } },
  );
  const pricing = planPricing(plan);
  const discountNote = pricing.discount.active
    ? ` — discount live: ${pricing.discount.discountType === 'percent' ? `${pricing.discount.discountValue}% off` : `₹${pricing.discount.discountValue} off`}`
    : '';
  await writeAudit({ req, action: 'platform.plan.updated', entity: 'subscription_plan', summary: `Subscription plan “${plan.name}” updated (${plan.devices} devices / ${plan.events} events)${discountNote}` });
  res.json({ plan: { id: String(plan._id), ...plan.toObject(), pricing } });
}));

router.delete('/plans/:id', requirePerm(PERMS.SUBSCRIPTION_PLANS_MANAGE), asyncRoute(async (req, res) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
  let plan = isObjectId ? await SubscriptionPlan.findById(id) : await SubscriptionPlan.findOne({ key: id.toLowerCase() });

  const key = plan ? plan.key : id.toLowerCase();
  let name = plan ? plan.name : key;

  if (!plan) {
    const fromDefault = [...DEFAULT_PLAN_CATALOG, ...ADDON_CATALOG].find((p) => p.key === key);
    if (!fromDefault) throw notFound('Subscription plan or add-on not found.', 'PLAN_NOT_FOUND');
    name = fromDefault.name;
  }

  // Safety guard 1: trial cannot be deleted
  if (key === 'trial') {
    throw badRequest('The default trial plan cannot be deleted as it is required for new organization onboarding.', 'CANNOT_DELETE_TRIAL');
  }

  // Safety guard 2: check if any organization currently uses this plan
  const orgCount = await Organization.countDocuments({ plan: key });
  if (orgCount > 0) {
    throw badRequest(
      `Cannot delete “${name}” because ${orgCount} organization${orgCount === 1 ? '' : 's'} are currently subscribed to it. Please migrate those organizations first or deactivate the plan instead.`,
      'PLAN_IN_USE'
    );
  }

  // Safety guard 3: if it's an add-on, check if any organization has it active
  const orgAddonCount = await Organization.countDocuments({ 'addons.key': key });
  if (orgAddonCount > 0) {
    throw badRequest(
      `Cannot delete add-on “${name}” because ${orgAddonCount} organization${orgAddonCount === 1 ? '' : 's'} currently have it active.`,
      'ADDON_IN_USE'
    );
  }

  if (plan) {
    plan.isDeleted = true;
    plan.active = false;
    await plan.save();
  } else {
    await SubscriptionPlan.create({
      key,
      name,
      description: 'Deleted catalog plan',
      durationMonths: 0,
      durationLabel: 'Deleted',
      devices: 1,
      events: 1,
      isDeleted: true,
      active: false,
    });
  }

  // Force cache refresh
  await listPlans({ fresh: true });

  await writeAudit({
    req,
    action: 'platform.plan.deleted',
    entity: 'subscription_plan',
    summary: `Deleted subscription plan/add-on “${name}” (${key})`,
  });

  res.json({ ok: true, deleted: key });
}));

// ================================================================
// GALLERY SETTINGS (#12, #13, #16–#20)
// ================================================================

router.get('/gallery-settings', requirePerm(PERMS.PLATFORM_GALLERY_SETTINGS), asyncRoute(async (req, res) => {
  const settings = await getGallerySettings({ fresh: true });
  res.json(settings);
}));

router.put('/gallery-settings', requirePerm(PERMS.PLATFORM_GALLERY_SETTINGS), asyncRoute(async (req, res) => {
  const settings = await saveGallerySettings(req.body || {}, req.user);
  await writeAudit({
    req,
    action: 'platform.gallery.settings_updated',
    entity: 'platform_settings',
    summary: `Gallery ${settings.galleryEnabled ? 'enabled' : 'disabled'}; guest consent ${settings.requireGuestConsent ? 'required' : 'not required'}`,
  });
  res.json({ settings });
}));

// ================================================================
// TEAM & ROLES (#8, #9, #10, #11)
// ================================================================

function internalUserView(user) {
  const role = normalizeRole(user.role) || user.role;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role,
    roleLabel: role,
    status: user.status,
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
  };
}

/**
 * Read: Owner, Platform Admin and Support Manager (issues #8, #9, #11).
 * Write: Owner only — the response tells the UI whether it may act.
 */
router.get('/users', requirePerm(PERMS.PLATFORM_TEAM_VIEW), asyncRoute(async (req, res) => {
  const users = await User.find({ organizationId: null })
    .select('-password -forgotPasswordCodeHash -emailChangeCodeHash')
    .sort({ createdAt: 1 });
  res.json({
    users: users.map(internalUserView),
    canManage: !isPlatformTeamReadOnly(req.user.role),
    readOnly: isPlatformTeamReadOnly(req.user.role),
    roles: [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER],
  });
}));

router.post('/users', requirePerm(PERMS.PLATFORM_USERS_MANAGE), asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80);
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const role = normalizeRole(req.body.role);
  if (!name || !email || !password) throw badRequest('Name, email and password are required.', 'BAD_USER');
  if (![ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER].includes(role)) {
    throw badRequest('Only Platform Admin and Support Manager accounts can be created from CRM. Owner is a single bootstrap account.', 'BAD_ROLE');
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw badRequest('Password must be at least 8 characters and contain a letter and a number.', 'WEAK_PASSWORD');
  }
  if (await User.findOne({ email })) throw conflict('A user with this email already exists.', 'EMAIL_TAKEN');
  const user = await User.create({ name, email, password, role, organizationId: null, status: 'active' });
  await writeAudit({ req, action: 'platform.user.created', entity: 'user', summary: `Internal user ${name} created (${role})` });
  res.status(201).json({ user: internalUserView(user) });
}));

router.put('/users/:id', requirePerm(PERMS.PLATFORM_USERS_MANAGE), asyncRoute(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, organizationId: null });
  if (!user) throw notFound('User not found.', 'USER_NOT_FOUND');
  const keys = Object.keys(req.body || {});
  if (keys.some((key) => key !== 'status')) {
    throw forbidden('Team members manage their own identity — only activation status can be changed here.', 'IDENTITY_IMMUTABLE');
  }
  if (!['active', 'inactive'].includes(req.body.status)) throw badRequest('Status must be active or inactive.', 'BAD_STATUS');
  if (String(user._id) === String(req.user._id) && req.body.status !== 'active') {
    throw badRequest('You cannot deactivate your own account.', 'SELF_DEACTIVATE');
  }
  user.status = req.body.status;
  if (user.status !== 'active') user.sessionVersion = (Number(user.sessionVersion) || 0) + 1;
  await user.save();
  await writeAudit({
    req,
    action: user.status === 'inactive' ? 'platform.user.deactivated' : 'platform.user.reactivated',
    entity: 'user',
    summary: `Internal user ${user.name} ${user.status === 'inactive' ? 'deactivated' : 're-activated'}`,
    severity: user.status === 'inactive' ? 'warn' : 'info',
  });
  res.json({ user: internalUserView(user) });
}));

// ================================================================
// PLATFORM SUPPORT (#37–#39)
// ================================================================

function supportView(request, { organization = null, decisionBy = null } = {}) {
  const raw = typeof request.toObject === 'function' ? request.toObject() : request;
  return {
    id: String(raw._id),
    ticketNo: raw.ticketNo || null,
    subject: raw.subject,
    category: raw.category || 'other',
    priority: raw.priority || 'medium',
    status: raw.status,
    organization: organization
      ? { id: String(organization._id), name: organization.name, email: organization.email }
      : null,
    createdBy: raw.createdBy ? String(raw.createdBy) : null,
    messages: (raw.messages || []).map((message) => ({
      id: message._id ? String(message._id) : undefined,
      authorName: message.authorName,
      authorRole: message.authorRole,
      side: message.side,
      text: message.text,
      images: message.images || [],
      at: message.at ? new Date(message.at).toISOString() : null,
    })),
    decision: raw.decision && raw.decision.type
      ? {
          type: raw.decision.type,
          reason: raw.decision.reason || null,
          byName: decisionBy ? decisionBy.name : null,
          byRole: decisionBy ? normalizeRole(decisionBy.role) : null,
          at: raw.decision.at ? new Date(raw.decision.at).toISOString() : null,
        }
      : null,
    lastReapplication: raw.lastReapplication && raw.lastReapplication.at
      ? { text: raw.lastReapplication.text, images: raw.lastReapplication.images || [], at: new Date(raw.lastReapplication.at).toISOString() }
      : null,
    reapplyCount: raw.reapplyCount || 0,
    resolution: raw.resolution || null,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : null,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : null,
  };
}

router.get('/support', requirePerm(PERMS.PLATFORM_SUPPORT_VIEW), asyncRoute(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  const requests = await PlatformSupportRequest.find(query).sort({ updatedAt: -1 }).lean();
  const organizations = await Organization.find().select('name email').lean();
  let rows = requests.map((request) => supportView(request, {
    organization: organizations.find((org) => String(org._id) === String(request.organizationId)),
  }));
  if (req.query.search) {
    const search = String(req.query.search).toLowerCase();
    rows = rows.filter((row) =>
      row.subject.toLowerCase().includes(search)
      || String(row.organization?.name || '').toLowerCase().includes(search));
  }
  const counts = { new: 0, denied: 0, open: 0, in_progress: 0, resolved: 0 };
  for (const row of rows) if (counts[row.status] !== undefined) counts[row.status] += 1;
  const page = paginate(rows, { page: req.query.page, limit: req.query.limit || 20 });
  res.json({ ...page, requests: page.items, counts });
}));

router.get('/support/:id', requirePerm(PERMS.PLATFORM_SUPPORT_VIEW), asyncRoute(async (req, res) => {
  const request = await PlatformSupportRequest.findById(req.params.id);
  if (!request) throw notFound('Support request not found.', 'SUPPORT_REQUEST_NOT_FOUND');
  const organization = await Organization.findById(request.organizationId).lean();
  const decisionBy = request.decision && request.decision.by ? await User.findById(request.decision.by).lean() : null;
  res.json({ request: supportView(request, { organization, decisionBy }) });
}));

function pushPlatformMessage(request, req, text) {
  request.messages.push({
    authorId: req.user._id,
    authorName: req.user.name,
    authorRole: req.user.role,
    side: 'platform',
    text,
    at: new Date(),
  });
}

router.post('/support/:id/accept', requirePerm(PERMS.PLATFORM_SUPPORT_VIEW), asyncRoute(async (req, res) => {
  const request = await PlatformSupportRequest.findById(req.params.id);
  if (!request) throw notFound('Support request not found.', 'SUPPORT_REQUEST_NOT_FOUND');
  if (request.status !== 'new') throw conflict('Only a new request can be accepted.', 'TICKET_NOT_NEW');
  request.status = 'open';
  request.acceptedAt = new Date();
  request.ticketNo = request.ticketNo || `T-${String(request._id).slice(-6).toUpperCase()}`;
  request.decision = { type: 'accepted', reason: String(req.body.message || '').trim() || null, by: req.user._id, at: new Date() };
  if (req.body.message) pushPlatformMessage(request, req, String(req.body.message).trim());
  await request.save();
  await writeAudit({ req, organizationId: request.organizationId, action: 'platform.support.accepted', entity: 'support_request', summary: `Accepted support request “${request.subject}” (${request.ticketNo})` });
  const organization = await Organization.findById(request.organizationId).lean();
  res.json({ request: supportView(request, { organization, decisionBy: req.user }) });
}));

router.post('/support/:id/deny', requirePerm(PERMS.PLATFORM_SUPPORT_VIEW), asyncRoute(async (req, res) => {
  const request = await PlatformSupportRequest.findById(req.params.id);
  if (!request) throw notFound('Support request not found.', 'SUPPORT_REQUEST_NOT_FOUND');
  if (['resolved'].includes(request.status)) throw conflict('A resolved request cannot be denied.', 'TICKET_RESOLVED');
  const reason = String(req.body.reason || req.body.message || '').trim();
  if (!reason) throw badRequest('A reason is required to deny a request.', 'REASON_REQUIRED');
  request.status = 'denied';
  request.decision = { type: 'denied', reason, by: req.user._id, at: new Date() };
  pushPlatformMessage(request, req, reason);
  await request.save();
  await writeAudit({ req, organizationId: request.organizationId, action: 'platform.support.denied', entity: 'support_request', summary: `Denied support request “${request.subject}” — ${reason}`, severity: 'warn' });
  const organization = await Organization.findById(request.organizationId).lean();
  res.json({ request: supportView(request, { organization, decisionBy: req.user }) });
}));

router.post('/support/:id/reply', requirePerm(PERMS.PLATFORM_SUPPORT_VIEW), asyncRoute(async (req, res) => {
  const request = await PlatformSupportRequest.findById(req.params.id);
  if (!request) throw notFound('Support request not found.', 'SUPPORT_REQUEST_NOT_FOUND');
  if (!['open', 'in_progress'].includes(request.status)) throw conflict('Reply on an accepted, active ticket.', 'TICKET_NOT_OPEN');
  const text = String(req.body.message || req.body.text || '').trim();
  if (!text) throw badRequest('A message is required.', 'EMPTY_MESSAGE');
  pushPlatformMessage(request, req, text);
  request.status = 'in_progress';
  await request.save();
  const organization = await Organization.findById(request.organizationId).lean();
  res.json({ request: supportView(request, { organization }) });
}));

router.post('/support/:id/resolve', requirePerm(PERMS.PLATFORM_SUPPORT_VIEW), asyncRoute(async (req, res) => {
  const request = await PlatformSupportRequest.findById(req.params.id);
  if (!request) throw notFound('Support request not found.', 'SUPPORT_REQUEST_NOT_FOUND');
  request.status = 'resolved';
  request.resolvedAt = new Date();
  request.resolution = String(req.body.resolution || req.body.message || 'Resolved by HappyPix support.').trim();
  if (req.body.message) pushPlatformMessage(request, req, request.resolution);
  await request.save();
  await writeAudit({ req, organizationId: request.organizationId, action: 'platform.support.resolved', entity: 'support_request', summary: `Resolved support request “${request.subject}”` });
  const organization = await Organization.findById(request.organizationId).lean();
  res.json({ request: supportView(request, { organization }) });
}));

router.post('/support/:id/reopen', requirePerm(PERMS.PLATFORM_SUPPORT_VIEW), asyncRoute(async (req, res) => {
  const request = await PlatformSupportRequest.findById(req.params.id);
  if (!request) throw notFound('Support request not found.', 'SUPPORT_REQUEST_NOT_FOUND');
  if (request.status !== 'resolved') throw conflict('Only a resolved request can be reopened.', 'TICKET_NOT_RESOLVED');
  request.status = 'open';
  request.resolvedAt = null;
  request.resolution = null;
  if (req.body.message) pushPlatformMessage(request, req, String(req.body.message).trim());
  await request.save();
  await writeAudit({ req, organizationId: request.organizationId, action: 'platform.support.reopened', entity: 'support_request', summary: `Reopened support request “${request.subject}”`, severity: 'warn' });
  const organization = await Organization.findById(request.organizationId).lean();
  res.json({ request: supportView(request, { organization }) });
}));

// ================================================================
// TEMPLATES (global library)
// ================================================================

router.get('/templates', requirePerm(PERMS.GLOBAL_TEMPLATES_MANAGE), asyncRoute(async (req, res) => {
  const templates = await Template.find().sort({ createdAt: -1 }).lean();
  res.json({
    templates: templates.map((template) => ({
      id: String(template._id),
      name: template.name,
      category: template.category,
      description: template.description,
      layoutId: template.layoutId,
      layout: layoutMeta(template.layoutId),
      design: template.design || {},
      source: template.source || 'playground',
      componentId: template.componentId || null,
      active: template.active !== false,
      usage: template.usage || 0,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    })),
  });
}));

router.post('/templates', requirePerm(PERMS.GLOBAL_TEMPLATES_MANAGE), asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw badRequest('Template name is required.', 'BAD_TEMPLATE');
  if (!req.body.layoutId) throw badRequest('A layout variant is required.', 'BAD_TEMPLATE');
  const template = await Template.create({
    name,
    description: String(req.body.description || '').trim(),
    category: req.body.category || 'Custom',
    layoutId: req.body.layoutId,
    componentId: req.body.componentId || null,
    design: req.body.design || null,
    source: ['designer', 'playground', 'ai_generated'].includes(req.body.source) ? req.body.source : 'playground',
    active: req.body.active !== false,
    createdBy: req.user._id,
  });
  await writeAudit({ req, action: 'platform.template.created', entity: 'template', summary: `Template “${template.name}” created (${template.layoutId})` });
  res.status(201).json({ template: { id: String(template._id), ...template.toObject(), layout: layoutMeta(template.layoutId) } });
}));

router.put('/templates/:id', requirePerm(PERMS.GLOBAL_TEMPLATES_MANAGE), asyncRoute(async (req, res) => {
  const template = await Template.findById(req.params.id);
  if (!template) throw notFound('Template not found.', 'TEMPLATE_NOT_FOUND');
  if (req.body.layoutId && req.body.layoutId !== template.layoutId) {
    const used = await Event.countDocuments({ templateIds: template._id });
    if (used) throw conflict('This template is used by events — its layout cannot change.', 'TEMPLATE_IN_USE');
    template.layoutId = req.body.layoutId;
  }
  for (const field of ['name', 'description', 'category']) {
    if (req.body[field] !== undefined) template[field] = String(req.body[field] || '').trim();
  }
  if (req.body.componentId !== undefined) {
    template.componentId = req.body.componentId || null;
  }
  if (req.body.source !== undefined) {
    if (['designer', 'playground', 'ai_generated'].includes(req.body.source)) {
      template.source = req.body.source;
    }
  }
  if (req.body.design !== undefined) template.design = req.body.design;
  if (req.body.active !== undefined) template.active = !!req.body.active;
  await template.save();
  await writeAudit({
    req,
    action: req.body.active === false ? 'platform.template.unpublished' : 'platform.template.updated',
    entity: 'template',
    summary: `Global template “${template.name}” ${req.body.active === false ? 'unpublished' : 'updated'}`,
  });
  res.json({ template: { id: String(template._id), ...template.toObject(), layout: layoutMeta(template.layoutId) } });
}));

router.delete('/templates/:id', requirePerm(PERMS.GLOBAL_TEMPLATES_MANAGE), asyncRoute(async (req, res) => {
  const template = await Template.findById(req.params.id);
  if (!template) throw notFound('Template not found.', 'TEMPLATE_NOT_FOUND');
  if (await Event.countDocuments({ templateIds: template._id })) {
    throw conflict('This template is used by events. Unpublish it instead of deleting.', 'TEMPLATE_IN_USE');
  }
  await Template.deleteOne({ _id: template._id });
  await writeAudit({ req, action: 'platform.template.deleted', entity: 'template', summary: `Template “${template.name}” deleted`, severity: 'warn' });
  res.json({ ok: true });
}));

router.post('/templates/ai-generate', requirePerm(PERMS.GLOBAL_TEMPLATES_MANAGE), asyncRoute(async (req, res) => {
  const prompt = String(req.body.prompt || '').trim();
  if (!prompt) throw badRequest('A prompt is required.', 'BAD_PROMPT');
  if (!req.body.layoutId) throw badRequest('A layout variant is required.', 'BAD_TEMPLATE');
  const hash = crypto.createHash('sha1').update(prompt.toLowerCase()).digest('hex');
  const seed = parseInt(hash.slice(0, 6), 16);
  const palettes = [
    { accent: '#D9B44A', textColor: '#FFFFFF' },
    { accent: '#F42E93', textColor: '#FFFFFF' },
    { accent: '#74A3E9', textColor: '#FFFFFF' },
    { accent: '#A6D76C', textColor: '#16121F' },
  ];
  const palette = palettes[seed % palettes.length];
  const words = prompt.split(/\s+/).slice(0, 4).map((word) => word[0].toUpperCase() + word.slice(1));
  res.json({
    draft: {
      name: words.join(' ') || 'AI Design',
      description: `Generated: ${prompt}`,
      category: 'Custom',
      layoutId: req.body.layoutId,
      source: 'ai_generated',
      status: 'draft',
      design: {
        background: { type: 'solid', colors: ['#120D1F', palette.accent] },
        accent: palette.accent,
        textColor: palette.textColor,
        ornament: ['none', 'dots', 'flourish', 'stripes'][seed % 4],
        font: ['sans', 'serif', 'script'][(seed >> 2) % 3],
        slotShape: ['rect', 'arch', 'round'][(seed >> 3) % 3],
        titleBand: false,
      },
    },
  });
}));

// ================================================================
// AUDIT (#21–#25)
// ================================================================

router.get('/audit', requirePerm(PERMS.PLATFORM_AUDIT_VIEW), asyncRoute(async (req, res) => {
  const query = { organizationId: null }; // platform scope
  if (req.query.scope === 'all') delete query.organizationId;
  if (req.query.from || req.query.to) {
    query.at = {};
    if (req.query.from) query.at.$gte = new Date(req.query.from);
    if (req.query.to) query.at.$lte = new Date(`${req.query.to}T23:59:59`);
  }
  if (req.query.action) {
    const safePattern = String(req.query.action).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.action = { $regex: safePattern, $options: 'i' };
  }
  if (req.query.severity) query.severity = req.query.severity;
  if (req.query.actor) query.actorId = req.query.actor;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const [rows, total, actors, organizations] = await Promise.all([
    AuditLog.find(query).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(query),
    User.find({ organizationId: null }).select('name role').lean(),
    Organization.find().select('name').lean(),
  ]);

  res.json({
    items: rows.map(auditView).sort(byAtDesc), // always newest-first on `at`
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    actors: actors.map((actor) => ({ id: String(actor._id), name: actor.name, role: normalizeRole(actor.role) || actor.role })),
    organizations: organizations.map((org) => ({ id: String(org._id), name: org.name })),
  });
}));

// ================================================================
// SEED HELPER — make sure the six plans exist (issue #4)
// ================================================================



export async function ensurePlanCatalog() {
  for (const plan of [...DEFAULT_PLAN_CATALOG, ...ADDON_CATALOG]) {
    const existing = await SubscriptionPlan.findOne({ key: plan.key });
    if (!existing) {
      await SubscriptionPlan.create(plan);
    } else {
      const updates = {};
      if (existing.devices !== plan.devices && (plan.key === 'pro' || plan.key === 'premium')) {
        updates.devices = plan.devices;
      }
      if (existing.events !== plan.events) {
        updates.events = plan.events;
      }
      if (existing.kind !== plan.kind) {
        updates.kind = plan.kind;
      }
      if (existing.aiCredits !== plan.aiCredits) {
        updates.aiCredits = plan.aiCredits;
      }
      if (Object.keys(updates).length > 0) {
        await SubscriptionPlan.updateOne({ _id: existing._id }, { $set: updates });
      }
    }
  }

  // Also update existing organizations' allowedDevices to match their plan
  await Organization.updateMany({ plan: 'pro', allowedDevices: { $lt: 4 } }, { $set: { allowedDevices: 4 } });
  await Organization.updateMany({ plan: 'premium', allowedDevices: { $lt: 8 } }, { $set: { allowedDevices: 8 } });
}

// ─── TEMPLATE LAYOUTS ────────────────────────────────────────────────────────

router.get('/template-layouts', requirePerm(PERMS.PLATFORM_TEMPLATE_LAYOUTS_MANAGE), asyncRoute(async (req, res) => {
  const layouts = await TemplateLayout.find().sort({ createdAt: -1 }).lean();
  res.json({ layouts: layouts.map(l => ({ id: l._id.toString(), ...l })) });
}));

router.post('/template-layouts', requirePerm(PERMS.PLATFORM_TEMPLATE_LAYOUTS_MANAGE), asyncRoute(async (req, res) => {
  const layout = await TemplateLayout.create({ ...req.body, createdBy: req.user._id });
  await writeAudit({ req, action: 'platform.template_layout.created', entity: 'template_layout', summary: `Created template layout ${layout.codeword || layout.name || 'New'}` });
  res.status(201).json({ layout: { id: layout._id.toString(), ...layout.toObject() } });
}));

router.delete('/template-layouts/:id', requirePerm(PERMS.PLATFORM_TEMPLATE_LAYOUTS_MANAGE), asyncRoute(async (req, res) => {
  const layout = await TemplateLayout.findByIdAndDelete(req.params.id);
  if (!layout) throw notFound('Template layout not found');
  await writeAudit({ req, action: 'platform.template_layout.deleted', entity: 'template_layout', summary: `Deleted template layout ${layout.codeword || layout.name || 'Deleted'}` });
  res.json({ ok: true });
}));

export default router;
