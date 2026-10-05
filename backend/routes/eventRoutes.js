import express from 'express';
import Event from '../models/Event.js';
import { optionalDeviceAuth } from '../middleware/deviceAuth.js';
import '../models/Template.js';

const router = express.Router();

// ── Auto-Status Sync Helper ─────────────────────────────────
// Lazily updates the denormalized Event.status field based on dates.
// CRM v2 computes status on read, so events created there still carry
// `status: 'upcoming'` in the DB — this keeps the legacy booth
// endpoints (public/live, public/list, devices/current-event) in sync
// for serverless environments where setInterval cannot be relied on.
export async function syncEventStatuses() {
  try {
    const now = new Date();
    await Event.updateMany(
      { status: 'upcoming', paused: { $ne: true }, startDate: { $lte: now }, endDate: { $gt: now } },
      { $set: { status: 'live' } }
    );
    await Event.updateMany(
      { status: { $ne: 'finished' }, endDate: { $lte: now } },
      { $set: { status: 'finished' } }
    );
  } catch (err) {
    console.error('❌ Auto-sync status error:', err.message);
  }
}

// GET /api/events/public/live — Public route for photobooth client to fetch active event (Legacy)
// When a device token is supplied the response is scoped to that org.
router.get('/public/live', optionalDeviceAuth, async (req, res) => {
  try {
    await syncEventStatuses();
    const orgFilter = req.organizationId ? { organizationId: req.organizationId } : {};
    const event = await Event.findOne({ ...orgFilter, status: 'live' })
      .sort({ startDate: -1 })
      .populate('templateIds');
    if (!event) return res.status(404).json({ error: 'No live event found' });
    res.json(event);
  } catch (error) {
    console.error('❌ Fetch live event error:', error.message);
    res.status(500).json({ error: 'Failed to fetch live event' });
  }
});

// GET /api/events/public/list — Fetch live/upcoming events for Join Screen
router.get('/public/list', optionalDeviceAuth, async (req, res) => {
  try {
    await syncEventStatuses();
    const orgFilter = req.organizationId ? { organizationId: req.organizationId } : {};
    const events = await Event.find({ ...orgFilter, status: { $in: ['live', 'upcoming'] } })
      .select('name clientName location startDate status shortCode')
      .sort({ startDate: 1 });
    res.json(events);
  } catch (error) {
    console.error('❌ Fetch public events list error:', error.message);
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
    // Events without a configured passkey cannot be joined this way —
    // otherwise an empty-string passkey would match the default ''.
    if (!event.passkey) {
      return res.status(403).json({ error: 'This event does not use booth passkeys' });
    }
    if (event.passkey !== passkey) {
      return res.status(401).json({ error: 'Invalid passkey' });
    }
    const eventObj = event.toObject();
    // Never leak credentials to the booth client
    delete eventObj.razorpayKeySecret;
    delete eventObj.razorpayKeyId;
    delete eventObj.passkey;
    // Mongoose Map -> plain object for JSON serialization
    if (event.templatePrices instanceof Map) {
      eventObj.templatePrices = Object.fromEntries(event.templatePrices);
    }
    res.json(eventObj);
  } catch (error) {
    console.error('❌ Join event error:', error.message);
    res.status(500).json({ error: 'Failed to join event' });
  }
});

// Admin-side event management lives in the CRM v2 namespace (/api/org/events)

export default router;
