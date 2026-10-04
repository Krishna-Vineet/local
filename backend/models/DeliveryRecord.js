import mongoose from 'mongoose';

const deliveryRecordSchema = new mongoose.Schema({
  photoShareId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PhotoShare',
    required: true,
    index: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  method: {
    type: String,
    enum: ['QR', 'DOWNLOAD', 'WHATSAPP', 'EMAIL', 'SMS', 'NATIVE_SHARE', 'COPY_LINK'],
    required: true,
  },
  destinationMasked: {
    type: String, // e.g., '+1***555', 'j***@gmail.com'
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
  },
  provider: {
    type: String,
    default: null,
  },
  providerMessageId: {
    type: String,
    default: null,
  },
  errorCode: {
    type: String,
    default: null,
  },
  sentAt: {
    type: Date,
    default: null,
  },
  failedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

const DeliveryRecord = mongoose.model('DeliveryRecord', deliveryRecordSchema);
export default DeliveryRecord;
