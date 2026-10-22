/* eslint-disable no-empty, no-useless-escape */
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
  queueDepth?: number
  orientation?: 'portrait' | 'landscape'
  quality?: string | null
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

// ───── Windows: DNP CyStat64.dll via PowerShell ─────
async function getWindowsDnpTelemetry(printerName = ''): Promise<DnpTelemetryResult> {
  // Return cached telemetry if recent (< 10s)
  if (Date.now() - cachedTelemetry.at < 10_000) {
    return cachedTelemetry.data
  }
  const scriptPath = path.resolve(process.cwd(), 'resources', 'dnp', 'dnpStatus.ps1')
  const safePrinterArg = printerName ? ` -PrinterName "${printerName.replace(/"/g, '')}"` : ''
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"${safePrinterArg}`,
      { timeout: 8000 },
    )
    const parsed = JSON.parse(stdout.trim()) as DnpTelemetryResult
    parsed.queueDepth = parsed.queueDepth ?? 0
    cachedTelemetry = { at: Date.now(), data: parsed }
    return parsed
  } catch (err: any) {
    // If script missing, fall back to WMI spooler check - still useful telemetry
    try {
      const wmi = await queryWindowsSpoolerTelemetry(printerName)
      if (wmi) {
        cachedTelemetry = { at: Date.now(), data: wmi }
        return wmi
      }
    } catch {}
    const fallback: DnpTelemetryResult = {
      success: false,
      connected: false,
      status: 'offline',
      paperRemaining: null,
      ribbonPercent: null,
      lifetimePrints: null,
      queueDepth: 0,
      error: err.message || 'Error querying DNP hardware status',
    }
    cachedTelemetry = { at: Date.now(), data: fallback }
    return fallback
  }
}

async function queryWindowsSpoolerTelemetry(printerName: string): Promise<DnpTelemetryResult | null> {
  // Use WMI/CIM to get real printer status without DNP SDK
  const ps = `
    $p = Get-CimInstance Win32_Printer ${printerName ? `-Filter "Name='${printerName.replace(/'/g, "''")}'"` : ''} | Select-Object -First 1
    $q = Get-PrintJob ${printerName ? `-PrinterName '${printerName.replace(/'/g, "''")}'` : ''} -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count
    if ($p) {
      @{ name=$p.Name; status=$p.PrinterStatus; state=$p.PrinterState; jobs=$q; workOffline=$p.WorkOffline; detected=$p.DetectedErrorState; default=$p.Default } | ConvertTo-Json -Compress
    }
  `
  const buf = Buffer.from(ps, 'utf16le').toString('base64')
  try {
    const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -EncodedCommand ${buf}`, { timeout: 8000 })
    const j = JSON.parse(stdout.trim()) as any
    if (!j?.name) return null
    const s = Number(j.status)
    // WMI PrinterStatus:  1 other, 2 unknown, 3 idle, 4 printing, 5 warmup, 6 stopped, 7 offline
    let status: DnpTelemetryResult['status'] = 'idle'
    if (j.workOffline) status = 'offline'
    else if (s === 4) status = 'printing'
    else if (s === 6) status = 'paper_jam'
    else if (s === 7) status = 'offline'
    const connected = s !== 7 && !j.workOffline
    return {
      success: true,
      connected,
      printerName: j.name,
      status,
      paperRemaining: null, // WMI cannot report dye-sub media count
      ribbonPercent: null,
      lifetimePrints: null,
      queueDepth: Number(j.jobs) || 0,
      error: connected ? null : 'Printer offline or not detected via WMI',
    }
  } catch {
    return null
  }
}

// ───── macOS/Linux: CUPS / lpstat telemetry ─────
export async function getCupsTelemetry(printerName = ''): Promise<DnpTelemetryResult> {
  try {
    // Resolve default if none supplied
    let target = printerName.trim()
    if (!target) {
      try {
        const { stdout } = await execAsync('lpstat -d 2>/dev/null | awk -F\": \" \'{print $2}\'', { timeout: 4000 })
        target = stdout.trim()
      } catch {}
    }
    if (!target) {
      // try first printer from lpstat -p
      try {
        const { stdout } = await execAsync('lpstat -p 2>/dev/null | awk \'{print $2}\' | head -n1', { timeout: 4000 })
        target = stdout.trim()
      } catch {}
    }
    if (!target) {
      return {
        success: false, connected: false, status: 'offline',
        paperRemaining: null, ribbonPercent: null, lifetimePrints: null,
        queueDepth: 0, error: 'No CUPS printer found. Install DNP/Citizen driver via System Settings > Printers.',
      }
    }

    // Printer enabled/idle state — lpstat -p <name>
    const { stdout: pOut } = await execAsync(`lpstat -p \"${target.replace(/"/g, '')}\" 2>&1`, { timeout: 4000 })
    const pLine = pOut.trim()
    const isIdle = /idle/i.test(pLine)
    const isEnabled = /enabled/i.test(pLine)
    const isPrinting = /printing/i.test(pLine)

    // Queue depth — lpstat -o [printer]
    let queueDepth = 0
    try {
      const { stdout: qOut } = await execAsync(`lpstat -o \"${target.replace(/"/g, '')}\" 2>/dev/null | wc -l`, { timeout: 4000 })
      queueDepth = parseInt(qOut.trim(), 10) || 0
      if (isNaN(queueDepth)) queueDepth = 0
    } catch {}

    // Media / options — lpoptions -p <printer> -l (lists printer capabilities)
    let quality: string | null = null
    let orientation: 'portrait' | 'landscape' | undefined
    try {
      const { stdout: optOut } = await execAsync(`lpoptions -p \"${target.replace(/"/g, '')}\" 2>/dev/null`, { timeout: 4000 })
      // e.g. "orientation-requested=3 print-quality=4"
      if (/print-quality=5/i.test(optOut)) quality = 'high'
      else if (/print-quality=4/i.test(optOut)) quality = 'normal'
      else if (optOut.trim()) quality = 'driver-default'
      const m = optOut.match(/orientation-requested=(\d)/)
      if (m) orientation = m[1] === '4' ? 'landscape' : 'portrait'
    } catch {}

    // CUPS options live — lpstat -l -p <printer> may contain "media: 4x6"
    let paperRemaining: number | null = null // CUPS does not expose dye-sub media count; leave null (honest)
    // Some DNP CUPS backends expose marker levels via `lpstat -l` — attempt to parse
    try {
      const { stdout: lOut } = await execAsync(`lpstat -l -p \"${target.replace(/"/g, '')}\" 2>/dev/null`, { timeout: 4000 })
      const paperM = lOut.match(/paperRemaining[:=]\s*(\d+)/i) || lOut.match(/media-remaining[:=]\s*(\d+)/i)
      if (paperM) paperRemaining = parseInt(paperM[1], 10)
    } catch {}

    let status: DnpTelemetryResult['status'] = 'idle'
    if (!isEnabled) status = 'offline'
    else if (isPrinting || queueDepth > 0) status = 'printing'
    else if (isIdle) status = 'idle'

    const connected = isEnabled && !!target

    return {
      success: true,
      connected,
      printerName: target,
      status,
      paperRemaining,
      initialMediaCount: null,
      ribbonPercent: null, // dye-sub ribbon % not exposed via CUPS; honest null
      lifetimePrints: null,
      queueDepth,
      orientation,
      quality,
      error: connected ? (queueDepth > 5 ? `Print queue has ${queueDepth} pending jobs` : null) : `CUPS printer '${target}' is disabled`,
    }
  } catch (err: any) {
    return {
      success: false, connected: false, status: 'offline',
      paperRemaining: null, ribbonPercent: null, lifetimePrints: null,
      queueDepth: 0, error: err.message || 'CUPS query failed',
    }
  }
}

// ───── Unified entry — always returns real machine data, never synthetic success ─────
export async function getDnpTelemetry(printerName = ''): Promise<DnpTelemetryResult> {
  if (process.platform === 'win32') {
    return getWindowsDnpTelemetry(printerName)
  }
  return getCupsTelemetry(printerName)
}
