import express from 'express';
import mongoose from 'mongoose';
import Setting from '../models/Setting.js';
import OrganizationDefaults from '../models/OrganizationDefaults.js';
import { getGallerySettings } from '../services/gallerySettingsService.js';
import { buildSettings } from '../services/boothSnapshotService.js';
import Event from '../models/Event.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { optionalDeviceAuth } from '../middleware/deviceAuth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const settingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many settings requests. Please try again shortly.' },
});

// ─── Helper: get or create settings for an org ───────────────────────────────
const getOrCreateSettings = async (organizationId) => {
  // 1. Try org-specific settings first
  if (organizationId) {
    let setting = await Setting.findOne({ organizationId });
    if (!setting) {
      // First time — create default settings for this org
      setting = await Setting.create({ organizationId });
    }
    return setting;
  }
  // 2. Fall back to legacy global singleton (null organizationId)
  let setting = await Setting.findOne({ organizationId: null });
  if (!setting) {
    setting = await Setting.create({ organizationId: null });
  }
  return setting;
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Booth app fetches settings on startup
// GET /api/settings/public
//
// If x-device-token is present → returns org-specific settings
// If no token → returns global defaults (backward compat)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/public', settingsLimiter, optionalDeviceAuth, async (req, res) => {
  try {
    let orgId = req.organizationId;
    if (!orgId && req.query.eventId && mongoose.Types.ObjectId.isValid(req.query.eventId)) {
      const event = await Event.findById(req.query.eventId);
      if (event && event.organizationId) {
        orgId = event.organizationId;
      }
    }
    const setting = await getOrCreateSettings(orgId || null);
    const settingObj = setting.toObject();

    // Never leak decrypted gateway secrets to public/booth callers
    settingObj.razorpayKeySecret = settingObj.razorpayKeySecret ? '********' : '';
    settingObj.cashfreeSecretKey = settingObj.cashfreeSecretKey ? '********' : '';

    // Issues #69–#71: booth-relevant configuration comes from the organization's
    // defaults (timeout, payout mode, UPI, print limits, layout prices) — not
    // from hard-coded platform values. Gallery policy is included too (#18).
    const organization = orgId ? await Organization.findById(orgId).lean() : null;
    const defaults = orgId ? await OrganizationDefaults.findOne({ organizationId: orgId }).lean() : null;
    const gallery = await getGallerySettings();
    res.json({
      ...settingObj,
      booth: buildSettings({ organization: organization || {}, defaults, event: null }),
      gallery,
      organizationId: orgId ? String(orgId) : null,
      organizationName: organization ? organization.name : null,
    });
  } catch (error) {
    console.error('❌ Fetch public settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Removed old admin CRM protected endpoints

export default router;
