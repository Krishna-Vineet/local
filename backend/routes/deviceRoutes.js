import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import Device from '../models/Device.js';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import { authenticate, authorize, getOrgFilter } from '../middleware/auth.js';
import { authenticateDevice } from '../middleware/deviceAuth.js';
import { assertDeviceLimit } from '../services/planService.js';
import { mergeHardware, BOOTH_STATES } from '../services/boothSnapshotService.js';
import { logAudit } from '../utils/auditLogger.js';
import '../models/Template.js';
import { syncEventStatuses } from './eventRoutes.js';

const router = express.Router();

const boothLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booth login attempts. Please try again in 15 minutes.' },
});

// ─────────────────────────────────────────────────────────────
// PUBLIC: Booth Device Login (credential-based registration)
// POST /api/devices/booth-login
//
// New flow: When a device first starts, it shows a "Client Login"
// screen. Client enters their org credentials → device gets linked.
// Token is stored in the booth app's local storage (persistent).
//
// Body: { orgId, password }
// Response: { deviceToken, deviceId, deviceName, currentEventId }
// ─────────────────────────────────────────────────────────────
router.post('/booth-login', boothLoginLimiter, async (req, res) => {
  try {
    const { orgId, password, deviceName, location } = req.body;

    if (!orgId || !password) {
      return res.status(400).json({ error: 'orgId and password are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({ error: 'Invalid Organization ID format' });
    }

    // Find the org admin for this org
    const admin = await User.findOne({
      organizationId: orgId,
      role: { $in: ['ORG_ADMIN', 'ORG_MANAGER'] },
    });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check org status (issues #1/#2): banned blocks, suspended locks booths.
    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found', code: 'ORG_MISSING' });
    if (org.status === 'banned') {
      return res.status(403).json({ error: 'This organization has been banned. Contact HappyPix support.', code: BOOTH_STATES.BANNED });
    }
    if (org.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Contact HappyPix support.', code: BOOTH_STATES.SUSPENDED });
    }

    // Issue #5/#55: device limits come from the assigned subscription plan.
    const currentCount = await Device.countDocuments({ organizationId: orgId, status: { $ne: 'blocked' } });
    try {
      await assertDeviceLimit(org, currentCount);
    } catch (limitError) {
      return res.status(limitError.status || 409).json({ error: limitError.message, code: limitError.code || 'PLAN_LIMIT_REACHED' });
    }

    // Create device with generated token
    const deviceToken = Device.generateToken();
    const device = new Device({
      organizationId: orgId,
      deviceUuid:     req.body.deviceUuid || `PC-Booth-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      deviceName:     deviceName || `Booth-${Date.now()}`,
      location:       location || '',
      deviceToken,
      status:         'active',
    });
    await device.save();

    res.status(201).json({
      message:       'Device registered successfully.',
      deviceToken,   // store this in booth app localStorage — sent on every request
      deviceId:      device._id,
      deviceUuid:    device.deviceUuid || device.deviceId || `device-${Date.now()}`,
      deviceName:    device.deviceName,
      currentEventId: device.assignedEventId || null,
      // Show "No Event Assigned" screen if assignedEventId is null
    });
  } catch (err) {
    console.error('❌ Booth login error:', err);
    res.status(500).json({ error: 'Device registration failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUBLIC: Heartbeat Ping (called every 30s by booth app)
// POST /api/devices/ping
// Header: x-device-token: hp_dev_xxx...
// Also returns currentEventId so booth can detect event changes
// ─────────────────────────────────────────────────────────────
router.post('/ping', authenticateDevice, async (req, res) => {
  try {
    const device = req.device;

    device.lastSeenAt = new Date();
    device.ipAddress  = req.ip || req.headers['x-forwarded-for'] || null;
    device.userAgent  = req.headers['user-agent'] || null;
    
    // Issues #76–#78: booths send only the fields that changed. Any subset is
    // accepted and merged; nothing is overwritten with stale zeros.
    const patch = req.body.hardwarePatch || req.body.hardware || {};
    const flat = {
      printsTotal: patch.printsTotal ?? req.body.telemetry?.prints,
      shutterCount: patch.shutterCount ?? req.body.telemetry?.shutters,
      batteryPct: patch.batteryPct ?? req.body.telemetry?.batteryPct,
      cameraConnected: patch.cameraConnected ?? req.body.connections?.camera,
      printerConnected: patch.printerConnected ?? req.body.connections?.printer,
      kioskScreenConnected: patch.kioskScreenConnected ?? req.body.connections?.kioskScreen,
    };
    const merged = mergeHardware(device, flat);
    device.telemetry = merged.telemetry;
    device.connections = merged.connections;

    await device.save();

    res.json({
      ok:             true,
      deviceName:     device.deviceName,
      organizationId: device.organizationId,
      status:         device.status,
      currentEventId: device.assignedEventId || null,
      currentEventName: device.currentEventName || null,
      needsMaintenance: device.needsMaintenance || false,
    });
  } catch (err) {
    console.error('❌ Device ping error:', err);
    res.status(500).json({ error: 'Ping failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUBLIC: Get current event for this device (polled every 30s)
// GET /api/devices/current-event
// Header: x-device-token: hp_dev_xxx...
// Returns event details if assigned, null if not
router.get('/current-event', authenticateDevice, async (req, res) => {
  await syncEventStatuses();
  try {
    const device = req.device;
    const currentEventIdStr = device.assignedEventId ? device.assignedEventId.toString() : null;
    if (!currentEventIdStr || currentEventIdStr === 'null' || !mongoose.Types.ObjectId.isValid(currentEventIdStr)) {
      return res.json({ event: null, deviceId: device._id, deviceName: device.deviceName });
    }

    const Event = (await import('../models/Event.js')).default;
    const { populateAllTemplates } = await import('./boothRoutes.js');
    const rawEvent = await Event.findById(device.assignedEventId).lean();
    const event = await populateAllTemplates(rawEvent);

    res.json({
      event,
      deviceId:   device._id,
      deviceName: device.deviceName,
    });
  } catch (err) {
    console.error('❌ Current event error:', err);
    res.status(500).json({ error: 'Failed to fetch current event' });
  }
});

// Removed old admin CRM protected endpoints

export default router;
