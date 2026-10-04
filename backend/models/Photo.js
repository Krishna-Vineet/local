import mongoose from 'mongoose';

const photoSchema = new mongoose.Schema({
  // ─── Multi-tenant ─────────────────────────────────
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true,
  },
  s3Key:   { type: String, required: true },
  url:     { type: String, required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete record after 24H
});

const Photo = mongoose.model('Photo', photoSchema);
export default Photo;
