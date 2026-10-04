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

export function isPlatformRole(role) {
  return PLATFORM_ROLES.includes(role)
}
export function isOrgRole(role) {
  return ORG_ROLES.includes(role)
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
  GLOBAL_TEMPLATES_MANAGE: 'platform.templates.manage',
  GLOBAL_TEMPLATES_USE: 'organization.events.templates.use',
  PROFILE_EDIT: 'profile.edit',
  PLATFORM_GALLERY_SETTINGS: 'platform.gallery.settings',
  ORG_GALLERY_VIEW: 'organization.gallery.view',
}

// The fixed matrix. Nobody can change it.
const MATRIX = {
  [PERMS.PLATFORM_REVENUE_VIEW]: [ROLES.OWNER],
  [PERMS.PLATFORM_DASHBOARD_VIEW]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER],
  [PERMS.PLATFORM_ORGS_VIEW]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER],
  [PERMS.PLATFORM_ORG_SUSPEND]: [ROLES.OWNER],
  [PERMS.PLATFORM_AUDIT_VIEW]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN],
  [PERMS.ORG_AUDIT_VIEW]: [ROLES.ORG_ADMIN],
  [PERMS.PLATFORM_USERS_MANAGE]: [ROLES.OWNER],
  [PERMS.SUBSCRIPTION_PLANS_MANAGE]: [ROLES.OWNER],
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
  [PERMS.GLOBAL_TEMPLATES_MANAGE]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN],
  [PERMS.GLOBAL_TEMPLATES_USE]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.PLATFORM_GALLERY_SETTINGS]: [ROLES.OWNER, ROLES.PLATFORM_ADMIN],
  [PERMS.ORG_GALLERY_VIEW]: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  [PERMS.PROFILE_EDIT]: [
    ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER,
  ],
}

export function roleHasPermission(role, perm) {
  const allowed = MATRIX[perm]
  return !!allowed && allowed.includes(role)
}

export function rolePermissions(role) {
  return Object.entries(MATRIX)
    .filter(([, roles]) => roles.includes(role))
    .map(([perm]) => perm)
}

// Landing route per role (spec 04 §4, 05 §4)
export function landingPath(role) {
  return isPlatformRole(role) ? '/platform/dashboard' : '/org/dashboard'
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
      { id: 'platform-plans', label: 'Subscription Plans', perm: PERMS.SUBSCRIPTION_PLANS_MANAGE, path: '/platform/plans', icon: 'tag' },
      { id: 'platform-templates', label: 'Template Library', perm: PERMS.GLOBAL_TEMPLATES_MANAGE, path: '/platform/templates', icon: 'template' },
      { id: 'platform-team', label: 'Team & Roles', perm: PERMS.PLATFORM_USERS_MANAGE, path: '/platform/team', icon: 'users', viewOnlyFor: [ROLES.PLATFORM_ADMIN] },
      { id: 'platform-gallery-settings', label: 'Gallery Settings', perm: PERMS.PLATFORM_GALLERY_SETTINGS, path: '/platform/gallery-settings', icon: 'image' },
      { id: 'platform-audit', label: 'Audit & Logs', perm: PERMS.PLATFORM_AUDIT_VIEW, path: '/platform/audit', icon: 'log' },
    ],
  },
  {
    section: 'Organization',
    items: [
      { id: 'org-dashboard', label: 'Dashboard', perm: PERMS.ORG_DASHBOARD_VIEW, path: '/org/dashboard', icon: 'dashboard' },
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

// Team & Roles is visible to Owner (manage) and Platform Admin (read-only).
function visibleItems(role) {
  const out = []
  for (const section of SCREENS) {
    const items = section.items.filter((item) => {
      if (item.id === 'platform-team') {
        return role === ROLES.OWNER || role === ROLES.PLATFORM_ADMIN
      }
      return roleHasPermission(role, item.perm)
    })
    if (items.length) out.push({ ...section, items })
  }
  return out
}

export function navForRole(role) {
  return visibleItems(role)
}
