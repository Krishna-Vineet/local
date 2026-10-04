// ─────────────────────────────────────────────────────────────────
//  DNPProvider — STUB
//
//  STATUS: Awaiting DNP developer SDK license.
//  DNP SDK supports: DS620A, RX1HS, QW410
//  Wireless printing ecosystem targets iOS/Android tablet photo booths.
//
//  When SDK arrives:
//    1. Add DNP SDK native module (Android: Kotlin, iOS: Swift)
//    2. Replace stub implementations below with real SDK calls
//    3. No PrinterManager or UI changes required
//
//  DNP Dev program: https://dnpphoto.com/en/Products/Software/
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

  /** Supported DNP models in V1 scope */
  static readonly SUPPORTED_MODELS = ['DS620A', 'RX1HS', 'QW410'] as const;

  async discover(): Promise<PrinterDevice[]> {
    // TODO: DNP SDK discovery
    // DNPPrinterManager.discoverPrinters()
    console.warn('DNPProvider: SDK not available — discovery skipped');
    return [];
  }

  async connect(_device: PrinterDevice): Promise<void> {
    // TODO: DNPPrinterManager.connect(device.address)
    throw new Error(
      'DNPProvider: SDK not yet available. Awaiting DNP developer license.\n' +
      'Supported models when available: DS620A, RX1HS, QW410',
    );
  }

  async disconnect(): Promise<void> {
    // TODO: DNPPrinterManager.disconnect()
  }

  async print(_job: PrintJob): Promise<PrintResult> {
    // TODO: DNPPrinterManager.print(bitmap, copies, paperSize)
    return { success: false, error: 'DNP SDK not available' };
  }

  async getStatus(): Promise<PrinterStatus> {
    return {
      connected: false,
      type: 'dnp',
      isReady: false,
      error: 'DNP SDK not available — awaiting license',
    };
  }
}

// ─────────────────────────────────────────────────────────────────
//  AirPrintProvider — STUB (iOS primary path)
//  For Android-first V1, this is a stub.
//  iOS implementation uses UIPrintInteractionController (Swift).
// ─────────────────────────────────────────────────────────────────

export class AirPrintProvider implements PrinterProvider {
  readonly type = 'airprint' as const;

  async discover(): Promise<PrinterDevice[]> {
    // iOS: UIPrinterPickerController handles this natively
    // Android: Not applicable
    console.warn('AirPrintProvider: iOS-only. Use IPPProvider on Android.');
    return [];
  }

  async connect(_device: PrinterDevice): Promise<void> {
    // iOS: UIPrintInteractionController manages connections implicitly
    throw new Error('AirPrintProvider: iOS-only. Not supported on Android.');
  }

  async disconnect(): Promise<void> {}

  async print(_job: PrintJob): Promise<PrintResult> {
    // TODO (iOS): UIPrintInteractionController.shared().printInfo = ...
    // TODO (iOS): UIPrintInteractionController.shared().present(animated: true)
    return { success: false, error: 'AirPrint is iOS-only. Use IPP on Android.' };
  }

  async getStatus(): Promise<PrinterStatus> {
    return {
      connected: false,
      type: 'airprint',
      isReady: false,
      error: 'AirPrint: iOS-only stub',
    };
  }
}

// ─────────────────────────────────────────────────────────────────
//  CitizenProvider — STUB
// ─────────────────────────────────────────────────────────────────

export class CitizenProvider implements PrinterProvider {
  readonly type = 'citizen' as const;

  async discover(): Promise<PrinterDevice[]> {
    return [];
  }
  async connect(_d: PrinterDevice): Promise<void> {
    throw new Error('CitizenProvider: Pending implementation');
  }
  async disconnect(): Promise<void> {}
  async print(_j: PrintJob): Promise<PrintResult> {
    return { success: false, error: 'Citizen SDK not implemented' };
  }
  async getStatus(): Promise<PrinterStatus> {
    return { connected: false, type: 'citizen', isReady: false };
  }
}
