// ─────────────────────────────────────────────────────────────────────────────
//  CameraManager.ts
//  Single orchestrator for camera lifecycle in HappyPix Electron kiosk.
//  Manages: Nikon SDK adapter, Canon CCAPI fallback, reconnect, telemetry.
// ─────────────────────────────────────────────────────────────────────────────

import { nikonAdapter, type NikonStatus } from './nikonAdapter.js'
import { canonCcapi, type CanonCcapiStatus } from '../canonCcapi.js'

// ── Public types ──────────────────────────────────────────────────────────────

export type CameraProvider = 'nikon-sdk' | 'canon-ccapi' | 'none'

export interface CameraState {
  provider: CameraProvider
  connected: boolean
  working:   boolean
  model:     string | null
  batteryPct: number | null
  liveView:  boolean
  error:     string | null
}

// ── CameraManager ─────────────────────────────────────────────────────────────

class CameraManager {
  private state: CameraState = {
    provider:   'none',
    connected:  false,
    working:    false,
    model:      null,
    batteryPct: null,
    liveView:   false,
    error:      'Camera not initialized',
  }

  private nikonStarted = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  // ── Initialization ──────────────────────────────────────────────────────

  /**
   * Called once from main.ts on app startup.
   * Tries Nikon SDK first, then Canon CCAPI, then marks as disconnected.
   */
  async initialize(): Promise<void> {
    console.log('[CameraManager] Initializing...')

    // 1. Try Nikon Remote SDK (Windows only)
    if (process.platform === 'win32') {
      await this._tryStartNikon()
    }

    // 2. Try Canon CCAPI (Wi-Fi, any platform) — secondary / additive
    const ccapi = await canonCcapi.probe().catch(() => null)
    if (ccapi?.connected && this.state.provider === 'none') {
      this._applyCanonState(ccapi)
    }
  }

  // ── Getters ─────────────────────────────────────────────────────────────

  getState(): CameraState {
    return { ...this.state }
  }

  /** Quick status snapshot suitable for heartbeat payload. */
  getHeartbeatReport() {
    return {
      provider:   this.state.provider,
      connected:  this.state.connected,
      working:    this.state.working,
      model:      this.state.model,
      batteryPct: this.state.batteryPct,
      live:       this.state.liveView,
      error:      this.state.error,
    }
  }

  // ── Live View ────────────────────────────────────────────────────────────

  async startLiveView(): Promise<{ ok: boolean; error?: string }> {
    if (this.state.provider === 'nikon-sdk') {
      try {
        await nikonAdapter.startLiveView()
        this.state.liveView = true
        return { ok: true }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return { ok: false, error: msg }
      }
    }
    return { ok: false, error: `Live view not supported on provider: ${this.state.provider}` }
  }

  async stopLiveView(): Promise<void> {
    if (this.state.provider === 'nikon-sdk' && nikonAdapter.isReady) {
      await nikonAdapter.stopLiveView().catch(() => {})
    }
    this.state.liveView = false
  }

  /**
   * Returns the latest live view JPEG as a base64 string,
   * or null if not active / no frame yet.
   */
  async getLiveViewFrame(): Promise<string | null> {
    if (this.state.provider === 'nikon-sdk' && nikonAdapter.isReady) {
      return nikonAdapter.getLiveViewFrame()
    }
    return null
  }

  // ── Capture ──────────────────────────────────────────────────────────────

  async capture(): Promise<{ dataUrl: string | null; path: string | null; error?: string }> {
    if (this.state.provider === 'nikon-sdk') {
      try {
        const result = await nikonAdapter.capture()
        if (!result.captured) {
          return { dataUrl: null, path: null, error: 'Nikon capture failed (no image returned)' }
        }
        return { dataUrl: result.dataUrl ?? null, path: result.path }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return { dataUrl: null, path: null, error: msg }
      }
    }

    if (this.state.provider === 'canon-ccapi') {
      try {
        await canonCcapi.triggerShutter()
        // Canon CCAPI delivers image via camera's own internal save; no direct transfer
        return { dataUrl: null, path: null, error: 'Canon CCAPI capture triggered (image on camera card)' }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return { dataUrl: null, path: null, error: msg }
      }
    }

    return { dataUrl: null, path: null, error: 'No camera connected' }
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  async getCapability(capId: number): Promise<number | null> {
    if (this.state.provider !== 'nikon-sdk') return null
    try {
      const r = await nikonAdapter.getCapability(capId)
      return r.value
    } catch {
      return null
    }
  }

  async setCapability(capId: number, value: number): Promise<boolean> {
    if (this.state.provider !== 'nikon-sdk') return false
    try {
      await nikonAdapter.setCapability(capId, value)
      return true
    } catch {
      return false
    }
  }

  /** Refresh battery percentage from camera. */
  async refreshBattery(): Promise<number | null> {
    if (this.state.provider === 'nikon-sdk' && nikonAdapter.isReady) {
      const pct = await nikonAdapter.getBatteryPercent()
      this.state.batteryPct = pct
      return pct
    }
    if (this.state.provider === 'canon-ccapi') {
      const st = await canonCcapi.probe().catch(() => null)
      if (st?.connected) this.state.batteryPct = st.batteryPct
      return this.state.batteryPct
    }
    return null
  }

  // ── Shutdown ─────────────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    this._clearReconnect()
    this.nikonStarted = false
    if (this.state.liveView) await this.stopLiveView()
    if (nikonAdapter.isReady) await nikonAdapter.stop().catch(() => {})
    this.state = {
      provider: 'none', connected: false, working: false,
      model: null, batteryPct: null, liveView: false, error: 'Shutdown',
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _tryStartNikon(): Promise<void> {
    if (this.nikonStarted) return
    try {
      console.log('[CameraManager] Starting Nikon SDK bridge...')
      await nikonAdapter.start()

      // Attach event handlers
      nikonAdapter.on('camera_added', () => void this._onNikonCameraAdded())
      nikonAdapter.on('camera_removed', () => void this._onNikonCameraRemoved())
      nikonAdapter.on('disconnected', () => void this._onBridgeDisconnected())

      this.nikonStarted = true

      // Attempt initial connection
      await this._tryConnectNikon()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[CameraManager] Nikon bridge start failed:', msg)
      this.state.error = `Nikon SDK unavailable: ${msg}`
    }
  }

  private async _tryConnectNikon(): Promise<void> {
    try {
      const devices = await nikonAdapter.listDevices()
      const available = devices.filter((d) => d.available)
      if (available.length === 0) {
        console.log('[CameraManager] No Nikon camera currently connected via USB')
        this.state = {
          ...this.state,
          provider: 'nikon-sdk',
          connected: false,
          working: false,
          model: null,
          error: 'No Nikon camera detected via USB. Please connect a supported camera.',
        }
        return
      }

      const result = await nikonAdapter.connect()
      if (result.connected) {
        const status = await nikonAdapter.getStatus()
        this._applyNikonState(status)
        console.log(`[CameraManager] ✅ Nikon connected: ${result.name}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[CameraManager] Nikon connect failed:', msg)
      this.state.error = msg
    }
  }

  private async _onNikonCameraAdded(): Promise<void> {
    console.log('[CameraManager] Nikon camera plugged in — connecting...')
    this._clearReconnect()
    await this._tryConnectNikon()
  }

  private async _onNikonCameraRemoved(): Promise<void> {
    console.warn('[CameraManager] Nikon camera unplugged')
    this.state.connected = false
    this.state.working = false
    this.state.liveView = false
    this.state.error = 'Camera disconnected (USB unplugged)'
    // Schedule auto-reconnect attempt in case user re-plugs
    this._scheduleReconnect()
  }

  private async _onBridgeDisconnected(): Promise<void> {
    console.warn('[CameraManager] Nikon bridge process exited unexpectedly — restarting...')
    this.state.connected = false
    this.state.working = false
    this.state.error = 'Nikon bridge crashed — restarting...'
    this._clearReconnect()

    // Wait 2 s then restart bridge
    this.reconnectTimer = setTimeout(async () => {
      this.nikonStarted = false
      await this._tryStartNikon()
    }, 2_000)
  }

  private _scheduleReconnect(): void {
    this._clearReconnect()
    this.reconnectTimer = setTimeout(() => {
      void this._tryConnectNikon()
    }, 5_000)
  }

  private _clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private _applyNikonState(st: NikonStatus): void {
    this.state = {
      provider:   'nikon-sdk',
      connected:  st.connected,
      working:    st.connected,
      model:      st.model || null,
      batteryPct: st.batteryPct,
      liveView:   st.liveView,
      error:      st.connected ? null : 'Nikon camera not responding',
    }
  }

  private _applyCanonState(st: CanonCcapiStatus): void {
    this.state = {
      provider:   'canon-ccapi',
      connected:  st.connected,
      working:    st.connected,
      model:      st.model,
      batteryPct: st.batteryPct,
      liveView:   false,
      error:      st.error,
    }
  }
}

export const cameraManager = new CameraManager()

