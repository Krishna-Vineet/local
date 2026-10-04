// ─────────────────────────────────────────────────────────────────
//  CameraManager
//  The ONLY camera interface the UI ever touches.
//  Handles discovery, provider selection, and lifecycle.
// ─────────────────────────────────────────────────────────────────

import type {
  CameraProvider,
  CameraDiscoveryResult,
  CapturedPhoto,
  CameraStatus,
  FilterType,
  CameraType,
} from '@happypix/types';
import { PhoneCameraProvider } from './providers/PhoneCameraProvider';
import { CanonCameraProvider } from './providers/CanonCameraProvider';
import { SonyCameraProvider } from './providers/SonyCameraProvider';
import { PtpCameraProvider } from './providers/PtpCameraProvider';

export class CameraManager {
  private activeProvider: CameraProvider | null = null;
  private allProviders: Map<CameraType, CameraProvider> = new Map();

  constructor() {
    // Register all providers
    this.allProviders.set('phone', new PhoneCameraProvider());
    this.allProviders.set('canon', new CanonCameraProvider({ ip: '192.168.1.2' }));
    this.allProviders.set('sony', new SonyCameraProvider());
    this.allProviders.set('ptp', new PtpCameraProvider());
  }

  // ── Discovery ────────────────────────────────────────────────────

  /**
   * Auto-discover available cameras in priority order:
   * Canon (CCAPI) → Sony → PTP → Phone (fallback)
   */
  async discover(): Promise<CameraDiscoveryResult[]> {
    const found: CameraDiscoveryResult[] = [];

    // 1. Try Canon CCAPI via network probe
    try {
      const canonConfig = await CanonCameraProvider.probe();
      if (canonConfig) {
        // Re-create provider with discovered IP
        this.allProviders.set(
          'canon',
          new CanonCameraProvider(canonConfig),
        );
        found.push({ type: 'canon', name: 'Canon Camera (CCAPI)', address: canonConfig.ip });
      }
    } catch {
      // Not found
    }

    // 2. Sony — only if SDK available (currently stub)
    // TODO: Add Sony discovery when SDK license arrives

    // 3. PTP USB — only if USB device detected (Android only)
    // TODO: Add PTP USB device enumeration

    // 4. Phone camera — always available as fallback
    found.push({ type: 'phone', name: 'Device Camera' });

    return found;
  }

  // ── Provider Management ──────────────────────────────────────────

  /** Select and connect a specific provider */
  async selectProvider(type: CameraType): Promise<void> {
    const provider = this.allProviders.get(type);
    if (!provider) throw new Error(`CameraManager: Unknown provider type "${type}"`);

    // Disconnect current if any
    if (this.activeProvider) {
      await this.activeProvider.disconnect().catch(() => {});
    }

    await provider.connect();
    this.activeProvider = provider;
  }

  /** Auto-select best available camera */
  async autoSelect(): Promise<CameraType> {
    const results = await this.discover();
    const preferred = results.find(r => r.type !== 'phone') ?? results[0];
    if (!preferred) throw new Error('CameraManager: No cameras found');
    await this.selectProvider(preferred.type);
    return preferred.type;
  }

  private requireProvider(): CameraProvider {
    if (!this.activeProvider) {
      throw new Error('CameraManager: No provider selected. Call selectProvider() first.');
    }
    return this.activeProvider;
  }

  // ── Public API (the ONLY thing screens call) ─────────────────────

  async startPreview(surfaceId?: string): Promise<void> {
    return this.requireProvider().startPreview(surfaceId);
  }

  async stopPreview(): Promise<void> {
    return this.requireProvider().stopPreview();
  }

  async capture(): Promise<CapturedPhoto> {
    return this.requireProvider().capture();
  }

  async applyFilter(filter: FilterType): Promise<void> {
    return this.requireProvider().applyFilter(filter);
  }

  async getBattery(): Promise<number> {
    return this.requireProvider().getBattery();
  }

  async getStatus(): Promise<CameraStatus> {
    if (!this.activeProvider) {
      return { connected: false, type: 'phone' };
    }
    return this.requireProvider().getStatus();
  }

  getActiveType(): CameraType | null {
    return this.activeProvider?.type ?? null;
  }

  async disconnect(): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.disconnect().catch(() => {});
      this.activeProvider = null;
    }
  }
}

// Singleton instance — import and use this everywhere
export const cameraManager = new CameraManager();
