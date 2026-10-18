// ============================================================
// Website-backend models — SAME MongoDB database as backend/.
//
// These schemas intentionally mirror the collections owned by the
// main backend (backend/models/*.js):
//   organizations · users · subscriptionplans · subscriptions
//   guestdownloads · photos
// so a plan discount edited in the CRM, a booth session uploaded to
// the main backend, and a purchase made on this website all read and
// write the very same documents. Field changes must be mirrored in
// backend/models — keep the two in sync.
//
// Only two collections are owned by THIS service:
//   websitecheckouts (pending/paid Razorpay checkouts from the site)
//   websiteleads     (contact / demo requests from the site)
// ============================================================

import mongoose from 'mongoose';

// ─── Shared: subscription plans (backend/models/SubscriptionPlan.js) ───
const subscriptionPlanSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, default: null },
    discountType: { type: String, enum: ['none', 'percent', 'flat'], default: 'none' },
    discountValue: { type: Number, default: 0 },
    discountLabel: { type: String, default: '' },
    discountStartsAt: { type: Date, default: null },
    discountEndsAt: { type: Date, default: null },
    // Client-count-based campaigns: discount stops after N redemptions.
    discountMaxRedemptions: { type: Number, default: 0 },
    discountRedemptions: { type: Number, default: 0 },
    durationMonths: { type: Number, required: true },
    durationLabel: { type: String, required: true },
    devices: { type: Number, required: true },
    events: { type: Number, required: true },
    active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    // Catalogue kind + ₹ pricing (mirrors backend model)
    kind: { type: String, enum: ['plan', 'addon'], default: 'plan' },
    priceMonthly: { type: Number, default: null },
    priceQuarterly: { type: Number, default: null },
    priceSemiannual: { type: Number, default: null },
    priceAnnual: { type: Number, default: null },
    billingNote: { type: String, default: '' },
    aiCredits: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'subscriptionplans' },
);

// ─── Shared: organizations (backend/models/Organization.js) ─────
const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: '' },
    country: { type: String, default: 'IN' },
    // NOTE: no enum copy here — the CRM allows admin-created plan keys
    // beyond the built-ins, and checkout must accept any catalog key.
    plan: { type: String, default: 'trial', lowercase: true, trim: true },
    currency: { type: String, default: 'INR' },
    billingCycle: { type: String, default: 'monthly' },
    planStartedAt: { type: Date, default: null },
    planExpiresAt: { type: Date, default: null },
    nextBillingDate: { type: Date, default: null },
    paymentGateway: { type: String, default: 'razorpay' },
    status: { type: String, default: 'active' },
    suspendReason: { type: String, default: null },
    trialEndsAt: { type: Date, default: null },
    allowedDevices: { type: Number, default: 1 },
    allowedEvents: { type: Number, default: 1 },
    // Purchased add-ons (from the website catalogue, kind: 'addon').
    addons: {
      type: [{
        key: { type: String, required: true },
        name: { type: String, default: '' },
        activatedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, default: null }, // null = forever (one-time packs)
        _id: false,
      }],
      default: [],
    },
    aiCredits: { type: Number, default: 0 },
    sessionVersion: { type: Number, default: 0 },
    internalNotes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: 'organizations' },
);

// ─── Shared: users (backend/models/User.js) ─────────────────────
// Passwords are bcrypt hashes, identical format to the main backend
// (bcryptjs, cost 10) so website-registered users can sign into the
// CRM immediately. Hashing happens in the checkout route — this
// schema deliberately has no pre-save hook.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    phoneNumber: { type: String, trim: true, default: null },
    profilePhotoUrl: { type: String, default: null },
    role: { type: String, required: true }, // ORG_ADMIN for website buyers
    status: { type: String, default: 'active' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null },
    sessionVersion: { type: Number, default: 0 },
  },
  { collection: 'users' },
);

// ─── Shared: subscriptions (backend/models/Subscription.js) ─────
const subscriptionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    plan: { type: String, required: true },
    amount: { type: Number, required: true },
    originalAmount: { type: Number, default: null },
    discountAmount: { type: Number, default: 0 },
    discountType: { type: String, default: 'none' },
    discountValue: { type: Number, default: 0 },
    discountLabel: { type: String, default: '' },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
    invoiceNo: { type: String, required: true, unique: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, default: 'paid' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: 'subscriptions' },
);

// ─── Shared: guest downloads (backend/models/GuestDownload.js) ──
const guestDownloadSchema = new mongoose.Schema(
  {
    downloadId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, default: null },
    eventId: { type: mongoose.Schema.Types.ObjectId, default: null },
    deviceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    sessionId: { type: String, default: null },
    compositeUrl: { type: String, default: null },
    photoUrls: { type: [String], default: [] },
    photoIds: [{ type: mongoose.Schema.Types.ObjectId }],
    eventName: { type: String, default: '' },
    organizationName: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    viewCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'guestdownloads' },
);

// ─── Owned: website checkouts ───────────────────────────────────
// One row per Razorpay order created from the pricing page. Holds the
// (hashed) password for brand-new accounts until payment verifies —
// the User/Organization are only created AFTER money is confirmed,
// so abandoned checkouts never leave orphan accounts behind.
const websiteCheckoutSchema = new mongoose.Schema(
  {
    razorpayOrderId: { type: String, default: null, index: true },
    planKey: { type: String, required: true },
    planName: { type: String, default: '' },
    // Amount snapshot at order time (₹): list price, discount, charged.
    originalAmount: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    discountType: { type: String, default: 'none' },
    discountValue: { type: Number, default: 0 },
    discountLabel: { type: String, default: '' },
    amount: { type: Number, required: true },

    organizationName: { type: String, required: true },
    ownerName: { type: String, required: true },
    phone: { type: String, default: '' },
    email: { type: String, required: true, lowercase: true, index: true },
    passwordHash: { type: String, default: null }, // new accounts only

    existingUserId: { type: mongoose.Schema.Types.ObjectId, default: null },
    existingOrganizationId: { type: mongoose.Schema.Types.ObjectId, default: null },

    status: { type: String, enum: ['created', 'paid', 'failed', 'expired'], default: 'created', index: true },
    // Billing period chosen on the website: 'monthly' (1 month),
    // 'quarterly' (3 months), 'semiannual' (6 months), or 'annual' (12 months).
    billingPeriod: { type: String, enum: ['monthly', 'quarterly', 'semiannual', 'annual'], default: 'monthly' },
    addons: {
      type: [{
        key: { type: String, required: true },
        name: { type: String, default: '' },
        amount: { type: Number, default: 0 },
        _id: false,
      }],
      default: [],
    },
    razorpayPaymentId: { type: String, default: null },
    organizationId: { type: mongoose.Schema.Types.ObjectId, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, default: null },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    invoiceNo: { type: String, default: null },
    kind: { type: String, enum: ['new', 'renewal', 'free'], default: 'new' },
  },
  { timestamps: true, collection: 'websitecheckouts' },
);

// ─── Owned: website leads (contact / book-a-demo) ───────────────
const websiteLeadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: '', trim: true },
    company: { type: String, default: '', trim: true },
    message: { type: String, default: '' },
    type: { type: String, enum: ['contact', 'demo', 'hardware', 'support'], default: 'contact' },
    status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' },
  },
  { timestamps: true, collection: 'websiteleads' },
);

export const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
export const Organization = mongoose.model('Organization', organizationSchema);
export const User = mongoose.model('User', userSchema);
export const Subscription = mongoose.model('Subscription', subscriptionSchema);
export const GuestDownload = mongoose.model('GuestDownload', guestDownloadSchema);
export const WebsiteCheckout = mongoose.model('WebsiteCheckout', websiteCheckoutSchema);
export const WebsiteLead = mongoose.model('WebsiteLead', websiteLeadSchema);
