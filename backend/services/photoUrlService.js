// ============================================================
// Photo URL signing for galleries.
//
// Booth photos live in a PRIVATE S3 bucket, so the raw
// `https://<bucket>.s3.<region>.amazonaws.com/<key>` URL stored on a
// Photo returns 403 AccessDenied in a browser <img> — the org gallery
// rendered broken-image icons even though the photo existed. (The
// codebase already knew this: server.js has a one-off logo proxy
// "to bypass AccessDenied".)
//
// Fix: hand the browser a short-lived *signed* GET URL instead.
//   • data: URLs (inline booth captures when S3 is not configured)
//     are returned untouched — they render as-is.
//   • non-S3 http(s) URLs are returned untouched.
//   • S3 URLs / s3Keys are signed for `expiresInSec` (default 1h,
//     long enough for a gallery page view; refreshed on each load).
// Signing is local cryptography — no network call — and any failure
// falls back to the stored URL so the gallery never hard-breaks.
// ============================================================

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3, s3KeyFromUrl } from '../utils/s3.js';

let getSignedUrl = null;
try {
  const presigner = await import('@aws-sdk/s3-request-presigner');
  getSignedUrl = presigner.getSignedUrl;
} catch {
  // @aws-sdk/s3-request-presigner not installed in node_modules yet; safely falls back to stored URL
}

const DEFAULT_EXPIRES_SEC = 60 * 60;

function s3KeyFor(photo = {}) {
  const targetUrl = photo.compositeUrl || photo.url || '';
  const keyFromUrl = s3KeyFromUrl(targetUrl);
  if (keyFromUrl) return keyFromUrl;
  if (!photo.compositeUrl && photo.s3Key) return String(photo.s3Key);
  return photo.s3Key ? String(photo.s3Key) : null;
}

function looksLikeOurS3(photo = {}, key) {
  if (!key || !process.env.S3_BUCKET_NAME) return false;
  const url = String(photo.compositeUrl || photo.url || '');
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('/uploads/') || url.includes('/uploads/')) {
    return false;
  }
  if (url.includes('amazonaws.com')) return url.includes(process.env.S3_BUCKET_NAME);
  if (url.startsWith('http://') || url.startsWith('https://')) return false;
  return Boolean(photo.s3Key); // key stored but URL built elsewhere
}

export async function signedPhotoUrl(photo, { expiresInSec = DEFAULT_EXPIRES_SEC } = {}) {
  const raw = (photo && (photo.compositeUrl || photo.url)) || '';
  if (!raw || raw.startsWith('data:')) return raw || null;
  const key = s3KeyFor(photo);
  if (!looksLikeOurS3(photo, key)) return raw;
  if (!getSignedUrl) return raw;
  try {
    return await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }),
      { expiresIn: expiresInSec },
    );
  } catch (error) {
    console.warn('⚠️ Could not sign photo URL, returning stored URL:', error.message);
    return raw;
  }
}

/** Sign a raw URL/key pair (guest-download pages, booth share links). */
export async function signedUrlFor(rawUrl, s3Key = '', options = {}) {
  if (!rawUrl) return null;
  return signedPhotoUrl({ url: rawUrl, s3Key }, options);
}

export default { signedPhotoUrl, signedUrlFor };
