// ============================================================
// Audit log writer — ONE schema for both organization and platform
// audit records (issues #21–#25, #114).
//
// Every record stores:
//   actorId, actorName, actorRole, action, entity, summary,
//   severity, at (timestamp), ip, organizationId
//
// `at` is the sorting key — never `createdAt` (issue #24).
// ============================================================

import AuditLog from '../models/AuditLog.js';
import { normalizeRole, ROLE_LABELS } from '../config/permissions.js';

const SEVERITIES = ['info', 'warn', 'danger'];

/** Express request → { ip, actor } best effort. */
export function actorFromRequest(req) {
  const user = req && req.user;
  const ip = (req && (req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress)) || null;
  if (!user) return { actorId: null, actorName: 'System', actorRole: 'SYSTEM', ip: normalizeIp(ip) };
  return {
    actorId: user._id || user.id || null,
    actorName: user.name || 'Unknown user',
    actorRole: ROLE_LABELS[normalizeRole(user.role)] || normalizeRole(user.role) || 'SYSTEM',
    ip: normalizeIp(ip),
  };
}

function normalizeIp(ip) {
  if (!ip) return null;
  const first = String(ip).split(',')[0].trim();
  return first === '::1' ? '127.0.0.1' : first;
}

/**
 * Write an audit record.
 *
 * await writeAudit({ req, action, entity, summary, severity, organizationId })
 * await writeAudit({ actorId, actorName, actorRole, action, ... })
 */
export async function writeAudit(entry = {}) {
  try {
    const fromRequest = entry.req ? actorFromRequest(entry.req) : {};
    const actorRole = entry.actorRole || fromRequest.actorRole || 'SYSTEM';
    const doc = await AuditLog.create({
      actorId: entry.actorId ?? fromRequest.actorId ?? null,
      actorName: entry.actorName || fromRequest.actorName || 'System',
      actorRole,
      organizationId: entry.organizationId ?? (entry.req?.user?.organizationId || null),
      action: String(entry.action || 'unknown.action'),
      entity: String(entry.entity || 'unknown'),
      summary: String(entry.summary || ''),
      severity: SEVERITIES.includes(entry.severity) ? entry.severity : 'info',
      ip: entry.ip || fromRequest.ip || null,
      at: entry.at ? new Date(entry.at) : new Date(),
    });
    return doc;
  } catch (error) {
    // Auditing must never break the request path.
    console.error('❌ Failed to write audit log:', error.message);
    return null;
  }
}

/** Fire-and-forget variant for hot paths. */
export function auditAsync(entry) {
  void writeAudit(entry);
}

/** Mongo document → stable API shape used by both audit screens. */
export function auditView(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const at = raw.at || raw.timestamp || raw.createdAt || null;
  return {
    id: String(raw._id || raw.id),
    at: at ? new Date(at).toISOString() : null,
    timestamp: at ? new Date(at).toISOString() : null,
    actorId: raw.actorId ? String(raw.actorId._id || raw.actorId) : null,
    actorName: raw.actorName || (raw.actorId && raw.actorId.name) || 'System',
    actorRole: raw.actorRole || (raw.actorId && raw.actorId.role) || 'SYSTEM',
    action: raw.action,
    entity: raw.entity,
    summary: raw.summary,
    severity: raw.severity || 'info',
    ip: raw.ip || raw.ipAddress || null,
    organizationId: raw.organizationId ? String(raw.organizationId._id || raw.organizationId) : null,
  };
}

/** Sort helper — always newest-first on the real timestamp (issue #24). */
export function byAtDesc(a, b) {
  return new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime();
}

/**
 * Legacy helper kept for older routes: logAudit(req, action, targetId, targetModel, details).
 * Delegates to the unified writer so every record has the same shape
 * (issue #25: organization and platform writes share one schema).
 */
export const logAudit = async (req, action, targetId = null, targetModel = null, details = {}) => {
  const actor = actorFromRequest(req || {});
  return writeAudit({
    ...actor,
    organizationId: (req && req.user && req.user.organizationId) || (details && details.organizationId) || null,
    action,
    entity: targetModel || (details && details.entity) || 'unknown',
    summary: (details && details.summary)
      || `${action}${targetId ? ` → ${targetId}` : ''}`,
    severity: (details && details.severity) || 'info',
  });
};

export default { writeAudit, auditAsync, auditView, actorFromRequest, byAtDesc, logAudit };
