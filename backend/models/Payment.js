import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  // ─── Multi-tenant: which client this payment belongs to ───
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true,
  },
  razorpayOrderId: { type: String, default: null },
  paymentLinkId: { type: String, default: null },
  paymentLinkUrl: { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  razorpaySignature: { type: String, default: null },
  // Which gateway processed this payment: 'razorpay' | 'cashfree'
  gateway: { type: String, enum: ['razorpay', 'cashfree'], default: 'razorpay' },
  // Cashfree-specific fields
  cashfreeOrderId: { type: String, default: null },
  cashfreePaymentId: { type: String, default: null },
  cashfreeQrData: { type: String, default: null }, // raw UPI QR string for cashfree
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  eventName: { type: String, default: null },
  // Booth attribution + where the money went (issues #46, #48, #105)
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null, index: true },
  sessionId: { type: String, default: null, index: true },
  guestPhone: { type: String, default: null },
  settlement: { type: String, enum: ['upi', 'wallet'], default: 'wallet' },
  amount: { type: Number, required: true },       // in rupees (e.g. 200)
  currency: { type: String, default: 'INR' },
  printCount: { type: Number, required: true },
  digitalCopy: { type: Boolean, default: false },
  photoUrls: { type: [String], default: [] }, // Selected S3 photo URLs for digital copy
  compositeUrl: { type: String, default: null }, // URL of the finalized photo strip composite
  couponCode: { type: String, default: null },
  couponCounted: { type: Boolean, default: false }, // coupon usage recorded once per payment
  discountApplied: { type: Number, default: 0 },  // discount in rupees
  status: {
    type: String,
    // 'created' is the legacy name for 'pending' — both are reported as
    // "pending" by the API so CRM, booth and mock agree (issue #114).
    enum: ['created', 'pending', 'paid', 'failed'],
    default: 'pending',
  },
  utr: { type: String, default: null, index: true },
  createdAt: { type: Date, default: Date.now },
  paidAt: { type: Date, default: null },
});

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
