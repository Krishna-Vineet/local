/**
 * heals legacy device rows so no `deviceToken` plaintext remains.
 *
 * Every device write used to carry a `deviceToken` path that a pre-save hook
 * deliberately emptied. On any build where that path was still `required`, the
 * write failed outright:
 *
 *   Device validation failed: deviceToken: Path `deviceToken` is required.
 *
 * The model no longer declares the path at all (see models/Device.js), but rows
 * written before the hashing change still hold the plaintext. This script
 * converts them in place, so a later `required` flag (or any stale build) has
 * nothing to trip over.
 *
 * Two legacy shapes are handled:
 *   · `deviceToken` holds the raw token           → hash it
 *   · `deviceToken` holds the token's SHA-256     → it *is* the hash
 *
 * Usage (from backend/):
 *   node scripts/heal-device-tokens.js --dry-run
 *   node scripts/heal-device-tokens.js
 *
 * Uses the raw driver throughout: Mongoose would strip `deviceToken` from the
 * filter, because it is no longer a schema path.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { hashDeviceToken } from '../utils/crypto.js';
const dryRun = process.argv.includes('--dry-run');
const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
const HASHED = /^[a-f0-9]{64}$/i;
if (!uri) {
  console.error('✗ No database URI. Set MONGO_URI (or MONGODB_URI / DATABASE_URL) and retry.');
  process.exit(1);
}
const describe = (value) => {
  if (typeof value !== 'string' || value.length === 0) return 'empty';
  if (value.startsWith('hp_dev_')) return `plaintext (${value.slice(0, 13)}…)`;
  if (HASHED.test(value)) return 'sha256';
  return `unrecognised (${value.slice(0, 6)}…)`;
};
async function main() {
  await mongoose.connect(uri);
  const collection = mongoose.connection.collection('devices');
  const rows = await collection.find({ deviceToken: { $type: 'string' } }).toArray();
  console.log(`Found ${rows.length} device row(s) still holding a plaintext token.`);
  if (rows.length === 0) {
    await mongoose.disconnect();
    return;
  }
  let healed = 0;
  let skipped = 0;
  for (const row of rows) {
    const value = row.deviceToken;
    const shape = describe(value);
    const hash = HASHED.test(value) ? value.toLowerCase() : hashDeviceToken(value);
    if (!hash) {
      console.log(`  · ${row.deviceUuid} — ${shape}, cannot derive a hash, left alone`);
      skipped += 1;
      continue;
    }
    if (row.deviceTokenHash && row.deviceTokenHash !== hash) {
      // The row already authenticates with a different hash; overwriting it
      // would invalidate a working booth. Just drop the stale plaintext.
      console.log(`  · ${row.deviceUuid} — ${shape}, keeps its existing hash`);
    } else {
      console.log(`  · ${row.deviceUuid} — ${shape} → hash ${hash.slice(0, 12)}…`);
    }
    if (!dryRun) {
      await collection.updateOne(
        { _id: row._id },
        { $set: { deviceTokenHash: hash }, $unset: { deviceToken: '' } },
      );
    }
    healed += 1;
  }
  // Rows that can never authenticate: no hash and no plaintext to derive one
  // from. These booths must be re-paired from the app.
  const stranded = await collection
    .find({ deviceTokenHash: null, deviceToken: { $exists: false } })
    .project({ deviceUuid: 1, deviceName: 1, status: 1, lastSeenAt: 1 })
    .toArray();
  console.log('');
  console.log(`${dryRun ? 'Would heal' : 'Healed'} ${healed} row(s); ${skipped} skipped.`);
  if (stranded.length) {
    console.log(`${stranded.length} device(s) have no token at all and must re-pair:`);
    for (const row of stranded) {
      console.log(`  · ${row.deviceUuid} — ${row.deviceName} (${row.status}) last seen ${row.lastSeenAt || 'never'}`);
    }
  }
  if (dryRun) console.log('\n(dry run — nothing was written)');
  await mongoose.disconnect();
}
main().catch(async (err) => {
  console.error('✗ Heal failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

