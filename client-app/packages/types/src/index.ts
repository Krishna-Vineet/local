// ─────────────────────────────────────────────────────────────────
//  Happypix Booth — Shared Type Definitions
//  Full specification aligning mobile tablet app and electron kiosk
// ─────────────────────────────────────────────────────────────────

export type ScreenId =
  | 'boot'
  | 'login'
  | 'waiting'
  | 'start'
  | 'orientation'
  | 'templates'
  | 'prints'
  | 'payment'
  | 'camera'
  | 'photos'
  | 'customize'
  | 'success';

export type Orientation = 'portrait' | 'landscape';
export type FilterId = 'original' | 'warm' | 'cool' | 'bw' | 'vintage' | 'soft' | 'party';
export type OrnamentId = 'none' | 'confetti' | 'stars' | 'bubbles' | 'hearts';

export interface LayoutSlot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface LayoutDefinition {
  id: string;
  familyId: string;
  label: string;
  printSize: string;
  sheetSize: string;
  orientation: Orientation;
  slots: number;
  canvas: { width: number; height: number };
  photoSlots: LayoutSlot[];
}

export interface TemplateDesign {
  background: { type: 'solid' | 'gradient' | 'image'; colors: string[]; url?: string };
  accent: string;
  textColor: string;
  ornament: OrnamentId;
  slotShape: 'square' | 'rounded' | 'pill';
  title: string;
  subtitle: string;
}

export interface BoothTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  source: 'designer' | 'playground' | 'ai_generated';
  componentId?: string;
  layout: LayoutDefinition;
  design: TemplateDesign;
  active: boolean;
}

export interface BoothEvent {
  id: string;
  organizationId: string;
  name: string;
  clientName: string;
  location: string;
  startDate: string;
  endDate: string;
  status: 'live' | 'upcoming' | 'finished' | 'paused';
  digitalCopy: boolean;
  filters: FilterId[];
  branding: {
    logos: string[];
    tagline: string;
  };
  layoutPrices: Record<string, number>;
  templates: BoothTemplate[];
  revision: string;
  templateContractVersion: number;
}

export interface BoothSettings {
  organizationName: string;
  boothTimeoutSec: number;
  payoutMode: 'upi' | 'wallet';
  upiId: string | null;
  paymentDisplayName: string;
  currency: 'INR';
  maximumPrints: number;
}

export interface Installation {
  deviceUuid: string;
  deviceToken: string;
  deviceId: string;
  organizationId: string;
  pairedAt: string;
  locationLabel?: string;
}

export interface BoothSnapshot {
  device: { id: string; name: string; uuid: string };
  organization: { id: string; name: string };
  event: BoothEvent | null;
  settings: BoothSettings;
  revision: string;
  serverTime: string;
}

export interface HardwareSnapshot {
  capturedAt: string;
  platform: string;
  release: string;
  camera: {
    connected: boolean;
    working: boolean;
    provider: string;
    model: string | null;
    shutterCount: number;
    batteryPct: number | null;
    error: string | null;
  };
  printer: {
    connected: boolean;
    working: boolean;
    provider: string;
    model: string;
    printsTotal: number;
    queueDepth: number;
    error: string | null;
  };
  kioskScreen: {
    connected: boolean;
    external: boolean;
    displayCount: number;
    width: number;
    height: number;
    scaleFactor: number;
    error: string | null;
  };
}

export interface CheckoutQuote {
  quoteId: string;
  unitPrice: number;
  prints: number;
  gross: number;
  discount: number;
  finalAmount: number;
  couponCode: string | null;
  couponMessage: string | null;
  settlement: 'upi' | 'wallet';
  expiresAt: string;
}

export interface PaymentOrder {
  paymentId: string;
  qrPayload: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed';
}

export interface CapturedPhoto {
  id?: string;
  uri: string;
  dataUrl?: string;
  width?: number;
  height?: number;
  capturedAt?: string;
  timestamp?: number;
  filter?: string;
}

export type FilterType =
  | 'none'
  | 'original'
  | 'vintage'
  | 'blackwhite'
  | 'bw'
  | 'warm'
  | 'cool'
  | 'soft'
  | 'party'
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
  canvas?: { width: number; height: number };
  dpi: 300 | 600;
  overlayUrl?: string;
  price?: number | null;
}

export interface CameraDiscoveryResult {
  type: CameraType;
  name: string;
  address?: string;
  serial?: string;
}

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

export interface PrinterProvider {
  readonly type: PrinterType;
  discover(): Promise<PrinterDevice[]>;
  connect(device: PrinterDevice): Promise<void>;
  disconnect(): Promise<void>;
  print(job: PrintJob): Promise<PrintResult>;
  getStatus(): Promise<PrinterStatus>;
}

export interface PlacedSticker {
  id: string;
  emoji: string;
  x: number; // percentage (0..100)
  y: number; // percentage (0..100)
}

export interface Customization {
  ornament: OrnamentId;
  filter: FilterId;
  logo: string | null;
  title: string;
  subtitle: string;
  stickers: PlacedSticker[];
}

export interface BoothSession {
  id: string;
  startedAt: string;
  orientation: Orientation | null;
  template: BoothTemplate | null;
  prints: number;
  digitalCopy: boolean;
  quote: CheckoutQuote | null;
  payment: PaymentOrder | null;
  photos: CapturedPhoto[];
  selectedPhotos: CapturedPhoto[];
  customization: Customization;
}

export interface PrintOutcome {
  success: boolean;
  jobId: string | null;
  error: string | null;
  shareUrl: string | null;
}

// ── Hardware Abstraction Types ─────────────────────────────────────

export type CameraType = 'phone' | 'sony' | 'canon' | 'ptp';

export interface CameraStatus {
  connected: boolean;
  type: CameraType;
  batteryLevel?: number;
  storageAvailable?: number;
  isRecording?: boolean;
  error?: string;
}

export type PrinterType = 'dnp' | 'citizen' | 'fuji' | 'airprint' | 'ipp';
export type PaperSize = '4x6' | '5x7' | '6x8' | '2x6_strip';

export interface PrinterDevice {
  type: PrinterType;
  name: string;
  address?: string;
  model?: string;
}

export interface PrintJob {
  bitmap?: string;
  copies: number;
  layoutId?: string;
  templateName?: string;
  paperSize?: PaperSize;
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
