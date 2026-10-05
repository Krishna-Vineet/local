import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables immediately
dotenv.config();

import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { authenticate } from './middleware/auth.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import dns from 'dns';

// Fix for MongoDB SRV resolution issue on certain networks
dns.setServers(['8.8.8.8', '1.1.1.1']);


// Route imports
import eventRoutes        from './routes/eventRoutes.js';
import couponRoutes       from './routes/couponRoutes.js';
import settingRoutes      from './routes/settingRoutes.js';
import paymentRoutes      from './routes/paymentRoutes.js';
import supportRoutes      from './routes/supportRoutes.js';
import deviceRoutes       from './routes/deviceRoutes.js';
import boothRoutes, { authenticateBooth } from './routes/boothRoutes.js';
import photoShareRoutes   from './routes/photoShareRoutes.js';

// CRM v2 Route imports
import crmAuthRoutes      from './routes/crm/auth.js';
import crmPlatformRoutes  from './routes/crm/platform.js';
import crmOrgRoutes       from './routes/crm/org.js';

// Services
import cronService        from './services/CronService.js';

// Model imports
import Photo from './models/Photo.js';

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// ─── Startup ENV Validation ───────────────────────────────
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
  console.warn(`⚠️  Missing required environment variables: ${missingEnv.join(', ')}`);
  console.warn('   → Payments will fail until these are set.');
  console.warn('   → See server/.env.example for reference.');
} else {
  const rzpMode = process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live') ? '🟢 LIVE' : '🟡 TEST';
  console.log(`💳 Razorpay mode: ${rzpMode} (key: ${process.env.RAZORPAY_KEY_ID?.slice(0, 14)}...)`);
}

// ─── CORS ─────────────────────────────────────────────────
let allowedOrigins = [
  'https://happypix-gzy6.vercel.app',       // server (self, for proxy calls)
  'https://happypix.vercel.app',             // client (production)
  'https://happypix-git-dev-happypixs-projects.vercel.app', // client (preview)
  'https://happypix-j9xd.vercel.app',        // admin
  'https://happypixcrm.vercel.app',          // new CRM (admin)
  'https://happypixbackend.vercel.app',      // new backend
];

if (process.env.ALLOWED_ORIGINS) {
  const dynamicOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  allowedOrigins = [...allowedOrigins, ...dynamicOrigins];
}

// Booth (Electron) endpoints are authenticated with device tokens, not
// cookies. The packaged app loads from file:// and therefore sends
// `Origin: null` — allowed for those paths only, without credentials.
const BOOTH_PREFIXES = ['/api/booth', '/api/upload'];

app.use((req, res, next) => {
  const isBoothPath = BOOTH_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`));
  return cors({
    origin(origin, callback) {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (isBoothPath && origin === 'null') return callback(null, true);

      // Always allow localhost in non-production environments
      const isLocalhost = /^https?:\/\/localhost:\d+$/.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin);
      if (isLocalhost && !isProd) {
        return callback(null, true);
      }

      // allow all Vercel preview deployments for this project
      if (allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    },
    credentials: !isBoothPath,
  })(req, res, next);
});

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser()); // Parse HttpOnly cookies for JWT auth

// Request Logger (quiet in production — non-GET only)
app.use((req, res, next) => {
  if (!isProd || req.method !== 'GET') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
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

    // Start background services (ensuring they only start once)
    if (!global._cronStarted) {
      cronService.start();
      global._cronStarted = true;
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
app.use('/api/auth',          crmAuthRoutes); // JWT-cookie auth for CRM
app.use('/api/platform',      crmPlatformRoutes);
app.use('/api/org',           crmOrgRoutes);

// Legacy/Booth Client Namespaces
app.use('/api/events',        eventRoutes);
app.use('/api/coupons',       couponRoutes);
app.use('/api/settings',      settingRoutes);
app.use('/api/payments',      paymentRoutes);
app.use('/api/support',       supportRoutes);
app.use('/api/devices',       deviceRoutes);         // Legacy Device tracking + heartbeat
app.use('/api/booth',         boothRoutes);          // React+Vite Booth App API (device-token auth)

app.use('/api/share',         photoShareRoutes);

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
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Logo Proxy — fetches private S3 objects using AWS SDK credentials.
// Restricted to S3 hosts so it cannot be used as an open proxy.
app.get('/api/proxy/logo', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param required' });
  try {
    // Expected format: https://<bucket>.s3.<region>.amazonaws.com/<key>
    const urlObj = new URL(url);
    const key = urlObj.pathname.replace(/^\//, ''); // remove leading slash

    let targetBucket = process.env.S3_BUCKET_NAME;
    let targetRegion = process.env.AWS_REGION;

    const hostMatch = urlObj.hostname.match(/^(.+?)\.s3\.(.+?)\.amazonaws\.com/);
    if (hostMatch) {
      targetBucket = hostMatch[1];
      targetRegion = hostMatch[2];
    } else {
      const legacyMatch = urlObj.hostname.match(/^(.+?)\.s3\.amazonaws\.com/);
      if (legacyMatch) {
        targetBucket = legacyMatch[1];
        targetRegion = 'us-east-1';
      } else {
        return res.status(400).json({ error: 'Only S3 URLs are supported by this proxy.' });
      }
    }

    if (!key || !key.includes('.')) {
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
// Requires: authenticated ORG_ADMIN / ORG_MANAGER. The S3 path is scoped to
// the authenticated user's organization — a client-supplied orgId is ignored.
app.post('/api/upload/logo', authenticate, upload.single('logo'), async (req, res) => {
  try {
    if (!req.user.organizationId) {
      return res.status(403).json({ error: 'Only organization accounts can upload logos.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const orgId = req.user.organizationId;
    const ext = (req.file.originalname.split('.').pop() || 'png').toLowerCase();
    const folder = 'logos';
    const fileName = `happypix/${orgId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

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
    console.error('❌ Logo upload error:', error.message);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Profile Photo Upload API
app.post('/api/upload/profile-photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const userId = req.user._id;
    const ext = (req.file.originalname.split('.').pop() || 'png').toLowerCase();
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
    console.error('❌ Profile photo upload error:', error.message);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Photo Upload API (legacy booth path — now device-authenticated)
// S3 path: happypix/<orgId>/<eventId>/<sessionId>/<timestamp>-<filename>
// The org/device context comes from the device token — client-supplied
// orgId values are ignored.
app.post('/api/upload', authenticateBooth, upload.single('photo'), async (req, res) => {
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
      if (fileBuffer.length > 10 * 1024 * 1024) {
        return res.status(413).json({ error: 'Image exceeds the 10 MB limit.' });
      }
      originalName = 'composite.png';
    } else {
      return res.status(400).json({ error: 'No photo file or base64 data provided' });
    }

    const device = req.device;
    const org = req.organization;
    const eventId = req.body.eventId || device.assignedEventId || 'no-event';
    const sessionId = req.body.sessionId || `session-${Date.now()}`;
    const fileName = `happypix/${org._id}/${eventId}/${sessionId}/${Date.now()}-${originalName}`;

    const parallelUploads3 = new Upload({
      client: s3,
      params: {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimeType,
      },
    });

    await parallelUploads3.done();

    const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    const newPhoto = new Photo({
      s3Key: fileName,
      url: s3Url,
      eventId: eventId && mongoose.Types.ObjectId.isValid(eventId) ? eventId : undefined,
      deviceId: device._id,
      organizationId: org._id,
      sessionId,
      compositeUrl: req.body.isComposite === true || req.body.isComposite === 'true' ? s3Url : null,
      guestConsent: req.body.guestConsent === true || req.body.guestConsent === 'true',
      capturedAt: new Date(),
    });

    await newPhoto.save();

    res.status(201).json({
      message: 'Upload successful',
      url: s3Url,
      id: newPhoto._id,
    });
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Vercel serverless builds import the app; standalone (Docker/VM) runs
// bind the port directly.
export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}
