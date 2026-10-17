// ============================================================
// Platform gallery settings (issues #16–#20).
//
// The policy lives in the GLOBAL Setting row (organizationId = null) and
// is persisted — no placeholder responses (issue #17). The same values are
// returned by the CRM API, embedded in booth snapshots, and used to filter
// organization galleries (issues #18–#20).
// ============================================================

import Setting from '../models/Setting.js';

const DEFAULTS = { galleryEnabled: true, requireGuestConsent: false };

let cache = { at: 0, value: null };
const CACHE_MS = 15 * 1000;

/**
 * Read the platform gallery policy.
 * Issue #16: when galleries are disabled the consent flag is forced off in
 * the *returned* value as well, so no client can render a meaningless
 * "ask guests for publishing permission" toggle as active.
 */
export async function getGallerySettings({ fresh = false } = {}) {
  if (!fresh && cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
  let row = null;
  try {
    row = await Setting.findOne({ organizationId: null }).lean();
  } catch {
    row = null;
  }
  const galleryEnabled = row ? row.galleryEnabled !== false : true;
  const requireGuestConsent = galleryEnabled
    ? (row?.requireGuestConsent === true)
    : false;
  const value = {
    galleryEnabled,
    requireGuestConsent,
    updatedAt: (row && row.galleryUpdatedAt ? new Date(row.galleryUpdatedAt).toISOString() : null),
    updatedBy: row && row.galleryUpdatedBy ? String(row.galleryUpdatedBy) : null,
  };
  cache = { at: Date.now(), value };
  return value;
}

/**
 * Persist a policy change.
 *  • validates booleans
 *  • issue #16: disabling galleries automatically turns guest consent off
 *  • returns the stored policy
 */
export async function saveGallerySettings(patch = {}, actor = null) {
  const update = {};
  if (patch.galleryEnabled !== undefined) {
    if (typeof patch.galleryEnabled !== 'boolean') {
      throw Object.assign(new Error('galleryEnabled must be a boolean.'), { status: 400, code: 'BAD_GALLERY_SETTING' });
    }
    update.galleryEnabled = patch.galleryEnabled;
  }
  if (patch.requireGuestConsent !== undefined) {
    if (typeof patch.requireGuestConsent !== 'boolean') {
      throw Object.assign(new Error('requireGuestConsent must be a boolean.'), { status: 400, code: 'BAD_GALLERY_SETTING' });
    }
    update.requireGuestConsent = patch.requireGuestConsent;
  }

  const current = await getGallerySettings({ fresh: true });
  const nextEnabled = update.galleryEnabled !== undefined ? update.galleryEnabled : current.galleryEnabled;
  if (update.requireGuestConsent === true && !nextEnabled) {
    throw Object.assign(
      new Error('Guest publishing consent can only be required while organization galleries are enabled.'),
      { status: 409, code: 'GALLERY_DISABLED' },
    );
  }
  const nextConsent = !nextEnabled
    ? false // issue #16 — auto-off when galleries are disabled
    : (update.requireGuestConsent !== undefined ? update.requireGuestConsent : current.requireGuestConsent);

  const row = await Setting.findOneAndUpdate(
    { organizationId: null },
    {
      $set: {
        galleryEnabled: nextEnabled,
        requireGuestConsent: nextConsent,
        galleryUpdatedAt: new Date(),
        galleryUpdatedBy: actor && (actor._id || actor.id) ? (actor._id || actor.id) : null,
        updatedAt: new Date(),
      },
      $setOnInsert: { organizationId: null },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  cache = { at: 0, value: null };
  return {
    galleryEnabled: row.galleryEnabled === true,
    requireGuestConsent: row.galleryEnabled === true && row.requireGuestConsent !== false,
    updatedAt: row.galleryUpdatedAt ? new Date(row.galleryUpdatedAt).toISOString() : null,
    updatedBy: row.galleryUpdatedBy ? String(row.galleryUpdatedBy) : null,
  };
}

/**
 * Issue #18: which photos may appear in an organization gallery.
 * `guestConsent` is stamped by the booth when the guest answered the prompt.
 */
export function photoVisibleInGallery(photo, settings) {
  if (!settings || !settings.galleryEnabled) return false;
  if (!settings.requireGuestConsent) return true;
  return photo && (photo.guestConsent === true || photo.shareConsent === true);
}

export const GALLERY_DEFAULTS = DEFAULTS;

export default { getGallerySettings, saveGallerySettings, photoVisibleInGallery, GALLERY_DEFAULTS };
