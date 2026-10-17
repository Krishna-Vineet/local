import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, default: null },
    // ─── Discount campaign (platform CRM → Subscription Plans) ───
    // `discountType`: 'none' | 'percent' (value = % off) | 'flat' (value = ₹ off,
    // the "static" amount). The discount is only live inside the optional
    // [discountStartsAt, discountEndsAt] window — that window is the discount
    // duration. Effective price is always computed in services/planService.js
    // (`planPricing`) — never re-derive it in a route or a client.
    discountType: {
      type: String,
      enum: ['none', 'percent', 'flat'],
      default: 'none',
    },
    discountValue: { type: Number, default: 0 },
    discountLabel: { type: String, default: '', trim: true },
    discountStartsAt: { type: Date, default: null },
    discountEndsAt: { type: Date, default: null },
    // Client-count cap (0 = unlimited) + live counter of discounted
    // purchases. Incremented atomically by website checkout activation.
    discountMaxRedemptions: { type: Number, default: 0 },
    discountRedemptions: { type: Number, default: 0 },
    durationMonths: { type: Number, required: true },
    durationLabel: { type: String, required: true },
    devices: { type: Number, required: true },
    events: { type: Number, required: true },
    active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    // ─── Catalogue kind + monthly/annual pricing (₹ only) ───
    // kind 'plan'   → a subscription plan (Basic / Pro / Premium / Custom)
    // kind 'addon'  → an optional extra (Headshot Mode, Video Booth…)
    // `price` mirrors the INR monthly price; the two fields below are
    // the real catalogue. Annual = total for 12 months billed upfront
    // (the per-month figure is annual / 12).
    kind: { type: String, enum: ['plan', 'addon'], default: 'plan', index: true },
    priceMonthly: { type: Number, default: null },    // ₹ / month, billed monthly
    priceAnnual: { type: Number, default: null },     // ₹ total / year, billed annually
    billingNote: { type: String, default: '' },       // e.g. 'per device', 'one-time'
    // AI template credits granted per billing period (Premium: 500).
    aiCredits: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
export default SubscriptionPlan;
