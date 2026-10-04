import express from 'express';
import Coupon from '../models/Coupon.js';
import { authenticate, authorize, getOrgFilter } from '../middleware/auth.js';
import { optionalDeviceAuth } from '../middleware/deviceAuth.js';
import { logAudit } from '../utils/auditLogger.js';

const router = express.Router();

// POST /api/coupons/public/validate — Validate coupon (org-scoped by device token)
router.post('/public/validate', optionalDeviceAuth, async (req, res) => {
  try {
    const { code, eventId } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code required' });

    // Allow Global coupons (organizationId: null) to be found alongside org coupons
    const orgFilter = req.organizationId 
      ? { $or: [{ organizationId: req.organizationId }, { organizationId: null }] } 
      : {};
      
    const coupon = await Coupon.findOne({ ...orgFilter, code: code.toUpperCase(), isActive: true });
    if (!coupon) return res.status(404).json({ error: 'Invalid or inactive coupon' });

    // Enforce Event-Specific scope
    if (coupon.eventId && String(coupon.eventId) !== String(eventId)) {
      return res.status(400).json({ error: 'This coupon is not valid for the current event' });
    }

    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate).setHours(23, 59, 59, 999)) {
      return res.status(400).json({ error: 'Coupon has expired' });
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ error: 'Coupon usage limit reached' });
    }

    res.json({ 
      valid: true, 
      coupon: { code: coupon.code, discountType: coupon.discountType, value: coupon.value } 
    });
  } catch (error) {
    console.error('❌ Validate coupon error:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// Removed old admin CRM protected endpoints

export default router;
