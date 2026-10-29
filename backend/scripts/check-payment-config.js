import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';

// Fix Windows Node DNS SRV ECONNREFUSED on MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {}

import OrganizationDefaults from '../models/OrganizationDefaults.js';
import Event from '../models/Event.js';
import Payment from '../models/Payment.js';
import Organization from '../models/Organization.js';

async function check() {
  console.log('\n======================================================');
  console.log('🔍 HAPPYPIX PAYMENT & UPI CONFIGURATION INSPECTOR');
  console.log('======================================================\n');

  console.log('📁 Backend .env Keys:');
  console.log('  RAZORPAY_KEY_ID:   ', process.env.RAZORPAY_KEY_ID || '(not set)');
  console.log('  CASHFREE_APP_ID:   ', process.env.CASHFREE_APP_ID || '(not set)');
  console.log('  CASHFREE_ENV:      ', process.env.CASHFREE_ENV || 'production');
  console.log('  PLATFORM_FALLBACK_UPI:', process.env.PLATFORM_FALLBACK_UPI || '(not set)');
  console.log('');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB\n');

  // 1. Organization Defaults
  const allDefaults = await OrganizationDefaults.find({}).lean();
  console.log('🏢 Organization Defaults in DB (' + allDefaults.length + ' found):');
  for (const d of allDefaults) {
    const org = await Organization.findById(d.organizationId).lean();
    console.log(`\n  [Org ID: ${d.organizationId}] (${org?.name || 'Unknown'})`);
    console.log(`    • Direct UPI ID (upiId):         ${d.upiId ? `👉 "${d.upiId}"` : '(none)'}`);
    console.log(`    • Payment Display Name:           ${d.paymentDisplayName ? `"${d.paymentDisplayName}"` : '(default)'}`);
    console.log(`    • Payout Mode:                    ${d.payoutMode || 'wallet'}`);
    console.log(`    • Gateway Priority:               ${d.gatewayPriority || 'razorpay'}`);
    console.log(`    • Razorpay Key ID:                ${d.razorpayKeyId || '(uses .env)'}`);
    console.log(`    • Razorpay Environment:           ${d.razorpayEnv || 'production'}`);
    console.log(`    • Cashfree App ID:                ${d.cashfreeAppId || '(uses .env)'}`);
    console.log(`    • Cashfree Environment:           ${d.cashfreeEnv || 'production'}`);
  }

  // 2. Events with UPI / Gateway overrides
  const events = await Event.find({}).sort({ updatedAt: -1 }).limit(5).lean();
  console.log('\n📅 Recent Events (' + events.length + ' checked):');
  for (const ev of events) {
    console.log(`  • [${ev._id}] "${ev.name}"`);
    console.log(`      upiId:             ${ev.upiId || '(none)'}`);
    console.log(`      razorpayKeyId:     ${ev.razorpayKeyId || '(uses org defaults)'}`);
    console.log(`      cashfreeAppId:     ${ev.cashfreeAppId || '(uses org defaults)'}`);
    console.log(`      gatewayPriority:   ${ev.gatewayPriority || '(uses org defaults)'}`);
  }

  // 3. Last 5 Payments
  const payments = await Payment.find({}).sort({ createdAt: -1 }).limit(5).lean();
  console.log('\n💳 Last 5 Booth Payments Generated:');
  for (const p of payments) {
    console.log(`  • [${p._id}] ₹${p.amount} | Status: ${p.status.toUpperCase()} | Gateway: ${p.gateway} | Settlement: ${p.settlement} | Date: ${p.createdAt ? p.createdAt.toISOString() : 'N/A'}`);
    if (p.razorpayOrderId) console.log(`      razorpayOrderId: ${p.razorpayOrderId}`);
    if (p.cashfreeOrderId) console.log(`      cashfreeOrderId: ${p.cashfreeOrderId}`);
    if (p.paymentLinkUrl)  console.log(`      paymentLinkUrl:  ${p.paymentLinkUrl}`);
  }

  console.log('\n======================================================\n');
  await mongoose.disconnect();
}

check().catch(err => {
  console.error('❌ Error inspecting payment config:', err);
  process.exit(1);
});
