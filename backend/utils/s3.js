// ============================================================
// Cloudinary Storage Adapter (Formerly AWS S3)
//
// This module provides full backward compatibility for existing code
// while using Cloudinary for cloud image storage and transformations.
// AWS S3 has been completely replaced with Cloudinary.
// ============================================================

import {
  cloudinary,
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  signedPhotoUrl as cloudinarySignedPhotoUrl,
  getCloudinaryUploadSignature,
  s3KeyFromUrl,
  upload,
} from './cloudinary.js';

// Backward compatible aliases
export const uploadToS3 = uploadToCloudinary;
export const deleteFromS3 = deleteFromCloudinary;
export const signedPhotoUrl = cloudinarySignedPhotoUrl;
export const getPresignedUploadUrl = async ({ key, contentType, expiresInSec = 900 } = {}) => {
  const folder = key ? key.substring(0, key.lastIndexOf('/')) : 'happypix/photos';
  const sig = await getCloudinaryUploadSignature({ folder });
  if (!sig) return null;
  return {
    uploadUrl: sig.uploadUrl,
    publicUrl: `https://res.cloudinary.com/${sig.cloudName}/image/upload/${key}`,
    key,
    cloudinaryParams: sig,
  };
};

export {
  s3KeyFromUrl,
  upload,
  cloudinary,
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
};

// Safe fallback S3 stub so any legacy access doesn't throw ReferenceError
export const s3 = {
  send: async () => {
    throw new Error('AWS S3 has been replaced with Cloudinary.');
  },
};

export default {
  s3,
  uploadToS3,
  deleteFromS3,
  signedPhotoUrl,
  getPresignedUploadUrl,
  s3KeyFromUrl,
  upload,
  cloudinary,
};
