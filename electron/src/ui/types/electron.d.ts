import type { HardwareSnapshot, Installation } from '../types'

declare global {
  interface Window {
    booth?: {
      getInstallation(): Promise<Installation | null>
      saveInstallation(value: Installation): Promise<void>
      clearInstallation(): Promise<void>
      getDeviceUuid(): Promise<string>
      clearDeviceIdentity(): Promise<void>
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
      canonProbe(ip?: string): Promise<{
        connected: boolean
        model: string | null
        ip: string
        port: number
        batteryPct: number | null
        error: string | null
      }>
      canonCapture(): Promise<{ success: boolean; error: string | null }>
      setKiosk(enabled: boolean): Promise<boolean>
      appInfo(): Promise<{ version: string; platform: string; packaged: boolean }>
    }
  }
}

export {}
