// Auth + toast state.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/index.js'
import { getToken, getUser, setSession, clearSession } from '../api/client.js'
import { landingPath, normalizeRole, roleHasPermission, can, platformTeamReadOnly } from '../lib/roles.js'
import { initialTheme, applyTheme } from '../lib/theme.js'
import Icon from '../lib/icons.jsx'

const Ctx = createContext(null)

export function useApp() {
  return useContext(Ctx)
}

export function AppProvider({ children }) {
  // Issue #14: whatever was stored (possibly a legacy role string) is
  // normalised immediately so every guard/permission check agrees.
  const [user, setUser] = useState(() => {
    const stored = getUser()
    if (!stored) return null
    const role = normalizeRole(stored.role)
    return role && role !== stored.role ? { ...stored, role } : stored
  })
  const [orgNotice, setOrgNotice] = useState(null)
  const [toasts, setToasts] = useState([])
  const [theme, setThemeState] = useState(initialTheme)
  const idRef = useRef(0)

  // Apply the chosen theme to <html> + persist it (Login / Profile toggles).
  useEffect(() => { applyTheme(theme) }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const toast = useCallback((message, type = 'success', ms = 3400) => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms)
  }, [])

  // Session hygiene:
  //  • revalidate on mount (token may have expired server-side)
  //  • re-check every 60 s and when the tab regains focus → expired sessions
  //    are signed out with a message instead of silently failing later
  //  • storage event: signing out in one tab signs out every tab
  useEffect(() => {
    if (!user || !getToken()) return
    let dead = false
    const check = () => {
      if (!getToken()) return
      api.auth.me()
        .then((r) => {
          if (dead) return
          // Never let a session payload that lacks the org display fields
          // wipe them (navbar org name / plan chip) — merge over previous.
          setUser((prev) => (prev && prev.id === r.user.id
            ? { ...r.user, orgName: r.user.orgName ?? prev.orgName ?? null, planStatus: r.user.planStatus ?? prev.planStatus ?? null }
            : r.user))
          // Issue #1: a suspended organization keeps read-only access, and the
          // banner explains exactly what is disabled.
          setOrgNotice(r.readOnly ? r.notice || { kind: 'suspended', title: 'Organization suspended', message: 'CRM access is read-only until HappyPix restores this organization.' } : null)
          if (r.token) setSession(r.token, r.user)
        })
        .catch((e) => {
          if (dead) return
          // Issues #2/#29/#30: banned → logged out, storage cleared, message shown.
          if (e && (e.banned || e.code === 'ORG_BANNED')) {
            clearSession()
            setUser(null)
            sessionStorage.setItem('hp_login_notice', e.message || 'This organization has been banned.')
            toast(e.message || 'This organization has been banned.', 'error', 8000)
            location.hash = '#/login'
            return
          }
          if (e && (e.status === 401 || e.code === 'SESSION_REVOKED')) {
            clearSession()
            setUser(null)
            toast('Your session has expired — please sign in again.', 'info', 5000)
          }
        })
    }
    check()
    const iv = setInterval(check, 60_000)
    const onFocus = () => { if (document.visibilityState === 'visible') check() }
    const onStorage = (ev) => { if (ev.key === 'hp_v2_token' && !ev.newValue) { setUser(null); location.hash = '#/login' } }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('storage', onStorage)
    return () => { dead = true; clearInterval(iv); document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('storage', onStorage) }
  }, [user?.id])

  const login = useCallback(async (email, password) => {
    try {
      const r = await api.auth.login(email, password)
      setSession(r.token, r.user)
      setUser({ ...r.user, role: normalizeRole(r.user.role) || r.user.role })
      setOrgNotice(r.readOnly ? r.notice : null)
      return r.user
    } catch (e) {
      // A banned organization cannot sign in at all — surface the reason.
      if (e && (e.banned || e.code === 'ORG_BANNED')) {
        clearSession()
        setUser(null)
      }
      throw e
    }
  }, [])

  const logout = useCallback(() => {
    // revoke server-side first (best effort), then drop local state
    api.auth.logout().catch(() => {})
    clearSession()
    setUser(null)
    setOrgNotice(null)
    location.hash = '#/login'
  }, [])

  const updateUser = useCallback((u) => {
    const next = { ...getUser(), ...u }
    setSession(getToken(), next)
    setUser(next)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthed: !!user && !!getToken(),
      login,
      logout,
      updateUser,
      toast,
      landing: user ? landingPath(user.role) : '/login',
      theme,
      toggleTheme,
      // Issue #15: components read permissions from the same matrix the
      // backend enforces, so UI hints can never disagree with the API.
      can: (perm) => roleHasPermission(user && user.role, perm),
      role: user ? normalizeRole(user.role) : null,
      readOnly: !!orgNotice,
      orgNotice,
      platformTeamReadOnly: user ? platformTeamReadOnly(user.role) : true,
      canFn: can,
    }),
    [user, login, logout, updateUser, toast, theme, toggleTheme, orgNotice]
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <Icon name={t.type === 'success' ? 'check-circle' : t.type === 'error' ? 'alert' : 'info'} size={17} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
