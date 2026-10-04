// Typed access to build-time environment (see .env.example).
// Only VITE_-prefixed variables reach the browser; all are strings.
const E = import.meta.env || {}

export const ENV = {
  MOCK: E.VITE_MOCK !== 'false',
  API_URL: String(E.VITE_API_URL || '').replace(/\/$/, ''),
  SESSION_TTL_MIN: Math.max(5, Number(E.VITE_SESSION_TTL_MIN) || 480),
  MAX_LOGIN_ATTEMPTS: Math.max(3, Number(E.VITE_MAX_LOGIN_ATTEMPTS) || 5),
  WEBSITE_URL: String(E.VITE_WEBSITE_URL || 'https://happypix.vercel.app'),
  SUPPORT_EMAIL: String(E.VITE_SUPPORT_EMAIL || 'support@happypix.com'),
  LOG_LEVEL: ['silent', 'error', 'debug'].includes(E.VITE_LOG_LEVEL) ? E.VITE_LOG_LEVEL : 'error',
}

// Opens external links safely (no window.opener leakage).
export function openExternal(url) {
  const w = window.open(url, '_blank', 'noopener,noreferrer')
  if (w) w.opener = null
}
