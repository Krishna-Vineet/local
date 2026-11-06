// ============================================================
// Cloudinary Storage Adapter for website-backend (Formerly AWS S3)
//
// Replaces AWS S3 with Cloudinary. Photos are delivered via Cloudinary CDN
// without AWS 403 AccessDenied errors or expiring signed URL overhead.
// ============================================================

import {
  signedPhotoUrl,
  s3KeyFromUrl,
  cloudinary,
  isCloudinaryConfigured,
} from './cloudinary.js';

export {
  signedPhotoUrl,
  s3KeyFromUrl,
  cloudinary,
  isCloudinaryConfigured,
};

export default {
  signedPhotoUrl,
  s3KeyFromUrl,
  cloudinary,
  isCloudinaryConfigured,
};
