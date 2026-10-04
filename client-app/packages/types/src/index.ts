// ─────────────────────────────────────────────────────────────────
//  Happypix Booth — Shared Type Definitions
//  ALL hardware abstractions live here.
//  UI + screens ONLY import from this package, never from SDKs directly.
// ─────────────────────────────────────────────────────────────────

// ── Camera ───────────────────────────────────────────────────────

export type CameraType = 'phone' | 'sony' | 'canon' | 'ptp';

export interface CameraStatus {
  connected: boolean;
  type: CameraType;
  batteryLevel?: number; // 0–100
  storageAvailable?: number; // MB
  isRecording?: boolean;
  error?: string;
}

export interface CapturedPhoto {
  uri: string;          // local file:// URI
  width: number;
  height: number;
  timestamp: number;
  filter?: string;
}

export interface CameraDiscoveryResult {
  type: CameraType;
  name: string;
  address?: string; // IP for network cameras
  serial?: string;
}

/**
 * Every camera provider MUST implement this interface.
 * UI talks only to CameraManager — never to a specific provider.
 */
export interface CameraProvider {
  readonly type: CameraType;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  startPreview(surfaceId?: string): Promise<void>;
  stopPreview(): Promise<void>;
  capture(): Promise<CapturedPhoto>;
  applyFilter(filter: FilterType): Promise<void>;
  getBattery(): Promise<number>;
  getStatus(): Promise<CameraStatus>;
}

// ── Printer ──────────────────────────────────────────────────────

export type PrinterType = 'dnp' | 'citizen' | 'fuji' | 'airprint' | 'ipp';
export type PaperSize = '4x6' | '5x7' | '6x8' | '2x6_strip';

export interface PrinterDevice {
  type: PrinterType;
  name: string;
  address?: string;
  model?: string;
}

export interface PrintJob {
  /** base64 data URI of the fully rendered 300 DPI bitmap */
  bitmap: string;
  copies: number;
  paperSize: PaperSize;
  eventId?: string;
}

export interface PrintResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface PrinterStatus {
  connected: boolean;
  type: PrinterType;
  papersRemaining?: number;
  isReady: boolean;
  error?: string;
}

/**
 * Every printer provider MUST implement this interface.
 * UI talks only to PrinterManager — never to a specific provider.
 */
export interface PrinterProvider {
  readonly type: PrinterType;
  discover(): Promise<PrinterDevice[]>;
  connect(device: PrinterDevice): Promise<void>;
  disconnect(): Promise<void>;
  print(job: PrintJob): Promise<PrintResult>;
  getStatus(): Promise<PrinterStatus>;
}

// ── Connection ───────────────────────────────────────────────────

export type ConnectionType = 'usb' | 'tcp' | 'udp' | 'bluetooth' | 'wifi';

export interface Connection {
  readonly type: ConnectionType;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(data: Buffer | Uint8Array): Promise<void>;
  receive(): Promise<Buffer>;
  isConnected(): boolean;
}

// ── Filters ──────────────────────────────────────────────────────

export type FilterType =
  | 'none'
  | 'vintage'
  | 'blackwhite'
  | 'warm'
  | 'cool'
  | 'vivid';

export type PhotoShape = 'rectangle' | 'circle' | 'heart' | 'rounded';

export interface Sticker {
  id: string;
  url?: string;
  emoji?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

// ── Template / Print Rendering ────────────────────────────────────

export interface TemplateSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface PrintTemplate {
  id: string;
  name: string;
  paperSize: PaperSize;
  orientation: 'portrait' | 'landscape';
  frames: number;
  slots: TemplateSlot[];
  photoSlots?: any[];
  canvas?: { width: number; height: number; };
  dpi: 300 | 600;
  overlayUrl?: string;
  price?: number | null;
}

// ── Booth Session ────────────────────────────────────────────────

export type BoothScreen = 'capture' | 'filter' | 'preview' | 'payment' | 'print';

export interface ActiveEvent {
  _id: string;
  name: string;
  shortCode: string;
  location: string;
  status: 'upcoming' | 'live' | 'finished';
  selectedScreens?: BoothScreen[];
  branding?: {
    logoUrl?: string;
    logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    overlayUrl?: string;
    primaryColor?: string;
  };
  logos?: string[];
  allowedTemplates?: {
    id: string;
    label: string;
    description: string;
    frames: number;
    orientation: 'vertical' | 'horizontal' | 'grid';
    overlayUrl: string;
    price: number | null;
    isDefault: boolean;
  }[];
  allowedFilters?: FilterType[];
  printingEnabled?: boolean;
  printPrice?: number | null;
  boothTimeout?: number;
  razorpayKeyId?: string;
  countdownDuration?: number;
  passkey?: string;
  // Per-cut grid pricing set by the event organizer
  gridPrices?: {
    cut1?: number | null;
    cut2?: number | null;
    cut4?: number | null;
    cut6Vertical?: number | null;
    cut6Horizontal?: number | null;
  };
  assignedTemplateIds?: any[];
  // Per-format pricing (by paper size category)
  formatPrices?: {
    strip?: number | null;
    standard?: number | null;
    large?: number | null;
    square?: number | null;
  };
  // Per-template price overrides { templateId -> price }
  templatePrices?: Record<string, number>;
  // ─── Digital Photo Sharing Settings ──────────────────────
  sharingConfig?: {
    enabled: boolean;
    qr?: { enabled: boolean };
    download?: { enabled: boolean };
    whatsapp?: { enabled: boolean };
    email?: { enabled: boolean };
    sms?: { enabled: boolean };
    nativeShare?: { enabled: boolean };
    copyLink?: { enabled: boolean };
    expirationDays?: number;
  };
  enabledLayouts?: string[];
}

export interface GlobalSettings {
  printPrice: number;
  taxRate: number;
  boothTimeout: number;
  defaultPaperSize?: PaperSize;
  upiId?: string;
  upiName?: string;
  upiQrImageUrl?: string;
  razorpayKeyId?: string;
  countdownDuration?: number;
}

export interface BoothSession {
  orientation: 'vertical' | 'horizontal';
  frames: number;
  images: CapturedPhoto[];
  selectedImages: CapturedPhoto[];
  retakeIndex: number | null;
  activeEvent: ActiveEvent | null;
  isAdminAssigned: boolean;
  globalSettings: GlobalSettings;
  selectedTemplate: PrintTemplate | null;
  taglineText: string;
  optionalLogoUrl: string;
  activeFilter: FilterType;
}

// ── Device ───────────────────────────────────────────────────────

export interface DeviceInfo {
  token: string;
  platform: 'android' | 'ios';
  model: string;
  osVersion: string;
}

// ── Kiosk ────────────────────────────────────────────────────────

export interface KioskManager {
  startKiosk(): Promise<void>;
  stopKiosk(): Promise<void>;
  isKioskEnabled(): Promise<boolean>;
}
