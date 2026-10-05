import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import PhotoShare from '../models/PhotoShare.js';
import DeliveryRecord from '../models/DeliveryRecord.js';
import Event from '../models/Event.js';
import DeliveryService from '../services/DeliveryService.js';
import { authenticateDevice } from '../middleware/deviceAuth.js';
import { safeMediaUrl } from '../lib/helpers.js';

const router = express.Router();

// Rate limiting for public endpoints
const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

const deliveryRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // limit each IP to 15 delivery attempts per hour
  message: { error: 'Delivery rate limit exceeded. Try again later.' }
});

// ─────────────────────────────────────────────────────────────
// POST /api/share/generate (Internal / Booth App — device auth)
// Generates a PhotoShare token. The organization is taken from
// the authenticated device; client-supplied org ids are ignored.
// ─────────────────────────────────────────────────────────────
router.post('/generate', authenticateDevice, async (req, res) => {
  try {
    const { eventId, photoUrls, compositeUrl } = req.body;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: 'Valid eventId is required' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event.organizationId && String(event.organizationId) !== String(req.organizationId)) {
      return res.status(403).json({ error: 'This event belongs to another organization.' });
    }

    const organizationId = req.organizationId || event.organizationId;

    // Calculate expiration
    const expirationDays = event.sharingConfig?.expirationDays || 7;
    const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

    // Cryptographically secure token (the raw token is the URL secret and
    // is stored as-is so /share/:token lookups stay O(1) on the unique index)
    const rawToken = crypto.randomBytes(32).toString('hex');

    const photoShare = new PhotoShare({
      eventId,
      organizationId,
      tokenHash: rawToken,
      photoUrls: (photoUrls || []).map((u) => safeMediaUrl(u)).filter(Boolean),
      compositeUrl: safeMediaUrl(compositeUrl),
      expiresAt,
      status: 'active'
    });

    await photoShare.save();

    const clientUrl = process.env.CLIENT_URL || 'https://happypix.vercel.app';

    res.status(201).json({
      success: true,
      token: rawToken,
      expiresAt,
      shareUrl: `${clientUrl.replace(/\/$/, '')}/share/${rawToken}`
    });
  } catch (err) {
    console.error('Error generating photo share:', err.message);
    res.status(500).json({ error: 'Failed to generate share token' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/share/:token (Internal / Booth App — device auth)
// Updates an existing PhotoShare with uploaded URLs
// ─────────────────────────────────────────────────────────────
router.put('/:token', authenticateDevice, async (req, res) => {
  try {
    const { token } = req.params;
    const { photoUrls, compositeUrl } = req.body;

    const photoShare = await PhotoShare.findOne({ tokenHash: token });
    if (!photoShare) {
      return res.status(404).json({ error: 'Photo share not found' });
    }
    if (photoShare.organizationId && String(photoShare.organizationId) !== String(req.organizationId)) {
      return res.status(403).json({ error: 'This share belongs to another organization.' });
    }

    if (Array.isArray(photoUrls)) photoShare.photoUrls = photoUrls.map((u) => safeMediaUrl(u)).filter(Boolean);
    const safeComposite = safeMediaUrl(compositeUrl);
    if (safeComposite) photoShare.compositeUrl = safeComposite;

    await photoShare.save();
    res.json({ success: true, photoShare });
  } catch (err) {
    console.error('Error updating photo share:', err.message);
    res.status(500).json({ error: 'Failed to update share token' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/share/view/:token (Public - Mobile View Page)
// Validates token and returns photos (Tenant Isolated - no sensitive data)
// ─────────────────────────────────────────────────────────────
router.get('/view/:token', publicRateLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const photoShare = await PhotoShare.findOne({ tokenHash: token, status: 'active' }).populate('eventId', 'name branding sharingConfig');
    
    if (!photoShare) {
      return res.status(404).json({ error: 'This photo link is invalid or has been disabled.' });
    }

    if (new Date() > photoShare.expiresAt) {
      return res.status(410).json({ error: 'This photo link has expired.' });
    }

    // Track view
    photoShare.viewCount += 1;
    await photoShare.save();

    res.json({
      success: true,
      photoUrls: photoShare.photoUrls,
      compositeUrl: photoShare.compositeUrl,
      expiresAt: photoShare.expiresAt,
      event: {
        name: photoShare.eventId?.name,
        branding: photoShare.eventId?.branding,
        sharingConfig: photoShare.eventId?.sharingConfig
      }
    });
  } catch (err) {
    console.error('Error viewing photo share:', err);
    res.status(500).json({ error: 'Failed to retrieve photo.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/share/deliver/:token (Public - Triggers delivery or tracks shares)
// ─────────────────────────────────────────────────────────────
router.post('/deliver/:token', deliveryRateLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const { method, destination } = req.body; // method: WHATSAPP, EMAIL, SMS, QR, DOWNLOAD, NATIVE_SHARE, COPY_LINK

    if (!method) {
      return res.status(400).json({ error: 'Delivery method is required' });
    }

    const photoShare = await PhotoShare.findOne({ tokenHash: token, status: 'active' }).populate('eventId');
    
    if (!photoShare || new Date() > photoShare.expiresAt) {
      return res.status(404).json({ error: 'This photo link is invalid or expired.' });
    }

    // Validate if event allows this sharing method
    const config = photoShare.eventId?.sharingConfig || {};
    if (config.enabled === false) {
      return res.status(403).json({ error: 'Sharing is disabled for this event.' });
    }

    // Process Delivery using the service (Adapter Pattern)
    const result = await DeliveryService.processDelivery({
      method,
      destination,
      photoShare,
      eventId: photoShare.eventId._id,
      organizationId: photoShare.organizationId
    });

    // Update PhotoShare counts
    if (method === 'DOWNLOAD') {
      photoShare.downloadCount += 1;
    } else {
      photoShare.shareCount += 1;
    }
    await photoShare.save();

    res.json({
      success: result.success,
      message: 'Delivery processed'
    });
  } catch (err) {
    console.error('Error processing delivery:', err);
    res.status(500).json({ error: err.message || 'Failed to process delivery.' });
  }
});

export default router;
