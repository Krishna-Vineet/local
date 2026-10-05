import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, required: true },
  authorRole: { type: String, required: true },
  side: { type: String, enum: ['org', 'platform'], required: true },
  at: { type: Date, default: Date.now },
  text: { type: String, required: true },
  images: [{ type: String }], // URLs or data:image
}, { _id: true });

const platformSupportRequestSchema = new mongoose.Schema(
  {
    ticketNo: { type: String, default: null, unique: true, sparse: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    subject: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['technical', 'billing', 'account', 'feature', 'other'],
      default: 'other',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['new', 'denied', 'open', 'in_progress', 'resolved'],
      default: 'new',
    },
    
    decision: {
      type: { type: String, enum: ['accepted', 'denied'], default: null },
      reason: { type: String, default: null },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      at: { type: Date, default: null }
    },
    
    messages: [messageSchema],
    
    // History of accept/deny decisions (kept when a denied request is re-applied)
    decisionHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
    
    reapplyCount: { type: Number, default: 0 },
    lastReapplication: {
      text: { type: String, default: null },
      images: [{ type: String }],
      authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      at: { type: Date, default: null }
    },
    
    resolution: { type: String, default: null },
    
    acceptedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

platformSupportRequestSchema.index({ status: 1, createdAt: -1 });
platformSupportRequestSchema.index({ organizationId: 1, status: 1 });

const PlatformSupportRequest = mongoose.model('PlatformSupportRequest', platformSupportRequestSchema);
export default PlatformSupportRequest;
