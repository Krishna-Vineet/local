import type { HardwareSnapshot, Installation } from '../types'

declare global {
  interface Window {
    booth?: {
      getInstallation(): Promise<Installation | null>
      getDeviceUuid(): Promise<string>
      saveInstallation(value: Installation): Promise<void>
      clearInstallation(): Promise<void>
      getSystemSnapshot(): Promise<HardwareSnapshot>
      reportCamera(value: {
        connected: boolean
        working: boolean
        batteryPct: number | null
        model: string | null
        error: string | null
      }): Promise<void>
      recordCapture(): Promise<number>
      print(value: {
        copies: number
        layoutId: string
        templateName: string
        bitmapDataUrl?: string
      }): Promise<{
        success: boolean
        jobId: string
        provider: string
        copies: number
        printsTotal: number
        warning: string
      }>
      setKiosk(enabled: boolean): Promise<boolean>
      appInfo(): Promise<{ version: string; platform: string; packaged: boolean }>
    }
  }
}

export {}
