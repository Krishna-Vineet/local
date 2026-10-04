import express from 'express';
import Event from '../models/Event.js';
import Photo from '../models/Photo.js';
import User from '../models/User.js';
import Device from '../models/Device.js';
import Payment from '../models/Payment.js';
import Organization, { PLAN_DEVICE_LIMITS } from '../models/Organization.js';
import { authenticate, authorize, getOrgFilter } from '../middleware/auth.js';
import { optionalDeviceAuth } from '../middleware/deviceAuth.js';
import { logAudit } from '../utils/auditLogger.js';
import '../models/Template.js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

let s3ClientInstance = null;
const getS3Client = () => {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3ClientInstance;
};

const router = express.Router();

// ── Plan-level max devices PER EVENT ─────────────────────────────
// These limits cap how many devices can be assigned to a single event
// (separate from PLAN_DEVICE_LIMITS which caps total devices for the org)
const PLAN_EVENT_DEVICE_LIMITS = {
  starter:      1,
  professional: 2,
  business:     5,
  enterprise:   -1, // unlimited
};

// ── Helper: sync Device.currentEventId after event device list changes ──
// Sets currentEventId for newly assigned devices, clears it for removed ones
async function syncDeviceAssignments(newDeviceIds, previousDeviceIds, eventId, eventName) {
  const newSet  = new Set(newDeviceIds.map(String));
  const prevSet = new Set((previousDeviceIds || []).map(String));

  // Devices added → assign event
  const added   = [...newSet].filter(id => !prevSet.has(id));
  // Devices removed → clear event
  const removed = [...prevSet].filter(id => !newSet.has(id));

  const ops = [];
  if (added.length) {
    ops.push(Device.updateMany(
      { _id: { $in: added } },
      { $set: { currentEventId: eventId, currentEventName: eventName } }
    ));
  }
  if (removed.length) {
    ops.push(Device.updateMany(
      { _id: { $in: removed } },
      { $set: { currentEventId: null, currentEventName: null } }
    ));
  }
  await Promise.all(ops);
}

// GET /api/events/public/live — Public route for photobooth client to fetch active event (Legacy)
router.get('/public/live', async (req, res) => {
  try {
    const event = await Event.findOne({ status: 'live' })
      .sort({ startDate: -1 })
      .populate('templateIds');
    if (!event) return res.status(404).json({ error: 'No live event found' });
    res.json(event);
  } catch (error) {
    console.error('❌ Fetch live event error:', error);
    res.status(500).json({ error: 'Failed to fetch live event' });
  }
});

// GET /api/events/public/list — Fetch live/upcoming events for Join Screen
router.get('/public/list', optionalDeviceAuth, async (req, res) => {
  try {
    const orgFilter = req.organizationId ? { organizationId: req.organizationId } : {};
    const events = await Event.find({ ...orgFilter, status: { $in: ['live', 'upcoming'] } })
      .select('name clientName location startDate status shortCode')
      .sort({ startDate: 1 });
    res.json(events);
  } catch (error) {
    console.error('❌ Fetch public events list error:', error);
    res.status(500).json({ error: 'Failed to fetch public events list' });
  }
});

// POST /api/events/public/join — Verify passkey and return event details
router.post('/public/join', async (req, res) => {
  try {
    const { eventId, passkey } = req.body;
    if (!eventId || !passkey) {
      return res.status(400).json({ error: 'Event ID and passkey are required' });
    }
    const event = await Event.findById(eventId).populate('templateIds');
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.passkey !== passkey) {
      return res.status(401).json({ error: 'Invalid passkey' });
    }
    const eventObj = event.toObject();
    // Mongoose Map -> plain object for JSON serialization
    if (event.templatePrices instanceof Map) {
      eventObj.templatePrices = Object.fromEntries(event.templatePrices);
    }
    res.json(eventObj);
  } catch (error) {
    console.error('❌ Join event error:', error);
    res.status(500).json({ error: 'Failed to join event' });
  }
});

// All other event routes require authentication
router.use(authenticate);

// ── Auto-Status Sync Helper ─────────────────────────────────
// Lazily updates event statuses based on current date since 
// serverless environments cannot rely on setInterval.
export async function syncEventStatuses() {
  try {
    const now = new Date();
    await Event.updateMany(
      { status: 'upcoming', startDate: { $lte: now }, endDate: { $gt: now } },
      { $set: { status: 'live' } }
    );
    await Event.updateMany(
      { status: { $ne: 'finished' }, endDate: { $lte: now } },
      { $set: { status: 'finished' } }
    );
  } catch (err) {
    console.error('❌ Auto-sync status error:', err);
  }
}

// Removed old admin CRM protected endpoints

export default router;
