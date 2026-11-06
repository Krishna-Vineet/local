import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  signedPhotoUrl,
  s3KeyFromUrl,
  getCloudinaryUploadSignature,
  isCloudinaryConfigured,
} from '../utils/cloudinary.js';
import {
  uploadToS3,
  deleteFromS3,
  getPresignedUploadUrl,
} from '../utils/s3.js';

test('Cloudinary Utility — fallback and helper functions', async () => {
  // Test key extraction from Cloudinary URLs
  const cdnUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/happypix/photos/sample.jpg';
  const extractedKey = s3KeyFromUrl(cdnUrl);
  assert.equal(extractedKey, 'happypix/photos/sample');

  // Test standard fallback upload (when no cloud keys are configured)
  const dummyBuffer = Buffer.from('test-image-content');
  const result = await uploadToCloudinary({
    buffer: dummyBuffer,
    mimetype: 'image/png',
    folder: 'happypix/test',
    originalname: 'test.png',
  });

  assert.ok(result.url, 'Expected a generated URL');
  assert.ok(result.key, 'Expected an asset key');

  // Test backward-compatible bridge functions in s3.js
  assert.equal(typeof uploadToS3, 'function');
  assert.equal(typeof deleteFromS3, 'function');
  assert.equal(typeof getPresignedUploadUrl, 'function');

  // Test signedPhotoUrl helper with Cloudinary attachment transformation
  const rawCloudinary = 'https://res.cloudinary.com/demo/image/upload/happypix/test.png';
  const attachmentUrl = await signedPhotoUrl(rawCloudinary, { downloadName: 'guest-photo.png' });
  assert.ok(attachmentUrl.includes('fl_attachment:guest-photo.png'));

  // Test signedPhotoUrl with data URL untouched
  const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const signedData = await signedPhotoUrl(dataUrl);
  assert.equal(signedData, dataUrl);
});
