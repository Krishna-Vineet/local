// API client — connects directly to the real HappyPix backend HTTP API (v2 contract).
import { ENV } from '../lib/env.js'
export { ENV } from '../lib/env.js'

const API_BASE = ENV.API_URL

const log = {
  debug: (...a) => { if (ENV.LOG_LEVEL === 'debug') console.debug('[api]', ...a) },
  error: (...a) => { if (ENV.LOG_LEVEL !== 'silent') console.error('[api]', ...a) },
}

const TOKEN_KEY = 'hp_v2_token'
const USER_KEY = 'hp_v2_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export class ApiRequestError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    if (code) this.code = code
  }
}

export async function request(method, path, body) {
  const token = getToken()
  const res = await fetch(`${API_BASE}/api/${path.replace(/^\//, '')}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`
    const error = new ApiRequestError(res.status, msg, data && data.code)
    if (data && data.banned) error.banned = true
    if (data && data.readOnly) error.readOnly = true
    if (res.status === 401 || error.banned) {
      clearSession()
    }
    log.error(method, path, res.status, msg)
    throw error
  }

  log.debug(method, path, res.status)
  return data
}
