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
      /** Durable disk queue — stage a finished session before the UI forgets it. */
      enqueueSession(value: {
        sessionId: string
        eventId?: string | null
        digitalCopy?: boolean
        guestConsent?: boolean
        composite: string
        photos: string[]
        apiUrl?: string
      }): Promise<{ success: boolean; sessionId: string; error?: string }>
      getQueueStatus(): Promise<{
        pendingCount: number
        uploadingCount: number
        uploadedCount: number
        failedCount: number
        totalBytesOnDisk: number
      }>
      getSessionStatus(sessionId: string): Promise<{
        sessionId: string
        state: 'pending' | 'uploading' | 'uploaded' | 'failed'
        attempts: number
        lastError: string | null
        downloadUrl: string | null
      } | null>
      markSessionUploaded(sessionId: string, details?: unknown): Promise<void>
      triggerQueueProcess(): Promise<void>
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

      // ── Nikon Remote SDK ─────────────────────────────────────────────────
      nikon: {
        /** Current camera provider & connection state */
        getStatus(): Promise<{
          provider: 'nikon-sdk' | 'canon-ccapi' | 'none'
          connected: boolean
          working: boolean
          model: string | null
          batteryPct: number | null
          liveView: boolean
          error: string | null
        }>
        /** List USB-connected Nikon cameras */
        listDevices(): Promise<{
          devices: Array<{ id: number; name: string; available: boolean; version: string }>
        }>
        /** Connect to the first available Nikon camera */
        connect(): Promise<{ ok: boolean; connected?: boolean; name?: string; id?: number; error?: string }>
        /** Disconnect camera */
        disconnect(): Promise<{ ok: boolean }>
        /** Start Live View (frames pushed via onLiveViewFrame) */
        startLiveView(): Promise<{ ok: boolean; error?: string }>
        /** Stop Live View */
        stopLiveView(): Promise<{ ok: boolean }>
        /**
         * Trigger shutter.
         * Returns captured image as a base64 data URL (JPEG).
         */
        capture(): Promise<{
          success: boolean
          dataUrl: string | null
          path: string | null
          durationMs: number
        }>
        /** Read ISO, exposure mode, shutter speed, aperture, battery */
        readSettings(): Promise<{
          ok: boolean
          settings?: {
            iso: string | null
            exposureMode: string | null
            shutterSpeed: number | null
            aperture: number | null
            batteryPct: number | null
          }
        }>
        setISO(iso: string): Promise<{ ok: boolean }>
        setExposureMode(mode: string): Promise<{ ok: boolean }>
        setShutterSpeed(raw: number): Promise<{ ok: boolean }>
        setAperture(raw: number): Promise<{ ok: boolean }>
        /** Low-level MAID capability access */
        getCapability(capId: number): Promise<{ ok: boolean; capId: number; value: number | null }>
        setCapability(capId: number, value: number): Promise<{ ok: boolean }>
        /**
         * Subscribe to pushed Live View frames.
         * Returns an unsubscribe function.
         */
        onLiveViewFrame(
          cb: (payload: { frameDataUrl: string; frameIndex: number }) => void
        ): () => void
      }
    }
  }
}

export {}
