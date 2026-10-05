import express from 'express';
import Coupon from '../models/Coupon.js';
import { optionalDeviceAuth } from '../middleware/deviceAuth.js';

const router = express.Router();

// POST /api/coupons/public/validate — Validate coupon (org-scoped by device token)
// Uses the real Coupon schema: status / quantity / usedCount / eventIds.
router.post('/public/validate', optionalDeviceAuth, async (req, res) => {
  try {
    const { code, eventId, amount } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code required' });

    if (!req.organizationId) {
      return res.status(401).json({ error: 'Device token required to validate coupons' });
    }

    const coupon = await Coupon.findOne({
      organizationId: req.organizationId,
      code: String(code).toUpperCase(),
      status: 'active',
    });
    if (!coupon) return res.status(404).json({ error: 'Invalid or inactive coupon' });

    // Enforce event-specific scope
    const eventIds = (coupon.eventIds || []).map(String);
    if (eventIds.length && eventId && !eventIds.includes(String(eventId))) {
      return res.status(400).json({ error: 'This coupon is not valid for the current event' });
    }

    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate).setHours(23, 59, 59, 999)) {
      return res.status(400).json({ error: 'Coupon has expired' });
    }

    if (coupon.usedCount >= coupon.quantity) {
      return res.status(400).json({ error: 'Coupon usage limit reached' });
    }

    // Server-side discount so the booth cannot invent a value
    const gross = Number(amount) || 0;
    let discount = 0;
    if (gross > 0) {
      discount = coupon.type === 'percentage'
        ? Math.round(gross * (coupon.value / 100))
        : Math.min(Math.round(coupon.value), gross);
    }

    res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount,
        finalAmount: gross > 0 ? Math.max(0, gross - discount) : null,
      }
    });
  } catch (error) {
    console.error('❌ Validate coupon error:', error.message);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// Coupon CRUD lives in the CRM v2 namespace: /api/org/coupons
export default router;
