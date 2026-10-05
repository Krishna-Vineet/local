import express from 'express';
import rateLimit from 'express-rate-limit';
import SupportTicket from '../models/SupportTicket.js';
import { optionalDeviceAuth } from '../middleware/deviceAuth.js';

const router = express.Router();

// Public ticket submission — throttled to prevent spam runs.
const ticketRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many tickets submitted. Please try again later.' }
});

// CRM v2 uses 'medium'; the legacy SupportTicket schema uses 'normal'.
const PRIORITY_MAP = {
  low: 'low',
  medium: 'normal',
  normal: 'normal',
  high: 'high',
  urgent: 'urgent',
};

// ─────────────────────────────────────────────────────────────
// PUBLIC: Submit an end-user ticket (from booth app)
// POST /api/support
// Uses optional device auth to auto-assign organizationId.
// The organization is derived from the device token only —
// client-supplied organization ids are ignored.
// ─────────────────────────────────────────────────────────────
router.post('/', ticketRateLimiter, optionalDeviceAuth, async (req, res) => {
  try {
    const {
      name, email, subject, message, priority,
      eventShortCode, eventId, deviceId,
      sessionId, paymentReference,
      ticketType,  // 'end_user' (default) | 'client' (from admin panel contact form)
    } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'name, email, subject, and message are required.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    const ticket = new SupportTicket({
      ticketType:       ticketType === 'client' ? 'client' : 'end_user',
      name:             String(name).trim().slice(0, 120),
      email:            String(email).trim().toLowerCase(),
      subject:          String(subject).trim().slice(0, 200),
      message:          String(message).trim().slice(0, 4000),
      priority:         PRIORITY_MAP[priority] || 'normal',
      organizationId:   req.organizationId || null,
      eventShortCode:   eventShortCode?.trim() || null,
      eventId:          eventId || null,
      deviceId:         deviceId || null,
      sessionId:        sessionId || null,
      paymentReference: paymentReference || null,
      holdPhotos:       !!sessionId, // hold S3 deletion if session photos are involved
    });

    await ticket.save();

    res.status(201).json({
      message: 'Support ticket submitted successfully.',
      ticketId: ticket._id,
    });
  } catch (err) {
    console.error('❌ Support ticket creation error:', err.message);
    res.status(500).json({ error: 'Failed to submit support ticket.' });
  }
});

// Admin-side handling of these tickets lives in the CRM v2 namespace:
//   /api/org/tickets        (org inbox, merged with booth guest tickets)
//   /api/platform/support   (platform support center)

export default router;
