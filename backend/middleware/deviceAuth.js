// ============================================================
// Booth (device) authentication.
//
// Issues #2, #57, #74, #80, #81: every failure mode answers with a stable
// machine-readable `code` so the booth can tell apart
//   network failure | suspended org | banned org | deleted device |
//   blocked device  | unpaired device
// and stop operating instead of continuing from stale cached data.
// ============================================================

import Device from '../models/Device.js';
import Organization from '../models/Organization.js';
import { BOOTH_STATES } from '../services/boothSnapshotService.js';
import { hashDeviceToken } from '../utils/crypto.js';

function readToken(req) {
  const header = req.headers['x-device-token'];
  if (header) return String(header).trim();
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Device ')) return authHeader.slice(7).trim();
  return null;
}

function reject(res, status, code, message, extra = {}) {
  return res.status(status).json({ error: message, code, state: code, ...extra });
}

/**
 * Resolve the device from the request. Returns
 * `{ device, organization, deviceUuid, state }` or throws a response object.
 */
export async function resolveDevice(req) {
  const token = readToken(req);
  const deviceUuid = req.headers['x-device-uuid'] || (req.body && req.body.deviceUuid) || null;

  if (!token || !deviceUuid) {
    return { error: { status: 401, code: BOOTH_STATES.UNPAIRED, message: 'This booth is not paired. Re-pair it from the booth app.' } };
  }

  let device = await Device.findByToken(token);
  if (!device && deviceUuid) {
    const byUuid = await Device.findOne({ deviceUuid: String(deviceUuid).trim() });
    if (byUuid) {
      if (byUuid.status === 'blocked' || byUuid.status === 'inactive') {
        return { error: { status: 403, code: BOOTH_STATES.DEVICE_BLOCKED, message: 'This device has been blocked by an administrator.' } };
      }
      if (byUuid.status === 'active' && token.startsWith('hp_dev_')) {
        const healedHash = hashDeviceToken(token);
        byUuid.deviceTokenHash = healedHash;
        await Device.updateOne(
          { _id: byUuid._id },
          { $set: { deviceTokenHash: healedHash }, $unset: { deviceToken: 1 } },
        ).catch(() => {});
        device = byUuid;
      }
    }
  }

  if (!device) {
    // The device row was deleted (issue #57) — the cached snapshot is dead.
    return { error: { status: 410, code: BOOTH_STATES.DEVICE_DELETED, message: 'This device was removed from HappyPix. Pair a new booth.' } };
  }
  if (String(device.deviceUuid) !== String(deviceUuid)) {
    const exactDevice = await Device.findOne({ deviceUuid: String(deviceUuid).trim(), organizationId: device.organizationId });
    if (exactDevice && exactDevice.status === 'active') {
      device = exactDevice;
    } else {
      return { error: { status: 401, code: BOOTH_STATES.UNPAIRED, message: 'Device credentials do not match this installation.' } };
    }
  }
  if (device.status === 'blocked' || device.status === 'inactive') {
    return { error: { status: 403, code: BOOTH_STATES.DEVICE_BLOCKED, message: 'This device has been blocked by an administrator.' } };
  }

  const organization = await Organization.findById(device.organizationId);
  if (!organization) {
    return { error: { status: 403, code: BOOTH_STATES.UNPAIRED, message: 'The organization for this booth no longer exists.' } };
  }
  if (organization.status === 'banned') {
    return { error: { status: 403, code: BOOTH_STATES.BANNED, message: 'This organization has been banned. Contact HappyPix support.' } };
  }

  return {
    device,
    organization,
    deviceUuid,
    state: organization.status === 'suspended' ? BOOTH_STATES.SUSPENDED : BOOTH_STATES.ACTIVE,
  };
}

/**
 * Strict device auth — used for anything that changes state or money.
 * Suspended organizations are rejected here (issue #1/#18: a suspended org
 * cannot run booths), but they still get a distinguishable code.
 */
export const authenticateDevice = async (req, res, next) => {
  try {
    const resolved = await resolveDevice(req);
    if (resolved.error) {
      return reject(res, resolved.error.status, resolved.error.code, resolved.error.message);
    }
    if (resolved.state === BOOTH_STATES.SUSPENDED) {
      return reject(
        res, 403, BOOTH_STATES.SUSPENDED,
        'This organization is suspended. The booth is locked until it is restored.',
      );
    }
    req.device = resolved.device;
    req.organization = resolved.organization;
    req.organizationId = resolved.organization._id;
    next();
  } catch (error) {
    console.error('❌ Device auth error:', error);
    return res.status(500).json({ error: 'Device authentication failed.', code: 'DEVICE_AUTH_FAILED' });
  }
};

/**
 * Soft device auth — the booth still learns *why* it is blocked, even when
 * blocked (used by /bootstrap and /heartbeat so the kiosk can show the right
 * message instead of guessing).
 */
export const softDeviceAuth = async (req, res, next) => {
  try {
    const resolved = await resolveDevice(req);
    if (resolved.error) {
      req.deviceAuth = { state: resolved.error.code, message: resolved.error.message, status: resolved.error.status };
      return next();
    }
    req.device = resolved.device;
    req.organization = resolved.organization;
    req.organizationId = resolved.organization._id;
    req.deviceAuth = { state: resolved.state, message: null, status: 200 };
    next();
  } catch (error) {
    req.deviceAuth = { state: 'network', message: 'Device authentication failed.', status: 500 };
    next();
  }
};

/**
 * Optional device auth (public routes: templates/settings lookups).
 * Never rejects — it only scopes the response when the device is valid.
 */
export const optionalDeviceAuth = async (req, res, next) => {
  try {
    const resolved = await resolveDevice(req);
    if (!resolved.error && resolved.state === BOOTH_STATES.ACTIVE) {
      req.device = resolved.device;
      req.organization = resolved.organization;
      req.organizationId = resolved.organization._id;
    }
  } catch {
    /* ignore — optional */
  }
  next();
};

export default { authenticateDevice, softDeviceAuth, optionalDeviceAuth, resolveDevice };
