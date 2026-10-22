import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface DnpTelemetryResult {
  success: boolean
  connected: boolean
  printerName?: string
  status: 'idle' | 'printing' | 'paper_end' | 'ribbon_end' | 'cover_open' | 'paper_jam' | 'offline'
  statusCode?: number
  paperRemaining: number | null
  initialMediaCount?: number | null
  ribbonPercent: number | null
  lifetimePrints: number | null
  error: string | null
}

let cachedTelemetry: { at: number; data: DnpTelemetryResult } = {
  at: 0,
  data: {
    success: true,
    connected: false,
    status: 'offline',
    paperRemaining: null,
    ribbonPercent: null,
    lifetimePrints: null,
    error: 'Printer offline',
  },
}

/**
 * Query real-time DNP RX1HS hardware telemetry via CyStat64.dll
 * Caches results for 10 seconds to avoid excessive USB bus polling
 */
export async function getDnpTelemetry(printerName = ''): Promise<DnpTelemetryResult> {
  if (process.platform !== 'win32') {
    return {
      success: false,
      connected: false,
      status: 'offline',
      paperRemaining: null,
      ribbonPercent: null,
      lifetimePrints: null,
      error: 'DNP CyStat SDK is supported on Windows only',
    }
  }

  // Return cached telemetry if recent (< 10s)
  if (Date.now() - cachedTelemetry.at < 10_000) {
    return cachedTelemetry.data
  }

  const scriptPath = path.resolve(process.cwd(), 'resources', 'dnp', 'dnpStatus.ps1')
  const safePrinterArg = printerName ? ` -PrinterName "${printerName.replace(/"/g, '')}"` : ''

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"${safePrinterArg}`,
      { timeout: 8000 }
    )

    const parsed = JSON.parse(stdout.trim()) as DnpTelemetryResult
    cachedTelemetry = { at: Date.now(), data: parsed }
    return parsed
  } catch (err: any) {
    const fallback: DnpTelemetryResult = {
      success: false,
      connected: false,
      status: 'offline',
      paperRemaining: null,
      ribbonPercent: null,
      lifetimePrints: null,
      error: err.message || 'Error querying DNP hardware status',
    }
    cachedTelemetry = { at: Date.now(), data: fallback }
    return fallback
  }
}
