import express from 'express';
import { requirePlatformRole, requireOwner } from '../../middleware/auth.js';
import Organization from '../../models/Organization.js';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Device from '../../models/Device.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Template from '../../models/Template.js';
import PlatformSupportRequest from '../../models/PlatformSupportRequest.js';
import AuditLog from '../../models/AuditLog.js';
import Payment from '../../models/Payment.js';
import Setting from '../../models/Setting.js';
import { PLAN_DEVICE_LIMITS } from '../../models/Organization.js';
import crypto from 'crypto';

const router = express.Router();

// All routes here require a platform role (OWNER, PLATFORM_ADMIN, SUPPORT_MANAGER)
router.use(requirePlatformRole);

// Helper for Audit Logs
const logAction = async (req, action, entity, summary, severity = 'info') => {
  await AuditLog.create({
    actorId: req.user._id,
    action,
    entity,
    summary,
    severity,
    ip: (Array.isArray(req.headers['x-forwarded-for'])
      ? req.headers['x-forwarded-for'][0]
      : req.headers['x-forwarded-for']?.split(',')[0])?.trim()
      || req.ip
      || req.socket?.remoteAddress
      || null,
  });
};

// ─── DASHBOARD ─────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const totalOrgs = await Organization.countDocuments();
    const activeOrgs = await Organization.countDocuments({ status: 'active' });
    const suspendedOrgs = await Organization.countDocuments({ status: 'suspended' });
    const bannedOrgs = await Organization.countDocuments({ status: 'banned' });
    const trialOrgs = await Organization.countDocuments({ status: 'trial' });

    const totalDevices = await Device.countDocuments();
    const activeDevices = await Device.countDocuments({ status: 'active' });
    
    const activeEvents = await Event.countDocuments({ status: 'live' });
    const upcomingEvents = await Event.countDocuments({ status: 'draft' });
    
    // Recent signups (last 5)
    const recentOrgs = await Organization.find()
      .sort({ createdAt: -1 })
      .limit(5);

    const recentSignups = recentOrgs.map(o => ({
      id: o._id, name: o.name, plan: o.plan, createdAt: o.createdAt, status: o.status
    }));

    // Expiring soon (less than 5 days left out of 30 day trial)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const twentyFiveDaysAgo = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000);
    const expiringOrgs = await Organization.find({
      createdAt: { $gte: thirtyDaysAgo, $lte: twentyFiveDaysAgo },
      status: 'active'
    });
    
    const expiringSoon = expiringOrgs.map(o => ({
      id: o._id,
      name: o.name,
      daysLeft: Math.max(0, Math.ceil((o.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (1000 * 60 * 60 * 24))),
      plan: o.plan || 'Free'
    }));

    // Near Limits (mock logic until real limits are enforced)
    const nearLimits = [];
    // Health Alerts (mock logic)
    const alerts = [];

    res.json({
      orgs: { total: totalOrgs, active: activeOrgs, suspended: suspendedOrgs, banned: bannedOrgs, trial: trialOrgs },
      devices: { total: totalDevices, online: activeDevices, offline: totalDevices - activeDevices, operational: activeDevices },
      events: { active: activeEvents, upcoming: upcomingEvents },
      expiringSoon,
      nearLimits,
      alerts,
      recentSignups
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ─── REVENUE ───────────────────────────────────────────────────────────────

router.get('/revenue', requireOwner, async (req, res) => {
  try {
    const orgs = await Organization.find();
    const payments = await Payment.find({ status: 'paid' });
    
    let net = 0;
    let fyRevenue = 0;
    let monthRevenue = 0;
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    const monthWiseMap = Array(12).fill(0);
    const quarterWiseMap = Array(4).fill(0);
    const orgRevMap = {};

    payments.forEach(p => {
      net += p.amount;
      const pDate = new Date(p.paidAt || p.createdAt);
      if (pDate.getFullYear() === currentYear) {
        fyRevenue += p.amount;
        monthWiseMap[pDate.getMonth()] += p.amount;
        quarterWiseMap[Math.floor(pDate.getMonth() / 3)] += p.amount;
        
        if (pDate.getMonth() === currentMonth) {
          monthRevenue += p.amount;
        }
      }
      
      const oId = String(p.organizationId || 'unassigned');
      if (!orgRevMap[oId]) orgRevMap[oId] = { total: 0, thisMonth: 0, fy: 0 };
      
      orgRevMap[oId].total += p.amount;
      if (pDate.getFullYear() === currentYear) {
        orgRevMap[oId].fy += p.amount;
        if (pDate.getMonth() === currentMonth) {
          orgRevMap[oId].thisMonth += p.amount;
        }
      }
    });

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const orgData = await Promise.all(orgs.map(async o => {
      const rev = orgRevMap[String(o._id)] || { total: 0, thisMonth: 0, fy: 0 };
      const ownerUser = await User.findOne({ organizationId: o._id, role: 'ORG_ADMIN' }) || {};
      
      return {
        id: o._id,
        name: o.name,
        email: ownerUser.email || 'N/A',
        plan: o.plan || 'Free',
        planStatus: o.status,
        expiry: new Date(o.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        daysLeft: Math.max(0, Math.ceil((o.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (1000 * 60 * 60 * 24))),
        revenueThisMonth: rev.thisMonth,
        revenueFY: rev.fy,
        revenue: rev.total
      };
    }));

    res.json({
      net,
      fyRevenue,
      monthRevenue,
      monthWise: monthWiseMap.map((val, idx) => ({ label: monthLabels[idx], value: val })),
      quarterWise: quarterWiseMap.map((val, idx) => ({ label: `Q${idx + 1}`, value: val })),
      yearOptions: [currentYear, currentYear - 1],
      orgs: orgData
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

// ─── ORGANIZATIONS ─────────────────────────────────────────────────────────

router.get('/organizations', async (req, res) => {
  try {
    const orgs = await Organization.find().sort({ createdAt: -1 });
    
    const items = await Promise.all(orgs.map(async o => {
      // Find org admin user for ownerName & email
      const ownerUser = await User.findOne({ organizationId: o._id, role: 'ORG_ADMIN' }) || {};
      const devCount = await Device.countDocuments({ organizationId: o._id });
      const onlineDevCount = await Device.countDocuments({ organizationId: o._id, status: 'active' });
      const activeEvCount = await Event.countDocuments({ organizationId: o._id, status: 'live' });
      
      const planKey = (o.plan || 'starter').toLowerCase();
      const planDeviceLimit = PLAN_DEVICE_LIMITS[planKey] ?? (planKey === 'professional' ? 5 : planKey === 'business' ? 10 : 1);
      const planEventLimit = planKey === 'starter' ? 1 : planKey === 'basic' ? 2 : planKey === 'professional' ? 5 : planKey === 'business' ? 10 : 2;
      
      return {
        id: o._id,
        name: o.name,
        ownerName: ownerUser.name || o.ownerName || 'Unknown',
        email: ownerUser.email || o.email || 'N/A',
        plan: planKey,
        planKey: planKey,
        planName: o.plan || 'Starter',
        planStatus: o.status,
        planExpiry: o.planExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        planDaysLeft: 30,
        onlineDevices: onlineDevCount,
        devices: devCount,
        deviceLimit: planDeviceLimit === -1 ? 'Unlimited' : planDeviceLimit,
        activeEvents: activeEvCount,
        eventLimit: planEventLimit,
        createdAt: o.createdAt,
        lastActiveAt: o.updatedAt || o.createdAt,
        status: o.status
      };
    }));

    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.get('/organizations/:id', async (req, res) => {
  try {
    const o = await Organization.findById(req.params.id);
    if (!o) return res.status(404).json({ error: 'Organization not found' });
    
    const ownerUser = await User.findOne({ organizationId: o._id, role: 'ORG_ADMIN' }) || {};
    const orgDevices = await Device.find({ organizationId: o._id });
    const orgEvents = await Event.find({ organizationId: o._id });
    const orgPayments = await Payment.find({ organizationId: o._id, status: 'paid' });

    const planKey = (o.plan || 'starter').toLowerCase();
    const planDeviceLimit = PLAN_DEVICE_LIMITS[planKey] ?? (planKey === 'professional' ? 5 : planKey === 'business' ? 10 : 1);
    const planEventLimit = planKey === 'starter' ? 1 : planKey === 'basic' ? 2 : planKey === 'professional' ? 5 : planKey === 'business' ? 10 : 2;

    const planData = {
      planName: o.plan || 'Starter',
      status: o.status,
      startDate: o.createdAt,
      endDate: o.planExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      deviceLimit: planDeviceLimit === -1 ? 'Unlimited' : planDeviceLimit,
      eventLimit: planEventLimit,
      daysLeft: 30
    };

    res.json({
      id: o._id,
      name: o.name,
      planName: o.plan || 'Starter',
      suspendReason: o.suspendReason || null,
      status: o.status,
      ownerName: ownerUser.name || o.ownerName || 'Unknown',
      email: ownerUser.email || o.email || 'N/A',
      phone: o.phone || 'N/A',
      country: o.country || 'IN',
      createdAt: o.createdAt,
      lastActiveAt: o.updatedAt || o.createdAt,
      plan: planData,
      deviceLimit: planDeviceLimit === -1 ? 'Unlimited' : planDeviceLimit,
      eventLimit: planEventLimit,
      subscription: null,
      devices: orgDevices.map(d => ({
        id: d._id,
        online: d.status === 'active',
        deviceName: d.deviceName || d.macAddress,
        location: d.location || 'Unknown',
        eventName: 'N/A'
      })),
      events: orgEvents.map(e => ({
        id: e._id,
        name: e.name,
        startDate: e.createdAt,
        status: e.status === 'live' ? 'active' : 'upcoming'
      })),
      revenue: { 
        total: orgPayments.reduce((sum, p) => sum + p.amount, 0),
        prints: orgPayments.reduce((sum, p) => sum + p.printCount, 0),
        transactions: orgPayments.length 
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organization details' });
  }
});

router.post('/organizations/:id/suspend', requireOwner, async (req, res) => {
  try {
    const { reason } = req.body;
    const org = await Organization.findByIdAndUpdate(req.params.id, { status: 'suspended' }, { new: true });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    await logAction(req, 'platform.org.suspended', 'organization', `Suspended organization: ${org.name}. Reason: ${reason}`, 'warn');
    res.json({ id: org._id, status: org.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to suspend organization' });
  }
});

router.post('/organizations/:id/ban', requireOwner, async (req, res) => {
  try {
    const { reason } = req.body;
    const org = await Organization.findByIdAndUpdate(req.params.id, { status: 'banned' }, { new: true });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    await logAction(req, 'platform.org.banned', 'organization', `Banned organization: ${org.name}. Reason: ${reason}`, 'danger');
    res.json({ id: org._id, status: org.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to ban organization' });
  }
});

router.post('/organizations/:id/restore', requireOwner, async (req, res) => {
  try {
    const org = await Organization.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    await logAction(req, 'platform.org.restored', 'organization', `Restored organization: ${org.name}`);
    res.json({ id: org._id, status: org.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore organization' });
  }
});

// ─── PLANS ─────────────────────────────────────────────────────────────────

router.get('/plans', requireOwner, async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ price: 1 });
    res.json({
      plans: plans.map(p => ({
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
        organizations: 0 // placeholder
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

router.post('/plans', requireOwner, async (req, res) => {
  try {
    const plan = new SubscriptionPlan(req.body);
    await plan.save();
    res.status(201).json({ plan: { id: plan._id, ...plan.toObject() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

router.put('/plans/:id', requireOwner, async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ plan: { id: plan._id, ...plan.toObject() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// ─── TEMPLATES ─────────────────────────────────────────────────────────────

router.get('/templates', async (req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 });
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
        usage: 0, // placeholder
        createdAt: t.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const template = new Template({ ...req.body, source: 'playground', createdBy: req.user._id });
    await template.save();
    res.status(201).json({ template: { id: template._id, ...template.toObject() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.put('/templates/:id', async (req, res) => {
  try {
    const template = await Template.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ template: { id: template._id, ...template.toObject() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    await Template.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// ─── USERS ─────────────────────────────────────────────────────────────────

router.get('/users', async (req, res) => {
  try {
    const usersList = await User.find({ organizationId: null }).select('-password -forgotPasswordCodeHash');
    res.json({
      users: usersList.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        createdAt: u.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const user = new User({ name, email, role, password: password, organizationId: null, status: 'active' });
    await user.save();
    await logAction(req, 'platform.user.created', 'user', `Created internal user: ${email} (${role})`);
    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or inactive' });
    }
    if (user.role === 'OWNER' && status === 'inactive') {
      return res.status(403).json({ error: 'The Owner account cannot be deactivated' });
    }
    
    user.status = status;
    await user.save();
    res.json({ id: user._id, status: user.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ─── SUPPORT ───────────────────────────────────────────────────────────────

router.get('/support', async (req, res) => {
  try {
    const reqs = await PlatformSupportRequest.find().sort({ createdAt: -1 }).populate('organizationId createdBy');
    res.json({
      requests: reqs.map(r => ({
        id: r._id,
        ticketNo: r.ticketNo || ('T-' + r._id.toString().substring(0, 4).toUpperCase()),
        organizationId: r.organizationId?._id,
        organizationName: r.organizationId?.name || 'Organization',
        subject: r.subject,
        category: r.category || 'technical',
        priority: r.priority || 'medium',
        status: r.status,
        messages: r.messages || [],
        reapplyCount: r.reapplyCount || 0,
        decision: r.decision,
        resolution: r.resolution,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch support requests' });
  }
});

router.get('/support/:id', async (req, res) => {
  try {
    const r = await PlatformSupportRequest.findById(req.params.id).populate('organizationId createdBy');
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json({
      request: {
        id: r._id,
        ticketNo: r.ticketNo || ('T-' + r._id.toString().substring(0, 4).toUpperCase()),
        organizationId: r.organizationId?._id,
        organizationName: r.organizationId?.name || 'Organization',
        subject: r.subject,
        category: r.category || 'technical',
        priority: r.priority || 'medium',
        status: r.status,
        messages: r.messages || [],
        reapplyCount: r.reapplyCount || 0,
        decision: r.decision,
        resolution: r.resolution,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

router.post('/support/:id/accept', async (req, res) => {
  try {
    const { message } = req.body;
    const r = await PlatformSupportRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: 'open',
        decision: { type: 'accepted', at: new Date(), by: req.user._id, reason: message || 'Accepted' },
        acceptedAt: new Date()
      },
      { new: true }
    ).populate('organizationId createdBy');
    res.json({
      request: {
        id: r._id,
        ticketNo: r.ticketNo || ('T-' + r._id.toString().substring(0, 4).toUpperCase()),
        organizationId: r.organizationId?._id,
        organizationName: r.organizationId?.name || 'Organization',
        status: r.status,
        messages: r.messages || [],
        decision: r.decision,
        ...r.toObject()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

router.post('/support/:id/deny', async (req, res) => {
  try {
    const { reason } = req.body;
    const r = await PlatformSupportRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: 'denied',
        decision: { type: 'denied', reason: reason || 'Not eligible', at: new Date(), by: req.user._id }
      },
      { new: true }
    ).populate('organizationId createdBy');
    res.json({
      request: {
        id: r._id,
        ticketNo: r.ticketNo || ('T-' + r._id.toString().substring(0, 4).toUpperCase()),
        organizationId: r.organizationId?._id,
        organizationName: r.organizationId?.name || 'Organization',
        status: r.status,
        decision: r.decision,
        ...r.toObject()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deny request' });
  }
});

router.post('/support/:id/reply', async (req, res) => {
  try {
    const { message, text, images } = req.body;
    const r = await PlatformSupportRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: 'in_progress',
        $push: {
          messages: {
            authorId: req.user._id,
            authorName: req.user.name,
            authorRole: req.user.role,
            side: 'platform',
            text: message || text || '',
            images: images || [],
            at: new Date()
          }
        }
      },
      { new: true }
    ).populate('organizationId createdBy');
    res.json({
      request: {
        id: r._id,
        ticketNo: r.ticketNo || ('T-' + r._id.toString().substring(0, 4).toUpperCase()),
        organizationId: r.organizationId?._id,
        organizationName: r.organizationId?.name || 'Organization',
        status: r.status,
        messages: r.messages || [],
        ...r.toObject()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reply' });
  }
});

router.post('/support/:id/resolve', async (req, res) => {
  try {
    const { resolution } = req.body;
    const r = await PlatformSupportRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: 'resolved',
        resolution: resolution || 'Resolved by HappyPix platform team',
        resolvedAt: new Date()
      },
      { new: true }
    ).populate('organizationId createdBy');
    res.json({
      request: {
        id: r._id,
        ticketNo: r.ticketNo || ('T-' + r._id.toString().substring(0, 4).toUpperCase()),
        organizationId: r.organizationId?._id,
        organizationName: r.organizationId?.name || 'Organization',
        status: r.status,
        resolution: r.resolution,
        ...r.toObject()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve support ticket' });
  }
});

router.post('/support/:id/reopen', async (req, res) => {
  try {
    const r = await PlatformSupportRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'open' },
      { new: true }
    ).populate('organizationId createdBy');
    res.json({
      request: {
        id: r._id,
        ticketNo: r.ticketNo || ('T-' + r._id.toString().substring(0, 4).toUpperCase()),
        organizationId: r.organizationId?._id,
        organizationName: r.organizationId?.name || 'Organization',
        status: r.status,
        ...r.toObject()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reopen support ticket' });
  }
});

// ─── GALLERY SETTINGS ────────────────────────────────────────────────────────

router.get('/gallery-settings', async (req, res) => {
  try {
    let s = await Setting.findOne({ organizationId: null });
    if (!s) {
      s = new Setting({ organizationId: null, galleryEnabled: true, requireGuestConsent: false });
      await s.save();
    }
    res.json({
      galleryEnabled: s.galleryEnabled !== false,
      requireGuestConsent: !!s.requireGuestConsent
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gallery settings' });
  }
});

router.put('/gallery-settings', async (req, res) => {
  try {
    const { galleryEnabled, requireGuestConsent } = req.body;
    let s = await Setting.findOneAndUpdate(
      { organizationId: null },
      {
        galleryEnabled: galleryEnabled !== undefined ? galleryEnabled : true,
        requireGuestConsent: galleryEnabled === false ? false : (requireGuestConsent !== undefined ? requireGuestConsent : false)
      },
      { new: true, upsert: true }
    );
    res.json({
      settings: {
        galleryEnabled: s.galleryEnabled !== false,
        requireGuestConsent: !!s.requireGuestConsent
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update gallery settings' });
  }
});

// ─── AUDIT LOGS ────────────────────────────────────────────────────────────

router.get('/audit', async (req, res) => {
  try {
    const logs = await AuditLog.find({ action: { $ne: 'booth.heartbeat' } })
      .sort({ at: -1 })
      .limit(100)
      .populate('actorId', 'name role');
    const internalUsers = await User.find({ organizationId: null }).select('name role');
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
      })),
      actors: internalUsers.map(u => ({ id: u._id, name: u.name, role: u.role }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
