import crypto from 'crypto';

// ─── AES-256-GCM Gateway Secret Encryption ──────────────────────────
// Key: ENCRYPTION_KEY, else scrypt-derived from JWT_SECRET. There is NO
// hardcoded fallback key — a published constant would let anyone decrypt
// every stored gateway secret from a database dump.
let cachedKey = null;
function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY (or JWT_SECRET) must be set to encrypt/decrypt stored secrets.');
  }
  if (!cachedKey) {
    cachedKey = crypto.scryptSync(secret, 'happypix-secret-vault-v1', 32);
  }
  return cachedKey;
}

/**
 * Encrypt a sensitive secret string (e.g., Razorpay/Cashfree secret) using AES-256-GCM.
 * Idempotent: returns as-is if already encrypted.
 */
export function encryptSecret(plainText) {
  if (!plainText || typeof plainText !== 'string') return plainText;
  if (plainText.startsWith('enc:v1:')) return plainText; // already encrypted

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a stored secret string.
 * Backward compatible: if the secret is legacy plain text, returns it directly.
 */
export function decryptSecret(cipherText) {
  if (!cipherText || typeof cipherText !== 'string') return cipherText;
  if (!cipherText.startsWith('enc:v1:')) return cipherText; // legacy plain text fallback

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 5) return cipherText;
    const [, , ivHex, tagHex, dataHex] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encryptedData = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('⚠️ Failed to decrypt secret:', err.message);
    return cipherText;
  }
}

// ─── SHA-256 Device Token Hashing ──────────────────────────────────
/**
 * Hashes an opaque device token for secure storage in MongoDB.
 */
export function hashDeviceToken(token) {
  if (!token || typeof token !== 'string') return null;
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}
