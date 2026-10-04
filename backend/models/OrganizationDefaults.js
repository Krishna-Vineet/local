import mongoose from 'mongoose';

const organizationDefaultsSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    
    // Baseline identity
    name: { type: String, default: '' },
    logoUrl: { type: String, default: null },
    
    // Booth Config
    boothTimeoutSec: { type: Number, default: 60, min: 10, max: 86400 },
    
    // Payout Settings
    upiId: { type: String, default: null }, // e.g. "business@upi"
    payoutMode: {
      type: String,
      enum: ['upi', 'wallet'],
      default: 'wallet',
    },
    
    // Layout Prices Map: { "familyId:slots": price }
    // Overlays the server-suggested default map
    layoutPrices: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

const OrganizationDefaults = mongoose.model('OrganizationDefaults', organizationDefaultsSchema);
export default OrganizationDefaults;
