import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

export const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET &&
    !process.env.CLOUDINARY_CLOUD_NAME.includes('EXAMPLE') &&
    !process.env.CLOUDINARY_CLOUD_NAME.includes('your_')
  );
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function s3KeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    if (url.includes('res.cloudinary.com')) {
      const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return null;
  }
}

export async function signedPhotoUrl(rawUrl, { expiresInSec = 3600, downloadName = null } = {}) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  if (rawUrl.startsWith('data:')) return rawUrl;

  // Cloudinary attachment download support
  if (rawUrl.includes('res.cloudinary.com') && downloadName) {
    const safeName = String(downloadName).replace(/[^a-zA-Z0-9_.-]/g, '_');
    return rawUrl.replace('/upload/', `/upload/fl_attachment:${safeName}/`);
  }

  return rawUrl;
}

export { cloudinary };

export default {
  cloudinary,
  isCloudinaryConfigured,
  signedPhotoUrl,
  s3KeyFromUrl,
};
