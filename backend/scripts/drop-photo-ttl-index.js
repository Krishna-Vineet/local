// ============================================================
// One-time migration: drop the old 24h TTL index on photos.createdAt.
//
// Photo.js used to declare `createdAt: { expires: 86400 }`, which made
// MongoDB delete every booth photo record after 24 hours — the org
// gallery emptied itself even though the S3 files still existed.
// Removing `expires` from the schema does NOT remove the index that
// Mongo already created, so run this once per database:
//
//   node scripts/drop-photo-ttl-index.js
//
// Safe to re-run: it only drops an index that still has a TTL.
// ============================================================

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const collection = mongoose.connection.collection('photos');
  const indexes = await collection.indexes();
  const ttl = indexes.find(
    (idx) => idx.key && idx.key.createdAt === 1 && typeof idx.expireAfterSeconds === 'number',
  );
  if (!ttl) {
    console.log('✅ No TTL index on photos.createdAt — gallery records are already permanent.');
  } else {
    await collection.dropIndex(ttl.name);
    console.log(`✅ Dropped TTL index "${ttl.name}" (was expiring photos after ${ttl.expireAfterSeconds}s).`);
    console.log('   Existing S3 files were never deleted — only the Photo records were.');
  }
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
});
