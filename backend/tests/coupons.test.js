// Issues #41–#44, #115: coupons expose one vocabulary everywhere (CRM, mock,
// backend, booth) and the discount math is shared.
import test from 'node:test';
import assert from 'node:assert/strict';

import { couponView, couponPatch, validateCouponCreate, applyCoupon } from '../services/couponService.js';

const base = {
  _id: 'cup-1',
  organizationId: 'org-1',
  code: 'PIX20',
  type: 'percentage',
  value: 20,
  quantity: 100,
  usedCount: 5,
  expiryDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  eventIds: ['evt-1'],
  status: 'active',
  createdAt: new Date('2026-02-01T10:00:00Z'),
  updatedAt: new Date('2026-02-02T10:00:00Z'),
};

test('the response carries every field the CRM expects (#42)', () => {
  const view = couponView(base, { events: [{ id: 'evt-1', name: 'Reception' }] });
  for (const field of [
    'id', 'code', 'type', 'value', 'quantity', 'usedCount', 'eventIds', 'status',
    'createdAt', 'expiryDate', 'expired', 'isExhausted',
  ]) {
    assert.ok(field in view, `missing ${field}`);
  }
  // Canonical + alias vocabulary stay in sync (#43).
  assert.equal(view.discountType, 'percentage');
  assert.equal(view.discountValue, 20);
  assert.equal(view.maxUses, 100);
  assert.equal(view.usageCount, 5);
  assert.deepEqual(view.assignedEventIds, ['evt-1']);
  assert.equal(view.events[0].name, 'Reception');
  assert.equal(view.expired, false);
  assert.equal(view.isExhausted, false);
});

test('expired and exhausted flags are derived, not stored', () => {
  const expired = couponView({ ...base, expiryDate: new Date(Date.now() - 1000) });
  assert.equal(expired.expired, true);
  assert.equal(expired.status, 'expired');

  const exhausted = couponView({ ...base, usedCount: 100 });
  assert.equal(exhausted.isExhausted, true);
  assert.equal(exhausted.status, 'exhausted');

  const paused = couponView({ ...base, status: 'paused' });
  assert.equal(paused.status, 'paused');
  assert.equal(paused.storedStatus, 'paused');
});

test('create payload accepts either vocabulary', () => {
  const canonical = couponPatch({
    code: 'new10', type: 'fixed', value: 50, quantity: 10,
    expiryDate: '2026-12-31', eventIds: ['a'],
  });
  assert.equal(canonical.code, 'NEW10');
  assert.equal(canonical.type, 'fixed');
  assert.equal(canonical.value, 50);
  assert.equal(canonical.quantity, 10);

  const aliased = couponPatch({
    code: 'new20', discountType: 'percentage', discountValue: 20,
    maxUses: 5, usageCount: 1, assignedEventIds: ['b', 'c'], expiresAt: '2026-12-31',
  });
  assert.equal(aliased.type, 'percentage');
  assert.equal(aliased.value, 20);
  assert.equal(aliased.quantity, 5);
  assert.equal(aliased.usedCount, 1);
  assert.deepEqual(aliased.eventIds, ['b', 'c']);
});

test('create validation rejects impossible coupons', () => {
  const valid = {
    code: 'OK10', type: 'percentage', value: 10, quantity: 5,
    expiryDate: new Date(Date.now() + 3600 * 1000),
  };
  assert.doesNotThrow(() => validateCouponCreate(valid));
  assert.throws(() => validateCouponCreate({ ...valid, code: '' }), /code is required/);
  assert.throws(() => validateCouponCreate({ ...valid, type: 'bogus' }), /percentage or fixed/);
  assert.throws(() => validateCouponCreate({ ...valid, value: 120 }), /cannot exceed 100/);
  assert.throws(() => validateCouponCreate({ ...valid, quantity: 0 }), /Quantity/);
  assert.throws(() => validateCouponCreate({ ...valid, expiryDate: new Date(Date.now() - 3600 * 1000) }), /future/);
});

test('discount math matches between percentage and fixed coupons', () => {
  const percent = applyCoupon(base, { gross: 250, eventId: 'evt-1' });
  assert.equal(percent.ok, true);
  assert.equal(percent.discount, 50);
  assert.match(percent.message, /PIX20 applied/);

  const fixed = applyCoupon({ ...base, type: 'fixed', value: 100 }, { gross: 250, eventId: 'evt-1' });
  assert.equal(fixed.discount, 100);

  // A fixed discount never exceeds the gross amount.
  const over = applyCoupon({ ...base, type: 'fixed', value: 900 }, { gross: 250, eventId: 'evt-1' });
  assert.equal(over.discount, 250);
});

test('invalid coupons are explained, never thrown at the guest', () => {
  assert.equal(applyCoupon(null, { gross: 100 }).ok, false);
  assert.match(applyCoupon({ ...base, status: 'paused' }, { gross: 100 }).message, /paused/);
  assert.match(applyCoupon({ ...base, expiryDate: new Date(Date.now() - 1000) }, { gross: 100 }).message, /expired/);
  assert.match(applyCoupon({ ...base, usedCount: 100 }, { gross: 100 }).message, /fully used/);
  assert.match(applyCoupon(base, { gross: 100, eventId: 'evt-2' }).message, /not valid for this event/);
  // An org-wide coupon (no event scope) works on any event.
  assert.equal(applyCoupon({ ...base, eventIds: [] }, { gross: 100, eventId: 'evt-2' }).ok, true);
});

test('a coupon identity is immutable after creation (#41, #42)', () => {
  const existing = { code: 'PIX20', type: 'percentage', value: 20, quantity: 100, usedCount: 5 };

  // Editable: quantity, expiry, event assignment, status.
  const allowed = couponPatch({ quantity: 150, expiresAt: '2027-01-31', assignedEventIds: ['evt-2'] }, existing);
  assert.equal(allowed.quantity, 150);
  assert.deepEqual(allowed.eventIds, ['evt-2']);
  assert.ok(allowed.expiryDate instanceof Date);

  // Locked: code, discount type, discount value and the usage counter.
  for (const locked of [{ code: 'PIX30' }, { type: 'fixed' }, { value: 30 }, { usedCount: 0 }, { usageCount: 0 }]) {
    assert.throws(() => couponPatch(locked, existing), (error) => error.code === 'COUPON_LOCKED_FIELDS');
  }

  // Resending the same values is a no-op, not an error.
  assert.deepEqual(couponPatch({ code: 'PIX20', type: 'percentage', value: 20 }, existing), { code: 'PIX20', type: 'percentage', value: 20 });

  // Quantity may never drop below what guests have already redeemed.
  assert.throws(() => couponPatch({ quantity: 2 }, existing), (error) => error.code === 'COUPON_QUANTITY_BELOW_USED');
});
