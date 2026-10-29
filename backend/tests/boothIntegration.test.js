// Comprehensive integration test for the Booth API session lifecycle,
// pricing quote calculation, template slot validation, and guest download TTL.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  suggestedPriceMap,
  resolveLayoutPrices,
  resolveTemplateUnitPrice,
  resolveTemplateLayoutPriceKey,
  layoutMeta,
} from '../config/layouts.js';
import {
  buildBranding,
  computeRevision,
  mergeHardware,
  boothStateFor,
  boothCanOperate,
  BOOTH_STATES,
} from '../services/boothSnapshotService.js';
import { applyCoupon } from '../services/couponService.js';
import {
  newDownloadId,
  downloadUrlFor,
  isDownloadLive,
  DOWNLOAD_TTL_MS,
} from '../services/guestDownloadService.js';

test('Booth Integration — Layout price resolution and quote calculations', () => {
  const suggested = suggestedPriceMap();
  assert.ok(suggested['46:3'] > 0);

  // Test template price resolution with event override vs org default
  const template = {
    _id: 'tmpl_123',
    layout: { type: 'grid', slots: 3, orientation: 'portrait', familyId: '46' },
    layoutId: '46:3',
  };

  const resolved = resolveTemplateUnitPrice(template, {
    event: { layoutPrices: { '46:3': 180 } },
    defaults: { layoutPrices: { '46:3': 120 } },
  });

  assert.equal(resolved.unitPrice, 180, 'Event price takes precedence over org default');

  // Multi-print quote calculation
  const copies = 3;
  const subtotal = resolved.unitPrice * copies;
  assert.equal(subtotal, 540);
});

test('Booth Integration — Coupon discount application during quote generation', () => {
  const coupon = {
    code: 'SAVE50',
    type: 'percentage',
    value: 50,
    quantity: 100,
    usedCount: 5,
    status: 'active',
    expiryDate: new Date(Date.now() + 86400000 * 7),
  };

  const result = applyCoupon(coupon, { gross: 500 });
  assert.equal(result.ok, true);
  assert.equal(result.discount, 250);
});

test('Booth Integration — Booth state lifecycle and hardware telemetry merges', () => {
  const device = {
    telemetry: { prints: 10, shutters: 20 },
    connections: { camera: true, printer: true, kioskScreen: true },
  };

  const merged = mergeHardware(device, { printerConnected: false });
  assert.equal(merged.connections.printer, false);
  assert.equal(merged.connections.camera, true);
  assert.equal(merged.telemetry.prints, 10);

  // State determination
  assert.equal(
    boothStateFor({ device: { status: 'active' }, organization: { status: 'active' } }),
    BOOTH_STATES.ACTIVE,
  );
  assert.equal(
    boothStateFor({ device: { status: 'active' }, organization: { status: 'suspended' } }),
    BOOTH_STATES.SUSPENDED,
  );
  assert.equal(boothCanOperate(BOOTH_STATES.ACTIVE), true);
  assert.equal(boothCanOperate(BOOTH_STATES.SUSPENDED), false);
});

test('Booth Integration — Guest download 24-hour expiration token generation', () => {
  const downloadId = newDownloadId();
  assert.ok(downloadId);
  assert.equal(downloadId.length >= 16, true);

  const url = downloadUrlFor(downloadId);
  assert.ok(url.includes(`/download/${downloadId}`));

  const now = new Date('2026-10-26T12:00:00Z');
  const activeRecord = {
    downloadId,
    expiresAt: new Date(now.getTime() + DOWNLOAD_TTL_MS),
  };

  assert.equal(isDownloadLive(activeRecord, now), true);

  // After 24h + 1 sec, download should be expired
  const expiredTime = new Date(now.getTime() + DOWNLOAD_TTL_MS + 1000);
  assert.equal(isDownloadLive(activeRecord, expiredTime), false);
});
