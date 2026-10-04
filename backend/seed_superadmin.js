/**
 * seed_superadmin.js
 * 
 * Creates the HappyPix Super Admin account.
 * Run once: node seed_superadmin.js
 * 
 * This upgrades any existing 'admin' user to 'superadmin',
 * or creates a new superadmin if none exists.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

// Workaround for Windows DNS / ISP issues blocking MongoDB Atlas
dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

// Inline User model to avoid import issues
import User from './models/User.js';

if (!process.env.SUPERADMIN_EMAIL || !process.env.SUPERADMIN_PASSWORD) {
  console.error('❌ SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set in .env');
  process.exit(1);
}

const SUPERADMIN = {
  name:     'HappyPix Admin',
  email:    process.env.SUPERADMIN_EMAIL,
  password: process.env.SUPERADMIN_PASSWORD,
  role:     'OWNER',
  organizationId: null, // superadmin has no org restriction
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected to MongoDB');

    // Check if superadmin already exists
    let existing = await User.findOne({ role: { $in: ['OWNER', 'superadmin', 'admin'] } });

    if (existing) {
      // Upgrade existing admin to superadmin
      existing.role           = 'OWNER';
      existing.organizationId = null;
      await existing.save();
      console.log(`✅ Upgraded existing user "${existing.email}" to superadmin`);
    } else {
      // Create new superadmin
      const user = new User(SUPERADMIN);
      await user.save();
      console.log(`✅ Created superadmin: ${SUPERADMIN.email}`);
      console.log(`   Password: ${SUPERADMIN.password}`);
      console.log(`   ⚠️  Change this password immediately after first login!`);
    }

    console.log('\n🚀 Superadmin seeding complete!');
    console.log('   Login at: https://happypix-j9xd.vercel.app/login');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
