import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Organization from '../models/Organization.js';

/**
 * JWT Authentication Middleware
 */
export const authenticate = async (req, res, next, { allowBannedOrganization = false } = {}) => {
  try {
    let token = req.cookies?.hp_admin_token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    // Sessions are killed if status is inactive
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    // If tenant role, check organization status
    if (user.organizationId) {
      const org = await Organization.findById(user.organizationId);
      if (!org || (org.status === 'banned' && !allowBannedOrganization)) {
        return res.status(403).json({ error: 'Organization has been banned. Access denied.', code: 'ORG_BANNED' });
      }
      req.organization = org;
    }

    req.user = user;
    req.organizationId = user.organizationId || null;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

export const authenticateSession = (req, res, next) => (
  authenticate(req, res, next, { allowBannedOrganization: true })
);

/**
 * Role-based Authorization Middleware
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    next();
  };
};

// ─── CRM v2 Workspaces ──────────────────────────────────────────

/** Platform Workspace (Internal HappyPix Staff) */
export const requirePlatformRole = [authenticate, authorize('OWNER', 'PLATFORM_ADMIN', 'SUPPORT_MANAGER')];

/** Organization Workspace (Tenant Businesses) */
export const requireOrgRole = [authenticate, authorize('ORG_ADMIN', 'ORG_MANAGER')];

/** Only Org Admin */
export const requireOrgAdmin = [authenticate, authorize('ORG_ADMIN')];

/** Only HappyPix OWNER */
export const requireOwner = [authenticate, authorize('OWNER')];

/** Any authenticated user */
export const requireAuth = authenticate;

/**
 * Org Scope Helper (P0 SEC-03)
 * 
 * Returns the MongoDB filter to scope a query by organization.
 * Fails closed: internal roles never receive an empty object {} that exposes all tenants.
 */
export const getOrgFilter = (user) => {
  if (!user || !user.organizationId) {
    return { organizationId: null }; // Fail closed
  }
  
  if (['ORG_ADMIN', 'ORG_MANAGER'].includes(user.role)) {
    return { organizationId: user.organizationId };
  }
  
  // Platform roles calling tenant routes should fail unless they explicitly pass an org ID 
  // (which they do via the platform routes, not the org routes).
  return { organizationId: null };
};
