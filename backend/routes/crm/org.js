import express from 'express';
import { requireOrgRole, requireOrgAdmin } from '../../middleware/auth.js';
import Organization from '../../models/Organization.js';
import OrganizationDefaults from '../../models/OrganizationDefaults.js';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Device from '../../models/Device.js';
import SupportTicket from '../../models/SupportTicket.js';
import PlatformSupportRequest from '../../models/PlatformSupportRequest.js';
import Coupon from '../../models/Coupon.js';
import AuditLog from '../../models/AuditLog.js';
import Template from '../../models/Template.js';
import Photo from '../../models/Photo.js';
import Payment from '../../models/Payment.js';
import Setting from '../../models/Setting.js';

const router = express.Router();

// Extract the org filter dynamically from the authenticated user
const getOrgFilter = (user) => {
  if (!user.organizationId) throw new Error('User has no organization assigned');
  return { organizationId: user.organizationId };
};

// All routes require an ORG role (ORG_ADMIN or ORG_MANAGER)
router.use(requireOrgRole);

// Helper for logging actions
const logAction = async (actorId, action, entity, summary, severity = 'info') => {
  await AuditLog.create({ actorId, action, entity, summary, severity });
};

// ─── DASHBOARD ─────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    
    const events = await Event.find(getOrgFilter(req.user));
    const devices = await Device.find(getOrgFilter(req.user));
    const openTickets = await SupportTicket.countDocuments({ ...getOrgFilter(req.user), status: { $in: ['open', 'in_progress'] } });
    const defs = await OrganizationDefaults.findOne(getOrgFilter(req.user));
    
    res.json({
      organization: { id: org._id, name: org.name, status: org.status },
      plan: { plan: org.plan || 'free', planName: org.plan || 'Free', daysLeft: 30, status: org.status, endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
      usage: { devicesUsed: devices.length, deviceLimit: 5, eventsUsed: events.filter(e => e.status === 'live').length, eventLimit: 2 },
      devices: { total: devices.length, online: devices.filter(d => d.status === 'active').length, offline: devices.filter(d => d.status !== 'active').length },
      events: {
        active: events.filter(e => e.status === 'live').map(e => ({ id: e._id, name: e.name, startDate: e.createdAt, status: 'active' })),
        upcoming: events.filter(e => e.status === 'draft').map(e => ({ id: e._id, name: e.name, startDate: e.createdAt, status: 'upcoming' })),
        paused: events.filter(e => e.status === 'paused').map(e => ({ id: e._id, name: e.name, startDate: e.createdAt, status: 'paused' })),
        finished: events.filter(e => e.status === 'completed').map(e => ({ id: e._id, name: e.name, startDate: e.createdAt, status: 'finished' }))
      },
      tickets: { open: openTickets, list: [] },
      warnings: org.status === 'suspended' ? ['Organization account is suspended. Event creation and device pairing are disabled.'] : [],
      revenue: req.user.role === 'ORG_ADMIN' ? { thisMonth: 0, total: 0, wallet: { balance: 0, processing: 0 }, payout: { payoutMode: defs?.payoutMode || 'upi', upiId: defs?.upiId || '' } } : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Dashboard error' });
  }
});

// ─── EVENTS ────────────────────────────────────────────────────────────────

router.get('/events', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    const isSuspended = org && org.status === 'suspended';
    const events = await Event.find(getOrgFilter(req.user)).sort({ createdAt: -1 });
    const devices = await Device.find(getOrgFilter(req.user));
    res.json({
      events: events.map(e => {
        const evDevices = devices.filter(d => String(d.assignedEventId) === String(e._id));
        return {
          id: e._id,
          name: e.name,
          clientName: e.clientName || 'N/A',
          location: e.location || 'Unknown',
          startDate: e.startDate || e.createdAt,
          endDate: e.endDate || e.createdAt,
          status: e.status === 'live' ? 'active' : e.status === 'draft' ? 'upcoming' : e.status,
          templateIds: e.templateIds || [],
          filters: e.filters || [],
          digitalCopy: e.digitalCopy ?? true,
          branding: e.branding || { logos: [], tagline: '' },
          layoutPrices: e.layoutPrices || {},
          assignedDevices: evDevices.map(d => ({
            id: d._id,
            name: d.deviceName || d.macAddress,
            online: d.status === 'active'
          }))
        };
      }),
      canCreate: !isSuspended
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/events', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (org.status === 'suspended') {
      return res.status(403).json({ error: 'Your organization is suspended. Event creation is disabled.' });
    }
    if (org.status === 'banned') {
      return res.status(403).json({ error: 'Your organization is banned. Event creation is disabled.' });
    }

    const ev = new Event({ ...req.body, ...getOrgFilter(req.user), status: 'live' });
    await ev.save();
    res.status(201).json({ event: { id: ev._id, ...ev.toObject() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/events/:id', async (req, res) => {
  try {
    const ev = await Event.findOneAndUpdate({ _id: req.params.id, ...getOrgFilter(req.user) }, req.body, { new: true });
    res.json({ event: { id: ev._id, ...ev.toObject() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.post('/events/:id/pause', async (req, res) => {
  try {
    const ev = await Event.findOneAndUpdate({ _id: req.params.id, ...getOrgFilter(req.user) }, { status: 'paused' }, { new: true });
    res.json({ ok: true, status: ev.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pause event' });
  }
});

router.post('/events/:id/resume', async (req, res) => {
  try {
    const ev = await Event.findOneAndUpdate({ _id: req.params.id, ...getOrgFilter(req.user) }, { status: 'live' }, { new: true });
    res.json({ ok: true, status: 'active' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resume event' });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    await Event.findOneAndDelete({ _id: req.params.id, ...getOrgFilter(req.user) });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ─── TEMPLATES ─────────────────────────────────────────────────────────────

router.get('/templates', async (req, res) => {
  try {
    const templates = await Template.find({ active: true }).sort({ createdAt: -1 });
    res.json({
      templates: templates.map(t => ({
        id: t._id,
        name: t.name,
        category: t.category,
        source: t.source || 'playground',
        layoutId: t.layoutId,
        design: t.design || {},
        description: t.description,
        active: t.active !== false,
        usage: 0,
        createdAt: t.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ─── DEVICES ───────────────────────────────────────────────────────────────

router.get('/devices', async (req, res) => {
  try {
    const devices = await Device.find(getOrgFilter(req.user)).populate('assignedEventId');
    res.json({
      devices: devices.map(d => ({
        id: d._id,
        deviceName: d.deviceName || d.macAddress || 'Unknown Device',
        deviceUuid: d.deviceUuid || d.deviceId || d.macAddress,
        registeredAt: d.createdAt,
        location: d.location || 'Unknown',
        telemetry: d.telemetry || null,
        connections: d.connections || null,
        online: d.status === 'active',
        operatorName: d.operatorName || '',
        operatorPhone: d.operatorPhone || '',
        lastSeenAt: d.lastSeenAt || d.lastActiveAt,
        assignedEvent: d.assignedEventId ? { 
           id: d.assignedEventId._id, 
           name: d.assignedEventId.name, 
           status: d.assignedEventId.status === 'live' ? 'active' : 'upcoming' 
        } : null
      })),
      limit: { used: devices.length, allowed: 5 }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

router.put('/devices/:id', async (req, res) => {
  try {
    const device = await Device.findOneAndUpdate({ _id: req.params.id, ...getOrgFilter(req.user) }, req.body, { new: true });
    res.json({ device: { id: device._id, ...device.toObject() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update device' });
  }
});

router.delete('/devices/:id', async (req, res) => {
  try {
    await Device.findOneAndDelete({ _id: req.params.id, ...getOrgFilter(req.user) });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

router.post('/devices/:id/assign', async (req, res) => {
  try {
    const { eventId } = req.body;
    await Device.findOneAndUpdate({ _id: req.params.id, ...getOrgFilter(req.user) }, { assignedEventId: eventId }, { new: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign device' });
  }
});

router.post('/devices/:id/unassign', async (req, res) => {
  try {
    await Device.findOneAndUpdate({ _id: req.params.id, ...getOrgFilter(req.user) }, { assignedEventId: null }, { new: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unassign device' });
  }
});

// ─── TICKETS (Guest Support) ───────────────────────────────────────────────

router.get('/tickets', async (req, res) => {
  try {
    const tickets = await SupportTicket.find(getOrgFilter(req.user)).sort({ createdAt: -1 });
    const counts = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    tickets.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
    res.json({
      tickets: tickets.map(t => ({
        id: t._id,
        category: t.category,
        subject: t.subject || 'Guest Ticket',
        priority: t.priority || 'medium',
        status: t.status,
        guest: { name: t.name || 'Guest', contact: t.email || '' },
        messages: t.adminNotes ? t.adminNotes.map(n => ({ text: n.text, author: 'Admin', at: n.createdAt })) : [],
        updatedAt: t.updatedAt
      })),
      counts
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

router.get('/tickets/:id', async (req, res) => {
  try {
    const t = await SupportTicket.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json({
      ticket: {
        id: t._id, category: t.category, subject: t.subject, status: t.status, priority: t.priority,
        guest: { name: t.name || 'Guest', contact: t.email || '' },
        messages: t.adminNotes ? t.adminNotes.map(n => ({ text: n.text, author: 'Admin', at: n.createdAt })) : [], session: null, updatedAt: t.updatedAt, createdAt: t.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

router.post('/tickets/:id/reply', async (req, res) => {
  try {
    const t = await SupportTicket.findOneAndUpdate(
      { _id: req.params.id, ...getOrgFilter(req.user) },
      { 
        status: 'open',
        $push: { 
          adminNotes: { 
            text: req.body.text || req.body.message, 
            createdAt: new Date() 
          } 
        } 
      },
      { new: true }
    );
    res.json({ ticket: { id: t._id, status: t.status, messages: t.adminNotes.map(n => ({ text: n.text, author: 'Admin', at: n.createdAt })) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reply' });
  }
});

router.post('/tickets', async (req, res) => {
  try {
    const { name, email, subject, category, message, priority } = req.body;
    const ticket = new SupportTicket({
      name: name || 'Guest',
      email: email || 'guest@example.com',
      subject: subject || 'Guest Support Request',
      category: category || 'general',
      message: message || '',
      priority: priority || 'medium',
      status: 'open',
      organizationId: req.user.organizationId,
      adminNotes: message ? [{ text: `Initial guest report: ${message}`, createdAt: new Date() }] : []
    });
    await ticket.save();
    res.status(201).json({ ticket: { id: ticket._id, ...ticket.toObject() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create guest ticket' });
  }
});

router.post('/tickets/:id/resolve', async (req, res) => {
  try {
    const t = await SupportTicket.findOneAndUpdate({ _id: req.params.id, ...getOrgFilter(req.user) }, { status: 'resolved' }, { new: true });
    res.json({ ticket: { id: t._id, status: t.status, messages: [] } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve' });
  }
});

router.post('/tickets/:id/reopen', async (req, res) => {
  try {
    const t = await SupportTicket.findOneAndUpdate({ _id: req.params.id, ...getOrgFilter(req.user) }, { status: 'open' }, { new: true });
    res.json({ ticket: { id: t._id, status: t.status, messages: [] } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reopen' });
  }
});

// ─── PLATFORM SUPPORT ──────────────────────────────────────────────────────

router.get('/platform-support', async (req, res) => {
  try {
    const reqs = await PlatformSupportRequest.find(getOrgFilter(req.user)).sort({ createdAt: -1 });
    res.json({
      requests: reqs.map(r => ({
        id: r._id, subject: r.subject, category: r.category || 'technical', priority: r.priority || 'medium',
        status: r.status, ticketNo: r.ticketNo || ('T-' + r._id.toString().substring(0, 4).toUpperCase()),
        messages: r.messages || [], updatedAt: r.updatedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch platform requests' });
  }
});

router.get('/platform-support/:id', async (req, res) => {
  try {
    const r = await PlatformSupportRequest.findOne({ _id: req.params.id, ...getOrgFilter(req.user) });
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json({
      request: {
        id: r._id, subject: r.subject, category: r.category, priority: r.priority, status: r.status,
        ticketNo: r.ticketNo || ('T-' + r._id.toString().substring(0, 4).toUpperCase()), creator: { name: req.user.name },
        messages: r.messages || [], createdAt: r.createdAt, updatedAt: r.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

router.post('/platform-support', async (req, res) => {
  try {
    const { subject, category, priority, message, images } = req.body;
    const count = await PlatformSupportRequest.countDocuments();
    const ticketNo = `T-${1000 + count + 1}`;
    const initialMessages = message ? [{
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      side: 'org',
      text: message,
      images: images || [],
      at: new Date()
    }] : [];

    const reqData = new PlatformSupportRequest({
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
      ticketNo,
      subject: subject || 'Support Request',
      category: category || 'technical',
      priority: priority || 'medium',
      status: 'open',
      messages: initialMessages
    });
    await reqData.save();
    res.status(201).json({ request: { id: reqData._id, ticketNo, ...reqData.toObject() } });
  } catch (error) {
    console.error('Failed to create platform request:', error);
    res.status(500).json({ error: 'Failed to create platform request' });
  }
});

router.post('/platform-support/:id/reply', async (req, res) => {
  try {
    const r = await PlatformSupportRequest.findOneAndUpdate(
      { _id: req.params.id, ...getOrgFilter(req.user) },
      {
        status: 'open',
        $push: {
          messages: {
            authorId: req.user._id,
            authorName: req.user.name,
            authorRole: req.user.role,
            side: 'org',
            text: req.body.message,
            images: req.body.images || [],
            at: new Date()
          }
        }
      },
      { new: true }
    );
    res.json({ request: { id: r._id, status: r.status, messages: r.messages } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reply' });
  }
});

router.post('/platform-support/:id/reapply', async (req, res) => {
  try {
    const { message, images } = req.body;
    const r = await PlatformSupportRequest.findOneAndUpdate(
      { _id: req.params.id, ...getOrgFilter(req.user) },
      {
        status: 'open',
        $inc: { reapplyCount: 1 },
        $push: {
          messages: {
            authorId: req.user._id,
            authorName: req.user.name,
            authorRole: req.user.role,
            side: 'org',
            text: message || 'Re-applied request',
            images: images || [],
            at: new Date()
          }
        },
        lastReapplication: {
          text: message || '',
          images: images || [],
          authorId: req.user._id,
          at: new Date()
        }
      },
      { new: true }
    );
    res.json({ request: { id: r._id, status: r.status, messages: r.messages } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reapply' });
  }
});

// ─── REVENUE & DEFAULTS & COUPONS (Admin Only) ─────────────────────────────

router.get('/revenue', requireOrgAdmin, async (req, res) => {
  try {
    const payments = await Payment.find(getOrgFilter(req.user));
    const defs = await OrganizationDefaults.findOne(getOrgFilter(req.user));
    let total = 0;
    let thisMonth = 0;
    const byStatus = { paid: 0, pending: 0, failed: 0 };
    
    const now = new Date();
    payments.forEach(p => {
      if (p.status === 'paid') {
        total += p.amount;
        if (p.createdAt.getMonth() === now.getMonth() && p.createdAt.getFullYear() === now.getFullYear()) {
          thisMonth += p.amount;
        }
      }
      if (byStatus[p.status] !== undefined) byStatus[p.status] += p.amount;
    });

    res.json({
      total, thisMonth, fy: total,
      byStatus,
      wallet: { balance: total, processing: byStatus.pending, credited: total, withdrawn: 0, viaUpi: total, minWithdrawal: 500, withdrawals: [] },
      payout: { payoutMode: defs?.payoutMode || 'upi', upiId: defs?.upiId || '' },
      settlement: { upi: total, wallet: 0 },
      monthWise: [], byEvent: [], byDevice: [],
      matrix: [], events: [], devices: []
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

router.post('/revenue/withdraw', requireOrgAdmin, async (req, res) => {
  res.json({ ok: true });
});

router.get('/defaults', async (req, res) => {
  try {
    let defs = await OrganizationDefaults.findOne(getOrgFilter(req.user));
    if (!defs) {
      defs = new OrganizationDefaults(getOrgFilter(req.user));
      await defs.save();
    }
    const obj = defs.toObject({ flattenMaps: true });
    res.json({ id: defs._id, ...obj });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch defaults' });
  }
});

router.put('/defaults', requireOrgAdmin, async (req, res) => {
  try {
    const defs = await OrganizationDefaults.findOneAndUpdate(getOrgFilter(req.user), req.body, { new: true, upsert: true });
    const obj = defs.toObject({ flattenMaps: true });
    res.json({ id: defs._id, ...obj });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update defaults' });
  }
});

router.get('/coupons', requireOrgAdmin, async (req, res) => {
  try {
    const coupons = await Coupon.find(getOrgFilter(req.user)).sort({ createdAt: -1 });
    const events = await Event.find(getOrgFilter(req.user)).select('name');
    const now = new Date();
    res.json({
      coupons: coupons.map(c => {
        const isExp = now > new Date(c.expiryDate);
        const isExh = (c.usedCount || 0) >= (c.quantity || 0);
        return {
          id: c._id,
          code: c.code,
          type: c.type || 'percentage',
          value: c.value,
          quantity: c.quantity,
          usedCount: c.usedCount || 0,
          expiryDate: c.expiryDate,
          expired: isExp,
          isExhausted: isExh,
          status: isExp ? 'expired' : (c.status || 'active'),
          eventIds: c.eventIds || [],
          events: (c.eventIds || []).map(eid => {
            const ev = events.find(e => String(e._id) === String(eid));
            return ev ? { id: ev._id, name: ev.name } : null;
          }).filter(Boolean),
          createdAt: c.createdAt
        };
      }),
      events: events.map(e => ({ id: e._id, name: e.name }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

router.post('/coupons', requireOrgAdmin, async (req, res) => {
  try {
    const c = new Coupon({ ...req.body, ...getOrgFilter(req.user) });
    await c.save();
    res.status(201).json({ coupon: { id: c._id, ...c.toObject() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

router.put('/coupons/:id', requireOrgAdmin, async (req, res) => {
  try {
    const c = await Coupon.findOneAndUpdate({ _id: req.params.id, ...getOrgFilter(req.user) }, req.body, { new: true });
    res.json({ coupon: { id: c._id, ...c.toObject() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

router.delete('/coupons/:id', requireOrgAdmin, async (req, res) => {
  try {
    await Coupon.findOneAndDelete({ _id: req.params.id, ...getOrgFilter(req.user) });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

// ─── TEAM & GALLERY & AUDIT ────────────────────────────────────────────────

router.get('/team', async (req, res) => {
  try {
    const usersList = await User.find(getOrgFilter(req.user)).select('-password -forgotPasswordCodeHash');
    const mapped = usersList.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt
    }));
    res.json({
      team: mapped,
      members: mapped
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

router.post('/team', requireOrgAdmin, async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const user = new User({ name, email, role, password, ...getOrgFilter(req.user), status: 'active' });
    await user.save();
    res.status(201).json({ member: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create member' });
  }
});

router.put('/team/:id', requireOrgAdmin, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate({ _id: req.params.id, ...getOrgFilter(req.user) }, { status: req.body.status }, { new: true });
    res.json({ member: { id: user._id, status: user.status } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

router.get('/gallery', async (req, res) => {
  try {
    const globalSetting = await Setting.findOne({ organizationId: null });
    const galleryEnabled = globalSetting ? globalSetting.galleryEnabled !== false : true;
    const requireGuestConsent = globalSetting ? !!globalSetting.requireGuestConsent : false;

    const events = await Event.find(getOrgFilter(req.user)).select('name');
    const devices = await Device.find(getOrgFilter(req.user)).select('deviceName macAddress');

    if (!galleryEnabled) {
      return res.json({
        enabled: false,
        requireGuestConsent,
        photos: [],
        events: events.map(e => ({ id: e._id, name: e.name })),
        booths: devices.map(d => ({ id: d._id, name: d.deviceName || d.macAddress }))
      });
    }

    const filter = { ...getOrgFilter(req.user) };
    if (req.query.eventId) filter.eventId = req.query.eventId;
    if (req.query.boothId) filter.deviceId = req.query.boothId;

    const photos = await Photo.find(filter).sort({ createdAt: -1 }).limit(100).populate('eventId deviceId');

    res.json({
      enabled: true,
      requireGuestConsent,
      photos: photos.map(p => ({
        id: p._id,
        finalImageUrl: p.url || p.s3Url,
        url: p.url || p.s3Url,
        eventId: p.eventId?._id,
        eventName: p.eventId?.name || 'Event Photo',
        boothId: p.deviceId?._id,
        boothName: p.deviceId?.deviceName || 'Photo Booth',
        generatedAt: p.createdAt || new Date()
      })),
      events: events.map(e => ({ id: e._id, name: e.name })),
      booths: devices.map(d => ({ id: d._id, name: d.deviceName || d.macAddress }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gallery' });
  }
});

router.get('/audit', requireOrgAdmin, async (req, res) => {
  try {
    const logs = await AuditLog.find(getOrgFilter(req.user)).sort({ at: -1 }).limit(100).populate('actorId', 'name role');
    res.json({
      items: logs.map(l => ({
        id: l._id,
        action: l.action,
        entity: l.entity,
        actorId: l.actorId ? (l.actorId._id || l.actorId) : null,
        actorName: l.actorId ? l.actorId.name : 'System',
        actorRole: l.actorId ? l.actorId.role : 'SYSTEM',
        summary: l.summary,
        severity: l.severity || 'info',
        ip: l.ip || '—',
        at: l.at
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
