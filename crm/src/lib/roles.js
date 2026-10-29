// ============================================================
// Fixed role & permission model — single source of truth.
// Mirrors 03-role-and-permission-spec.md exactly.
// Used by the CRM navigation AND the mock backend, so UI and
// API can never disagree. No role is mutable anywhere.
// ============================================================

export const ROLES = {
  OWNER: 'OWNER',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  SUPPORT_MANAGER: 'SUPPORT_MANAGER',
  ORG_ADMIN: 'ORG_ADMIN',
  ORG_MANAGER: 'ORG_MANAGER',
}

export const ROLE_LABELS = {
  [ROLES.OWNER]: 'Owner',
  [ROLES.PLATFORM_ADMIN]: 'Platform Admin',
  [ROLES.SUPPORT_MANAGER]: 'Support Manager',
  [ROLES.ORG_ADMIN]: 'Organization Admin',
  [ROLES.ORG_MANAGER]: 'Organization Manager',
}

export const ROLE_DESCRIPTIONS = {
  [ROLES.OWNER]: 'Top-level HappyPix owner. Platform governance, revenue, organization suspension, internal team, global templates.',
  [ROLES.PLATFORM_ADMIN]: 'Internal HappyPix admin. Monitors organizations and platform health, manages global templates. No revenue, no edits.',
  [ROLES.SUPPORT_MANAGER]: 'Internal support. Minimal read-only CRM visibility for client-support context. Handles client communication outside CRM.',
  [ROLES.ORG_ADMIN]: 'Client-side admin for one organization. Events, devices, revenue, coupons, defaults, team, and guest tickets.',
  [ROLES.ORG_MANAGER]: 'Client-side manager. Operates events, devices, and guest support. No revenue, no coupons, no defaults, no team.',
}

export const PLATFORM_ROLES = [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER]
export const ORG_ROLES = [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER]

// Issue #14: legacy / differently-cased role values must never cause a false
// "Your role does not permit this action". Every lookup normalises first.
const ROLE_ALIASES = {
  OWNER: ROLES.OWNER,
  SUPER_ADMIN: ROLES.OWNER,
  SUPERADMIN: ROLES.OWNER,
  ADMIN: ROLES.PLATFORM_ADMIN,
  PLATFORM_ADMIN: ROLES.PLATFORM_ADMIN,
  PLATFORMADMIN: ROLES.PLATFORM_ADMIN,
  SUPPORT_MANAGER: ROLES.SUPPORT_MANAGER,
  SUPPORTMANAGER: ROLES.SUPPORT_MANAGER,
  SUPPORT: ROLES.SUPPORT_MANAGER,
  ORG_ADMIN: ROLES.ORG_ADMIN,
  ORGADMIN: ROLES.ORG_ADMIN,
  ORGANIZATION_ADMIN: ROLES.ORG_ADMIN,
  CLIENT_ADMIN: ROLES.ORG_ADMIN,
  CLIENT: ROLES.ORG_ADMIN,
  ORG_MANAGER: ROLES.ORG_MANAGER,
  ORGMANAGER: ROLES.ORG_MANAGER,
  ORGANIZATION_MANAGER: ROLES.ORG_MANAGER,
  CLIENT_MANAGER: ROLES.ORG_MANAGER,
  MANAGER: ROLES.ORG_MANAGER,
}

export function normalizeRole(raw) {
  if (!raw) return null
  const key = String(raw).trim().toUpperCase().replace(/[\s.-]+/g, '_')
  return ROLE_ALIASES[key] || null
}

export function isPlatformRole(role) {
  return PLATFORM_ROLES.includes(normalizeRole(role))
}
export function isOrgRole(role) {
  return ORG_ROLES.includes(normalizeRole(role))
}
export function roleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || String(role || '')
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
  // Issues #8/#9/#11: Platform Admin AND Support Manager may open Team & Roles
  // (read-only); only the Owner manages accounts.
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
  GLOBAL_TEMPLATES_USE: 'organization.events.templates.use',
  PLATFORM_TEMPLATE_LAYOUTS_MANAGE: 'platform.template-layouts.manage',
  PLATFORM_LEADS_MANAGE: 'platform.leads.manage',
  PROFILE_EDIT: 'profile.edit',
  PLATFORM_GALLERY_SETTINGS: 'platform.gallery.settings',
  ORG_GALLERY_VIEW: 'organization.gallery.view',
}

// The fixed matrix. Nobody can change it.
// `backend/config/permissions.js` mirrors this object exactly — the parity
// test in backend/tests/permissions.parity.test.js fails if they drift (#15).
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
  [PERMS.TICKETS_RESOLVE]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.COUPONS_MANAGE]: [ROLES.ORG_ADMIN],
  [PERMS.DEFAULTS_VIEW]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.DEFAULTS_EDIT]: [ROLES.ORG_ADMIN],
  [PERMS.EVENT_CREATE]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  // Issue #7: Org Admin AND Org Manager may edit events / manage devices.
  [PERMS.EVENT_EDIT]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.GLOBAL_TEMPLATES_MANAGE]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN],
  [PERMS.GLOBAL_TEMPLATES_USE]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.PLATFORM_TEMPLATE_LAYOUTS_MANAGE]: [ROLES.OWNER],
  [PERMS.PLATFORM_GALLERY_SETTINGS]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN],
  [PERMS.ORG_GALLERY_VIEW]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.PROFILE_EDIT]: [
    ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER,
  ],
}

export function roleHasPermission(role, perm) {
  const normalized = normalizeRole(role)
  const allowed = ROLE_MATRIX[perm]
  return !!normalized && !!allowed && allowed.includes(normalized)
}

/** Alias so components can read `can(user.role, PERMS.X)` naturally. */
export const can = roleHasPermission

export function rolePermissions(role) {
  const normalized = normalizeRole(role)
  if (!normalized) return []
  return Object.entries(ROLE_MATRIX)
    .filter(([, roles]) => roles.includes(normalized))
    .map(([perm]) => perm)
}

/** Issues #10/#11: Owner manages the platform team; everyone else reads. */
export function platformTeamReadOnly(role) {
  return normalizeRole(role) !== ROLES.OWNER
}

// Landing route per role (spec 04 §4, 05 §4)
export function landingPath(role) {
  return isPlatformRole(role) ? '/platform/dashboard' : '/org/dashboard'
}

/**
 * Where a role may land given the screens it can actually open
 * (a suspended Organization Admin still lands on the dashboard — the page
 * renders read-only instead of 403-ing the navigation).
 */
export function safeLandingPath(role, fallback = '/login') {
  const normalized = normalizeRole(role)
  if (!normalized) return fallback
  const preferred = landingPath(normalized)
  const items = navForRole(normalized).flatMap((section) => section.items)
  if (items.some((item) => item.path === preferred)) return preferred
  return items[0] ? items[0].path : fallback
}

// Screen registry: the ONLY place navigation is defined.
// Sidebar, route guards, and demo content all derive from this.
export const SCREENS = [
  {
    section: 'Platform',
    items: [
      { id: 'platform-dashboard', label: 'Dashboard', perm: PERMS.PLATFORM_DASHBOARD_VIEW, path: '/platform/dashboard', icon: 'dashboard' },
      { id: 'platform-revenue', label: 'Revenue', perm: PERMS.PLATFORM_REVENUE_VIEW, path: '/platform/revenue', icon: 'revenue' },
      { id: 'platform-orgs', label: 'Organizations', perm: PERMS.PLATFORM_ORGS_VIEW, path: '/platform/organizations', icon: 'building' },
      { id: 'platform-support', label: 'Organization Support', perm: PERMS.PLATFORM_SUPPORT_VIEW, path: '/platform/support', icon: 'headset' },
      { id: 'platform-leads', label: 'Website Leads', perm: PERMS.PLATFORM_LEADS_MANAGE, path: '/platform/leads', icon: 'mail' },
      { id: 'platform-plans', label: 'Subscription Plans', perm: PERMS.SUBSCRIPTION_PLANS_MANAGE, path: '/platform/plans', icon: 'tag' },
      { id: 'platform-templates', label: 'Template Library', perm: PERMS.GLOBAL_TEMPLATES_MANAGE, path: '/platform/templates', icon: 'template' },
      { id: 'platform-template-layouts', label: 'Template Layouts', perm: PERMS.PLATFORM_TEMPLATE_LAYOUTS_MANAGE, path: '/platform/template-layouts', icon: 'code' },
      { id: 'platform-team', label: 'Team & Roles', perm: PERMS.PLATFORM_USERS_MANAGE, path: '/platform/team', icon: 'users', viewOnlyFor: [ROLES.PLATFORM_ADMIN] },
      { id: 'platform-gallery-settings', label: 'Gallery Settings', perm: PERMS.PLATFORM_GALLERY_SETTINGS, path: '/platform/gallery-settings', icon: 'image' },
      { id: 'platform-audit', label: 'Audit & Logs', perm: PERMS.PLATFORM_AUDIT_VIEW, path: '/platform/audit', icon: 'log' },
    ],
  },
  {
    section: 'Organization',
    items: [
      { id: 'org-dashboard', label: 'Dashboard', perm: PERMS.ORG_DASHBOARD_VIEW, path: '/org/dashboard', icon: 'dashboard' },
      { id: 'org-templates', label: 'AI Templates', perm: PERMS.GLOBAL_TEMPLATES_USE, path: '/org/templates', icon: 'sparkles' },
      { id: 'org-custom-templates', label: 'Custom Templates', perm: PERMS.GLOBAL_TEMPLATES_USE, path: '/org/custom-templates', icon: 'template' },
      { id: 'org-revenue', label: 'Revenue', perm: PERMS.ORG_REVENUE_VIEW, path: '/org/revenue', icon: 'revenue' },
      { id: 'org-events', label: 'Events & Devices', perm: PERMS.EVENTS_DEVICES_MANAGE, path: '/org/events', icon: 'calendar' },
      { id: 'org-gallery', label: 'Gallery', perm: PERMS.ORG_GALLERY_VIEW, path: '/org/gallery', icon: 'image' },
      { id: 'org-team', label: 'Team & Roles', perm: PERMS.ORG_TEAM_VIEW, path: '/org/team', icon: 'users' },
      { id: 'org-platform-support', label: 'HappyPix Support', perm: PERMS.ORG_PLATFORM_SUPPORT, path: '/org/platform-support', icon: 'mail' },
      { id: 'org-support', label: 'Guest Support', perm: PERMS.TICKETS_RESOLVE, path: '/org/support', icon: 'headset' },
      { id: 'org-defaults', label: 'Organization Defaults', perm: PERMS.DEFAULTS_VIEW, path: '/org/defaults', icon: 'sliders' },
      { id: 'org-coupons', label: 'Coupons', perm: PERMS.COUPONS_MANAGE, path: '/org/coupons', icon: 'tag' },
    ],
  },
]

// Team & Roles is visible to Owner (manage), Platform Admin and Support
// Manager (read-only). Every other item is driven purely by the matrix.
function visibleItems(role) {
  const normalized = normalizeRole(role)
  const out = []
  for (const section of SCREENS) {
    const items = section.items.filter((item) => {
      if (!normalized) return false
      if (item.id === 'platform-team') return roleHasPermission(normalized, PERMS.PLATFORM_TEAM_VIEW)
      return roleHasPermission(normalized, item.perm)
    })
    if (items.length) out.push({ ...section, items })
  }
  return out
}

export function navForRole(role) {
  return visibleItems(role)
}

/** True when the current role must be shown read-only hints for a screen. */
export function isViewOnlyFor(role, screenId) {
  const normalized = normalizeRole(role)
  const screen = SCREENS.flatMap((section) => section.items).find((item) => item.id === screenId)
  if (!screen || !screen.viewOnlyFor) return false
  return screen.viewOnlyFor.includes(normalized)
}
