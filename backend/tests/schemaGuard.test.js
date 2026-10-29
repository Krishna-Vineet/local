/**
 * The boot-time schema guard has to work on a model file we do not control —
 * that is the whole point of it.
 *
 * The production failure was: a `pre('save')` hook hashes the raw token and
 * clears the path, Mongoose's built-in pre-save then runs validation, and the
 * cleared path fails a `required` check:
 *
 *   Device validation failed: deviceToken: Path `deviceToken` is required.
 *
 * These tests reproduce that exact ordering against a deliberately broken
 * legacy schema, then prove `guardDeviceToken()` makes the write pass while
 * still hashing a raw token that an older caller assigns.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { guardDeviceToken, describeDeviceTokenPath } from '../services/schemaGuards.js';
import { hashDeviceToken } from '../utils/crypto.js';

/** Registers a model with the old, broken `deviceToken` declaration. */
function compileLegacyDeviceModel(modelName) {
  const schema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    deviceUuid: { type: String, required: true, unique: true },
    deviceName: { type: String, required: true },
    deviceToken: { type: String, required: true, default: null },
    deviceTokenHash: { type: String, default: null },
  });
  schema.pre('save', function legacyHash() {
    if (this.isModified('deviceToken') && typeof this.deviceToken === 'string') {
      this.deviceTokenHash = hashDeviceToken(this.deviceToken);
      this.deviceToken = undefined;
    }
  });
  return mongoose.model(modelName, schema);
}

/** Runs the model's pre-save hooks in order, exactly as `save()` would. */
async function runPreSaveHooks(model, doc) {
  const hooks = model.schema.s.hooks._pres.get('save') || [];
  for (const hook of hooks) await hook.fn.call(doc);
}

function makeDevice(Model) {
  return new Model({
    organizationId: '507f1f77bcf86cd799439011',
    deviceUuid: `uuid-${Math.random().toString(16).slice(2)}`,
    deviceName: 'Booth-01',
    deviceToken: 'hp_dev_plaintext',
  });
}

test('a required plaintext deviceToken really does break the write', async () => {
  const Model = compileLegacyDeviceModel('DeviceLegacyBroken');
  try {
    const device = makeDevice(Model);
    await runPreSaveHooks(Model, device);
    await assert.rejects(device.validate(), /deviceToken.*is required/i);
  } finally {
    mongoose.deleteModel('DeviceLegacyBroken');
  }
});

test('guardDeviceToken removes the path, so the same write passes', async () => {
  const Model = compileLegacyDeviceModel('DeviceLegacyGuarded');
  try {
    const report = guardDeviceToken('DeviceLegacyGuarded');
    assert.equal(report.path, 'required');
    assert.equal(report.action, 'required-dropped');
    assert.equal(Model.schema.path('deviceToken'), undefined, 'path must be gone');

    const device = makeDevice(Model);
    await runPreSaveHooks(Model, device);
    await device.validate();

    assert.equal(device.toObject().deviceToken, undefined);
    assert.equal(device.deviceTokenHash, hashDeviceToken('hp_dev_plaintext'));
  } finally {
    mongoose.deleteModel('DeviceLegacyGuarded');
  }
});

test('the guard hashes a raw token assigned by an old caller', async () => {
  const Model = compileLegacyDeviceModel('DeviceLegacyHash');
  try {
    guardDeviceToken('DeviceLegacyHash');
    const device = new Model({
      organizationId: '507f1f77bcf86cd799439011',
      deviceUuid: 'uuid-guard-hash',
      deviceName: 'Booth-02',
      deviceToken: 'hp_dev_other',
    });
    await runPreSaveHooks(Model, device);
    assert.equal(device.deviceTokenHash, hashDeviceToken('hp_dev_other'));
    assert.equal(device.deviceToken, undefined);
  } finally {
    mongoose.deleteModel('DeviceLegacyHash');
  }
});

test('describeDeviceTokenPath reports the live schema', async () => {
  const Model = compileLegacyDeviceModel('DeviceLegacyDescribe');
  try {
    assert.equal(describeDeviceTokenPath('DeviceLegacyDescribe').plaintextPath, 'required');
    guardDeviceToken('DeviceLegacyDescribe');
    const after = describeDeviceTokenPath('DeviceLegacyDescribe');
    assert.equal(after.plaintextPath, 'absent');
    assert.equal(after.hashedPath, true);
  } finally {
    mongoose.deleteModel('DeviceLegacyDescribe');
  }
});

test('the real model ships without the plaintext path', async () => {
  const { default: Device } = await import('../models/Device.js');
  const report = guardDeviceToken('Device');
  assert.equal(report.path, 'absent', 'models/Device.js must not declare deviceToken');
  assert.equal(report.action, 'none');
  assert.ok(Device.schema.path('deviceTokenHash'));
});
