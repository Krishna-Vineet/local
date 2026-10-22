// ============================================================
// Single source of truth for roles + permissions (backend side).
//
// Mirrors `crm/src/lib/roles.js` EXACTLY (matrix + permission keys).
// `backend/tests/permissions.parity.test.js` imports both files and
// fails the build if they ever drift, so the frontend route guards,
// the CRM mock API and this backend can never disagree (issue #15).
//
// Role values are normalised on the way in (issue #14): legacy or
// differently-cased values such as "owner", "OrgAdmin", "org-admin",
// "SUPER_ADMIN" no longer produce false "Your role does not permit
// this action" errors.
// ============================================================

export const ROLES = {
  OWNER: 'OWNER',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  SUPPORT_MANAGER: 'SUPPORT_MANAGER',
  ORG_ADMIN: 'ORG_ADMIN',
  ORG_MANAGER: 'ORG_MANAGER',
};

export const ROLE_LABELS = {
  [ROLES.OWNER]: 'Owner',
  [ROLES.PLATFORM_ADMIN]: 'Platform Admin',
  [ROLES.SUPPORT_MANAGER]: 'Support Manager',
  [ROLES.ORG_ADMIN]: 'Organization Admin',
  [ROLES.ORG_MANAGER]: 'Organization Manager',
};

export const PLATFORM_ROLES = [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER];
export const ORG_ROLES = [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER];

// Legacy / alias values seen in old databases and seed scripts.
// Everything maps onto the five canonical roles above.
const ROLE_ALIASES = {
  'OWNER': ROLES.OWNER,
  'SUPER_ADMIN': ROLES.OWNER,
  'SUPERADMIN': ROLES.OWNER,
  'ADMIN': ROLES.PLATFORM_ADMIN,
  'PLATFORM_ADMIN': ROLES.PLATFORM_ADMIN,
  'PLATFORMADMIN': ROLES.PLATFORM_ADMIN,
  'SUPPORT_MANAGER': ROLES.SUPPORT_MANAGER,
  'SUPPORTMANAGER': ROLES.SUPPORT_MANAGER,
  'SUPPORT': ROLES.SUPPORT_MANAGER,
  'ORG_ADMIN': ROLES.ORG_ADMIN,
  'ORGADMIN': ROLES.ORG_ADMIN,
  'ORGANIZATION_ADMIN': ROLES.ORG_ADMIN,
  'CLIENT_ADMIN': ROLES.ORG_ADMIN,
  'CLIENT': ROLES.ORG_ADMIN,
  'ORG_MANAGER': ROLES.ORG_MANAGER,
  'ORGMANAGER': ROLES.ORG_MANAGER,
  'ORGANIZATION_MANAGER': ROLES.ORG_MANAGER,
  'CLIENT_MANAGER': ROLES.ORG_MANAGER,
  'MANAGER': ROLES.ORG_MANAGER,
};

/**
 * Normalise any incoming role string to a canonical role.
 * Returns null when the value cannot be mapped (callers decide whether
 * that is a 403 or a validation error).
 */
export function normalizeRole(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toUpperCase().replace(/[\s.-]+/g, '_');
  return ROLE_ALIASES[key] || null;
}

export function isPlatformRole(role) {
  return PLATFORM_ROLES.includes(normalizeRole(role));
}

export function isOrgRole(role) {
  return ORG_ROLES.includes(normalizeRole(role));
}

export function isRole(raw, role) {
  return normalizeRole(raw) === role;
}

// Permission keys — resource.action style, per spec section 4/5.
export const PERMS = {
  PLATFORM_REVENUE_VIEW: 'platform.revenue.view',
  PLATFORM_DASHBOARD_VIEW: 'platform.dashboard.view',
  PLATFORM_ORGS_VIEW: 'platform.organizations.view',
  PLATFORM_ORG_SUSPEND: 'platform.organizations.suspend',
  PLATFORM_AUDIT_VIEW: 'platform.audit.view',
  ORG_AUDIT_VIEW: 'organization.audit.view',
  PLATFORM_USERS_MANAGE: 'platform.users.manage',
  // Issues #8, #9, #11: Platform Admin AND Support Manager may open the
  // Platform Team & Roles page; both get read-only visibility of platform
  // users. Only the Owner can create/deactivate accounts.
  PLATFORM_TEAM_VIEW: 'platform.team.view',
  SUBSCRIPTION_PLANS_MANAGE: 'platform.subscription-plans.manage',
  PLATFORM_SUPPORT_VIEW: 'platform.organization-support.view',
  ORG_PLATFORM_SUPPORT: 'organization.platform-support.use',
  ORG_TEAM_VIEW: 'organization.team.view',
  ORG_TEAM_MANAGE: 'organization.team.manage',
  EVENTS_DEVICES_MANAGE: 'organization.events.devices.manage',
  ORG_REVENUE_VIEW: 'organization.revenue.view',
  ORG_DASHBOARD_VIEW: 'organization.dashboard.view',
  TICKETS_RESOLVE: 'organization.tickets.view.resolve',
  COUPONS_MANAGE: 'organization.coupons.manage',
  DEFAULTS_VIEW: 'organization.defaults.view',
  DEFAULTS_EDIT: 'organization.defaults.edit',
  EVENT_CREATE: 'organization.events.create',
  EVENT_EDIT: 'organization.events.edit',
  GLOBAL_TEMPLATES_MANAGE: 'platform.templates.manage',
  PLATFORM_TEMPLATE_LAYOUTS_MANAGE: 'platform.template-layouts.manage',
  PLATFORM_LEADS_MANAGE: 'platform.leads.manage',
  GLOBAL_TEMPLATES_USE: 'organization.events.templates.use',
  PROFILE_EDIT: 'profile.edit',
  PLATFORM_GALLERY_SETTINGS: 'platform.gallery.settings',
  ORG_GALLERY_VIEW: 'organization.gallery.view',
};

// The fixed matrix. Nobody can change it — not even the Owner.
export const ROLE_MATRIX = {
  [PERMS.PLATFORM_REVENUE_VIEW]: [ROLES.OWNER],
  [PERMS.PLATFORM_DASHBOARD_VIEW]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER],
  [PERMS.PLATFORM_ORGS_VIEW]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER],
  [PERMS.PLATFORM_ORG_SUSPEND]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN],
  [PERMS.PLATFORM_AUDIT_VIEW]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN],
  [PERMS.ORG_AUDIT_VIEW]: [ROLES.ORG_ADMIN],
  [PERMS.PLATFORM_USERS_MANAGE]: [ROLES.OWNER],
  [PERMS.PLATFORM_TEAM_VIEW]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER],
  [PERMS.SUBSCRIPTION_PLANS_MANAGE]: [ROLES.OWNER],
  [PERMS.PLATFORM_LEADS_MANAGE]: [ROLES.OWNER],
  [PERMS.PLATFORM_SUPPORT_VIEW]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER],
  [PERMS.ORG_PLATFORM_SUPPORT]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.ORG_TEAM_VIEW]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.ORG_TEAM_MANAGE]: [ROLES.ORG_ADMIN],
  [PERMS.EVENTS_DEVICES_MANAGE]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.ORG_REVENUE_VIEW]: [ROLES.ORG_ADMIN],
  [PERMS.ORG_DASHBOARD_VIEW]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  // Issue #6: Organization Admins have full Guest Support (view, reply,
  // resolve, reopen) — managers keep the same operational access.
  [PERMS.TICKETS_RESOLVE]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.COUPONS_MANAGE]: [ROLES.ORG_ADMIN],
  [PERMS.DEFAULTS_VIEW]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.DEFAULTS_EDIT]: [ROLES.ORG_ADMIN],
  [PERMS.EVENT_CREATE]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  // Issue #7: Admins AND managers may edit events / manage devices.
  [PERMS.EVENT_EDIT]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.GLOBAL_TEMPLATES_MANAGE]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN],
  [PERMS.PLATFORM_TEMPLATE_LAYOUTS_MANAGE]: [ROLES.OWNER],
  [PERMS.GLOBAL_TEMPLATES_USE]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  // Issues #12, #13: Owner + Platform Admin own the gallery policy.
  [PERMS.PLATFORM_GALLERY_SETTINGS]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN],
  [PERMS.ORG_GALLERY_VIEW]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.PROFILE_EDIT]: [
    ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER,
  ],
};

/** roleHasPermission('orgadmin', PERMS.EVENT_EDIT) === true */
export function roleHasPermission(rawRole, perm) {
  const role = normalizeRole(rawRole);
  const allowed = ROLE_MATRIX[perm];
  return !!role && !!allowed && allowed.includes(role);
}

export function permissionsFor(rawRole) {
  const role = normalizeRole(rawRole);
  if (!role) return [];
  return Object.entries(ROLE_MATRIX)
    .filter(([, roles]) => roles.includes(role))
    .map(([perm]) => perm);
}

/** Read-only roles for the Platform Team & Roles page (#11). */
export function isPlatformTeamReadOnly(rawRole) {
  return normalizeRole(rawRole) !== ROLES.OWNER;
}

export default {
  ROLES, ROLE_LABELS, PERMS, ROLE_MATRIX, normalizeRole, isPlatformRole, isOrgRole,
  roleHasPermission, permissionsFor, isPlatformTeamReadOnly,
};
