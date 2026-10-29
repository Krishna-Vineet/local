import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import dotenv from 'dotenv';

import fs from 'fs';
import path from 'path';

dotenv.config();

// ─── Shared S3 client ─────────────────────────────────────────
export const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// ─── Upload a buffer to S3 (with seamless local disk fallback) ───
export const uploadToS3 = async ({ buffer, mimetype, folder = 'uploads', originalname = 'file' }) => {
  const ext = (originalname.split('.').pop() || 'bin').toLowerCase();
  const randomFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const key = `${folder}/${randomFileName}`;

  const hasCredentials = process.env.AWS_ACCESS_KEY_ID && 
                         !process.env.AWS_ACCESS_KEY_ID.includes('EXAMPLE') && 
                         process.env.S3_BUCKET_NAME;

  if (hasCredentials) {
    try {
      const uploader = new Upload({
        client: s3,
        params: {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: mimetype || 'application/octet-stream',
        },
      });

      await uploader.done();

      const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
      return { key, url };
    } catch (err) {
      console.warn(`⚠️ AWS S3 upload failed (${err.message}). Storing file locally in uploads/ directory.`);
    }
  }

  // Local fallback: save to disk in backend/uploads/<folder>
  try {
    const targetDir = path.join(process.cwd(), 'uploads', folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const localFilePath = path.join(targetDir, randomFileName);
    fs.writeFileSync(localFilePath, buffer);

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const localUrl = `${baseUrl}/uploads/${folder}/${randomFileName}`;
    return { key, url: localUrl };
  } catch (fsErr) {
    console.error('⚠️ Local disk storage also failed:', fsErr.message);
    const mime = mimetype || 'image/png';
    return { key, url: `data:${mime};base64,${buffer.toString('base64')}` };
  }
};

// ─── Delete an object from S3 by key (with local fallback) ────
export const deleteFromS3 = async (key) => {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    }));
    console.log(`🗑️  S3 object deleted: ${key}`);
  } catch (err) {
    try {
      const localFilePath = path.join(process.cwd(), 'uploads', key);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log(`🗑️  Local file deleted: ${key}`);
      }
    } catch {
      // ignore
    }
    console.error(`⚠️  S3 delete failed for key "${key}":`, err.message);
  }
};

// ─── Extract S3 key from a full S3 URL ───────────────────────
export const s3KeyFromUrl = (url) => {
  if (!url) return null;
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return null;
  }
};

// ─── Multer instance (memory storage, 5 MB limit) ────────────
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
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
  let urlObj;
  try {
    urlObj = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || 'us-east-1';
  const hasCredentials = process.env.AWS_ACCESS_KEY_ID && 
                         !process.env.AWS_ACCESS_KEY_ID.includes('EXAMPLE') && 
                         bucket;
  if (!hasCredentials) return rawUrl;

  const key = s3KeyFromUrl(rawUrl);
  const isDirectBucketHost = Boolean(bucket && (
    urlObj.hostname === `${bucket}.s3.${region}.amazonaws.com` ||
    urlObj.hostname === `${bucket}.s3.amazonaws.com` ||
    urlObj.hostname.startsWith(`${bucket}.s3.`)
  ));
  if (!key || !isDirectBucketHost) return rawUrl;

  try {
    const params = { Bucket: bucket, Key: key };
    if (downloadName) {
      params.ResponseContentDisposition = `attachment; filename="${String(downloadName).replace(/"/g, '')}"`;
    }
    return await getSignedUrl(s3, new GetObjectCommand(params), { expiresIn: expiresInSec });
  } catch (err) {
    console.warn('⚠️ S3 sign URL failed:', err.message);
    return rawUrl;
  }
}

// ─── Direct Pre-signed Upload URL ─────────────────────────────
export async function getPresignedUploadUrl({ key, contentType = 'image/jpeg', expiresInSec = 900 }) {
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || 'us-east-1';
  const hasCredentials = process.env.AWS_ACCESS_KEY_ID && 
                         !process.env.AWS_ACCESS_KEY_ID.includes('EXAMPLE') && 
                         bucket;
  if (!hasCredentials || !key) return null;

  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: expiresInSec });
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    return { uploadUrl, publicUrl, key };
  } catch (err) {
    console.warn('⚠️ S3 pre-signed upload URL generation failed:', err.message);
    return null;
  }
}

