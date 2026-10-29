import mongoose from 'mongoose';

// ============================================================
// GuestDownload — the digital copy of ONE booth session's output.
//
// Created by the booth when a session completes (POST /api/booth/
// sessions/complete in the main backend) and read by the public
// HappyPix display website at  GET <website>/download/:downloadId
// (served by website-backend, SAME MongoDB database).
//
// The link is valid for 24 hours only: `expiresAt` carries a Mongo
// TTL index so the document deletes itself, and every reader must
// also check `expiresAt > now` (TTL sweeps are not instantaneous).
// ============================================================

export const GUEST_DOWNLOAD_TTL_MS = 24 * 60 * 60 * 1000;

const guestDownloadSchema = new mongoose.Schema({
  // Unguessable public id used in the /download/:id URL + QR code.
  downloadId: { type: String, required: true, unique: true, index: true },

  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },
  sessionId: { type: String, default: null, index: true },
  payloadFingerprint: { type: String, default: null },

  // Final booth output: the composite (print-ready strip/page) first,
  // plus the individual frames that went into it.
  compositeUrl: { type: String, default: null },
  photoUrls: { type: [String], default: [] },
  photoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Photo' }],

  eventName: { type: String, default: '' },
  organizationName: { type: String, default: '' },

  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // MongoDB TTL — auto-delete at expiry
  },
  viewCount: { type: Number, default: 0 },
  downloadCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const GuestDownload = mongoose.model('GuestDownload', guestDownloadSchema);
export default GuestDownload;
