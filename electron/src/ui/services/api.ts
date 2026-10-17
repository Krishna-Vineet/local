import type {
  BoothEvent,
  BoothSettings,
  BoothSnapshot,
  CheckoutQuote,
  HardwareSnapshot,
  Installation,
  PaymentOrder,
} from '../types'

export interface LoginInput {
  email: string
  password: string
  deviceUuid: string
  deviceName: string
  clientDateTime: string
  location: { label: string; latitude?: number; longitude?: number; accuracyM?: number }
  platform: string
  appVersion: string
  display: { width: number; height: number; scaleFactor: number; external: boolean }
}

export interface HeartbeatInput {
  deviceUuid: string
  eventId: string | null
  knownRevision: string | null
  clientDateTime: string
  hardware: HardwareSnapshot
}

export interface QuoteInput {
  eventId: string
  templateId: string
  layoutId: string
  prints: number
  digitalCopy: boolean
  couponCode?: string
}

export interface CompleteSessionInput {
  sessionId: string
  digitalCopy: boolean
  photos?: string[]
  compositeUrl?: string
  guestConsent?: boolean
  eventId?: string
}

export interface CompleteSessionResult {
  shareUrl: string | null
  downloadUrl?: string | null
  downloadId?: string | null
  downloadExpiresAt?: string | null
  photosStored?: number
}

export interface BoothApi {
  login(input: LoginInput): Promise<{ installation: Installation; snapshot: BoothSnapshot }>
  bootstrap(installation: Installation): Promise<BoothSnapshot>
  heartbeat(installation: Installation, input: HeartbeatInput): Promise<{ changed: boolean; snapshot?: BoothSnapshot }>
  quote(installation: Installation, input: QuoteInput): Promise<CheckoutQuote>
  createPayment(installation: Installation, quote: CheckoutQuote): Promise<PaymentOrder>
  paymentStatus(installation: Installation, paymentId: string): Promise<PaymentOrder['status']>
  completeFree(installation: Installation, quote: CheckoutQuote): Promise<void>
  completeSession(installation: Installation, input: CompleteSessionInput): Promise<CompleteSessionResult>
  submitTicket(installation: Installation, input: SupportTicketInput): Promise<{ success: boolean; ticketId?: string }>
}

// Guest support ticket — identical contract to the client-app booth
// (POST /api/booth/support, device-authenticated).
export interface SupportTicketInput {
  name: string
  email: string
  subject: string
  message: string
  category?: 'printing' | 'payment' | 'quality' | 'general'
  sessionId?: string
  paymentReference?: string
  eventId?: string
  deviceId?: string
}

export interface PartnerBoothSnapshot {
  device: { id: string; name: string; uuid?: string }
  organization: { id: string; name: string }
  branding?: { organization?: { logos?: string[]; tagline?: string | null } | null } | null
  settings: BoothSettings & { organizationLogo?: string | null; tagline?: string | null }
  event: BoothEvent | null
  revision: string
  serverTime: string
}

export function normalizeSnapshot(raw: PartnerBoothSnapshot): BoothSnapshot {
  const orgBrand = raw.branding?.organization ?? null
  const logoUrl: string | null = orgBrand?.logos?.[0] ?? raw.settings?.organizationLogo ?? null
  const branding = { logoUrl, tagline: raw.settings?.tagline || orgBrand?.tagline || '' }
  return {
    ...raw,
    device: { id: raw.device?.id, name: raw.device?.name, uuid: raw.device?.uuid ?? '' },
    organization: { id: raw.organization?.id, name: raw.organization?.name, branding },
    settings: { ...raw.settings, branding },
  }
}

const DEFAULT_QUOTE_TTL_MS = 10 * 60 * 1000

export class HttpApi implements BoothApi {
  public readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private async request<T>(path: string, init: RequestInit, installation?: Installation): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(installation ? { Authorization: `Device ${installation.deviceToken}`, 'X-Device-UUID': installation.deviceUuid } : {}),
        ...init.headers,
      },
    })
    const payload = await response.json().catch(() => null) as { error?: string; code?: string; state?: string } | null
    if (!response.ok) {
      throw Object.assign(new Error(payload?.error || `Backend request failed (${response.status}).`), {
        status: response.status,
        code: payload?.code ?? payload?.state ?? null,
      })
    }
    return payload as T
  }

  login(input: LoginInput) {
    return this.request<{ installation: Installation; snapshot: PartnerBoothSnapshot }>('/api/booth/login', { method: 'POST', body: JSON.stringify(input) })
      .then((r) => ({ ...r, snapshot: normalizeSnapshot(r.snapshot) }))
  }

  bootstrap(installation: Installation) {
    return this.request<PartnerBoothSnapshot>('/api/booth/bootstrap', { method: 'GET' }, installation).then(normalizeSnapshot)
  }

  heartbeat(installation: Installation, input: HeartbeatInput) {
    return this.request<{ changed: boolean; snapshot?: PartnerBoothSnapshot }>('/api/booth/heartbeat', { method: 'POST', body: JSON.stringify(input) }, installation)
      .then((r) => ({ changed: r.changed, snapshot: r.snapshot ? normalizeSnapshot(r.snapshot) : undefined }))
  }

  quote(installation: Installation, input: QuoteInput) {
    return this.request<CheckoutQuote & { expiresAt?: string }>('/api/booth/checkout/quote', { method: 'POST', body: JSON.stringify(input) }, installation)
      .then((q): CheckoutQuote => ({ ...q, expiresAt: q.expiresAt ?? new Date(Date.now() + DEFAULT_QUOTE_TTL_MS).toISOString() }))
  }

  createPayment(installation: Installation, quote: CheckoutQuote) {
    return this.request<Omit<PaymentOrder, 'status'> & { status?: PaymentOrder['status'] }>('/api/booth/payments', { method: 'POST', body: JSON.stringify({ quote }) }, installation)
      .then((p): PaymentOrder => ({ ...p, status: p.status ?? 'pending' }))
  }

  async paymentStatus(installation: Installation, paymentId: string) {
    const result = await this.request<{ status: PaymentOrder['status'] }>(`/api/booth/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' }, installation)
    return result.status
  }

  async completeFree(installation: Installation, quote: CheckoutQuote) {
    await this.request('/api/booth/checkout/free-complete', { method: 'POST', body: JSON.stringify({ quote }) }, installation)
  }

  completeSession(installation: Installation, input: CompleteSessionInput) {
    return this.request<CompleteSessionResult>('/api/booth/sessions/complete', { method: 'POST', body: JSON.stringify(input) }, installation)
  }

  submitTicket(installation: Installation, input: SupportTicketInput) {
    return this.request<{ success: boolean; ticketId?: string }>('/api/booth/support', { method: 'POST', body: JSON.stringify(input) }, installation)
  }
}

const configuredUrl = (import.meta.env.VITE_BOOTH_API_URL as string | undefined) || 'http://localhost:5000'
export const boothApi: BoothApi = new HttpApi(configuredUrl)
