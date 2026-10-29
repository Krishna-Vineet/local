// ─────────────────────────────────────────────────────────────────
//  Happypix Booth — BoothProvider
//  Manages kiosk pairing, session state, payment, and background sync
// ─────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Dimensions, Platform } from 'react-native';
import {
  boothApi,
  normalizeSnapshot,
  getInstallation,
  saveInstallation,
  clearInstallation,
  getCachedSnapshot,
  clearCachedSnapshot,
  saveCachedSnapshot,
  getPersistentDeviceUuid,
  clearDeviceIdentity,
  isBoothApiError,
  type BoothEvent,
  type BoothSession,
  type BoothSnapshot,
  type CheckoutQuote,
  type Customization,
  type Installation,
  type PaymentOrder,
  type PrintOutcome,
  type ScreenId,
  uploadBinaryToS3,
} from '@happypix/api';
import {
  placeSlot,
  resolvePhotoSlots,
  resolveSlotCanvas,
} from '../../../../packages/ui/src/utils/photoSlots';
import { buildPrintSpec, STICKER_EM_FRACTION } from '../../../../packages/ui/src/utils/printSpec';
import { cameraManager } from '../../../../packages/camera-core/src/index';
import { printerManager, renderEngine, SkiaRenderAdapter } from '../../../../packages/printer-core/src/index';
import type { PrintTemplate } from '../../../../packages/types/src/index';
import { photosAsDataUrls } from '../storage/deviceStorage';
import { enqueueOfflineSession, processOfflineSyncQueue } from '../services/offlineSyncService';

// ─── Final-print rendering ─────────────────────────────────────
// The composite strip/page is rendered ONCE, then (a) printed and
// (b) sent to the backend as the session's final image — the org
// gallery and guest download lead with it. Before this, sessions
// completed with raw frames only, so galleries never showed the
// actual print. (Same flow as the Electron booth.)
let renderAdapterReady = false;

const PAPER_SIZE_KEYS: Record<string, PrintTemplate['paperSize']> = {
  '4x6': '4x6', '4 × 6': '4x6', '5x7': '5x7', '5 × 7': '5x7',
  '6x8': '6x8', '6 × 8': '6x8', '2x6': '2x6_strip', '2 × 6': '2x6_strip',
};

export function boothTemplateToPrintTemplate(template: NonNullable<BoothSession['template']>): PrintTemplate {
  const { layout } = template;
  const paperSize = PAPER_SIZE_KEYS[layout.printSize] || PAPER_SIZE_KEYS[layout.sheetSize || ''] || '4x6';
  // Layout slots live in layout-canvas coordinates; the render engine
  // draws in 300dpi paper pixels — scale between the two spaces.
  const PAPER: Record<string, { width: number; height: number }> = {
    '4x6': { width: 1800, height: 1200 }, '5x7': { width: 2100, height: 1500 },
    '6x8': { width: 2400, height: 1800 }, '2x6_strip': { width: 1800, height: 600 },
  };
  let dims = PAPER[paperSize] || PAPER['4x6'];
  if (layout.orientation === 'portrait' && dims.height < dims.width) dims = { width: dims.height, height: dims.width };
  if (layout.orientation === 'landscape' && dims.width < dims.height) dims = { width: dims.height, height: dims.width };
  const canvas = resolveSlotCanvas(template as any);
  // Shared resolver: the preview and this print pass draw the same slots, and
  // `placeSlot` is the same mapping the preview uses — so a photo cannot land in
  // one slot on screen and a different one on paper.
  const rawSlots = resolvePhotoSlots(template as any);
  return {
    id: template.id,
    name: template.name,
    paperSize,
    orientation: layout.orientation,
    frames: layout.slots,
    dpi: 300,
    slots: rawSlots.map((slot) => placeSlot(slot, canvas, dims)),
  };
}

function formatFriendlyPrintError(rawError?: string | null): string {
  const msg = String(rawError || '').trim();
  if (!msg) {
    return 'The printer is currently unavailable. Please ask the booth attendant to check the printer and tap Retry Print.';
  }
  const lower = msg.toLowerCase();
  if (
    lower.includes('no printer connected') ||
    lower.includes('printermanager') ||
    lower.includes('connect()') ||
    lower.includes('not connected')
  ) {
    return 'No printer is connected right now. Your digital photos are safe — please ask the booth attendant to connect the printer and tap Retry Print.';
  }
  if (lower.includes('out of paper') || lower.includes('paper')) {
    return 'The printer is out of paper. Please ask the booth attendant to reload paper and tap Retry Print.';
  }
  if (lower.includes('offline') || lower.includes('timeout') || lower.includes('unreachable')) {
    return 'Could not reach the printer. Please check that the printer is switched on and connected, then tap Retry Print.';
  }
  return msg;
}

/**
 * Renders the final composite — the bitmap that is printed *and* uploaded.
 *
 * It is drawn from `buildPrintSpec`, the same description the customise and
 * selection screens render as a preview, so every customisation the guest made
 * (filter, text, logo, stickers) is present in the bitmap by construction
 * rather than by a second implementation agreeing with the first.
 */
async function renderSessionComposite(session: BoothSession): Promise<string | undefined> {
  if (!session.template) return undefined;
  if (!renderAdapterReady) {
    renderEngine.setAdapter(new SkiaRenderAdapter());
    renderAdapterReady = true;
  }
  const printTemplate = boothTemplateToPrintTemplate(session.template);
  const spec = buildPrintSpec({
    template: session.template,
    customization: session.customization,
  });

  const output = await renderEngine.compose({
    template: printTemplate,
    photos: (session.selectedPhotos || []) as any,
    spec,
  });
  return output.bitmap;
}

export const defaultCustomization = (): Customization => ({
  ornament: 'none',
  filter: 'original',
  logo: null,
  title: '',
  subtitle: '',
  stickers: [],
});

export const freshSession = (): BoothSession => ({
  id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  startedAt: new Date().toISOString(),
  orientation: null,
  template: null,
  prints: 1,
  digitalCopy: true,
  quote: null,
  payment: null,
  photos: [],
  selectedPhotos: [],
  customization: defaultCustomization(),
});

interface BoothContextValue {
  installation: Installation | null;
  snapshot: BoothSnapshot | null;
  session: BoothSession;
  outcome: PrintOutcome | null;
  online: boolean;
  secondsLeft: number;
  bootReady: boolean;
  bootError: string | null;
  setSession: React.Dispatch<React.SetStateAction<BoothSession>>;
  updateSession: (patch: Partial<BoothSession>) => void;
  resetIdleTimer: () => void;
  setIdleTimerEnabled: (enabled: boolean) => void;
  resetGuestSession: (navigation?: any) => void;
  login: (values: { email: string; password: string; locationLabel: string }) => Promise<{ isLive: boolean }>;
  logout: () => Promise<void>;
  refreshEvent: () => Promise<void>;
  requestQuote: (coupon?: string) => Promise<CheckoutQuote>;
  createPayment: (quote: CheckoutQuote) => Promise<PaymentOrder>;
  paymentStatus: (paymentId: string) => Promise<PaymentOrder['status']>;
  confirmPayment: (paymentId: string, utr?: string) => Promise<PaymentOrder['status']>;
  completeFree: (quote: CheckoutQuote) => Promise<void>;
  finishAndPrint: (patch?: Partial<BoothSession>) => Promise<PrintOutcome>;
  retryPrint: () => Promise<void>;
  retryShare: () => Promise<void>;
  retrying: 'print' | 'share' | null;
}

// Heartbeat cadence: unassigns, event changes and device removal must reach the booth within ~20s.
const HEARTBEAT_INTERVAL_MS = 20 * 1000;
const BOOTH_STATE_SUSPENDED = 'SUSPENDED';

const BoothContext = createContext<BoothContextValue | null>(null);

export const BoothProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [snapshot, setSnapshot] = useState<BoothSnapshot | null>(null);
  const [session, setSession] = useState<BoothSession>(freshSession);
  const [outcome, setOutcome] = useState<PrintOutcome | null>(null);
  const [online, setOnline] = useState(true);
  const [bootReady, setBootReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  // Idle Timer
  const [idleEnabled, setIdleEnabled] = useState(false);
  const timeoutSec = snapshot?.settings?.boothTimeoutSec ?? 90;
  const [secondsLeft, setSecondsLeft] = useState(timeoutSec);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const installationRef = useRef<Installation | null>(null);
  const snapshotRef = useRef<BoothSnapshot | null>(null);
  const sessionRef = useRef<BoothSession>(session);
  sessionRef.current = session;

  const applySnapshot = useCallback((val: BoothSnapshot) => {
    const normalized = normalizeSnapshot(val as any);
    snapshotRef.current = normalized;
    setSnapshot(normalized);
    void saveCachedSnapshot(normalized);

    const currentTplId = sessionRef.current?.template?.id;
    if (currentTplId && Array.isArray(normalized.event?.templates)) {
      const updatedTpl = normalized.event.templates.find((t) => t.id === currentTplId);
      if (updatedTpl) {
        setSession((prev) => {
          if (prev.template?.id !== currentTplId) return prev;
          const next = { ...prev, template: updatedTpl };
          sessionRef.current = next;
          return next;
        });
      }
    }
  }, []);

  // The server told us this booth may no longer operate. Decide what to forget:
  //  - DEVICE_DELETED: removed in the CRM. Forget the identity too (the only path that does).
  //  - BANNED / DEVICE_BLOCKED / 401: the pairing is no longer valid. Forget the session.
  //  - SUSPENDED: keep the pairing, drop the operating snapshot until the org is restored.
  const applyRevocation = useCallback(async (code: string | null, status: number, message: string) => {
    const isRevoked = status === 401 || status === 403 || status === 410;
    if (!isRevoked) return;
    const normalizedCode = String(code || '').toLowerCase();
    if (normalizedCode === 'suspended' || normalizedCode === BOOTH_STATE_SUSPENDED.toLowerCase()) {
      await clearCachedSnapshot();
      snapshotRef.current = null;
      setSnapshot(null);
      setSession(freshSession());
      setBootError(message);
      return;
    }
    if (normalizedCode === 'device_deleted' || status === 410) {
      await clearDeviceIdentity();
      setBootError('This booth was removed from HappyPix. Pair it again to continue.');
    } else {
      setBootError(message || 'This booth is no longer paired. Please log in again.');
    }
    await clearInstallation();
    installationRef.current = null;
    setInstallation(null);
    snapshotRef.current = null;
    setSnapshot(null);
    setSession(freshSession());
    setOnline(false);
  }, []);

  // ── 1. Boot sequence ─────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const cached = await getCachedSnapshot();
        if (cached && active) {
          const normalizedCached = normalizeSnapshot(cached as any);
          setSnapshot(normalizedCached);
          snapshotRef.current = normalizedCached;
        }

        const saved = await getInstallation();
        if (!active) return;
        if (!saved) {
          setBootReady(true);
          return;
        }

        installationRef.current = saved;
        setInstallation(saved);

        // Try to bootstrap
        try {
          const fresh = await boothApi.bootstrap(saved);
          if (!active) return;
          applySnapshot(fresh);
          setOnline(true);
        } catch (e: unknown) {
          if (isBoothApiError(e) && [401, 403, 410].includes(e.status)) {
            await applyRevocation(e.code, e.status, e.message);
          } else {
            // Offline or server error: keep running from the cached snapshot.
            setOnline(false);
          }
        }
      } catch (err: any) {
        setBootError(err.message || 'Boot failed');
      } finally {
        if (active) setBootReady(true);
      }
    }

    boot();
    return () => {
      active = false;
    };
  }, [applySnapshot, applyRevocation]);

  // ── 2. Heartbeat every 20 seconds ────────────────────────────────
  // Unassigns, event changes, logout-from-CRM and device removal must reach the
  // booth within one heartbeat, so this interval is short on purpose.
  useEffect(() => {
    if (!installation) return;

    const heartbeat = async () => {
      try {
        const current = snapshotRef.current;
        const dim = Dimensions.get('window');
        const camStatus = await cameraManager.getStatus().catch(() => ({ connected: false, error: 'Unavailable' }));
        const printerStatus = await printerManager.getStatus().catch(() => ({ connected: false, error: 'Unavailable' }));

        const response = await boothApi.heartbeat(installation, {
          deviceUuid: installation.deviceUuid,
          eventId: current?.event?.id ?? null,
          knownRevision: current?.revision ?? null,
          clientDateTime: new Date().toISOString(),
          hardware: {
            capturedAt: new Date().toISOString(),
            platform: Platform.OS,
            release: String(Platform.Version),
            camera: {
              connected: camStatus.connected,
              working: camStatus.connected,
              provider: 'native-vision',
              model: null,
              shutterCount: 0,
              batteryPct: (camStatus as any).batteryLevel ?? null,
              error: camStatus.error ?? null,
            },
            printer: {
              connected: printerStatus.connected,
              working: printerStatus.connected,
              provider: 'native-printer',
              model: 'Thermal/DNP',
              printsTotal: 0,
              queueDepth: 0,
              error: printerStatus.error ?? null,
            },
            kioskScreen: {
              connected: true,
              external: false,
              displayCount: 1,
              width: Math.round(dim.width),
              height: Math.round(dim.height),
              scaleFactor: 1,
              error: null,
            },
          },
        });

        setOnline(true);
        // Silently sync any queued offline sessions in the background
        processOfflineSyncQueue(installation).catch(() => {});
        if (response.invalidateCache && !response.snapshot) {
          await clearCachedSnapshot();
          snapshotRef.current = null;
          setSnapshot(null);
          setSession(freshSession());
          if (response.message) {
            setBootError(response.message);
          }
        }
        if (response.state && response.state.toLowerCase() === 'suspended') {
          await clearCachedSnapshot();
          snapshotRef.current = null;
          setSnapshot(null);
          setSession(freshSession());
          setBootError(response.message || 'This organization is suspended. The booth is locked.');
        }
        if (response.changed && response.snapshot) {
          const prevEventId = snapshotRef.current?.event?.id;
          const newEventId = response.snapshot.event?.id;
          const prevStatus = snapshotRef.current?.event?.status;
          const newStatus = response.snapshot.event?.status;
          const eventUnassignedOrChanged =
            prevEventId !== newEventId ||
            !response.snapshot.event ||
            (prevStatus === 'live' && newStatus !== 'live');

          applySnapshot(response.snapshot);
          if (eventUnassignedOrChanged) {
            setSession(freshSession());
          }
        }
      } catch (err: unknown) {
        if (isBoothApiError(err) && [401, 403, 410].includes(err.status)) {
          await applyRevocation(err.code, err.status, err.message);
        } else {
          setOnline(false);
        }
      }
    };

    const first = setTimeout(heartbeat, 2000);
    const interval = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [installation, applySnapshot, applyRevocation]);

  // ── 3. Idle Timer ────────────────────────────────────────────────
  const resetIdleTimer = useCallback(() => {
    setSecondsLeft(snapshot?.settings?.boothTimeoutSec ?? 90);
  }, [snapshot?.settings?.boothTimeoutSec]);

  const updateSession = useCallback((patch: Partial<BoothSession>) => {
    setSession((prev) => {
      const next = { ...prev, ...patch };
      sessionRef.current = next;
      return next;
    });
    resetIdleTimer();
  }, [resetIdleTimer]);

  const resetGuestSession = useCallback((navigation?: any) => {
    const fresh = freshSession();
    sessionRef.current = fresh;
    setSession(fresh);
    setOutcome(null);
    resetIdleTimer();
    if (navigation) {
      const targetScreen = snapshotRef.current?.event?.status === 'live' ? 'Start' : 'Waiting';
      if (typeof navigation.reset === 'function') {
        navigation.reset({
          index: 0,
          routes: [{ name: targetScreen }],
        });
      } else if (typeof navigation.replace === 'function') {
        navigation.replace(targetScreen);
      }
    }
  }, [resetIdleTimer]);

  useEffect(() => {
    if (!idleEnabled) {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      return;
    }

    idleTimerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, [idleEnabled]);

  // ── 4. Login Action ──────────────────────────────────────────────
  const login = async (values: { email: string; password: string; locationLabel: string }): Promise<{ isLive: boolean }> => {
    const dim = Dimensions.get('window');
    const deviceUuid = await getPersistentDeviceUuid();
    const deviceName = values.locationLabel ? `Booth — ${values.locationLabel}` : `HappyPix Tablet (${Platform.OS})`;

    const result = await boothApi.login({
      email: values.email,
      password: values.password,
      deviceUuid,
      deviceName,
      clientDateTime: new Date().toISOString(),
      location: { label: values.locationLabel },
      platform: Platform.OS,
      appVersion: '1.0.0',
      display: {
        width: Math.round(dim.width),
        height: Math.round(dim.height),
        scaleFactor: 1,
        external: false,
      },
    });

    await saveInstallation(result.installation);
    installationRef.current = result.installation;
    setInstallation(result.installation);
    setBootError(null);
    setOnline(true);
    applySnapshot(result.snapshot);

    return { isLive: result.snapshot.event?.status === 'live' };
  };

  const logout = async () => {
    // Logout forgets the session (token, snapshot). It never removes the device identity.
    await clearInstallation();
    installationRef.current = null;
    setInstallation(null);
    setSnapshot(null);
    snapshotRef.current = null;
    const fresh = freshSession();
    sessionRef.current = fresh;
    setSession(fresh);
  };

  const refreshEvent = useCallback(async () => {
    if (!installationRef.current) return;
    try {
      const value = await boothApi.bootstrap(installationRef.current);
      setOnline(true);
      applySnapshot(value);
    } catch (err: unknown) {
      if (isBoothApiError(err) && [401, 403, 410].includes(err.status)) {
        await applyRevocation(err.code, err.status, err.message);
      } else {
        setOnline(false);
      }
    }
  }, [applySnapshot, applyRevocation]);

  // ── 5. Payment & Session Flow Helpers ────────────────────────────
  const requestQuote = useCallback(async (coupon?: string): Promise<CheckoutQuote> => {
    const inst = installationRef.current;
    const snap = snapshotRef.current;
    if (!inst || !snap?.event || !session.template) {
      throw new Error('The event or template is no longer available.');
    }

    return boothApi.quote(inst, {
      eventId: snap.event.id,
      templateId: session.template.id,
      layoutId: session.template.layout.id,
      prints: session.prints,
      digitalCopy: session.digitalCopy,
      couponCode: coupon,
    });
  }, [session.template, session.prints, session.digitalCopy]);

  const createPayment = useCallback(async (quote: CheckoutQuote) => {
    const inst = installationRef.current;
    if (!inst) throw new Error('This booth is not paired.');
    return boothApi.createPayment(inst, quote);
  }, []);

  const paymentStatus = useCallback(async (paymentId: string) => {
    const inst = installationRef.current;
    if (!inst) return 'failed' as const;
    return boothApi.paymentStatus(inst, paymentId);
  }, []);

  const confirmPayment = useCallback(async (paymentId: string, utr?: string) => {
    const inst = installationRef.current;
    if (!inst) return 'failed' as const;
    return boothApi.confirmPayment(inst, paymentId, utr);
  }, []);

  const completeFree = useCallback(async (quote: CheckoutQuote) => {
    const inst = installationRef.current;
    if (!inst) throw new Error('This booth is not paired.');
    return boothApi.completeFree(inst, quote);
  }, []);

  const withStepTimeout = <T,>(promise: Promise<T>, ms: number, msg: string): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(msg)), ms);
        promise.then(
          (val) => {
            clearTimeout(timer);
            resolve(val);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
      });

  /**
   * High-speed direct S3 upload with automatic fallback to base64 JSON payload.
   */
  const uploadBoothSession = async (
    inst: Installation,
    currentSession: BoothSession,
    compositeUrl?: string,
    eventId?: string,
    effectiveConsent?: boolean
  ): Promise<string | null> => {
    const selectedPhotos = (currentSession.selectedPhotos || []).map((p) => p.uri).filter(Boolean);

    // Strategy 1: Direct Pre-signed S3 Binary Upload (Fast, ~1 second, bypasses JSON payload limits)
    try {
      const fileDescriptors: Array<{ type: 'composite' | 'frame'; index?: number; contentType?: string }> = [];
      if (compositeUrl) {
        fileDescriptors.push({ type: 'composite', contentType: 'image/jpeg' });
      }
      selectedPhotos.forEach((_, idx) => {
        fileDescriptors.push({ type: 'frame', index: idx, contentType: 'image/jpeg' });
      });

      if (fileDescriptors.length > 0) {
        const presignedInfo = await withStepTimeout(
          boothApi.getUploadUrls(inst, {
            sessionId: currentSession.id,
            eventId,
            files: fileDescriptors,
          }),
          5000,
          'Requesting upload URLs timed out'
        ).catch(() => null);

        if (presignedInfo?.s3Configured && Array.isArray(presignedInfo.urls) && presignedInfo.urls.length > 0) {
          const uploadPromises: Promise<boolean>[] = [];
          const uploadedPhotos: Array<{ url: string; key: string; type: string; isComposite?: boolean }> = [];
          let uploadedComposite: { url: string; key: string } | null = null;

          for (const item of presignedInfo.urls) {
            if (item.type === 'composite' && compositeUrl) {
              uploadPromises.push(uploadBinaryToS3(item.uploadUrl, compositeUrl, item.contentType));
              uploadedComposite = { url: item.publicUrl, key: item.key };
            } else if (item.type === 'frame' && typeof item.index === 'number') {
              const rawUri = selectedPhotos[item.index];
              if (rawUri) {
                uploadPromises.push(uploadBinaryToS3(item.uploadUrl, rawUri, item.contentType));
                uploadedPhotos.push({
                  url: item.publicUrl,
                  key: item.key,
                  type: 'frame',
                });
              }
            }
          }

          const uploadResults = await Promise.all(uploadPromises);
          const allSucceeded = uploadResults.length > 0 && uploadResults.every(Boolean);

          if (allSucceeded) {
            const completed = await withStepTimeout(
              boothApi.completeSession(inst, {
                sessionId: currentSession.id,
                digitalCopy: currentSession.digitalCopy !== false,
                guestConsent: effectiveConsent,
                photos: uploadedPhotos,
                composite: uploadedComposite || undefined,
                compositeUrl: uploadedComposite?.url || undefined,
                eventId,
              }),
              15000,
              'Finalizing session timed out'
            );
            return completed.shareUrl;
          }
        }
      }
    } catch (s3Err) {
      console.warn('[uploadBoothSession] S3 direct upload fallback to standard upload:', s3Err);
    }

    // Strategy 2: Standard Base64 JSON Payload (Local server or network fallback)
    const encodedPhotos = await withStepTimeout(
      photosAsDataUrls(selectedPhotos),
      15000,
      'Encoding photos timed out'
    ).catch(() => [] as string[]);

    const primaryPhotos = encodedPhotos.length > 0 ? encodedPhotos : (compositeUrl ? [compositeUrl] : []);
    try {
      const completed = await withStepTimeout(
        boothApi.completeSession(inst, {
          sessionId: currentSession.id,
          digitalCopy: currentSession.digitalCopy !== false,
          guestConsent: effectiveConsent,
          photos: primaryPhotos,
          compositeUrl,
          eventId,
        }),
        25000,
        'Uploading session timed out'
      );
      return completed.shareUrl;
    } catch (firstErr) {
      if (compositeUrl) {
        const fallbackCompleted = await withStepTimeout(
          boothApi.completeSession(inst, {
            sessionId: currentSession.id,
            digitalCopy: currentSession.digitalCopy !== false,
            guestConsent: effectiveConsent,
            photos: [compositeUrl],
            compositeUrl,
            eventId,
          }),
          20000,
          'Uploading composite timed out'
        );
        return fallbackCompleted.shareUrl;
      }
      throw firstErr;
    }
  };

  const resolveDownloadWebsiteBase = (snapshotUrl?: string): string => {
    if (snapshotUrl && typeof snapshotUrl === 'string' && snapshotUrl.trim().length > 0) {
      return snapshotUrl.trim().replace(/\/+$/, '');
    }
    const fromEnv = process.env.EXPO_PUBLIC_WEBSITE_URL;
    if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
      return fromEnv.trim().replace(/\/+$/, '');
    }
    return 'https://happypix.vercel.app';
  };

  const finishAndPrint = useCallback(async (patch?: Partial<BoothSession>): Promise<PrintOutcome> => {
    setIdleEnabled(false);
    if (idleTimerRef.current) {
      clearInterval(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    // Session state at the moment Finish was tapped. `patch` carries anything the
    // screen changed in the same tick as the press (consent, last filter) — React
    // has not committed that state yet, and the print must not use the old copy.
    setSession((prev) => {
      const next = { ...prev, ...(patch || {}), state: 'finishing' as ScreenId };
      sessionRef.current = next;
      return next;
    });
    if (patch) sessionRef.current = { ...sessionRef.current, ...patch };

    const inst = installationRef.current;
    const currentSession = sessionRef.current;
    if (!inst || !currentSession.template) {
      return { success: false, jobId: null, error: 'Session not ready', shareUrl: null };
    }

    let printSuccess = true;
    let jobId: string | null = null;
    let printError: string | null = null;

    // Render the final print first: it is what gets printed AND what
    // the backend stores as the session's final image (gallery +
    // guest download). No composite → no print attempt, rather than
    // silently "printing" nothing.
    let compositeUrl: string | undefined;
    try {
      compositeUrl = await withStepTimeout(
        renderSessionComposite(currentSession),
        12000,
        'Preparing the final print timed out'
      );
    } catch (e: any) {
      printSuccess = false;
      printError = e.message || 'The final print could not be prepared';
    }

    if (compositeUrl) {
      try {
        const result = await withStepTimeout(
          printerManager.print({
            bitmap: compositeUrl,
            copies: currentSession.prints,
            layoutId: currentSession.template.layout.id,
            templateName: currentSession.template.name,
            paperSize: boothTemplateToPrintTemplate(currentSession.template).paperSize,
          }),
          8000,
          'Could not reach the printer (timed out)'
        );
        printSuccess = result.success;
        if (result.jobId) jobId = result.jobId;
        if (result.error) printError = formatFriendlyPrintError(result.error);
      } catch (e: any) {
        printSuccess = false;
        printError = formatFriendlyPrintError(e?.message || 'Printer did not accept the job');
      }
    }

    // Digital copy upload (Decoupled from physical printing)
    const websiteBase = resolveDownloadWebsiteBase(snapshotRef.current?.settings?.websiteUrl);
    const guaranteedShareUrl = websiteBase
      ? `${websiteBase}/download/${encodeURIComponent(currentSession.id)}`
      : `/download/${encodeURIComponent(currentSession.id)}`;
    let shareUrl: string | null = null;
    const eventId = snapshotRef.current?.event?.id || undefined;
    const requireConsent = snapshotRef.current?.settings?.requireGuestConsent === true;
    const effectiveConsent = requireConsent
      ? (currentSession.customization?.guestConsent ?? true)
      : true;

    try {
      shareUrl = await uploadBoothSession(inst, currentSession, compositeUrl, eventId, effectiveConsent);
    } catch (uploadErr: any) {
      console.warn('[finishAndPrint] Cloud upload failed or offline — queueing for background sync:', uploadErr?.message || uploadErr);
      // P2: Decoupled offline queue — guest got physical print, photo will upload when internet returns
      try {
        const fallbackPhotos = await photosAsDataUrls((currentSession.selectedPhotos || []).map((p) => p.uri)).catch(() => []);
        enqueueOfflineSession({
          sessionId: currentSession.id,
          digitalCopy: currentSession.digitalCopy !== false,
          guestConsent: effectiveConsent,
          photos: fallbackPhotos.length > 0 ? fallbackPhotos : (compositeUrl ? [compositeUrl] : []),
          compositeUrl,
          eventId,
        }).catch(() => {});
      } catch (qErr) {
        console.warn('[finishAndPrint] Could not enqueue offline session:', qErr);
      }
    }

    if (!shareUrl && currentSession.digitalCopy !== false) {
      shareUrl = guaranteedShareUrl;
    }

    const finalOutcome: PrintOutcome = {
      success: printSuccess,
      jobId,
      error: printError, // only real printer hardware errors, not cloud upload
      shareUrl: shareUrl || (currentSession.digitalCopy !== false ? guaranteedShareUrl : null),
    };
    setOutcome(finalOutcome);
    return finalOutcome;
  }, []);

  // Retry actions shown on OrderSuccess when the print or the digital share failed.
  // They update the existing outcome in place, so the screen re-renders with the result.
  const [retrying, setRetrying] = useState<'print' | 'share' | null>(null);

  const retryPrint = useCallback(async (): Promise<void> => {
    const currentSession = sessionRef.current;
    if (!currentSession.template) return;
    setRetrying('print');
    try {
      const result = await printerManager.print({
        bitmap: await renderSessionComposite(currentSession),
        copies: currentSession.prints,
        layoutId: currentSession.template.layout.id,
        templateName: currentSession.template.name,
        paperSize: boothTemplateToPrintTemplate(currentSession.template).paperSize,
      });
      setOutcome((prev) => prev && {
        ...prev,
        success: result.success,
        jobId: result.jobId || prev.jobId,
        error: result.success ? null : formatFriendlyPrintError(result.error || 'Printer did not accept the job'),
      });
    } catch (e: any) {
      setOutcome((prev) => prev && { ...prev, success: false, error: formatFriendlyPrintError(e?.message || 'Printer did not accept the job') });
    } finally {
      setRetrying(null);
    }
  }, []);

  const retryShare = useCallback(async (): Promise<void> => {
    const inst = installationRef.current;
    const currentSession = sessionRef.current;
    if (!inst) return;
    setRetrying('share');
    const websiteBase = resolveDownloadWebsiteBase(snapshotRef.current?.settings?.websiteUrl);
    const guaranteedShareUrl = websiteBase
      ? `${websiteBase}/download/${encodeURIComponent(currentSession.id)}`
      : `/download/${encodeURIComponent(currentSession.id)}`;
    try {
      const eventId = snapshotRef.current?.event?.id || undefined;
      const requireConsent = snapshotRef.current?.settings?.requireGuestConsent === true;
      const effectiveConsent = requireConsent
        ? (currentSession.customization?.guestConsent ?? true)
        : true;
      const compositeUrl = await renderSessionComposite(currentSession).catch(() => undefined);
      const shareUrl = await uploadBoothSession(inst, currentSession, compositeUrl, eventId, effectiveConsent);
      setOutcome((prev) => prev && { ...prev, shareUrl: shareUrl || prev.shareUrl || guaranteedShareUrl });
    } catch (e: any) {
      setOutcome((prev) => prev && { ...prev, shareUrl: prev.shareUrl || guaranteedShareUrl });
    } finally {
      setRetrying(null);
    }
  }, []);

  return (
    <BoothContext.Provider
      value={{
        installation,
        snapshot,
        session,
        outcome,
        online,
        secondsLeft,
        bootReady,
        bootError,
        setSession,
        updateSession,
        resetIdleTimer,
        setIdleTimerEnabled: setIdleEnabled,
        resetGuestSession,
        login,
        logout,
        refreshEvent,
        requestQuote,
        createPayment,
        paymentStatus,
        confirmPayment,
        completeFree,
        finishAndPrint,
        retryPrint,
        retryShare,
        retrying,
      }}
    >
      {children}
    </BoothContext.Provider>
  );
};

export const useBooth = (): BoothContextValue => {
  const context = useContext(BoothContext);
  if (!context) throw new Error('useBooth must be used within BoothProvider');
  return context;
};

/**
 * Same value, but `null` instead of a throw when there is no provider.
 *
 * `AppShell` uses this to show the organisation badge and the connection pill
 * without every screen having to forward two fields; screens can still override
 * either. Components rendered in isolation (tests, Storybook-ish previews) keep
 * working because they simply get no chrome data.
 */
export const useOptionalBooth = (): BoothContextValue | null => useContext(BoothContext);
