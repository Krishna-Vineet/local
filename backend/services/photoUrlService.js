// ============================================================
// Photo URL Service for Galleries & Downloads
//
// Cloudinary replaces AWS S3. Photos stored on Cloudinary
// (https://res.cloudinary.com) deliver via fast, secure CDN
// without AWS 403 AccessDenied errors or complex signed URL expiration.
//
//   • data: URLs (inline booth captures) are returned as-is.
//   • Cloudinary URLs are delivered via CDN; if a downloadName is specified,
//     Cloudinary's fl_attachment flag is appended for browser download.
//   • Local /uploads/ URLs are returned untouched.
// ============================================================

import { signedPhotoUrl as cloudinarySignedPhotoUrl, s3KeyFromUrl } from '../utils/cloudinary.js';

const DEFAULT_EXPIRES_SEC = 60 * 60;

export async function signedPhotoUrl(photo, { expiresInSec = DEFAULT_EXPIRES_SEC, downloadName = null } = {}) {
  const raw = (photo && (photo.compositeUrl || photo.url)) || '';
  if (!raw || raw.startsWith('data:')) return raw || null;

  return await cloudinarySignedPhotoUrl(raw, { expiresInSec, downloadName });
}

/** Sign a raw URL/key pair (guest-download pages, booth share links). */
export async function signedUrlFor(rawUrl, key = '', options = {}) {
  if (!rawUrl) return null;
  return signedPhotoUrl({ url: rawUrl, s3Key: key }, options);
}

export { s3KeyFromUrl };
export default { signedPhotoUrl, signedUrlFor, s3KeyFromUrl };
