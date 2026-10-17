// Website pricing must agree with backend/services/planService.js.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeDiscount, isDiscountActive, planPricing, publicPlanView, subscriptionPeriod,
  billingPrices,
  periodPrice,
} from '../src/pricing.js';

const now = new Date('2026-06-15T00:00:00Z');

test('percent discount applies inside its duration window only', () => {
  const plan = {
    key: 'professional', name: 'Professional', price: 5999,
    discountType: 'percent', discountValue: 20,
    discountStartsAt: '2026-06-01T00:00:00Z', discountEndsAt: '2026-06-30T00:00:00Z',
    devices: 5, events: 5, durationMonths: 6, durationLabel: '6 months',
  };
  assert.equal(isDiscountActive(plan, now), true);
  const view = publicPlanView(plan, now);
  assert.equal(view.effectivePrice, 4799);
  assert.equal(view.discountAmount, 1200);
  assert.equal(view.discountPercent, 20);
  assert.equal(isDiscountActive(plan, new Date('2026-07-01T00:00:00Z')), false);
  assert.equal(planPricing(plan, new Date('2026-07-01T00:00:00Z')).effectivePrice, 5999);
});

test('flat discount + free/contact-sales plans are never discounted', () => {
  assert.equal(planPricing({ price: 2999, discountType: 'flat', discountValue: 500 }, now).effectivePrice, 2499);
  assert.equal(planPricing({ price: 0, discountType: 'percent', discountValue: 50 }, now).discountAmount, 0);
  assert.equal(planPricing({ price: null, discountType: 'flat', discountValue: 500 }, now).effectivePrice, null);
  assert.equal(normalizeDiscount({ discountType: 'x', discountValue: -1 }).discountType, 'none');
});

test('subscription periods: months for paid plans, 14 days for trial', () => {
  const start = new Date('2026-06-15T00:00:00Z');
  assert.equal(subscriptionPeriod({ key: 'basic', durationMonths: 3 }, start).endDate.toISOString(), '2026-09-15T00:00:00.000Z');
  const trial = subscriptionPeriod({ key: 'trial', durationMonths: 0 }, start);
  assert.equal(Math.round((trial.endDate - trial.startDate) / 86400000), 14);
});


test('billing period prices: monthly vs annual, ₹ only', () => {
  const basic = { key: 'basic', price: 799, priceMonthly: 799, priceAnnual: 5988 };
  const view = billingPrices(basic);
  assert.equal(view.inr.monthly, 799);
  assert.equal(view.inr.annual, 5988);
  assert.equal(view.inr.annualPerMonth, 499);
  assert.equal(view.aud, undefined, '₹-only catalog: no AUD pricing block');
  assert.equal(periodPrice(basic, 'monthly'), 799);
  assert.equal(periodPrice(basic, 'annual'), 5988);
});

test('annual checkout grants twelve months', () => {
  const start = new Date('2026-01-15T00:00:00Z');
  const { endDate } = subscriptionPeriod({ key: 'basic', durationMonths: 1 }, start, 12);
  assert.equal(endDate.getTime(), new Date('2027-01-15T00:00:00Z').getTime());
});
