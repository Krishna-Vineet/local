import { writeAudit } from '../lib/helpers.js';

/**
 * Legacy audit shim used by the pre-CRM routes (events, devices).
 * Maps the old (req, action, targetId, targetModel, details) signature onto
 * the canonical AuditLog document used by the CRM v2 audit trail.
 */
export const logAudit = async (req, action = 'legacy.action', targetId = null, targetModel = null, details = {}) => {
  try {
    const summary = typeof details === 'string'
      ? details
      : (details.summary || `${action} on ${targetModel || 'entity'}${targetId ? ` ${targetId}` : ''}`);

    await writeAudit({
      actorId: req?.user?._id || null,
      organizationId: req?.user?.organizationId || req?.organizationId || null,
      action,
      entity: targetModel ? String(targetModel).toLowerCase() : 'system',
      summary,
      severity: details.severity || 'info',
      ip: req?.ip || null,
      req,
    });
  } catch (error) {
    console.error('❌ Failed to write audit log:', error.message);
  }
};
