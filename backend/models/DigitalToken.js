import mongoose from 'mongoose';

const digitalTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null,
  },
  photoUrls: {
    type: [String],
    required: true,
  },
  compositeUrl: {
    type: String,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // MongoDB TTL — auto-deletes doc when expiresAt is reached
  },
  downloadCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const DigitalToken = mongoose.model('DigitalToken', digitalTokenSchema);
export default DigitalToken;
