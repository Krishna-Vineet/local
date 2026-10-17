// Signed S3 URLs for guest-download photos.
//
// Booth photos sit in a private bucket, so stored URLs 403 in a
// browser. When AWS credentials are configured for this service we
// sign short-lived GET URLs; otherwise the stored URL is returned
// untouched (e.g. public bucket or data: URLs from demo booths).

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let client = null;
function s3() {
  if (!process.env.S3_BUCKET_NAME || !process.env.AWS_REGION) return null;
  if (!client) {
    client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export function s3KeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return null;
  }
}

export async function signedPhotoUrl(rawUrl, { expiresInSec = 3600, downloadName = null } = {}) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  if (rawUrl.startsWith('data:')) return rawUrl;
  let urlObj;
  try {
    urlObj = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  const instance = s3();
  const key = s3KeyFromUrl(rawUrl);
  const bucket = process.env.S3_BUCKET_NAME;
  const isDirectBucketHost = Boolean(bucket && (urlObj.hostname === `${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com`
    || urlObj.hostname.startsWith(`${bucket}.s3.`)));
  if (!instance || !key || !isDirectBucketHost) return rawUrl;
  try {
    const params = { Bucket: process.env.S3_BUCKET_NAME, Key: key };
    if (downloadName) {
      params.ResponseContentDisposition = `attachment; filename="${String(downloadName).replace(/"/g, '')}"`;
    }
    return await getSignedUrl(instance, new GetObjectCommand(params), { expiresIn: expiresInSec });
  } catch {
    return rawUrl;
  }
}

export default { signedPhotoUrl, s3KeyFromUrl };
