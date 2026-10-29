import mongoose from 'mongoose';
import crypto from 'crypto';
import { hashDeviceToken } from '../utils/crypto.js';

const deviceSchema = new mongoose.Schema(
  {
    // ─── Ownership ────────────────────────────────────────────
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },

    // ─── Identity ─────────────────────────────────────────────
    deviceUuid:      { type: String, required: true, unique: true, index: true }, // Persistent installation UUID
    deviceName:      { type: String, required: true, trim: true }, // "Booth-01"
    location:        { type: String, trim: true, default: '' },    // "Crown Ballroom"
    // Legacy plaintext column — kept ONLY so pre-hashing rows can be found
    // once and migrated. New writes never persist a raw token (see pre-save):
    // only its SHA-256 hash is stored, so a database leak exposes no live
    // booth credentials. The raw token is returned to the booth exactly
    // once, at pairing time.
    deviceToken:     { type: String, default: null, index: true },
    deviceTokenHash: { type: String, index: true, default: null }, // SHA-256 hash for secure DB storage

    // ─── Operator ─────────────────────────────────────────────
    // On-ground booth worker (not a CRM user)
    operatorName:  { type: String, trim: true, default: null },
    operatorPhone: { type: String, trim: true, default: null },

    // ─── Current Event Assignment ─────────────────────────────
    assignedEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },

    // ─── Real-time Tracking ───────────────────────────────────
    lastSeenAt: { type: Date, default: null },
    ipAddress:  { type: String, default: null },
    userAgent:  { type: String, default: null },
    platform:   { type: String, default: null },
    appVersion: { type: String, default: null },

    // ─── Hardware Telemetry ───────────────────────────────────
    telemetry: {
      prints: { type: Number, default: 0 },
      shutters: { type: Number, default: 0 },
      batteryPct: { type: Number, default: 100 },
      updatedAt: { type: Date, default: null }
    },

    // ─── Peripheral Connections ───────────────────────────────
    connections: {
      camera: { type: Boolean, default: false },
      printer: { type: Boolean, default: false },
      kioskScreen: { type: Boolean, default: false },
      updatedAt: { type: Date, default: null }
    },

    // ─── Status ───────────────────────────────────────────────
    status: {
      type: String,
      enum: ['active', 'inactive', 'blocked'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────
deviceSchema.index({ organizationId: 1, status: 1 });
deviceSchema.index({ lastSeenAt: -1 });

// ─── Virtual: Online Status ───────────────────────────────────
deviceSchema.virtual('online').get(function () {
  if (!this.lastSeenAt) return false;
  return (Date.now() - new Date(this.lastSeenAt).getTime()) < (5 * 60000); // 5 mins
});

deviceSchema.set('toJSON',   { virtuals: true });
deviceSchema.set('toObject', { virtuals: true });

// ─── Pre-save: hash the raw token, then erase the plaintext ─────
// Callers assign `deviceToken = Device.generateToken()` and keep the raw
// value in a local variable to return it once; after save, only the hash
// exists anywhere in the database.
deviceSchema.pre('save', function () {
  if (this.isModified('deviceToken') && typeof this.deviceToken === 'string' && this.deviceToken.startsWith('hp_dev_')) {
    this.deviceTokenHash = hashDeviceToken(this.deviceToken);
    this.deviceToken = undefined;
  }
});

// ─── Static: Generate unique device token ────────────────────
deviceSchema.statics.generateToken = function () {
  return `hp_dev_${crypto.randomUUID()}`;
};

// ─── Static: Find device by raw token (hash lookup; legacy rows migrate) ──
deviceSchema.statics.findByToken = async function (rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const tokenHash = hashDeviceToken(rawToken);
  const byHash = await this.findOne({ deviceTokenHash: tokenHash });
  if (byHash) return byHash;
  // Legacy row still holding a plaintext token or double-hashed token:
  // accept it once, then migrate it to hash-only storage.
  const doubleHash = hashDeviceToken(tokenHash);
  const legacy = await this.findOne({
    $or: [
      { deviceToken: rawToken },
      { deviceToken: tokenHash },
      { deviceTokenHash: doubleHash },
    ],
  });
  if (legacy) {
    legacy.deviceTokenHash = tokenHash;
    legacy.deviceToken = undefined;
    await this.updateOne(
      { _id: legacy._id },
      { $set: { deviceTokenHash: tokenHash }, $unset: { deviceToken: 1 } },
    ).catch(() => {});
    return legacy;
  }
  return null;
};

const Device = mongoose.model('Device', deviceSchema);
export default Device;
