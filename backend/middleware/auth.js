// ============================================================
// Authentication + authorization middleware.
//
// Fixes:
//   #1/#2  suspended orgs can sign in read-only; banned orgs cannot at all
//   #2/#30 banned organizations invalidate sessions immediately (token
//          version bump) and every guarded route answers 403 ORG_BANNED
//   #14    roles are normalised, so legacy/cased values never produce a
//          false "Your role does not permit this action"
//   #15    permission decisions come from config/permissions.js — the same
//          matrix the CRM frontend and mock API use
//   SEC-03 tenant scoping fails closed for internal roles
// ============================================================

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import {
  ROLES, PERMS, normalizeRole, roleHasPermission, permissionsFor, isOrgRole,
} from '../config/permissions.js';

const JWT_TTL = process.env.JWT_TTL || '12h';
const JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail closed in EVERY environment — a hardcoded fallback secret lets
    // anyone forge admin tokens against any deployment that forgot the env.
    throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET is not set. Refusing to sign/verify tokens.');
  }
  return secret;
};

/** Sign a JWT that carries the user's session version (see bumpSessionVersion). */
export function issueToken(user) {
  const role = normalizeRole(user.role) || user.role;
  return jwt.sign(
    {
      id: String(user._id || user.id),
      role,
      organizationId: user.organizationId ? String(user.organizationId) : null,
      ver: Number(user.sessionVersion) || 0,
    },
    JWT_SECRET(),
    { expiresIn: JWT_TTL, algorithm: 'HS256' },
  );
}

/**
 * Issue #2/#30: invalidate every cached session for an organization
 * (ban, hard delete, org-wide sign-out) without touching the DB per request
 * beyond the user's own `sessionVersion` compare.
 */
export async function bumpSessionVersion(organizationId) {
  await User.updateMany(
    { organizationId },
    { $inc: { sessionVersion: 1 } },
    { strict: false },
  );
  await Organization.findByIdAndUpdate(organizationId, { $inc: { sessionVersion: 1 } });
}

/** Attach req.user / req.organization (normalised + lifecycle aware). */
export const authenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.hp_admin_token;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) token = authHeader.split(' ')[1];
    }
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.', code: 'UNAUTHENTICATED' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET(), { algorithms: ['HS256'] });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired. Please login again.', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token.', code: 'BAD_TOKEN' });
    }

    const user = await User.findById(decoded.id).select('-password -forgotPasswordCodeHash');
    if (!user) return res.status(401).json({ error: 'Invalid token. User not found.', code: 'USER_NOT_FOUND' });

    // Server-side session revocation (#2, #30).
    const issuedVersion = Number(decoded.ver) || 0;
    const currentVersion = Number(user.sessionVersion) || 0;
    if (issuedVersion !== currentVersion) {
      return res.status(401).json({
        error: 'This session is no longer valid. Please sign in again.',
        code: 'SESSION_REVOKED',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is deactivated.', code: 'ACCOUNT_DEACTIVATED' });
    }

    // Normalise the role once, here, so nothing downstream sees legacy values.
    user.role = normalizeRole(user.role) || user.role;
    req.user = user;
    req.permissions = permissionsFor(user.role);
    req.organizationId = user.organizationId ? String(user.organizationId) : null;

    if (user.organizationId) {
      const org = await Organization.findById(user.organizationId);
      if (!org) {
        return res.status(403).json({
          error: 'Your organization is no longer available. Please contact HappyPix support.',
          code: 'ORG_MISSING',
        });
      }
      // Issue #2: a banned organization loses CRM access immediately.
      if (org.status === 'banned') {
        await bumpSessionVersion(org._id).catch(() => {});
        return res.status(403).json({
          error: 'This organization has been banned. Contact HappyPix support.',
          code: 'ORG_BANNED',
          banned: true,
        });
      }
      req.organization = org;
      // Issue #1: suspended organizations keep read-only CRM access.
      req.orgReadOnly = org.status === 'suspended';
      req.orgStatus = org.status || 'active';
      req.organizationId = String(org._id);
    } else {
      req.orgStatus = 'active';
      req.orgReadOnly = false;
    }

    next();
  } catch (error) {
    console.error('❌ Auth error:', error);
    return res.status(401).json({ error: 'Invalid token.', code: 'BAD_TOKEN' });
  }
};

/** Role gate — normalized on both sides (issue #14). */
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHENTICATED' });
  const wanted = roles.map((role) => normalizeRole(role)).filter(Boolean);
  const actual = normalizeRole(req.user.role);
  if (!actual || !wanted.includes(actual)) {
    return res.status(403).json({
      error: 'Insufficient permissions.',
      code: 'FORBIDDEN',
      role: actual || req.user.role,
    });
  }
  next();
};

/** Permission gate — the fix for #14/#15/#119. */
export const requirePerm = (perm) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHENTICATED' });
  if (!roleHasPermission(req.user.role, perm)) {
    return res.status(403).json({
      error: `Your role does not permit this action (${perm}).`,
      code: 'FORBIDDEN_PERMISSION',
      permission: perm,
      role: normalizeRole(req.user.role),
    });
  }
  next();
};

export const requireAnyPerm = (...perms) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHENTICATED' });
  if (!perms.some((perm) => roleHasPermission(req.user.role, perm))) {
    return res.status(403).json({
      error: `Your role does not permit this action (${perms.join(' | ')}).`,
      code: 'FORBIDDEN_PERMISSION',
      role: normalizeRole(req.user.role),
    });
  }
  next();
};

/**
 * Issue #1: writes are blocked for suspended organizations. Applied to the
 * organization write routes; the message explains what is still possible.
 */
export const requireWritableOrg = (req, res, next) => {
  if (req.orgReadOnly || req.organization?.status === 'suspended') {
    return res.status(403).json({
      error: 'Your organization is suspended — account information is read-only until it is restored.',
      code: 'ORG_SUSPENDED',
      readOnly: true,
    });
  }
  if (req.organization?.status === 'banned') {
    return res.status(403).json({ error: 'This organization has been banned. Contact HappyPix support.', code: 'ORG_BANNED' });
  }
  next();
};

// ─── CRM v2 workspaces (kept for backwards compatibility) ───────

export const requirePlatformRole = [authenticate, authorize(ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER)];
export const requireOrgRole = [authenticate, authorize(ROLES.ORG_ADMIN, ROLES.ORG_MANAGER)];
export const requireOrgAdmin = [authenticate, authorize(ROLES.ORG_ADMIN)];
export const requireOwner = [authenticate, authorize(ROLES.OWNER)];
export const requireAuth = authenticate;

/**
 * Issue #11: Platform Admin + Support Manager get read-only access to
 * platform users; Owner manages them. Handy shorthand for the routes.
 */
export const requirePlatformTeamView = [authenticate, requirePerm(PERMS.PLATFORM_TEAM_VIEW)];
export const requirePlatformTeamManage = [authenticate, requirePerm(PERMS.PLATFORM_USERS_MANAGE)];

/**
 * Tenant scoping (P0 SEC-03) — fails closed.
 * Internal roles never receive `{}`; org roles are pinned to their org.
 */
export function getOrgFilter(user) {
  const role = normalizeRole(user && user.role);
  if (!user || !isOrgRole(role)) return { organizationId: null };
  const organizationId = user.organizationId || null;
  if (!organizationId) return { organizationId: null };
  return { organizationId };
}

/** Explicit org id scoping for platform routes that take an :orgId param. */
export function orgScopeFilter(user, requestedOrgId = null) {
  const role = normalizeRole(user && user.role);
  if (isOrgRole(role)) return { organizationId: user.organizationId || null };
  return requestedOrgId ? { organizationId: requestedOrgId } : {};
}

export { roleHasPermission, permissionsFor, normalizeRole, isOrgRole };

export default {
  authenticate, authorize, requirePerm, requireAnyPerm, requireWritableOrg,
  issueToken, bumpSessionVersion, getOrgFilter, orgScopeFilter, requirePlatformRole,
  requireOrgRole, requireOrgAdmin, requireOwner, requireAuth,
};
