// ============================================================
// Activates a paid (or free) website checkout against the SHARED
// database:
//
//   • email is NEW      → create Organization + ORG_ADMIN User
//                         (password was hashed at order time)
//   • email EXISTS      → the password was already verified at order
//                         time; renew/upgrade that user's organization
//                         (term extends from the current expiry when
//                         it is still in the future — no paid days lost)
//
// Writes exactly the records the CRM reads (organizations, users,
// subscriptions), including the discount snapshot, so platform
// revenue + organisation pages light up with no extra wiring.
// ============================================================

import { Organization, User, Subscription, SubscriptionPlan } from './models.js';
import { subscriptionPeriod, invoiceNumber } from './pricing.js';

export async function activateCheckout(checkout, plan, { razorpayPaymentId = null, razorpaySignature = null } = {}) {
  // Idempotency: a double verify / Razorpay retry must not double-extend.
  if (checkout.status === 'paid' && checkout.subscriptionId) {
    const existing = await Subscription.findById(checkout.subscriptionId).lean();
    const organization = checkout.organizationId
      ? await Organization.findById(checkout.organizationId).lean()
      : null;
    return { checkout, subscription: existing, organization, alreadyActivated: true };
  }

  // Free trial is strictly one-time per organization / user — cannot be renewed.
  if (plan.key === 'trial' && (checkout.kind === 'renewal' || checkout.existingUserId || checkout.existingOrganizationId)) {
    throw Object.assign(new Error('This account has already claimed a free trial. Free trials cannot be renewed. Please choose a paid subscription plan.'), { status: 400, code: 'TRIAL_ALREADY_USED' });
  }

  // Free trial defense: ensure phone number hasn't already been used by another account
  if (plan.key === 'trial' && checkout.phone) {
    const cleanDigits = String(checkout.phone).replace(/\D/g, '');
    if (cleanDigits.length >= 10) {
      const last10 = cleanDigits.slice(-10);
      const phoneRegex = new RegExp(last10.split('').join('[\\s\\-\\(\\)]*') + '$');
      const [userWithPhone, orgWithPhone] = await Promise.all([
        User.findOne({ phoneNumber: phoneRegex, _id: { $ne: checkout.existingUserId } }),
        Organization.findOne({ phone: phoneRegex, _id: { $ne: checkout.existingOrganizationId } }),
      ]);
      if (userWithPhone || orgWithPhone) {
        throw Object.assign(new Error('This phone number has already been used for a free trial. Free trials cannot be renewed. Please choose a paid subscription plan.'), { status: 400, code: 'PHONE_TRIAL_ALREADY_USED' });
      }
    }
  }

  const now = new Date();
  let user = checkout.existingUserId ? await User.findById(checkout.existingUserId) : null;
  let organization = checkout.existingOrganizationId
    ? await Organization.findById(checkout.existingOrganizationId)
    : null;

  if (!organization) {
    if (user && user.organizationId) organization = await Organization.findById(user.organizationId);
  }

  if (!organization) {
    organization = await Organization.create({
      name: checkout.organizationName,
      ownerName: checkout.ownerName,
      email: checkout.email,
      phone: checkout.phone || '',
      country: 'IN',
      currency: 'INR',
      paymentGateway: 'razorpay',
      status: 'active',
      plan: plan.key,
      allowedDevices: plan.devices,
      allowedEvents: plan.events,
      planStartedAt: now,
    });
  }

  if (!user) {
    user = await User.create({
      name: checkout.ownerName,
      email: checkout.email,
      password: checkout.passwordHash, // already bcrypt-hashed at order time
      phoneNumber: checkout.phone || null,
      role: 'ORG_ADMIN',
      status: 'active',
      organizationId: organization._id,
    });
  } else if (!user.organizationId) {
    user.organizationId = organization._id;
    await user.save();
  }

  // Renewal: never steal paid days — extend from the later of now / expiry.
  const previous = await Subscription.findOne({ organizationId: organization._id, status: 'paid' })
    .sort({ endDate: -1 })
    .lean();
  const previousEnd = previous && previous.endDate && new Date(previous.endDate) > now
    ? new Date(previous.endDate)
    : null;
  // Billing period duration: annual (12m), semiannual (6m), quarterly (3m), monthly (1m); trial stays 14d.
  const PERIOD_MONTHS = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
  const months = plan.key === 'trial' ? null : (PERIOD_MONTHS[checkout.billingPeriod] || 1);
  const { startDate, endDate } = subscriptionPeriod(plan, previousEnd || now, months);

  const subscription = await Subscription.create({
    organizationId: organization._id,
    plan: plan.key,
    amount: checkout.amount,
    originalAmount: checkout.originalAmount,
    discountAmount: checkout.discountAmount,
    discountType: checkout.discountType,
    discountValue: checkout.discountValue,
    discountLabel: checkout.discountLabel,
    razorpayOrderId: checkout.razorpayOrderId || null,
    razorpayPaymentId,
    razorpaySignature,
    invoiceNo: invoiceNumber(now),
    startDate,
    endDate,
    status: 'paid',
    createdBy: user._id,
  });

  organization.plan = plan.key;
  // Calculate extra devices from addons
  const extraDevicesCount = (checkout.addons || []).filter((a) => a.key === 'addon-extra-device').length;
  organization.allowedDevices = (plan.devices || 1) + extraDevicesCount;
  organization.allowedEvents = plan.events;
  organization.billingCycle = checkout.billingPeriod || 'monthly';
  // Base plan AI credits + Addons AI credits (e.g. addon-ai-1000 pack)
  const addonCredits = (checkout.addons || []).reduce((sum, a) => sum + (Number(a.aiCredits) || (a.key === 'addon-ai-1000' ? 1000 : 0)), 0);
  organization.aiCredits = (Number(organization.aiCredits) || 0) + (Number(plan.aiCredits) || 0) + addonCredits;
  // Add-ons ride the subscription term; one-time packs never expire.
  for (const addon of checkout.addons || []) {
    const existing = (organization.addons || []).find((row) => row.key === addon.key);
    const isOneTime = addon.key === 'addon-props' || addon.key === 'addon-ai-1000' || addon.billingNote?.includes('one-time');
    const expiresAt = isOneTime ? null : endDate;
    if (existing) {
      existing.activatedAt = now;
      existing.expiresAt = expiresAt;
    } else {
      organization.addons = [...(organization.addons || []), { key: addon.key, name: addon.name || '', activatedAt: now, expiresAt }];
    }
  }
  if (!organization.planStartedAt || !previousEnd) organization.planStartedAt = startDate;
  organization.planExpiresAt = endDate;
  organization.nextBillingDate = endDate;
  if (plan.key === 'trial') organization.trialEndsAt = endDate;
  if (organization.status === 'suspended') {
    // A paid renewal does not silently un-suspend; platform keeps control.
  }
  await organization.save();

  // Client-count discount campaigns: this activation spent one slot.
  // Atomic $inc guarded by the cap so concurrent checkouts can never
  // push redemptions past discountMaxRedemptions; the recount then runs
  // stop gating new discounted orders (existing paid orders unaffected).
  if (plan?._id && checkout.discountAmount > 0) {
    await SubscriptionPlan.updateOne(
      {
        _id: plan._id,
        $or: [
          { discountMaxRedemptions: { $lte: 0 } },
          { $expr: { $lt: ['$discountRedemptions', '$discountMaxRedemptions'] } },
        ],
      },
      { $inc: { discountRedemptions: 1 } },
    );
  }

  checkout.status = 'paid';
  checkout.razorpayPaymentId = razorpayPaymentId || checkout.razorpayPaymentId;
  checkout.organizationId = organization._id;
  checkout.userId = user._id;
  checkout.subscriptionId = subscription._id;
  checkout.invoiceNo = subscription.invoiceNo;
  checkout.passwordHash = null; // never keep credentials around after use
  await checkout.save();

  return { checkout, subscription, organization, user, alreadyActivated: false };
}

export default { activateCheckout };
