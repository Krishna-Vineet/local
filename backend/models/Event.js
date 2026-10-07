import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  name: { type: String, required: true },
  clientName: { type: String, default: '' },
  location: { type: String, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  
  // Status can be derived or set explicitly
  status: { type: String, enum: ['upcoming', 'live', 'finished'], default: 'upcoming' },
  paused: { type: Boolean, default: false },

  // New CRM Features (v2)
  templateIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Template' }],
  filters: [{ type: String }],
  digitalCopy: { type: Boolean, default: true },
  
  // Pricing Snapshot: { "familyId:slots": price }
  layoutPrices: { type: mongoose.Schema.Types.Mixed, default: {} },
  
  branding: {
    logoUrl: { type: String, default: null },
    tagline: { type: String, default: '' },
    logos: [{ type: String }] // Up to 15 logos
  },
  shortCode: { type: String },

  // Booth device pairings
  assignedDeviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }],

  // ─── Legacy/Booth Backward Compat Fields ───
  // These remain so the older booth app queries do not crash
  passkey: { type: String, default: '' },
  printPrice: { type: Number, default: null },
  allowedTemplates: [{ type: mongoose.Schema.Types.Mixed }],
  allowedFilters: [{ type: String }],
  printOptions: { type: [Number], default: [1, 2] },
  downloadEnabled: { type: Boolean, default: true },
  printingEnabled: { type: Boolean, default: true },
  boothTimeout: { type: Number, default: 30 },
  razorpayKeyId: { type: String, default: '' },
  razorpayKeySecret: { type: String, default: '' },
  upiId: { type: String, default: '' },
  qrCodeUrl: { type: String, default: '' },
  gridPrices: { type: mongoose.Schema.Types.Mixed, default: {} },
  formatPrices: { type: mongoose.Schema.Types.Mixed, default: {} },
  templatePrices: { type: Map, of: Number, default: {} },
  selectedScreens: { type: [String], default: ['capture', 'filter', 'preview', 'payment', 'print'] },
  sharingConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  selectedFrameUrls: [{ type: String }],
  enabledLayouts: { type: [String], default: [] },
  organizerName: { type: String, default: '' },
  allowPrint: { type: Boolean, default: true },
  assignedManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

eventSchema.index({ shortCode: 1 }, { unique: true, sparse: true });

const Event = mongoose.model('Event', eventSchema);
export default Event;
