import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

import GuestDownload from '../models/GuestDownload.js';
import { signedPhotoUrl } from '../utils/s3.js';

const router = express.Router();

const ok = (res, data, status = 200) => res.status(status).json(data);
const fail = (res, status, error, code) => res.status(status).json({ error, ...(code ? { code } : {}) });

const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});

function downloadState(download, now = new Date()) {
  if (!download) return { status: 404, error: 'This download link is invalid.' };
  if (new Date(download.expiresAt) <= now) {
    return {
      status: 410,
      error: 'This download link has expired. Digital copies are available for 24 hours after the booth session.',
      expired: true,
      expiresAt: download.expiresAt,
    };
  }
  return null;
}

// ─── GET /api/downloads/:id ──────────────────────────────────
// Returns session metadata and signed photo URLs (valid for 24h)
router.get('/:id', downloadLimiter, async (req, res) => {
  try {
    if (req.params.id === 'demo') {
      const now = Date.now();
      const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
      return ok(res, {
        downloadId: 'demo',
        compositeUrl: '/images/hero-booth.jpg',
        photoUrls: ['/images/hero-booth.jpg', '/images/wedding-booth.jpg', '/images/guests-party.jpg'],
        eventName: 'Kapur–Verma Sangeet Night',
        organizationName: 'HappyPix Studio Demo',
        createdAt: new Date(now).toISOString(),
        expiresAt,
        remainingMs: 24 * 60 * 60 * 1000,
        downloadCount: 0,
      });
    }

    const download = await GuestDownload.findOne({
      $or: [{ downloadId: req.params.id }, { sessionId: req.params.id }],
    });
    const state = downloadState(download);
    if (state) return fail(res, state.status, state.error, state.expired ? 'DOWNLOAD_EXPIRED' : 'DOWNLOAD_NOT_FOUND');

    download.viewCount = (download.viewCount || 0) + 1;
    await download.save();

    const [compositeUrl, photoUrls] = await Promise.all([
      signedPhotoUrl(download.compositeUrl),
      Promise.all((download.photoUrls || []).map((url) => signedPhotoUrl(url))),
    ]);
    const now = Date.now();
    return ok(res, {
      downloadId: download.downloadId,
      compositeUrl,
      photoUrls,
      eventName: download.eventName || '',
      organizationName: download.organizationName || '',
      createdAt: download.createdAt,
      expiresAt: download.expiresAt,
      remainingMs: Math.max(0, new Date(download.expiresAt).getTime() - now),
      downloadCount: download.downloadCount || 0,
    });
  } catch (error) {
    console.error('downloads/:id failed:', error);
    return fail(res, 500, 'Could not load this download.');
  }
});

// ─── GET /api/downloads/:id/file/:kind ────────────────────────
// kind = 'composite' or 0-based photo index
router.get('/:id/file/:kind', downloadLimiter, async (req, res) => {
  try {
    const download = await GuestDownload.findOne({
      $or: [{ downloadId: req.params.id }, { sessionId: req.params.id }],
    });
    const state = downloadState(download);
    if (state) return fail(res, state.status, state.error, state.expired ? 'DOWNLOAD_EXPIRED' : 'DOWNLOAD_NOT_FOUND');

    let raw = null;
    let name = 'happypix-photo.jpg';
    if (req.params.kind === 'composite') {
      raw = download.compositeUrl;
      name = 'happypix-final-print.jpg';
    } else {
      const index = Number.parseInt(req.params.kind, 10);
      raw = Number.isInteger(index) ? (download.photoUrls || [])[index] : null;
      name = `happypix-photo-${(index || 0) + 1}.jpg`;
    }
    if (!raw) return fail(res, 404, 'That file is not part of this download.');

    download.downloadCount = (download.downloadCount || 0) + 1;
    await download.save();

    // 1. Base64 data URL
    if (raw.startsWith('data:')) {
      const match = raw.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return fail(res, 415, 'This file cannot be downloaded.');
      const buffer = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', match[1]);
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      return res.send(buffer);
    }

    // 2. Local uploads folder fallback
    if (raw.includes('/uploads/')) {
      try {
        const urlObj = new URL(raw, 'http://localhost:5000');
        const relativeUploadPath = urlObj.pathname.replace(/^\/uploads\//, '');
        const localPath = path.join(process.cwd(), 'uploads', relativeUploadPath);
        if (fs.existsSync(localPath)) {
          return res.download(localPath, name);
        }
      } catch {
        // Fall through to redirect or signed URL
      }
    }

    // 3. AWS S3 signed attachment redirect
    const signed = await signedPhotoUrl(raw, { downloadName: name });
    return res.redirect(302, signed);
  } catch (error) {
    console.error('downloads file failed:', error);
    return fail(res, 500, 'Could not download this file.');
  }
});

// ─── POST /api/downloads/internal ─────────────────────────────
// Mint a download from internal services
router.post('/internal', downloadLimiter, async (req, res) => {
  const secret = process.env.WEBSITE_INTERNAL_SECRET || '';
  const providedSecret = String(req.headers['x-internal-secret'] || '');
  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(providedSecret);

  if (!secret || secretBuf.length !== providedBuf.length || !crypto.timingSafeEqual(secretBuf, providedBuf)) {
    return fail(res, 401, 'Unauthorized.', 'BAD_INTERNAL_SECRET');
  }
  try {
    const { photoUrls = [], compositeUrl = null, eventName = '', organizationName = '', sessionId = null } = req.body || {};
    const urls = [...new Set((Array.isArray(photoUrls) ? photoUrls : []).filter(Boolean).map(String))];
    if (!compositeUrl && urls.length === 0) return fail(res, 400, 'Provide compositeUrl or photoUrls.');
    const downloadId = crypto.randomBytes(18).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const download = await GuestDownload.create({
      downloadId,
      compositeUrl,
      photoUrls: urls,
      eventName,
      organizationName,
      sessionId,
      expiresAt,
    });
    const base = String(process.env.WEBSITE_URL || '').replace(/\/+$/, '');
    return ok(res, { downloadId: download.downloadId, url: `${base}/download/${download.downloadId}`, expiresAt }, 201);
  } catch (error) {
    console.error('internal/downloads failed:', error);
    return fail(res, 500, 'Could not create the download.');
  }
});

export default router;
