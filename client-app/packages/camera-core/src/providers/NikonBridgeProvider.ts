// ─────────────────────────────────────────────────────────────────
//  NikonBridgeProvider
//  Connects to the Happypix Hardware Bridge (PC Kiosk on port 9123).
//  Gives Android and iOS tablets full Nikon DSLR/Mirrorless control
//  (Live View, Shutter Trigger, Settings) over Wi-Fi.
// ─────────────────────────────────────────────────────────────────

import type {
  CameraProvider,
  CameraStatus,
  CapturedPhoto,
  FilterType,
} from '@happypix/types';

export interface NikonBridgeConfig {
  /** Host address of the PC Kiosk (e.g. '192.168.1.50' or '10.0.2.2') */
  host: string;
  /** Port of the Hardware Bridge — defaults to 9123 */
  port?: number;
}

export class NikonBridgeProvider implements CameraProvider {
  readonly type = 'nikon-bridge' as const;

  private host: string;
  private port: number;
  private baseUrl: string;
  private _connected = false;
  private _model: string | null = null;
  private _batteryPct: number | null = null;

  constructor(config: NikonBridgeConfig) {
    this.host = config.host.replace(/^http:\/\//, '').replace(/\/.*$/, '').split(':')[0];
    this.port = config.port ?? 9123;
    this.baseUrl = `http://${this.host}:${this.port}`;
  }

  /**
   * Probe list of candidate hosts to find an active Happypix Nikon bridge.
   */
  static async probe(candidateHosts: string[]): Promise<string | null> {
    for (const host of candidateHosts) {
      try {
        const cleanHost = host.replace(/^http:\/\//, '').replace(/\/.*$/, '').split(':')[0];
        const port = host.includes(':') ? parseInt(host.split(':')[1], 10) : 9123;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);

        const res = await fetch(`http://${cleanHost}:${port}/api/camera/status`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (data.success && (data.connected || data.provider === 'nikon-sdk')) {
            return `http://${cleanHost}:${port}`;
          }
        }
      } catch {
        // Host unreachable, try next
      }
    }
    return null;
  }

  async connect(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/camera/status`);
    if (!res.ok) {
      throw new Error(`Nikon bridge at ${this.baseUrl} unreachable [${res.status}]`);
    }
    const data = await res.json();
    if (!data.success || !data.connected) {
      throw new Error(data.error || 'Nikon camera not connected to Kiosk Bridge');
    }
    this._connected = true;
    this._model = data.model || 'Nikon Camera (Kiosk Bridge)';
    this._batteryPct = data.batteryPct ?? null;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }

  async startPreview(): Promise<void> {
    await fetch(`${this.baseUrl}/api/camera/liveview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async stopPreview(): Promise<void> {
    await fetch(`${this.baseUrl}/api/camera/liveview/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  }

  /**
   * Returns live view URL to poll/stream in UI
   */
  getLiveViewUrl(): string {
    return `${this.baseUrl}/api/camera/liveview`;
  }

  async capture(): Promise<CapturedPhoto> {
    const res = await fetch(`${this.baseUrl}/api/camera/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Nikon capture failed on bridge [${res.status}]`);
    }
    const data = await res.json();
    if (!data.success || !data.dataUrl) {
      throw new Error(data.error || 'Nikon bridge capture failed');
    }

    return {
      id: `nikon-${Date.now()}`,
      uri: data.dataUrl,
      dataUrl: data.dataUrl,
      capturedAt: new Date().toISOString(),
    };
  }

  async applyFilter(_filter: FilterType): Promise<void> {
    // Applied in canvas compositor
  }

  async getBattery(): Promise<number> {
    const res = await fetch(`${this.baseUrl}/api/camera/status`);
    if (res.ok) {
      const data = await res.json();
      return data.batteryPct ?? 100;
    }
    return 100;
  }

  async getStatus(): Promise<CameraStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/api/camera/status`);
      if (res.ok) {
        const data = await res.json();
        return {
          connected: !!data.connected,
          type: 'nikon-bridge',
          batteryLevel: data.batteryPct ?? undefined,
          error: data.error ?? undefined,
        };
      }
    } catch {
      // Offline
    }
    return {
      connected: false,
      type: 'nikon-bridge',
      error: 'Nikon bridge offline',
    };
  }
}

