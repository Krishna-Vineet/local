// Subscription plans — spec 03 §6 / 05 §3.
// Purchases happen on the HappyPix display website; the CRM only
// reads the resulting plan/subscription state. Nothing here is editable.

export const PLANS = {
  trial: { key: 'trial', name: 'Trial', devices: 1, events: 1, duration: '14 days', price: 0, color: 'chip-trial' },
  starter: { key: 'starter', name: 'Starter', devices: 1, events: 1, duration: '3 months', price: 1999, color: 'chip-info' },
  basic: { key: 'basic', name: 'Basic', devices: 3, events: 2, duration: '3 months', price: 2999, color: 'chip-purple' },
  professional: { key: 'professional', name: 'Professional', devices: 5, events: 5, duration: '6 months', price: 5999, color: 'chip-pink' },
  business: { key: 'business', name: 'Business', devices: 10, events: 10, duration: '6 months', price: 9999, color: 'chip-solid-green' },
  custom: { key: 'custom', name: 'Custom', devices: '5–25', events: '5–20', duration: '1–3 years', price: null, color: 'chip-neutral' },
}

export function planDef(key) {
  return PLANS[key] || PLANS.trial
}

// Plan / organization statuses (spec 05 §3)
export const PLAN_STATUSES = {
  trial: { label: 'Trial', chip: 'chip-trial' },
  active: { label: 'Active', chip: 'chip-active' },
  expiring_soon: { label: 'Expiring Soon', chip: 'chip-warn' },
  expired: { label: 'Expired', chip: 'chip-neutral' },
  not_subscribed: { label: 'Not Subscribed', chip: 'chip-neutral' },
  suspended: { label: 'Suspended', chip: 'chip-warn' },
  banned: { label: 'Banned', chip: 'chip-danger' },
}

export function statusMeta(status) {
  return PLAN_STATUSES[status] || PLAN_STATUSES.not_subscribed
}

// Device / event / ticket statuses
export const DEVICE_ONLINE_WINDOW_MS = 90 * 1000 // heartbeat cadence assumption
export const EVENT_STATUSES = {
  upcoming: { label: 'Upcoming', chip: 'chip-info' },
  active: { label: 'Active', chip: 'chip-active' },
  paused: { label: 'Paused', chip: 'chip-warn' },
  finished: { label: 'Finished', chip: 'chip-neutral' },
}
export const TICKET_STATUSES = {
  open: { label: 'Open', chip: 'chip-danger' },
  in_progress: { label: 'In Progress', chip: 'chip-info' },
  resolved: { label: 'Resolved', chip: 'chip-active' },
  closed: { label: 'Closed', chip: 'chip-neutral' },
}
export const TICKET_PRIORITIES = {
  low: { label: 'Low', chip: 'chip-neutral' },
  medium: { label: 'Medium', chip: 'chip-info' },
  high: { label: 'High', chip: 'chip-warn' },
  urgent: { label: 'Urgent', chip: 'chip-danger' },
}
export const COUPON_STATUSES = {
  active: { label: 'Active', chip: 'chip-active' },
  paused: { label: 'Paused', chip: 'chip-warn' },
  expired: { label: 'Expired', chip: 'chip-neutral' },
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

export const FILTER_BY_ID = Object.fromEntries(FILTERS.map((f) => [f.id, f]))

export const HARDWARE_CAPABILITIES = [
  { id: 'camera', label: 'Camera' },
  { id: 'printer', label: 'Printer' },
  { id: 'wifi', label: 'Wi-Fi' },
]
