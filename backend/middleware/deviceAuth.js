import Device from '../models/Device.js';
import Organization from '../models/Organization.js';

/**
 * Device Authentication Middleware
 * 
 * Validates the `x-device-token` header sent by the Photo Booth client app.
 * On success, attaches `req.device` and `req.organizationId` to the request.
 * 
 * Usage: router.post('/ping', authenticateDevice, handler)
 */
export const authenticateDevice = async (req, res, next) => {
  try {
    const token = req.headers['x-device-token'];

    if (!token) {
      return res.status(401).json({ error: 'Device token required (x-device-token header).' });
    }

    // Find device by token
    const device = await Device.findOne({ deviceToken: token });

    if (!device) {
      return res.status(401).json({ error: 'Invalid device token.' });
    }

    if (device.status === 'blocked') {
      return res.status(403).json({ error: 'This device has been blocked. Contact your administrator.' });
    }

    if (device.status === 'inactive') {
      return res.status(403).json({ error: 'This device is inactive. Contact your administrator.' });
    }

    // Check organization status
    const org = await Organization.findById(device.organizationId);

    if (!org) {
      return res.status(403).json({ error: 'Organization not found. Contact support.' });
    }

    if (org.status === 'banned') {
      return res.status(403).json({ 
        error: 'Your account has been banned. Please contact HappyPix support.' 
      });
    }

    // Note: If org.status === 'suspended', the booth is allowed to connect
    // but should be served a restricted/read-only mode by the controllers.

    // All good — attach device info to request
    req.device = device;
    req.organizationId = device.organizationId;
    req.organization = org;

    next();
  } catch (error) {
    console.error('❌ Device auth error:', error);
    return res.status(500).json({ error: 'Device authentication failed.' });
  }
};

/**
 * Optional Device Auth
 * 
 * Like authenticateDevice but does NOT reject if token is missing.
 * Used on public routes that work with OR without a device token.
 * If token is valid → req.organizationId is set (org-scoped response)
 * If no token → req.organizationId is null (returns all public data)
 */
export const optionalDeviceAuth = async (req, res, next) => {
  const token = req.headers['x-device-token'];
  if (!token) return next(); // No token → proceed without org scoping

  try {
    const device = await Device.findOne({ deviceToken: token, status: 'active' });
    if (device) {
      const org = await Organization.findById(device.organizationId);
      if (org && org.status !== 'banned') {
        req.device = device;
        req.organizationId = device.organizationId;
        req.organization = org;
      }
    }
  } catch (err) {
    console.warn('⚠️ Optional device auth failed silently:', err.message);
  }
  next();
};
