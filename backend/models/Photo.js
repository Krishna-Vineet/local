import mongoose from 'mongoose';

const photoSchema = new mongoose.Schema({
  // ─── Multi-tenant ─────────────────────────────────
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true,
  },
  s3Key:   { type: String, default: '' },
  url:     { type: String, required: true },
  // Final composited print image (strip/page). This field was written by
  // POST /api/upload and read by the org gallery for a long time but was
  // NOT declared here, so Mongoose strict mode silently dropped it and
  // the gallery fell back to raw frames — one of the gallery bugs.
  compositeUrl: { type: String, default: null },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  // Gallery flow (issues #18, #61): which booth produced it, when it was
  // finalised, and whether the guest allowed social-media publishing.
  deviceId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null, index: true },
  sessionId:     { type: String, default: null },
  payloadFingerprint: { type: String, default: null, index: true },
  guestConsent:  { type: Boolean, default: false },
  generatedAt:   { type: Date, default: Date.now },
  finalised:     { type: Boolean, default: false },
  printStatus:   { type: String, default: 'printed' },
  digitalStatus: { type: String, default: 'delivered' },
  // ⚠️ NO TTL here. This field previously carried `expires: 86400`, so Mongo
  // deleted every Photo document 24h after the booth session and the org
  // gallery silently emptied itself ("can't see images from booth").
  // The 24-hour limit belongs to the *guest download link* only
  // (models/GuestDownload.js), never to the organization's gallery record.
  // Existing deployments must also drop the old TTL index once:
  //   node scripts/drop-photo-ttl-index.js
  createdAt: { type: Date, default: Date.now, index: true },
});

const Photo = mongoose.model('Photo', photoSchema);
export default Photo;
