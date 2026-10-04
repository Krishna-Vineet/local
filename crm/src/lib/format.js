// Formatting helpers — INR, dates, relative time.
// Missing/invalid input renders NA (never a blank) so gaps are visible.
export const NA = 'Not available'

export function inr(n, { decimals = 0 } = {}) {
  if (n == null || isNaN(n)) return NA
  const v = Number(n)
  return '₹' + v.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function inrCompact(n) {
  if (n == null || isNaN(n)) return NA
  const v = Number(n)
  if (Math.abs(v) >= 10000000) return '₹' + (v / 10000000).toFixed(2) + 'Cr'
  if (Math.abs(v) >= 100000) return '₹' + (v / 100000).toFixed(2) + 'L'
  if (Math.abs(v) >= 1000) return '₹' + (v / 1000).toFixed(1) + 'K'
  return '₹' + Math.round(v).toLocaleString('en-IN')
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function dateShort(iso) {
  if (!iso) return NA
  const d = new Date(iso)
  if (isNaN(d)) return NA
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function dateMed(iso) {
  if (!iso) return NA
  const d = new Date(iso)
  if (isNaN(d)) return NA
  let h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h}:${m} ${ampm}`
}

export function monthLabel(d) {
  return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

export function relativeTime(iso) {
  if (!iso) return 'never'
  const t = new Date(iso).getTime()
  if (isNaN(t)) return 'never'
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  return dateShort(iso)
}

export function daysUntil(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (isNaN(t)) return null
  return Math.ceil((t - Date.now()) / 86400000)
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?'
}

const AVATAR_COLORS = ['#EA097F', '#3871C1', '#5F4CAA', '#6FA82B', '#B45309', '#0E7490', '#BE185D', '#4338CA']
export function avatarColor(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function maskId(id = '') {
  if (!id || id.length < 8) return id || '—'
  return `${id.slice(0, 4)}…${id.slice(-4)}`
}

export function uuidShort(u = '') {
  return u ? u.slice(0, 8) : '—'
}

// Indian fiscal year: April–March
export function fyLabel(d = new Date()) {
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  return `FY ${year}-${String(year + 1).slice(2)}`
}

export function fyStart(d = new Date()) {
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  return new Date(year, 3, 1)
}

export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
