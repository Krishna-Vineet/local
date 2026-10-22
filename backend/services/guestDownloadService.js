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
  now = new Date(),
} = {}) {
  const urls = [...new Set((photoUrls || []).filter(Boolean).map(String))];
  if (!compositeUrl && urls.length === 0) return null; // nothing to download
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
    expiresAt: new Date(now.getTime() + DOWNLOAD_TTL_MS),
  });
  return download;
}

/** A download is usable only while unexpired (TTL sweep can lag). */
export function isDownloadLive(download, now = new Date()) {
  return Boolean(download && download.expiresAt && new Date(download.expiresAt) > now);
}

export default { createGuestDownload, downloadUrlFor, isDownloadLive, newDownloadId, DOWNLOAD_TTL_MS };
