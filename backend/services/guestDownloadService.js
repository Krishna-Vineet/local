// ============================================================
// Guest downloads — creates the 24-hour digital-copy link for a
// finished booth session.
//
//   booth finishes → createGuestDownload() → downloadId
//   booth success screen shows QR of  <WEBSITE_URL>/download/<id>
//   guest phone opens the HappyPix website download page, which
//   (via website-backend, same DB) serves the composite + frames
//   until `expiresAt` — exactly 24 hours after the session.
//
// The id is 144 bits of randomness, base64url — unguessable, and
// safe to put in a URL path segment.
// ============================================================

import crypto from 'crypto';
import GuestDownload, { GUEST_DOWNLOAD_TTL_MS } from '../models/GuestDownload.js';

export const DOWNLOAD_TTL_MS = GUEST_DOWNLOAD_TTL_MS;

export function newDownloadId() {
  return crypto.randomBytes(18).toString('base64url');
}

/** Public website URL for a download id (no trailing-slash surprises). */
export function downloadUrlFor(downloadId) {
  const base = String(process.env.WEBSITE_URL || 'https://happypix.vercel.app').replace(/\/+$/, '');
  return `${base}/download/${encodeURIComponent(downloadId)}`;
}

export async function createGuestDownload({
  organizationId = null,
  eventId = null,
  deviceId = null,
  sessionId = null,
  compositeUrl = null,
  photoUrls = [],
  photoIds = [],
  eventName = '',
  organizationName = '',
  payloadFingerprint = null,
  now = new Date(),
} = {}) {
  const urls = [...new Set((photoUrls || []).filter(Boolean).map(String))];
  if (!compositeUrl && urls.length === 0) return null; // nothing to download

  // Idempotency: Return active existing download record for this session if present
  if (sessionId && organizationId) {
    const existing = await GuestDownload.findOne({ organizationId, sessionId });
    if (existing && isDownloadLive(existing, now)) {
      return existing;
    }
  }

  // Atomic findOneAndUpdate with $setOnInsert ensures concurrency safety
  if (sessionId && organizationId) {
    try {
      const generatedDownloadId = newDownloadId();
      const expiresAt = new Date(now.getTime() + DOWNLOAD_TTL_MS);
      const download = await GuestDownload.findOneAndUpdate(
        { organizationId, sessionId },
        {
          $setOnInsert: {
            downloadId: generatedDownloadId,
            organizationId,
            eventId,
            deviceId,
            sessionId,
            compositeUrl: compositeUrl || null,
            photoUrls: urls,
            photoIds,
            eventName: String(eventName || ''),
            organizationName: String(organizationName || ''),
            payloadFingerprint: payloadFingerprint || null,
            expiresAt,
            viewCount: 0,
            downloadCount: 0,
            createdAt: now,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
      return download;
    } catch (err) {
      // If concurrent insertion produced a duplicate key error (MongoDB code 11000)
      if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
        const existing = await GuestDownload.findOne({ organizationId, sessionId });
        if (existing) return existing;
      }
      throw err;
    }
  }

  const download = await GuestDownload.create({
    downloadId: newDownloadId(),
    organizationId,
    eventId,
    deviceId,
    sessionId,
    compositeUrl: compositeUrl || null,
    photoUrls: urls,
    photoIds,
    eventName: String(eventName || ''),
    organizationName: String(organizationName || ''),
    payloadFingerprint: payloadFingerprint || null,
    expiresAt: new Date(now.getTime() + DOWNLOAD_TTL_MS),
  });
  return download;
}

/** A download is usable only while unexpired (TTL sweep can lag). */
export function isDownloadLive(download, now = new Date()) {
  return Boolean(download && download.expiresAt && new Date(download.expiresAt) > now);
}

export default { createGuestDownload, downloadUrlFor, isDownloadLive, newDownloadId, DOWNLOAD_TTL_MS };
