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

  /**
   * Configure DNP Print Bridge address (e.g. '192.168.1.50:9123')
   */
  setBridgeAddress(address: string | null): void {
    const dnp = this.allProviders.get('dnp') as DNPProvider | undefined;
    if (dnp) {
      dnp.setBridgeAddress(address);
    }
  }

  /**
   * Configure a manual IP for IPP / Network printer
   */
  setManualIPPAddress(address: string | null): void {
    const ipp = this.allProviders.get('ipp') as IPPProvider | undefined;
    if (ipp) {
      ipp.setManualAddress(address);
    }
  }

  // ── Discovery ────────────────────────────────────────────────────

  /**
   * Discover all available printers via all providers.
   * Checks DNP Print Bridge, IPP, and AirPrint.
   */
  async discover(): Promise<PrinterDevice[]> {
    const results: PrinterDevice[] = [];

    // Try each provider
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
      // Auto-fallback: If no printer explicitly connected, try auto-connecting to discovered printer
      const discovered = await this.discover();
      if (discovered.length > 0) {
        await this.connect(discovered[0]);
      } else {
        throw new Error('PrinterManager: No printer connected. Call connect() first.');
      }
    }
    return this.activeProvider!.print(job);
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

  getActiveProvider(): PrinterProvider | null {
    return this.activeProvider;
  }

  isConnected(): boolean {
    return this.activeProvider !== null;
  }
}

export const printerManager = new PrinterManager();
