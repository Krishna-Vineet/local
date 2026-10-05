import mongoose from 'mongoose';

// Photo — a capture or final composite produced at a booth.
//
// Raw captures and composites are both stored; `compositeUrl` marks the
// finalized print (what the org Gallery shows as the "final image").
// guestConsent gates whether the composite may appear in the org gallery
// (platform policy "requireGuestConsent").
const photoSchema = new mongoose.Schema({
  // ─── Multi-tenant ─────────────────────────────────
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true,
  },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', index: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null, index: true },
  sessionId: { type: String, default: null, index: true },

  s3Key:   { type: String, required: true },
  url:     { type: String, required: true },
  // Final print composite (rendered strip) — null for raw captures.
  compositeUrl: { type: String, default: null },

  // Gallery policy
  guestConsent: { type: Boolean, default: false },

  capturedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

photoSchema.index({ organizationId: 1, capturedAt: -1 });

const Photo = mongoose.model('Photo', photoSchema);
export default Photo;
