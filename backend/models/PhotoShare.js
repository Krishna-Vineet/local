import mongoose from 'mongoose';

const photoShareSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // We store the actual S3 URLs or references
  photoUrls: {
    type: [String],
    default: [],
  },
  compositeUrl: {
    type: String,
    default: null,
  },
  // References to the Photo collection
  photoIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Photo'
  }],
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'disabled'],
    default: 'active',
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  downloadCount: {
    type: Number,
    default: 0,
  },
  shareCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

const PhotoShare = mongoose.model('PhotoShare', photoShareSchema);
export default PhotoShare;
