import mongoose from 'mongoose';

// Wallet withdrawal requested by an organization admin.
// status: processing → paid | failed (settled manually by HappyPix ops).
const withdrawalSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 1 },
    upiId: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['processing', 'paid', 'failed'],
      default: 'processing',
    },
    reference: { type: String, required: true, unique: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date, default: Date.now },
    paidAt: { type: Date, default: null },
    settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: null },
  },
  { timestamps: true }
);

withdrawalSchema.index({ organizationId: 1, requestedAt: -1 });

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
export default Withdrawal;
