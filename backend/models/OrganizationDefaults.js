import mongoose from 'mongoose';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';

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
    qrTimeoutMinutes: { type: Number, default: 5, min: 1, max: 30 },
    
    // Payout Settings
    upiId: { type: String, default: null }, // e.g. "business@upi"
    payoutMode: {
      type: String,
      enum: ['upi', 'wallet'],
      default: 'wallet',
    },
    paymentDisplayName: { type: String, default: null },

    // Payment Gateway Configuration
    razorpayKeyId:     { type: String, default: '' },
    razorpayKeySecret: { type: String, default: '', set: encryptSecret, get: decryptSecret },
    razorpayEnv:       { type: String, enum: ['sandbox', 'production'], default: 'production' },
    cashfreeAppId:     { type: String, default: '' },
    cashfreeSecretKey: { type: String, default: '', set: encryptSecret, get: decryptSecret },
    cashfreeEnv:       { type: String, enum: ['sandbox', 'production'], default: 'production' },
    gatewayPriority:   { type: String, enum: ['razorpay', 'cashfree'], default: 'razorpay' },
    
    // Layout Prices Map: { "familyId:slots": price }
    // Overlays the server-suggested default map
    layoutPrices: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Per-Template Custom Prices: { "<templateId>": price }
    templatePrices: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } }
);

const OrganizationDefaults = mongoose.model('OrganizationDefaults', organizationDefaultsSchema);
export default OrganizationDefaults;
