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
  | 'success'

export type Orientation = 'portrait' | 'landscape'
export type FilterId = 'original' | 'warm' | 'cool' | 'bw' | 'vintage' | 'soft' | 'party'
export type OrnamentId = 'none' | 'confetti' | 'stars' | 'bubbles' | 'hearts'

export interface LayoutSlot {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export interface LayoutDefinition {
  id: string
  familyId: string
  label: string
  printSize: string
  sheetSize: string
  orientation: Orientation
  slots: number
  canvas: { width: number; height: number }
  photoSlots: LayoutSlot[]
}

export interface TemplateDesign {
  background: { type: 'solid' | 'gradient' | 'image'; colors: string[]; url?: string }
  accent: string
  textColor: string
  ornament: OrnamentId
  slotShape: 'square' | 'rounded' | 'pill'
  title: string
  subtitle: string
}

export interface BoothTemplate {
  id: string
  name: string
  category: string
  description: string
  source: 'designer' | 'playground' | 'ai_generated'
  componentId?: string
  layout: LayoutDefinition
  design: TemplateDesign
  active: boolean
}

export interface BoothEvent {
  id: string
  organizationId: string
  name: string
  clientName: string
  location: string
  startDate: string
  endDate: string
  status: 'live' | 'upcoming' | 'finished' | 'paused'
  digitalCopy: boolean
  filters: FilterId[]
  branding: {
    logos: string[]
    tagline: string
  }
  layoutPrices: Record<string, number>
  templates: BoothTemplate[]
  revision: string
  templateContractVersion: number
}

export interface BoothSettings {
  organizationName: string
  boothTimeoutSec: number
  payoutMode: 'upi' | 'wallet'
  upiId: string | null
  paymentDisplayName: string
  currency: 'INR'
  maximumPrints: number
}

export interface Installation {
  deviceUuid: string
  deviceToken: string
  deviceId: string
  organizationId: string
  pairedAt: string
  locationLabel?: string
}

export interface BoothSnapshot {
  device: { id: string; name: string; uuid: string }
  organization: { id: string; name: string }
  event: BoothEvent | null
  settings: BoothSettings
  revision: string
  serverTime: string
}

export interface HardwareSnapshot {
  capturedAt: string
  platform: string
  release: string
  camera: {
    connected: boolean
    working: boolean
    provider: string
    model: string | null
    shutterCount: number
    batteryPct: number | null
    error: string | null
  }
  printer: {
    connected: boolean
    working: boolean
    provider: string
    model: string
    printsTotal: number
    queueDepth: number
    error: string | null
  }
  kioskScreen: {
    connected: boolean
    external: boolean
    displayCount: number
    width: number
    height: number
    scaleFactor: number
    error: string | null
  }
}

export interface CheckoutQuote {
  quoteId: string
  unitPrice: number
  prints: number
  gross: number
  discount: number
  finalAmount: number
  couponCode: string | null
  couponMessage: string | null
  settlement: 'upi' | 'wallet'
  expiresAt: string
}

export interface PaymentOrder {
  paymentId: string
  qrPayload: string
  amount: number
  status: 'pending' | 'paid' | 'failed'
}

export interface CapturedPhoto {
  id: string
  dataUrl: string
  capturedAt: string
}

export interface PlacedSticker {
  id: string
  emoji: string
  x: number
  y: number
}

export interface Customization {
  ornament: OrnamentId
  filter: FilterId
  logo: string | null
  title: string
  subtitle: string
  stickers: PlacedSticker[]
}

export interface BoothSession {
  id: string
  startedAt: string
  orientation: Orientation | null
  template: BoothTemplate | null
  prints: number
  digitalCopy: boolean
  quote: CheckoutQuote | null
  payment: PaymentOrder | null
  photos: CapturedPhoto[]
  selectedPhotos: CapturedPhoto[]
  customization: Customization
}

export interface PrintOutcome {
  success: boolean
  jobId: string | null
  error: string | null
  shareUrl: string | null
}
