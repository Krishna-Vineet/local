import mongoose from 'mongoose';
import crypto from 'crypto';

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
    deviceUuid:  { type: String, required: true, unique: true, index: true }, // Persistent installation UUID
    deviceName:  { type: String, required: true, trim: true }, // "Booth-01"
    location:    { type: String, trim: true, default: '' },    // "Crown Ballroom"
    deviceToken: { type: String, required: true, unique: true, index: true }, // Opaque, revocable token

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

// ─── Static: Generate unique device token ────────────────────
deviceSchema.statics.generateToken = function () {
  return `hp_dev_${crypto.randomUUID()}`;
};

const Device = mongoose.model('Device', deviceSchema);
export default Device;
