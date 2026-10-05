// Shared constants — mirrors crm/src/lib/plans.js and roles.js.
// The fixed role model, plan fallbacks, filter catalogue and time
// windows the CRM contract expects the backend to enforce.

export const ROLES = {
  OWNER: 'OWNER',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  SUPPORT_MANAGER: 'SUPPORT_MANAGER',
  ORG_ADMIN: 'ORG_ADMIN',
  ORG_MANAGER: 'ORG_MANAGER',
}

export const ROLE_LABELS = {
  OWNER: 'Owner',
  PLATFORM_ADMIN: 'Platform Admin',
  SUPPORT_MANAGER: 'Support Manager',
  ORG_ADMIN: 'Organization Admin',
  ORG_MANAGER: 'Organization Manager',
}

export const PLATFORM_ROLES = [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER]
export const ORG_ROLES = [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER]

// Fixed permission matrix (server-side source of truth, same as the CRM).
export const PERMS = {
  PLATFORM_REVENUE_VIEW: [ROLES.OWNER],
  PLATFORM_DASHBOARD_VIEW: [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER],
  PLATFORM_ORGS_VIEW: [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER],
  PLATFORM_ORG_SUSPEND: [ROLES.OWNER],
  PLATFORM_AUDIT_VIEW: [ROLES.OWNER, ROLES.PLATFORM_ADMIN],
  ORG_AUDIT_VIEW: [ROLES.ORG_ADMIN],
  PLATFORM_USERS_MANAGE: [ROLES.OWNER],
  SUBSCRIPTION_PLANS_MANAGE: [ROLES.OWNER],
  PLATFORM_SUPPORT_VIEW: [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER],
  ORG_PLATFORM_SUPPORT: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  ORG_TEAM_VIEW: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  ORG_TEAM_MANAGE: [ROLES.ORG_ADMIN],
  EVENTS_DEVICES_MANAGE: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  ORG_REVENUE_VIEW: [ROLES.ORG_ADMIN],
  ORG_DASHBOARD_VIEW: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  TICKETS_RESOLVE: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  COUPONS_MANAGE: [ROLES.ORG_ADMIN],
  DEFAULTS_VIEW: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  DEFAULTS_EDIT: [ROLES.ORG_ADMIN],
  EVENT_CREATE: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  GLOBAL_TEMPLATES_MANAGE: [ROLES.OWNER, ROLES.PLATFORM_ADMIN],
  GLOBAL_TEMPLATES_USE: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  PLATFORM_GALLERY_SETTINGS: [ROLES.OWNER, ROLES.PLATFORM_ADMIN],
  ORG_GALLERY_VIEW: [ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
  PROFILE_EDIT: [ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER],
}

export function roleHasPermission(role, perm) {
  const allowed = PERMS[perm]
  return !!allowed && allowed.includes(role)
}

// Plan fallbacks used when no SubscriptionPlan document exists for a key.
// Purchases happen on the website; limits here must match the catalogue.
export const DEFAULT_PLANS = {
  trial:        { key: 'trial',        name: 'Trial',        devices: 1,   events: 1,   price: 0,    durationMonths: 0 },
  starter:      { key: 'starter',      name: 'Starter',      devices: 1,   events: 1,   price: 1999, durationMonths: 3 },
  basic:        { key: 'basic',        name: 'Basic',        devices: 3,   events: 2,   price: 2999, durationMonths: 3 },
  professional: { key: 'professional', name: 'Professional', devices: 5,   events: 5,   price: 5999, durationMonths: 6 },
  business:     { key: 'business',     name: 'Business',     devices: 10,  events: 10,  price: 9999, durationMonths: 6 },
  custom:       { key: 'custom',       name: 'Custom',       devices: 25,  events: 20,  price: null, durationMonths: 12 },
  enterprise:   { key: 'enterprise',   name: 'Enterprise',   devices: -1,  events: -1,  price: null, durationMonths: 12 },
}

// Photo filters guests can be offered at the booth (selected per event).
export const FILTERS = [
  { id: 'original', label: 'Original' },
  { id: 'warm', label: 'Warm Glow' },
  { id: 'cool', label: 'Cool Tone' },
  { id: 'bw', label: 'Black & White' },
  { id: 'vintage', label: 'Vintage Film' },
  { id: 'neon', label: 'Neon Pop' },
  { id: 'soft', label: 'Soft Focus' },
  { id: 'party', label: 'Party Pop' },
]
export const FILTER_IDS = FILTERS.map((f) => f.id)

// Device "online" window — booth heartbeats every 2 minutes.
export const DEVICE_ONLINE_WINDOW_MS = 90 * 1000

// Wallet
export const MIN_WITHDRAWAL = 500

// Support enums
export const SUPPORT_STATUSES = ['new', 'denied', 'open', 'in_progress', 'resolved']
export const SUPPORT_CATEGORIES = ['technical', 'billing', 'account', 'feature', 'other']
export const SUPPORT_PRIORITIES = ['low', 'medium', 'high', 'urgent']
export const TICKET_CATEGORIES = ['device', 'payment', 'photo', 'event', 'general']

// Auth policy
export const SESSION_TTL_MIN = Number(process.env.SESSION_TTL_MIN || 480)
export const MAX_LOGIN_ATTEMPTS = Math.max(3, Number(process.env.MAX_LOGIN_ATTEMPTS || 5))
export const LOCKOUT_MIN = 15
