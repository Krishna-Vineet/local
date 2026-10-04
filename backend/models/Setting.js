import mongoose from 'mongoose';

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

  // ─── Mobile Printing ──────────────────────────────────────────
  enableMobilePrinting:   { type: Boolean, default: true },

  // ─── Payment Settings ─────────────────────────────────────────
  razorpayKeyId:          { type: String, default: '' },
  razorpayKeySecret:      { type: String, default: '' },
  upiId:                  { type: String, default: '' },
  upiName:                { type: String, default: '' },
  upiQrImageUrl:          { type: String, default: '' },

  updatedAt: { type: Date, default: Date.now },
});

// Unique per org (one settings doc per org)
settingSchema.index({ organizationId: 1 }, { unique: true, sparse: true });

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;
