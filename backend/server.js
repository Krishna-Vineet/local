import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables immediately
dotenv.config();

import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { authenticate } from './middleware/auth.js';
import { authenticateDevice } from './middleware/deviceAuth.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import path from 'path';
import dns from 'dns';

// Fix for MongoDB SRV resolution issue on certain networks (e.g. Windows local ISP)
if (process.platform === 'win32' || process.env.ENABLE_DNS_OVERRIDE === 'true') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}


// Route imports
// Issue #114: legacy ./routes/authRoutes.js is deprecated — /api/auth is served
// by routes/crm/auth.js so only ONE role matrix exists in the backend.
import eventRoutes        from './routes/eventRoutes.js';
import couponRoutes       from './routes/couponRoutes.js';
import settingRoutes      from './routes/settingRoutes.js';
import paymentRoutes      from './routes/paymentRoutes.js';
import supportRoutes      from './routes/supportRoutes.js';
import deviceRoutes       from './routes/deviceRoutes.js';
import boothRoutes        from './routes/boothRoutes.js';

import photoShareRoutes   from './routes/photoShareRoutes.js';
import downloadRoutes     from './routes/downloadRoutes.js';

// CRM v2 Route imports
import crmAuthRoutes      from './routes/crm/auth.js';
import crmPlatformRoutes  from './routes/crm/platform.js';
import crmOrgRoutes       from './routes/crm/org.js';
import { ensurePlanCatalog } from './routes/crm/platform.js';

// Services
import cronService        from './services/CronService.js';

// Model imports
import Photo from './models/Photo.js';
import WebsiteLead from './models/WebsiteLead.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Startup ENV Validation ───────────────────────────────
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
  // Fail closed: booting without a JWT secret would silently sign tokens
  // with a guessable fallback — refuse to start instead.
  console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
  console.error('   → Refusing to start. See .env.example for reference.');
  throw new Error(`Missing required environment variables: ${missingEnv.join(', ')}`);
} else {
  const rzpMode = process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live') ? '🟢 LIVE' : '🟡 TEST';
  console.log(`💳 Razorpay mode: ${rzpMode} (key: ${process.env.RAZORPAY_KEY_ID?.slice(0, 14)}...)`);
}

// Middleware
// Build allowed origins dynamically
const staticAllowedOrigins = [
  'https://happypix.in',
  'https://www.happypix.in',
  'https://crm.happypix.in',
  'https://booth.happypix.in',
  'https://happypix.vercel.app',
  'https://happypixcrm.vercel.app',
  'https://happypix-v2-backend.vercel.app',
];

const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const devAllowedOrigins = process.env.NODE_ENV !== 'production'
  ? ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173']
  : [];

const allowedOriginsSet = new Set([...staticAllowedOrigins, ...envAllowedOrigins, ...devAllowedOrigins]);

// Safe origin matcher supports explicit set, localhost in dev, and genuine HappyPix Vercel deployments
function isOriginAllowed(origin) {
  if (!origin) return true; // Mobile apps, Electron, kiosk curl, or server-to-server
  if (allowedOriginsSet.has(origin)) return true;
  // Match genuine HappyPix Vercel deployments strictly (happypix, happypixcrm, happypixbackend)
  if (/^https:\/\/(happypix|happypixcrm|happypixbackend)[a-z0-9-]*\.vercel\.app$/.test(origin)) {
    return true;
  }
  // Allow localhost in non-production environments
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
}

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

// ─── Global Baseline Rate Limiter ──────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200, // Generous baseline for polling booths and CRM
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP. Please try again later.' },
});
app.use(globalLimiter);

app.use(cors({
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    // Reject cleanly without throwing a 500 server exception
    return callback(null, false);
  },
  credentials: true,
}));

// Strict Origin check: reject unauthorized cross-origin browser requests with 403 Forbidden
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !isOriginAllowed(origin)) {
    return res.status(403).json({
      error: 'Cross-origin request blocked by security policy.',
      code: 'CORS_FORBIDDEN',
    });
  }
  next();
});

// Capture rawBody buffer for payment webhook HMAC verification (50mb limit for high-res photo payloads)
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(cookieParser()); // Parse HttpOnly cookies for JWT auth

// Serve static uploaded assets (templates, cutouts, decorations)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Root Route
app.get('/', (req, res) => {
  res.send('🚀 HappyPix Server is running!');
});

// ─── MongoDB Connection (Serverless-safe) ─────────────────
// On Vercel, each request is a fresh invocation. We cache the
// connection so it is reused across warm invocations and we
// AWAIT it before every request so no route runs against a
// buffered (not-yet-connected) Mongoose instance.
let _mongoConnected = false;

const connectDB = async () => {
  if (_mongoConnected && mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    _mongoConnected = true;
    console.log('✅ Connected to MongoDB');
    
    // Ensure photos in MongoDB are permanent (drop legacy TTL index if it exists)
    if (!global._photoTtlChecked) {
      global._photoTtlChecked = true;
      try {
        const photosCol = mongoose.connection.collection('photos');
        photosCol.indexes().then(async (indexes) => {
          const ttl = indexes.find((idx) => idx.key && idx.key.createdAt === 1 && typeof idx.expireAfterSeconds === 'number');
          if (ttl) {
            await photosCol.dropIndex(ttl.name);
            console.log(`✅ Dropped legacy TTL index "${ttl.name}" on photos — gallery images are now permanent.`);
          }
        }).catch(() => {});
      } catch (err) {
        // Non-fatal
      }
    }

    // Start background services (ensuring they only start once)
    if (!global._cronStarted) {
      cronService.start();
      global._cronStarted = true;
    }

    // Issue #4/#5: make sure the six subscription plans exist so plan limits
    // always resolve from real data (idempotent, non-fatal on failure).
    if (!global._plansEnsured) {
      global._plansEnsured = true;
      ensurePlanCatalog()
        .then(() => console.log('✅ Subscription plan catalogue ready'))
        .catch((error) => console.warn('⚠️ Could not verify subscription plans:', error.message));
    }
  } catch (err) {
    _mongoConnected = false;
    console.error('❌ MongoDB connection error:', err.message);
    throw err;
  }
};

// Ensure DB is ready before any route runs
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ error: 'Database unavailable. Please try again.' });
  }
});

// --- ROUTES ---

// CRM v2 Namespaces
app.use('/api/auth',          crmAuthRoutes); // Replaces legacy authRoutes
app.use('/api/platform',      crmPlatformRoutes);
app.use('/api/org',           crmOrgRoutes);

// Legacy/Booth Client Namespaces
app.use('/api/events',        eventRoutes);
app.use('/api/coupons',       couponRoutes);
app.use('/api/settings',      settingRoutes);
app.use('/api/payments',      paymentRoutes);
app.use('/api/support',       supportRoutes);
app.use('/api/devices',       deviceRoutes);         // Legacy Device tracking + heartbeat
app.use('/api/booth',         boothRoutes);          // New React+Vite Booth App API

app.use('/api/share',         photoShareRoutes);
app.use('/api/downloads',     downloadRoutes);


// Public Website Leads endpoint (matches website-backend POST /api/leads so
// leads work whether the public website points to website-backend or backend).
const leadsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a few minutes.' },
});

app.post('/api/leads', leadsLimiter, async (req, res) => {
  try {
    const { name, email, phone = '', company = '', message = '', type = 'contact' } = req.body || {};
    if (!String(name || '').trim()) {
      return res.status(400).json({ error: 'Your name is required.' });
    }
    const cleanEmail = String(email || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    const lead = await WebsiteLead.create({
      name: String(name).trim(),
      email: cleanEmail,
      phone: String(phone || '').trim(),
      company: String(company || '').trim(),
      message: String(message || '').slice(0, 4000),
      type: ['demo', 'hardware', 'support'].includes(type) ? type : 'contact',
    });
    return res.status(201).json({
      received: true,
      id: String(lead._id),
      message: 'Thank you — the HappyPix team will get back within one business day.',
    });
  } catch (error) {
    console.error('leads failed:', error);
    return res.status(500).json({ error: 'Could not send your message. Please try again.' });
  }
});


// External / Vercel Cron Endpoint to expire trials and plans reliably on Serverless
app.all('/api/cron/check-expirations', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const cronHeader = req.headers['x-cron-secret'];

  // Fail closed: with no CRON_SECRET configured the endpoint stays shut
  // (it previously ran wide open in that case).
  if (!secret || (cronHeader !== secret && authHeader !== `Bearer ${secret}`)) {
    return res.status(401).json({ error: 'Unauthorized cron invocation' });
  }

  try {
    await cronService.checkExpirations();
    await cronService.cleanupLocalUploads(7);
    res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Note: Photo model is imported from models/Photo.js. S3 files are deleted by bucket lifecycle policy.

// AWS S3 Configuration
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer Storage (memoryStorage for direct S3 upload)
const storage = multer.memoryStorage();
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.test(file.originalname)) {
      return cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
    cb(null, true);
  },
});

// Logo Proxy — fetches private S3 logo using AWS SDK credentials to bypass AccessDenied.
// Authenticated, and restricted to OUR OWN bucket: this endpoint used to
// accept any bucket/region in the URL, which made it an unauthenticated
// oracle for reading arbitrary S3 objects with server credentials.
app.get('/api/proxy/logo', authenticate, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param required' });
  try {
    // Expected format: https://<bucket>.s3.<region>.amazonaws.com/<key>
    const urlObj = new URL(url);
    const key = decodeURIComponent(urlObj.pathname.replace(/^\//, '')); // remove leading slash

    const targetBucket = process.env.S3_BUCKET_NAME;
    const targetRegion = process.env.AWS_REGION;
    const hostMatch = urlObj.hostname.match(/^(.+?)\.s3\.(?:.+?\.)?amazonaws\.com/);
    if (!hostMatch || hostMatch[1] !== targetBucket) {
      return res.status(400).json({ error: 'Only HappyPix bucket assets can be proxied' });
    }

    console.log(`[Proxy] Fetching logo key: "${key}" from bucket "${targetBucket}" (${targetRegion})`);

    if (!key || !key.includes('.')) {
      console.error(`[Proxy] Invalid key: "${key}" — likely a corrupt logoUrl (folder path only)`);
      return res.status(400).json({ error: 'Invalid S3 key — logoUrl may be corrupt (missing filename)' });
    }

    let clientToUse = s3;
    if (targetRegion && targetRegion !== process.env.AWS_REGION) {
      clientToUse = new S3Client({
        region: targetRegion,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    }

    const command = new GetObjectCommand({
      Bucket: targetBucket,
      Key: key,
    });

    const s3Response = await clientToUse.send(command);

    const contentType = s3Response.ContentType || 'image/png';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    
    if (req.query.download === 'true') {
      res.set('Content-Disposition', 'attachment; filename="happypix-photo.jpg"');
    }

    // Buffer the stream (more reliable than .pipe() with Express 5)
    const chunks = [];
    for await (const chunk of s3Response.Body) {
      chunks.push(chunk);
    }
    res.send(Buffer.concat(chunks));
  } catch (err) {
    console.error('❌ Logo proxy error:', err.name, err.message);
    res.status(404).json({ error: 'Logo not found or access denied' });
  }
});

// Logo Upload API (permanent — no TTL)
// Requires: authenticated user; the S3 path is scoped to THEIR organization
// (never a client-supplied orgId).
// S3 path: happypix/<orgId>/logos/<timestamp>-<name>.<ext>
app.post('/api/upload/logo', authenticate, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const orgId = req.user?.organizationId || req.user?._id || 'unscoped';
    const ext = req.file.originalname.split('.').pop() || 'png';
    const folder = req.query.folder || 'logos';
    const fileName = `happypix/${orgId}/${folder}/${Date.now()}-${folder}.${ext}`;

    const parallelUploads3 = new Upload({
      client: s3,
      params: {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype || 'image/png',
      },
    });

    await parallelUploads3.done();
    const logoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    res.status(201).json({ url: logoUrl });
  } catch (error) {
    console.error('❌ Logo upload error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Profile Photo Upload API
app.post('/api/upload/profile-photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const userId = req.user._id;
    const ext = req.file.originalname.split('.').pop() || 'png';
    const fileName = `happypix/profiles/${userId}/${Date.now()}-profile.${ext}`;

    const parallelUploads3 = new Upload({
      client: s3,
      params: {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype || 'image/png',
      },
    });

    await parallelUploads3.done();
    const photoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    res.status(201).json({ url: photoUrl });
  } catch (error) {
    console.error('❌ Profile photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile photo' });
  }
});

// Photo Upload API
// S3 path: happypix/<orgId>/<eventId>/<sessionId>/<timestamp>-<filename>
// Auth: a paired booth (device token) or a signed-in user (JWT).
// This endpoint previously accepted anonymous uploads into the bucket.
const requireUserOrDevice = (req, res, next) => {
  const hasDeviceCreds = req.headers['x-device-token']
    || (req.headers.authorization || '').startsWith('Device ')
    || req.headers['x-device-uuid'];
  return hasDeviceCreds ? authenticateDevice(req, res, next) : authenticate(req, res, next);
};

app.post('/api/upload', requireUserOrDevice, upload.single('photo'), async (req, res) => {
  try {
    let fileBuffer;
    let originalName = 'capture.png';
    let mimeType = 'image/png';

    if (req.file) {
      fileBuffer = req.file.buffer;
      originalName = req.file.originalname;
      mimeType = req.file.mimetype;
    } else if (req.body.photoBase64) {
      // Decode base64 data URI
      const matches = req.body.photoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: 'Invalid base64 image data format' });
      }
      mimeType = matches[1];
      fileBuffer = Buffer.from(matches[2], 'base64');
      originalName = 'composite.png';
    } else {
      return res.status(400).json({ error: 'No photo file or base64 data provided' });
    }

    // Scope the S3 path to the AUTHENTICATED identity — never trust a
    // client-supplied orgId (any caller could write into another org).
    const orgId     = (req.organization?._id || req.user?.organizationId || 'unscoped').toString();
    const eventId   = req.body.eventId   || 'no-event';
    const sessionId = req.body.sessionId || `session-${Date.now()}`;
    const fileName  = `happypix/${orgId}/${eventId}/${sessionId}/${Date.now()}-${originalName}`;
    
    // Upload to S3
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimeType,
    };

    const parallelUploads3 = new Upload({
      client: s3,
      params: uploadParams,
    });

    await parallelUploads3.done();

    const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    // Save to MongoDB (compositeUrl is a declared Photo field — the org
    // gallery leads with it; see models/Photo.js)
    const newPhoto = new Photo({
      s3Key: fileName,
      url: s3Url,
      eventId: req.body.eventId || undefined,
      organizationId: (orgId && mongoose.Types.ObjectId.isValid(orgId)) ? orgId : null,
      compositeUrl: req.body.isComposite === 'true' ? s3Url : null,
      sessionId: req.body.sessionId || null,
      finalised: req.body.isComposite === 'true',
      generatedAt: new Date(),
    });

    await newPhoto.save();

    res.status(201).json({
      message: 'Upload successful',
      url: s3Url,
      id: newPhoto._id
    });

    console.log('\n-----------------------------------------');
    console.log(`📤 [BACKEND S3 UPLOAD SUCCESS]`);
    console.log(`Type: ${req.body.isComposite === 'true' ? 'Final Template (STRIP)' : 'Raw Photo'}`);
    console.log(`Event ID: ${req.body.eventId || 'No Event ID'}`);
    console.log(`URL: ${s3Url}`);
    console.log('-----------------------------------------\n');

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Global Express Error Handler (prevents leaking internal stack traces in production)
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) return next(err);
  const status = Number(err.status || err.statusCode) || 500;
  const message = (process.env.NODE_ENV === 'production' && status >= 500)
    ? 'An unexpected server error occurred'
    : err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

export default app;

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

}
