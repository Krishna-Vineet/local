// ─────────────────────────────────────────────────────────────────
//  Canon CCAPI (Camera Control API) Client for Electron
//  Enables direct Wi-Fi tethering for Canon EOS R & modern DSLR/PowerShot bodies
//  without requiring native vendor binaries or driver installation.
// ─────────────────────────────────────────────────────────────────

export interface CanonCcapiStatus {
  connected: boolean
  model: string | null
  ip: string
  port: number
  batteryPct: number | null
  error: string | null
}

export class CanonCcapiClient {
  private ip: string
  private port: number
  private baseUrl: string

  constructor(ip = process.env.HAPPYPIX_CANON_IP || '192.168.1.2', port = 8080) {
    this.ip = ip
    this.port = port
    this.baseUrl = `http://${this.ip}:${this.port}`
  }

  setIp(ip: string, port = 8080): void {
    this.ip = ip.trim().replace(/^http:\/\//, '').replace(/\/.*$/, '')
    this.port = port
    this.baseUrl = `http://${this.ip}:${this.port}`
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
    timeoutMs = 4000,
  ): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      if (!res.ok) {
        throw new Error(`CCAPI ${method} ${path} failed with HTTP ${res.status}`)
      }
      const text = await res.text()
      return text ? (JSON.parse(text) as T) : ({} as T)
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Probe camera connectivity and retrieve model & battery status
   */
  async probe(): Promise<CanonCcapiStatus> {
    try {
      // 1. Device information
      const info = await this.request<{ productname?: string; serialnumber?: string }>(
        'GET',
        '/ccapi/ver110/deviceinformation',
        undefined,
        2500,
      )
      const model = info?.productname || 'Canon EOS Camera'

      // 2. Battery status (optional check)
      let batteryPct: number | null = null
      try {
        const batt = await this.request<{ battery?: { level?: string } }>(
          'GET',
          '/ccapi/ver110/devicestatus/battery',
          undefined,
          2000,
        )
        const level = batt?.battery?.level?.toLowerCase()
        if (level === 'full' || level === 'high') batteryPct = 95
        else if (level === 'medium') batteryPct = 60
        else if (level === 'low') batteryPct = 25
        else if (level === 'half') batteryPct = 50
      } catch {
        // Battery check non-fatal
      }

      return {
        connected: true,
        model,
        ip: this.ip,
        port: this.port,
        batteryPct,
        error: null,
      }
    } catch (err: any) {
      return {
        connected: false,
        model: null,
        ip: this.ip,
        port: this.port,
        batteryPct: null,
        error: err.message || 'Canon CCAPI not reachable on local network',
      }
    }
  }

  /**
   * Release shutter to capture a photo
   */
  async triggerShutter(): Promise<{ success: boolean; error: string | null }> {
    try {
      await this.request('POST', '/ccapi/ver110/shooting/control/shutterbutton', {
        af: true,
      })
      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: err.message || 'Shutter trigger failed' }
    }
  }
}

export const canonCcapi = new CanonCcapiClient()
