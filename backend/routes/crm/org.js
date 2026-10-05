import express from 'express';
import mongoose from 'mongoose';
import { requireOrgRole, requireOrgAdmin } from '../../middleware/auth.js';
import Organization from '../../models/Organization.js';
import OrganizationDefaults from '../../models/OrganizationDefaults.js';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Device from '../../models/Device.js';
import Ticket from '../../models/Ticket.js';
import SupportTicket from '../../models/SupportTicket.js';
import PlatformSupportRequest from '../../models/PlatformSupportRequest.js';
import Coupon from '../../models/Coupon.js';
import AuditLog from '../../models/AuditLog.js';
import Template from '../../models/Template.js';
import Photo from '../../models/Photo.js';
import Payment from '../../models/Payment.js';
import Withdrawal from '../../models/Withdrawal.js';
import { getPlatformSettings } from '../../models/PlatformSetting.js';
import {
  computeDeviceOnline, computeEventStatus, emailError, monthKey, monthLabelOf,
  paginated, passwordPolicyError, roleLabel, safeMediaUrl, safeStr,
  userPublic, writeAudit,
} from '../../lib/helpers.js';
import {
  FILTER_IDS, MIN_WITHDRAWAL, roleHasPermission, ROLES, SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES, SUPPORT_STATUSES,
} from '../../lib/constants.js';
import { effectiveLayoutPrices, planBlocked, resolvePlanContext } from '../../lib/planService.js';
import { LAYOUT_FAMILIES, PRICE_KEY, layoutMeta, suggestedPriceMap } from '../../lib/layouts.js';

const router = express.Router();

// All routes require an ORG role (ORG_ADMIN or ORG_MANAGER)
router.use(requireOrgRole);

const getOrgFilter = (user) => {
  if (!user.organizationId) throw new Error('User has no organization assigned');
  return { organizationId: user.organizationId };
};

const hasPerm = (req, perm) => roleHasPermission(req.user.role, perm);
const denyPerm = (res, perm) => res.status(403).json({ error: `Your role does not permit this action (${perm}).` });

const audit = (req, action, entity, summary, severity = 'info') =>
  writeAudit({ actorId: req.user._id, organizationId: req.user.organizationId, action, entity, summary, severity, req });

async function loadOrgContext(req) {
  const org = await Organization.findById(req.user.organizationId);
  if (!org) return null;
  const { summary, planDef } = await resolvePlanContext(org);
  return { org, summary, planDef, blocked: planBlocked(summary) };
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const ctx = await loadOrgContext(req);
    if (!ctx) return res.status(404).json({ error: 'Organization not found' });
    const { org, summary } = ctx;

    const devices = await Device.find(getOrgFilter(req.user)).lean();
    const events = (await Event.find(getOrgFilter(req.user)).lean()).map((e) => ({ ...e, _status: computeEventStatus(e) }));
    const tickets = await Ticket.find(getOrgFilter(req.user)).lean();
    const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress');

    const activeCount = events.filter((e) => e._status === 'active').length;
    const offlineDevices = devices.filter((d) => !computeDeviceOnline(d));

    const warnings = [];
    if (summary.status === 'expiring_soon') warnings.push({ kind: 'plan_expiring', text: `Your ${summary.planName} plan expires in ${summary.daysLeft} day(s).`, tone: 'warn' });
    if (summary.status === 'expired') warnings.push({ kind: 'plan_expired', text: 'Your plan has expired. Renew to create new events and register devices.', tone: 'danger' });
    if (summary.deviceLimit > 0 && devices.length >= summary.deviceLimit) warnings.push({ kind: 'device_limit', text: `Device limit reached (${devices.length}/${summary.deviceLimit}). Upgrade to add more booths.`, tone: 'warn' });
    if (summary.eventLimit > 0 && activeCount >= summary.eventLimit) warnings.push({ kind: 'event_limit', text: `Parallel active event limit reached (${activeCount}/${summary.eventLimit}).`, tone: 'warn' });
    if (offlineDevices.length && !['suspended', 'banned'].includes(org.status)) warnings.push({ kind: 'booth_offline', text: `${offlineDevices.length} booth(s) currently offline.`, tone: 'info' });
    if (ctx.blocked) {
      warnings.push({
        kind: 'org_blocked',
        text: org.status === 'banned' ? 'Your organization access is currently banned. Contact HappyPix support.' : 'Your organization is suspended. Contact HappyPix support.',
        tone: 'danger',
      });
    }

    const data = {
      organization: { id: org._id, name: org.name, email: org.email, status: org.status },
      plan: summary,
      usage: {
        devicesUsed: devices.length,
        deviceLimit: summary.deviceLimit,
        eventsUsed: activeCount,
        eventLimit: summary.eventLimit,
      },
      devices: { total: devices.length, online: devices.length - offlineDevices.length, offline: offlineDevices.length },
      events: {
        active: events.filter((e) => e._status === 'active').map((e) => ({ id: e._id, name: e.name, startDate: e.startDate, status: 'active' })),
        upcoming: events.filter((e) => e._status === 'upcoming').map((e) => ({ id: e._id, name: e.name, startDate: e.startDate, status: 'upcoming' })),
        paused: events.filter((e) => e._status === 'paused').map((e) => ({ id: e._id, name: e.name, startDate: e.startDate, status: 'paused' })),
        finished: events.filter((e) => e._status === 'finished').slice(0, 3).map((e) => ({ id: e._id, name: e.name, startDate: e.startDate, status: 'finished' })),
      },
      tickets: {
        open: openTickets.length,
        list: openTickets.slice(0, 5).map((t) => ({ id: t._id, subject: t.subject, status: t.status, updatedAt: t.updatedAt })),
      },
      warnings,
    };

    if (req.user.role === ROLES.ORG_ADMIN) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const paid = await Payment.find({ ...getOrgFilter(req.user), status: 'paid' }).lean();
      const wallet = await walletOf(req.user.organizationId);
      const defaults = await OrganizationDefaults.findOne({ organizationId: req.user.organizationId }).lean();
      data.revenue = {
        total: paid.reduce((s, p) => s + p.amount, 0),
        thisMonth: paid.filter((p) => new Date(p.paidAt || p.createdAt) >= monthStart).reduce((s, p) => s + p.amount, 0),
        payout: {
          payoutMode: defaults?.payoutMode === 'upi' ? 'upi' : 'wallet',
          upiId: defaults?.upiId || null,
        },
        wallet: { balance: wallet.balance, processing: wallet.processing, minWithdrawal: wallet.minWithdrawal },
        viaUpi: wallet.viaUpi,
        viaWallet: wallet.credited,
      };
    }

    res.json(data);
  } catch (error) {
    console.error('Org dashboard error:', error.message);
    res.status(500).json({ error: 'Dashboard error' });
  }
});

// ─── EVENTS ────────────────────────────────────────────────────────────────

function eventView(e, devices = []) {
  const status = computeEventStatus(e);
  const assigned = devices
    .filter((d) => String(d.assignedEventId) === String(e._id))
    .map((d) => ({ id: d._id, name: d.deviceName, online: computeDeviceOnline(d) }));
  return {
    id: e._id,
    name: e.name,
    clientName: e.clientName || '',
    location: e.location || '',
    startDate: e.startDate,
    endDate: e.endDate,
    status,
    paused: !!e.paused,
    templateIds: (e.templateIds || []).map(String),
    filters: e.filters || [],
    digitalCopy: e.digitalCopy ?? true,
    layoutPrices: e.layoutPrices instanceof Map ? Object.fromEntries(e.layoutPrices) : (e.layoutPrices || {}),
    branding: { logos: e.branding?.logos || [], tagline: e.branding?.tagline || '' },
    shortCode: e.shortCode || null,
    assignedDevices: assigned,
    deviceCount: assigned.length,
    createdAt: e.createdAt,
  };
}

function validateLayoutPrices(prices) {
  if (prices == null) return { ...suggestedPriceMap() };
  if (typeof prices !== 'object' || Array.isArray(prices)) {
    const err = new Error('layoutPrices must be an object of "familyId:slots" → price.');
    err.status = 400;
    throw err;
  }
  const out = {};
  for (const [key, value] of Object.entries(prices)) {
    const [familyId, slotsText] = String(key).split(':');
    const family = LAYOUT_FAMILIES.find((f) => f.id === familyId);
    const slots = Number(slotsText);
    if (!family || !family.slots.includes(slots)) {
      const err = new Error(`Unknown layout iteration "${key}".`);
      err.status = 400;
      throw err;
    }
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0 || price > 100000) {
      const err = new Error(`Price for "${key}" must be between 0 and 100000.`);
      err.status = 400;
      throw err;
    }
    out[PRICE_KEY(familyId, slots)] = Math.round(price);
  }
  return out;
}

async function validateEventBody(body, { partial = false, orgId } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    if (!safeStr(body.name, 120)) { const e = new Error('Event name is required.'); e.status = 400; throw e; }
    out.name = safeStr(body.name, 120);
  }
  if (body.clientName !== undefined) out.clientName = safeStr(body.clientName, 120);
  if (body.location !== undefined) out.location = safeStr(body.location, 200);
  if (!partial || body.startDate !== undefined) {
    if (!body.startDate) { const e = new Error('Event name, start and end are required.'); e.status = 400; throw e; }
    out.startDate = new Date(body.startDate);
  }
  if (!partial || body.endDate !== undefined) {
    if (!body.endDate) { const e = new Error('Event name, start and end are required.'); e.status = 400; throw e; }
    out.endDate = new Date(body.endDate);
  }
  if (out.startDate && out.endDate && new Date(out.startDate) >= new Date(out.endDate)) {
    const e = new Error('End time must be after start time.');
    e.status = 400;
    throw e;
  }
  if (body.templateIds !== undefined) {
    const tids = Array.isArray(body.templateIds) ? body.templateIds.filter((x) => x) : [];
    for (const tid of tids) {
      if (!mongoose.Types.ObjectId.isValid(tid)) { const e = new Error('A selected template does not exist.'); e.status = 400; throw e; }
      const tpl = await Template.findById(tid);
      if (!tpl) { const e = new Error('A selected template does not exist.'); e.status = 400; throw e; }
      if (tpl.active === false) { const e = new Error(`Template "${tpl.name}" is disabled by the platform.`); e.status = 400; throw e; }
    }
    out.templateIds = tids;
  }
  if (body.filters !== undefined) {
    const fids = Array.isArray(body.filters) ? body.filters : [];
    for (const fid of fids) {
      if (!FILTER_IDS.includes(fid)) { const e = new Error(`Unknown photo filter "${fid}".`); e.status = 400; throw e; }
    }
    out.filters = fids;
  }
  if (body.digitalCopy !== undefined) out.digitalCopy = !!body.digitalCopy;
  if (body.branding !== undefined) {
    let logos = Array.isArray(body.branding?.logos) ? body.branding.logos.filter((x) => typeof x === 'string' && x) : [];
    if (logos.length > 15) { const e = new Error('A maximum of 15 logos per event — trim the list.'); e.status = 400; throw e; }
    logos = logos.map((src) => safeMediaUrl(src)).filter(Boolean);
    out.branding = { logos, tagline: safeStr(body.branding?.tagline, 120) };
  }
  return out;
}

router.get('/events', async (req, res) => {
  try {
    const ctx = await loadOrgContext(req);
    if (!ctx) return res.status(404).json({ error: 'Organization not found' });
    const q = req.query;
    let events = await Event.find(getOrgFilter(req.user)).lean();
    const devices = await Device.find(getOrgFilter(req.user)).lean();
    let rows = events.map((e) => eventView(e, devices));
    if (q.status) rows = rows.filter((e) => e.status === q.status);
    if (q.search) {
      const s = String(q.search).toLowerCase();
      rows = rows.filter((e) => e.name.toLowerCase().includes(s) || (e.location || '').toLowerCase().includes(s));
    }
    rows.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    const activeCount = rows.filter((e) => e.status === 'active').length;
    res.json({
      events: rows,
      canCreate: !ctx.blocked && (ctx.summary.eventLimit < 0 || activeCount < ctx.summary.eventLimit),
    });
  } catch (error) {
    console.error('Org events error:', error.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/events', async (req, res) => {
  if (!hasPerm(req, 'organization.events.create')) return denyPerm(res, 'organization.events.create');
  try {
    const ctx = await loadOrgContext(req);
    if (!ctx) return res.status(404).json({ error: 'Organization not found' });

    if (ctx.blocked) {
      const msg = ctx.summary.status === 'expired'
        ? 'Plan expired — renew your plan to create events.'
        : `Organization is ${ctx.org.status} — new events are blocked.`;
      return res.status(403).json({ error: msg });
    }

    const active = await Event.find({ ...getOrgFilter(req.user), status: 'live' });
    const activeCount = active.filter((e) => computeEventStatus(e) === 'active').length;
    if (ctx.summary.eventLimit >= 0 && activeCount >= ctx.summary.eventLimit) {
      return res.status(403).json({ error: `Your ${ctx.summary.planName} plan allows a maximum of ${ctx.summary.eventLimit} parallel active event(s).` });
    }

    const fields = await validateEventBody(req.body || {}, { partial: false });

    // Pricing snapshot: suggested defaults ← org defaults ← event overrides
    const defaults = await OrganizationDefaults.findOne({ organizationId: req.user.organizationId }).lean();
    const base = effectiveLayoutPrices(defaults, null, { suggested: suggestedPriceMap() });
    const overrides = validateLayoutPrices(req.body?.layoutPrices);
    const layoutPrices = { ...base, ...overrides };

    const ev = new Event({
      ...getOrgFilter(req.user),
      ...fields,
      layoutPrices,
      paused: false,
      status: new Date(fields.startDate) <= new Date() && new Date(fields.endDate) > new Date() ? 'live' : 'upcoming',
      shortCode: (fields.name.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '') || 'EV') + String(Math.floor(10 + Math.random() * 90)),
      createdBy: req.user._id,
    });
    await ev.save();
    await audit(req, 'event.created', 'event', `Event "${ev.name}" created (${(ev.templateIds || []).length} template(s), digital copy ${ev.digitalCopy ? 'on' : 'off'})`);
    res.status(201).json({ event: eventView(ev.toObject(), []) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Org event create error:', error.message);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/events/:id', async (req, res) => {
  if (!hasPerm(req, 'organization.events.devices.manage')) return denyPerm(res, 'organization.events.devices.manage');
  try {
    const ev = await Event.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!ev) return res.status(404).json({ error: 'Event not found.' });

    const fields = await validateEventBody(req.body || {}, { partial: true });

    if (req.body?.layoutPrices !== undefined) {
      const overrides = validateLayoutPrices(req.body.layoutPrices);
      const current = ev.layoutPrices instanceof Map ? Object.fromEntries(ev.layoutPrices) : (ev.layoutPrices || {});
      ev.layoutPrices = { ...current, ...overrides };
    }
    Object.assign(ev, fields);
    if (ev.isModified('startDate') || ev.isModified('endDate')) {
      ev.status = new Date(ev.startDate) <= new Date() && new Date(ev.endDate) > new Date() ? 'live' : 'upcoming';
    }
    await ev.save();
    await audit(req, 'event.updated', 'event', `Event "${ev.name}" updated`);
    res.json({ event: eventView(ev.toObject()) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Org event update error:', error.message);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.post('/events/:id/pause', async (req, res) => {
  if (!hasPerm(req, 'organization.events.devices.manage')) return denyPerm(res, 'organization.events.devices.manage');
  try {
    const ev = await Event.findOneAndUpdate(
      { _id: req.params.id, ...getOrgFilter(req.user) },
      { paused: true },
      { new: true }
    );
    if (!ev) return res.status(404).json({ error: 'Event not found.' });
    await audit(req, 'event.paused', 'event', `Event "${ev.name}" paused`);
    res.json({ ok: true, status: 'paused' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pause event' });
  }
});

router.post('/events/:id/resume', async (req, res) => {
  if (!hasPerm(req, 'organization.events.devices.manage')) return denyPerm(res, 'organization.events.devices.manage');
  try {
    const ev = await Event.findOneAndUpdate(
      { _id: req.params.id, ...getOrgFilter(req.user) },
      { paused: false },
      { new: true }
    );
    if (!ev) return res.status(404).json({ error: 'Event not found.' });
    await audit(req, 'event.resumed', 'event', `Event "${ev.name}" resumed`);
    res.json({ ok: true, status: computeEventStatus(ev) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resume event' });
  }
});

router.delete('/events/:id', async (req, res) => {
  if (!hasPerm(req, 'organization.events.devices.manage')) return denyPerm(res, 'organization.events.devices.manage');
  try {
    const ev = await Event.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!ev) return res.status(404).json({ error: 'Event not found.' });
    if (computeEventStatus(ev) === 'active') {
      return res.status(409).json({ error: 'Pause the event before deleting it.' });
    }
    await Event.findByIdAndDelete(ev._id);
    await Device.updateMany({ assignedEventId: ev._id }, { $set: { assignedEventId: null } });
    await Coupon.updateMany(
      { ...getOrgFilter(req.user), eventIds: ev._id },
      { $pull: { eventIds: ev._id } }
    );
    await audit(req, 'event.deleted', 'event', `Event "${ev.name}" deleted`, 'warn');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ─── TEMPLATES (active global templates — event picker) ────────────────────

router.get('/templates', async (req, res) => {
  try {
    const templates = await Template.find({ active: { $ne: false } }).sort({ createdAt: -1 });
    res.json({
      templates: templates.map((t) => ({
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
        usage: t.usage || 0,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ─── DEVICES ───────────────────────────────────────────────────────────────

function deviceView(d, event) {
  return {
    id: d._id,
    deviceUuid: d.deviceUuid,
    deviceName: d.deviceName || d.macAddress || 'Unknown Device',
    location: d.location || '',
    registeredAt: d.createdAt,
    telemetry: d.telemetry || null,
    connections: d.connections || null,
    operatorName: d.operatorName || null,
    operatorPhone: d.operatorPhone || null,
    lastSeenAt: d.lastSeenAt || null,
    online: computeDeviceOnline(d),
    status: d.status,
    assignedEvent: event
      ? { id: event._id, name: event.name, status: computeEventStatus(event) }
      : null,
  };
}

router.get('/devices', async (req, res) => {
  try {
    const ctx = await loadOrgContext(req);
    if (!ctx) return res.status(404).json({ error: 'Organization not found' });
    const devices = await Device.find(getOrgFilter(req.user)).lean();
    const events = await Event.find(getOrgFilter(req.user)).lean();
    const rows = devices.map((d) => {
      const ev = events.find((e) => String(e._id) === String(d.assignedEventId));
      return deviceView(d, ev);
    });
    res.json({
      devices: rows,
      limit: { used: rows.length, allowed: ctx.summary.deviceLimit },
      canRegister: !ctx.blocked && (ctx.summary.deviceLimit < 0 || rows.length < ctx.summary.deviceLimit),
    });
  } catch (error) {
    console.error('Org devices error:', error.message);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

router.put('/devices/:id', async (req, res) => {
  if (!hasPerm(req, 'organization.events.devices.manage')) return denyPerm(res, 'organization.events.devices.manage');
  try {
    const device = await Device.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!device) return res.status(404).json({ error: 'Device not found.' });

    const changes = [];
    if (req.body?.deviceName != null) {
      const name = safeStr(req.body.deviceName, 80);
      if (!name) return res.status(400).json({ error: 'Device name cannot be empty.' });
      if (name !== device.deviceName) {
        changes.push(`renamed "${device.deviceName}" → "${name}"`);
        device.deviceName = name;
      }
    }
    if (req.body?.operatorName !== undefined) {
      const v = safeStr(req.body.operatorName, 80) || null;
      if (v && !device.operatorName) changes.push(`operator ${v} assigned`);
      else if (!v && device.operatorName) changes.push(`operator ${device.operatorName} removed`);
      else if (v && v !== device.operatorName) changes.push(`operator changed to ${v}`);
      device.operatorName = v;
    }
    if (req.body?.operatorPhone !== undefined) {
      const v = safeStr(req.body.operatorPhone, 20) || null;
      if (v && v.length > 20) return res.status(400).json({ error: 'Phone number looks too long.' });
      device.operatorPhone = v;
    }
    await device.save();
    if (changes.length) {
      await audit(req, 'device.updated', 'device', `${device.deviceName}: ${changes.join(', ')}`);
    }
    const ev = device.assignedEventId ? await Event.findById(device.assignedEventId).lean() : null;
    res.json({ device: deviceView(device.toObject(), ev) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update device' });
  }
});

router.delete('/devices/:id', async (req, res) => {
  if (!hasPerm(req, 'organization.events.devices.manage')) return denyPerm(res, 'organization.events.devices.manage');
  try {
    const device = await Device.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!device) return res.status(404).json({ error: 'Device not found.' });
    if (device.assignedEventId) {
      const ev = await Event.findById(device.assignedEventId);
      if (ev && computeEventStatus(ev) === 'active') {
        return res.status(409).json({ error: 'This device is assigned to an active event. Unassign it first.' });
      }
    }
    await Device.findByIdAndDelete(device._id);
    await audit(req, 'device.removed', 'device', `Device "${device.deviceName}" removed`, 'warn');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

router.post('/devices/:id/assign', async (req, res) => {
  if (!hasPerm(req, 'organization.events.devices.manage')) return denyPerm(res, 'organization.events.devices.manage');
  try {
    const device = await Device.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!device) return res.status(404).json({ error: 'Device not found.' });
    const ev = await Event.findOne({ _id: req.body?.eventId, ...getOrgFilter(req.user) });
    if (!ev) return res.status(404).json({ error: 'Event not found.' });
    if (computeEventStatus(ev) === 'finished') {
      return res.status(409).json({ error: 'Cannot assign a finished event to a device.' });
    }
    device.assignedEventId = ev._id;
    device.currentEventId = ev._id;
    device.currentEventName = ev.name;
    await device.save();
    await audit(req, 'event.assigned_to_device', 'event', `Event "${ev.name}" assigned to ${device.deviceName}`);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign device' });
  }
});

router.post('/devices/:id/unassign', async (req, res) => {
  if (!hasPerm(req, 'organization.events.devices.manage')) return denyPerm(res, 'organization.events.devices.manage');
  try {
    const device = await Device.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!device) return res.status(404).json({ error: 'Device not found.' });
    const evName = device.assignedEventId ? (await Event.findById(device.assignedEventId))?.name : null;
    device.assignedEventId = null;
    device.currentEventId = null;
    device.currentEventName = null;
    await device.save();
    await audit(req, 'event.unassigned_from_device', 'event', `Event ${evName ? `"${evName}"` : 'assignment'} removed from ${device.deviceName}`);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unassign device' });
  }
});

// ─── TICKETS (Guest Support) ───────────────────────────────────────────────

function ticketView(t) {
  const isLegacy = !t.guest && (t.name || t.email);
  return {
    id: t._id,
    category: t.category || 'general',
    subject: t.subject,
    priority: t.priority === 'normal' ? 'medium' : (t.priority || 'medium'),
    status: t.status === 'in-progress' ? 'in_progress' : t.status,
    guest: t.guest && (t.guest.name || t.guest.contact)
      ? { name: t.guest.name || 'Guest', contact: t.guest.contact || '' }
      : { name: t.name || 'Guest', contact: t.email || '' },
    messages: (t.messages && t.messages.length ? t.messages : (t.adminNotes || []).map((n) => ({ _id: n._id, text: n.text, author: 'Admin', at: n.createdAt })))
      .map((m) => ({ id: m._id, text: m.text, author: m.author, at: m.at })),
    session: t.session && Object.keys(t.session).length
      ? t.session
      : (t.sessionId ? { id: t.sessionId, legacy: true } : null),
    resolution: t.resolution || null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    _model: t.__t || (isLegacy ? 'SupportTicket' : 'Ticket'),
  };
}

// Guest tickets live in the Ticket collection (booth contract); tickets
// created through the legacy /api/support route live in SupportTicket.
// Both are surfaced in the CRM inbox.
async function findGuestTicket(id, orgFilter) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const t = await Ticket.findOne({ _id: id, ...orgFilter });
  if (t) return { doc: t, model: Ticket };
  const s = await SupportTicket.findOne({ _id: id, ...orgFilter });
  if (s) return { doc: s, model: SupportTicket };
  return null;
}

async function allGuestTickets(orgFilter) {
  const [tickets, legacy] = await Promise.all([
    Ticket.find(orgFilter).lean(),
    SupportTicket.find(orgFilter).lean(),
  ]);
  return [...tickets.map((t) => ({ ...t, _model: 'Ticket' })), ...legacy.map((t) => ({ ...t, _model: 'SupportTicket' }))]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

router.get('/tickets', async (req, res) => {
  try {
    if (!hasPerm(req, 'organization.tickets.view.resolve')) return denyPerm(res, 'organization.tickets.view.resolve');
    const q = req.query;
    let rows = await allGuestTickets(getOrgFilter(req.user));
    if (q.status) rows = rows.filter((t) => (t.status === 'in-progress' ? 'in_progress' : t.status) === q.status);
    if (q.priority) rows = rows.filter((t) => (t.priority === 'normal' ? 'medium' : t.priority || 'medium') === q.priority);

    const counts = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    rows.forEach((t) => {
      const s = t.status === 'in-progress' ? 'in_progress' : t.status;
      if (counts[s] !== undefined) counts[s] += 1;
    });
    res.json({
      tickets: rows.map((t) => {
        const view = ticketView(t);
        delete view._model;
        return view;
      }),
      counts,
    });
  } catch (error) {
    console.error('Org tickets error:', error.message);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

router.get('/tickets/:id', async (req, res) => {
  try {
    const found = await findGuestTicket(req.params.id, getOrgFilter(req.user));
    if (!found) return res.status(404).json({ error: 'Not found' });
    const view = ticketView(found.doc.toObject ? found.doc.toObject() : found.doc);
    delete view._model;
    res.json({ ticket: view });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

router.post('/tickets/:id/reply', async (req, res) => {
  try {
    const found = await findGuestTicket(req.params.id, getOrgFilter(req.user));
    if (!found) return res.status(404).json({ error: 'Ticket not found.' });
    const text = safeStr(req.body?.message ?? req.body?.text, 2000);
    if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });

    const { doc, model } = found;
    if (model === Ticket) {
      doc.messages.push({ author: `${req.user.name} (${roleLabel(req.user.role)})`, at: new Date(), text });
      if (doc.status === 'open') doc.status = 'in_progress';
    } else {
      doc.adminNotes.push({ text, createdAt: new Date() });
      if (doc.status === 'open') doc.status = 'in-progress';
    }
    await doc.save();
    const view = ticketView(doc.toObject ? doc.toObject() : doc);
    delete view._model;
    res.json({ ticket: view });
  } catch (error) {
    console.error('Ticket reply error:', error.message);
    res.status(500).json({ error: 'Failed to reply' });
  }
});

router.post('/tickets/:id/resolve', async (req, res) => {
  try {
    const found = await findGuestTicket(req.params.id, getOrgFilter(req.user));
    if (!found) return res.status(404).json({ error: 'Ticket not found.' });
    const { doc } = found;
    doc.status = 'resolved';
    doc.resolution = safeStr(req.body?.note, 2000) || 'Resolved by organization team.';
    await doc.save();
    await audit(req, 'ticket.resolved', 'ticket', `Ticket "${doc.subject}" resolved`);
    const view = ticketView(doc.toObject ? doc.toObject() : doc);
    delete view._model;
    res.json({ ticket: view });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve' });
  }
});

router.post('/tickets/:id/reopen', async (req, res) => {
  try {
    const found = await findGuestTicket(req.params.id, getOrgFilter(req.user));
    if (!found) return res.status(404).json({ error: 'Ticket not found.' });
    const { doc } = found;
    doc.status = 'open';
    await doc.save();
    const view = ticketView(doc.toObject ? doc.toObject() : doc);
    delete view._model;
    res.json({ ticket: view });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reopen' });
  }
});

// ─── PLATFORM SUPPORT (org ⇄ platform) ─────────────────────────────────────

function orgSupportView(t, creator) {
  return {
    id: t._id,
    ticketNo: t.ticketNo || null,
    subject: t.subject,
    category: t.category || 'other',
    priority: t.priority || 'medium',
    status: t.status,
    creator: creator ? { name: creator.name, role: creator.role } : { name: 'Team member', role: null },
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

router.get('/platform-support', async (req, res) => {
  try {
    const q = req.query;
    const base = { ...getOrgFilter(req.user) };
    let rows = await PlatformSupportRequest.find(base).sort({ updatedAt: -1 }).populate('createdBy', 'name role');
    if (q.status) rows = rows.filter((r) => r.status === q.status);
    const all = await PlatformSupportRequest.find(base);
    const counts = Object.fromEntries(SUPPORT_STATUSES.map((s) => [s, 0]));
    all.forEach((r) => { if (counts[r.status] != null) counts[r.status] += 1; });
    res.json({
      requests: rows.map((r) => orgSupportView(r, r.createdBy)),
      counts,
    });
  } catch (error) {
    console.error('Org platform-support error:', error.message);
    res.status(500).json({ error: 'Failed to fetch platform requests' });
  }
});

router.get('/platform-support/:id', async (req, res) => {
  try {
    const r = await PlatformSupportRequest.findOne({ _id: req.params.id, ...getOrgFilter(req.user) }).populate('createdBy', 'name role');
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json({ request: orgSupportView(r, r.createdBy) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

router.post('/platform-support', async (req, res) => {
  try {
    const subject = safeStr(req.body?.subject, 160);
    if (!subject) return res.status(400).json({ error: 'A subject is required.' });
    const category = SUPPORT_CATEGORIES.includes(req.body?.category) ? req.body.category : 'other';
    const priority = SUPPORT_PRIORITIES.includes(req.body?.priority) ? req.body.priority : 'medium';

    const images = Array.isArray(req.body?.images)
      ? req.body.images.slice(0, 4).map((src) => safeMediaUrl(src)).filter(Boolean)
      : [];
    const message = safeStr(req.body?.message, 2000);
    if (!message && images.length === 0) return res.status(400).json({ error: 'Write a message or attach an image.' });

    const t = new PlatformSupportRequest({
      ...getOrgFilter(req.user),
      subject,
      category,
      priority,
      status: 'new',
      createdBy: req.user._id,
      messages: [{
        authorId: req.user._id,
        authorName: req.user.name,
        authorRole: req.user.role,
        side: 'org',
        at: new Date(),
        text: message || subject,
        images,
      }],
    });
    await t.save();
    await audit(req, 'organization.platform_support.requested', 'support_request', `Platform support requested: "${subject}"`);
    res.status(201).json({ request: orgSupportView(t, req.user) });
  } catch (error) {
    console.error('Org platform-support create error:', error.message);
    res.status(500).json({ error: 'Failed to create platform request' });
  }
});

router.post('/platform-support/:id/reapply', async (req, res) => {
  try {
    const t = await PlatformSupportRequest.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!t) return res.status(404).json({ error: 'Support request not found.' });
    if (t.status !== 'denied') return res.status(409).json({ error: 'Only a denied request can be re-applied.' });

    const images = Array.isArray(req.body?.images)
      ? req.body.images.slice(0, 4).map((src) => safeMediaUrl(src)).filter(Boolean)
      : [];
    const message = safeStr(req.body?.message, 2000);
    if (!message && images.length === 0) return res.status(400).json({ error: 'Write a message or attach an image.' });

    const at = new Date();
    t.messages.push({
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      side: 'org',
      at,
      text: message || 'Re-applying this request.',
      images,
    });
    t.decisionHistory = [...(t.decisionHistory || []), t.decision].filter(Boolean);
    t.decision = null;
    t.status = 'new';
    t.ticketNo = null;
    t.reapplyCount = (t.reapplyCount || 0) + 1;
    t.lastReapplication = { text: message, images, authorId: req.user._id, at };
    t.resolution = null;
    await t.save();
    await audit(req, 'organization.platform_support.reapplied', 'support_request', `Re-applied platform support request "${t.subject}"`);
    res.json({ request: orgSupportView(t, req.user) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to re-apply' });
  }
});

router.post('/platform-support/:id/reply', async (req, res) => {
  try {
    const t = await PlatformSupportRequest.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!t) return res.status(404).json({ error: 'Support request not found.' });
    if (!['open', 'in_progress'].includes(t.status)) {
      return res.status(409).json({ error: 'Messages can only be sent on an accepted, active ticket.' });
    }
    const images = Array.isArray(req.body?.images)
      ? req.body.images.slice(0, 4).map((src) => safeMediaUrl(src)).filter(Boolean)
      : [];
    const message = safeStr(req.body?.message ?? req.body?.text, 2000);
    if (!message && images.length === 0) return res.status(400).json({ error: 'Write a message or attach an image.' });

    t.messages.push({
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      side: 'org',
      at: new Date(),
      text: message,
      images,
    });
    t.status = 'in_progress';
    await t.save();
    res.json({ request: orgSupportView(t, req.user) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reply' });
  }
});

// ─── REVENUE / WALLET ──────────────────────────────────────────────────────

// Wallet = paid, wallet-settled print revenue minus every withdrawal that
// is not failed (processing counts as already committed).
async function walletOf(orgId) {
  const paid = await Payment.find({ organizationId: orgId, status: 'paid' }).lean();
  const credited = paid.filter((p) => p.settlement === 'wallet').reduce((s, p) => s + p.amount, 0);
  const viaUpi = paid.filter((p) => p.settlement !== 'wallet').reduce((s, p) => s + p.amount, 0);
  const wds = await Withdrawal.find({ organizationId: orgId }).lean();
  const withdrawn = wds.filter((w) => w.status === 'paid').reduce((s, w) => s + w.amount, 0);
  const processing = wds.filter((w) => w.status === 'processing').reduce((s, w) => s + w.amount, 0);
  return {
    balance: credited - withdrawn - processing,
    credited,
    withdrawn,
    processing,
    viaUpi,
    minWithdrawal: MIN_WITHDRAWAL,
    withdrawals: wds.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)),
  };
}

async function payoutOf(orgId) {
  const d = await OrganizationDefaults.findOne({ organizationId: orgId }).lean();
  return { upiId: d?.upiId || null, payoutMode: d?.payoutMode === 'upi' ? 'upi' : 'wallet' };
}

router.get('/revenue', requireOrgAdmin, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const q = req.query;
    const now = new Date();
    const fy = new Date(now.getFullYear(), now.getMonth() >= 3 ? 3 : -9, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let pays = await Payment.find({ organizationId: orgId, status: { $ne: 'failed' } }).lean();
    if (q.from) pays = pays.filter((p) => new Date(p.createdAt) >= new Date(q.from));
    if (q.to) pays = pays.filter((p) => new Date(p.createdAt) <= new Date(q.to));
    if (q.eventId) pays = pays.filter((p) => String(p.eventId) === String(q.eventId));
    if (q.deviceId) pays = pays.filter((p) => String(p.deviceId) === String(q.deviceId));

    const all = await Payment.find({ organizationId: orgId }).lean();
    const byStatus = {
      paid: all.filter((p) => p.status === 'paid').length,
      pending: all.filter((p) => ['created', 'pending'].includes(p.status)).length,
      failed: all.filter((p) => p.status === 'failed').length,
    };

    const events = await Event.find({ organizationId: orgId }).lean();
    const devices = await Device.find({ organizationId: orgId }).lean();

    const byEvent = events.map((e) => {
      const rows = pays.filter((p) => String(p.eventId) === String(e._id));
      return {
        id: e._id,
        name: e.name,
        status: computeEventStatus(e),
        total: rows.reduce((s, p) => s + p.amount, 0),
        prints: rows.reduce((s, p) => s + (p.printCount || 0), 0),
        transactions: rows.length,
      };
    }).sort((a, b) => b.total - a.total);

    const byDevice = devices.map((d) => {
      const rows = pays.filter((p) => String(p.deviceId) === String(d._id));
      return {
        id: d._id,
        name: d.deviceName,
        online: computeDeviceOnline(d),
        total: rows.reduce((s, p) => s + p.amount, 0),
        prints: rows.reduce((s, p) => s + (p.printCount || 0), 0),
        transactions: rows.length,
      };
    }).sort((a, b) => b.total - a.total);

    // Event × booth matrix
    const paidRows = all.filter((p) => p.status === 'paid');
    const cellMap = new Map();
    for (const x of paidRows) {
      const key = `${x.eventId || 'none'}|${x.deviceId || 'none'}`;
      const c = cellMap.get(key) || { eventId: x.eventId || null, deviceId: x.deviceId || null, total: 0, prints: 0, transactions: 0, viaUpi: 0, viaWallet: 0 };
      c.total += x.amount;
      c.prints += x.printCount || 0;
      c.transactions += 1;
      if (x.settlement === 'upi') c.viaUpi += x.amount; else c.viaWallet += x.amount;
      cellMap.set(key, c);
    }
    const evName = (id) => (events.find((e) => String(e._id) === String(id)) || {}).name || (id ? 'Deleted event' : 'No event (walk-in)');
    const devName = (id) => (devices.find((d) => String(d._id) === String(id)) || {}).deviceName || (id ? 'Removed booth' : 'Unknown booth');
    const matrix = [...cellMap.values()]
      .map((c) => ({ ...c, eventName: evName(c.eventId), deviceName: devName(c.deviceId) }))
      .sort((a, b) => b.total - a.total);

    const paid = all.filter((p) => p.status === 'paid');
    const settlement = {
      upi: paid.filter((x) => x.settlement === 'upi').reduce((s, x) => s + x.amount, 0),
      wallet: paid.filter((x) => x.settlement !== 'upi').reduce((s, x) => s + x.amount, 0),
    };

    // 8-month series (total + upi/wallet split)
    const monthSeries = (months = 8) => {
      const out = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = monthKey(d);
        out.push({ key, value: 0, upi: 0, wallet: 0 });
      }
      return out;
    };
    const monthWise = monthSeries();
    paid.forEach((x) => {
      const key = monthKey(new Date(x.paidAt || x.createdAt));
      const bucket = monthWise.find((m) => m.key === key);
      if (bucket) {
        bucket.value += x.amount;
        if (x.settlement === 'upi') bucket.upi += x.amount; else bucket.wallet += x.amount;
      }
    });

    res.json({
      payout: await payoutOf(orgId),
      wallet: await walletOf(orgId),
      settlement,
      matrix,
      monthSplit: monthWise.map((m) => ({ ...m, label: monthLabelOf(m.key) })),
      monthWise: monthWise.map((m) => ({ ...m, label: monthLabelOf(m.key) })),
      total: pays.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
      thisMonth: paid.filter((x) => new Date(x.paidAt || x.createdAt) >= monthStart).reduce((s, x) => s + x.amount, 0),
      fy: paid.filter((x) => new Date(x.paidAt || x.createdAt) >= fy).reduce((s, x) => s + x.amount, 0),
      byEvent,
      byDevice,
      byStatus,
      events: events.map((e) => ({ id: e._id, name: e.name })),
      devices: devices.map((d) => ({ id: d._id, name: d.deviceName })),
      filters: { from: q.from || null, to: q.to || null, eventId: q.eventId || null, deviceId: q.deviceId || null },
    });
  } catch (error) {
    console.error('Org revenue error:', error.message);
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

router.get('/wallet', requireOrgAdmin, async (req, res) => {
  try {
    res.json({ ...(await walletOf(req.user.organizationId)), payout: await payoutOf(req.user.organizationId) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

router.post('/wallet/withdraw', requireOrgAdmin, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { upiId } = await payoutOf(orgId);
    if (!upiId) return res.status(400).json({ error: 'Add your UPI ID in Organization Defaults before withdrawing.' });

    const amount = Math.round(Number(req.body?.amount));
    const w = await walletOf(orgId);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      return res.status(400).json({ error: `Minimum withdrawal is ₹${MIN_WITHDRAWAL}.` });
    }
    if (amount > w.balance) {
      return res.status(400).json({ error: `You can withdraw up to ₹${w.balance.toLocaleString('en-IN')} right now.` });
    }

    const reference = `HPX-PO-${String(new Date().getFullYear()).slice(2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(1000 + Math.floor(Math.random() * 9000))}`;
    const wd = new Withdrawal({
      organizationId: orgId,
      amount,
      upiId,
      status: 'processing',
      reference,
      requestedBy: req.user._id,
    });
    await wd.save();
    await audit(req, 'organization.wallet.withdrawal_requested', 'wallet', `Withdrawal of ₹${amount.toLocaleString('en-IN')} requested to ${upiId} (${reference})`, 'warn');
    res.status(201).json({
      withdrawal: {
        id: wd._id, amount: wd.amount, upiId: wd.upiId, status: wd.status,
        reference: wd.reference, requestedAt: wd.requestedAt, paidAt: null,
      },
      wallet: { ...(await walletOf(orgId)), payout: await payoutOf(orgId) },
    });
  } catch (error) {
    console.error('Withdraw error:', error.message);
    res.status(500).json({ error: 'Failed to request withdrawal' });
  }
});

// ─── DEFAULTS (org config surface) ─────────────────────────────────────────

async function defaultsView(orgId, org) {
  let doc = await OrganizationDefaults.findOne({ organizationId: orgId });
  if (!doc) {
    doc = new OrganizationDefaults({ organizationId: orgId });
    await doc.save();
  }
  const fullPrices = effectiveLayoutPrices(doc, null, { suggested: suggestedPriceMap() });
  const payout = await payoutOf(orgId);
  const wallet = await walletOf(orgId);
  return {
    id: doc._id,
    name: doc.name || org.name,
    logoUrl: doc.logoUrl || null,
    boothTimeoutSec: doc.boothTimeoutSec ?? 600,
    layoutPrices: fullPrices,
    upiId: payout.upiId,
    payoutMode: payout.payoutMode,
    wallet: { balance: wallet.balance },
  };
}

router.get('/defaults', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json(await defaultsView(req.user.organizationId, org));
  } catch (error) {
    console.error('Org defaults error:', error.message);
    res.status(500).json({ error: 'Failed to fetch defaults' });
  }
});

router.put('/defaults', requireOrgAdmin, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    let doc = await OrganizationDefaults.findOne({ organizationId: orgId });
    if (!doc) {
      doc = new OrganizationDefaults({ organizationId: orgId });
    }

    const b = req.body || {};
    if (b.name !== undefined) {
      const name = safeStr(b.name, 80);
      if (name) {
        doc.name = name;
        org.name = name;
        await org.save();
      }
    }
    if (b.logoUrl !== undefined) {
      const media = safeMediaUrl(b.logoUrl);
      if (b.logoUrl && !media) return res.status(400).json({ error: 'Logo must be an https:// or data:image/ URL.' });
      doc.logoUrl = media;
    }
    if (b.upiId !== undefined) {
      const id = safeStr(b.upiId, 256);
      const err = upiErrorLocal(id);
      if (err) return res.status(400).json({ error: err });
      doc.upiId = id || null;
    }
    if (b.payoutMode !== undefined) {
      if (!['upi', 'wallet'].includes(b.payoutMode)) return res.status(400).json({ error: 'payoutMode must be "upi" or "wallet".' });
      if (b.payoutMode === 'upi' && !doc.upiId) return res.status(400).json({ error: 'Add your UPI ID before turning on direct UPI payouts.' });
      const prevMode = doc.payoutMode;
      doc.payoutMode = b.payoutMode;
      if (prevMode !== doc.payoutMode) {
        await audit(
          req,
          'organization.payout.mode_changed',
          'organization',
          doc.payoutMode === 'upi'
            ? `Direct UPI payouts turned ON — guests now pay ${doc.upiId} directly`
            : 'Direct UPI payouts PAUSED — booth revenue now accrues to the HappyPix wallet',
          'warn'
        );
      }
    }
    if (b.boothTimeoutSec != null) {
      const sec = Number(b.boothTimeoutSec);
      if (!Number.isFinite(sec) || sec < 10 || sec > 86400) return res.status(400).json({ error: 'Booth idle timeout must be between 10 and 86400 seconds.' });
      doc.boothTimeoutSec = sec;
    }
    if (b.layoutPrices != null) {
      const merged = validateLayoutPrices({ ...effectiveLayoutPrices(doc, null, { suggested: suggestedPriceMap() }), ...b.layoutPrices });
      doc.layoutPrices = merged;
    }

    await doc.save();
    await audit(req, 'organization.defaults.updated', 'organization', `Layout prices / defaults updated for ${org.name}`);
    res.json(await defaultsView(orgId, org));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Org defaults save error:', error.message);
    res.status(500).json({ error: 'Failed to update defaults' });
  }
});

function upiErrorLocal(v) {
  const id = String(v || '').trim();
  if (!id) return null;
  if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(id)) return 'Enter a valid UPI ID, e.g. business@okaxis.';
  return null;
}

// ─── COUPONS ───────────────────────────────────────────────────────────────

function couponView(c, events) {
  return {
    id: c._id,
    code: c.code,
    type: c.type,
    value: c.value,
    quantity: c.quantity,
    usedCount: c.usedCount || 0,
    expiryDate: c.expiryDate,
    eventIds: (c.eventIds || []).map(String),
    events: (c.eventIds || [])
      .map((id) => {
        const e = events.find((ev) => String(ev._id) === String(id));
        return e ? { id: String(e._id), name: e.name } : null;
      })
      .filter(Boolean),
    status: c.status || 'active',
    isExhausted: (c.usedCount || 0) >= c.quantity,
    expired: new Date(c.expiryDate) < new Date(),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

router.get('/coupons', requireOrgAdmin, async (req, res) => {
  try {
    const coupons = await Coupon.find(getOrgFilter(req.user)).sort({ createdAt: -1 });
    const events = await Event.find(getOrgFilter(req.user)).select('name').lean();
    res.json({
      coupons: coupons.map((c) => couponView(c, events)),
      events: events.map((e) => ({ id: String(e._id), name: e.name })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

function validateCouponBody(body) {
  const code = String(body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const type = body?.type;
  const value = Number(body?.value);
  const quantity = Number(body?.quantity);
  const expiryDate = body?.expiryDate;
  if (!code) { const e = new Error('Code, discount, quantity and expiry are required.'); e.status = 400; throw e; }
  if (!['percentage', 'fixed'].includes(type)) { const e = new Error('Discount type must be percentage or fixed.'); e.status = 400; throw e; }
  if (!Number.isFinite(value) || value <= 0) { const e = new Error('Discount must be positive.'); e.status = 400; throw e; }
  if (type === 'percentage' && value > 100) { const e = new Error('Percentage must be between 1 and 100.'); e.status = 400; throw e; }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100000) { const e = new Error('Quantity must be a whole number from 1 to 100000.'); e.status = 400; throw e; }
  if (!expiryDate || Number.isNaN(new Date(expiryDate).getTime())) { const e = new Error('A valid expiry date is required.'); e.status = 400; throw e; }
  return { code, type, value, quantity, expiryDate: new Date(expiryDate) };
}

router.post('/coupons', requireOrgAdmin, async (req, res) => {
  try {
    const fields = validateCouponBody(req.body);
    if (await Coupon.findOne({ ...getOrgFilter(req.user), code: fields.code })) {
      return res.status(409).json({ error: 'A coupon with this code already exists.' });
    }
    const eventIds = Array.isArray(req.body?.eventIds) ? req.body.eventIds.filter((x) => x) : [];
    const c = new Coupon({ ...getOrgFilter(req.user), ...fields, eventIds, status: 'active' });
    await c.save();
    await audit(req, 'coupon.created', 'coupon', `Coupon ${c.code} created (${c.type === 'percentage' ? c.value + '%' : '₹' + c.value} off, ${c.quantity} uses)`);
    const events = await Event.find({ _id: { $in: eventIds } }).select('name').lean();
    res.status(201).json({ coupon: couponView(c, events) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

router.put('/coupons/:id', requireOrgAdmin, async (req, res) => {
  try {
    const c = await Coupon.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!c) return res.status(404).json({ error: 'Coupon not found.' });
    const fields = validateCouponBody(req.body);
    const dup = await Coupon.findOne({ ...getOrgFilter(req.user), code: fields.code, _id: { $ne: c._id } });
    if (dup) return res.status(409).json({ error: 'A coupon with this code already exists.' });
    Object.assign(c, fields);
    if (req.body?.eventIds !== undefined) c.eventIds = Array.isArray(req.body.eventIds) ? req.body.eventIds.filter((x) => x) : [];
    await c.save();
    await audit(req, 'coupon.updated', 'coupon', `Coupon ${c.code} updated`);
    const events = await Event.find({ _id: { $in: c.eventIds } }).select('name').lean();
    res.json({ coupon: couponView(c, events) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

router.post('/coupons/:id/pause', requireOrgAdmin, async (req, res) => {
  try {
    const c = await Coupon.findOneAndUpdate(
      { _id: req.params.id, ...getOrgFilter(req.user) },
      { status: 'paused' },
      { new: true }
    );
    if (!c) return res.status(404).json({ error: 'Coupon not found.' });
    await audit(req, 'coupon.paused', 'coupon', `Coupon ${c.code} paused`);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pause coupon' });
  }
});

router.post('/coupons/:id/activate', requireOrgAdmin, async (req, res) => {
  try {
    const c = await Coupon.findOneAndUpdate(
      { _id: req.params.id, ...getOrgFilter(req.user) },
      { status: 'active' },
      { new: true }
    );
    if (!c) return res.status(404).json({ error: 'Coupon not found.' });
    await audit(req, 'coupon.updated', 'coupon', `Coupon ${c.code} re-activated`);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate coupon' });
  }
});

router.delete('/coupons/:id', requireOrgAdmin, async (req, res) => {
  try {
    const c = await Coupon.findOneAndDelete({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!c) return res.status(404).json({ error: 'Coupon not found.' });
    await audit(req, 'coupon.deleted', 'coupon', `Coupon ${c.code} deleted`, 'warn');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

// ─── TEAM ──────────────────────────────────────────────────────────────────

router.get('/team', async (req, res) => {
  try {
    const members = await User.find(getOrgFilter(req.user)).sort({ createdAt: -1 });
    res.json({
      members: members.map(userPublic),
      canManage: req.user.role === ROLES.ORG_ADMIN,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

router.post('/team', requireOrgAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const name = safeStr(b.name, 80);
    const email = safeStr(b.email, 120).toLowerCase();
    const password = String(b.password || '');
    const role = b.role || ROLES.ORG_MANAGER;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
    const fmt = emailError(email);
    if (fmt) return res.status(400).json({ error: fmt });
    const policy = passwordPolicyError(password);
    if (policy) return res.status(400).json({ error: policy });
    if (![ROLES.ORG_ADMIN, ROLES.ORG_MANAGER].includes(role)) {
      return res.status(400).json({ error: 'Team members are Organization Admins or Organization Managers.' });
    }
    if (await User.findOne({ email })) return res.status(409).json({ error: 'A user with this email already exists.' });

    const user = new User({ name, email, password, role, organizationId: req.user.organizationId, status: 'active' });
    await user.save();
    await audit(req, 'organization.team.created', 'user', `${roleLabel(role)} ${name} created`);
    res.status(201).json({ member: userPublic(user) });
  } catch (error) {
    console.error('Team create error:', error.message);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

router.put('/team/:id', requireOrgAdmin, async (req, res) => {
  try {
    const m = await User.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!m) return res.status(404).json({ error: 'Team member not found.' });

    const keys = Object.keys(req.body || {});
    if (keys.some((key) => key !== 'status')) {
      return res.status(403).json({ error: 'Identity is self-managed — only activation status can be changed here.' });
    }
    if (!['active', 'inactive'].includes(req.body?.status)) return res.status(400).json({ error: 'Status must be active or inactive.' });
    if (m.role === ROLES.ORG_ADMIN && req.body.status !== 'active') {
      const activeAdmins = await User.countDocuments({ organizationId: req.user.organizationId, role: ROLES.ORG_ADMIN, status: 'active' });
      if (activeAdmins <= 1) return res.status(409).json({ error: 'This is the last active admin and cannot be deactivated.' });
    }
    if (String(m._id) === String(req.user._id) && req.body.status !== 'active') {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    m.status = req.body.status;
    if (m.status !== 'active') m.tokenVersion = (m.tokenVersion || 0) + 1; // kill sessions
    await m.save();
    await audit(
      req,
      m.status === 'active' ? 'organization.team.reactivated' : 'organization.team.deactivated',
      'user',
      `Team member ${m.name} ${m.status === 'active' ? 're-activated' : 'deactivated'}`,
      m.status === 'active' ? 'info' : 'warn'
    );
    res.json({ member: userPublic(m) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

router.post('/team/:id/deactivate', requireOrgAdmin, async (req, res) => {
  try {
    const m = await User.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!m) return res.status(404).json({ error: 'Team member not found.' });
    if (m.role === ROLES.ORG_ADMIN) {
      const activeAdmins = await User.countDocuments({ organizationId: req.user.organizationId, role: ROLES.ORG_ADMIN, status: 'active' });
      if (activeAdmins <= 1) return res.status(409).json({ error: 'This is the last active admin — promote another admin first.' });
    }
    if (String(m._id) === String(req.user._id)) return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    m.status = 'inactive';
    m.tokenVersion = (m.tokenVersion || 0) + 1; // kill sessions
    await m.save();
    await audit(req, 'organization.team.deactivated', 'user', `Team member ${m.name} deactivated`, 'warn');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate member' });
  }
});

router.post('/team/:id/activate', requireOrgAdmin, async (req, res) => {
  try {
    const m = await User.findOneAndUpdate(
      { _id: req.params.id, ...getOrgFilter(req.user) },
      { status: 'active' },
      { new: true }
    );
    if (!m) return res.status(404).json({ error: 'Team member not found.' });
    await audit(req, 'organization.team.updated', 'user', `Team member ${m.name} re-activated`);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate member' });
  }
});

// ─── GALLERY ───────────────────────────────────────────────────────────────

router.get('/gallery', async (req, res) => {
  try {
    const settings = await getPlatformSettings();
    const events = await Event.find(getOrgFilter(req.user)).select('name').lean();
    const booths = await Device.find(getOrgFilter(req.user)).select('deviceName').lean();

    const base = {
      enabled: settings.galleryEnabled,
      requireGuestConsent: settings.requireGuestConsent,
      photos: [],
      events: events.map((e) => ({ id: String(e._id), name: e.name })),
      booths: booths.map((b) => ({ id: String(b._id), name: b.deviceName })),
    };
    if (!settings.galleryEnabled) return res.json(base);

    const filter = { ...getOrgFilter(req.user), compositeUrl: { $ne: null } };
    if (req.query.eventId) filter.eventId = req.query.eventId;
    if (req.query.boothId) filter.deviceId = req.query.boothId;

    let photos = await Photo.find(filter).sort({ capturedAt: -1 }).limit(200).lean();
    if (settings.requireGuestConsent) photos = photos.filter((p) => p.guestConsent === true);

    base.photos = photos.map((p) => ({
      id: p._id,
      finalImageUrl: p.compositeUrl,
      eventId: p.eventId ? String(p.eventId) : null,
      eventName: events.find((e) => String(e._id) === String(p.eventId))?.name || 'Deleted event',
      boothId: p.deviceId ? String(p.deviceId) : null,
      boothName: booths.find((b) => String(b._id) === String(p.deviceId))?.deviceName || 'Removed booth',
      guestConsent: !!p.guestConsent,
      generatedAt: p.capturedAt || p.createdAt,
    }));
    res.json(base);
  } catch (error) {
    console.error('Org gallery error:', error.message);
    res.status(500).json({ error: 'Failed to fetch gallery' });
  }
});

// ─── AUDIT ─────────────────────────────────────────────────────────────────

router.get('/audit', requireOrgAdmin, async (req, res) => {
  try {
    const q = req.query;
    const filter = { organizationId: req.user.organizationId };
    if (q.action) filter.action = { $regex: String(q.action).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    if (q.from || q.to) {
      filter.at = {};
      if (q.from) filter.at.$gte = new Date(q.from);
      if (q.to) filter.at.$lte = new Date(`${q.to}T23:59:59`);
    }
    const rows = await AuditLog.find(filter).sort({ at: -1 }).limit(1000).populate('actorId', 'name role');
    const actors = await User.find(getOrgFilter(req.user)).select('name role').lean();

    const items = rows.map((l) => ({
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
    res.json({ ...paginated(items, { page: q.page, limit: q.limit || 20 }), actors });
  } catch (error) {
    console.error('Org audit error:', error.message);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
