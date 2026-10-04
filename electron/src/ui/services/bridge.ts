import type { HardwareSnapshot, Installation } from '../types'

const INSTALLATION_KEY = 'happypix.booth.installation'
let browserPrints = 0
let browserShutters = 0

function browserHardware(): HardwareSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    platform: navigator.platform || 'browser',
    release: 'preview',
    camera: {
      connected: true,
      working: true,
      provider: 'browser-preview',
      model: 'Preview camera',
      shutterCount: browserShutters,
      batteryPct: null,
      error: null,
    },
    printer: {
      connected: true,
      working: true,
      provider: 'dnp-sdk-simulator',
      model: 'DNP adapter simulator',
      printsTotal: browserPrints,
      queueDepth: 0,
      error: null,
    },
    kioskScreen: {
      connected: true,
      external: false,
      displayCount: 1,
      width: window.screen.width,
      height: window.screen.height,
      scaleFactor: window.devicePixelRatio,
      error: null,
    },
  }
}

export const bridge = {
  async getInstallation(): Promise<Installation | null> {
    if (window.booth) return window.booth.getInstallation()
    try {
      const value = localStorage.getItem(INSTALLATION_KEY)
      return value ? JSON.parse(value) as Installation : null
    } catch {
      return null
    }
  },

  async saveInstallation(value: Installation): Promise<void> {
    if (window.booth) return window.booth.saveInstallation(value)
    localStorage.setItem(INSTALLATION_KEY, JSON.stringify(value))
  },

  async clearInstallation(): Promise<void> {
    if (window.booth) return window.booth.clearInstallation()
    localStorage.removeItem(INSTALLATION_KEY)
  },

  async hardware(): Promise<HardwareSnapshot> {
    if (window.booth) return window.booth.getSystemSnapshot()
    return browserHardware()
  },

  async reportCamera(value: {
    connected: boolean
    working: boolean
    batteryPct: number | null
    model: string | null
    error: string | null
  }): Promise<void> {
    if (window.booth) await window.booth.reportCamera(value)
  },

  async recordCapture(): Promise<void> {
    browserShutters += 1
    if (window.booth) await window.booth.recordCapture()
  },

  async print(value: {
    copies: number
    layoutId: string
    templateName: string
    bitmapDataUrl?: string
  }): Promise<{ success: boolean; jobId: string }> {
    if (window.booth) return window.booth.print(value)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    browserPrints += value.copies
    return { success: true, jobId: `PREVIEW-${Date.now()}` }
  },
}
