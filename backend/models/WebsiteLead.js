import mongoose from 'mongoose';

const websiteLeadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, default: '', trim: true },
    company: { type: String, default: '', trim: true },
    message: { type: String, default: '' },
    type: {
      type: String,
      enum: ['contact', 'demo', 'hardware', 'support'],
      default: 'contact',
      index: true,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'closed'],
      default: 'new',
      index: true,
    },
    notes: { type: String, default: '' },
    contactedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'websiteleads' },
);

export default mongoose.models.WebsiteLead || mongoose.model('WebsiteLead', websiteLeadSchema);