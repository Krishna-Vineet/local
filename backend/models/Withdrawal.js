import mongoose from 'mongoose';

/**
 * Withdrawal — organization payout requests out of the HappyPix wallet.
 * Wallet revenue is settled to the organization's UPI id (issue #48).
 */
const withdrawalSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['processing', 'paid', 'failed'],
      default: 'processing',
    },
    upiId: { type: String, default: null },   // destination at request time
    reference: { type: String, default: null },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null },
    note: { type: String, default: null },
  },
  { timestamps: true },
);

withdrawalSchema.index({ organizationId: 1, status: 1 });

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
export default Withdrawal;
