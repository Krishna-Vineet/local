/**
 * seed_plans.js
 *
 * One-time (idempotent) bootstrap for the platform:
 *   1. Upserts the subscription plan catalogue (SubscriptionPlan)
 *      from lib/constants.js DEFAULT_PLANS.
 *   2. Ensures the platform settings singleton exists (gallery policy).
 *   3. Ensures at least one OWNER account exists (the platform superadmin).
 *
 * Run:  node seed_plans.js
 * Env:  MONGODB_URI, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *       (SUPERADMIN_* are only needed when no OWNER exists yet)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

// Workaround for Windows DNS / ISP issues blocking MongoDB Atlas
dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

import SubscriptionPlan from './models/SubscriptionPlan.js';
import PlatformSetting, { getPlatformSettings } from './models/PlatformSetting.js';
import User from './models/User.js';
import { DEFAULT_PLANS } from './lib/constants.js';

const PLAN_DESCRIPTIONS = {
  trial: 'Free evaluation — one booth, one event.',
  starter: 'Single-booth starter for small gatherings.',
  basic: 'Up to three booths for growing studios.',
  professional: 'Multi-booth coverage for professional event teams.',
  business: 'High-volume operations with dedicated support.',
  custom: 'Tailored limits and pricing — talk to sales.',
  enterprise: 'Unlimited booths and events, SLA-backed.',
};

const DURATION_LABELS = (months) => {
  if (!months) return 'Until trial ends';
  return `${months} month${months === 1 ? '' : 's'}`;
};

async function seedPlans() {
  let created = 0;
  let updated = 0;

  for (const def of Object.values(DEFAULT_PLANS)) {
    const doc = {
      key: def.key,
      name: def.name,
      description: PLAN_DESCRIPTIONS[def.key] || '',
      price: def.price,
      durationMonths: def.durationMonths,
      durationLabel: DURATION_LABELS(def.durationMonths),
      devices: def.devices,
      events: def.events,
      active: true,
    };

    const existing = await SubscriptionPlan.findOne({ key: def.key });
    if (!existing) {
      await SubscriptionPlan.create(doc);
      created += 1;
    } else {
      // Keep the catalogue in sync with the contract; price stays editable
      // in the CRM, so only structural fields are refreshed here.
      existing.name = doc.name;
      existing.description = doc.description;
      existing.durationMonths = doc.durationMonths;
      existing.durationLabel = doc.durationLabel;
      existing.devices = doc.devices;
      existing.events = doc.events;
      if (existing.active === undefined) existing.active = true;
      await existing.save();
      updated += 1;
    }
  }

  console.log(`🗂  Plans: ${created} created, ${updated} refreshed.`);
}

async function ensurePlatformSettings() {
  await getPlatformSettings();
  const doc = await PlatformSetting.findOne({ key: 'platform' });
  console.log(`🖼  Platform settings present (galleryEnabled=${doc?.galleryEnabled}, requireGuestConsent=${doc?.requireGuestConsent}).`);
}

async function ensureOwner() {
  const owner = await User.findOne({ role: 'OWNER' });
  if (owner) {
    console.log(`👤 Owner exists: ${owner.email}`);
    return;
  }

  if (!process.env.SUPERADMIN_EMAIL || !process.env.SUPERADMIN_PASSWORD) {
    console.warn('⚠️  No OWNER account found and SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD are not set.');
    console.warn('   The CRM platform console cannot be used until an OWNER is created.');
    return;
  }

  await User.create({
    name: 'HappyPix Admin',
    email: process.env.SUPERADMIN_EMAIL.toLowerCase().trim(),
    password: process.env.SUPERADMIN_PASSWORD,
    role: 'OWNER',
    status: 'active',
    organizationId: null,
  });
  console.log(`👤 Owner created: ${process.env.SUPERADMIN_EMAIL}`);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI must be set in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log('✅ Connected to MongoDB');

  await seedPlans();
  await ensurePlatformSettings();
  await ensureOwner();

  await mongoose.disconnect();
  console.log('✅ Seed complete.');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
