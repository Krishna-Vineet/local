import express from 'express';
import mongoose from 'mongoose';
import Setting from '../models/Setting.js';
import Event from '../models/Event.js';
import { optionalDeviceAuth } from '../middleware/deviceAuth.js';

const router = express.Router();

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
router.get('/public', optionalDeviceAuth, async (req, res) => {
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
    if (settingObj.razorpayKeySecret) {
      settingObj.razorpayKeySecret = '********';
    } else {
      settingObj.razorpayKeySecret = '';
    }
    res.json(settingObj);
  } catch (error) {
    console.error('❌ Fetch public settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Removed old admin CRM protected endpoints

export default router;
