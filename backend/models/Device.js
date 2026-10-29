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
    // Tokens are HASH-ONLY, and deliberately not a schema path.
    //
    // The plaintext `deviceToken` column used to live here. Pairing assigned a
    // raw token, a `pre('save')` hook hashed it and set the path to `undefined`,
    // and every device write therefore carried a path that was declared on the
    // schema and then intentionally left empty. The moment that path was (or
    // is, in a deployment that has not picked up the change) marked
    // `required: true`, every device write failed with
    //
    //   Device validation failed: deviceToken: Path `deviceToken` is required.
    //
    // — a 500 on assign, on pairing, on session completion. Removing the path
    // is the structural fix: there is nothing left for Mongoose to validate, so
    // no schema version, no stale build and no future edit can reintroduce it.
    //
    // Legacy rows that still hold a plaintext token are read through the raw
    // driver (`Device.collection`), which skips casting and validation, and are
    // migrated on first use or by `scripts/heal-device-tokens.js`.
    deviceTokenHash: { type: String, index: true, default: null }, // SHA-256 of the raw token; the raw value only ever leaves the server once, at pairing

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

// ─── Static: mint a token pair ───────────────────────────────
// The raw token is handed to the booth exactly once (at pairing) and never
// persisted; only `hash` is written. Callers must store the hash, not the raw
// value — there is no schema path for the raw value any more.
deviceSchema.statics.createToken = function () {
  const raw = `hp_dev_${crypto.randomUUID()}`;
  return { raw, hash: hashDeviceToken(raw) };
};

/** Back-compat: the raw half of `createToken()`. Prefer `createToken()`. */
deviceSchema.statics.generateToken = function () {
  return this.createToken().raw;
};

/** SHA-256 of a raw token, for callers that already hold one. */
deviceSchema.statics.hashToken = function (rawToken) {
  return hashDeviceToken(rawToken);
};

// ─── Static: Find device by raw token (hash lookup; legacy rows migrate) ──
deviceSchema.statics.findByToken = async function (rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const tokenHash = hashDeviceToken(rawToken);
  if (!tokenHash) return null;

  const byHash = await this.findOne({ deviceTokenHash: tokenHash });
  if (byHash) return byHash;

  // Pre-hashing rows. `deviceToken` is no longer a schema path, so this has to
  // go through the raw driver — a Mongoose query would silently strip an
  // unknown field from the filter and match every document.
  //
  // Two shapes exist in the wild:
  //   · the raw token                    → hash it
  //   · the token's SHA-256 (older code)  → store it as the hash
  const storedHash = /^[a-f0-9]{64}$/i.test(rawToken) ? rawToken : tokenHash;
  let legacyRow = null;
  for (const candidate of new Set([rawToken, tokenHash])) {
    legacyRow = await this.collection.findOne({ deviceToken: candidate }).catch(() => null);
    if (legacyRow) break;
  }
  if (!legacyRow) {
    // A row whose hash was written by the older double-hash path.
    legacyRow = await this.collection
      .findOne({ deviceTokenHash: hashDeviceToken(tokenHash) })
      .catch(() => null);
    if (legacyRow) {
      await this.collection
        .updateOne({ _id: legacyRow._id }, { $set: { deviceTokenHash: tokenHash } })
        .catch(() => {});
      return this.findById(legacyRow._id);
    }
    return null;
  }

  await this.collection
    .updateOne(
      { _id: legacyRow._id },
      { $set: { deviceTokenHash: storedHash }, $unset: { deviceToken: '' } },
    )
    .catch(() => {});
  return this.findById(legacyRow._id);
};

const Device = mongoose.model('Device', deviceSchema);
export default Device;
