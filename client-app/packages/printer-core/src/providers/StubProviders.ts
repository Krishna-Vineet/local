// ─────────────────────────────────────────────────────────────────
//  Printer providers: DNP, AirPrint, Citizen
//
//  DNP: Connects to local DNP Print Bridge (Windows host running Happypix
//  Electron / Print Server on port 9123). Supports DNP DS620A, RX1HS, QW410.
//  If no bridge is running, reports a clear, informative status.
//
//  AirPrint: Handles iOS & IPP-compatible wireless photo printers.
// ─────────────────────────────────────────────────────────────────

import type {
  PrinterProvider,
  PrinterDevice,
  PrintJob,
  PrintResult,
  PrinterStatus,
} from '@happypix/types';

export class DNPProvider implements PrinterProvider {
  readonly type = 'dnp' as const;

  /** DNP models supported via Print Bridge */
  static readonly SUPPORTED_MODELS = ['DS620A', 'RX1HS', 'QW410'] as const;

  /** Standard DNP dye-sub paper sizes */
  static readonly PAPER_SIZES = {
    '4x6': { widthMm: 102, heightMm: 152, dpi: 300 },
    '2x6': { widthMm: 51, heightMm: 152, dpi: 300, isStrip: true },
    '5x7': { widthMm: 127, heightMm: 178, dpi: 300 },
    '6x8': { widthMm: 152, heightMm: 203, dpi: 300 },
  } as const;

  private connectedAddress: string | null = null;
  private connectedModel: string = 'RX1HS';
  private manualAddress: string | null = null;

  /** Configure a specific bridge address (e.g. '192.168.1.50:9123' or 'http://192.168.1.50:9123') */
  setBridgeAddress(address: string | null): void {
    if (!address) {
      this.manualAddress = null;
      return;
    }
    const clean = address.trim().replace(/\/$/, '');
    this.manualAddress = clean.startsWith('http://') || clean.startsWith('https://')
      ? clean
      : `http://${clean}`;
  }

  getBridgeAddress(): string | null {
    return this.connectedAddress || this.manualAddress;
  }

  async discover(): Promise<PrinterDevice[]> {
    const candidateHosts: string[] = [];

    if (this.manualAddress) {
      candidateHosts.push(this.manualAddress);
    }

    // Default probe targets (emulator loopback & localhost)
    candidateHosts.push('http://10.0.2.2:9123'); // Android emulator -> host PC
    candidateHosts.push('http://127.0.0.1:9123');

    const found: PrinterDevice[] = [];

    for (const host of candidateHosts) {
      try {
        const res = await fetch(`${host}/api/status`, {
          signal: AbortSignal.timeout(1200),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.success) {
            found.push({
              type: 'dnp',
              name: data.defaultPrinter || 'DNP DS-RX1HS (Print Bridge)',
              address: host,
              model: 'RX1HS',
              id: `dnp-bridge-${host}`,
              isDefault: true,
            });
            break; // Found active bridge
          }
        }
      } catch {
        // Host unreachable — continue
      }
    }

    return found;
  }

  async connect(device: PrinterDevice): Promise<void> {
    const host = device.address || this.manualAddress;
    if (!host) {
      throw new Error(
        'DNP direct printing requires Happypix Print Bridge on Windows. Please configure Print Bridge IP.',
      );
    }

    const cleanHost = host.startsWith('http://') || host.startsWith('https://')
      ? host
      : `http://${host}`;

    try {
      const res = await fetch(`${cleanHost}/api/status`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        throw new Error(`Print Bridge returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as any;
      this.connectedAddress = cleanHost;
      this.connectedModel = data.defaultPrinter || 'RX1HS';
    } catch (err: any) {
      this.connectedAddress = null;
      throw new Error(
        `Cannot reach DNP Print Bridge at ${cleanHost} (${err.message || 'connection failed'})`,
      );
    }
  }

  async disconnect(): Promise<void> {
    this.connectedAddress = null;
  }

  async print(job: PrintJob): Promise<PrintResult> {
    const target = this.connectedAddress || this.manualAddress;
    if (!target) {
      return {
        success: false,
        error:
          'DNP direct printing requires Happypix Print Bridge on Windows. Please ensure Print Bridge is running.',
      };
    }

    if (!job.bitmap) {
      return {
        success: false,
        error: 'No print image was supplied for printing.',
      };
    }

    try {
      const res = await fetch(`${target}/api/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bitmap: job.bitmap,
          copies: job.copies || 1,
          layoutId: job.layoutId || 'strip',
          templateName: job.templateName || 'standard',
          paperSize: job.paperSize || '4x6',
        }),
      });

      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        return {
          success: true,
          jobId: data.jobId || `PRINT-${Date.now()}`,
        };
      }

      return {
        success: false,
        error: data.error || `Print Bridge failed with HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Could not send job to Print Bridge: ${err.message || 'Network error'}`,
      };
    }
  }

  async getStatus(): Promise<PrinterStatus> {
    const target = this.connectedAddress || this.manualAddress;
    if (!target) {
      return {
        connected: false,
        type: 'dnp',
        isReady: false,
        error: 'Print Bridge not connected',
      };
    }

    try {
      const res = await fetch(`${target}/api/status`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        return {
          connected: true,
          type: 'dnp',
          isReady: data.connected !== false,
        };
      }
      return {
        connected: false,
        type: 'dnp',
        isReady: false,
        error: `HTTP ${res.status}`,
      };
    } catch {
      return {
        connected: false,
        type: 'dnp',
        isReady: false,
        error: 'Unreachable',
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────
//  AirPrintProvider (iOS / Network IPP Print)
// ─────────────────────────────────────────────────────────────────

export class AirPrintProvider implements PrinterProvider {
  readonly type = 'airprint' as const;
  private connectedDevice: PrinterDevice | null = null;

  async discover(): Promise<PrinterDevice[]> {
    // AirPrint operates through mDNS / IPP services
    return [];
  }

  async connect(device: PrinterDevice): Promise<void> {
    this.connectedDevice = device;
  }

  async disconnect(): Promise<void> {
    this.connectedDevice = null;
  }

  async print(job: PrintJob): Promise<PrintResult> {
    if (!job.bitmap) {
      return { success: false, error: 'AirPrint: Bitmap image data required' };
    }
    // Forward to IPP destination if device address is known
    if (this.connectedDevice?.address) {
      try {
        const res = await fetch(`http://${this.connectedDevice.address}:631/ipp/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/ipp' },
          body: job.bitmap,
        });
        return { success: res.ok, jobId: `AIRPRINT-${Date.now()}` };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return {
      success: false,
      error: 'AirPrint: No printer selected. Please connect via IPP or Print Bridge.',
    };
  }

  async getStatus(): Promise<PrinterStatus> {
    return {
      connected: this.connectedDevice !== null,
      type: 'airprint',
      isReady: this.connectedDevice !== null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
//  CitizenProvider — STUB (fails honestly)
// ─────────────────────────────────────────────────────────────────

export class CitizenProvider implements PrinterProvider {
  readonly type = 'citizen' as const;

  async discover(): Promise<PrinterDevice[]> {
    return [];
  }
  async connect(_d: PrinterDevice): Promise<void> {
    throw new Error('CitizenProvider: Direct SDK not integrated yet. Use Print Bridge or IPP instead.');
  }
  async disconnect(): Promise<void> {}
  async print(_j: PrintJob): Promise<PrintResult> {
    return {
      success: false,
      error: 'CitizenProvider: Direct SDK not integrated. Use Print Bridge or IPP instead.',
    };
  }
  async getStatus(): Promise<PrinterStatus> {
    return {
      connected: false,
      type: 'citizen',
      isReady: false,
      error: 'Citizen SDK not integrated',
    };
  }
}
