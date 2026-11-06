// ─────────────────────────────────────────────────────────────────────────────
//  LiveViewService.ts
//  Manages a push-based live view stream from the connected Nikon camera.
//  Polls the NikonAdapter at ~24 FPS and pushes JPEG frames to any registered
//  Electron WebContents (the booth renderer) via IPC.
// ─────────────────────────────────────────────────────────────────────────────

import { type WebContents } from 'electron'
import { nikonAdapter } from './nikonAdapter.js'
import { cameraManager } from './cameraManager.js'

// Target ~24 FPS; actual rate depends on camera model and USB speed
const TARGET_FPS   = 24
const POLL_INTERVAL_MS = Math.round(1000 / TARGET_FPS)

// IPC channel sent to renderer for each new frame
export const IPC_LIVE_VIEW_FRAME = 'nikon:liveview-frame'

// ── LiveViewService ───────────────────────────────────────────────────────────

class LiveViewService {
  private timer: ReturnType<typeof setInterval> | null = null
  private subscribers: Set<WebContents> = new Set()
  private running = false
  private frameCount = 0
  private lastFrameHash = ''    // skip identical frames (no-op camera)

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Start streaming live view frames to all registered WebContents.
   * Also instructs the camera to begin live view mode.
   */
  async start(sender?: WebContents): Promise<{ ok: boolean; error?: string }> {
    if (sender) this.subscribe(sender)

    const result = await cameraManager.startLiveView()
    if (!result.ok) return result

    if (!this.running) {
      this.running = true
      this.frameCount = 0
      this.timer = setInterval(() => void this._tick(), POLL_INTERVAL_MS)
    }
    return { ok: true }
  }

  /**
   * Stop streaming. If no more subscribers remain, also stops camera live view.
   */
  async stop(sender?: WebContents): Promise<void> {
    if (sender) this.unsubscribe(sender)
    if (this.subscribers.size > 0) return   // others still watching

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.running = false
    await cameraManager.stopLiveView()
  }

  /** Register a WebContents to receive live view frames. */
  subscribe(wc: WebContents): void {
    this.subscribers.add(wc)
    wc.on('destroyed', () => this.unsubscribe(wc))
  }

  /** Unregister a WebContents from live view frames. */
  unsubscribe(wc: WebContents): void {
    this.subscribers.delete(wc)
  }

  get isRunning(): boolean { return this.running }
  get subscriberCount(): number { return this.subscribers.size }
  get totalFramesSent(): number { return this.frameCount }

  /** Clean shutdown (called from main.ts on app quit). */
  async shutdown(): Promise<void> {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.running = false
    this.subscribers.clear()
    if (nikonAdapter.isReady) {
      await nikonAdapter.stopLiveView().catch(() => {})
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private async _tick(): Promise<void> {
    if (!this.running || this.subscribers.size === 0) return

    try {
      const frame = await cameraManager.getLiveViewFrame()
      if (!frame) return

      // Skip if identical to last frame (camera paused, mirror lockup, etc.)
      if (frame === this.lastFrameHash) return
      this.lastFrameHash = frame

      this.frameCount++
      const payload = `data:image/jpeg;base64,${frame}`

      // Broadcast to all live subscribers
      const dead: WebContents[] = []
      for (const wc of this.subscribers) {
        if (wc.isDestroyed()) { dead.push(wc); continue }
        wc.send(IPC_LIVE_VIEW_FRAME, { frameDataUrl: payload, frameIndex: this.frameCount })
      }
      dead.forEach((wc) => this.subscribers.delete(wc))
    } catch {
      // Transient error — keep running; camera may be mid-capture
    }
  }
}

export const liveViewService = new LiveViewService()

