import mongoose from 'mongoose';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';

/**
 * Setting — per-organization booth configuration.
 *
 * Each org has ONE settings document. If none exists, the public endpoint
 * returns safe defaults. The booth device fetches these via x-device-token
 * (optionalDeviceAuth) so each org's booth gets its own price/timeout.
 *
 * Historical global singleton rows (organizationId = null) are kept as a
 * fallback — the public endpoint checks org first, then falls back to global.
 */
const settingSchema = new mongoose.Schema({
  // ─── Multi-tenant: which org these settings belong to ────────
  // null = legacy global singleton (fallback only)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
  },

  // ─── Mobile Printing & Gallery ────────────────────────────────
  enableMobilePrinting:   { type: Boolean, default: true },
  galleryEnabled:         { type: Boolean, default: true },
  requireGuestConsent:    { type: Boolean, default: false },
  galleryUpdatedAt:      { type: Date, default: null },
  galleryUpdatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // ─── Payment Settings ─────────────────────────────────────────
  // Razorpay
  razorpayKeyId:          { type: String, default: '' },
  razorpayKeySecret:      { type: String, default: '', set: encryptSecret, get: decryptSecret },
  // Cashfree
  cashfreeAppId:          { type: String, default: '' },
  cashfreeSecretKey:      { type: String, default: '', set: encryptSecret, get: decryptSecret },
  cashfreeEnv:            { type: String, enum: ['sandbox', 'production'], default: 'production' },
  // Which gateway to try first: 'razorpay' | 'cashfree'
  // If primary fails, the other is tried automatically.
  gatewayPriority:        { type: String, enum: ['razorpay', 'cashfree'], default: 'razorpay' },
  upiId:                  { type: String, default: '' },
  upiName:                { type: String, default: '' },
  upiQrImageUrl:          { type: String, default: '' },

  updatedAt: { type: Date, default: Date.now },
});

settingSchema.set('toJSON', { getters: true });
settingSchema.set('toObject', { getters: true });

// Unique per org (one settings doc per org)
settingSchema.index({ organizationId: 1 }, { unique: true, sparse: true });

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;
