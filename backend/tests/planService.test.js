// Issues #3, #4, #5, #55, #56: plan limits are real, come from the assigned
// plan, and are enforced before devices/events are created.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PLAN_CATALOG, ADDON_CATALOG, planSync, resolvePlan, computePlanStatus, planSummary,
  assertDeviceLimit, assertEventLimit, PlanLimitError, trialEndDate,
  normalizeDiscount, isDiscountActive, planPricing, billingPrices, parseDiscountInput,
} from '../services/planService.js';
import { isDownloadLive, newDownloadId } from '../services/guestDownloadService.js';

test('the plan catalogue is Basic / Pro / Premium / Custom with 2-device plans', () => {
  const keys = DEFAULT_PLAN_CATALOG.map((plan) => plan.key);
  assert.deepEqual(keys, ['trial', 'basic', 'pro', 'premium', 'custom']);
  for (const plan of DEFAULT_PLAN_CATALOG) {
    assert.ok(Number.isInteger(plan.devices) && plan.devices >= 1, `${plan.key} devices`);
    assert.ok(Number.isInteger(plan.events) && plan.events >= 1, `${plan.key} events`);
  }
  for (const key of ['basic', 'pro', 'premium']) {
    assert.equal(planSync(key).devices, 2, `${key} includes 2 devices`);
  }
  assert.equal(planSync('premium').aiCredits, 500, 'Premium carries 500 AI credits');
  // Dual-currency monthly/annual pricing
  assert.equal(planSync('basic').priceMonthly, 799);
  assert.equal(planSync('basic').priceAnnual, 5988);
  assert.equal(planSync('pro').priceMonthly, 999);
  assert.equal(planSync('premium').priceAnnual, 11988);
});

test('add-ons are ₹299/mo extras in the same catalogue', () => {
  assert.ok(ADDON_CATALOG.length >= 5);
  for (const addon of ADDON_CATALOG) {
    assert.equal(addon.kind, 'addon');
    assert.ok(addon.key.startsWith('addon-'));
  }
  const headshot = ADDON_CATALOG.find((a) => a.key === 'addon-headshot');
  assert.equal(headshot.priceMonthly, 299);
});

test('unknown plans fall back to trial instead of throwing', () => {
  assert.equal(planSync('does-not-exist').key, 'trial');
});

test('plan status derives from lifecycle + subscription (#3)', () => {
  const active = { status: 'active', plan: 'basic' };
  const future = new Date(Date.now() + 60 * 24 * 3600 * 1000);
  const soon = new Date(Date.now() + 5 * 24 * 3600 * 1000);
  const past = new Date(Date.now() - 24 * 3600 * 1000);

  assert.equal(computePlanStatus({ ...active, status: 'suspended' }, null), 'suspended');
  assert.equal(computePlanStatus({ ...active, status: 'banned' }, null), 'banned');
  assert.equal(computePlanStatus(active, null), 'not_subscribed');
  assert.equal(
    computePlanStatus(active, { plan: 'basic', amount: 799, startDate: past, endDate: future }),
    'active',
  );
  assert.equal(
    computePlanStatus(active, { plan: 'basic', amount: 799, startDate: past, endDate: soon }),
    'expiring_soon',
  );
  assert.equal(
    computePlanStatus(active, { plan: 'basic', amount: 799, startDate: past, endDate: past }),
    'expired',
  );
  assert.equal(
    computePlanStatus(active, { plan: 'trial', amount: 0, startDate: past, endDate: future }),
    'trial',
  );
});

test('plan summary exposes the limits the CRM displays (#3, #56)', async () => {
  const org = { status: 'active', plan: 'pro', createdAt: new Date('2026-01-01') };
  const subscription = {
    plan: 'pro', amount: 999,
    startDate: new Date('2026-01-01'),
    endDate: new Date(Date.now() + 90 * 24 * 3600 * 1000),
    invoiceNo: 'HAP-INV-1',
  };
  const summary = await planSummary(org, subscription);
  assert.equal(summary.planName, 'Pro');
  assert.equal(summary.deviceLimit, 2);
  assert.equal(summary.eventLimit, 4);
  assert.equal(summary.status, 'active');
  assert.ok(summary.daysLeft >= 80);
  assert.equal(summary.invoice, 'HAP-INV-1');
});

test('device limit blocks the next device with an actionable message (#55)', async () => {
  const org = { status: 'active', plan: 'trial' }; // 1 device
  await assert.rejects(() => assertDeviceLimit(org, 1), (error) => {
    assert.ok(error instanceof PlanLimitError);
    assert.equal(error.status, 409);
    assert.equal(error.code, 'PLAN_LIMIT_REACHED');
    assert.match(error.message, /Trial plan allows 1 connected device/);
    return true;
  });
  // Under the limit is fine.
  const limits = await assertDeviceLimit(org, 0);
  assert.equal(limits.devices, 1);
});

test('event limit blocks parallel active events (#55)', async () => {
  const org = { status: 'active', plan: 'basic' }; // 2 events
  await assert.rejects(() => assertEventLimit(org, 2), /allows 2 active events/);
  const limits = await assertEventLimit(org, 1);
  assert.equal(limits.events, 2);
});

test('resolvePlan prefers database rows over the built-in catalogue', async () => {
  const plan = await resolvePlan('basic');
  assert.equal(plan.key, 'basic');
  assert.ok(plan.devices >= 1);
});

test('plan discounts: percent + flat apply only inside their duration window', () => {
  const now = new Date('2026-06-15T00:00:00Z');
  const percentPlan = {
    price: 5999, discountType: 'percent', discountValue: 20,
    discountStartsAt: '2026-06-01T00:00:00Z', discountEndsAt: '2026-06-30T00:00:00Z',
  };
  assert.equal(isDiscountActive(percentPlan, now), true);
  const pricing = planPricing(percentPlan, now);
  assert.equal(pricing.discountAmount, 1200); // 20% of 5999, rounded
  assert.equal(pricing.effectivePrice, 4799);
  assert.equal(pricing.discountPercent, 20);
  assert.equal(pricing.discount.active, true);

  // Outside the window (before start / after end) the list price returns.
  assert.equal(isDiscountActive(percentPlan, new Date('2026-05-15T00:00:00Z')), false);
  assert.equal(planPricing(percentPlan, new Date('2026-07-15T00:00:00Z')).effectivePrice, 5999);

  // Flat ("static") discount, open-ended start.
  const flat = planPricing({ price: 2999, discountType: 'flat', discountValue: 500, discountStartsAt: null, discountEndsAt: '2026-12-31T00:00:00Z' }, now);
  assert.equal(flat.effectivePrice, 2499);
  assert.equal(flat.discountAmount, 500);

  // No discount / free / contact-sales plans never discount.
  assert.equal(planPricing({ price: 2999 }, now).effectivePrice, 2999);
  assert.equal(planPricing({ price: 0, discountType: 'percent', discountValue: 50 }, now).discountAmount, 0);
  assert.equal(planPricing({ price: null, discountType: 'percent', discountValue: 50 }, now).effectivePrice, null);
  assert.deepEqual(normalizeDiscount({ discountType: 'bogus', discountValue: -5 }).discountType, 'none');
});

test('plan discount input validation rejects nonsense campaigns', () => {
  assert.throws(() => parseDiscountInput({ discountType: 'percent', discountValue: 0 }, 5999), /between 1 and 100/);
  assert.throws(() => parseDiscountInput({ discountType: 'percent', discountValue: 101 }, 5999), /between 1 and 100/);
  assert.throws(() => parseDiscountInput({ discountType: 'flat', discountValue: 6000 }, 5999), /less than the plan price/);
  assert.throws(() => parseDiscountInput({ discountType: 'flat', discountValue: 100 }, null), /needs a priced plan/);
  assert.throws(
    () => parseDiscountInput({ discountType: 'percent', discountValue: 10, discountStartsAt: '2026-07-01', discountEndsAt: '2026-06-01' }, 5999),
    /end must be after its start/,
  );
  const ok = parseDiscountInput({ discountType: 'percent', discountValue: 15, discountLabel: ' Launch ' }, 5999);
  assert.equal(ok.discountLabel, 'Launch');
});

test('guest download ids are unguessable and links die at 24h', () => {
  const a = newDownloadId();
  const b = newDownloadId();
  assert.notEqual(a, b);
  assert.ok(a.length >= 20);
  const created = new Date('2026-06-15T10:00:00Z');
  const download = { expiresAt: new Date(created.getTime() + 24 * 3600 * 1000) };
  assert.equal(isDownloadLive(download, new Date('2026-06-16T09:59:59Z')), true);
  assert.equal(isDownloadLive(download, new Date('2026-06-16T10:00:01Z')), false);
  assert.equal(isDownloadLive(null), false);
});

test('trial end date is 14 days out', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  const end = trialEndDate(start);
  assert.equal(end.toISOString(), '2026-01-15T00:00:00.000Z');
});

test('billingPrices exposes monthly + annual in ₹', () => {
  const basic = billingPrices(planSync('basic'));
  assert.equal(basic.inr.monthly, 799);
  assert.equal(basic.inr.annual, 5988);
  assert.equal(basic.inr.annualPerMonth, 499);
  assert.equal(billingPrices(planSync('premium')).aiCredits, 500);
  assert.equal(billingPrices(planSync('custom')).inr.monthly, null);
});

test('discount client-count cap stops the campaign at the limit', () => {
  const plan = {
    price: 999, discountType: 'percent', discountValue: 20, discountLabel: 'First 50',
    discountStartsAt: null, discountEndsAt: null,
    discountMaxRedemptions: 50, discountRedemptions: 49,
  };
  assert.equal(planPricing(plan).effectivePrice, 799); // 20% off 999
  assert.equal(planPricing({ ...plan, discountRedemptions: 50 }).effectivePrice, 999); // cap reached
  const flat = planPricing({ ...plan, discountType: 'flat', discountValue: 200, discountRedemptions: 0 });
  assert.equal(flat.effectivePrice, 799); // ₹200 off 999
  const parsed = parseDiscountInput({ discountType: 'percent', discountValue: 20, discountMaxRedemptions: 50 }, 999);
  assert.equal(parsed.discountMaxRedemptions, 50);
});
