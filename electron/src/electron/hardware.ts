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

// Probe the OS for real printers (cached 30s — heartbeat calls this a
// lot). Telemetry must reflect the machine, not a simulator: until DNP
// ships an SDK, "printer connected" means "the OS print pipeline can
// see at least one printer".
let printerProbeCache: { at: number; printers: string[] } = { at: 0, printers: [] }
export async function probePrinters(): Promise<string[]> {
  if (Date.now() - printerProbeCache.at < 30_000) return printerProbeCache.printers
  let printers: string[] = []
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('powershell -NoProfile -NonInteractive -Command "Get-Printer | Select-Object -ExpandProperty Name"', { timeout: 8000 })
      printers = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    } else {
      const { stdout } = await execAsync('lpstat -p 2>/dev/null | awk \'{print $2}\'', { timeout: 8000 })
      printers = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    }
  } catch {
    printers = []
  }
  printerProbeCache = { at: Date.now(), printers }
  return printers
}

export async function hardwareSnapshot() {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const counters = await getCounters()
  const kioskDisplay = displays.find((display) => display.id !== primary.id) ?? primary
  const printers = await probePrinters()
  const defaultPrinter = process.env.HAPPYPIX_PRINTER_NAME || printers[0] || null
  const dnp = await getDnpTelemetry(defaultPrinter || '')

  return {
    capturedAt: new Date().toISOString(),
    platform: process.platform,
    release: os.release(),
    camera: {
      ...cameraReport,
      provider: cameraReport.model ? 'media-device' : 'canon-sdk-pending',
      shutterCount: counters.shutterCount,
    },
    printer: {
      connected: printers.length > 0 || dnp.connected,
      working: printers.length > 0 || dnp.connected,
      provider: process.platform === 'win32' ? 'windows-driver-spooler' : 'cups-lp',
      model: dnp.connected ? (dnp.printerName || 'DNP DS-RX1HS') : (defaultPrinter || 'No printer detected'),
      paperRemaining: dnp.paperRemaining,
      ribbonPercent: dnp.ribbonPercent,
      initialMediaCount: dnp.initialMediaCount,
      printsTotal: counters.printsTotal,
      queueDepth: 0,
      error: printers.length > 0 || dnp.connected ? dnp.error : 'No printer found in the OS print queue. Install the printer driver (DNP/Citizen/Canon) and try again.',
    },
    kioskScreen: {
      connected: displays.length > 0,
      external: displays.length > 1 && kioskDisplay.id !== primary.id,
      displayCount: displays.length,
      width: kioskDisplay.size.width,
      height: kioskDisplay.size.height,
      scaleFactor: kioskDisplay.scaleFactor,
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
}

/**
 * Real silent printing on Windows using PowerShell and System.Drawing.
 * Sends the image directly to the installed Windows printer (DNP, Citizen, Canon SELPHY, etc.)
 */
async function printViaWindowsPowerShell(filePath: string, copies: number, printerName = process.env.HAPPYPIX_PRINTER_NAME || ''): Promise<void> {
  const sanitizedPrinter = typeof printerName === 'string'
    ? printerName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim()
    : ''
  const safeCopies = Math.max(1, Math.min(50, Math.round(copies) || 1))
  const safePath = path.resolve(filePath).replace(/'/g, "''")

  const psScript = `
Add-Type -AssemblyName System.Drawing
$doc = New-Object System.Drawing.Printing.PrintDocument
if ('${sanitizedPrinter}') {
    $doc.PrinterSettings.PrinterName = '${sanitizedPrinter}'
}
$doc.add_PrintPage({
    param($sender, $e)
    $img = [System.Drawing.Image]::FromFile('${safePath}')
    $e.Graphics.DrawImage($img, $e.Graphics.VisibleClipBounds)
    $img.Dispose()
})
for ($i = 0; $i -lt ${safeCopies}; $i++) {
    $doc.Print()
}
`
  const buffer = Buffer.from(psScript, 'utf16le')
  const base64Script = buffer.toString('base64')
  await execAsync(`powershell -NoProfile -NonInteractive -EncodedCommand ${base64Script}`)
}

export async function printJob(request: PrintRequest) {
  const copies = Math.max(1, Math.min(10, Math.round(request.copies)))

  // Never fake a print: without the rendered bitmap there is nothing to
  // print, and reporting success would tell the guest a lie (and bill a
  // print that doesn't exist). The counter only moves on real dispatch.
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

  if (process.platform === 'win32') {
    const tempFile = path.join(os.tmpdir(), `happypix-print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`)
    try {
      const base64Data = request.bitmapDataUrl.includes(',')
        ? request.bitmapDataUrl.split(',')[1]
        : request.bitmapDataUrl
      await fs.writeFile(tempFile, Buffer.from(base64Data, 'base64'))

      console.log(`🖨️ [Hardware] Dispatching real print job (${copies} copies) to Windows spooler...`)
      await printViaWindowsPowerShell(tempFile, copies, request.printerName || '')
      console.log(`✅ [Hardware] Real print job dispatched successfully.`)
      const printsTotal = await incrementCounter('printsTotal', copies)

      return {
        success: true,
        jobId: `PRINT-${Date.now()}`,
        provider: 'windows-driver-spooler',
        copies,
        printsTotal,
      }
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

  // Non-Windows: print through CUPS (`lp`), which is how DNP/Citizen
  // drivers expose themselves on macOS/Linux. No CUPS printer → honest
  // failure, never a simulated success.
  const tempFile = path.join(os.tmpdir(), `happypix-print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`)
  try {
    const base64Data = request.bitmapDataUrl.includes(',')
      ? request.bitmapDataUrl.split(',')[1]
      : request.bitmapDataUrl
    await fs.writeFile(tempFile, Buffer.from(base64Data, 'base64'))
    const printerArg = request.printerName ? ` -d "${request.printerName.replace(/"/g, '')}"` : ''
    await execAsync(`lp${printerArg} -n ${copies} -o fit-to-page "${tempFile}"`)
    const printsTotal = await incrementCounter('printsTotal', copies)
    return {
      success: true,
      jobId: `PRINT-${Date.now()}`,
      provider: 'cups-lp',
      copies,
      printsTotal,
    }
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
