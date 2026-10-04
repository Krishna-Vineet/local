// Shell: dark sidebar (role-derived nav) + topbar (org context, user menu).

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { Link, useRoute, navigate } from '../../lib/router.jsx'
import { Icon } from '../../lib/icons.jsx'
import { BrandMark, FullLogo, Wordmark } from '../Logo.jsx'
import { Avatar } from '../ui.jsx'
import { navForRole, ROLE_LABELS, isPlatformRole, ROLES } from '../../lib/roles.js'
import { statusMeta } from '../../lib/plans.js'
import { demoReset } from '../../api/client.js'

function UserMenu() {
  const { user, logout, useMock, theme, toggleTheme } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open])

  if (!user) return null
  return (
    <div className="usermenu" ref={ref}>
      <button className="row gap-12" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px 8px', borderRadius: 8 }} onClick={() => setOpen(!open)}>
        <Avatar name={user.name} size={32} />
        <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 640 }}>{user.name}</span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--faint)', fontWeight: 600 }}>{ROLE_LABELS[user.role]}</span>
        </span>
        <Icon name="chevron-down" size={14} style={{ color: 'var(--faint)' }} />
      </button>
      {open && (
        <div className="usermenu-panel">
          <div className="usermenu-head">
            <div style={{ fontSize: 13.5, fontWeight: 650 }}>{user.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }} className="ellipsis">{user.email}</div>
          </div>
          <button className="usermenu-item" onClick={() => { setOpen(false); navigate('/profile') }}>
            <Icon name="user" size={15} /> Profile
          </button>
          <button className="usermenu-item" onClick={toggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          {useMock && (
            <button className="usermenu-item" onClick={() => { setOpen(false); demoReset() }}>
              <Icon name="refresh" size={15} /> Reset demo data
            </button>
          )}
          <button className="usermenu-item danger" onClick={logout}>
            <Icon name="logout" size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppShell({ children }) {
  const { user } = useApp()
  const path = useRoute()
  const nav = user ? navForRole(user.role) : []
  const platform = isPlatformRole(user?.role)

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <FullLogo size={18} height={30} onDark />
          <div className="brand-text">
            <Wordmark size={13} onDark suffix="CRM" sub={platform ? 'HappyPix Platform' : user?.orgName || 'Organization'} />
          </div>
        </div>
        <nav className="sidebar-nav">
          {nav.map((section) => (
            <div key={section.section}>
              <div className="nav-section">{section.section}</div>
              {section.items.map((item) => (
                <Link key={item.id} to={item.path} className={`nav-item${path === item.path ? ' active' : ''}`}>
                  <Icon name={item.icon} size={17} />
                  <span className="nav-label">{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="grow" />
          <TopContext />
          <UserMenu />
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

function TopContext() {
  const { user } = useApp()
  if (!user) return null
  if (isPlatformRole(user.role)) {
    return (
      <span className="chip chip-pink" style={{ height: 26, fontSize: 12 }}>
        <span className="dot" />
        Platform · {user.role === ROLES.OWNER ? 'Owner console' : 'Internal'}
      </span>
    )
  }
  return (
    <span className="chip chip-neutral" style={{ height: 26, fontSize: 12, gap: 8 }}>
      <Icon name="building" size={13} />
      {user.orgName || 'Organization'}
      {user.planStatus ? (
        <span className={`chip ${statusMeta(user.planStatus).chip}`} style={{ height: 18, padding: '0 7px', fontSize: 10.5 }}>
          {statusMeta(user.planStatus).label}
        </span>
      ) : null}
    </span>
  )
}
