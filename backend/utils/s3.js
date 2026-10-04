import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

// ─── Shared S3 client ─────────────────────────────────────────
export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ─── Upload a buffer to S3, return the S3 key + raw URL ───────
export const uploadToS3 = async ({ buffer, mimetype, folder = 'uploads', originalname = 'file' }) => {
  const ext = (originalname.split('.').pop() || 'bin').toLowerCase();
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

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

  const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return { key, url };
};

// ─── Delete an object from S3 by key ─────────────────────────
export const deleteFromS3 = async (key) => {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    }));
    console.log(`🗑️  S3 object deleted: ${key}`);
  } catch (err) {
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
