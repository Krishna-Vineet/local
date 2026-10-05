import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    // null = "contact sales" (custom pricing)
    price: { type: Number, default: null },
    durationMonths: { type: Number, required: true },
    durationLabel: { type: String, required: true },
    devices: { type: Number, required: true },
    events: { type: Number, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
export default SubscriptionPlan;
