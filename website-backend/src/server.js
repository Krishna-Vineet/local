// ============================================================
// HappyPix display-website backend (happypix.in)
//
// A SEPARATE service from backend/ (the booth/CRM API), by design:
//   • public, unauthenticated surface (pricing, checkout, guest
//     downloads, leads) with its own rate limits + CORS list
//   • SAME MongoDB database (MONGODB_URI) — plans, discounts,
//     organizations, users, subscriptions and guest downloads are
//     shared with the CRM + booth backends. See src/models.js.
//
// Run:  npm start        (PORT default 5001)
// ============================================================

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dns from 'dns';
import dotenv from 'dotenv';

dotenv.config();
if (process.platform === 'win32' || process.env.ENABLE_DNS_OVERRIDE === 'true') {
  dns.setServers(['8.8.8.8', '1.1.1.1']); // same SRV fix as backend/server.js
}

import routes from './routes.js';

// Reload trigger: loaded .env configuration, phone anti-abuse & gateway error handling
const app = express();
const PORT = process.env.PORT || 5001;

const REQUIRED_ENV = ['MONGODB_URI', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.warn(`⚠️  Missing env: ${missing.join(', ')} — checkout will report payments as not configured.`);
} else {
  console.log(`💳 Razorpay mode: ${process.env.RAZORPAY_KEY_ID.startsWith('rzp_live') ? '🟢 LIVE' : '🟡 TEST'}`);
}

let allowedOrigins = [
  'https://happypix.in',
  'https://www.happypix.in',
  'https://happypix.com.au',
  'https://www.happypix.com.au',
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5174', 'http://localhost:5173', 'http://localhost:4174');
}
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins = [...allowedOrigins, ...process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)];
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // curl / server-to-server
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin not allowed: ${origin}`), false);
  },
  credentials: false, // this API is token-less; no cookies involved
}));

// ─── Security Headers Middleware ───────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => res.send('📸 HappyPix website backend is running.'));

// Serverless-safe cached connection (same pattern as backend/server.js):
// awaited before every request so no route runs on a buffered connection.
let connected = false;
async function connectDB() {
  if (connected && mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  connected = true;
  console.log('✅ Connected to MongoDB (shared HappyPix database)');
}
app.use(async (req, res, next) => {
  try {
    await connectDB();
    return next();
  } catch (error) {
    return res.status(503).json({ error: 'Database unavailable. Please try again.' });
  }
});

app.use('/api', routes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error.message);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

export default app;

if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HappyPix website backend running on http://0.0.0.0:${PORT}`);
  });
}
