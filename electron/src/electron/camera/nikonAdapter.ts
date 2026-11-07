// ─────────────────────────────────────────────────────────────────────────────
//  NikonAdapter.ts
//  TypeScript adapter for the Nikon Remote SDK v2.x.
//  Spawns NikonBridge.ps1 as a child process, communicates via stdin/stdout
//  JSON protocol (line-delimited).  Electron main process only — never renderer.
// ─────────────────────────────────────────────────────────────────────────────

import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { app } from 'electron'

// ── Public types ──────────────────────────────────────────────────────────────

export interface NikonDeviceInfo {
  id: number
  name: string
  available: boolean
  /** USB product ID reported by Nikon's device-enumeration structure. */
  productId?: number
  version: string
}

export interface NikonStatus {
  sdkInitialized: boolean
  connected: boolean
  model: string
  liveView: boolean
  batteryPct: number | null
}

export interface NikonCaptureResult {
  captured: boolean
  path: string | null
  /** dataUrl is populated after readImage() is called on the path */
  dataUrl?: string
}

export type NikonAdapterEvent =
  | 'ready'           // bridge process started & SDK handshake received
  | 'camera_added'    // a Nikon camera was plugged in
  | 'camera_removed'  // a Nikon camera was unplugged
  | 'error'           // unrecoverable error from bridge
  | 'disconnected'    // bridge process exited

// ── Capability IDs (MAID3-COMMON spec) ───────────────────────────────────────

export const NikonCapability = {
  // Remote SDK v2 D1 capabilities from Maid3d1.h.
  BatteryLevel: 48,
  ExposureMode: 0x8111,
  ShutterSpeed: 0x8112,
  Aperture:     0x8113,
  ISO:          0x8117,
} as const

// ── NKERROR result codes ──────────────────────────────────────────────────────

export const NKERROR_NO_ERROR = 0

// ── Internal pending-request tracking ────────────────────────────────────────

interface Pending {
  resolve: (data: unknown) => void
  reject:  (err: Error) => void
  timer:   ReturnType<typeof setTimeout>
}

// ── NikonAdapter ──────────────────────────────────────────────────────────────

export class NikonAdapter extends EventEmitter {
  private proc: ChildProcess | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1
  private _ready = false
  private _destroyed = false
  /** Configured on Mac Electron to control a Windows USB host over the LAN. */
  private remoteBaseUrl: string | null = null
  private lineBuffer = ''
  /** Poll interval handle for device-list watching (when no camera connected) */
  private watchTimer: ReturnType<typeof setInterval> | null = null

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Start the bridge process. Resolves when the bridge signals ready. */
  async start(): Promise<void> {
    if (this._ready) return
    if (process.platform !== 'win32') {
      const remoteBase = this._resolveRemoteBaseUrl()
      if (!remoteBase) {
        throw new Error('Set HAPPYPIX_NIKON_BRIDGE_HOST or HAPPYPIX_NIKON_BRIDGE_URL to the Windows camera host.')
      }
      this.remoteBaseUrl = remoteBase
      this._destroyed = false
      this._ready = true
      this._knownDeviceIds.clear()
      this._startWatch()
      console.info(`[NikonAdapter] Using Windows Nikon camera bridge at ${remoteBase}`)
      return
    }
    this.remoteBaseUrl = null
    const scriptPath = this._resolveScript()
    this.proc = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.dirname(scriptPath),
      windowsHide: true,
      env: {
        ...process.env,
        ...(process.env.HAPPYPIX_NIKON_SDK_DIR || process.env.NIKON_SDK_DIR
          ? { HAPPYPIX_NIKON_SDK_DIR: process.env.HAPPYPIX_NIKON_SDK_DIR || process.env.NIKON_SDK_DIR }
          : {}),
      },
    })

    this.proc.stdout!.setEncoding('utf8')
    this.proc.stdout!.on('data', (chunk: string) => this._onData(chunk))

    this.proc.stderr!.setEncoding('utf8')
    this.proc.stderr!.on('data', (data: string) => {
      const trimmed = data.trim()
      if (trimmed) console.error('[NikonAdapter] stderr:', trimmed)
    })

    this.proc.on('error', (err) => {
      const message = `Unable to launch Nikon PowerShell bridge: ${err.message}`
      console.error('[NikonAdapter]', message)
      this._ready = false
      this._rejectAll(new Error(message))
      this._stopWatch()
      this.emit('error', new Error(message))
    })

    this.proc.on('exit', (code) => {
      console.warn(`[NikonAdapter] Bridge exited with code ${code}`)
      this._ready = false
      this._rejectAll(new Error(`Nikon bridge exited (code ${code})`))
      this._stopWatch()
      if (!this._destroyed) this.emit('disconnected', code)
    })

    // Wait for the ready handshake (id=0)
    await new Promise<void>((resolve, reject) => {
      const tid = setTimeout(() => reject(new Error('NikonBridge start timeout (10s)')), 10_000)
      this.once('ready', () => { clearTimeout(tid); resolve() })
      this.once('error', (e: Error) => { clearTimeout(tid); reject(e) })
    })

    // Initialize SDK and record which native package was actually loaded; this
    // is especially useful when a camera-specific Nikon SDK is selected by env.
    const sdk = await this._send<{ sdkDir?: string; sdkVersion?: string; processBits?: number }>('init')
    console.info(
      `[NikonAdapter] SDK loaded from ${sdk.sdkDir ?? 'default resources'} ` +
      `(ControlServiceLayer ${sdk.sdkVersion ?? 'unknown'}, ${sdk.processBits ?? 'unknown'}-bit process)`,
    )
    // Establish the baseline before polling. Without it, a camera already
    // present at startup is reported as newly added after the first poll and
    // can trigger a second ConnectDevice call while initial auto-connect runs.
    try {
      const devices = await this.listDevices()
      this._knownDeviceIds = new Set(devices.filter((d) => d.available).map((d) => d.id))
    } catch (err) {
      console.debug('[NikonAdapter] Initial device enumeration unavailable:', err)
    }
    this._startWatch()
  }

  /** Cleanly shut down the bridge. */
  async stop(): Promise<void> {
    this._destroyed = true
    this._stopWatch()
    if (this.proc && !this.proc.killed) {
      try { await this._send('shutdown') } catch { /* best-effort */ }
      this.proc.stdin?.end()
      this.proc.kill()
      this.proc = null
    }
    this._rejectAll(new Error('NikonAdapter stopped'))
    this._ready = false
  }

  get isReady(): boolean { return this._ready }

  // ── Camera operations ─────────────────────────────────────────────────────

  /** List currently detected Nikon cameras. */
  async listDevices(): Promise<NikonDeviceInfo[]> {
    if (this.remoteBaseUrl) {
      const status = await this._remoteJson('/api/camera/status')
      return status.connected
        ? [{ id: 0, name: String(status.model || 'Nikon camera (Windows host)'), available: true, version: 'LAN bridge' }]
        : []
    }
    const r = await this._send<{ devices: NikonDeviceInfo[] }>('devices')
    return r.devices ?? []
  }

  /** Connect to the first available Nikon camera, or a specific enumerated device ID. */
  async connect(deviceId?: number): Promise<{ connected: boolean; name: string; id: number }> {
    if (this.remoteBaseUrl) {
      const status = await this._remoteJson('/api/camera/status')
      if (!status.connected) throw new Error('Nikon camera is not connected to the Windows host.')
      return { connected: true, name: String(status.model || 'Nikon camera'), id: deviceId ?? 0 }
    }
    return this._send('connect', deviceId === undefined ? undefined : { deviceId })
  }

  /** Disconnect from camera. */
  async disconnect(): Promise<void> {
    if (this.remoteBaseUrl) return // The Windows host owns the physical camera session.
    await this._send('disconnect')
  }

  /** Get current SDK + camera status. */
  async getStatus(): Promise<NikonStatus> {
    if (this.remoteBaseUrl) {
      const status = await this._remoteJson('/api/camera/status')
      return {
        sdkInitialized: true,
        connected: !!status.connected,
        model: String(status.model || ''),
        liveView: !!status.liveView,
        batteryPct: typeof status.batteryPct === 'number' && Number.isFinite(status.batteryPct) ? status.batteryPct : null,
      }
    }
    return this._send('status')
  }

  // ── Live View ─────────────────────────────────────────────────────────────

  async startLiveView(): Promise<void> {
    if (this.remoteBaseUrl) {
      await this._remoteJson('/api/camera/liveview', { method: 'POST' })
      return
    }
    await this._send('liveview_start')
  }

  async stopLiveView(): Promise<void> {
    if (this.remoteBaseUrl) {
      await this._remoteJson('/api/camera/liveview/stop', { method: 'POST' })
      return
    }
    await this._send('liveview_stop')
  }

  /**
   * Fetch the latest Live View JPEG frame.
   * Returns base64-encoded JPEG data or null if no frame ready yet.
   */
  async getLiveViewFrame(): Promise<string | null> {
    if (this.remoteBaseUrl) {
      const response = await this._remoteFetch('/api/camera/liveview')
      if (response.status === 204) return null
      if (!response.ok) throw new Error(`Windows camera host returned ${response.status} for live view.`)
      const bytes = Buffer.from(await response.arrayBuffer())
      return bytes.toString('base64')
    }
    const r = await this._send<{ frame: string | null; count: number }>('liveview_frame')
    return r.frame ?? null
  }

  // ── Capture ───────────────────────────────────────────────────────────────

  /**
   * Trigger shutter and wait for image to be saved to disk.
   * Returns the captured image as a data URL (JPEG).
   */
  async capture(): Promise<NikonCaptureResult> {
    if (this.remoteBaseUrl) {
      const result = await this._remoteJson('/api/camera/capture', { method: 'POST' })
      if (!result.success || typeof result.dataUrl !== 'string') return { captured: false, path: null }
      return { captured: true, path: typeof result.path === 'string' ? result.path : null, dataUrl: result.dataUrl }
    }
    const r = await this._send<{ captured: boolean; path: string; status: number }>('capture')
    if (!r.captured || !r.path) {
      return { captured: false, path: null }
    }
    try {
      const img = await this._send<{ dataUrl: string; size: number; ext: string }>(
        'read_image', { path: r.path },
      )
      return { captured: true, path: r.path, dataUrl: img.dataUrl }
    } catch {
      return { captured: true, path: r.path }
    }
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async getCapability(capId: number): Promise<{ capId: number; value: number; dataType: number }> {
    if (this.remoteBaseUrl) {
      return this._remoteJson<{ capId: number; value: number; dataType: number }>(`/api/camera/capability?capId=${encodeURIComponent(capId)}`)
    }
    return this._send('get_cap', { capId })
  }

  async setCapability(capId: number, value: number): Promise<void> {
    if (this.remoteBaseUrl) {
      await this._remoteJson('/api/camera/capability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capId, value }),
      })
      return
    }
    await this._send('set_cap', { capId, value })
  }

  async getBatteryPercent(): Promise<number | null> {
    try {
      const st = await this.getStatus()
      return st.batteryPct
    } catch {
      return null
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _resolveScript(): string {
    // In dev: resources/nikon relative to project root
    // In packaged: resources/nikon inside extraResources
    const base = app.isPackaged
      ? path.join(process.resourcesPath, 'resources', 'nikon')
      : path.resolve(process.cwd(), 'resources', 'nikon')
    return path.join(base, 'NikonBridge.ps1')
  }

  private _resolveRemoteBaseUrl(): string | null {
    const configured = process.env.HAPPYPIX_NIKON_BRIDGE_URL || process.env.HAPPYPIX_NIKON_BRIDGE_HOST
    if (!configured?.trim()) return null
    const raw = configured.trim()
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`)
    if (!url.port) url.port = '9123'
    if (url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Nikon bridge URL must contain only the Windows host and optional port.')
    }
    return url.origin
  }

  private async _remoteFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
    if (!this.remoteBaseUrl) throw new Error('Windows Nikon bridge URL is not configured.')
    return fetch(`${this.remoteBaseUrl}${pathname}`, {
      ...init,
      signal: init.signal || AbortSignal.timeout(8_000),
    })
  }

  private async _remoteJson<T extends Record<string, unknown> = Record<string, unknown>>(
    pathname: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await this._remoteFetch(pathname, init)
    const body = await response.text()
    let data: Record<string, unknown> = {}
    try { data = body ? JSON.parse(body) as Record<string, unknown> : {} } catch { /* handled below */ }
    if (!response.ok || data.success === false) {
      throw new Error(typeof data.error === 'string' ? data.error : `Windows camera host returned ${response.status}.`)
    }
    return data as T
  }

  private _send<T = Record<string, unknown>>(cmd: string, extra?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.proc || this.proc.killed) {
        reject(new Error('NikonBridge not running'))
        return
      }
      const id = this.nextId++
      const msg = JSON.stringify({ id, cmd, ...extra }) + '\n'
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`NikonAdapter command "${cmd}" timed out (${id})`))
      }, cmd === 'init' ? 15_000 : cmd === 'capture' ? 12_000 : 5_000)

      this.pending.set(id, {
        resolve: (data) => resolve(data as T),
        reject,
        timer,
      })

      this.proc!.stdin!.write(msg, 'utf8')
    })
  }

  private _onData(chunk: string): void {
    this.lineBuffer += chunk
    const lines = this.lineBuffer.split('\n')
    this.lineBuffer = lines.pop() ?? ''
    for (const raw of lines) {
      const line = raw.trim()
      if (!line) continue
      this._handleLine(line)
    }
  }

  private _handleLine(line: string): void {
    let msg: { id: number; ok: boolean; data?: unknown; error?: string }
    try {
      msg = JSON.parse(line) as typeof msg
    } catch {
      // Native Nikon logging writes directly to the child's stdout and can
      // prefix/suffix a bridge response on the same line. Recover a complete
      // JSON object if one is embedded rather than dropping the command reply.
      const embedded = this._extractJsonObject(line)
      if (!embedded) {
        console.debug('[NikonAdapter] Nikon SDK diagnostic:', line.slice(0, 240))
        return
      }
      try {
        msg = JSON.parse(embedded) as typeof msg
      } catch {
        console.debug('[NikonAdapter] Unparsed Nikon bridge output:', line.slice(0, 240))
        return
      }
    }

    // id=0: ready handshake
    if (msg.id === 0) {
      if (msg.ok) {
        this._ready = true
        this.emit('ready')
      } else {
        this.emit('error', new Error(msg.error ?? 'Bridge init error'))
      }
      return
    }

    const p = this.pending.get(msg.id)
    if (!p) return
    clearTimeout(p.timer)
    this.pending.delete(msg.id)

    if (msg.ok) {
      p.resolve(msg.data ?? {})
    } else {
      p.reject(new Error(msg.error ?? `NikonBridge error (id=${msg.id})`))
    }
  }

  private _extractJsonObject(line: string): string | null {
    for (let start = line.indexOf('{'); start >= 0; start = line.indexOf('{', start + 1)) {
      let depth = 0
      let inString = false
      let escaped = false
      for (let i = start; i < line.length; i += 1) {
        const ch = line[i]
        if (inString) {
          if (escaped) escaped = false
          else if (ch === '\\') escaped = true
          else if (ch === '"') inString = false
          continue
        }
        if (ch === '"') inString = true
        else if (ch === '{') depth += 1
        else if (ch === '}' && --depth === 0) return line.slice(start, i + 1)
      }
    }
    return null
  }

  private _rejectAll(err: Error): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(err)
    }
    this.pending.clear()
  }

  /** Poll for device list when no camera is connected, emit events on changes. */
  private _knownDeviceIds = new Set<number>()

  private _startWatch(): void {
    if (this.watchTimer) return
    this.watchTimer = setInterval(() => void this._pollDevices(), 3_000)
  }

  private _stopWatch(): void {
    if (this.watchTimer) {
      clearInterval(this.watchTimer)
      this.watchTimer = null
    }
  }

  private async _pollDevices(): Promise<void> {
    if (!this._ready || this._destroyed) return
    try {
      const devices = await this.listDevices()
      const currentIds = new Set(devices.filter((d) => d.available).map((d) => d.id))

      for (const id of currentIds) {
        if (!this._knownDeviceIds.has(id)) {
          const dev = devices.find((d) => d.id === id)
          console.log(`[NikonAdapter] Camera added: ${dev?.name} (id=${id})`)
          this.emit('camera_added', dev)
        }
      }
      for (const id of this._knownDeviceIds) {
        if (!currentIds.has(id)) {
          console.log(`[NikonAdapter] Camera removed (id=${id})`)
          this.emit('camera_removed', id)
        }
      }
      this._knownDeviceIds = currentIds
    } catch {
      /* Ignore transient errors during polling */
    }
  }
}

// Singleton instance
export const nikonAdapter = new NikonAdapter()
