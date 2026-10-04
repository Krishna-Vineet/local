import AuditLog from '../models/AuditLog.js';

/**
 * Utility to log critical security and operational actions.
 * @param {Object} req - The Express request object
 * @param {String} action - The action identifier (e.g. 'DELETE_ORGANIZATION')
 * @param {String|ObjectId} targetId - The ID of the affected resource
 * @param {String} targetModel - The Model name of the affected resource
 * @param {Object} details - Additional contextual info
 */
export const logAudit = async (req, action, targetId = null, targetModel = null, details = {}) => {
  try {
    const performedBy = req.user ? req.user._id : null;
    const organizationId = req.user ? req.user.organizationId : null;
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'];

    await AuditLog.create({
      action,
      performedBy,
      organizationId,
      targetId,
      targetModel,
      details,
      ipAddress,
    });
  } catch (error) {
    console.error('❌ Failed to write audit log:', error);
  }
};
