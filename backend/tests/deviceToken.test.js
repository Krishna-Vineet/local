/**
 * Regression guard for the device-token schema.
 *
 * Every device write (pairing, re-pair, registration, session completion) used
 * to carry a `deviceToken` path that a pre-save hook emptied on purpose. On any
 * build where that path was still `required`, the whole write failed:
 *
 *   Device validation failed: deviceToken: Path `deviceToken` is required.
 *
 * That surfaced as HTTP 500 `INTERNAL` on the CRM's “assign event” screen, which
 * is nowhere near the actual write. The fix was structural — the path no longer
 * exists — and these assertions keep it that way.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import Device from '../models/Device.js';

test('Device — plaintext token is not a schema path', () => {
  assert.equal(
    Device.schema.path('deviceToken'),
    undefined,
    'deviceToken must not be a schema path: a required flag on it breaks every device write'
  );
  assert.ok(Device.schema.path('deviceTokenHash'), 'the hash column must exist');
});

test('Device — createToken() returns a raw token and its matching hash', () => {
  const { raw, hash } = Device.createToken();
  assert.match(raw, /^hp_dev_[0-9a-f-]{36}$/);
  assert.equal(hash, Device.hashToken(raw));
  assert.equal(hash.length, 64);
  assert.notEqual(Device.createToken().hash, hash, 'tokens must not repeat');
});

test('Device — a document built like the routes validates without a token path', async () => {
  const { hash } = Device.createToken();
  const device = new Device({
    organizationId: '507f1f77bcf86cd799439011',
    deviceUuid: 'uuid-regression',
    deviceName: 'Booth-01',
    deviceTokenHash: hash,
  });

  await device.validate();

  const plain = device.toObject();
  assert.equal(plain.deviceToken, undefined, 'no plaintext token may be persisted');
  assert.equal(plain.deviceTokenHash, hash);
});

test('Device — a stray assignment to deviceToken cannot fail validation', async () => {
  const { raw, hash } = Device.createToken();
  const device = new Device({
    organizationId: '507f1f77bcf86cd799439011',
    deviceUuid: 'uuid-regression-2',
    deviceName: 'Booth-02',
    deviceTokenHash: hash,
  });

  // Older call sites did exactly this before `save()`.
  device.deviceToken = raw;

  await device.validate();
  // Not a schema path, so it is neither validated nor written.
  assert.equal(device.toObject().deviceToken, undefined);
});
