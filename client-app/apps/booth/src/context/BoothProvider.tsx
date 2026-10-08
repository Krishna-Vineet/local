// ─────────────────────────────────────────────────────────────────
//  Happypix Booth — BoothProvider
//  Manages kiosk pairing, session state, payment, and background sync
// ─────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Dimensions, Platform } from 'react-native';
import {
  boothApi,
  getInstallation,
  saveInstallation,
  clearInstallation,
  getCachedSnapshot,
  saveCachedSnapshot,
  isDemoMode,
  type BoothEvent,
  type BoothSession,
  type BoothSnapshot,
  type CheckoutQuote,
  type Customization,
  type Installation,
  type PaymentOrder,
  type PrintOutcome,
  type ScreenId,
} from '@happypix/api';
import { cameraManager } from '../../../../packages/camera-core/src/index';
import { printerManager } from '../../../../packages/printer-core/src/index';

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
  completeFree: (quote: CheckoutQuote) => Promise<void>;
  finishAndPrint: () => Promise<PrintOutcome>;
}

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

  const applySnapshot = useCallback((val: BoothSnapshot) => {
    snapshotRef.current = val;
    setSnapshot(val);
    void saveCachedSnapshot(val);
  }, []);

  // ── 1. Boot sequence ─────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const cached = await getCachedSnapshot();
        if (cached && active) {
          setSnapshot(cached);
          snapshotRef.current = cached;
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
        } catch (e: any) {
          // If stored credentials rejected
          if (e.message?.includes('credentials') || e.message?.includes('token')) {
            await clearInstallation();
            installationRef.current = null;
            setInstallation(null);
            setBootError('The saved pairing was expired. Please log in again.');
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
  }, [applySnapshot]);

  // ── 2. Background Heartbeat every 2 minutes ──────────────────────
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
        if (response.changed && response.snapshot) {
          applySnapshot(response.snapshot);
        }
      } catch {
        setOnline(false);
      }
    };

    const first = setTimeout(heartbeat, 3000);
    const interval = setInterval(heartbeat, 2 * 60 * 1000);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [installation, applySnapshot]);

  // ── 3. Idle Timer ────────────────────────────────────────────────
  const resetIdleTimer = useCallback(() => {
    setSecondsLeft(snapshot?.settings?.boothTimeoutSec ?? 90);
  }, [snapshot?.settings?.boothTimeoutSec]);

  const updateSession = useCallback((patch: Partial<BoothSession>) => {
    setSession((prev) => ({ ...prev, ...patch }));
    resetIdleTimer();
  }, [resetIdleTimer]);

  const resetGuestSession = useCallback((navigation?: any) => {
    setSession(freshSession());
    setOutcome(null);
    resetIdleTimer();
    if (navigation) {
      const isLive = snapshotRef.current?.event?.status === 'live';
      navigation.replace(isLive ? 'Start' : 'Waiting');
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
    const deviceUuid = `device-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const result = await boothApi.login({
      email: values.email,
      password: values.password,
      deviceUuid,
      deviceName: `Tablet (${Platform.OS})`,
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
    setOnline(true);
    applySnapshot(result.snapshot);

    return { isLive: result.snapshot.event?.status === 'live' };
  };

  const logout = async () => {
    await clearInstallation();
    installationRef.current = null;
    setInstallation(null);
    setSnapshot(null);
    snapshotRef.current = null;
    setSession(freshSession());
  };

  const refreshEvent = async () => {
    if (!installationRef.current) return;
    try {
      const value = await boothApi.bootstrap(installationRef.current);
      setOnline(true);
      applySnapshot(value);
    } catch {
      setOnline(false);
    }
  };

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

  const completeFree = useCallback(async (quote: CheckoutQuote) => {
    const inst = installationRef.current;
    if (!inst) throw new Error('This booth is not paired.');
    return boothApi.completeFree(inst, quote);
  }, []);

  const finishAndPrint = useCallback(async (): Promise<PrintOutcome> => {
    const inst = installationRef.current;
    if (!inst || !session.template) {
      return { success: false, jobId: null, error: 'Session not ready', shareUrl: null };
    }

    let printSuccess = true;
    let jobId: string | null = `job-${Date.now()}`;
    let printError: string | null = null;

    try {
      const result = await printerManager.print({
        copies: session.prints,
        layoutId: session.template.layout.id,
        templateName: session.template.name,
      });
      printSuccess = result.success;
      if (result.jobId) jobId = result.jobId;
      if (result.error) printError = result.error;
    } catch (e: any) {
      printSuccess = false;
      printError = e.message || 'Printer did not accept the job';
    }

    let shareUrl: string | null = null;
    try {
      const completed = await boothApi.completeSession(inst, {
        sessionId: session.id,
        digitalCopy: session.digitalCopy,
      });
      shareUrl = completed.shareUrl;
    } catch (e: any) {
      if (!printError) printError = e.message || 'Could not prepare digital share';
    }

    const finalOutcome: PrintOutcome = {
      success: printSuccess,
      jobId,
      error: printError,
      shareUrl,
    };
    setOutcome(finalOutcome);
    return finalOutcome;
  }, [session.template, session.prints, session.digitalCopy, session.id]);

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
        completeFree,
        finishAndPrint,
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
