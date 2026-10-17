// Public coupon validation for booth / client apps.
//
// Issue #41/#42/#43/#115: this route used to query fields that do not exist
// (`isActive`, `discountType`, `maxUses`, `eventId`) so every validation
// failed. It now uses the shared coupon vocabulary and the shared discount
// math, and it honours event scoping + usage limits + expiry.

import express from 'express';
import rateLimit from 'express-rate-limit';
import Coupon from '../models/Coupon.js';
import { optionalDeviceAuth } from '../middleware/deviceAuth.js';
import { applyCoupon, couponView } from '../services/couponService.js';

const router = express.Router();

const couponLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Brute-force protection for coupon codes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many coupon validation attempts. Please try again later.' },
});

// POST /api/coupons/public/validate — Validate coupon (org-scoped by device token)
router.post('/public/validate', couponLimiter, optionalDeviceAuth, async (req, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    const eventId = req.body.eventId || null;
    const gross = Number(req.body.gross ?? req.body.amount ?? 0);
    if (!code) return res.status(400).json({ error: 'Coupon code required.', code: 'BAD_REQUEST' });

    // Organization coupon first, then a platform-wide coupon (organizationId: null).
    // If no org is associated, only platform-wide coupons can be queried (never cross-tenant).
    const query = req.organizationId
      ? { organizationId: { $in: [req.organizationId, null] }, code }
      : { organizationId: null, code };
    const coupon = await Coupon.findOne(query);

    const result = applyCoupon(coupon, { gross, eventId });
    if (!result.ok) {
      return res.status(400).json({ error: result.message, code: 'COUPON_INVALID', valid: false });
    }
    res.json({
      valid: true,
      discount: result.discount,
      message: result.message,
      coupon: {
        ...couponView(coupon),
        // explicit aliases so every client reads the same names (issue #43)
        code: result.coupon.code,
        discountType: result.coupon.discountType,
        value: result.coupon.discountValue,
      },
    });
  } catch (error) {
    console.error('❌ Validate coupon error:', error);
    res.status(500).json({ error: 'Failed to validate coupon', code: 'INTERNAL' });
  }
});

export default router;
