import express from 'express';
import { requirePlatformRole, requireOwner } from '../../middleware/auth.js';
import Organization from '../../models/Organization.js';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Device from '../../models/Device.js';
import Subscription from '../../models/Subscription.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Template from '../../models/Template.js';
import PlatformSupportRequest from '../../models/PlatformSupportRequest.js';
import AuditLog from '../../models/AuditLog.js';
import Payment from '../../models/Payment.js';
import Counter from '../../models/Counter.js';
import { getPlatformSettings } from '../../models/PlatformSetting.js';
import {
  computeDeviceOnline, computeEventStatus, fyStart,
  paginated, roleLabel, safeMediaUrl, safeStr, userPublic, writeAudit,
} from '../../lib/helpers.js';
import { computePlanStatus, resolvePlanContext } from '../../lib/planService.js';
import { roleHasPermission, SUPPORT_STATUSES, ROLES } from '../../lib/constants.js';
import { layoutById, layoutMeta } from '../../lib/layouts.js';
import { generateAiDraft } from '../../services/ai/AiDraftService.js';

const router = express.Router();

// All routes here require a platform role (OWNER, PLATFORM_ADMIN, SUPPORT_MANAGER)
router.use(requirePlatformRole);

const audit = (req, action, entity, summary, severity = 'info', organizationId = null) =>
  writeAudit({ actorId: req.user._id, organizationId, action, entity, summary, severity, req });

// ─── DASHBOARD ─────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const orgs = await Organization.find().lean();
    const subs = await Subscription.find().lean();

    const planStatusOf = (o) => {
      const sub = subs.filter((s) => String(s.organizationId) === String(o._id)).sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0];
      return computePlanStatus(o, sub, now);
    };

    const statuses = orgs.map(planStatusOf);
    const count = (s) => statuses.filter((x) => x === s).length;

    const devices = await Device.find().lean();
    const online = devices.filter((d) => computeDeviceOnline(d, now.getTime())).length;

    const events = await Event.find().lean().sort({ startDate: -1 });
    const eventsWithStatus = events.map((e) => ({ ...e, _status: computeEventStatus(e, now) }));

    // Expiring soon (< 14 days left), sorted by days left
    const expiringSoon = [];
    const nearLimits = [];
    for (const o of orgs) {
      const { summary } = await resolvePlanContext(o, { now });
      if (summary.status === 'expiring_soon') {
        expiringSoon.push({ id: o._id, name: o.name, plan: summary.planName, status: summary.status, daysLeft: summary.daysLeft });
      }
      const dUsed = devices.filter((d) => String(d.organizationId) === String(o._id)).length;
      const eUsed = eventsWithStatus.filter((e) => String(e.organizationId) === String(o._id) && e._status === 'active').length;
      const dLimit = summary.deviceLimit;
      const eLimit = summary.eventLimit;
      if ((dLimit > 0 && dUsed >= dLimit * 0.8) || (eLimit > 0 && eUsed >= eLimit * 0.8)) {
        nearLimits.push({ id: o._id, name: o.name, deviceUsed: dUsed, deviceLimit: dLimit, eventUsed: eUsed, eventLimit: eLimit });
      }
    }
    expiringSoon.sort((a, b) => a.daysLeft - b.daysLeft);

    const alerts = [
      ...expiringSoon.map((x) => ({ kind: 'plan_expiring', text: `${x.plan} plan for ${x.name} expires in ${x.daysLeft} days`, tone: 'warn' })),
      ...orgs.filter((o) => o.status === 'suspended').map((o) => ({ kind: 'suspended', text: `Organization ${o.name} is suspended`, tone: 'warn' })),
      ...orgs.filter((o) => o.status === 'banned').map((o) => ({ kind: 'banned', text: `Organization ${o.name} is banned`, tone: 'danger' })),
      ...orgs.filter((o) => planStatusOf(o) === 'expired').map((o) => ({ kind: 'expired', text: `Organization ${o.name} has an expired plan`, tone: 'danger' })),
    ].slice(0, 6);

    res.json({
      orgs: {
        total: orgs.length,
        active: count('active'),
        trial: count('trial'),
        suspended: count('suspended'),
        banned: count('banned'),
        expired: count('expired'),
      },
      devices: { total: devices.length, online, offline: devices.length - online, operational: devices.filter((d) => d.status === 'active').length },
      events: {
        active: eventsWithStatus.filter((e) => e._status === 'active').length,
        upcoming: eventsWithStatus.filter((e) => e._status === 'upcoming').length,
        finished: eventsWithStatus.filter((e) => e._status === 'finished').length,
      },
      expiringSoon,
      nearLimits,
      alerts,
      recentSignups: [...orgs]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map((o) => ({ id: o._id, name: o.name, createdAt: o.createdAt, plan: o.plan || 'Trial' })),
    });
  } catch (error) {
    console.error('Platform dashboard error:', error.message);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ─── REVENUE (platform's own subscription revenue — OWNER only) ────────────

router.get('/revenue', requireOwner, async (req, res) => {
  try {
    const now = new Date();
    const fy = fyStart(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const orgs = await Organization.find().lean();
    const subs = await Subscription.find({ amount: { $gt: 0 } }).lean();

    const net = subs.reduce((s, x) => s + x.amount, 0);
    const fyRevenue = subs.filter((s) => new Date(s.paidAt || s.createdAt) >= fy).reduce((s, x) => s + x.amount, 0);
    const monthRevenue = subs.filter((s) => new Date(s.paidAt || s.createdAt) >= monthStart).reduce((s, x) => s + x.amount, 0);

    // 12-month series
    const monthWiseMap = Array(12).fill(0);
    const quarterWiseMap = Array(4).fill(0);
    subs.forEach((s) => {
      const d = new Date(s.paidAt || s.createdAt);
      if (d.getFullYear() === now.getFullYear()) {
        monthWiseMap[d.getMonth()] += s.amount;
        quarterWiseMap[Math.floor(d.getMonth() / 3)] += s.amount;
      }
    });

    const orgRows = await Promise.all(orgs.map(async (o) => {
      const sub = subs.filter((s) => String(s.organizationId) === String(o._id)).sort((a, b) => new Date(b.paidAt || b.createdAt) - new Date(a.paidAt || a.createdAt))[0];
      const { summary } = await resolvePlanContext(o, { now });
      const paidAt = sub ? new Date(sub.paidAt || sub.createdAt) : null;
      return {
        id: o._id,
        name: o.name,
        email: o.email,
        plan: summary.planName,
        planStatus: summary.status,
        expiry: summary.endDate,
        daysLeft: summary.daysLeft,
        revenue: sub ? sub.amount : 0,
        revenueThisMonth: sub && paidAt >= monthStart ? sub.amount : 0,
        revenueFY: sub && paidAt >= fy ? sub.amount : 0,
      };
    }));

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    res.json({
      net,
      fyRevenue,
      monthRevenue,
      monthWise: monthWiseMap.map((val, idx) => ({ label: monthLabels[idx], value: val })),
      quarterWise: quarterWiseMap.map((val, idx) => ({ label: `Q${idx + 1}`, value: val })),
      yearOptions: [now.getFullYear(), now.getFullYear() - 1],
      orgs: orgRows,
    });
  } catch (error) {
    console.error('Platform revenue error:', error.message);
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

// ─── ORGANIZATIONS ─────────────────────────────────────────────────────────

router.get('/organizations', async (req, res) => {
  try {
    const now = new Date();
    const q = req.query;
    const orgs = await Organization.find().sort({ createdAt: -1 }).lean();
    const subs = await Subscription.find().lean();

    let rows = await Promise.all(orgs.map(async (o) => {
      const { summary } = await resolvePlanContext(o, { now });
      const devices = await Device.find({ organizationId: o._id }).lean();
      const events = await Event.find({ organizationId: o._id }).lean();
      const owner = await User.findOne({ organizationId: o._id, role: 'ORG_ADMIN' }).lean();
      return {
        id: o._id,
        name: o.name,
        ownerName: owner?.name || 'Unknown',
        email: owner?.email || o.email || 'N/A',
        plan: o.plan || 'trial',
        planName: summary.planName,
        planStatus: summary.status,
        status: o.status,
        planExpiry: summary.endDate,
        planDaysLeft: summary.daysLeft,
        devices: devices.length,
        onlineDevices: devices.filter((d) => computeDeviceOnline(d, now.getTime())).length,
        activeEvents: events.filter((e) => computeEventStatus(e, now) === 'active').length,
        totalEvents: events.length,
        createdAt: o.createdAt,
        lastActiveAt: devices
          .map((d) => d.lastSeenAt)
          .filter(Boolean)
          .sort((a, b) => new Date(b) - new Date(a))[0] || o.updatedAt || o.createdAt,
      };
    }));

    if (q.status) rows = rows.filter((r) => r.planStatus === q.status);
    if (q.plan) rows = rows.filter((r) => r.plan === q.plan);
    if (q.search) {
      const s = String(q.search).toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s) || r.ownerName.toLowerCase().includes(s));
    }

    res.json(paginated(rows, { page: q.page, limit: q.limit || 25 }));
  } catch (error) {
    console.error('Platform organizations error:', error.message);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.get('/organizations/:id', async (req, res) => {
  try {
    const o = await Organization.findById(req.params.id).lean();
    if (!o) return res.status(404).json({ error: 'Organization not found' });

    const { summary, sub } = await resolvePlanContext(o);
    const ownerUser = await User.findOne({ organizationId: o._id, role: 'ORG_ADMIN' }).lean();
    const orgDevices = await Device.find({ organizationId: o._id }).lean();
    const orgEvents = await Event.find({ organizationId: o._id }).lean();
    const orgPayments = await Payment.find({ organizationId: o._id, status: 'paid' }).lean();

    res.json({
      id: o._id,
      name: o.name,
      ownerName: ownerUser?.name || 'Unknown',
      email: ownerUser?.email || o.email || 'N/A',
      phone: o.phone || 'N/A',
      country: o.country || 'IN',
      status: o.status,
      suspendReason: o.suspendReason || null,
      createdAt: o.createdAt,
      plan: summary,
      subscription: sub || null,
      devices: orgDevices.map((d) => ({
        id: d._id,
        deviceName: d.deviceName || 'Booth',
        location: d.location || 'Unknown',
        online: computeDeviceOnline(d),
        eventName: 'N/A',
      })),
      events: orgEvents.map((e) => ({
        id: e._id,
        name: e.name,
        startDate: e.startDate,
        status: computeEventStatus(e),
      })),
      revenue: {
        total: orgPayments.reduce((sum, p) => sum + p.amount, 0),
        prints: orgPayments.reduce((sum, p) => sum + (p.printCount || 0), 0),
        transactions: orgPayments.length,
      },
    });
  } catch (error) {
    console.error('Platform org detail error:', error.message);
    res.status(500).json({ error: 'Failed to fetch organization details' });
  }
});

router.post('/organizations/:id/suspend', requireOwner, async (req, res) => {
  try {
    const reason = safeStr(req.body?.reason, 500);
    if (!reason) return res.status(400).json({ error: 'A reason is required to suspend an organization.' });
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { status: 'suspended', suspendReason: reason, suspendedAt: new Date(), suspendedBy: req.user._id },
      { new: true }
    );
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    await audit(req, 'platform.organization.suspended', 'organization', `Organization "${org.name}" suspended — ${reason}`, 'warn', org._id);
    res.json({ id: org._id, status: org.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to suspend organization' });
  }
});

router.post('/organizations/:id/ban', requireOwner, async (req, res) => {
  try {
    const reason = safeStr(req.body?.reason, 500);
    if (!reason) return res.status(400).json({ error: 'A reason is required to ban an organization.' });
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { status: 'banned', suspendReason: reason, suspendedAt: new Date(), suspendedBy: req.user._id },
      { new: true }
    );
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    await audit(req, 'platform.organization.banned', 'organization', `Organization "${org.name}" banned — ${reason}`, 'danger', org._id);
    res.json({ id: org._id, status: org.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to ban organization' });
  }
});

router.post('/organizations/:id/restore', requireOwner, async (req, res) => {
  try {
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { status: 'active', suspendReason: null, suspendedAt: null, suspendedBy: null },
      { new: true }
    );
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    await audit(req, 'platform.organization.restored', 'organization', `Organization "${org.name}" restored`, 'info', org._id);
    res.json({ id: org._id, status: org.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore organization' });
  }
});

// ─── PLANS ─────────────────────────────────────────────────────────────────

const PLAN_KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function planValidationErrors(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (!safeStr(body.name, 80)) errors.push('Plan name is required.');
  }
  if (body.key !== undefined) {
    const key = safeStr(body.key, 50).toLowerCase();
    if (!PLAN_KEY_RE.test(key)) errors.push('Plan key may contain lowercase letters, numbers and single hyphens.');
  }
  if (body.price !== undefined && body.price !== null && body.price !== '') {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0 || price > 10000000) errors.push('Price must be between ₹0 and ₹1,00,00,000, or blank for contact sales.');
  }
  for (const field of ['devices', 'events']) {
    if (body[field] !== undefined) {
      const value = Number(body[field]);
      if (!Number.isInteger(value) || value < 1 || value > 1000) errors.push(`${field} must be a whole number from 1 to 1000.`);
    }
  }
  if (body.durationMonths !== undefined) {
    const value = Number(body.durationMonths);
    if (!Number.isInteger(value) || value < 0 || value > 120) errors.push('Duration must be from 0 to 120 months.');
  }
  return errors;
}

router.get('/plans', requireOwner, async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ price: 1 }).lean();
    const orgs = await Organization.find().lean();
    const subs = await Subscription.find().lean();
    res.json({
      plans: plans.map((p) => ({
        id: p._id,
        key: p.key || p.name.toLowerCase().replace(/\s+/g, '-'),
        name: p.name,
        description: p.description,
        price: p.price,
        durationMonths: p.durationMonths || 1,
        durationLabel: p.durationLabel || `${p.durationMonths || 1} months`,
        devices: p.devices || 1,
        events: p.events || 1,
        active: p.active !== false,
        updatedAt: p.updatedAt,
        organizations: orgs.filter((o) => o.plan === p.key).length,
        subscriptions: subs.filter((s) => s.plan === p.key).length,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

router.post('/plans', requireOwner, async (req, res) => {
  try {
    const body = req.body || {};
    const key = safeStr(body.key, 50).toLowerCase();
    if (!safeStr(body.name, 80) || !key) return res.status(400).json({ error: 'Plan name and key are required.' });
    const errors = planValidationErrors(body);
    if (errors.length) return res.status(400).json({ error: errors[0] });
    if (await SubscriptionPlan.findOne({ key })) {
      return res.status(409).json({ error: 'A plan with this key already exists.' });
    }
    const durationMonths = Number(body.durationMonths) || 1;
    const plan = new SubscriptionPlan({
      key,
      name: safeStr(body.name, 80),
      description: safeStr(body.description, 240),
      price: body.price === null || body.price === '' ? null : Number(body.price),
      durationMonths,
      durationLabel: safeStr(body.durationLabel, 60) || `${durationMonths} month${durationMonths === 1 ? '' : 's'}`,
      devices: Number(body.devices) || 1,
      events: Number(body.events) || 1,
      active: body.active !== false,
    });
    await plan.save();
    await audit(req, 'platform.plan.created', 'subscription_plan', `Subscription plan "${plan.name}" created`);
    res.status(201).json({ plan: { id: plan._id, ...plan.toObject() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

router.put('/plans/:id', requireOwner, async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Subscription plan not found.' });
    if (req.body.key !== undefined && req.body.key !== plan.key) {
      return res.status(400).json({ error: 'A plan key is permanent once created.' });
    }
    const errors = planValidationErrors(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors[0] });

    const b = req.body;
    if (b.name !== undefined) plan.name = safeStr(b.name, 80);
    if (b.description !== undefined) plan.description = safeStr(b.description, 240);
    if (b.price !== undefined) plan.price = b.price === null || b.price === '' ? null : Number(b.price);
    for (const field of ['devices', 'events']) {
      if (b[field] !== undefined) plan[field] = Number(b[field]);
    }
    if (b.durationMonths !== undefined) plan.durationMonths = Number(b.durationMonths);
    if (b.durationLabel !== undefined) plan.durationLabel = safeStr(b.durationLabel, 60) || plan.durationLabel;
    if (b.active !== undefined) plan.active = !!b.active;
    await plan.save();
    await audit(req, 'platform.plan.updated', 'subscription_plan', `Subscription plan "${plan.name}" updated`);
    res.json({ plan: { id: plan._id, ...plan.toObject() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// ─── TEMPLATES ─────────────────────────────────────────────────────────────

function templateView(t) {
  return {
    id: t._id,
    name: t.name,
    category: t.category,
    description: t.description,
    source: t.source || 'playground',
    componentId: t.componentId || null,
    layoutId: t.layoutId,
    layout: layoutMeta(t.layoutId),
    design: t.design || {},
    active: t.active !== false,
    status: t.active === false ? 'hidden' : 'published',
    usage: t.usage || 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

router.get('/templates', async (req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 });
    res.json({ templates: templates.map(templateView) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/templates', async (req, res) => {
  if (!roleHasPermission(req.user.role, 'platform.templates.manage')) {
    return res.status(403).json({ error: 'Only the Owner and Platform Admin can manage templates.' });
  }
  try {
    const b = req.body || {};
    const name = safeStr(b.name, 80);
    if (!name) return res.status(400).json({ error: 'Template name is required.' });
    const layout = layoutById(b.layoutId);
    if (!layout) return res.status(400).json({ error: 'A valid layout variant is required.' });
    if (b.design?.bg?.url) {
      const art = safeMediaUrl(b.design.bg.url);
      if (!art) return res.status(400).json({ error: 'Background artwork must be an https:// or data:image/ URL.' });
    }

    const template = new Template({
      name,
      description: safeStr(b.description, 400),
      category: safeStr(b.category, 60) || 'Custom',
      layoutId: layout.id,
      componentId: b.componentId || null,
      design: b.design && typeof b.design === 'object' ? b.design : undefined,
      source: ['designer', 'playground', 'ai_generated'].includes(b.source) ? b.source : 'playground',
      active: b.active !== false,
      createdBy: req.user._id,
    });
    await template.save();
    await audit(req, 'platform.template.created', 'template', `Template "${template.name}" created in the playground (${template.layoutId})`);
    res.status(201).json({ template: templateView(template) });
  } catch (error) {
    console.error('Template create error:', error.message);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Playground AI assist: generates an UNSAVED design draft (palette +
// ornaments + AI background art at the layout's aspect) for the owner to
// tweak before saving. Nothing is persisted until "Create template".
router.post('/templates/ai-generate', async (req, res) => {
  if (!roleHasPermission(req.user.role, 'platform.templates.manage')) {
    return res.status(403).json({ error: 'Only the Owner and Platform Admin can generate templates.' });
  }
  try {
    const prompt = safeStr(req.body?.prompt, 500);
    if (!prompt) return res.status(400).json({ error: 'A prompt is required.' });
    const layout = layoutById(req.body?.layoutId);
    if (!layout) return res.status(400).json({ error: 'A valid layout variant is required.' });

    const draft = await generateAiDraft(prompt, layout);
    res.json({ draft });
  } catch (error) {
    console.error('AI generate error:', error.message);
    res.status(500).json({ error: error.message || 'AI generation failed.' });
  }
});

router.put('/templates/:id', async (req, res) => {
  if (!roleHasPermission(req.user.role, 'platform.templates.manage')) {
    return res.status(403).json({ error: 'Only the Owner and Platform Admin can manage templates.' });
  }
  try {
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found.' });

    const b = req.body || {};
    if (b.layoutId != null && b.layoutId !== template.layoutId) {
      const layout = layoutById(b.layoutId);
      if (!layout) return res.status(400).json({ error: 'Unknown layout variant.' });
      const used = await Event.exists({ templateIds: template._id });
      if (used) return res.status(409).json({ error: 'This template is used by events — its layout cannot change.' });
      template.layoutId = layout.id;
    }
    if (b.name !== undefined) template.name = safeStr(b.name, 80) || template.name;
    if (b.category !== undefined) template.category = safeStr(b.category, 60) || template.category;
    if (b.description !== undefined) template.description = safeStr(b.description, 400);
    if (b.design !== undefined && typeof b.design === 'object') template.design = b.design;
    if (b.componentId !== undefined) template.componentId = b.componentId || null;
    if (b.active !== undefined) template.active = !!b.active;

    const publishing = b.active === true && template.active !== false;
    await template.save();
    await audit(
      req,
      b.active === false ? 'platform.template.unpublished' : publishing ? 'platform.template.published' : 'platform.template.updated',
      'template',
      `Global template "${template.name}" ${b.active === false ? 'unpublished — hidden from organizations' : publishing ? 'published — available to all organizations' : 'updated'}`
    );
    res.json({ template: templateView(template) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/templates/:id', async (req, res) => {
  if (!roleHasPermission(req.user.role, 'platform.templates.manage')) {
    return res.status(403).json({ error: 'Only the Owner and Platform Admin can manage templates.' });
  }
  try {
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found.' });
    if (template.source === 'designer') {
      return res.status(409).json({ error: 'Designer templates are hand-crafted code — unpublish instead of deleting.' });
    }
    const used = await Event.exists({ templateIds: template._id });
    if (used) return res.status(409).json({ error: 'This template is used by events. Unpublish it instead of deleting.' });

    await Template.findByIdAndDelete(req.params.id);
    await audit(req, 'platform.template.deleted', 'template', `Template "${template.name}" deleted`, 'warn');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// ─── USERS (internal platform team) ────────────────────────────────────────

router.get('/users', requireOwner, async (req, res) => {
  try {
    const usersList = await User.find({ organizationId: null }).sort({ createdAt: -1 });
    res.json({ users: usersList.map(userPublic) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', requireOwner, async (req, res) => {
  try {
    const b = req.body || {};
    const name = safeStr(b.name, 80);
    const email = safeStr(b.email, 120).toLowerCase();
    const password = String(b.password || '');
    const role = b.role;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
    const fmt = emailError(email);
    if (fmt) return res.status(400).json({ error: fmt });
    const policy = passwordPolicyError(password);
    if (policy) return res.status(400).json({ error: policy });
    if (![ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER].includes(role)) {
      return res.status(400).json({ error: 'Only Platform Admin and Support Manager accounts can be created from CRM. Owner is a single bootstrap account.' });
    }
    if (await User.findOne({ email })) return res.status(409).json({ error: 'A user with this email already exists.' });

    const user = new User({ name, email, password, role, organizationId: null, status: 'active' });
    await user.save();
    await audit(req, 'platform.user.created', 'user', `Internal user ${name} created (${roleLabel(role)})`);
    res.status(201).json({ user: userPublic(user) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/users/:id', requireOwner, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.role === 'OWNER') return res.status(403).json({ error: 'Cannot modify the Owner account.' });

    const keys = Object.keys(req.body || {});
    if (keys.some((key) => key !== 'status')) {
      return res.status(403).json({ error: 'Identity is self-managed — only activation status can be changed here.' });
    }
    if (!['active', 'inactive'].includes(req.body?.status)) return res.status(400).json({ error: 'Status must be active or inactive.' });
    if (String(user._id) === String(req.user._id) && req.body.status !== 'active') {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    user.status = req.body.status;
    if (user.status !== 'active') user.tokenVersion = (user.tokenVersion || 0) + 1; // kill sessions
    await user.save();
    await audit(
      req,
      user.status === 'inactive' ? 'platform.user.deactivated' : 'platform.user.reactivated',
      'user',
      `Internal user ${user.name} ${user.status === 'inactive' ? 'deactivated' : 're-activated'}`,
      user.status === 'inactive' ? 'warn' : 'info'
    );
    res.json({ user: userPublic(user) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ─── SUPPORT (organization support requests) ───────────────────────────────

function supportView(t, org) {
  return {
    id: t._id,
    ticketNo: t.ticketNo || null,
    organizationId: t.organizationId,
    organization: org ? { id: org._id, name: org.name, email: org.email } : null,
    createdBy: t.createdBy,
    subject: t.subject,
    category: t.category,
    priority: t.priority || 'medium',
    status: t.status,
    messages: t.messages || [],
    decision: t.decision && t.decision.type ? t.decision : null,
    decisionHistory: t.decisionHistory || [],
    reapplyCount: t.reapplyCount || 0,
    lastReapplication: t.lastReapplication || null,
    resolution: t.resolution || null,
    acceptedAt: t.acceptedAt || null,
    resolvedAt: t.resolvedAt || null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

const supportCounts = (rows) => {
  const counts = Object.fromEntries(SUPPORT_STATUSES.map((s) => [s, 0]));
  rows.forEach((row) => { if (counts[row.status] != null) counts[row.status] += 1; });
  return counts;
};

router.get('/support', async (req, res) => {
  try {
    const q = req.query;
    let rows = await PlatformSupportRequest.find().sort({ updatedAt: -1 }).populate('organizationId', 'name email');
    const orgs = rows.map((r) => r.organizationId);
    if (q.status) rows = rows.filter((t) => t.status === q.status);
    if (q.search) {
      const s = String(q.search).toLowerCase();
      rows = rows.filter((t) => t.subject.toLowerCase().includes(s) || (t.ticketNo || '').toLowerCase().includes(s) || (t.organizationId?.name || '').toLowerCase().includes(s));
    }
    const all = await PlatformSupportRequest.find();
    res.json({
      requests: rows.map((t, i) => supportView(t, orgs[i])),
      counts: supportCounts(all),
    });
  } catch (error) {
    console.error('Support list error:', error.message);
    res.status(500).json({ error: 'Failed to fetch support requests' });
  }
});

router.get('/support/:id', async (req, res) => {
  try {
    const t = await PlatformSupportRequest.findById(req.params.id).populate('organizationId', 'name email');
    if (!t) return res.status(404).json({ error: 'Support request not found.' });
    res.json({ request: supportView(t, t.organizationId) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

router.post('/support/:id/accept', async (req, res) => {
  try {
    const t = await PlatformSupportRequest.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Support request not found.' });
    if (t.status !== 'new') return res.status(409).json({ error: 'Only a new request can be accepted.' });

    const seq = await Counter.next(`support-ticket-${new Date().getFullYear()}`);
    t.ticketNo = `HPX-${String(new Date().getFullYear()).slice(2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(seq).padStart(4, '0')}`;
    t.status = 'open';
    t.acceptedAt = new Date();
    t.decision = { type: 'accepted', reason: null, by: req.user._id, at: t.acceptedAt };
    const message = safeStr(req.body?.message, 2000) || `Request accepted as ${t.ticketNo}. HappyPix support will continue here.`;
    t.messages.push({
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      side: 'platform',
      at: new Date(),
      text: message,
      images: [],
    });
    await t.save();
    await audit(req, 'platform.support.accepted', 'support_ticket', `Accepted "${t.subject}" as ${t.ticketNo}`, 'info', t.organizationId);
    const org = await Organization.findById(t.organizationId).lean();
    res.json({ request: supportView(t, org) });
  } catch (error) {
    console.error('Support accept error:', error.message);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

router.post('/support/:id/deny', async (req, res) => {
  try {
    const t = await PlatformSupportRequest.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Support request not found.' });
    if (t.status !== 'new') return res.status(409).json({ error: 'Only a new request can be denied.' });
    const reason = safeStr(req.body?.reason, 2000);
    if (!reason) return res.status(400).json({ error: 'A denial reason is required and will be shown to the organization.' });

    t.status = 'denied';
    t.ticketNo = null;
    t.decision = { type: 'denied', reason, by: req.user._id, at: new Date() };
    await t.save();
    await audit(req, 'platform.support.denied', 'support_request', `Denied support request "${t.subject}" — ${reason}`, 'warn', t.organizationId);
    const org = await Organization.findById(t.organizationId).lean();
    res.json({ request: supportView(t, org) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deny request' });
  }
});

router.post('/support/:id/reply', async (req, res) => {
  try {
    const t = await PlatformSupportRequest.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Support request not found.' });
    if (!['open', 'in_progress'].includes(t.status)) {
      return res.status(409).json({ error: 'Messages can only be sent on an active ticket.' });
    }
    const text = safeStr(req.body?.message ?? req.body?.text, 2000);
    const images = Array.isArray(req.body?.images)
      ? req.body.images.slice(0, 4).map((src) => safeMediaUrl(src)).filter(Boolean)
      : [];
    if (!text && images.length === 0) return res.status(400).json({ error: 'Write a message or attach an image.' });

    t.messages.push({
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      side: 'platform',
      at: new Date(),
      text,
      images,
    });
    t.status = 'in_progress';
    await t.save();
    const org = await Organization.findById(t.organizationId).lean();
    res.json({ request: supportView(t, org) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reply' });
  }
});

router.post('/support/:id/resolve', async (req, res) => {
  try {
    const t = await PlatformSupportRequest.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Support request not found.' });
    if (!['open', 'in_progress'].includes(t.status)) return res.status(409).json({ error: 'Only an active ticket can be resolved.' });
    const resolution = safeStr(req.body?.resolution, 2000);
    if (!resolution) return res.status(400).json({ error: 'Add a resolution note for the organization.' });

    t.status = 'resolved';
    t.resolution = resolution;
    t.resolvedAt = new Date();
    t.messages.push({
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      side: 'platform',
      at: new Date(),
      text: resolution,
      images: [],
    });
    await t.save();
    await audit(req, 'platform.support.resolved', 'support_ticket', `${t.ticketNo} resolved`, 'info', t.organizationId);
    const org = await Organization.findById(t.organizationId).lean();
    res.json({ request: supportView(t, org) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve' });
  }
});

router.post('/support/:id/reopen', async (req, res) => {
  try {
    const t = await PlatformSupportRequest.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Support request not found.' });
    if (t.status !== 'resolved') return res.status(409).json({ error: 'Only a resolved ticket can be reopened.' });

    t.status = 'in_progress';
    t.resolvedAt = null;
    const message = safeStr(req.body?.message, 2000) || `Ticket ${t.ticketNo} was reopened by HappyPix.`;
    t.messages.push({
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      side: 'platform',
      at: new Date(),
      text: message,
      images: [],
    });
    await t.save();
    await audit(req, 'platform.support.reopened', 'support_ticket', `${t.ticketNo} reopened`, 'warn', t.organizationId);
    const org = await Organization.findById(t.organizationId).lean();
    res.json({ request: supportView(t, org) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reopen' });
  }
});

// ─── GALLERY SETTINGS (platform policy, persisted) ─────────────────────────

router.get('/gallery-settings', async (req, res) => {
  if (!roleHasPermission(req.user.role, 'platform.gallery.settings')) {
    return res.status(403).json({ error: 'Your role does not permit this action.' });
  }
  try {
    const settings = await getPlatformSettings();
    res.json({
      galleryEnabled: settings.galleryEnabled,
      requireGuestConsent: settings.requireGuestConsent,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gallery settings' });
  }
});

router.put('/gallery-settings', async (req, res) => {
  if (!roleHasPermission(req.user.role, 'platform.gallery.settings')) {
    return res.status(403).json({ error: 'Your role does not permit this action.' });
  }
  try {
    const settings = await getPlatformSettings();
    if (req.body?.galleryEnabled !== undefined) {
      if (typeof req.body.galleryEnabled !== 'boolean') return res.status(400).json({ error: 'galleryEnabled must be a boolean.' });
      settings.galleryEnabled = req.body.galleryEnabled;
    }
    if (req.body?.requireGuestConsent !== undefined) {
      if (typeof req.body.requireGuestConsent !== 'boolean') return res.status(400).json({ error: 'requireGuestConsent must be a boolean.' });
      settings.requireGuestConsent = req.body.requireGuestConsent;
    }
    settings.updatedBy = req.user._id;
    await settings.save();
    await audit(req, 'platform.gallery.settings_updated', 'platform_settings', `Gallery ${settings.galleryEnabled ? 'enabled' : 'disabled'}; guest consent ${settings.requireGuestConsent ? 'required' : 'not required'}`);
    res.json({
      settings: {
        galleryEnabled: settings.galleryEnabled,
        requireGuestConsent: settings.requireGuestConsent,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save gallery settings' });
  }
});

// ─── AUDIT LOGS ────────────────────────────────────────────────────────────

router.get('/audit', async (req, res) => {
  try {
    const q = req.query;
    let filter = { organizationId: null }; // platform scope
    if (q.action) filter.action = { $regex: String(q.action).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    if (q.from || q.to) {
      filter.at = {};
      if (q.from) filter.at.$gte = new Date(q.from);
      if (q.to) filter.at.$lte = new Date(`${q.to}T23:59:59`);
    }
    const rows = await AuditLog.find(filter).sort({ at: -1 }).limit(1000).populate('actorId', 'name role');
    const actors = await User.find({ organizationId: null }).select('name role').lean();

    let items = rows.map((l) => ({
      id: l._id,
      action: l.action,
      entity: l.entity,
      actorName: l.actorId ? l.actorId.name : 'System',
      actorRole: l.actorId ? l.actorId.role : 'SYSTEM',
      summary: l.summary,
      severity: l.severity || 'info',
      ip: l.ip || null,
      at: l.at,
    }));
    if (q.actor) items = items.filter((l) => l.actorName === q.actor);

    res.json({ ...paginated(items, { page: q.page, limit: q.limit || 20 }), actors });
  } catch (error) {
    console.error('Platform audit error:', error.message);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
