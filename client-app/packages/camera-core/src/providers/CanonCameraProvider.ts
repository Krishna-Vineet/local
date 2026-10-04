// ─────────────────────────────────────────────────────────────────
//  CanonCameraProvider
//  Uses Canon CCAPI (Camera Control API) — HTTP/REST/JSON
//  NO native SDK required. Works on both Android and iOS.
//
//  Canon CCAPI endpoint: http://<camera-ip>:8080
//  Docs: https://developercommunity.usa.canon.com/s/article/What-is-CCAPI
//
//  Supported cameras (CCAPI-enabled):
//    EOS R series, R5, R6, R7, R8, R10, R50, R100
//    EOS 90D, 850D / Rebel T8i
//    PowerShot G7 X Mark III, G5 X Mark II
// ─────────────────────────────────────────────────────────────────

import type {
  CameraProvider,
  CameraStatus,
  CapturedPhoto,
  FilterType,
} from '@happypix/types';

export interface CanonCameraConfig {
  /** Camera IP address (e.g. '192.168.1.2') */
  ip: string;
  /** CCAPI port — default 8080 */
  port?: number;
}

export class CanonCameraProvider implements CameraProvider {
  readonly type = 'canon' as const;

  private ip: string;
  private port: number;
  private baseUrl: string;
  private _connected = false;

  constructor(config: CanonCameraConfig) {
    this.ip = config.ip;
    this.port = config.port ?? 8080;
    this.baseUrl = `http://${this.ip}:${this.port}`;
  }

  private async ccapi<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`CCAPI ${method} ${path} failed [${res.status}]`);
    }
    // Some CCAPI endpoints return empty body
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  async connect(): Promise<void> {
    // Verify camera is reachable by fetching device info
    await this.ccapi('GET', '/ccapi');
    this._connected = true;
    // Enable remote shooting mode
    await this.ccapi('PUT', '/ccapi/ver110/shooting/settings/camerasetting', {
      value: 'remotecontrol',
    });
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }

  async startPreview(): Promise<void> {
    // Start live view stream
    await this.ccapi('POST', '/ccapi/ver110/shooting/liveview', {
      liveviewsize: 'medium',
      cameradisplay: 'off',
    });
  }

  async stopPreview(): Promise<void> {
    await this.ccapi('DELETE', '/ccapi/ver110/shooting/liveview');
  }

  /**
   * Get live view frame URL for display in the app
   * Poll this in the CaptureScreen to show live preview
   */
  getLiveViewUrl(): string {
    return `${this.baseUrl}/ccapi/ver110/shooting/liveview/flipdetail`;
  }

  async capture(): Promise<CapturedPhoto> {
    // Trigger shutter
    await this.ccapi('POST', '/ccapi/ver110/shooting/control/shutterbutton', {
      af: true,
    });

    // Wait a moment for the image to be processed
    await new Promise(res => setTimeout(res, 1500));

    // Get the latest image from the camera storage
    const contents = await this.ccapi<{ url: string[] }>(
      'GET',
      '/ccapi/ver110/contents/sd?kind=image&order=desc&pagesize=1',
    );

    const imageUrl = contents.url?.[0];
    if (!imageUrl) {
      throw new Error('CanonCameraProvider: No image found after capture');
    }

    // Download the image
    const imageRes = await fetch(imageUrl);
    const blob = await imageRes.blob();

    // Convert to base64 data URI
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          uri: reader.result as string,
          width: 6000, // Default Canon RAW size — get from EXIF in production
          height: 4000,
          timestamp: Date.now(),
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async applyFilter(_filter: FilterType): Promise<void> {
    // Filters are applied in post-processing on the image, not on the camera.
    // Canon CCAPI has picture style settings but we handle filters client-side.
  }

  async getBattery(): Promise<number> {
    const res = await this.ccapi<{ value: string }>(
      'GET',
      '/ccapi/ver110/devicestatus/battery',
    );
    // CCAPI returns 'high' | 'low' | 'depleted'
    const map: Record<string, number> = { high: 90, low: 20, depleted: 5 };
    return map[res.value] ?? 50;
  }

  async getStatus(): Promise<CameraStatus> {
    return {
      connected: this._connected,
      type: 'canon',
      batteryLevel: await this.getBattery(),
    };
  }

  // ── Static Discovery ─────────────────────────────────────────────

  /**
   * Probe a list of common IPs to find a Canon camera on the network.
   * In production, use mDNS/Bonjour with the _canon-cc._tcp service.
   */
  static async probe(
    ipRange: string[] = ['192.168.1.2', '192.168.0.2', '192.168.1.100'],
  ): Promise<CanonCameraConfig | null> {
    for (const ip of ipRange) {
      try {
        const res = await fetch(`http://${ip}:8080/ccapi`, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) return { ip };
      } catch {
        // Not reachable — try next
      }
    }
    return null;
  }
}
