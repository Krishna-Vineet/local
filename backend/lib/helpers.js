// Shared helpers: input sanitising, derived statuses, login throttling,
// user serialisation, audit writing and pagination — the same policies
// the CRM mock server enforces (see crm/src/api/mock/server.js).

import AuditLog from '../models/AuditLog.js';
import { DEVICE_ONLINE_WINDOW_MS, LOCKOUT_MIN, MAX_LOGIN_ATTEMPTS, ROLE_LABELS } from './constants.js';

// ---------- input guards ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function passwordPolicyError(pw) {
  const p = String(pw || '');
  if (p.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Password must contain at least one letter and one number.';
  return null;
}

export function emailError(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return 'Email is required.';
  if (e.length > 120 || !EMAIL_RE.test(e)) return 'Enter a valid email address.';
  return null;
}

// strip control characters + trim + cap length on free-text input
export function safeStr(v, max = 120) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

// media fields (photos, logos, AI artwork) accept only image sources —
// never javascript:, data:text/html or unknown schemes
export function safeMediaUrl(v) {
  const u = String(v || '');
  if (!u) return null;
  if (/^https:\/\//i.test(u) || /^http:\/\//i.test(u)) return u.slice(0, 500000);
  const m = u.match(/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml)(;base64|[;,])/i);
  if (m) return u.slice(0, 500000);
  return null;
}

// UPI VPA: local part 2-256 chars [a-z0-9.\-_], '@', handle letters only
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
export function upiError(v) {
  const id = String(v || '').trim();
  if (!id) return null;
  if (!UPI_RE.test(id)) return 'Enter a valid UPI ID, e.g. business@okaxis.';
  return null;
}

// ---------- derived state ----------

export function computeEventStatus(ev, now = new Date()) {
  if (!ev) return 'upcoming';
  if (ev.paused) return 'paused';
  const s = new Date(ev.startDate);
  const e = new Date(ev.endDate);
  if (now < s) return 'upcoming';
  if (now > e) return 'finished';
  return 'active';
}

export function computeDeviceOnline(dev, now = Date.now()) {
  if (!dev || !dev.lastSeenAt) return false;
  return now - new Date(dev.lastSeenAt).getTime() < DEVICE_ONLINE_WINDOW_MS;
}

export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function fyStart(d) {
  // Indian FY: April 1
  return new Date(d.getFullYear(), d.getMonth() >= 3 ? 3 : -9, 1);
}

export function monthLabelOf(key) {
  const [y, m] = key.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[m - 1]} ${String(y).slice(2)}`;
}

export function paginated(items, { page = 1, limit = 10 } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, parseInt(limit, 10) || 10);
  return {
    items: items.slice((p - 1) * l, p * l),
    total: items.length,
    page: p,
    pages: Math.max(1, Math.ceil(items.length / l)),
  };
}

// ---------- user serialisation (never leak hashes / OTP secrets) ----------

export function userPublic(u) {
  if (!u) return null;
  return {
    id: u._id ? String(u._id) : u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    organizationId: u.organizationId ? String(u.organizationId) : null,
    status: u.status,
    photoUrl: u.profilePhotoUrl || u.photoUrl || null,
    createdAt: u.createdAt || null,
    lastLoginAt: u.lastLoginAt || null,
  };
}

// ---------- audit log (append-only, matches the AuditLog schema) ----------

export async function writeAudit({ actorId = null, organizationId = null, action, entity, summary, severity = 'info', ip = null, req = null }) {
  try {
    const resolvedIp = ip
      || (req && (req.ip || req.headers?.['x-forwarded-for'] || null))
      || null;
    await AuditLog.create({
      actorId: actorId ? String(actorId) : null,
      organizationId: organizationId ? String(organizationId) : null,
      action,
      entity,
      summary,
      severity,
      ip: typeof resolvedIp === 'string' ? resolvedIp.split(',')[0].trim() : resolvedIp,
    });
  } catch (err) {
    console.error('❌ Failed to write audit log:', err.message);
  }
}

// Route-friendly wrapper: derives actor/org/ip from the request.
export function auditFromReq(req, action, entity, summary, severity = 'info') {
  return writeAudit({
    actorId: req?.user?._id || null,
    organizationId: req?.user?.organizationId || null,
    action, entity, summary, severity,
    req,
  });
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

// ---------- login throttling ----------
// Per-email failed-attempt tracking with a temporary lockout. In-memory:
// effective for a single long-lived server instance; on serverless each
// warm instance keeps its own map (still raises the bar considerably).
// For strict global limits, front the API with a Redis-backed limiter.

const loginAttempts = new Map();

export function loginGuard(email) {
  const key = String(email || '').toLowerCase();
  const rec = loginAttempts.get(key);
  if (rec && rec.lockedUntil && new Date(rec.lockedUntil) > new Date()) {
    const mins = Math.ceil((new Date(rec.lockedUntil) - Date.now()) / 60000);
    const err = new Error(`Too many failed attempts — try again in ${mins} minute${mins > 1 ? 's' : ''}.`);
    err.status = 429;
    throw err;
  }
}

export function loginFail(email) {
  const key = String(email || '').toLowerCase();
  const now = new Date();
  const rec = loginAttempts.get(key) || { count: 0, firstAt: now, lockedUntil: null };
  if (now - new Date(rec.firstAt) > LOCKOUT_MIN * 60000) {
    rec.count = 0;
    rec.firstAt = now;
  }
  rec.count += 1;
  if (rec.count >= MAX_LOGIN_ATTEMPTS) {
    rec.lockedUntil = new Date(now.getTime() + LOCKOUT_MIN * 60000);
    rec.count = 0;
    rec.firstAt = now;
  }
  loginAttempts.set(key, rec);
}

export function loginOk(email) {
  loginAttempts.delete(String(email || '').toLowerCase());
}
