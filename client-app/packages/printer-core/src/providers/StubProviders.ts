// ─────────────────────────────────────────────────────────────────
//  Printer providers WITHOUT a usable SDK yet.
//
//  HONESTY RULE: until a real transport exists, these providers must
//  FAIL LOUDLY. A previous version invented a discovered device,
//  returned print success without printing, and fabricated paper
//  levels (400 sheets) — that is mock behaviour in production: the
//  booth told guests "printed" while nothing came out. Never again.
//
//  DNP: no public SDK exists (drivers/ICC only — dnpphoto.com). The
//  path to DNP hardware today is the OS print pipeline / IPP
//  (IPPProvider, Electron spooler). When DNP supplies their SDK:
//    1. Add the native module (Android: Kotlin, iOS: Swift)
//    2. Replace the bodies below with real SDK calls
//    3. No PrinterManager or UI changes required
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

  /** DNP models targeted when the SDK lands */
  static readonly SUPPORTED_MODELS = ['DS620A', 'RX1HS', 'QW410'] as const;

  /** Standard DNP dye-sub paper sizes (for when the SDK lands) */
  static readonly PAPER_SIZES = {
    '4x6': { widthMm: 102, heightMm: 152, dpi: 300 },
    '2x6': { widthMm: 51, heightMm: 152, dpi: 300, isStrip: true },
    '5x7': { widthMm: 127, heightMm: 178, dpi: 300 },
    '6x8': { widthMm: 152, heightMm: 203, dpi: 300 },
  } as const;

  private static readonly UNAVAILABLE =
    'DNP direct printing is not available yet (no DNP SDK). Use a network/OS-driver printer via IPP instead.';

  async discover(): Promise<PrinterDevice[]> {
    // No SDK → nothing can honestly be discovered.
    return [];
  }

  async connect(_device: PrinterDevice): Promise<void> {
    throw new Error(DNPProvider.UNAVAILABLE);
  }

  async disconnect(): Promise<void> {}

  async print(_job: PrintJob): Promise<PrintResult> {
    return { success: false, error: DNPProvider.UNAVAILABLE };
  }

  async getStatus(): Promise<PrinterStatus> {
    return {
      connected: false,
      type: 'dnp',
      isReady: false,
      error: DNPProvider.UNAVAILABLE,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
//  AirPrintProvider — STUB (iOS primary path)
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
//  CitizenProvider — STUB (no SDK integrated; fails honestly)
// ─────────────────────────────────────────────────────────────────

export class CitizenProvider implements PrinterProvider {
  readonly type = 'citizen' as const;

  async discover(): Promise<PrinterDevice[]> {
    return [];
  }
  async connect(_d: PrinterDevice): Promise<void> {
    throw new Error('CitizenProvider: SDK not integrated yet. Use IPP instead.');
  }
  async disconnect(): Promise<void> {}
  async print(_j: PrintJob): Promise<PrintResult> {
    return { success: false, error: 'Citizen SDK not integrated yet. Use IPP instead.' };
  }
  async getStatus(): Promise<PrinterStatus> {
    return { connected: false, type: 'citizen', isReady: false, error: 'Citizen SDK not integrated yet.' };
  }
}
