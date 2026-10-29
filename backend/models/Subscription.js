import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    // The plan key (e.g. 'pro', 'premium') referencing SubscriptionPlan.key
    plan: { type: String, required: true },
    amount: { type: Number, required: true },
    // Discount snapshot at purchase time (plan discounts change over time,
    // invoices must not). `amount` above stays the amount actually charged.
    originalAmount: { type: Number, default: null },
    discountAmount: { type: Number, default: 0 },
    discountType: { type: String, enum: ['none', 'percent', 'flat'], default: 'none' },
    discountValue: { type: Number, default: 0 },
    discountLabel: { type: String, default: '' },
    
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
    invoiceNo: { type: String, required: true, unique: true },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    status: {
      type: String,
      enum: ['paid', 'pending', 'failed'],
      default: 'paid',
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

subscriptionSchema.index({ organizationId: 1, createdAt: -1 });
subscriptionSchema.index({ status: 1, endDate: 1 });
subscriptionSchema.index({ createdAt: -1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
