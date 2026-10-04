import { useEffect } from 'react'
import { useApp } from './context/AppContext.jsx'
import { useRoute, navigate } from './lib/router.jsx'
import { PERMS, roleHasPermission, landingPath, isPlatformRole, ROLES } from './lib/roles.js'
import { api } from './api/index.js'
import AppShell from './components/layout/AppShell.jsx'
import Login from './pages/Login.jsx'
import PlatformDashboard from './pages/platform/PlatformDashboard.jsx'
import PlatformRevenue from './pages/platform/PlatformRevenue.jsx'
import Organizations from './pages/platform/Organizations.jsx'
import PlatformSupport from './pages/platform/PlatformSupport.jsx'
import SubscriptionPlans from './pages/platform/SubscriptionPlans.jsx'
import Templates from './pages/platform/Templates.jsx'
import TeamAndRoles from './pages/platform/TeamAndRoles.jsx'
import AuditLogs from './pages/platform/AuditLogs.jsx'
import GallerySettings from './pages/platform/GallerySettings.jsx'
import OrgDashboard from './pages/org/OrgDashboard.jsx'
import OrgRevenue from './pages/org/OrgRevenue.jsx'
import EventsDevices from './pages/org/EventsDevices.jsx'
import OrgPlatformSupport from './pages/org/PlatformSupport.jsx'
import Support from './pages/org/Support.jsx'
import OrgDefaults from './pages/org/OrgDefaults.jsx'
import OrgTeam from './pages/org/Team.jsx'
import Coupons from './pages/org/Coupons.jsx'
import Gallery from './pages/org/Gallery.jsx'
import Profile from './pages/Profile.jsx'

// Route table — guard = required permission (server also enforces these).
const ROUTES = {
  '/platform/dashboard': { comp: PlatformDashboard, perm: PERMS.PLATFORM_DASHBOARD_VIEW, scope: 'platform' },
  '/platform/revenue': { comp: PlatformRevenue, perm: PERMS.PLATFORM_REVENUE_VIEW, scope: 'platform' },
  '/platform/organizations': { comp: Organizations, perm: PERMS.PLATFORM_ORGS_VIEW, scope: 'platform' },
  '/platform/support': { comp: PlatformSupport, perm: PERMS.PLATFORM_SUPPORT_VIEW, scope: 'platform' },
  '/platform/plans': { comp: SubscriptionPlans, perm: PERMS.SUBSCRIPTION_PLANS_MANAGE, scope: 'platform' },
  '/platform/templates': { comp: Templates, perm: PERMS.GLOBAL_TEMPLATES_MANAGE, scope: 'platform' },
  '/platform/team': { comp: TeamAndRoles, roles: [ROLES.OWNER, ROLES.PLATFORM_ADMIN], scope: 'platform' },
  '/platform/gallery-settings': { comp: GallerySettings, perm: PERMS.PLATFORM_GALLERY_SETTINGS, scope: 'platform' },
  '/platform/audit': { comp: AuditLogs, perm: PERMS.PLATFORM_AUDIT_VIEW, scope: 'platform' },
  '/org/dashboard': { comp: OrgDashboard, perm: PERMS.ORG_DASHBOARD_VIEW, scope: 'org' },
  '/org/revenue': { comp: OrgRevenue, perm: PERMS.ORG_REVENUE_VIEW, scope: 'org' },
  '/org/events': { comp: EventsDevices, perm: PERMS.EVENTS_DEVICES_MANAGE, scope: 'org' },
  '/org/gallery': { comp: Gallery, perm: PERMS.ORG_GALLERY_VIEW, scope: 'org' },
  '/org/team': { comp: OrgTeam, perm: PERMS.ORG_TEAM_VIEW, scope: 'org' },
  '/org/platform-support': { comp: OrgPlatformSupport, perm: PERMS.ORG_PLATFORM_SUPPORT, scope: 'org' },
  '/org/support': { comp: Support, perm: PERMS.TICKETS_RESOLVE, scope: 'org' },
  '/org/defaults': { comp: OrgDefaults, perm: PERMS.DEFAULTS_VIEW, scope: 'org' },
  '/org/coupons': { comp: Coupons, perm: PERMS.COUPONS_MANAGE, scope: 'org' },
  '/profile': { comp: Profile, perm: PERMS.PROFILE_EDIT, scope: 'any' },
}

export default function App() {
  const { user, isAuthed, updateUser } = useApp()
  const path = useRoute()

  // Attach org name for the topbar chip (org roles only).
  useEffect(() => {
    if (user && !isPlatformRole(user.role) && !user.orgName) {
      api.org.dashboard()
        .then((r) => updateUser({ ...user, orgName: r.organization.name, planStatus: r.plan.status }))
        .catch(() => {})
    }
  }, [user?.id])

  if (!isAuthed) {
    if (path !== '/login') navigate('/login')
    return <Login />
  }

  if (path === '/login') {
    navigate(landingPath(user.role))
    return null
  }

  const route = ROUTES[path]

  // Unknown route or not allowed → landing page.
  if (!route) {
    navigate(landingPath(user.role))
    return null
  }
  if (route.scope === 'platform' && !isPlatformRole(user.role)) {
    navigate(landingPath(user.role))
    return null
  }
  if (route.scope === 'org' && isPlatformRole(user.role)) {
    navigate(landingPath(user.role))
    return null
  }
  if (route.perm && !roleHasPermission(user.role, route.perm)) {
    navigate(landingPath(user.role))
    return null
  }
  if (route.roles && !route.roles.includes(user.role)) {
    navigate(landingPath(user.role))
    return null
  }

  const Comp = route.comp
  return (
    <AppShell>
      <Comp key={path} />
    </AppShell>
  )
}
