// ─────────────────────────────────────────────────────────────────
//  Happypix Booth — API Client
//  Connects to backend /api/booth routes (or provides deterministic offline demo)
// ─────────────────────────────────────────────────────────────────

import Config from 'react-native-config';

import type {
  BoothEvent,
  BoothSettings,
  BoothSnapshot,
  BoothTemplate,
  CheckoutQuote,
  HardwareSnapshot,
  Installation,
  Orientation,
  PaymentOrder,
} from '../../types/src/index';

declare const process: any;

export * from '../../types/src/index';

/** Error from the booth API, carrying the HTTP status and the server's code/state. */
export class BoothApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'BoothApiError';
    this.status = status;
    this.code = code;
  }
}

/** Duck-typed check (works regardless of how the class was transpiled). */
export function isBoothApiError(error: unknown): error is BoothApiError {
  return !!error && typeof (error as BoothApiError).status === 'number' && 'code' in (error as object);
}

export interface CompleteSessionInput {
  sessionId: string;
  digitalCopy: boolean;
  guestConsent?: boolean;
  /** Captured photos as data URLs or uploaded S3 objects/URLs. Stored for the gallery. */
  photos?: (string | { url: string; key: string; type?: string; isComposite?: boolean })[];
  /** Final composited print image (data URL or stored URL), when rendered separately. */
  compositeUrl?: string;
  composite?: { url: string; key: string } | string;
  eventId?: string;
}

export interface UploadUrlItem {
  type: 'composite' | 'frame';
  index?: number;
  key: string;
  uploadUrl: string;
  publicUrl: string;
  contentType: string;
}

export interface GetUploadUrlsResult {
  s3Configured: boolean;
  urls: UploadUrlItem[];
}

export interface GetUploadUrlsInput {
  sessionId: string;
  eventId?: string;
  files: Array<{
    type: 'composite' | 'frame';
    index?: number;
    contentType?: string;
  }>;
}

export interface CompleteSessionResult {
  shareUrl: string | null;
  /** 24-hour guest download page on the HappyPix website (same as shareUrl). */
  downloadUrl?: string | null;
  downloadId?: string | null;
  downloadExpiresAt?: string | null;
  photosStored?: number;
}

export interface LoginInput {
  email: string;
  password: string;
  deviceUuid: string;
  deviceName: string;
  clientDateTime: string;
  location: { label: string; latitude?: number; longitude?: number; accuracyM?: number };
  platform: string;
  appVersion: string;
  display: { width: number; height: number; scaleFactor: number; external: boolean };
}

export interface HeartbeatInput {
  deviceUuid: string;
  eventId: string | null;
  knownRevision: string | null;
  clientDateTime: string;
  hardware: HardwareSnapshot;
}

export interface QuoteInput {
  eventId: string;
  templateId: string;
  layoutId: string;
  prints: number;
  digitalCopy: boolean;
  couponCode?: string;
}

export interface SupportTicketInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  category?: 'printing' | 'payment' | 'quality' | 'general';
  sessionId?: string;
  paymentReference?: string;
  eventId?: string;
  deviceId?: string;
}

export interface BoothApi {
  login(input: LoginInput): Promise<{ installation: Installation; snapshot: BoothSnapshot }>;
  bootstrap(installation: Installation): Promise<BoothSnapshot>;
  heartbeat(
    installation: Installation,
    input: HeartbeatInput
  ): Promise<{
    changed: boolean;
    snapshot?: BoothSnapshot;
    state?: string;
    invalidateCache?: boolean;
    message?: string;
    canOperate?: boolean;
  }>;
  quote(installation: Installation, input: QuoteInput): Promise<CheckoutQuote>;
  createPayment(installation: Installation, quote: CheckoutQuote): Promise<PaymentOrder>;
  paymentStatus(installation: Installation, paymentId: string): Promise<PaymentOrder['status']>;
  completeFree(installation: Installation, quote: CheckoutQuote): Promise<void>;
  confirmPayment(installation: Installation, paymentId: string, utr?: string): Promise<PaymentOrder['status']>;
  completeSession(installation: Installation, input: CompleteSessionInput): Promise<CompleteSessionResult>;
  getUploadUrls(installation: Installation, input: GetUploadUrlsInput): Promise<GetUploadUrlsResult>;
  submitTicket(installation: Installation | null, input: SupportTicketInput): Promise<{ success: boolean; ticketId?: string }>;
}

// Partner's v2 booth contract returns branding at the top level and omits
// device.uuid / expiresAt / status. Map it to the shape this UI was built on.
interface PartnerBoothSnapshot {
  device: { id: string; name: string; uuid?: string }
  organization: { id: string; name: string }
  branding?: { organization?: { logos?: string[]; tagline?: string | null } | null } | null
  settings: BoothSettings & { organizationLogo?: string | null; tagline?: string | null }
  gallery?: { galleryEnabled?: boolean; requireGuestConsent?: boolean } | null
  event: BoothEvent | null
  revision: string
  serverTime: string
}

export function resolveAssetUrl(rawUrl?: string | null, assetId?: string | null, baseUrl?: string | null): string | null {
  const origin = (baseUrl || activeApiUrl || 'http://localhost:5000')
    .replace(/\/+$/, '')
    .replace(/\/api(\/booth)?$/, '');
  const u = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  const aid = typeof assetId === 'string' ? assetId.trim() : '';
  const validAid = aid && !aid.startsWith('temp-') && !aid.startsWith('http') && !aid.startsWith('data:')
    ? aid
    : '';

  if (u.startsWith('data:')) return u;

  if (u.includes('/api/org/asset-proxy') || u.includes('/api/booth/asset-proxy')) {
    const qIdx = u.indexOf('?');
    return qIdx !== -1 ? `${origin}/api/org/asset-proxy${u.slice(qIdx)}` : `${origin}/api/org/asset-proxy`;
  }

  if ((u.includes('amazonaws.com') || u.includes('happypix-bucket')) && !u.includes('X-Amz-Signature')) {
    const s3Key = validAid || u.replace(/^https?:\/\/[^/]+\//, '').split('?')[0];
    if (s3Key) return `${origin}/api/org/asset-proxy?key=${encodeURIComponent(s3Key)}`;
  }

  if (u.startsWith('http://localhost:5000/') || u.startsWith('http://127.0.0.1:5000/')) {
    const rel = u.replace(/^https?:\/\/[^/]+/, '');
    return `${origin}${rel}`;
  }

  if (u.startsWith('/')) {
    return `${origin}${u}`;
  }

  if (u) return u;

  if (aid && !aid.startsWith('temp-')) {
    if (aid.startsWith('data:') || aid.startsWith('http://') || aid.startsWith('https://') || aid.startsWith('/')) {
      return resolveAssetUrl(aid, null, origin);
    }
    return `${origin}/uploads/${aid.replace(/^(\/?uploads\/|\/)/, '')}`;
  }

  return null;
}

export function normalizeSnapshot(raw: PartnerBoothSnapshot, baseUrl?: string | null): BoothSnapshot {
  const origin = (baseUrl || activeApiUrl || 'http://localhost:5000')
    .replace(/\/+$/, '')
    .replace(/\/api(\/booth)?$/, '');
  const orgBrand = raw.branding?.organization ?? null;
  const rawLogoUrl: string | null = orgBrand?.logos?.[0] ?? raw.settings?.organizationLogo ?? null;
  const logoUrl = resolveAssetUrl(rawLogoUrl, null, origin);
  const branding = { logoUrl, tagline: raw.settings?.tagline || orgBrand?.tagline || '' };

  let normalizedEvent = raw.event || null;
  if (normalizedEvent && Array.isArray(normalizedEvent.templates)) {
    normalizedEvent = {
      ...normalizedEvent,
      templates: normalizedEvent.templates.map((tpl: any) => {
        const rawDesign = tpl?.design || {};
        const assets = Array.isArray(tpl?.assets)
          ? tpl.assets.map((a: any) => ({
              ...a,
              url: resolveAssetUrl(a?.url, a?.assetId, origin) || a?.url,
            }))
          : [];
        const rawBg = rawDesign.background || (rawDesign as any).bg || {};
        let bgUrl = resolveAssetUrl(
          typeof rawBg === 'string' ? rawBg : rawBg?.url,
          typeof rawBg === 'object' ? rawBg?.assetId : null,
          origin
        );
        if (!bgUrl && (rawDesign as any).bg?.url) {
          bgUrl = resolveAssetUrl((rawDesign as any).bg.url, (rawDesign as any).bg.assetId, origin);
        }
        if (!bgUrl && assets.length > 0) {
          const bgAsset = assets.find((a: any) => a.role === 'background' || a.type === 'background');
          if (bgAsset?.url) bgUrl = bgAsset.url;
        }
        const background = bgUrl
          ? { ...(typeof rawBg === 'object' ? rawBg : {}), type: 'image' as const, url: bgUrl }
          : rawDesign.background;

        const rawDecs = Array.isArray(rawDesign.decorations) ? [...rawDesign.decorations] : [];
        for (const asset of assets) {
          if (!asset || asset.role === 'background' || asset.type === 'background') continue;
          if (asset.role === 'overlay' || asset.role === 'frame' || asset.type === 'overlay') {
            const exists = rawDecs.some((d: any) => (d.assetId && d.assetId === asset.assetId) || (d.url && d.url === asset.url));
            if (!exists && asset.url) {
              rawDecs.push({
                assetId: asset.assetId,
                url: asset.url,
                type: 'decoration',
                x: 0,
                y: 0,
                width: 1,
                height: 1,
                overlay: true,
              });
            }
          }
        }
        const decorations = rawDecs.map((dec: any) => {
          let decUrl = resolveAssetUrl(dec?.url, dec?.assetId, origin);
          if (!decUrl && dec?.assetId && assets.length > 0) {
            const matched = assets.find((a: any) => a.assetId === dec.assetId);
            if (matched?.url) decUrl = matched.url;
          }
          return {
            ...dec,
            ...(decUrl ? { url: decUrl } : {}),
          };
        });

        return {
          ...tpl,
          assets,
          design: {
            ...rawDesign,
            background,
            ...(bgUrl ? { bg: background } : {}),
            decorations,
          },
        };
      }),
    };
  }

  return {
    ...raw,
    event: normalizedEvent,
    device: { id: raw.device?.id, name: raw.device?.name, uuid: raw.device?.uuid ?? '' },
    organization: { id: raw.organization?.id, name: raw.organization?.name, branding },
    settings: {
      ...raw.settings,
      branding,
      galleryEnabled: raw.settings?.galleryEnabled ?? raw.gallery?.galleryEnabled ?? true,
      requireGuestConsent: raw.settings?.requireGuestConsent ?? raw.gallery?.requireGuestConsent ?? false,
    },
  };
}

const DEFAULT_QUOTE_TTL_MS = 10 * 60 * 1000;

export class HttpBoothApi implements BoothApi {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    const clean = baseUrl.replace(/\/+$/, '');
    this.baseUrl = clean.endsWith('/api') ? clean.slice(0, -4) : clean;
  }

  private async request<T>(path: string, init: RequestInit, installation?: Installation): Promise<T> {
    const fullUrl = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(installation ? { Authorization: `Device ${installation.deviceToken}`, 'X-Device-UUID': installation.deviceUuid } : {}),
      ...((init.headers as Record<string, string>) || {}),
    };

    const response = await fetch(fullUrl, {
      ...init,
      headers,
    });
    const payload = (await response.json().catch(() => null)) as { error?: string; code?: string; state?: string } | null;
    if (!response.ok) {
      throw new BoothApiError(
        payload?.error || `Backend request failed (${response.status}).`,
        response.status,
        payload?.code || payload?.state || null,
      );
    }
    return payload as T;
  }

  login(input: LoginInput) {
    return this.request<{ installation: Installation; snapshot: PartnerBoothSnapshot }>('/api/booth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => ({ ...r, snapshot: normalizeSnapshot(r.snapshot, this.baseUrl) }));
  }

  bootstrap(installation: Installation) {
    return this.request<PartnerBoothSnapshot>('/api/booth/bootstrap', { method: 'GET' }, installation).then((raw) =>
      normalizeSnapshot(raw, this.baseUrl)
    );
  }

  heartbeat(installation: Installation, input: HeartbeatInput) {
    return this.request<{
      changed: boolean;
      snapshot?: PartnerBoothSnapshot;
      state?: string;
      invalidateCache?: boolean;
      message?: string;
      canOperate?: boolean;
    }>(
      '/api/booth/heartbeat',
      { method: 'POST', body: JSON.stringify(input) },
      installation
    ).then((r) => ({
      changed: r.changed,
      snapshot: r.snapshot ? normalizeSnapshot(r.snapshot, this.baseUrl) : undefined,
      state: r.state,
      invalidateCache: r.invalidateCache,
      message: r.message,
      canOperate: r.canOperate,
    }));
  }

  quote(installation: Installation, input: QuoteInput) {
    return this.request<CheckoutQuote & { expiresAt?: string }>('/api/booth/checkout/quote', { method: 'POST', body: JSON.stringify(input) }, installation)
      .then((q): CheckoutQuote => ({ ...q, expiresAt: q.expiresAt ?? new Date(Date.now() + DEFAULT_QUOTE_TTL_MS).toISOString() }));
  }

  createPayment(installation: Installation, quote: CheckoutQuote) {
    return this.request<Omit<PaymentOrder, 'status'> & { status?: PaymentOrder['status'] }>('/api/booth/payments', { method: 'POST', body: JSON.stringify({ quote }) }, installation)
      .then((p): PaymentOrder => ({ ...p, status: p.status ?? 'pending' }));
  }

  async paymentStatus(installation: Installation, paymentId: string) {
    const result = await this.request<{ status: PaymentOrder['status'] }>(
      `/api/booth/payments/${encodeURIComponent(paymentId)}`,
      { method: 'GET' },
      installation
    );
    return result.status;
  }

  async confirmPayment(installation: Installation, paymentId: string, utr?: string) {
    const result = await this.request<{ ok: boolean; status: PaymentOrder['status'] }>(
      `/api/booth/payments/${encodeURIComponent(paymentId)}/confirm`,
      { method: 'POST', body: JSON.stringify({ utr: utr || '' }) },
      installation
    );
    return result.status;
  }

  async completeFree(installation: Installation, quote: CheckoutQuote) {
    await this.request('/api/booth/checkout/free-complete', { method: 'POST', body: JSON.stringify({ quote }) }, installation);
  }

  completeSession(installation: Installation, input: CompleteSessionInput) {
    return this.request<CompleteSessionResult>(
      '/api/booth/sessions/complete',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      installation
    );
  }

  getUploadUrls(installation: Installation, input: GetUploadUrlsInput) {
    return this.request<GetUploadUrlsResult>(
      '/api/booth/sessions/upload-urls',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      installation
    );
  }

  submitTicket(installation: Installation | null, input: SupportTicketInput) {
    return this.request<{ success: boolean; ticketId?: string }>(
      installation ? '/api/booth/support' : '/api/support',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      installation || undefined
    );
  }
}

/**
 * Uploads a binary image directly to S3 via pre-signed URL without base64 overhead.
 */
export async function uploadBinaryToS3(
  uploadUrl: string,
  dataUrlOrUri: string,
  contentType: string = 'image/jpeg'
): Promise<boolean> {
  try {
    let body: any = dataUrlOrUri;
    if (typeof dataUrlOrUri === 'string') {
      if (dataUrlOrUri.startsWith('data:')) {
        const comma = dataUrlOrUri.indexOf(',');
        if (comma !== -1) {
          try {
            const res = await fetch(dataUrlOrUri);
            body = await res.blob();
          } catch {
            // fallback
          }
        }
      } else if (dataUrlOrUri.startsWith('file://') || dataUrlOrUri.startsWith('/')) {
        try {
          const fileUri = dataUrlOrUri.startsWith('file://') ? dataUrlOrUri : `file://${dataUrlOrUri}`;
          const res = await fetch(fileUri);
          body = await res.blob();
        } catch {
          // fallback
        }
      }
    }

    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body,
    });
    return res.ok;
  } catch (err) {
    console.warn('[uploadBinaryToS3] Direct upload failed:', err);
    return false;
  }
}

// ── Environment Configuration & Active API instance ────────────────

function resolveInitialApiUrl(): string | null {
  try {
    if (typeof Config !== 'undefined') {
      const configUrl = Config.EXPO_PUBLIC_API_URL || Config.BOOTH_API_URL;
      if (configUrl && typeof configUrl === 'string' && configUrl.trim().length > 0) {
        return configUrl.trim();
      }
    }
  } catch {
    // ignore
  }

  try {
    if (typeof process !== 'undefined' && process.env) {
      const procUrl = process.env.EXPO_PUBLIC_API_URL || process.env.BOOTH_API_URL;
      if (procUrl && typeof procUrl === 'string' && procUrl.trim().length > 0) {
        return procUrl.trim();
      }
    }
  } catch {
    // ignore
  }

  return null;
}

let activeApiUrl: string | null = resolveInitialApiUrl();

export function configureBoothApi(baseUrl: string | null) {
  activeApiUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : null;
}

export function getBoothApi(): BoothApi {
  const url = activeApiUrl || 'http://localhost:5000';
  return new HttpBoothApi(url);
}

export const boothApi: BoothApi = {
  login: (input) => getBoothApi().login(input),
  bootstrap: (inst) => getBoothApi().bootstrap(inst),
  heartbeat: (inst, input) => getBoothApi().heartbeat(inst, input),
  quote: (inst, input) => getBoothApi().quote(inst, input),
  createPayment: (inst, q) => getBoothApi().createPayment(inst, q),
  paymentStatus: (inst, id) => getBoothApi().paymentStatus(inst, id),
  completeFree: (inst, q) => getBoothApi().completeFree(inst, q),
  confirmPayment: (inst, id, utr) => getBoothApi().confirmPayment(inst, id, utr),
  completeSession: (inst, inp) => getBoothApi().completeSession(inst, inp),
  getUploadUrls: (inst, inp) => getBoothApi().getUploadUrls(inst, inp),
  submitTicket: (inst, inp) => getBoothApi().submitTicket(inst, inp),
};

// ── Local Storage Interface & Memory Fallback ──────────────────────

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const memoryStore = new Map<string, string>();
let currentStorage: StorageAdapter = {
  getItem: async (key: string) => memoryStore.get(key) ?? null,
  setItem: async (key: string, value: string) => { memoryStore.set(key, value); },
  removeItem: async (key: string) => { memoryStore.delete(key); },
};

export function setStorageAdapter(adapter: StorageAdapter) {
  currentStorage = adapter;
}

const INSTALLATION_KEY = 'happypix_booth_installation_v2';
const SNAPSHOT_KEY = 'happypix_booth_snapshot_v2';
const DEVICE_PERSISTENT_UUID_KEY = 'happypix_booth_device_persistent_uuid_v2';

let memoryUuidCache: string | null = null;

/**
 * The booth's identity. Created once, then sent on every login so the server
 * matches the same device. Only clearDeviceIdentity() removes it, and the app
 * calls that only when the server reports the device was deleted in the CRM.
 */
export async function getPersistentDeviceUuid(): Promise<string> {
  if (memoryUuidCache && memoryUuidCache.trim().length > 8) {
    return memoryUuidCache.trim();
  }
  try {
    const existing = await currentStorage.getItem(DEVICE_PERSISTENT_UUID_KEY);
    if (existing && typeof existing === 'string' && existing.trim().length > 8) {
      memoryUuidCache = existing.trim();
      return memoryUuidCache;
    }
  } catch (err) {
    console.warn('[Storage] Failed to read persistent UUID from storage:', err);
  }
  // RFC4122 v4 UUID
  const newUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  memoryUuidCache = newUuid;
  try {
    await currentStorage.setItem(DEVICE_PERSISTENT_UUID_KEY, newUuid);
  } catch (err) {
    console.warn('[Storage] Failed to write persistent UUID to storage:', err);
  }
  return newUuid;
}

/** Forget the device identity. Called ONLY when the device is removed from the CRM. */
export async function clearDeviceIdentity(): Promise<void> {
  memoryUuidCache = null;
  await currentStorage.removeItem(DEVICE_PERSISTENT_UUID_KEY);
}

/** Drop the cached operating snapshot but keep the pairing (used for suspension). */
export async function clearCachedSnapshot(): Promise<void> {
  try {
    await currentStorage.removeItem(SNAPSHOT_KEY);
  } catch (err) {
    console.warn('[Storage] Failed to clear snapshot:', err);
  }
}

export async function saveInstallation(installation: Installation): Promise<void> {
  try {
    await currentStorage.setItem(INSTALLATION_KEY, JSON.stringify(installation));
  } catch (err) {
    console.warn('[Storage] Failed to save installation:', err);
  }
}

export async function getInstallation(): Promise<Installation | null> {
  try {
    const raw = await currentStorage.getItem(INSTALLATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearInstallation(): Promise<void> {
  try {
    await currentStorage.removeItem(INSTALLATION_KEY);
    await currentStorage.removeItem(SNAPSHOT_KEY);
  } catch (err) {
    console.warn('[Storage] Failed to clear installation:', err);
  }
}

export async function saveCachedSnapshot(snapshot: BoothSnapshot): Promise<void> {
  try {
    await currentStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[Storage] Failed to cache snapshot:', err);
  }
}

export async function getCachedSnapshot(): Promise<BoothSnapshot | null> {
  try {
    const raw = await currentStorage.getItem(SNAPSHOT_KEY);
    return raw ? normalizeSnapshot(JSON.parse(raw), activeApiUrl) : null;
  } catch {
    return null;
  }
}
