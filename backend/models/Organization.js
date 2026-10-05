import mongoose from 'mongoose';

// Plan limits map — enforced at device creation
export const PLAN_DEVICE_LIMITS = {
  starter:      1,
  professional: 3,
  business:     10,
  enterprise:   -1, // -1 = unlimited
};

// Monthly pricing (stored for reference; billing is automated via payment gateway)
export const PLAN_PRICING = {
  starter:      { AUD: 49,   INR: 2499  },
  professional: { AUD: 99,   INR: 4999  },
  business:     { AUD: 199,  INR: 9999  },
  enterprise:   { AUD: null, INR: null  }, // custom
};

const organizationSchema = new mongoose.Schema(
  {
    // ─── Basic Info ───────────────────────────────────────────
    name:      { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone:     { type: String, trim: true, default: '' },
    country:   { type: String, default: 'IN' }, // ISO country code: IN, AU, etc.

    // ─── Plan & Billing ───────────────────────────────────────
    plan: {
      type: String,
      enum: ['trial', 'starter', 'basic', 'professional', 'business', 'custom', 'enterprise'],
      default: 'trial',
    },
    currency: {
      type: String,
      enum: ['AUD', 'INR'],
      default: 'INR',
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'annual'],
      default: 'monthly',
    },
    planStartedAt:  { type: Date, default: null },
    planExpiresAt:  { type: Date, default: null },
    nextBillingDate:{ type: Date, default: null },

    // ─── Payment Gateway ─────────────────────────────────────
    // Auto-selected based on currency: INR → razorpay, AUD → stripe
    paymentGateway: {
      type: String,
      enum: ['razorpay', 'stripe'],
      default: 'razorpay',
    },

    // ─── Status ───────────────────────────────────────────────
    status: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active',
    },
    suspendReason: { type: String, default: null },
    suspendedAt:   { type: Date, default: null },
    suspendedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    trialEndsAt: { type: Date, default: null },
    trialExtensionCount: { type: Number, default: 0 },
    trialExtendedUntil: { type: Date, default: null },

    // ─── Device Limits ────────────────────────────────────────
    allowedDevices: { type: Number, default: 1 }, // synced from plan on create/update



    // ─── Super Admin Notes ────────────────────────────────────
    internalNotes: { type: String, default: '' },

    // ─── Metadata ─────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────
organizationSchema.index({ status: 1 });
organizationSchema.index({ plan: 1 });

// ─── Virtual: is plan active? ─────────────────────────────────
organizationSchema.virtual('isPlanActive').get(function () {
  if (this.status === 'suspended' || this.status === 'expired') return false;
  if (this.status === 'trial') {
    return this.trialEndsAt ? new Date() < this.trialEndsAt : true;
  }
  if (this.planExpiresAt) return new Date() < this.planExpiresAt;
  return this.status === 'active';
});

// ─── Pre-save: auto-set paymentGateway based on currency ─────
organizationSchema.pre('save', async function() {
  if (this.isModified('currency')) {
    this.paymentGateway = this.currency === 'AUD' ? 'stripe' : 'razorpay';
  }
});

const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;
