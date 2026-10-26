/* eslint-disable no-empty, no-useless-escape */
import { screen } from 'electron'
import os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { getCounters, incrementCounter } from './store.js'
import { getDnpTelemetry } from './dnpTelemetry.js'

const execAsync = promisify(exec)

export interface CameraReport {
  connected: boolean
  working: boolean
  batteryPct: number | null
  model: string | null
  error: string | null
  // Extended telemetry (available after bridge.reportCamera from renderer)
  batteryLevel?: number | null
  shutterCount?: number
  livePreview?: boolean
  orientation?: 'portrait' | 'landscape' | null
  quality?: string | null
}

let cameraReport: CameraReport = {
  connected: false,
  working: false,
  batteryPct: null,
  model: null,
  error: 'Waiting for camera discovery',
}

export function updateCameraReport(report: CameraReport): void {
  cameraReport = { ...report }
}

export async function recordCapture(): Promise<number> {
  return incrementCounter('shutterCount')
}

// Probe the OS for real printers (cached 30s — heartbeat calls this a lot).
// Must reflect the machine, not a simulator: real pipeline awareness.
let printerProbeCache: { at: number; printers: string[] } = { at: 0, printers: [] }

export async function probePrinters(): Promise<string[]> {
  if (Date.now() - printerProbeCache.at < 30_000) return printerProbeCache.printers
  let printers: string[] = []
  try {
    if (process.platform === 'win32') {
      // Get-Printer is richest; fallback to wmic for older Windows
      try {
        const { stdout } = await execAsync(
          'powershell -NoProfile -NonInteractive -Command "Get-Printer | Select-Object -ExpandProperty Name"',
          { timeout: 8000 },
        )
        printers = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      } catch {
        const { stdout } = await execAsync('wmic printer get name /value 2>nul', { timeout: 6000 })
        printers = stdout
          .split(/\r?\n/)
          .map((l) => l.replace(/^Name=/i, '').trim())
          .filter(Boolean)
      }
    } else {
      // macOS / Linux CUPS — both lpstat -e (destinations) and lpstat -p (printers) for coverage
      try {
        const { stdout } = await execAsync('lpstat -e 2>/dev/null; lpstat -p 2>/dev/null | awk \'{print $2}\'', { timeout: 5000 })
        printers = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      } catch {
        const { stdout } = await execAsync('lpstat -p 2>/dev/null | awk \'{print $2}\'', { timeout: 8000 })
        printers = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      }
      // de-duplicate (lpstat -e and -p can overlap)
      printers = [...new Set(printers)]
    }
  } catch {
    printers = []
  }
  printerProbeCache = { at: Date.now(), printers }
  return printers
}

// ── Printer detail helpers (Windows WMI + CUPS) ──
async function queryWindowsPrinterDetails(printerName: string): Promise<{
  queueDepth: number
  isDefault: boolean
  detectedError: string | null
  paperSize: string | null
}> {
  if (!printerName) return { queueDepth: 0, isDefault: false, detectedError: null, paperSize: null }
  const safe = printerName.replace(/'/g, "''")
  const ps = `
    $p = Get-CimInstance Win32_Printer -Filter "Name='${safe}'" -ErrorAction SilentlyContinue | Select-Object -First 1
    $jobs = (Get-PrintJob -PrinterName '${safe}' -ErrorAction SilentlyContinue | Measure-Object).Count
    if (-not $jobs) { $jobs = 0 }
    $size = (Get-PrintConfiguration -PrinterName '${safe}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty PaperSize -ErrorAction SilentlyContinue)
    @{ jobs=$jobs; isDefault=$p.Default; err=$p.DetectedErrorState; paper=$size } | ConvertTo-Json -Compress
  `
  try {
    const b64 = Buffer.from(ps, 'utf16le').toString('base64')
    const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -EncodedCommand ${b64}`, { timeout: 7000 })
    const j: any = JSON.parse(stdout.trim())
    return {
      queueDepth: Number(j.jobs) || 0,
      isDefault: !!j.isDefault,
      detectedError: j.err != null && j.err !== 0 ? String(j.err) : null,
      paperSize: j.paper ? String(j.paper) : null,
    }
  } catch {
    return { queueDepth: 0, isDefault: false, detectedError: null, paperSize: null }
  }
}

async function queryCupsPrinterDetails(printerName: string): Promise<{
  queueDepth: number
  paperSize: string | null
  orientation: 'portrait' | 'landscape' | null
  quality: string | null
}> {
  if (!printerName || process.platform === 'win32') return { queueDepth: 0, paperSize: null, orientation: null, quality: null }
  let queueDepth = 0
  let paperSize: string | null = null
  let orientation: 'portrait' | 'landscape' | null = null
  let quality: string | null = null
  try {
    const { stdout: q } = await execAsync(`lpstat -o "${printerName.replace(/"/g, '')}" 2>/dev/null | wc -l`, { timeout: 4000 })
    queueDepth = parseInt(q.trim(), 10) || 0
  } catch {}
  try {
    const { stdout: o } = await execAsync(`lpoptions -p "${printerName.replace(/"/g, '')}" 2>/dev/null`, { timeout: 4000 })
    const mPaper = o.match(/media=([^\s]+)/i)
    if (mPaper) paperSize = mPaper[1]
    const mOrient = o.match(/orientation-requested=(\d)/)
    if (mOrient) orientation = mOrient[1] === '4' ? 'landscape' : 'portrait'
    if (/print-quality=5/i.test(o)) quality = 'high'
    else if (/print-quality=4/i.test(o)) quality = 'normal'
    else if (o.trim()) quality = 'driver-default'
  } catch {}
  return { queueDepth, paperSize, orientation, quality }
}

export interface HardwareSnapshotCamera {
  connected: boolean
  working: boolean
  provider: string
  model: string | null
  batteryPct: number | null
  shutterCount: number
  orientation: 'portrait' | 'landscape' | null
  quality: string | null
  live: boolean
  error: string | null
}

export interface HardwareSnapshotPrinter {
  connected: boolean
  working: boolean
  provider: string
  model: string
  status: string
  statusCode?: number | null
  paperRemaining: number | null
  ribbonPercent: number | null
  initialMediaCount: number | null
  lifetimePrints: number | null
  printsTotal: number
  queueDepth: number
  orientation: 'portrait' | 'landscape' | null
  quality: string | null
  paperSize: string | null
  error: string | null
}

export async function hardwareSnapshot() {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const counters = await getCounters()
  const kioskDisplay = displays.find((display) => display.id !== primary.id) ?? primary
  const printers = await probePrinters()
  const defaultPrinter = process.env.HAPPYPIX_PRINTER_NAME || printers[0] || null
  const dnp = await getDnpTelemetry(defaultPrinter || '')

  // Enrich with platform-specific spooler details for full parity
  let winDetails: { queueDepth: number; isDefault: boolean; detectedError: string | null; paperSize: string | null } | null = null
  let cupsDetails: { queueDepth: number; paperSize: string | null; orientation: 'portrait' | 'landscape' | null; quality: string | null } | null = null
  if (process.platform === 'win32' && defaultPrinter) {
    winDetails = await queryWindowsPrinterDetails(defaultPrinter)
  } else if (defaultPrinter) {
    cupsDetails = await queryCupsPrinterDetails(defaultPrinter)
  }

  const queueDepth = winDetails?.queueDepth ?? cupsDetails?.queueDepth ?? (dnp as any).queueDepth ?? 0
  const provider = process.platform === 'win32' ? 'windows-driver-spooler' : 'cups-lp'
  const model = dnp.connected
    ? dnp.printerName || 'DNP DS-RX1HS'
    : defaultPrinter || 'No printer detected'
  const connected = printers.length > 0 || dnp.connected
  const working = connected && dnp.status !== 'offline' && dnp.status !== 'paper_jam'

  return {
    capturedAt: new Date().toISOString(),
    platform: process.platform,
    release: os.release(),
    arch: os.arch(),
    totalMemMb: Math.round(os.totalmem() / (1024 * 1024)),
    camera: {
      ...cameraReport,
      provider: cameraReport.model ? 'media-device' : 'canon-sdk-pending',
      shutterCount: (cameraReport as any).shutterCount ?? counters.shutterCount,
      orientation: (cameraReport as any).orientation ?? null,
      quality: (cameraReport as any).quality ?? 'high',
      live: !!cameraReport.working,
      batteryPct: cameraReport.batteryPct ?? (cameraReport as any).batteryLevel ?? null,
    } as HardwareSnapshotCamera & CameraReport,
    printer: {
      connected,
      working,
      provider,
      model,
      status: (dnp as any).status || (connected ? 'idle' : 'offline'),
      statusCode: (dnp as any).statusCode ?? null,
      paperRemaining: dnp.paperRemaining,
      ribbonPercent: dnp.ribbonPercent,
      initialMediaCount: dnp.initialMediaCount ?? null,
      lifetimePrints: dnp.lifetimePrints,
      printsTotal: counters.printsTotal,
      queueDepth,
      orientation: (dnp as any).orientation ?? cupsDetails?.orientation ?? winDetails?.paperSize ? null : null,
      quality: (dnp as any).quality ?? cupsDetails?.quality ?? null,
      paperSize: winDetails?.paperSize ?? cupsDetails?.paperSize ?? null,
      isDefault: winDetails?.isDefault ?? (cupsDetails != null ? true : false),
      error: connected ? dnp.error : 'No printer found in the OS print queue. Install the printer driver (DNP/Citizen/Canon) and try again.',
    },
    kioskScreen: {
      connected: displays.length > 0,
      external: displays.length > 1 && kioskDisplay.id !== primary.id,
      displayCount: displays.length,
      width: kioskDisplay.size.width,
      height: kioskDisplay.size.height,
      scaleFactor: kioskDisplay.scaleFactor,
      bounds: kioskDisplay.bounds,
      error: null,
    },
  }
}

export interface PrintRequest {
  copies: number
  layoutId: string
  templateName: string
  bitmapDataUrl?: string
  printerName?: string
  orientation?: 'portrait' | 'landscape'
  quality?: 'draft' | 'normal' | 'high'
}

/**
 * Real silent printing on Windows using PowerShell and System.Drawing.
 * Honors orientation + quality so portrait/landscape templates print correctly.
 */
async function printViaWindowsPowerShell(
  filePath: string,
  copies: number,
  printerName = process.env.HAPPYPIX_PRINTER_NAME || '',
  orientation: 'portrait' | 'landscape' = 'portrait',
  quality: string = 'high',
): Promise<void> {
  const sanitizedPrinter =
    typeof printerName === 'string' ? printerName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() : ''
  const safeCopies = Math.max(1, Math.min(50, Math.round(copies) || 1))
  const safePath = path.resolve(filePath).replace(/'/g, "''")
  const isLandscape = orientation === 'landscape'

  const psScript = `
Add-Type -AssemblyName System.Drawing
$doc = New-Object System.Drawing.Printing.PrintDocument
if ('${sanitizedPrinter}') { $doc.PrinterSettings.PrinterName = '${sanitizedPrinter}' }
$doc.DefaultPageSettings.Landscape = $${isLandscape ? 'true' : 'false'}
# Quality: try to set High when requested (driver-dependent)
if ('${quality}' -eq 'high') {
  try { $doc.DefaultPageSettings.PrinterResolution.Kind = [System.Drawing.Printing.PrinterResolutionKind]::High } catch {}
} elseif ('${quality}' -eq 'draft') {
  try { $doc.DefaultPageSettings.PrinterResolution.Kind = [System.Drawing.Printing.PrinterResolutionKind]::Draft } catch {}
}
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)
$doc.add_PrintPage({
    param($sender, $e)
    $img = [System.Drawing.Image]::FromFile('${safePath}')
    # Fit-to-page preserving aspect — mirrors TemplateCanvas cover logic
    $bounds = $e.Graphics.VisibleClipBounds
    $scale = [Math]::Min($bounds.Width / $img.Width, $bounds.Height / $img.Height)
    $w = $img.Width * $scale; $h = $img.Height * $scale
    $x = $bounds.X + ($bounds.Width - $w)/2; $y = $bounds.Y + ($bounds.Height - $h)/2
    $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $e.Graphics.DrawImage($img, $x, $y, $w, $h)
    $img.Dispose()
})
for ($i = 0; $i -lt ${safeCopies}; $i++) { $doc.Print() }
`
  const buffer = Buffer.from(psScript, 'utf16le')
  const base64Script = buffer.toString('base64')
  await execAsync(`powershell -NoProfile -NonInteractive -EncodedCommand ${base64Script}`, { timeout: 30000 })
}

export async function printJob(request: PrintRequest) {
  const copies = Math.max(1, Math.min(10, Math.round(request.copies)))
  const orientation = request.orientation || (request.layoutId?.toLowerCase().includes('landscape') ? 'landscape' : 'portrait')
  const quality = (request as any).quality || 'high'

  // Never fake a print: without the rendered bitmap there is nothing to print
  if (!request.bitmapDataUrl) {
    return {
      success: false,
      error: 'No print image was supplied, so nothing was printed.',
      jobId: null,
      provider: 'windows-driver-spooler',
      copies,
      printsTotal: (await getCounters()).printsTotal,
    }
  }

  const writeTemp = async (): Promise<string> => {
    const ext = request.bitmapDataUrl!.startsWith('data:image/jpeg') ? 'jpg' : 'png'
    const tempFile = path.join(os.tmpdir(), `happypix-print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`)
    const base64Data = request.bitmapDataUrl!.includes(',') ? request.bitmapDataUrl!.split(',')[1] : request.bitmapDataUrl!
    await fs.writeFile(tempFile, Buffer.from(base64Data, 'base64'))
    return tempFile
  }

  if (process.platform === 'win32') {
    const tempFile = await writeTemp()
    try {
      console.log(`🖨️ [Hardware] Windows dispatch ${copies}× ${orientation} ${quality} → ${(request.printerName || process.env.HAPPYPIX_PRINTER_NAME || 'default')} ...`)
      await printViaWindowsPowerShell(tempFile, copies, request.printerName || '', orientation as any, quality)
      console.log(`✅ [Hardware] Windows print dispatched.`)
      const printsTotal = await incrementCounter('printsTotal', copies)
      return { success: true, jobId: `PRINT-${Date.now()}`, provider: 'windows-driver-spooler', copies, printsTotal }
    } catch (err: any) {
      console.error('❌ [Hardware] Windows print failed:', err)
      return {
        success: false,
        error: err.message || 'Windows print spooler error',
        jobId: `ERR-${Date.now()}`,
        provider: 'windows-driver-spooler',
        copies,
        printsTotal: (await getCounters()).printsTotal,
      }
    } finally {
      await fs.unlink(tempFile).catch(() => {})
    }
  }

  // macOS/Linux: CUPS (`lp`) — how DNP/Citizen drivers expose on darwin
  const tempFile = await writeTemp()
  try {
    const printerArg = request.printerName ? ` -d "${request.printerName.replace(/"/g, '')}"` : ''
    const orientFlag = orientation === 'landscape' ? ' -o orientation-requested=4' : ' -o orientation-requested=3'
    const qualityFlag = quality === 'high' ? ' -o print-quality=5' : quality === 'draft' ? ' -o print-quality=3' : ' -o print-quality=4'
    const fitFlag = ' -o fit-to-page'
    const cmd = `lp${printerArg} -n ${copies}${orientFlag}${qualityFlag}${fitFlag} "${tempFile}"`
    await execAsync(cmd, { timeout: 20000 })
    const printsTotal = await incrementCounter('printsTotal', copies)
    return { success: true, jobId: `PRINT-${Date.now()}`, provider: 'cups-lp', copies, printsTotal }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'No CUPS printer accepted the job.',
      jobId: `ERR-${Date.now()}`,
      provider: 'cups-lp',
      copies,
      printsTotal: (await getCounters()).printsTotal,
    }
  } finally {
    await fs.unlink(tempFile).catch(() => {})
  }
}
