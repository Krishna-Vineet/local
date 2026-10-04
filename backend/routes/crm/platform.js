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
import crypto from 'crypto';

const router = express.Router();

// All routes here require a platform role (OWNER, PLATFORM_ADMIN, SUPPORT_MANAGER)
router.use(requirePlatformRole);

// Helper for Audit Logs
const logAction = async (actorId, action, entity, summary, severity = 'info') => {
  await AuditLog.create({ actorId, action, entity, summary, severity });
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
      
      return {
        id: o._id,
        name: o.name,
        ownerName: ownerUser.name || 'Unknown',
        email: ownerUser.email || 'N/A',
        planName: o.plan || 'Free',
        planStatus: o.status,
        planExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        planDaysLeft: 30,
        onlineDevices: onlineDevCount,
        devices: devCount,
        activeEvents: activeEvCount,
        createdAt: o.createdAt,
        lastActiveAt: new Date().toISOString(),
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

    const planData = {
      planName: o.plan || 'Free',
      status: o.status,
      startDate: o.createdAt,
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      deviceLimit: 5,
      eventLimit: 2,
      daysLeft: 30
    };

    res.json({
      id: o._id,
      name: o.name,
      planName: o.plan || 'Free',
      suspendReason: null,
      status: o.status,
      ownerName: ownerUser.name || 'Unknown',
      email: ownerUser.email || 'N/A',
      phone: 'N/A',
      country: 'IN',
      createdAt: o.createdAt,
      lastActiveAt: new Date().toISOString(),
      plan: planData,
      subscription: null,
      devices: orgDevices.map(d => ({
        id: d._id,
        online: d.status === 'active',
        deviceName: d.deviceName || d.macAddress,
        location: 'Unknown',
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
    await logAction(req.user._id, 'platform.org.suspended', 'organization', `Suspended organization: ${org.name}. Reason: ${reason}`, 'warn');
    res.json({ id: org._id, status: org.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to suspend organization' });
  }
});

router.post('/organizations/:id/ban', requireOwner, async (req, res) => {
  try {
    const { reason } = req.body;
    const org = await Organization.findByIdAndUpdate(req.params.id, { status: 'banned' }, { new: true });
    await logAction(req.user._id, 'platform.org.banned', 'organization', `Banned organization: ${org.name}. Reason: ${reason}`, 'danger');
    res.json({ id: org._id, status: org.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to ban organization' });
  }
});

router.post('/organizations/:id/restore', requireOwner, async (req, res) => {
  try {
    const org = await Organization.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
    await logAction(req.user._id, 'platform.org.restored', 'organization', `Restored organization: ${org.name}`);
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

router.get('/users', requireOwner, async (req, res) => {
  try {
    const usersList = await User.find({ organizationId: null }).select('-password -forgotPasswordCodeHash');
    res.json({
      users: usersList.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        lastLoginAt: new Date().toISOString() // placeholder if not tracked
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', requireOwner, async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    // Real password hash will be handled by pre-save hook in User model
    const user = new User({ name, email, role, password: password, organizationId: null, status: 'active' });
    await user.save();
    await logAction(req.user._id, 'platform.user.created', 'user', `Created internal user: ${email} (${role})`);
    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/users/:id', requireOwner, async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'OWNER') return res.status(403).json({ error: 'Cannot modify owner' });
    
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
    const tickets = await PlatformSupportRequest.find().sort({ createdAt: -1 }).populate('organizationId', 'name');
    res.json({
      items: tickets.map(t => ({
        id: t._id,
        organization: { name: t.organizationId ? t.organizationId.name : 'Unknown' },
        status: t.status,
        subject: t.subject,
        priority: t.priority || 'medium',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch support requests' });
  }
});

router.get('/support/:id', async (req, res) => {
  try {
    const t = await PlatformSupportRequest.findById(req.params.id).populate('organizationId', 'name');
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json({
      id: t._id,
      organization: { id: t.organizationId?._id, name: t.organizationId?.name },
      status: t.status,
      subject: t.subject,
      description: t.description || t.messages?.[0]?.text,
      priority: t.priority || 'medium',
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      messages: t.messages || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

router.post('/support/:id/reply', async (req, res) => {
  try {
    const r = await PlatformSupportRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: 'open',
        $push: {
          messages: {
            authorId: req.user._id,
            authorName: req.user.name,
            authorRole: req.user.role,
            side: 'platform',
            text: req.body.message || req.body.text,
            at: new Date()
          }
        }
      },
      { new: true }
    );
    res.json({ id: r._id, status: r.status, messages: r.messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reply' });
  }
});

// ─── GALLERY SETTINGS ────────────────────────────────────────────────────────

router.get('/gallery-settings', async (req, res) => {
  // Placeholder for global platform gallery settings
  res.json({ galleryEnabled: true, requireGuestConsent: false });
});

router.put('/gallery-settings', async (req, res) => {
  // Save settings (placeholder)
  res.json({ settings: { ...req.body } });
});

// ─── AUDIT LOGS ────────────────────────────────────────────────────────────

router.get('/audit', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).populate('actorId', 'name role');
    res.json({
      items: logs.map(l => ({
        id: l._id,
        action: l.action,
        entity: l.entity,
        actorName: l.actorId ? l.actorId.name : 'System',
        actorRole: l.actorId ? l.actorId.role : 'SYSTEM',
        summary: l.summary,
        severity: l.severity || 'info',
        at: l.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
