import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    // Scoped to specific events. Empty array = applies to all org events
    eventIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
    }],
    status: {
      type: String,
      enum: ['active', 'paused'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Compound unique index so codes are unique per organization
couponSchema.index({ organizationId: 1, code: 1 }, { unique: true });

couponSchema.virtual('isExhausted').get(function () {
  return this.usedCount >= this.quantity;
});
couponSchema.virtual('isExpired').get(function () {
  return new Date() > this.expiryDate;
});

couponSchema.set('toJSON', { virtuals: true });
couponSchema.set('toObject', { virtuals: true });

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
