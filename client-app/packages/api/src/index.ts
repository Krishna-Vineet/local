// ─────────────────────────────────────────────────────────────────
//  API Client — connects to the existing Happypix server
//  Server: https://happypix-gzy6.vercel.app
//  All endpoints mirror the existing Express routes 1:1.
// ─────────────────────────────────────────────────────────────────

import type { ActiveEvent, GlobalSettings } from '../../types/src/index';

// ── Config ────────────────────────────────────────────────────────

let _baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000';
let _deviceToken = '';
let _authToken = '';

export function configureApi(baseUrl: string, deviceToken?: string, authToken?: string): void {
  _baseUrl = baseUrl.replace(/\/+$/, '');
  if (deviceToken) _deviceToken = deviceToken;
  if (authToken) _authToken = authToken;
}

export function setAuthToken(token: string): void {
  _authToken = token;
}

function getHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (_deviceToken) {
    headers['x-device-token'] = _deviceToken;
  }
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }
  return headers;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const fullUrl = `${_baseUrl}${path}`;
  console.log(`\n\n🚨 [DEBUG] HITTING API URL: ${fullUrl}\n\n`);

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      method,
      headers: getHeaders(headers),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error: any) {
    throw new Error(`[URL: ${fullUrl}] ${error.message}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} failed [${res.status}]: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Event API ─────────────────────────────────────────────────────

export const EventAPI = {
  /** Get single event by ID */
  getById: (eventId: string): Promise<ActiveEvent> =>
    request('GET', `/api/events/${eventId}`),

  /** Get list of events for the authenticated client/organization */
  listClientEvents: (): Promise<{ events: ActiveEvent[], total: number }> =>
    request('GET', '/api/events'),
};

// ── Settings API ──────────────────────────────────────────────────

export const SettingsAPI = {
  /** Fetch org-scoped (or event-scoped) public settings */
  getPublic: (eventId?: string): Promise<GlobalSettings> => {
    const qs = eventId ? `?eventId=${eventId}` : '';
    return request('GET', `/api/settings/public${qs}`);
  },
};

// ── Device API ────────────────────────────────────────────────────

export interface PingPayload {
  telemetry?: {
    prints: number;
    shutters: number;
    batteryPct: number;
  };
  connections?: {
    camera: boolean;
    printer: boolean;
    kioskScreen: boolean;
  };
}

export interface PingResponse {
  currentEventId: string | null;
  ok: boolean;
}

export interface CurrentEventResponse {
  event: ActiveEvent | null;
}

export interface BoothLoginPayload {
  orgId: string;
  password: string;
  deviceName?: string;
  location?: string;
}

export interface BoothLoginResponse {
  deviceToken: string;
  deviceId: string;
  deviceName: string;
  currentEventId: string | null;
}

export const DeviceAPI = {
  /** Login with Org Admin credentials to register the device */
  login: (payload: BoothLoginPayload): Promise<BoothLoginResponse> =>
    request('POST', '/api/devices/booth-login', payload),

  /** Heartbeat ping — sends hardware telemetry, receives any admin assignment */
  ping: (payload: PingPayload): Promise<PingResponse> =>
    request('POST', '/api/devices/ping', payload),

  /** Fetch the admin-assigned event for this device token */
  getCurrentEvent: (): Promise<CurrentEventResponse> =>
    request('GET', '/api/devices/current-event'),
};

// ── Upload API ────────────────────────────────────────────────────

export interface UploadResponse {
  url: string;       // S3 URL
  key: string;
}

export const UploadAPI = {
  /** Upload a captured photo to S3 via the server proxy */
  uploadPhoto: async (
    base64DataUri: string,
    eventId?: string,
    isComposite?: boolean,
    sessionId?: string,
  ): Promise<UploadResponse> => {
    
    // If it's a base64 data URI, send it directly as JSON to bypass React Native fetch blob restrictions
    if (base64DataUri.startsWith('data:')) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (_deviceToken) headers['x-device-token'] = _deviceToken;

      const uploadRes = await fetch(`${_baseUrl}/api/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          photoBase64: base64DataUri,
          eventId,
          isComposite: isComposite ? 'true' : 'false',
          sessionId,
        }),
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        throw new Error(`Upload failed [${uploadRes.status}]: ${text}`);
      }
      return uploadRes.json() as Promise<UploadResponse>;
    }

    // Fallback to standard FormData for other URI formats (e.g. file:// if used directly)
    const formData = new FormData();
    formData.append('photo', {
      uri: base64DataUri,
      name: `capture-${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);

    if (eventId) formData.append('eventId', eventId);
    if (isComposite) formData.append('isComposite', 'true');
    if (sessionId) formData.append('sessionId', sessionId);

    const headers: Record<string, string> = {};
    if (_deviceToken) headers['x-device-token'] = _deviceToken;
    // IMPORTANT: Do NOT set Content-Type to multipart/form-data manually, fetch will do it with the correct boundary!

    const uploadRes = await fetch(`${_baseUrl}/api/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`Upload failed [${uploadRes.status}]: ${text}`);
    }
    return uploadRes.json() as Promise<UploadResponse>;
  },

  /** Proxy logo image from private S3 to avoid CORS */
  proxyLogo: (logoUrl: string): string =>
    `${_baseUrl}/api/proxy/logo?url=${encodeURIComponent(logoUrl)}`,

  /** Generate a new photo share token for an event */
  generateShareToken: async (eventId: string, photoUrls?: string[], compositeUrl?: string): Promise<{ token: string, shareUrl: string, expiresAt: string }> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (_deviceToken) headers['x-device-token'] = _deviceToken;

    const res = await fetch(`${_baseUrl}/api/share/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ eventId, photoUrls, compositeUrl }),
    });

    if (!res.ok) throw new Error(`Generate share failed: ${await res.text()}`);
    return res.json();
  },

  /** Update an existing photo share token with uploaded media URLs */
  updateShareToken: async (token: string, data: { photoUrls?: string[], compositeUrl?: string }): Promise<any> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (_deviceToken) headers['x-device-token'] = _deviceToken;

    const res = await fetch(`${_baseUrl}/api/share/${token}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error(`Update share failed: ${await res.text()}`);
    return res.json();
  },
};

// ── Payment API ───────────────────────────────────────────────────

export interface CreateOrderPayload {
  amount: number;       // in paise
  eventId: string;
  printCount: number;
  digitalCopy: boolean;
  couponCode?: string;
}

export interface CreateOrderResponse {
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  key: string;           // Razorpay key_id for SDK
  paymentLinkUrl?: string; // For frictionless QR payment
  isImageUrl?: boolean;
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  compositeUrl?: string;
  photoUrls?: string[];
}

export interface VerifyPaymentResponse {
  success: boolean;
  qrToken?: string;
  qrUrl?: string;
  tokenExpiresAt?: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  status: 'pending' | 'paid' | 'failed';
}

export interface FreeCompletePayload {
  eventId: string;
  printCount: number;
  digitalCopy: boolean;
  compositeUrl?: string;
  photoUrls?: string[];
  amount?: number;
  couponCode?: string | null;
  discountApplied?: number;
  utr?: string;
}

export const PaymentAPI = {
  createOrder: (payload: CreateOrderPayload): Promise<CreateOrderResponse> =>
    request('POST', '/api/payments/create-order', payload),

  verify: (payload: VerifyPaymentPayload): Promise<VerifyPaymentResponse> =>
    request('POST', '/api/payments/verify', payload),

  checkStatus: (paymentId: string): Promise<PaymentStatusResponse> =>
    request('GET', `/api/payments/status/${paymentId}`),

  freeComplete: (payload: FreeCompletePayload): Promise<VerifyPaymentResponse> =>
    request('POST', '/api/payments/free-complete', payload),
};

// ── Coupon API ────────────────────────────────────────────────────

export interface CouponValidateResponse {
  valid: boolean;
  coupon?: {
    code: string;
    discountType: 'percentage' | 'fixed';
    value: number;
  };
  error?: string;
}

export const CouponAPI = {
  validate: (code: string, eventId: string): Promise<CouponValidateResponse> =>
    request('POST', '/api/coupons/public/validate', { code, eventId }),
};

// ── Auth API ──────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    organizationId: string | null;
  };
}

export const AuthAPI = {
  /** Login client/user credentials */
  login: (email: string, password: string): Promise<LoginResponse> =>
    request('POST', '/api/auth/login', { email, password }),
};

// ── Re-exports ────────────────────────────────────────────────────

export * from '../../types/src/index';
