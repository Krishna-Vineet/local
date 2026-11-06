import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// ─── Cloudinary Configuration ─────────────────────────────────
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

// ─── Upload a buffer or stream to Cloudinary (with local disk fallback) ───
export const uploadToCloudinary = async ({
  buffer,
  mimetype,
  folder = 'happypix/uploads',
  originalname = 'file',
  publicId = null,
}) => {
  const ext = (originalname.split('.').pop() || 'bin').toLowerCase();
  const randomFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const cleanFolder = String(folder || 'happypix/uploads').replace(/^\/+|\/+$/g, '');

  if (isCloudinaryConfigured()) {
    try {
      const uploadOptions = {
        folder: cleanFolder,
        resource_type: 'auto',
      };
      if (publicId) {
        uploadOptions.public_id = String(publicId).replace(/\.[^/.]+$/, '');
        uploadOptions.overwrite = true;
        uploadOptions.unique_filename = false;
      } else {
        uploadOptions.use_filename = false;
        uploadOptions.unique_filename = true;
      }

      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(buffer);
      });

      return {
        key: uploadResult.public_id,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
      };
    } catch (err) {
      console.warn(`⚠️ Cloudinary upload failed (${err.message}). Storing file locally in uploads/ directory.`);
    }
  }

  // Local fallback: save to disk in backend/uploads/<folder>
  try {
    const targetDir = path.join(process.cwd(), 'uploads', cleanFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const localFilePath = path.join(targetDir, randomFileName);
    fs.writeFileSync(localFilePath, buffer);

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const localUrl = `${baseUrl}/uploads/${cleanFolder}/${randomFileName}`;
    return { key: `${cleanFolder}/${randomFileName}`, url: localUrl };
  } catch (fsErr) {
    console.error('⚠️ Local disk storage also failed:', fsErr.message);
    const mime = mimetype || 'image/png';
    return { key: randomFileName, url: `data:${mime};base64,${buffer.toString('base64')}` };
  }
};

// ─── Delete an asset from Cloudinary (with local fallback) ────
export const deleteFromCloudinary = async (key) => {
  if (!key) return;
  if (isCloudinaryConfigured()) {
    try {
      await cloudinary.uploader.destroy(key, { invalidate: true });
      console.log(`🗑️ Cloudinary asset deleted: ${key}`);
      return;
    } catch (err) {
      console.warn(`⚠️ Cloudinary delete failed for key "${key}":`, err.message);
    }
  }

  // Local fallback deletion
  try {
    const localFilePath = path.join(process.cwd(), 'uploads', key);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      console.log(`🗑️ Local file deleted: ${key}`);
    }
  } catch {
    // ignore
  }
};

// ─── Extract identifier/public_id from URL ─────────────────────
export const s3KeyFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    // Cloudinary URL format: https://res.cloudinary.com/<cloud>/image/upload/v12345/folder/name.jpg
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
};

// ─── Multer instance (memory storage, 10 MB limit) ────────────
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  },
});

// ─── Signed Photo URL for downloads & sharing ─────────────────
export async function signedPhotoUrl(rawUrl, { expiresInSec = 3600, downloadName = null } = {}) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  if (rawUrl.startsWith('data:')) return rawUrl;

  // If it's a Cloudinary URL and user wants an attachment download
  if (rawUrl.includes('res.cloudinary.com') && downloadName) {
    const safeName = String(downloadName).replace(/[^a-zA-Z0-9_.-]/g, '_');
    return rawUrl.replace('/upload/', `/upload/fl_attachment:${safeName}/`);
  }

  return rawUrl;
}

// ─── Direct Pre-signed / Signed Upload URL for Booths ─────────
export async function getCloudinaryUploadSignature({
  folder = 'happypix/photos',
  timestamp = Math.round(Date.now() / 1000),
} = {}) {
  if (!isCloudinaryConfigured()) return null;

  try {
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    const paramsToSign = {
      folder: cleanFolder,
      timestamp,
    };
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder: cleanFolder,
      timestamp,
      signature,
    };
  } catch (err) {
    console.warn('⚠️ Cloudinary signature generation failed:', err.message);
    return null;
  }
}

// Export Cloudinary instance
export { cloudinary };

export default {
  cloudinary,
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  signedPhotoUrl,
  getCloudinaryUploadSignature,
  s3KeyFromUrl,
  upload,
};
