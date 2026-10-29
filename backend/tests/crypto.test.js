import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests';

const { encryptSecret, decryptSecret, hashDeviceToken } = await import('../utils/crypto.js');

test('gateway secrets encrypt at rest and decrypt back', () => {
  const secret = 'rzp-secret-value-123';
  const stored = encryptSecret(secret);
  assert.match(stored, /^enc:v1:/);
  assert.ok(!stored.includes(secret), 'ciphertext must not contain the plaintext');
  assert.equal(decryptSecret(stored), secret);
});

test('encryption is idempotent and legacy plaintext passes through', () => {
  const stored = encryptSecret('abc');
  assert.equal(encryptSecret(stored), stored, 'never double-encrypt');
  assert.equal(decryptSecret('plain-legacy-secret'), 'plain-legacy-secret');
  assert.equal(encryptSecret(''), '');
  assert.equal(decryptSecret(null), null);
});

test('device tokens hash deterministically (sha256 hex)', () => {
  const hash = hashDeviceToken('hp_dev_token');
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, hashDeviceToken('hp_dev_token'));
  assert.notEqual(hash, hashDeviceToken('hp_dev_other'));
});
