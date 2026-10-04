// ============================================================
// Mock database — seed data for the HappyPix CRM v2 demo.
// Persists to localStorage so edits survive reloads.
// "Today" in the seed world: 24 Sep 2026.
// ============================================================

import { suggestedPriceMap } from '../../lib/layouts.js'
import { DESIGNER_TEMPLATES, AI_SEED_TEMPLATES, PLAYGROUND_SEED_TEMPLATES } from '../../lib/templateMeta.js'

const DB_KEY = 'happypix_crm_v2_db'
const DB_VERSION = 10

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NOW = new Date('2026-09-24T11:30:00+05:30')
const D = (s) => new Date(s).toISOString()
const daysAgo = (n, h = 10, m = 0) => {
  const d = new Date(NOW)
  d.setDate(d.getDate() - n)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
const daysAhead = (n, h = 18, m = 0) => {
  const d = new Date(NOW)
  d.setDate(d.getDate() + n)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

// small SVG data-URI helpers for seed artwork
const bgSvg = (c1, c2 = null, label = '') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2 || c1}"/></linearGradient></defs><rect width="400" height="600" fill="url(#g)"/>${label ? `<text x="200" y="320" font-family="Georgia" font-style="italic" font-size="30" fill="rgba(255,255,255,0.85)" text-anchor="middle">${label}</text>` : ''}</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
const logoSvg = (initials, color) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><circle cx="60" cy="60" r="54" fill="${color}"/><text x="60" y="74" font-family="Georgia" font-size="44" font-style="italic" fill="#fff" text-anchor="middle">${initials}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

const finalPrintSvg = (title, c1, c2, n = 1) => {
  const panels = n % 2 ? '<rect x="54" y="70" width="372" height="430" rx="10" fill="#fff" opacity=".94"/>' : '<rect x="54" y="70" width="174" height="430" rx="10" fill="#fff" opacity=".94"/><rect x="252" y="70" width="174" height="430" rx="10" fill="#fff" opacity=".94"/>'
  const people = n % 2 ? '<circle cx="200" cy="230" r="58" fill="#f2b6a0"/><circle cx="292" cy="220" r="54" fill="#d9987f"/><path d="M110 450c14-112 75-150 111-150s97 38 111 150" fill="#5f4caa"/><path d="M205 450c12-108 66-146 104-146 36 0 78 40 92 146" fill="#ea097f"/>' : '<circle cx="141" cy="225" r="47" fill="#e7ab91"/><path d="M78 445c8-108 54-155 74-155 30 0 68 47 75 155" fill="#3871c1"/><circle cx="339" cy="225" r="47" fill="#efbca5"/><path d="M273 445c10-105 54-155 75-155 29 0 67 48 75 155" fill="#ea097f"/>'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="480" height="600" fill="url(#g)"/>${panels}${people}<rect y="515" width="480" height="85" fill="rgba(25,20,36,.88)"/><text x="240" y="552" fill="white" text-anchor="middle" font-family="Georgia" font-size="20">${title}</text><text x="240" y="577" fill="#f4b7d8" text-anchor="middle" font-family="Arial" font-size="11" letter-spacing="3">HAPPYPIX FINAL PRINT</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

const GALLERY_PHOTOS = [
  { id: 'gal-sun-1', organizationId: 'org-sunset', eventId: 'evt-sun-1', boothId: 'dev-sun-1', finalImageUrl: finalPrintSvg('Kapoor–Verma', '#6d204a', '#c18b45', 1), guestConsent: true, generatedAt: D('2026-09-24T20:12:00+05:30') },
  { id: 'gal-sun-2', organizationId: 'org-sunset', eventId: 'evt-sun-1', boothId: 'dev-sun-1', finalImageUrl: finalPrintSvg('Kapoor–Verma', '#271c59', '#8b4a78', 2), guestConsent: false, generatedAt: D('2026-09-24T20:18:00+05:30') },
  { id: 'gal-sun-3', organizationId: 'org-sunset', eventId: 'evt-sun-1', boothId: 'dev-sun-2', finalImageUrl: finalPrintSvg('Kapoor–Verma', '#8a3e29', '#e5ad5d', 3), guestConsent: true, generatedAt: D('2026-09-24T20:31:00+05:30') },
  { id: 'gal-sun-4', organizationId: 'org-sunset', eventId: 'evt-sun-3', boothId: 'dev-sun-2', finalImageUrl: finalPrintSvg('Mehendi Sangeet', '#386641', '#a7c957', 4), guestConsent: true, generatedAt: D('2026-08-21T19:44:00+05:30') },
  { id: 'gal-pika-1', organizationId: 'org-pika', eventId: 'evt-pika-1', boothId: 'dev-pika-1', finalImageUrl: finalPrintSvg('Pika Grand Launch', '#17375e', '#4da6a8', 1), guestConsent: true, generatedAt: D('2026-09-24T14:08:00+05:30') },
]

// ---------------- Templates (global, platform-owned — Template Library) ----------------
// Designer templates are hand-crafted React/SVG components registered in
// src/templates/ (meta here is data-only). Playground/AI templates carry a
// `design` config rendered by the Composable component. A template row pins
// ONE layout variant: {layoutId} = family + orientation + image slots.

const aiRoyalBg = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A3B8F"/><stop offset="1" stop-color="#2A2150"/></linearGradient><radialGradient id="r" cx="0.5" cy="0.25" r="0.9"><stop offset="0" stop-color="rgba(217,180,74,0.5)"/><stop offset="1" stop-color="rgba(217,180,74,0)"/></radialGradient></defs><rect width="1000" height="1500" fill="url(#g)"/><rect width="1000" height="1500" fill="url(#r)"/><circle cx="500" cy="380" r="300" fill="none" stroke="rgba(217,180,74,0.5)" stroke-width="3"/><circle cx="500" cy="380" r="360" fill="none" stroke="rgba(217,180,74,0.28)" stroke-width="1.6"/><circle cx="200" cy="1200" r="240" fill="rgba(255,255,255,0.05)"/><circle cx="840" cy="1050" r="180" fill="rgba(217,180,74,0.08)"/></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
const aiNeonBg = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1250" height="1750"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#160E2E"/><stop offset="1" stop-color="#31114E"/></linearGradient></defs><rect width="1250" height="1750" fill="url(#g)"/><circle cx="625" cy="560" r="260" fill="#FF3D9A" opacity="0.85"/><circle cx="625" cy="560" r="260" fill="none" stroke="#42F5C8" stroke-width="4" opacity="0.6"/><g stroke="#42F5C8" stroke-width="2" opacity="0.5">${[0,1,2,3,4,5,6,7].map(i=>`<line x1="${i*178}" y1="1750" x2="${625+(i*178-625)*0.32}" y2="980"/>`).join('')}<line x1="0" y1="980" x2="1250" y2="980" stroke-width="4"/></g><g stroke="#EA097F" stroke-width="2" opacity="0.45">${[1080,1220,1380,1560,1750].map(y=>`<line x1="0" y1="${y}" x2="1250" y2="${y}"/>`).join('')}</g></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

function buildTemplates() {
  const rows = DESIGNER_TEMPLATES.map((t, i) => ({
    id: t.id,
    componentId: t.componentId,
    design: null,
    name: t.name,
    description: t.description,
    category: t.category,
    layoutId: t.layoutId,
    source: 'designer',
    status: 'published',
    active: t.active !== false,
    usage: t.usage || 0,
    createdAt: daysAgo(300 - i * 9),
    updatedAt: daysAgo(30 + i),
  }))
  const ai = AI_SEED_TEMPLATES.map((t) => ({
    ...t,
    componentId: null,
    design: {
      ...t.design,
      bg: t.design.bg.type === 'image'
        ? { type: 'image', url: t.design.bg.url === '__BG_ROYAL__' ? aiRoyalBg() : aiNeonBg() }
        : t.design.bg,
    },
    createdAt: daysAgo(90),
    updatedAt: daysAgo(12),
  }))
  const pg = PLAYGROUND_SEED_TEMPLATES.map((t) => ({ ...t, componentId: null, createdAt: daysAgo(6), updatedAt: daysAgo(2) }))
  return [...rows, ...ai, ...pg]
}

// ---------------- Users ----------------
const USERS = [
  { id: 'usr-owner', name: 'Harshit Mehta', email: 'owner@happypix.com', password: 'demo123', role: 'OWNER', organizationId: null, status: 'active', photoUrl: null, createdAt: daysAgo(420), lastLoginAt: daysAgo(0, 8, 12) },
  { id: 'usr-pa', name: 'Priya Nair', email: 'priya@happypix.com', password: 'demo123', role: 'PLATFORM_ADMIN', organizationId: null, status: 'active', photoUrl: null, createdAt: daysAgo(310), lastLoginAt: daysAgo(0, 9, 4) },
  { id: 'usr-sm', name: 'Arjun Rao', email: 'support@happypix.com', password: 'demo123', role: 'SUPPORT_MANAGER', organizationId: null, status: 'active', photoUrl: null, createdAt: daysAgo(280), lastLoginAt: daysAgo(1, 18, 30) },

  { id: 'usr-sana', name: 'Sana Kapoor', email: 'sana@sunsetweddings.com', password: 'demo123', role: 'ORG_ADMIN', organizationId: 'org-sunset', status: 'active', createdAt: daysAgo(160), lastLoginAt: daysAgo(0, 10, 2) },
  { id: 'usr-rohit', name: 'Rohit Das', email: 'rohit@sunsetweddings.com', password: 'demo123', role: 'ORG_MANAGER', organizationId: 'org-sunset', status: 'active', createdAt: daysAgo(120), lastLoginAt: daysAgo(2, 16, 0) },
  { id: 'usr-kunal', name: 'Kunal Aneja', email: 'kunal@kade.in', password: 'demo123', role: 'ORG_ADMIN', organizationId: 'org-kade', status: 'active', createdAt: daysAgo(52), lastLoginAt: daysAgo(1, 12, 40) },
  { id: 'usr-arpita', name: 'Arpita Shah', email: 'arpita@pika.in', password: 'demo123', role: 'ORG_ADMIN', organizationId: 'org-pika', status: 'active', createdAt: daysAgo(172), lastLoginAt: daysAgo(3, 11, 15) },
  { id: 'usr-vikram', name: 'Vikram Sethi', email: 'vikram@techcloset.in', password: 'demo123', role: 'ORG_ADMIN', organizationId: 'org-tech', status: 'active', createdAt: daysAgo(37), lastLoginAt: daysAgo(0, 9, 48) },
  { id: 'usr-meera', name: 'Meera Iyer', email: 'meera@techcloset.in', password: 'demo123', role: 'ORG_MANAGER', organizationId: 'org-tech', status: 'active', createdAt: daysAgo(30), lastLoginAt: daysAgo(4, 15, 20) },
  { id: 'usr-vishal', name: 'Vishal Gupta', email: 'vishal@vishalstudio.in', password: 'demo123', role: 'ORG_ADMIN', organizationId: 'org-vishal', status: 'active', createdAt: daysAgo(5), lastLoginAt: daysAgo(0, 10, 30) },
  { id: 'usr-aakash', name: 'Aakash Verma', email: 'aakash@alphabooths.in', password: 'demo123', role: 'ORG_ADMIN', organizationId: 'org-alpha', status: 'active', createdAt: daysAgo(135), lastLoginAt: daysAgo(42, 12, 0) },
  { id: 'usr-riya', name: 'Riya Malhotra', email: 'riya@riyacelebrations.in', password: 'demo123', role: 'ORG_ADMIN', organizationId: 'org-riya', status: 'active', createdAt: daysAgo(106), lastLoginAt: daysAgo(13, 17, 45) },
  { id: 'usr-gaurav', name: 'Gaurav Khan', email: 'gaurav@glowparty.in', password: 'demo123', role: 'ORG_ADMIN', organizationId: 'org-glow', status: 'active', createdAt: daysAgo(145), lastLoginAt: daysAgo(50, 12, 0) },
  { id: 'usr-nandini', name: 'Nandini Bose', email: 'nandini@novaoccasions.in', password: 'demo123', role: 'ORG_ADMIN', organizationId: 'org-nova', status: 'active', createdAt: daysAgo(8), lastLoginAt: daysAgo(0, 8, 55) },
]

// ---------------- Organizations ----------------
const ORGS = [
  { id: 'org-sunset', name: 'Sunset Weddings', ownerName: 'Sana Kapoor', email: 'sana@sunsetweddings.com', phone: '+91 98100 22331', country: 'IN', plan: 'business', status: 'active', logoUrl: null, createdAt: daysAgo(160), lastActiveAt: daysAgo(0, 9, 58), suspendReason: null },
  { id: 'org-kade', name: 'Kade Events', ownerName: 'Kunal Aneja', email: 'kunal@kade.in', phone: '+91 99530 44112', country: 'IN', plan: 'starter', status: 'active', logoUrl: null, createdAt: daysAgo(52), lastActiveAt: daysAgo(1, 20, 14), suspendReason: null },
  { id: 'org-pika', name: 'Pika Photography', ownerName: 'Arpita Shah', email: 'arpita@pika.in', phone: '+91 98211 77020', country: 'IN', plan: 'professional', status: 'active', logoUrl: null, createdAt: daysAgo(172), lastActiveAt: daysAgo(0, 8, 30), suspendReason: null },
  { id: 'org-tech', name: 'Tech Closet', ownerName: 'Vikram Sethi', email: 'vikram@techcloset.in', phone: '+91 97170 88990', country: 'IN', plan: 'business', status: 'trial', logoUrl: null, createdAt: daysAgo(37), lastActiveAt: daysAgo(0, 10, 41), suspendReason: null },
  { id: 'org-vishal', name: 'Vishal Studio', ownerName: 'Vishal Gupta', email: 'vishal@vishalstudio.in', phone: '+91 98111 33445', country: 'IN', plan: 'starter', status: 'active', logoUrl: null, createdAt: daysAgo(5), lastActiveAt: daysAgo(0, 7, 12), suspendReason: null },
  { id: 'org-alpha', name: 'Alpha Booths', ownerName: 'Aakash Verma', email: 'aakash@alphabooths.in', phone: '+91 98990 11223', country: 'IN', plan: 'basic', status: 'expired', logoUrl: null, createdAt: daysAgo(135), lastActiveAt: daysAgo(42, 19, 0), suspendReason: null },
  { id: 'org-riya', name: 'Riya Celebrations', ownerName: 'Riya Malhotra', email: 'riya@riyacelebrations.in', phone: '+91 99100 55667', country: 'IN', plan: 'starter', status: 'suspended', logoUrl: null, createdAt: daysAgo(106), lastActiveAt: daysAgo(14, 11, 0), suspendReason: 'Repeated billing disputes and failed renewals. Reviewed on 10 Sep 2026.' },
  { id: 'org-glow', name: 'Glow Party Co', ownerName: 'Gaurav Khan', email: 'gaurav@glowparty.in', phone: '+91 98760 99887', country: 'IN', plan: 'basic', status: 'banned', logoUrl: null, createdAt: daysAgo(145), lastActiveAt: daysAgo(51, 12, 0), suspendReason: 'Fraudulent coupon abuse and payment chargeback. Banned 04 Aug 2026.' },
  { id: 'org-nova', name: 'Nova Occasions', ownerName: 'Nandini Bose', email: 'nandini@novaoccasions.in', phone: '+91 98330 66778', country: 'IN', plan: 'trial', status: 'trial', logoUrl: null, createdAt: daysAgo(8), lastActiveAt: daysAgo(0, 9, 5), suspendReason: null },
]

// ---------------- Subscriptions (server-owned billing records) ----------------
const SUBSCRIPTIONS = [
  { id: 'sub-sunset', organizationId: 'org-sunset', plan: 'business', amount: 9999, currency: 'INR', gateway: 'razorpay', paidAt: D('2026-04-15T10:00:00+05:30'), startDate: D('2026-04-15T10:00:00+05:30'), endDate: D('2026-10-15T10:00:00+05:30'), invoice: 'HAP-INV-2604-118' },
  { id: 'sub-kade', organizationId: 'org-kade', plan: 'starter', amount: 1999, currency: 'INR', gateway: 'razorpay', paidAt: D('2026-08-03T12:00:00+05:30'), startDate: D('2026-08-03T12:00:00+05:30'), endDate: D('2026-11-03T12:00:00+05:30'), invoice: 'HAP-INV-2608-342' },
  { id: 'sub-pika', organizationId: 'org-pika', plan: 'professional', amount: 5999, currency: 'INR', gateway: 'razorpay', paidAt: D('2026-04-05T11:00:00+05:30'), startDate: D('2026-04-05T11:00:00+05:30'), endDate: D('2026-10-05T11:00:00+05:30'), invoice: 'HAP-INV-2604-091' },
  { id: 'sub-tech', organizationId: 'org-tech', plan: 'business', amount: 0, currency: 'INR', gateway: 'trial', paidAt: null, startDate: D('2026-08-18T12:00:00+05:30'), endDate: D('2026-09-01T12:00:00+05:30'), invoice: null, extended: D('2026-09-02T12:00:00+05:30'), extendedTo: D('2026-10-02T12:00:00+05:30'), extendedNote: 'Trial extended once (platform goodwill)' },
  { id: 'sub-vishal', organizationId: 'org-vishal', plan: 'starter', amount: 1999, currency: 'INR', gateway: 'razorpay', paidAt: D('2026-09-19T15:00:00+05:30'), startDate: D('2026-09-19T15:00:00+05:30'), endDate: D('2026-12-19T15:00:00+05:30'), invoice: 'HAP-INV-2609-401' },
  { id: 'sub-alpha', organizationId: 'org-alpha', plan: 'basic', amount: 2999, currency: 'INR', gateway: 'razorpay', paidAt: D('2026-05-12T10:00:00+05:30'), startDate: D('2026-05-12T10:00:00+05:30'), endDate: D('2026-08-12T10:00:00+05:30'), invoice: 'HAP-INV-2605-214' },
  { id: 'sub-riya', organizationId: 'org-riya', plan: 'starter', amount: 1999, currency: 'INR', gateway: 'razorpay', paidAt: D('2026-06-10T13:00:00+05:30'), startDate: D('2026-06-10T13:00:00+05:30'), endDate: D('2026-09-10T13:00:00+05:30'), invoice: 'HAP-INV-2606-275' },
  { id: 'sub-glow', organizationId: 'org-glow', plan: 'basic', amount: 2999, currency: 'INR', gateway: 'razorpay', paidAt: D('2026-05-02T12:00:00+05:30'), startDate: D('2026-05-02T12:00:00+05:30'), endDate: D('2026-08-02T12:00:00+05:30'), invoice: 'HAP-INV-2605-166' },
  { id: 'sub-nova', organizationId: 'org-nova', plan: 'trial', amount: 0, currency: 'INR', gateway: 'trial', paidAt: null, startDate: D('2026-09-16T10:00:00+05:30'), endDate: D('2026-09-30T10:00:00+05:30'), invoice: null },
]

// ---------------- Subscription plan catalogue (Owner-managed) ----------------
// `key` is stable because subscriptions and organizations reference it.
const PLAN_CATALOG = [
  { id: 'plan-trial', key: 'trial', name: 'Trial', description: 'A short evaluation plan for a new organization.', price: 0, durationMonths: 0, durationLabel: '14 days', devices: 1, events: 1, active: true, createdAt: daysAgo(500), updatedAt: daysAgo(20) },
  { id: 'plan-starter', key: 'starter', name: 'Starter', description: 'For a single booth running one event at a time.', price: 1999, durationMonths: 3, durationLabel: '3 months', devices: 1, events: 1, active: true, createdAt: daysAgo(500), updatedAt: daysAgo(20) },
  { id: 'plan-basic', key: 'basic', name: 'Basic', description: 'For growing teams with a few booths.', price: 2999, durationMonths: 3, durationLabel: '3 months', devices: 3, events: 2, active: true, createdAt: daysAgo(500), updatedAt: daysAgo(20) },
  { id: 'plan-professional', key: 'professional', name: 'Professional', description: 'For established photobooth operators.', price: 5999, durationMonths: 6, durationLabel: '6 months', devices: 5, events: 5, active: true, createdAt: daysAgo(500), updatedAt: daysAgo(8) },
  { id: 'plan-business', key: 'business', name: 'Business', description: 'Higher limits for multi-city operators.', price: 9999, durationMonths: 6, durationLabel: '6 months', devices: 10, events: 10, active: true, createdAt: daysAgo(500), updatedAt: daysAgo(8) },
  { id: 'plan-custom', key: 'custom', name: 'Custom', description: 'A negotiated plan for enterprise requirements.', price: null, durationMonths: 12, durationLabel: 'Custom term', devices: 25, events: 20, active: true, createdAt: daysAgo(500), updatedAt: daysAgo(8) },
]

// ---------------- Devices (UUID pairing model) ----------------
// operatorName/operatorPhone — the on-ground booth operator assigned by an
// org admin/manager so the rest of the team knows who to contact.
// telemetry + connections — hardware stats and camera/printer/external-screen
// connection health pushed via POST /api/booth/devices/:uuid/telemetry; the
// CRM only reads and displays the latest report.
const uuid = (s) => s
const tel = (prints, shutters, batteryPct, at) => ({ prints, shutters, batteryPct, updatedAt: at })
const DEVICES = [
  { id: 'dev-sun-1', organizationId: 'org-sunset', deviceUuid: uuid('f47ac10b-58cc-4372-a567-0e02b2c3d471'), deviceName: 'Booth 01 — Main Hall', location: 'New Delhi', hardware: ['camera', 'printer', 'wifi'], lastSeenAt: daysAgo(0, 11, 26), registeredAt: daysAgo(158), status: 'active', assignedEventId: 'evt-sun-1', operatorName: 'Sunil Yadav', operatorPhone: '+91 98110 55220', telemetry: tel(1284, 3421, 96, daysAgo(0, 11, 20)) },
  { id: 'dev-sun-2', organizationId: 'org-sunset', deviceUuid: uuid('1b671a64-40d5-471d-9ca0-4d1c3b2a9f02'), deviceName: 'Booth 02 — Lawn', location: 'New Delhi', hardware: ['camera', 'printer', 'wifi'], lastSeenAt: daysAgo(0, 10, 58), registeredAt: daysAgo(120), status: 'active', assignedEventId: 'evt-sun-1', operatorName: 'Manoj Kumar', operatorPhone: '+91 99580 71342', telemetry: tel(967, 2870, 64, daysAgo(0, 10, 50)) },
  { id: 'dev-sun-3', organizationId: 'org-sunset', deviceUuid: uuid('9c1b2d3e-4f5a-6b7c-8d9e-0f1a2b3c4d5e'), deviceName: 'Booth 03 — Rooftop', location: 'Gurugram', hardware: ['camera', 'printer'], lastSeenAt: daysAgo(0, 9, 12), registeredAt: daysAgo(90), status: 'active', assignedEventId: null, operatorName: null, operatorPhone: null, telemetry: tel(512, 1495, 100, daysAgo(0, 9, 0)) },
  { id: 'dev-sun-4', organizationId: 'org-sunset', deviceUuid: uuid('0a9b8c7d-6e5f-4a3b-2c1d-0e9f8a7b6c5d'), deviceName: 'Booth 04 — Travel Unit', location: 'Faridabad', hardware: ['camera', 'printer', 'wifi'], lastSeenAt: daysAgo(6, 21, 30), registeredAt: daysAgo(75), status: 'active', assignedEventId: null, operatorName: null, operatorPhone: null, telemetry: tel(203, 704, 23, daysAgo(6, 21, 0)) },
  { id: 'dev-kade-1', organizationId: 'org-kade', deviceUuid: uuid('c3d4e5f6-a7b8-49c0-d1e2-f3a4b5c6d7e8'), deviceName: 'KADE Main Booth', location: 'Rohini, Delhi', hardware: ['camera', 'printer'], lastSeenAt: daysAgo(1, 19, 42), registeredAt: daysAgo(50), status: 'active', assignedEventId: 'evt-kade-1', operatorName: 'Pawan Singh', operatorPhone: '+91 92120 44881', telemetry: tel(341, 1189, 71, daysAgo(1, 19, 30)) },
  { id: 'dev-pika-1', organizationId: 'org-pika', deviceUuid: uuid('e5f6a7b8-c9d0-4e1f-a2b3-c4d5e6f7a8b9'), deviceName: 'Pika Studio Booth', location: 'Andheri, Mumbai', hardware: ['camera', 'printer', 'wifi'], lastSeenAt: daysAgo(0, 11, 5), registeredAt: daysAgo(170), status: 'active', assignedEventId: 'evt-pika-1', operatorName: null, operatorPhone: null, telemetry: tel(2210, 5233, 100, daysAgo(0, 11, 0)) },
  { id: 'dev-pika-2', organizationId: 'org-pika', deviceUuid: uuid('a2b3c4d5-e6f7-4a8b-b9c0-d1e2f3a4b5c6'), deviceName: 'Pika Outfield', location: 'Thane', hardware: ['camera', 'printer'], lastSeenAt: daysAgo(2, 17, 20), registeredAt: daysAgo(140), status: 'active', assignedEventId: null, operatorName: null, operatorPhone: null, telemetry: tel(734, 1902, 88, daysAgo(2, 17, 0)) },
  { id: 'dev-pika-3', organizationId: 'org-pika', deviceUuid: uuid('b7c8d9e0-f1a2-4b3c-c4d5-e6f7a8b9c0d1'), deviceName: 'Pika Corporate', location: 'Bandra, Mumbai', hardware: ['camera', 'printer', 'wifi'], lastSeenAt: daysAgo(1, 14, 8), registeredAt: daysAgo(60), status: 'active', assignedEventId: null, operatorName: null, operatorPhone: null, telemetry: tel(456, 1310, 57, daysAgo(1, 14, 0)) },
  { id: 'dev-tech-1', organizationId: 'org-tech', deviceUuid: uuid('d9e0f1a2-b3c4-4d5e-e6f7-a8b9c0d1e2f3'), deviceName: 'TechCloset S24', location: 'Pitampura, Delhi', hardware: ['camera', 'printer'], lastSeenAt: daysAgo(0, 10, 44), registeredAt: daysAgo(35), status: 'active', assignedEventId: 'evt-tech-1', operatorName: 'Dev Rathi', operatorPhone: '+91 98730 12908', telemetry: tel(890, 2408, 42, daysAgo(0, 10, 40)) },
  { id: 'dev-tech-2', organizationId: 'org-tech', deviceUuid: uuid('f1a2b3c4-d5e6-4f7a-a8b9-c0d1e2f3a4b5'), deviceName: 'TechCloset iPad', location: 'Pitampura, Delhi', hardware: ['camera', 'wifi'], lastSeenAt: daysAgo(3, 12, 0), registeredAt: daysAgo(28), status: 'active', assignedEventId: null, operatorName: null, operatorPhone: null, telemetry: tel(0, 312, 66, daysAgo(3, 11, 45)) },
  { id: 'dev-vish-1', organizationId: 'org-vishal', deviceUuid: uuid('a4b5c6d7-e8f9-4a0b-b1c2-d3e4f5a6b7c8'), deviceName: 'Vishal Booth A', location: 'Ludhiana', hardware: ['camera', 'printer'], lastSeenAt: daysAgo(0, 7, 5), registeredAt: daysAgo(4), status: 'active', assignedEventId: 'evt-vish-1', operatorName: null, operatorPhone: null, telemetry: tel(118, 402, 91, daysAgo(0, 7, 0)) },
  { id: 'dev-alpha-1', organizationId: 'org-alpha', deviceUuid: uuid('c6d7e8f9-a0b1-4c2d-c3d4-e5f6a7b8c9d0'), deviceName: 'Alpha One', location: 'Jaipur', hardware: ['camera', 'printer'], lastSeenAt: daysAgo(42, 18, 40), registeredAt: daysAgo(130), status: 'active', assignedEventId: null, operatorName: null, operatorPhone: null, telemetry: tel(1560, 4120, 12, daysAgo(42, 18, 0)) },
  { id: 'dev-riya-1', organizationId: 'org-riya', deviceUuid: uuid('d8e9f0a1-b2c3-4d4e-d5e6-f7a8b9c0d1e2'), deviceName: 'Riya Booth', location: 'Dehradun', hardware: ['camera', 'printer'], lastSeenAt: daysAgo(14, 10, 30), registeredAt: daysAgo(100), status: 'active', assignedEventId: null, operatorName: null, operatorPhone: null, telemetry: tel(921, 2540, 74, daysAgo(14, 10, 0)) },
  { id: 'dev-nova-1', organizationId: 'org-nova', deviceUuid: uuid('e0f1a2b3-c4d5-4e6e-e7f8-a9b0c1d2e3f4'), deviceName: 'Nova Test Booth', location: 'Kolkata', hardware: ['camera', 'printer', 'wifi'], lastSeenAt: daysAgo(0, 9, 58), registeredAt: daysAgo(7), status: 'active', assignedEventId: 'evt-nova-1', operatorName: null, operatorPhone: null, telemetry: tel(64, 205, 83, daysAgo(0, 9, 50)) },
]

// Last peripheral connection report from the booth heartbeat. All three are
// shown in the CRM even when a peripheral is disconnected.
const DEVICE_CONNECTIONS = {
  'dev-sun-1': { camera: true, printer: true, kioskScreen: true, updatedAt: daysAgo(0, 11, 20) },
  'dev-sun-2': { camera: true, printer: false, kioskScreen: true, updatedAt: daysAgo(0, 10, 50) },
  'dev-sun-3': { camera: true, printer: true, kioskScreen: false, updatedAt: daysAgo(0, 9, 0) },
  'dev-sun-4': { camera: false, printer: false, kioskScreen: false, updatedAt: daysAgo(6, 21, 0) },
  'dev-kade-1': { camera: true, printer: true, kioskScreen: true, updatedAt: daysAgo(1, 19, 30) },
  'dev-pika-1': { camera: true, printer: true, kioskScreen: true, updatedAt: daysAgo(0, 11, 0) },
  'dev-pika-2': { camera: true, printer: false, kioskScreen: true, updatedAt: daysAgo(2, 17, 0) },
  'dev-pika-3': { camera: true, printer: true, kioskScreen: false, updatedAt: daysAgo(1, 14, 0) },
  'dev-tech-1': { camera: true, printer: true, kioskScreen: true, updatedAt: daysAgo(0, 10, 40) },
  'dev-tech-2': { camera: true, printer: false, kioskScreen: true, updatedAt: daysAgo(3, 11, 45) },
  'dev-vish-1': { camera: true, printer: true, kioskScreen: true, updatedAt: daysAgo(0, 7, 0) },
  'dev-alpha-1': { camera: false, printer: false, kioskScreen: false, updatedAt: daysAgo(42, 18, 0) },
  'dev-riya-1': { camera: false, printer: false, kioskScreen: false, updatedAt: daysAgo(14, 10, 0) },
  'dev-nova-1': { camera: true, printer: true, kioskScreen: false, updatedAt: daysAgo(0, 9, 50) },
}

// ---------------- Events (v2 shape: no passkey, no print price) ----------------
// fields: digitalCopy (guests can order a digital copy), filters (allowed
// photo filters), templateIds (global templates shown at the booth),
// branding (footer logo — default none — + tagline, editable later).
const EVENTS = [
  { id: 'evt-sun-1', organizationId: 'org-sunset', name: 'Kapoor–Verma Wedding', clientName: 'Rohan Kapoor', location: 'ITC Maurya, New Delhi', startDate: D('2026-09-23T18:00:00+05:30'), endDate: D('2026-09-25T01:00:00+05:30'), paused: false, templateIds: ['hp-royal-57v3', 'hp-filmstrip-4626v4', 'hp-gala-68v1', 'hp-classic-46v1', 'hp-legacy-810v9'], filters: ['warm', 'bw', 'vintage'], digitalCopy: true, branding: { logos: [logoSvg('SK', '#5F4CAA'), logoSvg('ITC', '#3871C1'), logoSvg('RD', '#B45309')], tagline: 'Kapoor–Verma • ITC Maurya' }, shortCode: 'KAPWED', createdAt: daysAgo(20) },
  { id: 'evt-sun-2', organizationId: 'org-sunset', name: 'Sharma Anniversary Gala', clientName: 'Suresh Sharma', location: 'The Leela, Gurugram', startDate: daysAhead(12, 19), endDate: daysAhead(12, 23, 30), paused: false, templateIds: ['hp-corporate-46h4', 'hp-collector-810210v5', 'hp-classic-46v1'], filters: ['warm', 'party'], digitalCopy: true, branding: { logos: [logoSvg('40Y', '#B45309')], tagline: '40 years of Sharma' }, shortCode: 'SHAGAL', createdAt: daysAgo(6) },
  { id: 'evt-sun-3', organizationId: 'org-sunset', name: 'Mehendi Sangeet — Oberoi Estate', clientName: 'Priyanka Menon', location: 'Oberoi Estate, Faridabad', startDate: daysAgo(34, 17), endDate: daysAgo(34, 23), paused: false, templateIds: ['hp-vintage-6838v3', 'hp-classic-46v1'], filters: ['warm', 'soft'], digitalCopy: true, branding: { logos: [], tagline: '' }, shortCode: 'MENGEN', createdAt: daysAgo(40) },
  { id: 'evt-kade-1', organizationId: 'org-kade', name: 'Birthday Bash — Ananya 5', clientName: 'The Malhotra Family', location: 'Green Park, Delhi', startDate: daysAgo(0, 16), endDate: daysAgo(0, 22), paused: false, templateIds: ['hp-kids-46h3', 'hp-neon-46v4', 'hp-classic-46v1'], filters: ['party', 'soft'], digitalCopy: true, branding: { logos: [], tagline: 'Ananya turns 5!' }, shortCode: 'ANABAS', createdAt: daysAgo(9) },
  { id: 'evt-pika-1', organizationId: 'org-pika', name: 'Pika Studio Grand Launch', clientName: 'Pika Photography', location: 'Andheri West, Mumbai', startDate: D('2026-09-22T11:00:00+05:30'), endDate: D('2026-09-26T21:00:00+05:30'), paused: false, templateIds: ['hp-classic-46v1', 'hp-sunset-4626v3', 'hp-mono-57v1', 'hp-ai-neon-57v3'], filters: ['original', 'cool'], digitalCopy: true, branding: { logos: [logoSvg('P', '#3871C1')], tagline: 'Pika Photography' }, shortCode: 'PIKALN', createdAt: daysAgo(11) },
  { id: 'evt-pika-2', organizationId: 'org-pika', name: 'Corporate Offsite — Nexus Ltd', clientName: 'Nexus Ltd', location: 'Bandra Kurla, Mumbai', startDate: daysAhead(25, 10), endDate: daysAhead(25, 19), paused: false, templateIds: ['hp-corporate-46h4', 'hp-mono-57v1'], filters: ['original', 'cool', 'bw'], digitalCopy: false, branding: { logos: [logoSvg('NX', '#3871C1'), logoSvg('D11', '#191424')], tagline: 'Nexus Ltd' }, shortCode: 'NEXCOR', createdAt: daysAgo(3) },
  { id: 'evt-tech-1', organizationId: 'org-tech', name: 'Gaming Zone Pop-up', clientName: 'Nexplay Arena', location: 'Select Citywalk, Gurugram', startDate: daysAgo(0, 15), endDate: daysAgo(0, 23), paused: false, templateIds: ['hp-neon-46v4', 'hp-collector-810210v5', 'hp-ai-neon-57v3'], filters: ['neon', 'cool'], digitalCopy: true, branding: { logos: [], tagline: 'GZ × Nexplay' }, shortCode: 'GZPOP', createdAt: daysAgo(14) },
  { id: 'evt-vish-1', organizationId: 'org-vishal', name: 'Rooftop Housewarming', clientName: 'Gupta Residence', location: 'Model Town, Ludhiana', startDate: daysAgo(0, 19), endDate: daysAgo(0, 23), paused: false, templateIds: ['hp-classic-46v1', 'hp-festive-812v6'], filters: ['warm'], digitalCopy: true, branding: { logos: [], tagline: '' }, shortCode: 'ROOFHW', createdAt: daysAgo(2) },
  { id: 'evt-nova-1', organizationId: 'org-nova', name: 'Diwali Pre-Preview', clientName: 'Nova Occasions', location: 'Park Street, Kolkata', startDate: daysAgo(0, 17), endDate: daysAgo(0, 22), paused: false, templateIds: ['hp-festive-812v6', 'hp-sunset-4626v3'], filters: ['warm', 'party'], digitalCopy: true, branding: { logos: [], tagline: 'Diwali 2026' }, shortCode: 'NOVAPV', createdAt: daysAgo(4) },
  { id: 'evt-alpha-1', organizationId: 'org-alpha', name: 'Jaipur Food Fest', clientName: 'Raj Food Fest', location: 'C-Scheme, Jaipur', startDate: daysAgo(20, 10), endDate: daysAgo(17, 22), paused: false, templateIds: ['hp-neon-46v4'], filters: ['original', 'warm'], digitalCopy: true, branding: { logos: [], tagline: '' }, shortCode: 'JFFST', createdAt: daysAgo(26) },
  { id: 'evt-tech-2', organizationId: 'org-tech', name: 'Startup Meetup Booth', clientName: 'D11 Labs', location: 'Pitampura, Delhi', startDate: daysAgo(12, 18), endDate: daysAgo(12, 23), paused: false, templateIds: ['hp-corporate-46h4'], filters: ['cool'], digitalCopy: false, branding: { logos: [], tagline: 'D11' }, shortCode: 'SMBTH', createdAt: daysAgo(16) },
  { id: 'evt-riya-1', organizationId: 'org-riya', name: "Kajri's 30th", clientName: 'Kajri Ahuja', location: 'Rajpur Road, Dehradun', startDate: daysAgo(16, 19), endDate: daysAgo(16, 23, 30), paused: false, templateIds: ['hp-classic-46v1'], filters: ['party', 'soft'], digitalCopy: true, branding: { logos: [], tagline: 'Kajri @ 30' }, shortCode: 'K30TH', createdAt: daysAgo(21) },
]

// ---------------- Organization defaults (the single org config doc) ----------------
// Layouts & print pricing: the org admin sets the guest-facing price for
// every layout iteration (family + image slots). A price here is what the
// booth shows when guests pick a page size; a cleared price removes the
// layout from the booth. Orientation does not change the print price.
function defaultLayoutPrices(tweak = {}) {
  const m = suggestedPriceMap()
  for (const [k, v] of Object.entries(tweak)) m[k] = v
  return m
}
const ORG_DEFAULTS = {
  'org-sunset': { name: 'Sunset Weddings', logoUrl: null, upiId: 'sunsetweddings@okaxis', payoutMode: 'wallet', boothTimeoutSec: 600, layoutPrices: defaultLayoutPrices({ '57:1': 70, '57:3': 90, '68:1': 85, '68:3': 95, '812:1': 120, '812:6': 160, '810:9': 150, '46-26:4': 45 }) },
  'org-kade': { name: 'Kade Events', logoUrl: null, upiId: 'kadeevents@ybl', payoutMode: 'upi', boothTimeoutSec: 600, layoutPrices: defaultLayoutPrices({ '46:4': 40, '46-23:1': 25 }) },
  'org-pika': { name: 'Pika Photography', logoUrl: null, upiId: 'pika.photo@oksbi', payoutMode: 'wallet', boothTimeoutSec: 480, layoutPrices: defaultLayoutPrices({ '46:1': 40, '57:1': 65, '810:1': 95, '812:8': 170 }) },
  'org-tech': { name: 'Tech Closet', logoUrl: null, upiId: 'techcloset@paytm', payoutMode: 'upi', boothTimeoutSec: 300, layoutPrices: defaultLayoutPrices({ '46-26:4': 35, '810-210:5': 55 }) },
  'org-vishal': { name: 'Vishal Studio', logoUrl: null, upiId: 'vishalstudio@okicici', payoutMode: 'upi', boothTimeoutSec: 600, layoutPrices: defaultLayoutPrices() },
  'org-alpha': { name: 'Alpha Booths', logoUrl: null, upiId: 'alphabooths@ybl', payoutMode: 'wallet', boothTimeoutSec: 600, layoutPrices: defaultLayoutPrices({ '46:1': 20, '46:3': 25, '46:4': 25, '57:1': 35, '57:3': 40 }) },
  'org-riya': { name: 'Riya Celebrations', logoUrl: null, upiId: 'riya.celebrations@okhdfcbank', payoutMode: 'wallet', boothTimeoutSec: 600, layoutPrices: defaultLayoutPrices() },
  'org-glow': { name: 'Glow Party Co', logoUrl: null, upiId: null, payoutMode: 'wallet', boothTimeoutSec: 600, layoutPrices: defaultLayoutPrices() },
  'org-nova': { name: 'Nova Occasions', logoUrl: null, upiId: 'novaoccasions@okaxis', payoutMode: 'upi', boothTimeoutSec: 480, layoutPrices: defaultLayoutPrices({ '46-26:3': 35, '46-26:4': 35 }) },
}

// ---------------- Wallet withdrawals (wallet balance → org UPI) ----------------
const WITHDRAWALS = [
  { id: 'wd-1', organizationId: 'org-sunset', amount: 5000, upiId: 'sunsetweddings@okaxis', status: 'paid', reference: 'HPX-PO-2607-0141', requestedAt: daysAgo(80), paidAt: daysAgo(79), requestedBy: 'usr-sana' },
  { id: 'wd-2', organizationId: 'org-sunset', amount: 3500, upiId: 'sunsetweddings@okaxis', status: 'paid', reference: 'HPX-PO-2608-0212', requestedAt: daysAgo(38), paidAt: daysAgo(37), requestedBy: 'usr-sana' },
  { id: 'wd-3', organizationId: 'org-sunset', amount: 1500, upiId: 'sunsetweddings@okaxis', status: 'processing', reference: 'HPX-PO-2609-0377', requestedAt: daysAgo(0, 3), paidAt: null, requestedBy: 'usr-sana' },
  { id: 'wd-4', organizationId: 'org-pika', amount: 1000, upiId: 'pika.photo@oksbi', status: 'paid', reference: 'HPX-PO-2609-0301', requestedAt: daysAgo(12), paidAt: daysAgo(11), requestedBy: 'usr-arpita' },
  { id: 'wd-5', organizationId: 'org-alpha', amount: 500, upiId: 'alphabooths@ybl', status: 'paid', reference: 'HPX-PO-2605-0099', requestedAt: daysAgo(120), paidAt: daysAgo(119), requestedBy: null },
]

// ---------------- Coupons (organization-owned) ----------------
const COUPONS = [
  { id: 'cup-sun-1', organizationId: 'org-sunset', code: 'WEDDING20', type: 'percentage', value: 20, quantity: 200, usedCount: 164, expiryDate: D('2026-12-31T23:59:00+05:30'), eventIds: ['evt-sun-1'], status: 'active', createdAt: daysAgo(18), updatedAt: daysAgo(18) },
  { id: 'cup-sun-2', organizationId: 'org-sunset', code: 'VIP50', type: 'percentage', value: 50, quantity: 10, usedCount: 10, expiryDate: D('2026-09-30T23:59:00+05:30'), eventIds: ['evt-sun-1'], status: 'active', createdAt: daysAgo(20), updatedAt: daysAgo(2) },
  { id: 'cup-kade-1', organizationId: 'org-kade', code: 'BIRTHDAY50', type: 'fixed', value: 50, quantity: 25, usedCount: 7, expiryDate: D('2026-10-15T23:59:00+05:30'), eventIds: ['evt-kade-1'], status: 'active', createdAt: daysAgo(8), updatedAt: daysAgo(8) },
  { id: 'cup-pika-1', organizationId: 'org-pika', code: 'LAUNCH30', type: 'percentage', value: 30, quantity: 500, usedCount: 231, expiryDate: D('2026-09-26T23:59:00+05:30'), eventIds: ['evt-pika-1'], status: 'active', createdAt: daysAgo(11), updatedAt: daysAgo(11) },
  { id: 'cup-pika-2', organizationId: 'org-pika', code: 'CORPOFF100', type: 'fixed', value: 100, quantity: 40, usedCount: 0, expiryDate: D('2026-10-31T23:59:00+05:30'), eventIds: ['evt-pika-2'], status: 'paused', createdAt: daysAgo(3), updatedAt: daysAgo(1) },
  { id: 'cup-tech-1', organizationId: 'org-tech', code: 'GZFLASH15', type: 'percentage', value: 15, quantity: 300, usedCount: 300, expiryDate: D('2026-09-30T23:59:00+05:30'), eventIds: ['evt-tech-1'], status: 'active', createdAt: daysAgo(13), updatedAt: daysAgo(0, 20) },
  { id: 'cup-nova-1', organizationId: 'org-nova', code: 'NOVA10', type: 'percentage', value: 10, quantity: 100, usedCount: 12, expiryDate: D('2026-09-30T23:59:00+05:30'), eventIds: ['evt-nova-1'], status: 'active', createdAt: daysAgo(4), updatedAt: daysAgo(4) },
]

// ---------------- Support tickets (guest issues, org-scoped) ----------------
// Session context: the booth app records the guest's whole session and
// attaches it when a ticket is raised (after session end / payment):
// guest phone, slot picked, camera clicks, customisation, payment txn.
const ses = (id, phone, slotLabel, slotStart, slotEnd, pkg, clicks, filters, payment, startedAt, endedAt) =>
  ({ id, phone, slot: { label: slotLabel, start: slotStart, end: slotEnd }, package: pkg, cameraClicks: clicks, filtersUsed: filters, payment, startedAt, endedAt })

const TICKETS = [
  {
    id: 'tix-1', organizationId: 'org-sunset', eventId: 'evt-sun-1', deviceId: 'dev-sun-2',
    subject: 'Printer jammed during wedding — prints stuck',
    category: 'device', priority: 'urgent', status: 'in_progress',
    guest: { name: 'Reception staff', contact: '+91 98210 44321' },
    session: ses('SES-8A21', '+91 98210 44321', 'Slot A · Wedding Morning', daysAgo(0, 8, 30), daysAgo(0, 9, 0),
      { templateId: 'hp-royal-57v3', templateName: 'Royal Wedding', layout: '5×7 · 3', prints: 3, digitalCopy: true }, 12, ['warm', 'bw'],
      { utr: '417220983312', amount: 240, status: 'paid', method: 'UPI', settlement: 'wallet', at: daysAgo(0, 8, 58) }, daysAgo(0, 8, 31), daysAgo(0, 8, 59)),
    createdAt: daysAgo(0, 9, 40), updatedAt: daysAgo(0, 10, 5),
    messages: [
      { id: 'm1', author: 'Guest (booth widget)', at: daysAgo(0, 9, 40), text: 'The lawn booth printer is jammed. Couple wants their strip printed for the pheras. Please help!' },
      { id: 'm2', author: 'Rohit Das (Organization Manager)', at: daysAgo(0, 10, 5), text: 'Rohit here — I have asked the booth operator to power-cycle the printer. If it fails in 5 minutes we will switch to Booth 01 with a manual print queue.' },
    ],
    resolution: null,
  },
  {
    id: 'tix-2', organizationId: 'org-sunset', eventId: 'evt-sun-1', deviceId: null,
    subject: 'Guest could not download photos after paying',
    category: 'payment', priority: 'high', status: 'open',
    guest: { name: 'Ankit (guest)', contact: '+91 99717 04098' },
    session: ses('SES-8B04', '+91 99717 04098', 'Slot C · Pre-Lunch', daysAgo(0, 10, 20), daysAgo(0, 10, 50),
      { templateId: 'hp-filmstrip-4626v4', templateName: 'Retro Film Strip', layout: '2×6 · 4', prints: 1, digitalCopy: true }, 6, ['original'],
      { utr: '417512098776', amount: 150, status: 'paid', method: 'Card', settlement: 'wallet', at: daysAgo(0, 10, 47) }, daysAgo(0, 10, 21), daysAgo(0, 10, 48)),
    createdAt: daysAgo(0, 11, 5), updatedAt: daysAgo(0, 11, 5),
    messages: [
      { id: 'm1', author: 'Guest (download page)', at: daysAgo(0, 11, 5), text: 'I paid for 1 print + digital copy. The download link shows “token expired”. UTR: 417220983312.' },
    ],
    resolution: null,
  },
  {
    id: 'tix-3', organizationId: 'org-pika', eventId: 'evt-pika-1', deviceId: 'dev-pika-1',
    subject: 'Camera focus issues in low light',
    category: 'device', priority: 'medium', status: 'open',
    guest: { name: 'Venue manager', contact: '+91 99870 11234' },
    session: ses('SES-7F88', '+91 99870 11234', 'Slot B · Golden Hour', daysAgo(1, 14, 40), daysAgo(1, 15, 10),
      { templateId: 'hp-gala-68v1', templateName: 'Gala Gold Full', layout: '6×8 · 1', prints: 2, digitalCopy: false }, 26, ['cool', 'soft'],
      { utr: '417733104558', amount: 190, status: 'paid', method: 'UPI', settlement: 'wallet', at: daysAgo(1, 15, 5) }, daysAgo(1, 14, 41), daysAgo(1, 15, 8)),
    createdAt: daysAgo(1, 15, 20), updatedAt: daysAgo(1, 15, 20),
    messages: [
      { id: 'm1', author: 'Guest (booth widget)', at: daysAgo(1, 15, 20), text: 'Indoor shots are coming out blurry when the hall lights are dim. Outdoor shots are fine.' },
    ],
    resolution: null,
  },
  {
    id: 'tix-4', organizationId: 'org-tech', eventId: 'evt-tech-1', deviceId: 'dev-tech-1',
    subject: 'Coupon GZFLASH15 not applying',
    category: 'payment', priority: 'high', status: 'in_progress',
    guest: { name: 'Walk-in guest', contact: '+91 93150 77241' },
    session: ses('SES-9C12', '+91 93150 77241', 'Slot A · Evening Pass', daysAgo(0, 17, 50), daysAgo(0, 18, 20),
      { templateId: 'hp-neon-46v4', templateName: 'Neon Party Grid', layout: '4×6 · 4', prints: 2, digitalCopy: true }, 9, ['neon', 'cool'],
      { utr: null, amount: 210, status: 'failed', method: 'UPI', settlement: 'upi', at: daysAgo(0, 18, 15) }, daysAgo(0, 17, 51), daysAgo(0, 18, 16)),
    createdAt: daysAgo(0, 18, 30), updatedAt: daysAgo(0, 20, 10),
    messages: [
      { id: 'm1', author: 'Guest (booth widget)', at: daysAgo(0, 18, 30), text: 'Poster at the venue says use GZFLASH15 for 15% off, but the booth says coupon exhausted.' },
      { id: 'm2', author: 'Vikram Sethi (Organization Admin)', at: daysAgo(0, 20, 10), text: 'Coupon is fully used (300/300). Venue staff should take it off posters. I am creating a fresh 100-quantity batch for tomorrow.' },
    ],
    resolution: null,
  },
  {
    id: 'tix-5', organizationId: 'org-kade', eventId: 'evt-kade-1', deviceId: null,
    subject: 'Wrong name on printed strip',
    category: 'photo', priority: 'low', status: 'resolved',
    guest: { name: 'Mrs Malhotra', contact: '+91 98100 90807' },
    session: ses('SES-6D40', '+91 98100 90807', 'Slot B · Cake Cutting', daysAgo(2, 16, 30), daysAgo(2, 17, 0),
      { templateId: 'hp-kids-46h3', templateName: 'Kids Splash', layout: '4×6 · 3', prints: 4, digitalCopy: true }, 18, ['soft', 'party'],
      { utr: '417689120034', amount: 180, status: 'paid', method: 'UPI', settlement: 'upi', at: daysAgo(2, 16, 55) }, daysAgo(2, 16, 31), daysAgo(2, 16, 57)),
    createdAt: daysAgo(2, 17, 45), updatedAt: daysAgo(2, 19, 0),
    messages: [
      { id: 'm1', author: 'Guest (booth widget)', at: daysAgo(2, 17, 45), text: 'Our kid’s name was spelled wrong on the frame ("Anaya" instead of "Ananya").' },
      { id: 'm2', author: 'Kunal Aneja (Organization Admin)', at: daysAgo(2, 19, 0), text: 'Re-printed with the correct spelling and shared the digital copy on WhatsApp. Apologised on our behalf.' },
    ],
    resolution: 'Correct name applied to event branding; reprint issued to guest.',
  },
  {
    id: 'tix-6', organizationId: 'org-vishal', eventId: 'evt-vish-1', deviceId: 'dev-vish-1',
    subject: 'Booth shows “no event assigned”',
    category: 'event', priority: 'urgent', status: 'open',
    guest: { name: 'Host', contact: '+91 98155 66778' },
    session: ses('SES-9E77', '+91 98155 66778', 'Slot A · Housewarming', daysAgo(0, 18, 30), daysAgo(0, 19, 0),
      { templateId: 'hp-classic-46v1', templateName: 'Classic White', layout: '4×6 · 1', prints: 0, digitalCopy: false }, 4, ['warm'],
      { utr: null, amount: 0, status: 'pending', method: null, at: null }, daysAgo(0, 18, 31), daysAgo(0, 18, 58)),
    createdAt: daysAgo(0, 19, 10), updatedAt: daysAgo(0, 19, 10),
    messages: [
      { id: 'm1', author: 'Guest (booth widget)', at: daysAgo(0, 19, 10), text: 'Booth is on but the screen says no event assigned. The party is about to start!' },
    ],
    resolution: null,
  },
  {
    id: 'tix-7', organizationId: 'org-pika', eventId: 'evt-pika-2', deviceId: null,
    subject: 'Corporate client wants invoice copy',
    category: 'general', priority: 'low', status: 'closed',
    guest: { name: 'Nexus Ltd accounts', contact: 'accounts@nexus.co.in' },
    session: ses('SES-5A19', '+91 98200 41125', 'Corporate Slot 2', daysAgo(6, 11, 0), daysAgo(6, 12, 0),
      { templateId: 'hp-corporate-46h4', templateName: 'Corporate Blue', layout: '4×6 · 4', prints: 6, digitalCopy: true }, 31, ['original', 'bw'],
      { utr: '417552310099', amount: 540, status: 'paid', method: 'Card', settlement: 'wallet', at: daysAgo(6, 11, 50) }, daysAgo(6, 11, 1), daysAgo(6, 11, 52)),
    createdAt: daysAgo(5, 12, 0), updatedAt: daysAgo(4, 10, 30),
    messages: [
      { id: 'm1', author: 'Guest (download page)', at: daysAgo(5, 12, 0), text: 'Please share invoice for the event package for our expenses.' },
      { id: 'm2', author: 'Arpita Shah (Organization Admin)', at: daysAgo(4, 10, 30), text: 'Invoice HAP-EVT-2609-0342 shared to their email. Closing.' },
    ],
    resolution: 'Invoice shared with client accounts team.',
  },
  {
    id: 'tix-8', organizationId: 'org-nova', eventId: 'evt-nova-1', deviceId: 'dev-nova-1',
    subject: 'UPI QR not scanning on old phones',
    category: 'payment', priority: 'medium', status: 'open',
    guest: { name: 'Guest', contact: '+91 90070 18824' },
    session: ses('SES-9B31', '+91 90070 18824', 'Slot A · Diwali Preview', daysAgo(0, 17, 20), daysAgo(0, 17, 50),
      { templateId: 'hp-sunset-4626v3', templateName: 'Sunset Strip Trio', layout: '2×6 · 3', prints: 2, digitalCopy: false }, 7, ['party'],
      { utr: null, amount: 150, status: 'failed', method: 'UPI', settlement: 'upi', at: daysAgo(0, 17, 45) }, daysAgo(0, 17, 21), daysAgo(0, 17, 46)),
    createdAt: daysAgo(0, 18, 2), updatedAt: daysAgo(0, 18, 2),
    messages: [
      { id: 'm1', author: 'Guest (booth widget)', at: daysAgo(0, 18, 2), text: 'QR scan fails on two older Android phones; they could pay with card instead.' },
    ],
    resolution: null,
  },
]

// ---------------- Organization → HappyPix platform support ----------------
// Requests are reviewed first. Acceptance assigns a ticket number and opens
// the shared conversation; denial carries a visible reason and can be
// re-applied with a new organization message.
const PLATFORM_SUPPORT = [
  {
    id: 'sup-1', ticketNo: 'HPX-2609-0001', organizationId: 'org-sunset',
    subject: 'Booth sync intermittently loses template updates', category: 'technical', priority: 'high', status: 'in_progress',
    createdBy: 'usr-sana', createdAt: daysAgo(3, 9), updatedAt: daysAgo(0, 10, 40), acceptedAt: daysAgo(3, 11), resolvedAt: null,
    decision: { type: 'accepted', reason: null, by: 'usr-sm', at: daysAgo(3, 11) }, reapplyCount: 0, resolution: null,
    messages: [
      { id: 'sm-1', authorId: 'usr-sana', authorName: 'Sana Kapoor', authorRole: 'Organization Admin', side: 'org', at: daysAgo(3, 9), text: 'Two booths receive event details but sometimes keep an older template list after sync. We have restarted both units.', images: [] },
      { id: 'sm-2', authorId: 'usr-sm', authorName: 'Arjun Rao', authorRole: 'Support Manager', side: 'platform', at: daysAgo(3, 11), text: 'Accepted as HPX-2609-0001. We are checking the sync cursor and device logs.', images: [] },
      { id: 'sm-3', authorId: 'usr-rohit', authorName: 'Rohit Das', authorRole: 'Organization Manager', side: 'org', at: daysAgo(0, 10, 40), text: 'It happened again on Booth 02 this morning. The event itself remained assigned.', images: [] },
    ],
  },
  {
    id: 'sup-2', ticketNo: null, organizationId: 'org-sunset',
    subject: 'Request to remove an old invoice', category: 'billing', priority: 'low', status: 'denied',
    createdBy: 'usr-sana', createdAt: daysAgo(8, 12), updatedAt: daysAgo(7, 10), acceptedAt: null, resolvedAt: null,
    decision: { type: 'denied', reason: 'Paid invoices are statutory billing records and cannot be deleted. We can add a credit note if the charge is incorrect.', by: 'usr-owner', at: daysAgo(7, 10) }, reapplyCount: 0, resolution: null,
    messages: [
      { id: 'sm-4', authorId: 'usr-sana', authorName: 'Sana Kapoor', authorRole: 'Organization Admin', side: 'org', at: daysAgo(8, 12), text: 'Please remove invoice HAP-INV-2604-118 from our history.', images: [] },
    ],
  },
  {
    id: 'sup-3', ticketNo: null, organizationId: 'org-pika',
    subject: 'Need help moving one booth to a replacement tablet', category: 'account', priority: 'medium', status: 'new',
    createdBy: 'usr-arpita', createdAt: daysAgo(0, 8, 35), updatedAt: daysAgo(0, 10, 0), acceptedAt: null, resolvedAt: null,
    decision: null,
    decisionHistory: [{ type: 'denied', reason: 'Please provide the old device UUID so we can preserve the correct booth history.', by: 'usr-sm', at: daysAgo(0, 9, 15) }],
    reapplyCount: 1,
    lastReapplication: { id: 'sm-5b', authorId: 'usr-arpita', authorName: 'Arpita Shah', authorRole: 'Organization Admin', side: 'org', at: daysAgo(0, 10, 0), text: 'Re-applying with the damaged tablet UUID: e5f6a7b8-c9d0-4e1f-a2b3-c4d5e6f7a8b9. Please preserve its event and payment history.', images: [] },
    resolution: null,
    messages: [
      { id: 'sm-5', authorId: 'usr-arpita', authorName: 'Arpita Shah', authorRole: 'Organization Admin', side: 'org', at: daysAgo(0, 8, 35), text: 'Our studio tablet was damaged. Please guide us so the paired booth and event history are not lost.', images: [] },
      { id: 'sm-5b', authorId: 'usr-arpita', authorName: 'Arpita Shah', authorRole: 'Organization Admin', side: 'org', at: daysAgo(0, 10, 0), text: 'Re-applying with the damaged tablet UUID: e5f6a7b8-c9d0-4e1f-a2b3-c4d5e6f7a8b9. Please preserve its event and payment history.', images: [] },
    ],
  },
  {
    id: 'sup-4', ticketNo: 'HPX-2609-0002', organizationId: 'org-tech',
    subject: 'Clarification on wallet settlement timing', category: 'billing', priority: 'medium', status: 'resolved',
    createdBy: 'usr-vikram', createdAt: daysAgo(12, 11), updatedAt: daysAgo(10, 16), acceptedAt: daysAgo(12, 13), resolvedAt: daysAgo(10, 16),
    decision: { type: 'accepted', reason: null, by: 'usr-pa', at: daysAgo(12, 13) }, reapplyCount: 0,
    resolution: 'Wallet settlement schedule and direct-UPI option explained; no account change was required.',
    messages: [
      { id: 'sm-6', authorId: 'usr-vikram', authorName: 'Vikram Sethi', authorRole: 'Organization Admin', side: 'org', at: daysAgo(12, 11), text: 'How long does a wallet withdrawal normally take?', images: [] },
      { id: 'sm-7', authorId: 'usr-pa', authorName: 'Priya Nair', authorRole: 'Platform Admin', side: 'platform', at: daysAgo(12, 13), text: 'Accepted. Standard withdrawals are processed to the saved UPI ID within one business day.', images: [] },
      { id: 'sm-8', authorId: 'usr-pa', authorName: 'Priya Nair', authorRole: 'Platform Admin', side: 'platform', at: daysAgo(10, 16), text: 'Marking this resolved after confirming the payout options with Vikram.', images: [] },
    ],
  },
]

// ---------------- Audit logs ----------------
let AUDIT_SEQ = 0
const A = (at, actorId, action, entity, summary, ip, severity = 'info') => ({
  id: `aud-${++AUDIT_SEQ}`,
  at: at || daysAgo(0, 9, 0),
  actorId,
  action,
  entity,
  summary,
  ip: ip || '103.89.20.11',
  severity,
  organizationId: null,
})

const AUDIT = [
  A(daysAgo(0, 8, 12), 'usr-owner', 'platform.auth.login', 'user', 'Owner Harshit Mehta signed in to CRM', '103.89.20.11'),
  A(daysAgo(0, 9, 4), 'usr-pa', 'platform.auth.login', 'user', 'Platform Admin Priya Nair signed in to CRM', '152.58.99.4'),
  A(daysAgo(0, 10, 2), 'usr-sana', 'organization.auth.login', 'user', 'Sana Kapoor signed in (Sunset Weddings)', '49.36.101.77', 'info', 'org-sunset'),
  A(daysAgo(0, 10, 41), 'usr-vikram', 'organization.auth.login', 'user', 'Vikram Sethi signed in (Tech Closet)', '182.64.220.9', 'info', 'org-tech'),
  A(daysAgo(1, 12, 40), 'usr-kade-admin-op', 'device.registered', 'device', 'Device registered: KADE Main Booth (Rohini, Delhi)', '182.64.19.101', 'info', 'org-kade'),
  A(daysAgo(1, 16, 20), 'usr-rohit', 'event.assigned_to_device', 'event', 'Event “Kapoor–Verma Wedding” assigned to Booth 02 — Lawn', '49.36.101.77', 'info', 'org-sunset'),
  A(daysAgo(1, 18, 5), 'usr-arpita', 'coupon.created', 'coupon', 'Coupon LAUNCH30 created (30% off, 500 uses)', '117.96.11.30', 'info', 'org-pika'),
  A(daysAgo(2, 11, 30), 'usr-pa', 'platform.template.updated', 'template', 'Global template “Neon Party” updated (preview + layout)', '152.58.99.4'),
  A(daysAgo(2, 14, 45), 'usr-meera', 'event.created', 'event', 'Event “Startup Meetup Booth” created', '182.64.220.9', 'info', 'org-tech'),
  A(daysAgo(3, 10, 15), 'usr-owner', 'platform.template.created', 'template', 'Global template “Kids Fun 4x6” created (Celebrations)', '103.89.20.11'),
  A(daysAgo(3, 12, 40), 'usr-nandini', 'organization.auth.login', 'user', 'Nandini Bose signed in (Nova Occasions)', '106.51.77.2', 'info', 'org-nova'),
  A(daysAgo(4, 17, 25), 'usr-sana', 'ticket.resolved', 'ticket', 'Ticket “Wrong name on printed strip” resolved', '49.36.101.77', 'info', 'org-kade'),
  A(daysAgo(5, 13, 10), 'usr-owner', 'platform.user.created', 'user', 'Internal user Arjun Rao created (Support Manager)', '103.89.20.11'),
  A(daysAgo(5, 15, 30), 'usr-arpita', 'organization.team.created', 'user', 'Organization Manager seat reserved (pending invite)', '117.96.11.30', 'info', 'org-pika'),
  A(daysAgo(6, 11, 0), 'usr-owner', 'platform.auth.failed', 'auth', 'Failed login attempt for unknown email “admin@happypix.com” (3 tries)', '45.120.148.9', 'warn'),
  A(daysAgo(8, 9, 50), 'usr-vikram', 'device.registered', 'device', 'Device registered: TechCloset iPad (Pitampura, Delhi)', '182.64.220.9', 'info', 'org-tech'),
  A(daysAgo(8, 14, 20), 'usr-owner', 'platform.organization.created', 'organization', 'Organization “Nova Occasions” created (Trial, 14 days)', '103.89.20.11'),
  A(daysAgo(10, 10, 30), 'usr-owner', 'platform.plan.purchased', 'subscription', 'Vishal Studio purchased Starter (3 months, ₹1,999) — invoice HAP-INV-2609-401', '103.89.20.11'),
  A(daysAgo(10, 18, 45), 'usr-sana', 'organization.defaults.updated', 'organization', 'Frame prices updated (Royal Black ₹60 → ₹75, Gold Elegance ₹80 → ₹90)', '49.36.101.77', 'info', 'org-sunset'),
  A(daysAgo(13, 12, 0), 'usr-owner', 'platform.organization.suspended', 'organization', 'Organization “Riya Celebrations” suspended — repeated billing disputes', '103.89.20.11', 'warn'),
  A(daysAgo(14, 9, 30), 'usr-owner', 'platform.template.disabled', 'template', 'Global template “Kids Fun 4x6” disabled (layout rework)', '103.89.20.11'),
  A(daysAgo(16, 15, 10), 'usr-kade-admin-op', 'coupon.created', 'coupon', 'Coupon BIRTHDAY50 created (₹50 off, 25 uses)', '182.64.19.101', 'info', 'org-kade'),
  A(daysAgo(19, 11, 40), 'usr-owner', 'platform.plan.expiring', 'subscription', 'Pika Photography Professional plan expires in 11 days — renewal reminder queued', '103.89.20.11', 'warn'),
  A(daysAgo(20, 17, 5), 'usr-owner', 'platform.plan.purchased', 'subscription', 'Kade Events purchased Starter (3 months, ₹1,999) — invoice HAP-INV-2608-342', '103.89.20.11'),
  A(daysAgo(21, 10, 20), 'usr-rohit', 'event.paused', 'event', 'Event “Sharma Anniversary Gala” paused (venue reschedule request)', '49.36.101.77', 'info', 'org-sunset'),
  A(daysAgo(21, 16, 0), 'usr-rohit', 'event.resumed', 'event', 'Event “Sharma Anniversary Gala” resumed with new venue', '49.36.101.77', 'info', 'org-sunset'),
  A(daysAgo(24, 13, 15), 'usr-pa', 'platform.organization.viewed', 'organization', 'Platform Admin viewed organization “Alpha Booths”', '152.58.99.4', 'info'),
  A(daysAgo(30, 9, 0), 'usr-owner', 'platform.organization.banned', 'organization', 'Organization “Glow Party Co” banned — fraudulent coupon abuse', '103.89.20.11', 'danger'),
  A(daysAgo(34, 12, 30), 'usr-owner', 'platform.template.created', 'template', 'Global template “Square Grid 4” created (Corporate)', '103.89.20.11'),
  A(daysAgo(40, 15, 45), 'usr-arpita', 'device.registered', 'device', 'Device registered: Pika Corporate (Bandra, Mumbai)', '117.96.11.30', 'info', 'org-pika'),
  A(daysAgo(42, 19, 10), 'usr-owner', 'platform.plan.expired', 'subscription', 'Alpha Booths Basic plan expired — organization moved to expired state', '103.89.20.11', 'warn'),
]

// ---------------- Payments (booth print revenue per org) ----------------
// Orgs on wallet mode today switched to it mid-year; before the switch their
// guests paid the org UPI directly. Keeps the seed history realistic.
const WALLET_SINCE = { 'org-sunset': '2026-06-01', 'org-pika': '2026-08-01', 'org-alpha': '2026-03-01', 'org-riya': '2026-01-01', 'org-glow': '2026-01-01' }
function settlementFor(orgId, dt, rng) {
  const since = WALLET_SINCE[orgId]
  if (!since) return 'upi'
  return dt >= new Date(since + 'T00:00:00+05:30') ? 'wallet' : 'upi'
}

function buildPayments() {
  const rng = mulberry32(20260924)
  const out = []
  const spec = [
    { org: 'org-sunset', w: 1.0, devices: ['dev-sun-1', 'dev-sun-2', 'dev-sun-3', 'dev-sun-4'], events: ['evt-sun-1', 'evt-sun-3'] },
    { org: 'org-pika', w: 0.85, devices: ['dev-pika-1', 'dev-pika-2', 'dev-pika-3'], events: ['evt-pika-1'] },
    { org: 'org-tech', w: 0.7, devices: ['dev-tech-1', 'dev-tech-2'], events: ['evt-tech-1', 'evt-tech-2'] },
    { org: 'org-kade', w: 0.5, devices: ['dev-kade-1'], events: ['evt-kade-1'] },
    { org: 'org-nova', w: 0.35, devices: ['dev-nova-1'], events: ['evt-nova-1'] },
    { org: 'org-vishal', w: 0.3, devices: ['dev-vish-1'], events: ['evt-vish-1'] },
    { org: 'org-alpha', w: 0.25, devices: ['dev-alpha-1'], events: ['evt-alpha-1'] },
    { org: 'org-riya', w: 0.15, devices: ['dev-riya-1'], events: ['evt-riya-1'] },
  ]
  // base print revenue per org (what their guests paid for prints)
  const base = { 'org-sunset': 120, 'org-pika': 90, 'org-tech': 80, 'org-kade': 100, 'org-nova': 100, 'org-vishal': 100, 'org-alpha': 100, 'org-riya': 100 }
  let seq = 1
  const start = new Date('2026-01-06T00:00:00+05:30').getTime()
  const end = new Date('2026-09-24T09:00:00+05:30').getTime()
  for (let t = start; t < end; t += 3600000 * (6 + Math.floor(rng() * 20))) {
    let pick = rng()
    let total = spec.reduce((s, x) => s + x.w, 0)
    for (const s of spec) {
      pick -= s.w / total
      if (pick <= 0) {
        const count = 1 + (rng() < 0.3 ? 1 : 0)
        for (let k = 0; k < count; k++) {
          const prints = 1 + Math.floor(rng() * 3)
          const frameFee = rng() < 0.4 ? [0, 50, 60, 75][Math.floor(rng() * 4)] : 0
          const amt = (base[s.org] + frameFee) * prints
          const roll = rng()
          const status = roll < 0.9 ? 'paid' : roll < 0.955 ? 'pending' : 'failed'
          const dt = new Date(t + Math.floor(rng() * 3600000))
          out.push({
            id: `pay-${seq++}`,
            organizationId: s.org,
            eventId: rng() < 0.92 ? s.events[Math.floor(rng() * s.events.length)] : null,
            deviceId: s.devices[Math.floor(rng() * s.devices.length)],
            amount: amt,
            printCount: prints,
            digitalCopy: rng() < 0.55,
            status,
            utr: status === 'paid' ? `417${String(100000000 + Math.floor(rng() * 899999999)).slice(0, 9)}` : null,
            // Where the money went — 'upi' (guest paid the org's UPI QR, money
            // landed in the org bank) or 'wallet' (UPI paused → HappyPix
            // collected and credited the org wallet). Stamped at pay time.
            settlement: settlementFor(s.org, dt, rng),
            createdAt: dt.toISOString(),
          })
        }
        break
      }
    }
  }
  return out
}

// ---------------- Build / persist ----------------
function seedDb() {
  return {
    version: DB_VERSION,
    seededAt: D('2026-09-24T00:00:00+05:30'),
    templates: buildTemplates(),
    users: USERS,
    organizations: ORGS,
    subscriptions: SUBSCRIPTIONS,
    planCatalog: PLAN_CATALOG,
    devices: DEVICES.map((device) => ({
      ...device,
      connections: { ...(DEVICE_CONNECTIONS[device.id] || { camera: false, printer: false, kioskScreen: false, updatedAt: device.lastSeenAt }) },
    })),
    // Existing seed events also carry the effective price snapshot they would
    // have received at creation time.
    events: EVENTS.map((event) => ({
      ...event,
      layoutPrices: { ...(ORG_DEFAULTS[event.organizationId]?.layoutPrices || suggestedPriceMap()) },
    })),
    orgDefaults: ORG_DEFAULTS,
    coupons: COUPONS,
    tickets: TICKETS,
    platformSupport: PLATFORM_SUPPORT,
    supportTicketSeq: 2,
    payments: buildPayments(),
    audit: AUDIT,
    withdrawals: WITHDRAWALS, // wallet → org UPI payouts
    platformSettings: { galleryEnabled: true, requireGuestConsent: true, updatedAt: daysAgo(1), updatedBy: 'usr-owner' },
    galleryPhotos: GALLERY_PHOTOS,
    sessions: [], // auth sessions (token, userId, expiry) — runtime state
    loginAttempts: {}, // login throttling counters — runtime state
  }
}

let _db = null

export function getDb() {
  if (_db) return _db
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.version === DB_VERSION) {
        _db = parsed
        return _db
      }
    }
  } catch { /* fall through to reseed */ }
  _db = seedDb()
  persist()
  return _db
}

export function persist() {
  if (!_db) return
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(_db))
  } catch { /* storage full — keep in-memory copy */ }
}

export function resetDb() {
  _db = null
  try { localStorage.removeItem(DB_KEY) } catch { /* ignore */ }
  return getDb()
}
