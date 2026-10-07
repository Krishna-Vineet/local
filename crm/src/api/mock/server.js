// ============================================================
// Mock API server — implements the v2 API contract with the
// SAME rules the real backend must have:
//   * JWT-style token auth (mock tokens)
//   * fixed permission matrix (lib/roles.js) enforced server-side
//   * organization scoping for org-role users
//   * plan-limit enforcement on create/assign
//   * derived statuses (plan, event, device online)
// ============================================================

import { getDb, persist } from './db.js'
import {
  ROLES, ROLE_LABELS, PERMS, roleHasPermission, isOrgRole, isPlatformRole,
} from '../../lib/roles.js'
import { PLANS, DEVICE_ONLINE_WINDOW_MS, FILTERS } from '../../lib/plans.js'
import { LAYOUT_FAMILIES, LAYOUT_BY_ID, layoutById, layoutLabel, suggestedPriceMap } from '../../lib/layouts.js'
import { monthKey, fyStart } from '../../lib/format.js'

const NOW = () => new Date('2026-09-24T11:30:00+05:30') // demo clock = "today"

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// ---------- security infrastructure ----------
// The mock enforces the same policies the production backend must
// (see BACKEND-CHANGES.md §6): session tokens with server-side expiry,
// login throttling with lockout, a password policy and input guards.
const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {}
const SESSION_TTL_MIN = Math.max(5, Number(ENV.VITE_SESSION_TTL_MIN) || 480)
const MAX_LOGIN_ATTEMPTS = Math.max(3, Number(ENV.VITE_MAX_LOGIN_ATTEMPTS) || 5)
const LOCKOUT_MIN = 15
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function passwordPolicyError(pw) {
  const p = String(pw || '')
  if (p.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Password must contain at least one letter and one number.'
  return null
}

function emailError(email) {
  const e = String(email || '').trim()
  if (!e) return 'Email is required.'
  if (e.length > 120 || !EMAIL_RE.test(e)) return 'Enter a valid email address.'
  return null
}

// strip control characters + trim + cap length on free-text input
function safeStr(v, max = 120) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max)
}

// media fields (photos, logos, AI artwork) accept only image sources —
// never javascript:, data:text/html or unknown schemes
function safeMediaUrl(v) {
  const u = String(v || '')
  if (!u) return null
  if (/^https:\/\//i.test(u) || /^http:\/\//i.test(u)) return u.slice(0, 500000)
  const m = u.match(/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml)(;base64|[;,])/i)
  if (m) return u.slice(0, 500000)
  return null
}

function randHex(n) {
  let out = ''
  while (out.length < n) out += Math.floor(Math.random() * 16).toString(16)
  return out
}

function issueSession(db, u) {
  const token = `mock:${u.id}:${randHex(40)}`
  db.sessions.push({
    token,
    userId: u.id,
    createdAt: NOW().toISOString(),
    expiresAt: new Date(NOW().getTime() + SESSION_TTL_MIN * 60000).toISOString(),
  })
  return token
}

function killSessions(db, userId, exceptToken = null) {
  db.sessions = db.sessions.filter((x) => x.userId !== userId || x.token === exceptToken)
}

// login throttling: MAX_LOGIN_ATTEMPTS failures inside the lockout window
// locks the account for LOCKOUT_MIN minutes (per email, succeeds clears).
function loginGuard(db, email) {
  const key = String(email || '').toLowerCase()
  const rec = db.loginAttempts[key]
  if (rec && rec.lockedUntil && new Date(rec.lockedUntil) > NOW()) {
    const mins = Math.ceil((new Date(rec.lockedUntil) - NOW()) / 60000)
    throw new ApiError(429, `Too many failed attempts — try again in ${mins} minute${mins > 1 ? 's' : ''}.`)
  }
}

function loginFail(db, email) {
  const key = String(email || '').toLowerCase()
  const now = NOW()
  const rec = db.loginAttempts[key] || { count: 0, firstAt: now.toISOString(), lockedUntil: null }
  if (now - new Date(rec.firstAt) > LOCKOUT_MIN * 60000) { rec.count = 0; rec.firstAt = now.toISOString() }
  rec.count += 1
  if (rec.count >= MAX_LOGIN_ATTEMPTS) {
    rec.lockedUntil = new Date(now.getTime() + LOCKOUT_MIN * 60000).toISOString()
    rec.count = 0
    rec.firstAt = now.toISOString()
  }
  db.loginAttempts[key] = rec
}

function loginOk(db, email) {
  delete db.loginAttempts[String(email || '').toLowerCase()]
}

// ---------- derived state helpers ----------

export function computePlanStatus(org, subs) {
  if (org.status === 'suspended') return 'suspended'
  if (org.status === 'banned') return 'banned'
  const sub = subs.find((s) => s.organizationId === org.id)
  if (!sub) return 'not_subscribed'
  const now = NOW()
  const end = new Date(sub.extendedTo || sub.endDate)
  const start = new Date(sub.startDate)
  if (sub.plan === 'trial' || sub.amount === 0) {
    if (now > end) return 'expired'
    return 'trial'
  }
  if (now < start) return 'not_subscribed'
  if (now > end) return 'expired'
  if (end.getTime() - now.getTime() < 14 * 86400000) return 'expiring_soon'
  return 'active'
}

export function computeEventStatus(ev) {
  const now = NOW()
  if (ev.paused) return 'paused'
  const s = new Date(ev.startDate)
  const e = new Date(ev.endDate)
  if (now < s) return 'upcoming'
  if (now > e) return 'finished'
  return 'active'
}

export function computeDeviceOnline(dev) {
  if (!dev.lastSeenAt) return false
  return NOW() - new Date(dev.lastSeenAt) < DEVICE_ONLINE_WINDOW_MS
}

function catalogPlan(key, db = getDb()) {
  return (db.planCatalog || []).find((p) => p.key === key) || PLANS[key] || PLANS.trial
}

export function orgLimits(org) {
  return catalogPlan(org.plan)
}

export function planSummary(org, subs) {
  const sub = subs.find((s) => s.organizationId === org.id)
  const status = computePlanStatus(org, subs)
  const end = sub ? new Date(sub.extendedTo || sub.endDate) : null
  const start = sub ? new Date(sub.startDate) : null
  const daysLeft = end ? Math.max(0, Math.ceil((end - NOW()) / 86400000)) : null
  const plan = catalogPlan(org.plan)
  return {
    plan: org.plan,
    planName: plan.name || org.plan,
    status,
    startDate: start ? start.toISOString() : null,
    endDate: end ? end.toISOString() : null,
    daysLeft,
    amount: sub ? sub.amount : 0,
    invoice: sub ? sub.invoice || null : null,
    deviceLimit: plan.devices,
    eventLimit: plan.events,
  }
}

function scopeOrg(reqUser, orgId) {
  if (isOrgRole(reqUser.role)) {
    if (!orgId || orgId !== reqUser.organizationId) {
      throw new ApiError(403, 'You can only access your own organization.')
    }
    return reqUser.organizationId
  }
  return orgId
}

function requirePerm(user, perm) {
  if (!roleHasPermission(user.role, perm)) {
    throw new ApiError(403, `Your role does not permit this action (${perm}).`)
  }
}

function paginated(items, { page = 1, limit = 10 } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const l = Math.max(1, parseInt(limit, 10) || 10)
  return {
    items: items.slice((p - 1) * l, p * l),
    total: items.length,
    page: p,
    pages: Math.max(1, Math.ceil(items.length / l)),
  }
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const SUPPORT_STATUSES = ['new', 'denied', 'open', 'in_progress', 'resolved']
const SUPPORT_CATEGORIES = ['technical', 'billing', 'account', 'feature', 'other']
const SUPPORT_PRIORITIES = ['low', 'medium', 'high', 'urgent']

function supportImages(raw) {
  if (raw == null) return []
  if (!Array.isArray(raw) || raw.length > 4) throw new ApiError(400, 'Attach up to 4 images per message.')
  return raw.map((src) => {
    const safe = safeMediaUrl(src)
    if (!safe) throw new ApiError(400, 'Attachments must be valid https:// or data:image/ images.')
    return safe
  })
}

function supportMessage(db, ticket, user, side, body, { requireText = false } = {}) {
  const text = safeStr(body && body.message, 2000)
  const images = supportImages(body && body.images)
  if ((!text && images.length === 0) || (requireText && !text)) {
    throw new ApiError(400, requireText ? 'A text message is required.' : 'Write a message or attach an image.')
  }
  const message = {
    id: uid('sm'), authorId: user.id, authorName: user.name,
    authorRole: ROLE_LABELS[user.role], side, at: NOW().toISOString(), text, images,
  }
  ticket.messages.push(message)
  ticket.updatedAt = message.at
  return message
}

function supportView(db, ticket) {
  const org = db.organizations.find((o) => o.id === ticket.organizationId)
  const creator = db.users.find((u) => u.id === ticket.createdBy)
  const decisionBy = ticket.decision && db.users.find((u) => u.id === ticket.decision.by)
  return {
    ...ticket,
    organization: org ? { id: org.id, name: org.name, email: org.email } : null,
    creator: creator ? { id: creator.id, name: creator.name, role: creator.role } : null,
    decision: ticket.decision ? {
      ...ticket.decision,
      byName: decisionBy ? decisionBy.name : 'HappyPix platform',
      byRole: decisionBy ? ROLE_LABELS[decisionBy.role] : null,
    } : null,
  }
}

function supportCounts(rows) {
  const counts = Object.fromEntries(SUPPORT_STATUSES.map((s) => [s, 0]))
  rows.forEach((row) => { if (counts[row.status] != null) counts[row.status] += 1 })
  return counts
}

function validateLayoutPrices(raw, base = {}) {
  if (raw == null) return { ...base }
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new ApiError(400, 'layoutPrices must be an object of "familyId:slots" → price.')
  const prices = { ...base }
  for (const [key, value] of Object.entries(raw)) {
    const [familyId, slotsText] = String(key).split(':')
    const family = LAYOUT_FAMILIES.find((f) => f.id === familyId)
    const slots = Number(slotsText)
    if (!family || !family.slots.includes(slots)) throw new ApiError(400, `Unknown layout iteration "${key}".`)
    const price = Number(value)
    if (!Number.isFinite(price) || price < 0 || price > 100000) throw new ApiError(400, `Price for "${key}" must be between 0 and 100000.`)
    prices[key] = Math.round(price)
  }
  return prices
}

function logAudit(db, { at, actorId, action, entity, summary, ip, organizationId, severity = 'info' }) {
  db.audit.unshift({
    id: uid('aud'),
    at: at || NOW().toISOString(),
    actorId,
    action,
    entity,
    summary,
    ip: ip || '127.0.0.1',
    severity,
    organizationId: organizationId || null,
  })
}

function layoutMeta(id) {
  const l = layoutById(id)
  if (!l) return null
  return { id: l.id, familyId: l.familyId, name: l.name, code: l.code, orientation: l.orientation, slots: l.slots, cutout: l.cutout, sheets: l.sheets, canvas: l.canvas, label: layoutLabel(l) }
}

function withTemplateLayout(t) {
  return { ...t, layout: layoutMeta(t.layoutId) }
}

function aiDesignFor(hash, layout) {
  const palettes = [
    { accent: '#D9B44A', textColor: '#FFFFFF' },
    { accent: '#F42E93', textColor: '#FFFFFF' },
    { accent: '#74A3E9', textColor: '#FFFFFF' },
    { accent: '#A6D76C', textColor: '#16121F' },
    { accent: '#F3D9A4', textColor: '#FFFFFF' },
  ]
  const ornaments = ['none', 'dots', 'flourish', 'stripes']
  const fonts = ['sans', 'serif', 'script']
  const shapes = ['rect', 'arch', 'round']
  const pal = palettes[hash % palettes.length]
  return {
    bg: { type: 'image', url: aiBackgroundSvg(layout.canvas.w, layout.canvas.h, pal.accent, hash) },
    accent: pal.accent,
    textColor: pal.textColor,
    ornament: ornaments[hash % ornaments.length],
    font: fonts[(hash >> 2) % fonts.length],
    slotShape: shapes[(hash >> 3) % shapes.length],
    titleBand: false,
  }
}

function aiBackgroundSvg(w, h, accent, hash) {
  const c2 = hash % 2 === 0 ? '#221741' : '#3A1C33'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="#120D1F"/></linearGradient><radialGradient id="r" cx="0.5" cy="0.2" r="0.9"><stop offset="0" stop-color="${accent}66"/><stop offset="1" stop-color="${accent}00"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#r)"/><circle cx="${w * 0.78}" cy="${h * 0.16}" r="${w * 0.22}" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="3"/><circle cx="${w * 0.16}" cy="${h * 0.72}" r="${w * 0.16}" fill="${accent}" fill-opacity="0.08"/><circle cx="${w * 0.85}" cy="${h * 0.85}" r="${w * 0.1}" fill="#FFFFFF" fill-opacity="0.05"/></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

function userPublic(u) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    organizationId: u.organizationId, status: u.status,
    photoUrl: u.photoUrl, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
  }
}

function userSessionView(db, u) {
  const organization = db.organizations.find((org) => org.id === u.organizationId)
  return {
    ...userPublic(u),
    orgName: organization?.name || null,
    planStatus: organization?.status || null,
  }
}

// ---------- aggregates ----------

function revenueAgg(db, orgId, { from, to, eventId, deviceId, status } = {}) {
  let pays = db.payments.filter((p) => (!orgId || p.organizationId === orgId) && p.status !== 'failed')
  if (from) pays = pays.filter((p) => new Date(p.createdAt) >= new Date(from))
  if (to) pays = pays.filter((p) => new Date(p.createdAt) <= new Date(to))
  if (eventId) pays = pays.filter((p) => p.eventId === eventId)
  if (deviceId) pays = pays.filter((p) => p.deviceId === deviceId)
  const byStatus = { paid: 0, pending: 0, failed: 0 }
  for (const p of db.payments.filter((p) => !orgId || p.organizationId === orgId)) {
    if (p.status === 'failed') byStatus.failed += 1
    else byStatus[p.status] = (byStatus[p.status] || 0) + 1
  }
  const total = pays.reduce((s, p) => s + p.amount, 0)
  const prints = pays.reduce((s, p) => s + p.printCount, 0)
  return { total, prints, transactions: pays.length, byStatus }
}

// UPI VPA: local part 2-256 chars [a-z0-9.\-_], '@', handle letters only
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/
function upiError(v) {
  const id = String(v || '').trim()
  if (!id) return null
  if (!UPI_RE.test(id)) return 'Enter a valid UPI ID, e.g. business@okaxis.'
  return null
}

// Payout settings with defaults — mode 'wallet' until an org turns UPI on.
function payoutOf(db, orgId) {
  const d = db.orgDefaults[orgId] || {}
  return { upiId: d.upiId || null, payoutMode: d.payoutMode === 'upi' ? 'upi' : 'wallet' }
}

// Wallet = paid, wallet-settled print revenue minus every withdrawal that
// is not failed (processing counts as already committed).
const MIN_WITHDRAWAL = 500
function walletOf(db, orgId) {
  const paid = db.payments.filter((p) => p.organizationId === orgId && p.status === 'paid')
  const credited = paid.filter((p) => p.settlement === 'wallet').reduce((s, p) => s + p.amount, 0)
  const viaUpi = paid.filter((p) => p.settlement !== 'wallet').reduce((s, p) => s + p.amount, 0)
  const wds = (db.withdrawals || []).filter((w) => w.organizationId === orgId)
  const withdrawn = wds.filter((w) => w.status === 'paid').reduce((s, w) => s + w.amount, 0)
  const processing = wds.filter((w) => w.status === 'processing').reduce((s, w) => s + w.amount, 0)
  return {
    balance: credited - withdrawn - processing,
    credited, withdrawn, processing, viaUpi,
    minWithdrawal: MIN_WITHDRAWAL,
    withdrawals: wds.slice().sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)),
  }
}

function monthSeries(db, orgId, months = 8) {
  const out = []
  const now = NOW()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = monthKey(d)
    const v = db.payments
      .filter((p) => (!orgId || p.organizationId === orgId) && p.status === 'paid')
      .filter((p) => monthKey(new Date(p.createdAt)) === key)
      .reduce((s, p) => s + p.amount, 0)
    out.push({ key, value: v })
  }
  return out
}

function subRevenueSeries(db, months = 8) {
  const out = []
  const now = NOW()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = monthKey(d)
    const v = db.subscriptions
      .filter((s) => s.paidAt && s.amount > 0 && monthKey(new Date(s.paidAt)) === key)
      .reduce((sum, s) => sum + s.amount, 0)
    out.push({ key, value: v })
  }
  return out
}

// =====================================================================
// Route handler
// =====================================================================

export function handle(method, path, body, token) {
  const db = getDb()
  const url = new URL(path, 'http://x')
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  const p = parts[0]
  const p2 = parts[1]
  const p3 = parts[2]

  // ---- auth (public routes first) ----
  if (p === 'auth' && p2 === 'login' && method === 'POST') {
    const email = safeStr(body && body.email, 120)
    const password = String((body && body.password) || '')
    loginGuard(db, email) // 429 while locked — even for correct passwords
    const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase())
    if (!u || u.status !== 'active' || u.password !== password) {
      loginFail(db, email)
      logAudit(db, {
        actorId: u ? u.id : null,
        action: 'platform.auth.login_failed',
        entity: 'user',
        summary: `Failed sign-in attempt for ${email || '(empty email)'}`,
        severity: 'warn',
      })
      throw new ApiError(401, 'Invalid email or password.')
    }
    loginOk(db, email)
    u.lastLoginAt = NOW().toISOString()
    const token = issueSession(db, u)
    logAudit(db, {
      actorId: u.id,
      action: (isOrgRole(u.role) ? 'organization' : 'platform') + '.auth.login',
      entity: 'user',
      summary: `${u.name} signed in to CRM`,
    })
    persist()
    return { status: 200, data: { token, user: userSessionView(db, u), expiresInMin: SESSION_TTL_MIN } }
  }

  let user = null
  if (token && token.startsWith('mock:')) {
    // Bearer token → server-side session with expiry. Forged or expired
    // tokens resolve to null (→ 401 on every guarded route).
    const sess = (db.sessions || []).find((x) => x.token === token)
    if (sess && new Date(sess.expiresAt) > NOW()) {
      const su = db.users.find((x) => x.id === sess.userId)
      if (su && su.status === 'active') user = su
    }
  }
  const authed = (req) => {
    if (!user) throw new ApiError(401, 'Not authenticated.')
    if (req) requirePerm(user, req)
    return user
  }

  if (p === 'auth') {
    if (p2 === 'me' && method === 'GET') {
      authed()
      return { status: 200, data: { user: userSessionView(db, user) } }
    }
    if (p2 === 'logout' && method === 'POST') {
      // Idempotent: revoke this token if it exists. Always 200.
      if (token) db.sessions = (db.sessions || []).filter((x) => x.token !== token)
      persist()
      return { status: 200, data: { ok: true } }
    }
    if (p2 === 'forgot-password' && method === 'POST') {
      // Public. Always 200 — never reveal whether the account exists.
      // Demo mode: the 6-digit code is returned as `code` because there is
      // no email/SMS server in the sandbox; the real backend sends it via
      // email/SMS instead (see BACKEND-CHANGES.md).
      const email = String((body && body.email) || '').trim().toLowerCase()
      const u = db.users.find((x) => x.email.toLowerCase() === email)
      if (u && u.status === 'active') {
        const code = String(Math.floor(100000 + Math.random() * 900000))
        u.resetCode = code
        u.resetCodeExpiry = new Date(NOW().getTime() + 10 * 60 * 1000).toISOString()
        logAudit(db, { actorId: u.id, action: 'platform.auth.forgot_password', entity: 'user', summary: `Password reset code issued for ${u.name}`, severity: 'warn', organizationId: u.organizationId })
        persist()
        return { status: 200, data: { ok: true, delivery: 'demo', code } }
      }
      return { status: 200, data: { ok: true, delivery: 'email' } }
    }
    if (p2 === 'reset-password' && method === 'POST') {
      // Public. Email + 6-digit code + new password.
      const email = String((body && body.email) || '').trim().toLowerCase()
      const code = String((body && body.code) || '').trim()
      const newPassword = String((body && body.newPassword) || '')
      const u = db.users.find((x) => x.email.toLowerCase() === email)
      if (!u || !u.resetCode || u.resetCode !== code) throw new ApiError(400, 'Invalid or expired reset code.')
      if (!u.resetCodeExpiry || new Date(u.resetCodeExpiry) < NOW()) throw new ApiError(400, 'This reset code has expired. Request a new one.')
      const policy = passwordPolicyError(newPassword)
      if (policy) throw new ApiError(400, policy)
      u.password = newPassword
      u.resetCode = null
      u.resetCodeExpiry = null
      killSessions(db, u.id) // a reset signs out every existing session
      logAudit(db, { actorId: u.id, action: 'platform.auth.password_reset', entity: 'user', summary: `${u.name} reset their password via forgot-password`, severity: 'warn', organizationId: u.organizationId })
      persist()
      return { status: 200, data: { ok: true } }
    }
    if (p2 === 'profile' && method === 'PUT') {
      authed(PERMS.PROFILE_EDIT)
      if (body.name) user.name = safeStr(body.name, 80) || user.name
      if (body.photoUrl != null) {
        const media = safeMediaUrl(body.photoUrl)
        if (body.photoUrl && !media) throw new ApiError(400, 'Photo must be an https:// or data:image/ URL.')
        user.photoUrl = media
      }
      persist()
      return { status: 200, data: { user: userPublic(user) } }
    }
    if (p2 === 'password' && method === 'POST') {
      authed(PERMS.PROFILE_EDIT)
      if (user.password !== String(body.currentPassword || '')) throw new ApiError(400, 'Your current password is incorrect.')
      const policy = passwordPolicyError(body.newPassword)
      if (policy) throw new ApiError(400, policy)
      user.password = body.newPassword
      killSessions(db, user.id, token) // every other device/browser is signed out
      persist()
      logAudit(db, { actorId: user.id, action: 'platform.auth.password_change', entity: 'user', summary: `${user.name} changed their password`, organizationId: user.organizationId, severity: 'warn' })
      persist()
      return { status: 200, data: { ok: true } }
    }
    if (p2 === 'email' && p3 === 'change-request' && method === 'POST') {
      // Change email = current password + OTP to the NEW address.
      authed(PERMS.PROFILE_EDIT)
      const newEmail = safeStr(body && body.newEmail, 120).toLowerCase()
      if (user.password !== String((body && body.currentPassword) || '')) throw new ApiError(400, 'Your current password is incorrect.')
      const fmt = emailError(newEmail)
      if (fmt) throw new ApiError(400, fmt)
      if (db.users.some((x) => x.id !== user.id && x.email.toLowerCase() === newEmail)) throw new ApiError(409, 'That email is already in use by another account.')
      const code = String(Math.floor(100000 + Math.random() * 900000))
      user.emailChangeCode = code
      user.emailChangeNew = newEmail
      user.emailChangeExpiry = new Date(NOW().getTime() + 10 * 60 * 1000).toISOString()
      logAudit(db, { actorId: user.id, action: 'platform.auth.email_change_requested', entity: 'user', summary: `Email change requested for ${user.name} → ${newEmail}`, severity: 'warn', organizationId: user.organizationId })
      persist()
      // Demo delivery: the code is returned because there is no mail server
      // in the sandbox. The real backend emails it (never returns it).
      return { status: 200, data: { ok: true, delivery: 'demo', code, newEmail } }
    }
    if (p2 === 'email' && p3 === 'change-confirm' && method === 'POST') {
      authed(PERMS.PROFILE_EDIT)
      const code = String((body && body.code) || '').trim()
      if (!user.emailChangeCode || user.emailChangeCode !== code) throw new ApiError(400, 'Invalid or expired verification code.')
      if (!user.emailChangeExpiry || new Date(user.emailChangeExpiry) < NOW()) throw new ApiError(400, 'This verification code has expired. Request a new one.')
      const newEmail = user.emailChangeNew
      if (db.users.some((x) => x.id !== user.id && x.email.toLowerCase() === newEmail)) throw new ApiError(409, 'That email was just claimed by another account. Start again.')
      const old = user.email
      user.email = newEmail
      user.emailChangeCode = null
      user.emailChangeNew = null
      user.emailChangeExpiry = null
      killSessions(db, user.id, token) // other sessions were tied to the old identity
      logAudit(db, { actorId: user.id, action: 'platform.auth.email_changed', entity: 'user', summary: `Email changed for ${user.name}: ${old} → ${newEmail}`, severity: 'warn', organizationId: user.organizationId })
      persist()
      return { status: 200, data: { ok: true, user: userPublic(user) } }
    }
  }

  // ================= BOOTH (device-facing; the booth app pushes here) =================
  // The booth authenticates with its generated device UUID (it is not a
  // CRM user). The real backend implements the same contract.
  if (p === 'booth') {
    if (p2 === 'devices' && p3 && parts[3] === 'telemetry' && method === 'POST') {
      // Hardware heartbeat from the booth app:
      //   { printsTotal, shutterCount, batteryPct,
      //     connections: { camera, printer, kioskScreen } }
      // The CRM reads stats and peripheral connection health through
      // GET /org/devices (Hardware health column).
      const d = db.devices.find((x) => x.deviceUuid === p3)
      if (!d) throw new ApiError(404, 'Device not found.')
      const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)))
      const prev = d.telemetry || {}
      const tel = {
        prints: body && body.printsTotal != null ? clampInt(body.printsTotal, 0, 10_000_000) : prev.prints || 0,
        shutters: body && body.shutterCount != null ? clampInt(body.shutterCount, 0, 10_000_000) : prev.shutters || 0,
        batteryPct: body && body.batteryPct != null ? clampInt(body.batteryPct, 0, 100) : prev.batteryPct ?? null,
        updatedAt: NOW().toISOString(),
      }
      const reported = body && body.connections
      if (reported != null && (typeof reported !== 'object' || Array.isArray(reported))) {
        throw new ApiError(400, 'connections must contain camera, printer and kioskScreen booleans.')
      }
      for (const key of ['camera', 'printer', 'kioskScreen']) {
        if (reported && reported[key] !== undefined && typeof reported[key] !== 'boolean') {
          throw new ApiError(400, `connections.${key} must be true or false.`)
        }
      }
      const previousConnections = d.connections || {}
      const connections = {
        camera: reported?.camera ?? previousConnections.camera ?? false,
        printer: reported?.printer ?? previousConnections.printer ?? false,
        kioskScreen: reported?.kioskScreen ?? previousConnections.kioskScreen ?? false,
        updatedAt: tel.updatedAt,
      }
      d.telemetry = tel
      d.connections = connections
      d.lastSeenAt = tel.updatedAt
      persist()
      return { status: 200, data: { ok: true, telemetry: tel, connections } }
    }
    if (p2 === 'tickets' && !p3 && method === 'POST') {
      // Guest support ticket raised by the booth app at session end / after
      // payment. The booth collects the guest's phone number and attaches
      // the whole session: slot, camera clicks, customisations, payment.
      // Body: { organizationId, eventId, deviceId, subject, category,
      //         priority, guestName, guestPhone, message, session }
      const { organizationId, eventId, deviceId, subject, session } = body || {}
      const org = db.organizations.find((o) => o.id === organizationId)
      if (!org) throw new ApiError(400, 'organizationId is required.')
      if (!subject || !String(subject).trim()) throw new ApiError(400, 'Subject is required.')
      if (!session || !session.phone) throw new ApiError(400, 'Session context with the guest phone number is required.')
      const t = {
        id: uid('tix'),
        organizationId,
        eventId: eventId || null,
        deviceId: deviceId || null,
        subject: String(subject).trim(),
        category: ['device', 'payment', 'photo', 'event', 'general'].includes(body.category) ? body.category : 'general',
        priority: ['low', 'medium', 'high', 'urgent'].includes(body.priority) ? body.priority : 'medium',
        status: 'open',
        guest: { name: (body.guestName || 'Guest').trim(), contact: String(session.phone).trim() },
        session: {
          ...session,
          // where the money went is stamped from the org's payout mode at
          // the time of payment (booth may send it; else we derive it)
          payment: session.payment
            ? { ...session.payment, settlement: ['upi', 'wallet'].includes(session.payment.settlement) ? session.payment.settlement : payoutOf(db, organizationId).payoutMode }
            : session.payment,
          // snapshot ids resolved for display by withTicketRefs
          eventId: eventId || null,
          deviceId: deviceId || null,
        },
        createdAt: NOW().toISOString(),
        updatedAt: NOW().toISOString(),
        messages: [
          { id: uid('m'), author: 'Guest (booth)', at: NOW().toISOString(), text: String(body.message || subject).trim() },
        ],
        resolution: null,
      }
      db.tickets.unshift(t)
      logAudit(db, { actorId: null, action: 'ticket.created_from_booth', entity: 'ticket', summary: `Ticket “${t.subject}” raised from booth (session ${session.id || 'n/a'})`, organizationId })
      persist()
      return { status: 201, data: { ticket: withTicketRefs(t) } }
    }
  }

  // ================= PLATFORM =================
  if (p === 'platform') {
    if (p2 === 'gallery-settings') {
      const actor = authed(PERMS.PLATFORM_GALLERY_SETTINGS)
      if (method === 'GET') return { status: 200, data: { ...(db.platformSettings || { galleryEnabled: false, requireGuestConsent: true }) } }
      if (method === 'PUT') {
        const settings = db.platformSettings || { galleryEnabled: false, requireGuestConsent: true }
        if (body && body.galleryEnabled !== undefined) {
          if (typeof body.galleryEnabled !== 'boolean') throw new ApiError(400, 'galleryEnabled must be a boolean.')
          settings.galleryEnabled = body.galleryEnabled
        }
        if (body && body.requireGuestConsent !== undefined) {
          if (typeof body.requireGuestConsent !== 'boolean') throw new ApiError(400, 'requireGuestConsent must be a boolean.')
          settings.requireGuestConsent = body.requireGuestConsent
        }
        settings.updatedAt = NOW().toISOString()
        settings.updatedBy = actor.id
        db.platformSettings = settings
        logAudit(db, { actorId: actor.id, action: 'platform.gallery.settings_updated', entity: 'platform_settings', summary: `Gallery ${settings.galleryEnabled ? 'enabled' : 'disabled'}; guest consent ${settings.requireGuestConsent ? 'required' : 'not required'}` })
        persist()
        return { status: 200, data: { settings } }
      }
    }
    if (p2 === 'dashboard' && method === 'GET') {
      authed(PERMS.PLATFORM_DASHBOARD_VIEW)
      const orgs = db.organizations
      const devices = db.devices
      const events = db.events
      const subs = db.subscriptions
      const online = devices.filter(computeDeviceOnline).length
      const activeOrgs = orgs.filter((o) => computePlanStatus(o, subs) === 'active').length
      const trialOrgs = orgs.filter((o) => computePlanStatus(o, subs) === 'trial').length
      const expiring = orgs
        .map((o) => ({ o, ps: planSummary(o, subs) }))
        .filter(({ ps }) => ps.status === 'expiring_soon')
        .sort((a, b) => a.ps.daysLeft - b.ps.daysLeft)
      const nearLimits = orgs
        .map((o) => {
          const lim = orgLimits(o)
          const dUsed = devices.filter((d) => d.organizationId === o.id).length
          const eUsed = events.filter((e) => e.organizationId === o.id && computeEventStatus(e) === 'active').length
          return { org: o, deviceUsed: dUsed, deviceLimit: lim.devices, eventUsed: eUsed, eventLimit: lim.events }
        })
        .filter((x) => x.deviceUsed >= x.deviceLimit * 0.8 || x.eventUsed >= x.eventLimit * 0.8)
      return {
        status: 200,
        data: {
          orgs: { total: orgs.length, active: activeOrgs, trial: trialOrgs, suspended: orgs.filter((o) => o.status === 'suspended').length, banned: orgs.filter((o) => o.status === 'banned').length },
          devices: { total: devices.length, online, offline: devices.length - online, operational: devices.filter((d) => d.status === 'active').length },
          events: { active: events.filter((e) => computeEventStatus(e) === 'active').length, upcoming: events.filter((e) => computeEventStatus(e) === 'upcoming').length, finished: events.filter((e) => computeEventStatus(e) === 'finished').length },
          expiringSoon: expiring.map(({ o, ps }) => ({ id: o.id, name: o.name, plan: ps.planName, status: ps.status, daysLeft: ps.daysLeft })),
          nearLimits: nearLimits.map((x) => ({ id: x.org.id, name: x.org.name, deviceUsed: x.deviceUsed, deviceLimit: x.deviceLimit, eventUsed: x.eventUsed, eventLimit: x.eventLimit })),
          recentSignups: [...orgs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
            .map((o) => ({ id: o.id, name: o.name, createdAt: o.createdAt, plan: planSummary(o, subs).planName })),
          alerts: [
            ...expiring.map(({ ps }) => ({ kind: 'plan_expiring', text: `${ps.planName} plan expiring in ${ps.daysLeft} days`, tone: 'warn' })),
            ...orgs.filter((o) => o.status === 'suspended').map((o) => ({ kind: 'suspended', text: `Organization ${o.name} is suspended`, tone: 'warn' })),
            ...orgs.filter((o) => o.status === 'banned').map((o) => ({ kind: 'banned', text: `Organization ${o.name} is banned`, tone: 'danger' })),
          ].slice(0, 6),
        },
      }
    }

    if (p2 === 'revenue' && method === 'GET') {
      authed(PERMS.PLATFORM_REVENUE_VIEW)
      const now = NOW()
      const fy = fyStart(now)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const subs = db.subscriptions.filter((s) => s.amount > 0)
      const net = subs.reduce((s, x) => s + x.amount, 0)
      const fyRev = subs.filter((s) => new Date(s.paidAt) >= fy).reduce((s, x) => s + x.amount, 0)
      const monthRev = subs.filter((s) => new Date(s.paidAt) >= monthStart).reduce((s, x) => s + x.amount, 0)
      const orgRows = db.organizations.map((o) => {
        const sub = db.subscriptions.find((s) => s.organizationId === o.id && s.amount > 0)
        const ps = planSummary(o, db.subscriptions)
        const thisMonth = sub && new Date(sub.paidAt) >= monthStart ? sub.amount : 0
        const inFy = sub && new Date(sub.paidAt) >= fy ? sub.amount : 0
        return {
          id: o.id, name: o.name, email: o.email, plan: ps.planName, planStatus: ps.status,
          expiry: ps.endDate, daysLeft: ps.daysLeft, revenue: sub ? sub.amount : 0,
          revenueThisMonth: thisMonth, revenueFY: inFy,
        }
      })
      return {
        status: 200,
        data: {
          net, fyRevenue: fyRev, monthRevenue: monthRev,
          monthWise: subRevenueSeries(db, 12).map((m) => ({ ...m, label: monthLabelOf(m.key) })),
          quarterWise: quarterSeries(db, now.getFullYear()),
          orgs: orgRows,
          yearOptions: [2026, 2025],
        },
      }
    }

    if (p2 === 'organizations' && !p3 && method === 'GET') {
      authed(PERMS.PLATFORM_ORGS_VIEW)
      const q = url.searchParams
      let rows = db.organizations.map((o) => {
        const ps = planSummary(o, db.subscriptions)
        const devices = db.devices.filter((d) => d.organizationId === o.id)
        const events = db.events.filter((e) => e.organizationId === o.id)
        return {
          ...o,
          planStatus: ps.status, planName: ps.planName,
          planExpiry: ps.endDate, planDaysLeft: ps.daysLeft,
          devices: devices.length,
          onlineDevices: devices.filter(computeDeviceOnline).length,
          activeEvents: events.filter((e) => computeEventStatus(e) === 'active').length,
          totalEvents: events.length,
        }
      })
      if (q.get('status')) rows = rows.filter((r) => r.planStatus === q.get('status'))
      if (q.get('plan')) rows = rows.filter((r) => r.plan === q.get('plan'))
      if (q.get('search')) {
        const s = q.get('search').toLowerCase()
        rows = rows.filter((r) => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s) || r.ownerName.toLowerCase().includes(s))
      }
      return { status: 200, data: paginated(rows, { page: q.get('page'), limit: q.get('limit') || 25 }) }
    }

    if (p2 === 'organizations' && p3 && method === 'GET') {
      authed(PERMS.PLATFORM_ORGS_VIEW)
      const o = db.organizations.find((x) => x.id === p3)
      if (!o) throw new ApiError(404, 'Organization not found.')
      const ps = planSummary(o, db.subscriptions)
      const devices = db.devices.filter((d) => d.organizationId === o.id).map((d) => ({ ...d, online: computeDeviceOnline(d) }))
      const events = db.events.filter((e) => e.organizationId === o.id).map((e) => ({ ...e, status: computeEventStatus(e) }))
      const sub = db.subscriptions.find((s) => s.organizationId === o.id)
      const rev = revenueAgg(db, o.id)
      return { status: 200, data: { ...o, plan: ps, subscription: sub || null, devices, events, revenue: rev } }
    }

    if (p2 === 'organizations' && p3 && parts[3] && method === 'POST') {
      authed(PERMS.PLATFORM_ORG_SUSPEND)
      const o = db.organizations.find((x) => x.id === p3)
      if (!o) throw new ApiError(404, 'Organization not found.')
      const action = parts[3]
      const reason = String((body && body.reason) || '').trim()
      if (action === 'suspend') {
        if (!reason) throw new ApiError(400, 'A reason is required to suspend an organization.')
        o.status = 'suspended'
        o.suspendReason = reason
        logAudit(db, { actorId: user.id, action: 'platform.organization.suspended', entity: 'organization', summary: `Organization “${o.name}” suspended — ${reason}`, organizationId: o.id, severity: 'warn' })
      } else if (action === 'ban') {
        if (!reason) throw new ApiError(400, 'A reason is required to ban an organization.')
        o.status = 'banned'
        o.suspendReason = reason
        logAudit(db, { actorId: user.id, action: 'platform.organization.banned', entity: 'organization', summary: `Organization “${o.name}” banned — ${reason}`, organizationId: o.id, severity: 'danger' })
      } else if (action === 'restore') {
        o.status = 'active'
        o.suspendReason = null
        logAudit(db, { actorId: user.id, action: 'platform.organization.restored', entity: 'organization', summary: `Organization “${o.name}” restored`, organizationId: o.id })
      } else throw new ApiError(404, 'Unknown action.')
      persist()
      return { status: 200, data: { ok: true, organization: o } }
    }

    if (p2 === 'audit' && method === 'GET') {
      authed(PERMS.PLATFORM_AUDIT_VIEW)
      const q = url.searchParams
      let rows = db.audit.filter((a) => !a.organizationId && a.action !== 'booth.heartbeat') // platform scope
      if (q.get('from')) rows = rows.filter((a) => new Date(a.at) >= new Date(q.get('from')))
      if (q.get('to')) rows = rows.filter((a) => new Date(a.at) <= new Date(q.get('to') + 'T23:59:59'))
      if (q.get('action')) rows = rows.filter((a) => a.action.includes(q.get('action')))
      if (q.get('actor')) {
        const u = db.users.find((x) => x.id === q.get('actor'))
        rows = rows.filter((a) => a.actorId === (u ? u.id : q.get('actor')))
      }
      return {
        status: 200,
        data: {
          ...paginated(rows, { page: q.get('page'), limit: q.get('limit') || 20 }),
          actors: db.users.filter((u) => !u.organizationId),
        },
      }
    }

    if (p2 === 'plans') {
      authed(PERMS.SUBSCRIPTION_PLANS_MANAGE)
      if (!p3 && method === 'GET') {
        const plans = (db.planCatalog || []).map((plan) => ({
          ...plan,
          organizations: db.organizations.filter((org) => org.plan === plan.key).length,
          subscriptions: db.subscriptions.filter((sub) => sub.plan === plan.key).length,
        }))
        return { status: 200, data: { plans } }
      }
      if (!p3 && method === 'POST') {
        const name = safeStr(body && body.name, 80)
        const key = safeStr(body && body.key, 50).toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const description = safeStr(body && body.description, 240)
        const price = body && (body.price === null || body.price === '') ? null : Number(body && body.price)
        const devices = Number(body && body.devices)
        const events = Number(body && body.events)
        const durationMonths = Number(body && body.durationMonths)
        const durationLabel = safeStr(body && body.durationLabel, 60)
        if (!name || !key) throw new ApiError(400, 'Plan name and key are required.')
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) throw new ApiError(400, 'Plan key may contain lowercase letters, numbers and single hyphens.')
        if ((db.planCatalog || []).some((plan) => plan.key === key)) throw new ApiError(409, 'A plan with this key already exists.')
        if (price !== null && (!Number.isFinite(price) || price < 0 || price > 10000000)) throw new ApiError(400, 'Price must be between ₹0 and ₹1,00,00,000, or blank for contact sales.')
        if (!Number.isInteger(devices) || devices < 1 || devices > 1000 || !Number.isInteger(events) || events < 1 || events > 1000) throw new ApiError(400, 'Device and event limits must be whole numbers from 1 to 1000.')
        if (!Number.isInteger(durationMonths) || durationMonths < 0 || durationMonths > 120) throw new ApiError(400, 'Duration must be from 0 to 120 months.')
        const plan = {
          id: uid('plan'), key, name, description, price,
          durationMonths, durationLabel: durationLabel || (durationMonths ? `${durationMonths} month${durationMonths === 1 ? '' : 's'}` : 'Custom term'),
          devices, events, active: body.active !== false,
          createdAt: NOW().toISOString(), updatedAt: NOW().toISOString(),
        }
        db.planCatalog.push(plan)
        logAudit(db, { actorId: user.id, action: 'platform.plan.created', entity: 'subscription_plan', summary: `Subscription plan “${name}” created` })
        persist()
        return { status: 201, data: { plan } }
      }
      if (p3 && method === 'PUT') {
        const plan = (db.planCatalog || []).find((row) => row.id === p3)
        if (!plan) throw new ApiError(404, 'Subscription plan not found.')
        if (body.key !== undefined && body.key !== plan.key) throw new ApiError(400, 'A plan key is permanent once created.')
        if (body.name !== undefined) {
          const name = safeStr(body.name, 80)
          if (!name) throw new ApiError(400, 'Plan name is required.')
          plan.name = name
        }
        if (body.description !== undefined) plan.description = safeStr(body.description, 240)
        if (body.price !== undefined) {
          const price = body.price === null || body.price === '' ? null : Number(body.price)
          if (price !== null && (!Number.isFinite(price) || price < 0 || price > 10000000)) throw new ApiError(400, 'Price must be between ₹0 and ₹1,00,00,000, or blank for contact sales.')
          plan.price = price
        }
        for (const field of ['devices', 'events']) {
          if (body[field] !== undefined) {
            const value = Number(body[field])
            if (!Number.isInteger(value) || value < 1 || value > 1000) throw new ApiError(400, `${field} must be a whole number from 1 to 1000.`)
            plan[field] = value
          }
        }
        if (body.durationMonths !== undefined) {
          const value = Number(body.durationMonths)
          if (!Number.isInteger(value) || value < 0 || value > 120) throw new ApiError(400, 'Duration must be from 0 to 120 months.')
          plan.durationMonths = value
        }
        if (body.durationLabel !== undefined) plan.durationLabel = safeStr(body.durationLabel, 60) || plan.durationLabel
        if (body.active !== undefined) plan.active = !!body.active
        plan.updatedAt = NOW().toISOString()
        logAudit(db, { actorId: user.id, action: 'platform.plan.updated', entity: 'subscription_plan', summary: `Subscription plan “${plan.name}” updated` })
        persist()
        return { status: 200, data: { plan } }
      }
    }

    if (p2 === 'support') {
      authed(PERMS.PLATFORM_SUPPORT_VIEW)
      if (!p3 && method === 'GET') {
        const q = url.searchParams
        let rows = (db.platformSupport || []).slice()
        if (q.get('status')) rows = rows.filter((ticket) => ticket.status === q.get('status'))
        if (q.get('search')) {
          const search = q.get('search').toLowerCase()
          rows = rows.filter((ticket) => {
            const org = db.organizations.find((o) => o.id === ticket.organizationId)
            return ticket.subject.toLowerCase().includes(search) || (ticket.ticketNo || '').toLowerCase().includes(search) || (org && org.name.toLowerCase().includes(search))
          })
        }
        rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        return { status: 200, data: { requests: rows.map((ticket) => supportView(db, ticket)), counts: supportCounts(db.platformSupport || []) } }
      }
      const ticket = p3 && (db.platformSupport || []).find((row) => row.id === p3)
      if (p3 && !ticket) throw new ApiError(404, 'Support request not found.')
      if (p3 && !parts[3] && method === 'GET') return { status: 200, data: { request: supportView(db, ticket) } }
      if (p3 && parts[3] === 'accept' && method === 'POST') {
        if (ticket.status !== 'new') throw new ApiError(409, 'Only a new request can be accepted.')
        db.supportTicketSeq = Number(db.supportTicketSeq || 0) + 1
        ticket.ticketNo = `HPX-${String(NOW().getFullYear()).slice(2)}${String(NOW().getMonth() + 1).padStart(2, '0')}-${String(db.supportTicketSeq).padStart(4, '0')}`
        ticket.status = 'open'
        ticket.acceptedAt = NOW().toISOString()
        ticket.decision = { type: 'accepted', reason: null, by: user.id, at: ticket.acceptedAt }
        const message = safeStr(body && body.message, 2000) || `Request accepted as ${ticket.ticketNo}. HappyPix support will continue here.`
        supportMessage(db, ticket, user, 'platform', { message })
        logAudit(db, { actorId: user.id, action: 'platform.support.accepted', entity: 'support_ticket', summary: `Accepted “${ticket.subject}” as ${ticket.ticketNo}`, organizationId: ticket.organizationId })
        persist()
        return { status: 200, data: { request: supportView(db, ticket) } }
      }
      if (p3 && parts[3] === 'deny' && method === 'POST') {
        if (ticket.status !== 'new') throw new ApiError(409, 'Only a new request can be denied.')
        const reason = safeStr(body && body.reason, 2000)
        if (!reason) throw new ApiError(400, 'A denial reason is required and will be shown to the organization.')
        ticket.status = 'denied'
        ticket.ticketNo = null
        ticket.decision = { type: 'denied', reason, by: user.id, at: NOW().toISOString() }
        ticket.updatedAt = ticket.decision.at
        logAudit(db, { actorId: user.id, action: 'platform.support.denied', entity: 'support_request', summary: `Denied support request “${ticket.subject}” — ${reason}`, organizationId: ticket.organizationId, severity: 'warn' })
        persist()
        return { status: 200, data: { request: supportView(db, ticket) } }
      }
      if (p3 && parts[3] === 'reply' && method === 'POST') {
        if (!['open', 'in_progress'].includes(ticket.status)) throw new ApiError(409, 'Messages can only be sent on an active ticket.')
        supportMessage(db, ticket, user, 'platform', body || {})
        ticket.status = 'in_progress'
        persist()
        return { status: 200, data: { request: supportView(db, ticket) } }
      }
      if (p3 && parts[3] === 'resolve' && method === 'POST') {
        if (!['open', 'in_progress'].includes(ticket.status)) throw new ApiError(409, 'Only an active ticket can be resolved.')
        const resolution = safeStr(body && body.resolution, 2000)
        if (!resolution) throw new ApiError(400, 'Add a resolution note for the organization.')
        ticket.status = 'resolved'
        ticket.resolution = resolution
        ticket.resolvedAt = NOW().toISOString()
        supportMessage(db, ticket, user, 'platform', { message: resolution }, { requireText: true })
        logAudit(db, { actorId: user.id, action: 'platform.support.resolved', entity: 'support_ticket', summary: `${ticket.ticketNo} resolved`, organizationId: ticket.organizationId })
        persist()
        return { status: 200, data: { request: supportView(db, ticket) } }
      }
      if (p3 && parts[3] === 'reopen' && method === 'POST') {
        if (ticket.status !== 'resolved') throw new ApiError(409, 'Only a resolved ticket can be reopened.')
        ticket.status = 'in_progress'
        ticket.resolvedAt = null
        const message = safeStr(body && body.message, 2000) || `Ticket ${ticket.ticketNo} was reopened by HappyPix.`
        supportMessage(db, ticket, user, 'platform', { message })
        logAudit(db, { actorId: user.id, action: 'platform.support.reopened', entity: 'support_ticket', summary: `${ticket.ticketNo} reopened`, organizationId: ticket.organizationId, severity: 'warn' })
        persist()
        return { status: 200, data: { request: supportView(db, ticket) } }
      }
    }

    if (p2 === 'users' && !p3) {
      if (method === 'GET') {
        authed() // any platform role can view the internal team; mutations stay Owner-only
        return { status: 200, data: { users: db.users.filter((u) => !u.organizationId).map(userPublic) } }
      }
      if (method === 'POST') {
        authed(PERMS.PLATFORM_USERS_MANAGE)
        const name = safeStr(body && body.name, 80)
        const email = safeStr(body && body.email, 120).toLowerCase()
        const password = String((body && body.password) || '')
        const role = body && body.role
        if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required.')
        const fmt = emailError(email)
        if (fmt) throw new ApiError(400, fmt)
        const policy = passwordPolicyError(password)
        if (policy) throw new ApiError(400, policy)
        if (![ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER].includes(role)) {
          throw new ApiError(400, 'Only Platform Admin and Support Manager accounts can be created from CRM. Owner is a single bootstrap account.')
        }
        if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new ApiError(409, 'A user with this email already exists.')
        const nu = { id: uid('usr'), name, email, password, role, organizationId: null, status: 'active', photoUrl: null, createdAt: NOW().toISOString(), lastLoginAt: null }
        db.users.push(nu)
        logAudit(db, { actorId: user.id, action: 'platform.user.created', entity: 'user', summary: `Internal user ${name} created (${role === ROLES.PLATFORM_ADMIN ? 'Platform Admin' : 'Support Manager'})` })
        persist()
        return { status: 201, data: { user: userPublic(nu) } }
      }
    }
    if (p2 === 'users' && p3 && method === 'PUT') {
      authed(PERMS.PLATFORM_USERS_MANAGE)
      const u = db.users.find((x) => x.id === p3 && !x.organizationId)
      if (!u) throw new ApiError(404, 'User not found.')
      const keys = Object.keys(body || {})
      if (keys.some((key) => key !== 'status')) {
        throw new ApiError(403, 'The Owner cannot edit a team member’s name, email or role. Team members manage their own identity; only activation status can be changed here.')
      }
      if (!['active', 'inactive'].includes(body && body.status)) throw new ApiError(400, 'Status must be active or inactive.')
      if (u.role === ROLES.OWNER && body.status === 'inactive') throw new ApiError(403, 'The Owner account cannot be deactivated.')
      if (u.id === user.id && body.status !== 'active') throw new ApiError(400, 'You cannot deactivate your own account.')
      u.status = body.status
      if (u.status !== 'active') killSessions(db, u.id)
      logAudit(db, { actorId: user.id, action: u.status === 'inactive' ? 'platform.user.deactivated' : 'platform.user.reactivated', entity: 'user', summary: `Internal user ${u.name} ${u.status === 'inactive' ? 'deactivated' : 're-activated'}`, severity: u.status === 'inactive' ? 'warn' : 'info' })
      persist()
      return { status: 200, data: { user: userPublic(u) } }
    }
    // NOTE: admins can no longer reset anyone's password from the CRM.
    // Passwords are self-service via Forgot Password (OTP to the account
    // email) — the platform never generates or displays passwords.

    if (p2 === 'templates') {
      if (!p3 && method === 'GET') {
        authed(roleHasPermission(user.role, PERMS.GLOBAL_TEMPLATES_MANAGE) ? null : PERMS.GLOBAL_TEMPLATES_USE)
        return { status: 200, data: { templates: db.templates.map(withTemplateLayout) } }
      }
      if (!p3 && method === 'POST') {
        // Template Library — create a template in the Playground.
        // The owner shapes palette/ornament/typography (+ optional AI
        // background) against one layout variant; hand-finished designer
        // components live in src/templates and cannot be created here.
        authed(PERMS.GLOBAL_TEMPLATES_MANAGE)
        const { name, description, category, layoutId, design, status, source } = body || {}
        if (!name || !String(name).trim()) throw new ApiError(400, 'Template name is required.')
        if (design && design.bg && design.bg.url) {
          const art = safeMediaUrl(design.bg.url)
          if (!art) throw new ApiError(400, 'Background artwork must be an https:// or data:image/ URL.')
        }
        const layout = layoutById(layoutId)
        if (!layout) throw new ApiError(400, 'A valid layout variant is required (pick one of the 106).')
        const t = {
          id: uid('tpl'),
          componentId: null,
          design: design && typeof design === 'object' ? design : aiDesignFor(Date.now() % 97, layout),
          name: String(name).trim(),
          description: description || '',
          category: category || 'Custom',
          layoutId: layout.id,
          source: source === 'ai_generated' ? 'ai_generated' : 'playground',
          status: status === 'draft' ? 'draft' : 'published',
          active: true,
          usage: 0,
          createdAt: NOW().toISOString(),
          updatedAt: NOW().toISOString(),
        }
        db.templates.unshift(t)
        logAudit(db, { actorId: user.id, action: 'platform.template.created', entity: 'template', summary: `Template “${t.name}” created in the playground (${layoutLabel(layout)})` })
        persist()
        return { status: 201, data: { template: withTemplateLayout(t) } }
      }
    }
    if (p2 === 'templates' && p3 === 'ai-generate' && method === 'POST') {
      // Playground AI assist: generates a design draft (palette + ornaments +
      // AI background art at the layout's exact aspect) for the owner to tweak
      // before saving. Nothing is persisted until "Create template".
      authed(PERMS.GLOBAL_TEMPLATES_MANAGE)
      const { prompt, layoutId } = body || {}
      if (!prompt || !String(prompt).trim()) throw new ApiError(400, 'A prompt is required.')
      const layout = layoutById(layoutId)
      if (!layout) throw new ApiError(400, 'A valid layout variant is required.')
      let hash = 0
      const pt = String(prompt).trim().toLowerCase()
      for (let i = 0; i < pt.length; i++) hash = (hash * 31 + pt.charCodeAt(i)) >>> 0
      const words = String(prompt).trim().split(/\s+/).slice(0, 4).map((w) => w[0].toUpperCase() + w.slice(1))
      const draft = {
        name: words.join(' ') || 'AI Design',
        description: `Generated: ${String(prompt).trim()}`,
        category: 'Custom',
        layoutId: layout.id,
        source: 'ai_generated',
        status: 'draft',
        design: aiDesignFor(hash, layout),
      }
      return { status: 200, data: { draft } }
    }
    if (p2 === 'templates' && p3 && p3 !== 'ai-generate' && method === 'PUT') {
      authed(PERMS.GLOBAL_TEMPLATES_MANAGE)
      const t = db.templates.find((x) => x.id === p3)
      if (!t) throw new ApiError(404, 'Template not found.')
      if (body.layoutId != null) {
        const l = layoutById(body.layoutId)
        if (!l) throw new ApiError(400, 'Unknown layout variant.')
        if (db.events.some((e) => (e.templateIds || []).includes(t.id)) && l.id !== t.layoutId) {
          throw new ApiError(409, 'This template is used by events — its layout cannot change.')
        }
        t.layoutId = l.id
      }
      Object.assign(t, pickDefined(body, ['name', 'category', 'description', 'active', 'status', 'design']))
      t.updatedAt = NOW().toISOString()
      const publishing = body.active === true && t.active !== false
      logAudit(db, {
        actorId: user.id,
        action: body.active === false ? 'platform.template.unpublished' : publishing ? 'platform.template.published' : 'platform.template.updated',
        entity: 'template',
        summary: `Global template “${t.name}” ${body.active === false ? 'unpublished — hidden from organizations' : publishing ? 'published — available to all organizations' : 'updated'}`,
      })
      persist()
      return { status: 200, data: { template: withTemplateLayout(t) } }
    }
    if (p2 === 'templates' && p3 && p3 !== 'ai-generate' && method === 'DELETE') {
      authed(PERMS.GLOBAL_TEMPLATES_MANAGE)
      const t = db.templates.find((x) => x.id === p3)
      if (!t) throw new ApiError(404, 'Template not found.')
      if (t.source === 'designer') throw new ApiError(409, 'Designer templates are hand-crafted code — unpublish instead of deleting.')
      const used = db.events.some((e) => (e.templateIds || []).includes(t.id))
      if (used) throw new ApiError(409, 'This template is used by events. Unpublish it instead of deleting.')
      db.templates = db.templates.filter((x) => x.id !== p3)
      logAudit(db, { actorId: user.id, action: 'platform.template.deleted', entity: 'template', summary: `Template “${t.name}” deleted`, severity: 'warn' })
      persist()
      return { status: 200, data: { ok: true } }
    }
  }

  // ================= ORGANIZATION =================
  if (p === 'org') {
    const u = authed()
    if (!isOrgRole(u.role)) throw new ApiError(403, 'Organization APIs require an organization user.')
    const orgId = u.organizationId
    const org = db.organizations.find((o) => o.id === orgId)
    if (!org) throw new ApiError(404, 'Organization not found.')
    const ps = planSummary(org, db.subscriptions)
    const orgPlanBlocked = ['suspended', 'banned'].includes(org.status) || ps.status === 'expired'
    // active admins in this org — used for last-admin protection
    const activeAdmins = () => db.users.filter((x) => x.organizationId === orgId && x.role === ROLES.ORG_ADMIN && x.status === 'active')

    if (p2 === 'platform-support') {
      authed(PERMS.ORG_PLATFORM_SUPPORT)
      if (!p3 && method === 'GET') {
        const q = url.searchParams
        let rows = (db.platformSupport || []).filter((ticket) => ticket.organizationId === orgId)
        if (q.get('status')) rows = rows.filter((ticket) => ticket.status === q.get('status'))
        rows = rows.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        const all = (db.platformSupport || []).filter((ticket) => ticket.organizationId === orgId)
        return { status: 200, data: { requests: rows.map((ticket) => supportView(db, ticket)), counts: supportCounts(all) } }
      }
      if (!p3 && method === 'POST') {
        const subject = safeStr(body && body.subject, 160)
        const category = SUPPORT_CATEGORIES.includes(body && body.category) ? body.category : 'other'
        const priority = SUPPORT_PRIORITIES.includes(body && body.priority) ? body.priority : 'medium'
        if (!subject) throw new ApiError(400, 'A subject is required.')
        const ticket = {
          id: uid('sup'), ticketNo: null, organizationId: orgId,
          subject, category, priority, status: 'new', createdBy: u.id,
          createdAt: NOW().toISOString(), updatedAt: NOW().toISOString(),
          acceptedAt: null, resolvedAt: null, decision: null, decisionHistory: [],
          reapplyCount: 0, lastReapplication: null, resolution: null, messages: [],
        }
        supportMessage(db, ticket, u, 'org', body || {}, { requireText: true })
        db.platformSupport.unshift(ticket)
        logAudit(db, { actorId: u.id, action: 'organization.platform_support.requested', entity: 'support_request', summary: `Platform support requested: “${subject}”`, organizationId: orgId })
        persist()
        return { status: 201, data: { request: supportView(db, ticket) } }
      }
      const ticket = p3 && (db.platformSupport || []).find((row) => row.id === p3 && row.organizationId === orgId)
      if (p3 && !ticket) throw new ApiError(404, 'Support request not found.')
      if (p3 && !parts[3] && method === 'GET') return { status: 200, data: { request: supportView(db, ticket) } }
      if (p3 && parts[3] === 'reapply' && method === 'POST') {
        if (ticket.status !== 'denied') throw new ApiError(409, 'Only a denied request can be re-applied.')
        const reapplication = supportMessage(db, ticket, u, 'org', body || {}, { requireText: true })
        ticket.decisionHistory = [...(ticket.decisionHistory || []), ticket.decision].filter(Boolean)
        ticket.decision = null
        ticket.status = 'new'
        ticket.ticketNo = null
        ticket.reapplyCount = Number(ticket.reapplyCount || 0) + 1
        // Keep the latest re-application reason explicit so the platform
        // review inbox does not hide it behind the original request message.
        ticket.lastReapplication = { ...reapplication }
        ticket.resolution = null
        logAudit(db, { actorId: u.id, action: 'organization.platform_support.reapplied', entity: 'support_request', summary: `Re-applied platform support request “${ticket.subject}”`, organizationId: orgId })
        persist()
        return { status: 200, data: { request: supportView(db, ticket) } }
      }
      if (p3 && parts[3] === 'reply' && method === 'POST') {
        if (!['open', 'in_progress'].includes(ticket.status)) throw new ApiError(409, 'Messages can only be sent on an accepted, active ticket.')
        supportMessage(db, ticket, u, 'org', body || {})
        ticket.status = 'in_progress'
        persist()
        return { status: 200, data: { request: supportView(db, ticket) } }
      }
    }

    if (p2 === 'dashboard' && method === 'GET') {
      authed(PERMS.ORG_DASHBOARD_VIEW)
      const devices = db.devices.filter((d) => d.organizationId === orgId)
      const events = db.events.filter((e) => e.organizationId === orgId).map((e) => ({ ...e, status: computeEventStatus(e) }))
      const tickets = db.tickets.filter((t) => t.organizationId === orgId)
      const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress')
      const warnings = []
      if (ps.status === 'expiring_soon') warnings.push({ kind: 'plan_expiring', text: `Your ${ps.planName} plan expires in ${ps.daysLeft} day(s).`, tone: 'warn' })
      if (ps.status === 'expired') warnings.push({ kind: 'plan_expired', text: 'Your plan has expired. Renew to create new events and register devices.', tone: 'danger' })
      if (devices.length >= ps.deviceLimit) warnings.push({ kind: 'device_limit', text: `Device limit reached (${devices.length}/${ps.deviceLimit}). Upgrade to add more booths.`, tone: 'warn' })
      const activeCount = events.filter((e) => e.status === 'active').length
      if (activeCount >= ps.eventLimit) warnings.push({ kind: 'event_limit', text: `Parallel active event limit reached (${activeCount}/${ps.eventLimit}).`, tone: 'warn' })
      const offline = devices.filter((d) => !computeDeviceOnline(d))
      if (org.status !== 'suspended' && org.status !== 'banned' && offline.length) warnings.push({ kind: 'booth_offline', text: `${offline.length} booth(s) currently offline.`, tone: 'info' })
      if (orgPlanBlocked) warnings.push({ kind: 'org_blocked', text: org.status === 'banned' ? 'Your organization access is currently banned. Contact HappyPix support.' : 'Your organization is suspended. Contact HappyPix support.', tone: 'danger' })

      const data = {
        organization: { id: org.id, name: org.name, ownerName: org.ownerName, email: org.email },
        plan: ps,
        usage: {
          devicesUsed: devices.length, deviceLimit: ps.deviceLimit,
          eventsUsed: activeCount, eventLimit: ps.eventLimit,
        },
        devices: { total: devices.length, online: devices.length - offline.length, offline: offline.length },
        events: {
          active: events.filter((e) => e.status === 'active'),
          upcoming: events.filter((e) => e.status === 'upcoming'),
          finished: events.filter((e) => e.status === 'finished').slice(0, 3),
          paused: events.filter((e) => e.status === 'paused'),
        },
        tickets: { open: openTickets.length, list: openTickets.slice(0, 5) },
        warnings,
      }
      if (u.role === ROLES.ORG_ADMIN) {
        const rev = revenueAgg(db, orgId)
        const now = NOW()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const wl = walletOf(db, orgId)
        data.revenue = {
          total: rev.total,
          thisMonth: db.payments.filter((x) => x.organizationId === orgId && x.status === 'paid' && new Date(x.createdAt) >= monthStart).reduce((s, x) => s + x.amount, 0),
          payout: payoutOf(db, orgId),
          wallet: { balance: wl.balance, processing: wl.processing, minWithdrawal: wl.minWithdrawal },
          viaUpi: wl.viaUpi,
          viaWallet: wl.credited,
        }
      }
      return { status: 200, data }
    }

    if (p2 === 'revenue' && method === 'GET') {
      authed(PERMS.ORG_REVENUE_VIEW)
      const q = url.searchParams
      const now = NOW()
      const fy = fyStart(now)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const all = revenueAgg(db, orgId)
      const byEvent = db.events
        .filter((e) => e.organizationId === orgId)
        .map((e) => {
          const r = revenueAgg(db, orgId, { eventId: e.id })
          return { id: e.id, name: e.name, status: computeEventStatus(e), ...r }
        })
        .sort((a, b) => b.total - a.total)
      const byDevice = db.devices
        .filter((d) => d.organizationId === orgId)
        .map((d) => {
          const r = revenueAgg(db, orgId, { deviceId: d.id })
          return { id: d.id, name: d.deviceName, online: computeDeviceOnline(d), ...r }
        })
        .sort((a, b) => b.total - a.total)
      // Event × booth matrix — "how much did Event A make from Booth 1".
      const paidRows = db.payments.filter((x) => x.organizationId === orgId && x.status === 'paid')
      const cellMap = new Map()
      for (const x of paidRows) {
        const key = `${x.eventId || 'none'}|${x.deviceId || 'none'}`
        const c = cellMap.get(key) || { eventId: x.eventId || null, deviceId: x.deviceId || null, total: 0, prints: 0, transactions: 0, viaUpi: 0, viaWallet: 0 }
        c.total += x.amount; c.prints += x.printCount; c.transactions += 1
        if (x.settlement === 'wallet') c.viaWallet += x.amount; else c.viaUpi += x.amount
        cellMap.set(key, c)
      }
      const evName = (id) => (db.events.find((e) => e.id === id) || {}).name || (id ? 'Deleted event' : 'No event (walk-in)')
      const devName = (id) => (db.devices.find((d) => d.id === id) || {}).deviceName || (id ? 'Removed booth' : 'Unknown booth')
      const matrix = [...cellMap.values()]
        .map((c) => ({ ...c, eventName: evName(c.eventId), deviceName: devName(c.deviceId) }))
        .sort((a, b) => b.total - a.total)
      const settlement = {
        upi: paidRows.filter((x) => x.settlement !== 'wallet').reduce((s, x) => s + x.amount, 0),
        wallet: paidRows.filter((x) => x.settlement === 'wallet').reduce((s, x) => s + x.amount, 0),
      }
      // paid-with-settlement series per month for the stacked chart
      const monthSplit = monthSeries(db, orgId, 8).map((m) => {
        const rows = paidRows.filter((x) => monthKey(new Date(x.createdAt)) === m.key)
        return { ...m, label: monthLabelOf(m.key), upi: rows.filter((x) => x.settlement !== 'wallet').reduce((s, x) => s + x.amount, 0), wallet: rows.filter((x) => x.settlement === 'wallet').reduce((s, x) => s + x.amount, 0) }
      })
      return {
        status: 200,
        data: {
          payout: payoutOf(db, orgId),
          wallet: walletOf(db, orgId),
          settlement,
          matrix,
          monthSplit,
          total: all.total,
          thisMonth: db.payments.filter((x) => x.organizationId === orgId && x.status === 'paid' && new Date(x.createdAt) >= monthStart).reduce((s, x) => s + x.amount, 0),
          fy: db.payments.filter((x) => x.organizationId === orgId && x.status === 'paid' && new Date(x.createdAt) >= fy).reduce((s, x) => s + x.amount, 0),
          byEvent, byDevice,
          byStatus: {
            paid: db.payments.filter((x) => x.organizationId === orgId && x.status === 'paid').length,
            pending: db.payments.filter((x) => x.organizationId === orgId && x.status === 'pending').length,
            failed: db.payments.filter((x) => x.organizationId === orgId && x.status === 'failed').length,
          },
          monthWise: monthSeries(db, orgId, 8).map((m) => ({ ...m, label: monthLabelOf(m.key) })),
          events: db.events.filter((e) => e.organizationId === orgId).map((e) => ({ id: e.id, name: e.name })),
          devices: db.devices.filter((d) => d.organizationId === orgId).map((d) => ({ id: d.id, name: d.deviceName })),
          filters: { from: q.get('from'), to: q.get('to'), eventId: q.get('eventId'), deviceId: q.get('deviceId') },
        },
      }
    }

    if (p2 === 'wallet' && !p3 && method === 'GET') {
      authed(PERMS.ORG_REVENUE_VIEW)
      return { status: 200, data: { ...walletOf(db, orgId), payout: payoutOf(db, orgId) } }
    }
    if (p2 === 'wallet' && p3 === 'withdraw' && method === 'POST') {
      // Withdraw wallet balance to the org's saved UPI ID. Min ₹500, whole
      // rupees, ≤ available balance. Creates a 'processing' payout that
      // HappyPix settles to the bank (demo: stays processing).
      authed(PERMS.ORG_REVENUE_VIEW)
      if (u.role !== ROLES.ORG_ADMIN) throw new ApiError(403, 'Only an Organization Admin can withdraw from the wallet.')
      const { upiId } = payoutOf(db, orgId)
      if (!upiId) throw new ApiError(400, 'Add your UPI ID in Organization Defaults before withdrawing.')
      const amount = Math.round(Number(body && body.amount))
      const w = walletOf(db, orgId)
      if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) throw new ApiError(400, `Minimum withdrawal is ₹${MIN_WITHDRAWAL}.`)
      if (amount > w.balance) throw new ApiError(400, `You can withdraw up to ₹${w.balance.toLocaleString('en-IN')} right now.`)
      const wd = {
        id: uid('wd'), organizationId: orgId, amount, upiId, status: 'processing',
        reference: `HPX-PO-${String(NOW().getFullYear()).slice(2)}${String(NOW().getMonth() + 1).padStart(2, '0')}-${String(1000 + Math.floor(Math.random() * 9000))}`,
        requestedAt: NOW().toISOString(), paidAt: null, requestedBy: u.id,
      }
      db.withdrawals.push(wd)
      logAudit(db, { actorId: u.id, action: 'organization.wallet.withdrawal_requested', entity: 'wallet', summary: `Withdrawal of ₹${amount.toLocaleString('en-IN')} requested to ${upiId} (${wd.reference})`, organizationId: orgId, severity: 'warn' })
      persist()
      return { status: 201, data: { withdrawal: wd, wallet: { ...walletOf(db, orgId), payout: payoutOf(db, orgId) } } }
    }

    if (p2 === 'events' && !p3) {
      if (method === 'GET') {
        authed(PERMS.EVENTS_DEVICES_MANAGE)
        const q = url.searchParams
        let events = db.events.filter((e) => e.organizationId === orgId).map((e) => {
          const assigned = db.devices.filter((d) => d.assignedEventId === e.id).map((d) => ({ id: d.id, name: d.deviceName, online: computeDeviceOnline(d) }))
          return { ...e, status: computeEventStatus(e), assignedDevices: assigned, deviceCount: assigned.length }
        })
        if (q.get('status')) events = events.filter((e) => e.status === q.get('status'))
        if (q.get('search')) events = events.filter((e) => e.name.toLowerCase().includes(q.get('search').toLowerCase()) || (e.location || '').toLowerCase().includes(q.get('search').toLowerCase()))
        events.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
        return { status: 200, data: { events, canCreate: !orgPlanBlocked && events.filter((e) => e.status === 'active').length < ps.eventLimit } }
      }
      if (method === 'POST') {
        authed(PERMS.EVENT_CREATE)
        // Event creation snapshots the organization's layout prices and allows
        // event-specific overrides. This keeps later default-price edits from
        // silently changing an already configured event.
        const { name, location, clientName, startDate, endDate, digitalCopy, filters, templateIds, branding, layoutPrices } = body || {}
        if (!name || !startDate || !endDate) throw new ApiError(400, 'Event name, start and end are required.')
        if (new Date(startDate) >= new Date(endDate)) throw new ApiError(400, 'End time must be after start time.')
        if (orgPlanBlocked) throw new ApiError(403, org.status === 'expired' || ps.status === 'expired' ? 'Plan expired — renew your plan to create events.' : 'Organization is ' + org.status + ' — new events are blocked.')
        const active = db.events.filter((e) => e.organizationId === orgId && computeEventStatus(e) === 'active').length
        if (active >= ps.eventLimit) throw new ApiError(403, `Your ${ps.planName} plan allows a maximum of ${ps.eventLimit} parallel active event(s).`)
        const tids = Array.isArray(templateIds) ? templateIds : []
        for (const tid of tids) {
          const tpl = db.templates.find((t) => t.id === tid)
          if (!tpl) throw new ApiError(400, 'A selected template does not exist.')
          if (!tpl.active) throw new ApiError(400, `Template “${tpl.name}” is disabled by the platform.`)
        }
        const fids = Array.isArray(filters) ? filters : []
        for (const fid of fids) {
          if (!FILTERS.some((f) => f.id === fid)) throw new ApiError(400, `Unknown photo filter “${fid}”.`)
        }
        // Branding logos = sponsors / host / venue / team artwork (NOT the
        // org logo). Optional, up to 15; each template places them at its
        // reserved footer positions.
        let logos = Array.isArray(branding && branding.logos) ? branding.logos.filter((x) => typeof x === 'string' && x) : []
      if (logos.length > 15) throw new ApiError(400, 'A maximum of 15 logos per event — trim the list.')
      logos = logos.map((src) => safeMediaUrl(src)).filter(Boolean)
      if (branding && branding.tagline) branding.tagline = safeStr(branding.tagline, 120)
        if (!logos.length && branding && branding.logoUrl) logos = [branding.logoUrl]
        const ev = {
          id: uid('evt'), organizationId: orgId, name: String(name).trim(),
          location: location || '', clientName: clientName || '',
          startDate, endDate, paused: false,
          templateIds: tids,
          filters: fids,
          digitalCopy: !!digitalCopy,
          branding: { logos, tagline: (branding && branding.tagline) || '' },
          layoutPrices: validateLayoutPrices(layoutPrices, { ...suggestedPriceMap(), ...((db.orgDefaults[orgId] && db.orgDefaults[orgId].layoutPrices) || {}) }),
          shortCode: name.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '') + String(Math.floor(10 + Math.random() * 90)),
          createdAt: NOW().toISOString(),
        }
        db.events.push(ev)
        logAudit(db, { actorId: u.id, action: 'event.created', entity: 'event', summary: `Event “${ev.name}” created (${tids.length} template(s), digital copy ${ev.digitalCopy ? 'on' : 'off'})`, organizationId: orgId })
        persist()
        return { status: 201, data: { event: { ...ev, status: computeEventStatus(ev), assignedDevices: [] } } }
      }
    }
    if (p2 === 'events' && p3 && method === 'PUT') {
      authed(PERMS.EVENTS_DEVICES_MANAGE)
      const e = db.events.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!e) throw new ApiError(404, 'Event not found.')
      for (const tid of (body && body.templateIds) || []) {
        const tpl = db.templates.find((t) => t.id === tid)
        if (!tpl) throw new ApiError(400, 'A selected template does not exist.')
        if (!tpl.active) throw new ApiError(400, `Template “${tpl.name}” is disabled by the platform.`)
      }
      for (const fid of (body && body.filters) || []) {
        if (!FILTERS.some((f) => f.id === fid)) throw new ApiError(400, `Unknown photo filter “${fid}”.`)
      }
      const nextStart = body && body.startDate !== undefined ? body.startDate : e.startDate
      const nextEnd = body && body.endDate !== undefined ? body.endDate : e.endDate
      if (new Date(nextStart) >= new Date(nextEnd)) throw new ApiError(400, 'End time must be after start time.')
      Object.assign(e, pickDefined(body, ['name', 'location', 'clientName', 'startDate', 'endDate', 'templateIds', 'filters', 'digitalCopy', 'branding']))
      if (body && body.layoutPrices !== undefined) {
        const defaults = { ...suggestedPriceMap(), ...((db.orgDefaults[orgId] && db.orgDefaults[orgId].layoutPrices) || {}) }
        e.layoutPrices = validateLayoutPrices(body.layoutPrices, e.layoutPrices || defaults)
      }
      logAudit(db, { actorId: u.id, action: 'event.updated', entity: 'event', summary: `Event “${e.name}” updated`, organizationId: orgId })
      persist()
      return { status: 200, data: { event: e } }
    }
    if (p2 === 'events' && p3 && parts[3] === 'pause' && method === 'POST') {
      authed(PERMS.EVENTS_DEVICES_MANAGE)
      const e = db.events.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!e) throw new ApiError(404, 'Event not found.')
      e.paused = true
      logAudit(db, { actorId: u.id, action: 'event.paused', entity: 'event', summary: `Event “${e.name}” paused`, organizationId: orgId })
      persist()
      return { status: 200, data: { ok: true } }
    }
    if (p2 === 'events' && p3 && parts[3] === 'resume' && method === 'POST') {
      authed(PERMS.EVENTS_DEVICES_MANAGE)
      const e = db.events.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!e) throw new ApiError(404, 'Event not found.')
      e.paused = false
      logAudit(db, { actorId: u.id, action: 'event.resumed', entity: 'event', summary: `Event “${e.name}” resumed`, organizationId: orgId })
      persist()
      return { status: 200, data: { ok: true } }
    }
    if (p2 === 'events' && p3 && method === 'DELETE') {
      authed(PERMS.EVENTS_DEVICES_MANAGE)
      const e = db.events.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!e) throw new ApiError(404, 'Event not found.')
      if (computeEventStatus(e) === 'active') throw new ApiError(409, 'Pause the event before deleting it.')
      db.events = db.events.filter((x) => x.id !== p3)
      db.devices.forEach((d) => { if (d.assignedEventId === p3) d.assignedEventId = null })
      db.coupons.forEach((c) => { c.eventIds = (c.eventIds || []).filter((id) => id !== p3) })
      logAudit(db, { actorId: u.id, action: 'event.deleted', entity: 'event', summary: `Event “${e.name}” deleted`, organizationId: orgId, severity: 'warn' })
      persist()
      return { status: 200, data: { ok: true } }
    }

    if (p2 === 'devices') {
      if (method === 'GET') {
        authed(PERMS.EVENTS_DEVICES_MANAGE)
        const devices = db.devices.filter((d) => d.organizationId === orgId).map((d) => {
          const ev = d.assignedEventId ? db.events.find((e) => e.id === d.assignedEventId) : null
          return { ...d, online: computeDeviceOnline(d), assignedEvent: ev ? { id: ev.id, name: ev.name, status: computeEventStatus(ev) } : null }
        })
        return { status: 200, data: { devices, limit: { used: devices.length, allowed: ps.deviceLimit }, canRegister: !orgPlanBlocked && devices.length < ps.deviceLimit } }
      }
      if (p3 && method === 'PUT') {
        // Rename a device and/or set the on-ground booth operator
        // (name + phone). Org Admin AND Org Manager may both do this —
        // whoever assigns an operator records the contact here so the
        // rest of the team knows who is standing at the booth.
        authed(PERMS.EVENTS_DEVICES_MANAGE)
        const d = db.devices.find((x) => x.id === p3 && x.organizationId === orgId)
        if (!d) throw new ApiError(404, 'Device not found.')
        const changes = []
        if (body && body.deviceName != null) {
          const name = String(body.deviceName).trim()
          if (!name) throw new ApiError(400, 'Device name cannot be empty.')
          if (name !== d.deviceName) { changes.push(`renamed “${d.deviceName}” → “${name}”`); d.deviceName = name }
        }
        if (body && body.operatorName !== undefined) {
          const v = String(body.operatorName || '').trim() || null
          if (v && !d.operatorName) changes.push(`operator ${v} assigned`)
          else if (!v && d.operatorName) changes.push(`operator ${d.operatorName} removed`)
          else if (v && v !== d.operatorName) changes.push(`operator changed to ${v}`)
          d.operatorName = v
        }
        if (body && body.operatorPhone !== undefined) {
          const v = String(body.operatorPhone || '').trim() || null
          if (v && v.length > 20) throw new ApiError(400, 'Phone number looks too long.')
          d.operatorPhone = v
        }
        if (changes.length) {
          logAudit(db, { actorId: u.id, action: 'device.updated', entity: 'device', summary: `${d.deviceName}: ${changes.join(', ')}`, organizationId: orgId })
          persist()
        }
        const ev = d.assignedEventId ? db.events.find((e) => e.id === d.assignedEventId) : null
        return { status: 200, data: { device: { ...d, online: computeDeviceOnline(d), assignedEvent: ev ? { id: ev.id, name: ev.name, status: computeEventStatus(ev) } : null } } }
      }
    }
    if (p2 === 'devices' && p3 && parts[3] === 'assign' && method === 'POST') {
      authed(PERMS.EVENTS_DEVICES_MANAGE)
      const d = db.devices.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!d) throw new ApiError(404, 'Device not found.')
      const ev = db.events.find((e) => e.id === body.eventId && e.organizationId === orgId)
      if (!ev) throw new ApiError(404, 'Event not found.')
      const st = computeEventStatus(ev)
      if (st === 'finished') throw new ApiError(409, 'Cannot assign a finished event to a device.')
      d.assignedEventId = ev.id
      logAudit(db, { actorId: u.id, action: 'event.assigned_to_device', entity: 'event', summary: `Event “${ev.name}” assigned to ${d.deviceName}`, organizationId: orgId })
      persist()
      return { status: 200, data: { ok: true } }
    }
    if (p2 === 'devices' && p3 && parts[3] === 'unassign' && method === 'POST') {
      authed(PERMS.EVENTS_DEVICES_MANAGE)
      const d = db.devices.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!d) throw new ApiError(404, 'Device not found.')
      const evName = d.assignedEventId ? db.events.find((e) => e.id === d.assignedEventId)?.name : null
      d.assignedEventId = null
      logAudit(db, { actorId: u.id, action: 'event.unassigned_from_device', entity: 'event', summary: `Event ${evName ? `“${evName}”` : 'assignment'} removed from ${d.deviceName}`, organizationId: orgId })
      persist()
      return { status: 200, data: { ok: true } }
    }
    if (p2 === 'devices' && p3 && method === 'DELETE') {
      authed(PERMS.EVENTS_DEVICES_MANAGE)
      const d = db.devices.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!d) throw new ApiError(404, 'Device not found.')
      db.devices = db.devices.filter((x) => x.id !== p3)
      logAudit(db, { actorId: u.id, action: 'device.removed', entity: 'device', summary: `Device “${d.deviceName}” removed`, organizationId: orgId, severity: 'warn' })
      persist()
      return { status: 200, data: { ok: true } }
    }

    if (p2 === 'tickets' && !p3) {
      if (method === 'GET') {
        authed(PERMS.TICKETS_RESOLVE)
        const q = url.searchParams
        let tix = db.tickets.filter((t) => t.organizationId === orgId)
        if (q.get('status')) tix = tix.filter((t) => t.status === q.get('status'))
        if (q.get('priority')) tix = tix.filter((t) => t.priority === q.get('priority'))
        tix = tix.map(withTicketRefs)
        tix.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        const counts = { open: 0, in_progress: 0, resolved: 0, closed: 0 }
        db.tickets.filter((t) => t.organizationId === orgId).forEach((t) => { counts[t.status]++ })
        return { status: 200, data: { tickets: tix, counts } }
      }
    }
    if (p2 === 'tickets' && p3 && method === 'GET') {
      authed(PERMS.TICKETS_RESOLVE)
      const t = db.tickets.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!t) throw new ApiError(404, 'Ticket not found.')
      return { status: 200, data: { ticket: withTicketRefs(t) } }
    }
    if (p2 === 'tickets' && p3 && parts[3] === 'reply' && method === 'POST') {
      authed(PERMS.TICKETS_RESOLVE)
      const t = db.tickets.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!t) throw new ApiError(404, 'Ticket not found.')
      if (!String((body && body.message) || '').trim()) throw new ApiError(400, 'Message cannot be empty.')
      const roleLabel = u.role === ROLES.ORG_ADMIN ? 'Organization Admin' : 'Organization Manager'
      t.messages.push({ id: uid('m'), author: `${u.name} (${roleLabel})`, at: NOW().toISOString(), text: String(body.message).trim() })
      if (t.status === 'open') t.status = 'in_progress'
      t.updatedAt = NOW().toISOString()
      persist()
      return { status: 200, data: { ticket: withTicketRefs(t) } }
    }
    if (p2 === 'tickets' && p3 && parts[3] === 'resolve' && method === 'POST') {
      authed(PERMS.TICKETS_RESOLVE)
      const t = db.tickets.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!t) throw new ApiError(404, 'Ticket not found.')
      t.status = 'resolved'
      t.resolution = String((body && body.note) || t.resolution || 'Resolved by organization team.')
      t.updatedAt = NOW().toISOString()
      logAudit(db, { actorId: u.id, action: 'ticket.resolved', entity: 'ticket', summary: `Ticket “${t.subject}” resolved`, organizationId: orgId })
      persist()
      return { status: 200, data: { ticket: withTicketRefs(t) } }
    }
    if (p2 === 'tickets' && p3 && parts[3] === 'reopen' && method === 'POST') {
      authed(PERMS.TICKETS_RESOLVE)
      const t = db.tickets.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!t) throw new ApiError(404, 'Ticket not found.')
      t.status = 'open'
      t.updatedAt = NOW().toISOString()
      persist()
      return { status: 200, data: { ticket: withTicketRefs(t) } }
    }

    if (p2 === 'defaults') {
      // Layouts & print pricing. The catalogue of 16 layout families and
      // their slot iterations is shared contract data (src/lib/layouts.js);
      // the org's saved document only carries its price overrides.
      const fullPrices = (saved) => ({ ...suggestedPriceMap(), ...((saved && saved.layoutPrices) || {}) })
      if (method === 'GET') {
        authed(PERMS.DEFAULTS_VIEW)
        const saved = db.orgDefaults[orgId]
        return {
          status: 200,
          data: {
            name: (saved && saved.name) || org.name,
            logoUrl: (saved && saved.logoUrl) || null,
            boothTimeoutSec: (saved && saved.boothTimeoutSec) || 600,
            layoutPrices: fullPrices(saved),
            ...payoutOf(db, orgId),
            wallet: { balance: walletOf(db, orgId).balance },
          },
        }
      }
      if (method === 'PUT') {
        authed(PERMS.DEFAULTS_EDIT)
        const saved = db.orgDefaults[orgId] || {}
        const cur = {
          name: saved.name || org.name,
          logoUrl: saved.logoUrl || null,
          boothTimeoutSec: saved.boothTimeoutSec || 600,
          layoutPrices: fullPrices(saved),
          ...payoutOf(db, orgId),
        }
        if (body.name) { cur.name = safeStr(body.name, 80); org.name = cur.name }
        if (body.upiId !== undefined) {
          const id = safeStr(body.upiId, 256)
          const err = upiError(id)
          if (err) throw new ApiError(400, err)
          cur.upiId = id || null
        }
        if (body.payoutMode !== undefined) {
          if (!['upi', 'wallet'].includes(body.payoutMode)) throw new ApiError(400, 'payoutMode must be "upi" or "wallet".')
          if (body.payoutMode === 'upi' && !cur.upiId) throw new ApiError(400, 'Add your UPI ID before turning on direct UPI payouts.')
          cur.payoutMode = body.payoutMode
        }
        if (body.logoUrl != null) {
          const media = safeMediaUrl(body.logoUrl)
          if (body.logoUrl && !media) throw new ApiError(400, 'Logo must be an https:// or data:image/ URL.')
          cur.logoUrl = media
        }
        if (body.boothTimeoutSec != null) {
          const sec = Number(body.boothTimeoutSec)
          if (!Number.isFinite(sec) || sec < 10 || sec > 86400) throw new ApiError(400, 'Booth idle timeout must be between 10 and 86400 seconds.')
          cur.boothTimeoutSec = sec
        }
        if (body.layoutPrices != null) {
          if (typeof body.layoutPrices !== 'object') throw new ApiError(400, 'layoutPrices must be an object of "familyId:slots" → price.')
          const prices = { ...cur.layoutPrices }
          for (const [k, v] of Object.entries(body.layoutPrices)) {
            const [fid, slotsStr] = String(k).split(':')
            const family = LAYOUT_FAMILIES.find((f) => f.id === fid)
            const slots = Number(slotsStr)
            if (!family || !family.slots.includes(slots)) throw new ApiError(400, `Unknown layout iteration "${k}".`)
            const price = Number(v)
            if (!Number.isFinite(price) || price < 0 || price > 100000) throw new ApiError(400, `Price for "${k}" must be between 0 and 100000.`)
            prices[k] = Math.round(price)
          }
          cur.layoutPrices = prices
        }
        const prevMode = payoutOf(db, orgId).payoutMode
        db.orgDefaults[orgId] = cur
        if (prevMode !== cur.payoutMode) {
          logAudit(db, { actorId: u.id, action: 'organization.payout.mode_changed', entity: 'organization', summary: cur.payoutMode === 'upi' ? `Direct UPI payouts turned ON — guests now pay ${cur.upiId} directly` : 'Direct UPI payouts PAUSED — booth revenue now accrues to the HappyPix wallet', organizationId: orgId, severity: 'warn' })
        }
        logAudit(db, { actorId: u.id, action: 'organization.defaults.updated', entity: 'organization', summary: `Layout prices / defaults updated for ${org.name}`, organizationId: orgId })
        persist()
        return { status: 200, data: { ...cur, wallet: { balance: walletOf(db, orgId).balance } } }
      }
    }

    if (p2 === 'coupons' && !p3) {
      if (method === 'GET') {
        authed(PERMS.COUPONS_MANAGE)
        const rows = db.coupons
          .filter((c) => c.organizationId === orgId)
          .map((c) => ({ ...c, events: (c.eventIds || []).map((id) => { const e = db.events.find((x) => x.id === id); return e ? { id, name: e.name } : null }).filter(Boolean), isExhausted: c.usedCount >= c.quantity, expired: new Date(c.expiryDate) < NOW() }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        return { status: 200, data: { coupons: rows, events: db.events.filter((e) => e.organizationId === orgId).map((e) => ({ id: e.id, name: e.name })) } }
      }
      if (method === 'POST') {
        authed(PERMS.COUPONS_MANAGE)
        const { type, value, quantity, expiryDate, eventIds } = body || {}
        const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (!code || !type || !value || !quantity || !expiryDate) throw new ApiError(400, 'Code, discount, quantity and expiry are required.')
        if (type === 'percentage' && (value <= 0 || value > 100)) throw new ApiError(400, 'Percentage must be between 1 and 100.')
        if (type === 'fixed' && value <= 0) throw new ApiError(400, 'Fixed discount must be positive.')
        if (db.coupons.some((c) => c.organizationId === orgId && c.code.toLowerCase() === code.toLowerCase())) throw new ApiError(409, 'A coupon with this code already exists.')
        const c = { id: uid('cup'), organizationId: orgId, code: code.toUpperCase(), type, value, quantity, usedCount: 0, expiryDate, eventIds: eventIds || [], status: 'active', createdAt: NOW().toISOString(), updatedAt: NOW().toISOString() }
        db.coupons.push(c)
        logAudit(db, { actorId: u.id, action: 'coupon.created', entity: 'coupon', summary: `Coupon ${c.code} created (${type === 'percentage' ? c.value + '%' : '₹' + c.value} off, ${c.quantity} uses)`, organizationId: orgId })
        persist()
        return { status: 201, data: { coupon: c } }
      }
    }
    if (p2 === 'coupons' && p3 && method === 'PUT') {
      authed(PERMS.COUPONS_MANAGE)
      const c = db.coupons.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!c) throw new ApiError(404, 'Coupon not found.')
      Object.assign(c, pickDefined(body, ['code', 'type', 'value', 'quantity', 'expiryDate', 'eventIds']))
      c.updatedAt = NOW().toISOString()
      logAudit(db, { actorId: u.id, action: 'coupon.updated', entity: 'coupon', summary: `Coupon ${c.code} updated`, organizationId: orgId })
      persist()
      return { status: 200, data: { coupon: c } }
    }
    if (p2 === 'coupons' && p3 && parts[3] === 'pause' && method === 'POST') {
      authed(PERMS.COUPONS_MANAGE)
      const c = db.coupons.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!c) throw new ApiError(404, 'Coupon not found.')
      c.status = 'paused'
      logAudit(db, { actorId: u.id, action: 'coupon.paused', entity: 'coupon', summary: `Coupon ${c.code} paused`, organizationId: orgId })
      persist()
      return { status: 200, data: { ok: true } }
    }
    if (p2 === 'coupons' && p3 && parts[3] === 'activate' && method === 'POST') {
      authed(PERMS.COUPONS_MANAGE)
      const c = db.coupons.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!c) throw new ApiError(404, 'Coupon not found.')
      c.status = 'active'
      logAudit(db, { actorId: u.id, action: 'coupon.updated', entity: 'coupon', summary: `Coupon ${c.code} re-activated`, organizationId: orgId })
      persist()
      return { status: 200, data: { ok: true } }
    }
    if (p2 === 'coupons' && p3 && method === 'DELETE') {
      authed(PERMS.COUPONS_MANAGE)
      const c = db.coupons.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!c) throw new ApiError(404, 'Coupon not found.')
      db.coupons = db.coupons.filter((x) => x.id !== p3)
      logAudit(db, { actorId: u.id, action: 'coupon.deleted', entity: 'coupon', summary: `Coupon ${c.code} deleted`, organizationId: orgId, severity: 'warn' })
      persist()
      return { status: 200, data: { ok: true } }
    }

    if (p2 === 'gallery' && method === 'GET') {
      authed(PERMS.ORG_GALLERY_VIEW)
      const settings = db.platformSettings || { galleryEnabled: false, requireGuestConsent: true }
      const events = db.events.filter((e) => e.organizationId === orgId).map((e) => ({ id: e.id, name: e.name }))
      const booths = db.devices.filter((d) => d.organizationId === orgId).map((d) => ({ id: d.id, name: d.deviceName }))
      if (!settings.galleryEnabled) return { status: 200, data: { enabled: false, requireGuestConsent: settings.requireGuestConsent, photos: [], events, booths } }
      const eventId = url.searchParams.get('eventId')
      const boothId = url.searchParams.get('boothId')
      let photos = (db.galleryPhotos || []).filter((photo) => photo.organizationId === orgId)
      if (settings.requireGuestConsent) photos = photos.filter((photo) => photo.guestConsent === true)
      if (eventId) photos = photos.filter((photo) => photo.eventId === eventId)
      if (boothId) photos = photos.filter((photo) => photo.boothId === boothId)
      photos = photos.map((photo) => ({ ...photo,
        eventName: events.find((e) => e.id === photo.eventId)?.name || 'Deleted event',
        boothName: booths.find((b) => b.id === photo.boothId)?.name || 'Removed booth',
      })).sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))
      return { status: 200, data: { enabled: true, requireGuestConsent: settings.requireGuestConsent, photos, events, booths } }
    }

    if (p2 === 'team' && !p3) {
      if (method === 'GET') {
        authed()
        const members = db.users.filter((x) => x.organizationId === orgId).map((x) => ({ ...userPublic(x), roleLabel: x.role }))
        return { status: 200, data: { members, canManage: u.role === ROLES.ORG_ADMIN } }
      }
      if (method === 'POST') {
        authed(PERMS.ORG_TEAM_MANAGE)
        const name = safeStr(body && body.name, 80)
        const email = safeStr(body && body.email, 120).toLowerCase()
        const password = String((body && body.password) || '')
        const role = (body && body.role) || ROLES.ORG_MANAGER
        if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required.')
        const fmt = emailError(email)
        if (fmt) throw new ApiError(400, fmt)
        const policy = passwordPolicyError(password)
        if (policy) throw new ApiError(400, policy)
        if (![ROLES.ORG_ADMIN, ROLES.ORG_MANAGER].includes(role)) throw new ApiError(400, 'Team members are Organization Admins or Organization Managers.')
        if (db.users.some((x) => x.email.toLowerCase() === email.toLowerCase())) throw new ApiError(409, 'A user with this email already exists.')
        const nu = { id: uid('usr'), name, email, password, role, organizationId: orgId, status: 'active', photoUrl: null, createdAt: NOW().toISOString(), lastLoginAt: null }
        db.users.push(nu)
        logAudit(db, { actorId: u.id, action: 'organization.team.created', entity: 'user', summary: `${role === ROLES.ORG_ADMIN ? 'Organization Admin' : 'Organization Manager'} ${name} created`, organizationId: orgId })
        persist()
        return { status: 201, data: { user: userPublic(nu) } }
      }
    }
    if (p2 === 'team' && p3 && method === 'PUT') {
      authed(PERMS.ORG_TEAM_MANAGE)
      const m = db.users.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!m) throw new ApiError(404, 'Team member not found.')
      const keys = Object.keys(body || {})
      if (keys.some((key) => key !== 'status')) throw new ApiError(403, 'Organization Admins cannot edit a team member’s name, email or role. Only activation status can be changed here.')
      if (!['active', 'inactive'].includes(body && body.status)) throw new ApiError(400, 'Status must be active or inactive.')
      if (m.role === ROLES.ORG_ADMIN && body.status !== 'active' && activeAdmins().length <= 1) throw new ApiError(409, 'This is the last active admin and cannot be deactivated.')
      if (m.id === u.id && body.status !== 'active') throw new ApiError(400, 'You cannot deactivate your own account.')
      m.status = body.status
      if (m.status !== 'active') killSessions(db, m.id)
      logAudit(db, { actorId: u.id, action: m.status === 'active' ? 'organization.team.reactivated' : 'organization.team.deactivated', entity: 'user', summary: `Team member ${m.name} ${m.status === 'active' ? 're-activated' : 'deactivated'}`, organizationId: orgId })
      persist()
      return { status: 200, data: { user: userPublic(m) } }
    }
    if (p2 === 'team' && p3 && parts[3] === 'deactivate' && method === 'POST') {
      authed(PERMS.ORG_TEAM_MANAGE)
      const m = db.users.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!m) throw new ApiError(404, 'Team member not found.')
      if (m.role === ROLES.ORG_ADMIN && activeAdmins().length <= 1) {
        throw new ApiError(409, 'This is the last active admin — promote another admin first.')
      }
      if (m.id === u.id) throw new ApiError(400, 'You cannot deactivate your own account.')
      m.status = 'inactive'
      killSessions(db, m.id)
      logAudit(db, { actorId: u.id, action: 'organization.team.deactivated', entity: 'user', summary: `Team member ${m.name} deactivated`, organizationId: orgId, severity: 'warn' })
      persist()
      return { status: 200, data: { ok: true } }
    }
    if (p2 === 'team' && p3 && parts[3] === 'activate' && method === 'POST') {
      authed(PERMS.ORG_TEAM_MANAGE)
      const m = db.users.find((x) => x.id === p3 && x.organizationId === orgId)
      if (!m) throw new ApiError(404, 'Team member not found.')
      m.status = 'active'
      logAudit(db, { actorId: u.id, action: 'organization.team.updated', entity: 'user', summary: `Team member ${m.name} re-activated`, organizationId: orgId })
      persist()
      return { status: 200, data: { ok: true } }
    }
    // NOTE: password reset is self-service (Forgot Password OTP) — see the
    // auth routes. Team admins manage membership and roles, not passwords.

    if (p2 === 'audit' && method === 'GET') {
      authed(PERMS.ORG_AUDIT_VIEW)
      const q = url.searchParams
      let rows = db.audit.filter((a) => a.organizationId === orgId)
      if (q.get('from')) rows = rows.filter((a) => new Date(a.at) >= new Date(q.get('from')))
      if (q.get('to')) rows = rows.filter((a) => new Date(a.at) <= new Date(q.get('to') + 'T23:59:59'))
      if (q.get('action')) rows = rows.filter((a) => a.action.includes(q.get('action')))
      const actors = db.users.filter((x) => x.organizationId === orgId)
      return { status: 200, data: { ...paginated(rows, { page: q.get('page'), limit: q.get('limit') || 20 }), actors } }
    }
  }

  throw new ApiError(404, `No route: ${method} ${path}`)

  function withTicketRefs(t) {
    const ev = t.eventId ? db.events.find((e) => e.id === t.eventId) : null
    const dev = t.deviceId ? db.devices.find((d) => d.id === t.deviceId) : null
    // Resolve booth-session ids (template, event, device) into display names.
    let session = t.session || null
    if (session) {
      const pkg = session.package || {}
      const tpl = pkg.templateId ? db.templates.find((x) => x.id === pkg.templateId) : null
      session = {
        ...session,
        event: ev ? { id: ev.id, name: ev.name } : null,
        device: dev ? { id: dev.id, name: dev.deviceName } : null,
        package: {
          ...pkg,
          templateName: pkg.templateName || (tpl ? tpl.name : pkg.template) || null,
        },
      }
    }
    return {
      ...t,
      event: ev ? { id: ev.id, name: ev.name } : null,
      device: dev ? { id: dev.id, name: dev.deviceName } : null,
      session,
    }
  }
}

function pickDefined(obj, keys) {
  const out = {}
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k]
  return out
}

function monthLabelOf(key) {
  const [y, m] = key.split('-').map(Number)
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[m - 1]} ${String(y).slice(2)}`
}

function quarterSeries(db, year) {
  const out = []
  for (let q = 1; q <= 4; q++) {
    const start = new Date(year, (q - 1) * 3, 1)
    const end = new Date(year, q * 3, 1)
    const v = db.subscriptions
      .filter((s) => s.paidAt && s.amount > 0)
      .filter((s) => { const d = new Date(s.paidAt); return d >= start && d < end })
      .reduce((sum, s) => sum + s.amount, 0)
    out.push({ key: `Q${q}`, label: `Q${q} ${String(year).slice(2)}`, value: v })
  }
  return out
}
