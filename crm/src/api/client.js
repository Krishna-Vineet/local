// API client — talks to either the in-app mock backend or the real
// HappyPix backend (v2 contract). Controlled by env vars (see .env.example):
//
//   Mock (default):        VITE_MOCK=true  -> in-browser demo server, seeded data
//   Production:            VITE_MOCK=false -> real HTTP API
//                          VITE_API_URL=https://api.happypix.example
//                          (omit to call the same origin, e.g. /api behind nginx)
//
// When VITE_MOCK=false the mock server is never imported — production
// bundles contain no demo data, demo accounts or demo code paths at all.

import { ENV } from '../lib/env.js'

// Statically evaluable so the bundler can tree-shake the mock out of
// production builds: VITE_MOCK is replaced at build time by Vite.
export const USE_MOCK = import.meta.env.VITE_MOCK !== 'false'

// Demo data never ships to production.
const API_BASE = USE_MOCK ? '' : ENV.API_URL

const log = {
  debug: (...a) => { if (ENV.LOG_LEVEL === 'debug') console.debug('[api]', ...a) },
  error: (...a) => { if (ENV.LOG_LEVEL !== 'silent') console.error('[api]', ...a) },
}

let mockHandle = null
async function ensureMock() {
  if (!mockHandle) mockHandle = (await import('./mock/server.js')).handle
  return mockHandle
}
let mockReset = null
async function ensureMockReset() {
  if (!mockReset) mockReset = (await import('./mock/db.js')).resetDb
  return mockReset
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
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function realRequest(method, path, body) {
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
    if (res.status === 401) {
      clearSession()
    }
    log.error(method, path, res.status, msg)
    throw new ApiRequestError(res.status, msg)
  }
  log.debug(method, path, res.status)
  return data
}

async function mockRequest(method, path, body) {
  // small artificial latency so loading states are visible
  const token = getToken()
  const handle = await ensureMock()
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const out = handle(method, path, body, token)
        log.debug(method, path, out.status)
        resolve(out.data)
      } catch (e) {
        if (e && e.status === 401) clearSession()
        log.error(method, path, e.status || 500, e.message)
        reject(new ApiRequestError(e.status || 500, e.message))
      }
    }, 120 + Math.random() * 180)
  })
}

export async function request(method, path, body) {
  return USE_MOCK ? mockRequest(method, path, body) : realRequest(method, path, body)
}

export async function demoReset() {
  if (!USE_MOCK) return
  const resetDb = await ensureMockReset()
  resetDb() // clears in-memory copy + localStorage, reseeds
  location.reload()
}
