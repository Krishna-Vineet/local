// Issues #45–#50, #58/#59, #62–#68, #69–#81: booth configuration, branding
// de-duplication, the layout-price fallback chain, heartbeat diffing and the
// states that tell a booth to stop operating.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dedupeLogos, buildBranding, buildSettings, computeRevision, mergeHardware,
  boothStateFor, boothCanOperate, mapTemplates, BOOTH_STATES,
} from '../services/boothSnapshotService.js';
import { resolveLayoutPrices, suggestedPriceMap, layoutMeta, validateLayoutPrices } from '../config/layouts.js';

test('logos are de-duplicated case-insensitively (#58, #67)', () => {
  const logos = dedupeLogos([
    'https://cdn.example.com/logo.png',
    'https://cdn.example.com/logo.png',
    ' HTTPS://CDN.example.com/Logo.png ',
    '',
    null,
    'https://cdn.example.com/venue.png',
  ]);
  assert.deepEqual(logos, ['https://cdn.example.com/logo.png', 'https://cdn.example.com/venue.png']);
});

test('HappyPix branding always exists and organization branding layers on top (#62–#66)', () => {
  const branding = buildBranding(
    { name: 'Sunset Weddings', logoUrl: 'https://cdn.example.com/sunset.png' },
    { branding: { logos: ['https://cdn.example.com/sunset.png', 'https://cdn.example.com/grand.png'], tagline: 'Together' } },
  );
  assert.equal(branding.platform.alwaysVisible, true);
  assert.equal(branding.organization.logo, 'https://cdn.example.com/sunset.png');
  // The event logo that duplicates the org logo is dropped.
  assert.deepEqual(branding.event.logos, ['https://cdn.example.com/grand.png']);
  assert.equal(branding.event.tagline, 'Together');

  // Fallback when nothing is configured (#66).
  const bare = buildBranding({ name: 'No Branding Co' });
  assert.equal(bare.organization.logo, null);
  assert.equal(bare.fallback, branding.fallback);
});

test('layout prices follow event → org defaults → platform suggested (#46, #50)', () => {
  const suggested = suggestedPriceMap();
  assert.ok(Object.keys(suggested).length > 20);

  const orgOnly = resolveLayoutPrices({ orgPrices: { '46:3': 99 } });
  assert.equal(orgOnly['46:3'], 99);
  assert.equal(orgOnly['57:3'], suggested['57:3'], 'unset keys keep the suggested price');

  const withEvent = resolveLayoutPrices({ eventPrices: { '46:3': 150 }, orgPrices: { '46:3': 99 } });
  assert.equal(withEvent['46:3'], 150, 'event price wins');
});

test('layout price validation rejects unknown iterations', () => {
  assert.deepEqual(validateLayoutPrices({ '46:3': 80 }), { '46:3': 80 });
  assert.throws(() => validateLayoutPrices({ 'nope:9': 10 }), /Unknown layout iteration/);
  assert.throws(() => validateLayoutPrices({ '46:3': -5 }), /between 0 and 100000/);
});

test('layout meta keeps print-true geometry and correct orientation (#89–#95)', () => {
  const portrait = layoutMeta('46-v3');
  assert.equal(portrait.orientation, 'portrait');
  assert.equal(portrait.slots, 3);
  assert.ok(portrait.canvas.height > portrait.canvas.width);
  assert.equal(portrait.priceKey, '46:3');

  const landscape = layoutMeta('46-h3');
  assert.equal(landscape.orientation, 'landscape');
  assert.ok(landscape.canvas.width > landscape.canvas.height);
});

test('booth settings use the organization configuration, never hard-coded 90s (#70, #71)', () => {
  const settings = buildSettings({
    organization: { name: 'Sunset Weddings', logoUrl: 'x.png' },
    defaults: {
      boothTimeoutSec: 45, payoutMode: 'upi', upiId: 'sunset@okaxis',
      paymentDisplayName: 'Sunset Weddings', maximumPrints: 4,
      layoutPrices: { '57:3': 250 },
    },
    event: { layoutPrices: { '57:3': 300 } },
  });
  assert.equal(settings.boothTimeoutSec, 45);
  assert.equal(settings.payoutMode, 'upi');
  assert.equal(settings.upiId, 'sunset@okaxis');
  assert.equal(settings.paymentDisplayName, 'Sunset Weddings');
  assert.equal(settings.maximumPrints, 4);
  assert.equal(settings.layoutPrices['57:3'], 300);
  assert.equal(settings.organizationName, 'Sunset Weddings');
  // Print options never exceed the configured print limit.
  assert.ok(settings.printOptions.every((value) => value <= 4));

  // With no configuration at all the platform default applies.
  const fallback = buildSettings({ organization: { name: 'New Org' } });
  assert.equal(fallback.boothTimeoutSec, 60);
  assert.equal(fallback.payoutMode, 'wallet');
});

test('templates map to booth shape with slots for the layout', () => {
  const [template] = mapTemplates([{ _id: 't1', name: 'Royal', layoutId: '57-v3', active: true }]);
  assert.equal(template.layout.slots, 3);
  assert.equal(template.layout.photoSlots.length, 3);
  assert.equal(template.layout.orientation, 'portrait');
});

test('revision is stable for identical content and changes with configuration (#72, #79)', () => {
  const a = computeRevision({ event: { id: 'e1' }, settings: { boothTimeoutSec: 45 } });
  const b = computeRevision({ event: { id: 'e1' }, settings: { boothTimeoutSec: 45 } });
  const c = computeRevision({ event: { id: 'e1' }, settings: { boothTimeoutSec: 90 } });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('heartbeat merges partial hardware payloads (#76–#78)', () => {
  const device = {
    telemetry: { prints: 10, shutters: 20, batteryPct: 88 },
    connections: { camera: true, printer: true, kioskScreen: true },
  };
  // Only the printer connection changed — nothing else is overwritten.
  const merged = mergeHardware(device, { printerConnected: false });
  assert.equal(merged.connections.printer, false);
  assert.equal(merged.connections.camera, true);
  assert.equal(merged.telemetry.prints, 10);
  assert.equal(merged.telemetry.batteryPct, 88);
  assert.equal(merged.changed.connections, true);
  assert.equal(merged.changed.telemetry, false);
});

test('booth states separate every failure mode (#80, #81)', () => {
  assert.equal(boothStateFor({ device: { status: 'active' }, organization: { status: 'active' } }), BOOTH_STATES.ACTIVE);
  assert.equal(boothStateFor({ device: { status: 'active' }, organization: { status: 'suspended' } }), BOOTH_STATES.SUSPENDED);
  assert.equal(boothStateFor({ device: { status: 'active' }, organization: { status: 'banned' } }), BOOTH_STATES.BANNED);
  assert.equal(boothStateFor({ device: { status: 'blocked' }, organization: { status: 'active' } }), BOOTH_STATES.DEVICE_BLOCKED);
  assert.equal(boothStateFor({ device: null, organization: { status: 'active' } }), BOOTH_STATES.DEVICE_DELETED);
  assert.equal(boothStateFor({ device: { status: 'active' }, organization: null }), BOOTH_STATES.UNPAIRED);

  assert.equal(boothCanOperate(BOOTH_STATES.ACTIVE), true);
  for (const state of [BOOTH_STATES.SUSPENDED, BOOTH_STATES.BANNED, BOOTH_STATES.DEVICE_DELETED, BOOTH_STATES.DEVICE_BLOCKED, BOOTH_STATES.UNPAIRED]) {
    assert.equal(boothCanOperate(state), false, `${state} must stop the booth`);
  }
});
