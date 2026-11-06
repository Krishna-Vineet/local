// ─────────────────────────────────────────────────────────────────────────────
//  CaptureService.ts
//  Handles the full shutter-trigger sequence for Nikon cameras:
//  countdown → shutter → image retrieval → dataUrl delivery to renderer.
// ─────────────────────────────────────────────────────────────────────────────

import { cameraManager } from './cameraManager.js'

export interface CaptureResult {
  success: boolean
  dataUrl: string | null
  path:    string | null
  error?:  string
  durationMs: number
}

// ── CaptureService ────────────────────────────────────────────────────────────

class CaptureService {
  private capturing = false

  get isCapturing(): boolean { return this.capturing }

  /**
   * Trigger a single capture and return the result.
   * Throws if a capture is already in progress.
   */
  async capture(): Promise<CaptureResult> {
    if (this.capturing) {
      return {
        success: false,
        dataUrl: null,
        path:    null,
        error:   'Capture already in progress',
        durationMs: 0,
      }
    }
    this.capturing = true
    const t0 = Date.now()

    try {
      const result = await cameraManager.capture()
      const durationMs = Date.now() - t0

      if (result.error && !result.dataUrl) {
        console.warn('[CaptureService] Capture error:', result.error)
        return { success: false, dataUrl: null, path: null, error: result.error, durationMs }
      }

      console.log(`[CaptureService] ✅ Captured in ${durationMs} ms — ${result.path ?? '(no path)'}`)
      return {
        success: true,
        dataUrl: result.dataUrl,
        path:    result.path,
        durationMs,
      }
    } finally {
      this.capturing = false
    }
  }
}

export const captureService = new CaptureService()

