import mongoose from 'mongoose';

// Platform-wide settings singleton (gallery policy today; extend here).
// Defaults mirror the CRM contract: gallery off, guest consent required.
const platformSettingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'platform', unique: true },
    galleryEnabled: { type: Boolean, default: false },
    requireGuestConsent: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

const PlatformSetting = mongoose.model('PlatformSetting', platformSettingSchema);

export const PLATFORM_SETTINGS_DEFAULTS = { galleryEnabled: false, requireGuestConsent: true };

export async function getPlatformSettings() {
  let doc = await PlatformSetting.findOne({ key: 'platform' });
  if (!doc) {
    doc = new PlatformSetting({ key: 'platform', ...PLATFORM_SETTINGS_DEFAULTS });
    await doc.save();
  }
  return doc;
}

export default PlatformSetting;
