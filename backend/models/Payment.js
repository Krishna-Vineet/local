import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  // ─── Multi-tenant: which client this payment belongs to ───
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true,
  },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null, index: true },
  // Where the money ends up: 'wallet' (HappyPix wallet, withdrawable)
  // or 'upi' (owed direct to the organization's UPI).
  settlement: {
    type: String,
    enum: ['upi', 'wallet'],
    default: 'wallet',
  },
  razorpayOrderId: { type: String, required: true, unique: true },
  paymentLinkId: { type: String, default: null },
  paymentLinkUrl: { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  razorpaySignature: { type: String, default: null },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  eventName: { type: String, default: null },
  amount: { type: Number, required: true },       // in rupees (e.g. 200)
  currency: { type: String, default: 'INR' },
  printCount: { type: Number, required: true },
  digitalCopy: { type: Boolean, default: false },
  photoUrls: { type: [String], default: [] }, // Selected S3 photo URLs for digital copy
  compositeUrl: { type: String, default: null }, // URL of the finalized photo strip composite
  couponCode: { type: String, default: null },
  discountApplied: { type: Number, default: 0 },  // discount in rupees
  status: {
    type: String,
    enum: ['created', 'paid', 'failed'],
    default: 'created',
  },
  utr: { type: String, default: null, index: true },
  createdAt: { type: Date, default: Date.now },
  paidAt: { type: Date, default: null },
});

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
