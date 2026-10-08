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

export interface BoothApi {
  login(input: LoginInput): Promise<{ installation: Installation; snapshot: BoothSnapshot }>;
  bootstrap(installation: Installation): Promise<BoothSnapshot>;
  heartbeat(installation: Installation, input: HeartbeatInput): Promise<{ changed: boolean; snapshot?: BoothSnapshot }>;
  quote(installation: Installation, input: QuoteInput): Promise<CheckoutQuote>;
  createPayment(installation: Installation, quote: CheckoutQuote): Promise<PaymentOrder>;
  paymentStatus(installation: Installation, paymentId: string): Promise<PaymentOrder['status']>;
  completeFree(installation: Installation, quote: CheckoutQuote): Promise<void>;
  completeSession(installation: Installation, input: { sessionId: string; digitalCopy: boolean }): Promise<{ shareUrl: string | null }>;
}

const svgData = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const sunsetLogo = svgData(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 80"><rect width="220" height="80" rx="16" fill="#fff"/><circle cx="42" cy="40" r="22" fill="#ff4f9a"/><path d="M28 43h28M42 26v28" stroke="#fff" stroke-width="5" stroke-linecap="round"/><text x="76" y="49" font-family="Arial" font-size="23" font-weight="700" fill="#29143d">SUNSET</text></svg>'
);
const venueLogo = svgData(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 80"><rect width="180" height="80" rx="16" fill="#17101f"/><text x="90" y="36" text-anchor="middle" font-family="serif" font-size="18" fill="#e8c87c">THE GRAND</text><text x="90" y="57" text-anchor="middle" font-family="Arial" font-size="11" fill="#fff">NEW DELHI</text></svg>'
);

const makeSlots = (count: number, orientation: Orientation) => {
  const footer = 150;
  const width = orientation === 'portrait' ? 1000 : 1500;
  const height = orientation === 'portrait' ? 1500 : 1000;
  const usableHeight = height - footer - 80;
  const gap = 28;
  if (count === 1) return [{ id: 'slot-1', x: 50, y: 50, width: width - 100, height: usableHeight - 20 }];
  if (orientation === 'landscape' && count >= 2) {
    const cols = count === 2 ? 2 : 2;
    const rows = Math.ceil(count / cols);
    const slotWidth = (width - 100 - gap * (cols - 1)) / cols;
    const slotHeight = (usableHeight - gap * (rows - 1)) / rows;
    return Array.from({ length: count }, (_, index) => ({
      id: `slot-${index + 1}`,
      x: 50 + (index % cols) * (slotWidth + gap),
      y: 40 + Math.floor(index / cols) * (slotHeight + gap),
      width: slotWidth,
      height: slotHeight,
    }));
  }
  const slotHeight = (usableHeight - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) => ({
    id: `slot-${index + 1}`,
    x: 50,
    y: 40 + index * (slotHeight + gap),
    width: width - 100,
    height: slotHeight,
  }));
};

function buildTemplate(
  id: string,
  name: string,
  componentId: string | undefined,
  layoutId: string,
  familyId: string,
  printSize: string,
  orientation: Orientation,
  slots: number,
  colors: string[],
  ornament: BoothTemplate['design']['ornament'],
  source: BoothTemplate['source'] = 'designer'
): BoothTemplate {
  const canvas = orientation === 'portrait' ? { width: 1000, height: 1500 } : { width: 1500, height: 1000 };
  return {
    id,
    name,
    category: ornament === 'hearts' ? 'Wedding' : 'Celebration',
    description: `${printSize} ${slots}-photo ${orientation} design`,
    source,
    componentId,
    active: true,
    layout: {
      id: layoutId,
      familyId,
      label: `${printSize} · ${slots} photo${slots === 1 ? '' : 's'}`,
      printSize,
      sheetSize: printSize,
      orientation,
      slots,
      canvas,
      photoSlots: makeSlots(slots, orientation),
    },
    design: {
      background: { type: colors.length > 1 ? 'gradient' : 'solid', colors },
      accent: colors.at(-1) ?? '#ff4f9a',
      textColor: colors[0] === '#ffffff' ? '#251530' : '#ffffff',
      ornament,
      slotShape: ornament === 'bubbles' ? 'rounded' : 'square',
      title: 'Aarav & Meera',
      subtitle: 'Made with love',
    },
  };
}

export const demoTemplates: BoothTemplate[] = [
  buildTemplate('tpl-royal-57', 'Royal Wedding', 'RoyalWedding', '57-v3', '57', '5 × 7', 'portrait', 3, ['#160f24', '#5a254e'], 'hearts'),
  buildTemplate('tpl-classic-46', 'Classic White', 'ClassicWhite', '46-v2', '46', '4 × 6', 'portrait', 2, ['#ffffff', '#f6eaf2'], 'none'),
  buildTemplate('tpl-blush-46', 'Blush Bloom', 'BlushBloom', '46-v4', '46', '4 × 6', 'portrait', 4, ['#ffedf5', '#dd5b91'], 'bubbles'),
  buildTemplate('tpl-midnight-46', 'Midnight Reel', 'MidnightReel', '46-h2', '46', '4 × 6', 'landscape', 2, ['#090713', '#3e2b70'], 'stars'),
  buildTemplate('tpl-party-68', 'Party Pop', 'PartyPop', '68-h4', '68', '6 × 8', 'landscape', 4, ['#3420a8', '#ff4f9a'], 'confetti'),
  buildTemplate('tpl-ai-garden', 'Enchanted Garden', undefined, '57-v1', '57', '5 × 7', 'portrait', 1, ['#14362f', '#74ad83'], 'bubbles', 'ai_generated'),
];

export const demoEvent: BoothEvent = {
  id: 'evt-sunset-live',
  organizationId: 'org-sunset',
  name: 'Aarav & Meera — Wedding Reception',
  clientName: 'Aarav & Meera',
  location: 'The Grand Ballroom, New Delhi',
  startDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  endDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  status: 'live',
  digitalCopy: true,
  filters: ['original', 'warm', 'cool', 'bw', 'vintage', 'soft', 'party'],
  branding: { logos: [sunsetLogo, venueLogo], tagline: 'Together is a beautiful place to be' },
  layoutPrices: { '57:3': 120, '46:2': 80, '46:4': 100, '46:1': 70, '68:4': 160, '57:1': 110 },
  templates: demoTemplates,
  revision: 'demo-revision-9',
  templateContractVersion: 1,
};

export const demoSettings: BoothSettings = {
  organizationName: 'Sunset Weddings',
  boothTimeoutSec: 90,
  payoutMode: 'wallet',
  upiId: null,
  paymentDisplayName: 'HappyPix · Sunset Weddings',
  currency: 'INR',
  maximumPrints: 10,
};

function demoSnapshot(deviceUuid: string, withEvent = true): BoothSnapshot {
  return {
    device: { id: 'dev-tablet-01', name: 'Booth Tablet 01', uuid: deviceUuid },
    organization: { id: 'org-sunset', name: 'Sunset Weddings' },
    event: withEvent ? demoEvent : null,
    settings: demoSettings,
    revision: demoEvent.revision,
    serverTime: new Date().toISOString(),
  };
}

const paymentCreatedAt = new Map<string, number>();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const demoBoothApi: BoothApi = {
  async login(input) {
    await delay(500);
    if (!input.email.includes('@') || input.password.length < 6) {
      throw new Error('Enter a valid email and password.');
    }
    if (input.email.toLowerCase() !== 'booth@happypix.in' || input.password !== 'demo123') {
      throw new Error('Login failed. Use booth@happypix.in / demo123 for demo, or connect to live server.');
    }
    const installation: Installation = {
      deviceUuid: input.deviceUuid,
      deviceToken: `demo-device-${input.deviceUuid}`,
      deviceId: 'dev-sunset-tablet',
      organizationId: 'org-sunset',
      pairedAt: new Date().toISOString(),
      locationLabel: input.location.label,
    };
    return { installation, snapshot: demoSnapshot(input.deviceUuid, true) };
  },

  async bootstrap(installation) {
    await delay(400);
    if (!installation.deviceToken) throw new Error('Stored device credentials are not valid.');
    return demoSnapshot(installation.deviceUuid, true);
  },

  async heartbeat() {
    await delay(150);
    return { changed: false };
  },

  async quote(_installation, input) {
    await delay(350);
    const selected = demoEvent.templates.find((item: BoothTemplate) => item.id === input.templateId);
    if (!selected) throw new Error('This template is no longer available for the event.');
    const priceKey = `${selected.layout.familyId}:${selected.layout.slots}`;
    const unitPrice = demoEvent.layoutPrices[priceKey] ?? 100;
    const gross = unitPrice * input.prints;
    const code = input.couponCode?.trim().toUpperCase() || null;
    let discount = 0;
    let couponMessage: string | null = null;
    if (code === 'PIX20') {
      discount = Math.round(gross * 0.2);
      couponMessage = 'PIX20 applied · 20% off';
    } else if (code === 'FREEPIX') {
      discount = gross;
      couponMessage = 'FREEPIX applied · your order is free';
    } else if (code) {
      throw new Error('That coupon is invalid, expired, or exhausted.');
    }
    return {
      quoteId: `quote-${Date.now()}`,
      unitPrice,
      prints: input.prints,
      gross,
      discount,
      finalAmount: Math.max(0, gross - discount),
      couponCode: code,
      couponMessage,
      settlement: demoSettings.payoutMode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  },

  async createPayment(_installation, quote) {
    await delay(450);
    if (quote.finalAmount <= 0) throw new Error('Free checkouts must use the free completion endpoint.');
    const paymentId = `pay-${Date.now()}`;
    paymentCreatedAt.set(paymentId, Date.now());
    return {
      paymentId,
      amount: quote.finalAmount,
      qrPayload: `upi://pay?pa=happypix@upi&pn=${encodeURIComponent(demoSettings.paymentDisplayName)}&am=${quote.finalAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(paymentId)}`,
      status: 'pending',
    };
  },

  async paymentStatus(_installation, paymentId) {
    await delay(150);
    const created = paymentCreatedAt.get(paymentId);
    if (!created) return 'failed';
    // Auto-complete payment in demo mode after 6.5s
    return Date.now() - created > 6500 ? 'paid' : 'pending';
  },

  async completeFree() {
    await delay(300);
  },

  async completeSession(_installation, input) {
    await delay(400);
    return {
      shareUrl: input.digitalCopy ? `https://happypix.in/share/${encodeURIComponent(input.sessionId)}` : null,
    };
  },
};

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
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      throw new Error(payload?.error || `Backend request failed (${response.status}).`);
    }
    return payload as T;
  }

  login(input: LoginInput) {
    return this.request<{ installation: Installation; snapshot: BoothSnapshot }>('/api/booth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  bootstrap(installation: Installation) {
    return this.request<BoothSnapshot>('/api/booth/bootstrap', { method: 'GET' }, installation);
  }

  heartbeat(installation: Installation, input: HeartbeatInput) {
    return this.request<{ changed: boolean; snapshot?: BoothSnapshot }>(
      '/api/booth/heartbeat',
      { method: 'POST', body: JSON.stringify(input) },
      installation
    );
  }

  quote(installation: Installation, input: QuoteInput) {
    return this.request<CheckoutQuote>('/api/booth/checkout/quote', { method: 'POST', body: JSON.stringify(input) }, installation);
  }

  createPayment(installation: Installation, quote: CheckoutQuote) {
    return this.request<PaymentOrder>('/api/booth/payments', { method: 'POST', body: JSON.stringify({ quote }) }, installation);
  }

  async paymentStatus(installation: Installation, paymentId: string) {
    const result = await this.request<{ status: PaymentOrder['status'] }>(
      `/api/booth/payments/${encodeURIComponent(paymentId)}`,
      { method: 'GET' },
      installation
    );
    return result.status;
  }

  async completeFree(installation: Installation, quote: CheckoutQuote) {
    await this.request('/api/booth/checkout/free-complete', { method: 'POST', body: JSON.stringify({ quote }) }, installation);
  }

  completeSession(installation: Installation, input: { sessionId: string; digitalCopy: boolean }) {
    return this.request<{ shareUrl: string | null }>(
      '/api/booth/sessions/complete',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      installation
    );
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
  if (activeApiUrl) {
    return new HttpBoothApi(activeApiUrl);
  }
  return demoBoothApi;
}

export const boothApi: BoothApi = {
  login: (input) => getBoothApi().login(input),
  bootstrap: (inst) => getBoothApi().bootstrap(inst),
  heartbeat: (inst, input) => getBoothApi().heartbeat(inst, input),
  quote: (inst, input) => getBoothApi().quote(inst, input),
  createPayment: (inst, q) => getBoothApi().createPayment(inst, q),
  paymentStatus: (inst, id) => getBoothApi().paymentStatus(inst, id),
  completeFree: (inst, q) => getBoothApi().completeFree(inst, q),
  completeSession: (inst, inp) => getBoothApi().completeSession(inst, inp),
};

export const isDemoMode = (): boolean => !activeApiUrl;

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
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
