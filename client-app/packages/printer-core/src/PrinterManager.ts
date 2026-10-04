// ─────────────────────────────────────────────────────────────────
//  PrinterManager
//  The ONLY printer interface the UI ever touches.
// ─────────────────────────────────────────────────────────────────

import type {
  PrinterProvider,
  PrinterDevice,
  PrintJob,
  PrintResult,
  PrinterStatus,
  PrinterType,
} from '@happypix/types';
import { IPPProvider } from './providers/IPPProvider';
import { DNPProvider, AirPrintProvider, CitizenProvider } from './providers/StubProviders';

export class PrinterManager {
  private activeProvider: PrinterProvider | null = null;
  private activeDevice: PrinterDevice | null = null;
  private allProviders: Map<PrinterType, PrinterProvider> = new Map();

  constructor() {
    this.allProviders.set('ipp', new IPPProvider());
    this.allProviders.set('dnp', new DNPProvider());
    this.allProviders.set('airprint', new AirPrintProvider());
    this.allProviders.set('citizen', new CitizenProvider());
  }

  // ── Discovery ────────────────────────────────────────────────────

  /**
   * Discover all available printers via all providers.
   * In V1 (Android-first), IPP is the primary path.
   */
  async discover(): Promise<PrinterDevice[]> {
    const results: PrinterDevice[] = [];

    // Try each provider (skip stubs that throw on discover)
    for (const provider of this.allProviders.values()) {
      try {
        const devices = await provider.discover();
        results.push(...devices);
      } catch {
        // Provider not available — skip
      }
    }

    return results;
  }

  // ── Connection ───────────────────────────────────────────────────

  async connect(device: PrinterDevice): Promise<void> {
    const provider = this.allProviders.get(device.type);
    if (!provider) throw new Error(`PrinterManager: Unknown printer type "${device.type}"`);

    if (this.activeProvider) {
      await this.activeProvider.disconnect().catch(() => {});
    }

    await provider.connect(device);
    this.activeProvider = provider;
    this.activeDevice = device;
  }

  async disconnect(): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.disconnect().catch(() => {});
      this.activeProvider = null;
      this.activeDevice = null;
    }
  }

  // ── Print Pipeline ────────────────────────────────────────────────

  /**
   * The main print call — UI sends a PrintJob, provider handles the rest.
   * PrintJob.bitmap must already be a 300 DPI bitmap from RenderEngine.
   */
  async print(job: PrintJob): Promise<PrintResult> {
    if (!this.activeProvider) {
      throw new Error('PrinterManager: No printer connected. Call connect() first.');
    }
    return this.activeProvider.print(job);
  }

  async getStatus(): Promise<PrinterStatus> {
    if (!this.activeProvider) {
      return { connected: false, type: 'ipp', isReady: false };
    }
    return this.activeProvider.getStatus();
  }

  getActiveDevice(): PrinterDevice | null {
    return this.activeDevice;
  }

  isConnected(): boolean {
    return this.activeProvider !== null;
  }
}

export const printerManager = new PrinterManager();
