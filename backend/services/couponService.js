// ============================================================
// Coupons — ONE field vocabulary for CRM, mock API, real backend and the
// booth client (issues #41–#44).
//
// Canonical stored fields (Coupon model):
//   id, code, type, value, quantity, usedCount, eventIds, status,
//   expiryDate, createdAt, updatedAt
//
// API responses additionally expose stable aliases so older clients keep
// working, plus the derived flags the CRM expects:
//   discountType, discountValue, maxUses, usageCount, assignedEventIds,
//   expiresAt, expired, isExhausted, events[]
// ============================================================

import Coupon from '../models/Coupon.js';
import Payment from '../models/Payment.js';

export const COUPON_TYPES = ['percentage', 'fixed'];

export function toPlainMap(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  return { ...value };
}

/** Raw stored coupon (Mongo doc or lean object) → API shape. */
export function couponView(coupon, { events = [] } = {}) {
  if (!coupon) return null;
  const raw = typeof coupon.toObject === 'function' ? coupon.toObject() : coupon;
  const quantity = Number(raw.quantity) || 0;
  const usedCount = Number(raw.usedCount) || 0;
  const expiry = raw.expiryDate ? new Date(raw.expiryDate) : null;
  const expired = !!expiry && expiry.getTime() < Date.now();
  const exhausted = quantity > 0 && usedCount >= quantity;
  const eventIds = (raw.eventIds || []).map((id) => String(id._id || id));
  const knownEvents = events
    .filter((event) => eventIds.includes(String(event.id || event._id)))
    .map((event) => ({ id: String(event.id || event._id), name: event.name }));
  const status = raw.status === 'paused'
    ? 'paused'
    : expired
      ? 'expired'
      : exhausted
        ? 'exhausted'
        : 'active';

  return {
    id: String(raw._id || raw.id),
    organizationId: raw.organizationId ? String(raw.organizationId._id || raw.organizationId) : null,
    code: raw.code,
    // canonical
    type: raw.type,
    value: Number(raw.value) || 0,
    quantity,
    usedCount,
    eventIds,
    expiresAt: expiry ? expiry.toISOString() : null,
    // aliases kept in sync for every client (issue #42/#43)
    discountType: raw.type,
    discountValue: Number(raw.value) || 0,
    maxUses: quantity,
    usageCount: usedCount,
    assignedEventIds: eventIds,
    expiryDate: expiry ? expiry.toISOString() : null,
    // derived state
    status,
    storedStatus: raw.status || 'active',
    expired,
    isExhausted: exhausted,
    events: knownEvents,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : null,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : null,
  };
}

/** CRM payload (either vocabulary) → stored fields. Used by create + update. */
/**
 * Issues #41–#44: a coupon's identity is fixed at creation. `code`, `type`,
 * `value` (the discount), and the system-managed usage counter can never be
 * edited afterwards — the CRM pauses the coupon and issues a new code instead.
 * Quantity, expiry and event assignment stay editable, with guards.
 */
export const COUPON_LOCKED_FIELDS = ['code', 'type', 'value', 'usedCount'];

function fail(message, code = 'BAD_COUPON') {
  throw Object.assign(new Error(message), { status: 400, code });
}

export function couponPatch(body = {}, existing = null) {
  const patch = {};
  const type = body.type ?? body.discountType;
  const value = body.value ?? body.discountValue;
  const quantity = body.quantity ?? body.maxUses;
  const hasUsedCount = body.usedCount !== undefined || body.usageCount !== undefined;
  const usedCount = body.usedCount ?? body.usageCount;
  const eventIds = body.eventIds ?? body.assignedEventIds;

  if (body.code !== undefined) patch.code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (type !== undefined) patch.type = type;
  if (value !== undefined) patch.value = Number(value);
  if (quantity !== undefined) patch.quantity = Number(quantity);
  if (usedCount !== undefined) patch.usedCount = Number(usedCount);
  if (eventIds !== undefined) patch.eventIds = Array.isArray(eventIds) ? eventIds : [];
  const expiry = body.expiryDate ?? body.expiresAt;
  if (expiry !== undefined) patch.expiryDate = expiry ? new Date(expiry) : null;
  if (body.status !== undefined) patch.status = body.status === 'paused' ? 'paused' : 'active';

  if (existing) {
    const locked = [];
    if (patch.code !== undefined && patch.code !== String(existing.code || '').toUpperCase()) locked.push('code');
    if (patch.type !== undefined && patch.type !== existing.type) locked.push('type');
    if (patch.value !== undefined && Number(patch.value) !== Number(existing.value)) locked.push('value');
    if (hasUsedCount) locked.push('usedCount');
    if (locked.length) {
      fail(`A coupon's ${locked.join(', ')} cannot be changed after creation. Pause it and create a new code instead — existing redemptions must stay auditable.`, 'COUPON_LOCKED_FIELDS');
    }
    if (patch.quantity !== undefined && patch.quantity < Number(existing.usedCount || 0)) {
      fail(`The quantity cannot be lower than the ${Number(existing.usedCount || 0)} time(s) this coupon has already been used.`, 'COUPON_QUANTITY_BELOW_USED');
    }
  }
  return patch;
}

/** Validate a create request. Throws { status, message }. */
export function validateCouponCreate(patch) {
  const fail = (message) => { throw Object.assign(new Error(message), { status: 400, code: 'BAD_COUPON' }); };
  if (!patch.code) fail('A coupon code is required.');
  if (!COUPON_TYPES.includes(patch.type)) fail('Discount type must be percentage or fixed.');
  if (!Number.isFinite(patch.value) || patch.value <= 0) fail('Discount value must be a positive number.');
  if (patch.type === 'percentage' && patch.value > 100) fail('Percentage discount cannot exceed 100.');
  if (!Number.isInteger(patch.quantity) || patch.quantity < 1) fail('Quantity must be a whole number of 1 or more.');
  if (!patch.expiryDate || Number.isNaN(patch.expiryDate.getTime())) fail('An expiry date is required.');
  if (patch.expiryDate.getTime() < Date.now() - 60 * 1000) fail('Expiry date must be in the future.');
  return patch;
}

/**
 * Booth-side validation + discount math (issues #43, #44).
 * Returns { ok, discount, message } — never throws, so the booth can show
 * a friendly coupon error without a 500.
 */
export function applyCoupon(coupon, { gross, eventId } = {}) {
  if (!coupon) return { ok: false, discount: 0, message: 'That coupon was not found.' };
  const view = couponView(coupon);
  if (view.storedStatus !== 'active') return { ok: false, discount: 0, message: 'This coupon is paused.' };
  if (view.expired) return { ok: false, discount: 0, message: 'This coupon has expired.' };
  if (view.isExhausted) return { ok: false, discount: 0, message: 'This coupon has been fully used.' };
  if (eventId && view.eventIds.length && !view.eventIds.includes(String(eventId))) {
    return { ok: false, discount: 0, message: 'This coupon is not valid for this event.' };
  }
  const amount = Math.max(0, Number(gross) || 0);
  const discount = view.type === 'percentage'
    ? Math.round(amount * (view.value / 100))
    : Math.min(amount, view.value);
  const label = view.type === 'percentage' ? `${view.value}% off` : `₹${view.value} off`;
  return {
    ok: true,
    discount,
    coupon: view,
    message: `${view.code} applied · ${label}`,
  };
}

/** Resolve a coupon by code for an organization + optional event scope. */
export async function findCouponForOrg(organizationId, code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  return Coupon.findOne({ organizationId, code: clean });
}

export default {
  COUPON_TYPES, COUPON_LOCKED_FIELDS, couponView, couponPatch, validateCouponCreate, applyCoupon,
  findCouponForOrg, toPlainMap,
};

/**
 * Count a coupon redemption exactly once per payment. Every paid path (Razorpay
 * verify/webhook, free checkout, booth payment confirm) calls this; the
 * conditional update makes repeated calls for the same payment a no-op.
 */
export async function recordCouponRedemption(payment) {
  if (!payment || !payment.couponCode) return false;
  const claim = await Payment.updateOne(
    { _id: payment._id, couponCounted: { $ne: true } },
    { $set: { couponCounted: true } },
  );
  if (!claim.modifiedCount) return false;
  await Coupon.updateOne(
    { organizationId: payment.organizationId, code: String(payment.couponCode).trim().toUpperCase() },
    { $inc: { usedCount: 1 } },
  );
  return true;
}
