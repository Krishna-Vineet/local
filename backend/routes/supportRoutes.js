import express from 'express';
import SupportTicket from '../models/SupportTicket.js';
import { authenticate, getOrgFilter } from '../middleware/auth.js';
import { optionalDeviceAuth } from '../middleware/deviceAuth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// PUBLIC: Submit an end-user ticket (from booth app)
// POST /api/support
// Uses optional device auth to auto-assign organizationId
// ticketType defaults to 'end_user' — routed to client_admin
// ─────────────────────────────────────────────────────────────
router.post('/', optionalDeviceAuth, async (req, res) => {
  try {
    const {
      name, email, subject, message,
      eventShortCode, eventId, deviceId,
      sessionId, paymentReference,
      ticketType,  // 'end_user' (default) | 'client' (from admin panel contact form)
    } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'name, email, subject, and message are required.' });
    }

    const ticket = new SupportTicket({
      ticketType:       ticketType || 'end_user',
      name:             name.trim(),
      email:            email.trim().toLowerCase(),
      subject:          subject.trim(),
      message:          message.trim(),
      organizationId:   req.organizationId || req.body.organizationId || null, // auto-assign from device token or request body
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
    console.error('❌ Support ticket creation error:', err);
    res.status(500).json({ error: 'Failed to submit support ticket.' });
  }
});

// Removed old admin CRM protected endpoints

export default router;
