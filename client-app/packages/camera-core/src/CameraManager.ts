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
import { CanonCameraProvider, type CanonCameraConfig } from './providers/CanonCameraProvider';
import { SonyCameraProvider } from './providers/SonyCameraProvider';
import { PtpCameraProvider } from './providers/PtpCameraProvider';

export class CameraManager {
  private activeProvider: CameraProvider | null = null;
  private allProviders: Map<CameraType, CameraProvider> = new Map();
  private customCanonConfig: CanonCameraConfig | null = null;

  constructor() {
    // Register all providers
    this.allProviders.set('phone', new PhoneCameraProvider());
    this.allProviders.set('canon', new CanonCameraProvider({ ip: '192.168.1.2' }));
    this.allProviders.set('sony', new SonyCameraProvider());
    this.allProviders.set('ptp', new PtpCameraProvider());
  }

  /**
   * Set custom Canon CCAPI IP address from settings
   */
  setCanonConfig(ip: string, port = 8080): void {
    const cleanIp = ip.trim().replace(/^http:\/\//, '').replace(/\/.*$/, '').split(':')[0];
    this.customCanonConfig = { ip: cleanIp, port };
    this.allProviders.set('canon', new CanonCameraProvider(this.customCanonConfig));
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
      const probeList = this.customCanonConfig
        ? [this.customCanonConfig.ip, '192.168.1.2', '192.168.0.2', '10.0.2.2']
        : ['192.168.1.2', '192.168.0.2', '192.168.1.100', '10.0.2.2'];

      const canonConfig = await CanonCameraProvider.probe(probeList);
      if (canonConfig) {
        this.allProviders.set('canon', new CanonCameraProvider(canonConfig));
        found.push({ type: 'canon', name: 'Canon Camera (CCAPI)', address: canonConfig.ip });
      }
    } catch {
      // Not found
    }

    // 2. Phone camera — always available as fallback
    found.push({ type: 'phone', name: 'Integrated Tablet Camera' });

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
    const preferred = results.find((r) => r.type !== 'phone') ?? results[0];
    if (!preferred) throw new Error('CameraManager: No cameras found');
    await this.selectProvider(preferred.type);
    return preferred.type;
  }

  private requireProvider(): CameraProvider {
    if (!this.activeProvider) {
      // Auto-fallback to phone camera
      const phone = this.allProviders.get('phone');
      if (phone) {
        this.activeProvider = phone;
        return phone;
      }
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

  getActiveProvider(): CameraProvider | null {
    return this.activeProvider;
  }

  getLiveViewUrl(): string | null {
    if (this.activeProvider?.type === 'canon') {
      const canon = this.activeProvider as CanonCameraProvider;
      return canon.getLiveViewUrl();
    }
    return null;
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
