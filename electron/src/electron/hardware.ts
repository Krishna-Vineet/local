import { BrowserWindow, screen } from 'electron'
import os from 'node:os'
import { getCounters, incrementCounter } from './store.js'

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

// Supplied by main.ts — resolves to the app window used to enumerate printers.
let printWindowSource: (() => BrowserWindow | null) | null = null

export function setPrintWindowSource(source: () => BrowserWindow | null): void {
  printWindowSource = source
}

const BOOTH_PRINTER_PATTERN = /(dnp|citizen|hiti|sony|canon selphy|cp\s?\d|ds\d|rx1|sl1|dp\d)/i
const VIRTUAL_PRINTER_PATTERN = /(microsoft print to pdf|onenote|xps document writer|fax)/i

async function printerStatus(): Promise<{
  connected: boolean
  working: boolean
  provider: string
  model: string
  error: string | null
}> {
  const win = printWindowSource?.()
  if (!win) {
    return { connected: false, working: false, provider: 'system-printer', model: 'Unknown', error: 'Printer discovery is unavailable.' }
  }
  try {
    const printers = await win.webContents.getPrintersAsync()
    const boothPrinter = printers.find((p) => BOOTH_PRINTER_PATTERN.test(p.name) || BOOTH_PRINTER_PATTERN.test(p.description || ''))
    const physical = printers.find((p) => !VIRTUAL_PRINTER_PATTERN.test(p.name))
    const chosen = boothPrinter ?? physical ?? null
    if (!chosen) {
      return { connected: false, working: false, provider: 'system-printer', model: 'None', error: 'No booth printer detected — install the printer driver.' }
    }
    return {
      connected: true,
      // PrinterInfo.status is a driver bitmask; any reported device is
      // treated as usable — failures surface when a job is actually sent.
      working: true,
      provider: 'system-printer',
      model: chosen.displayName || chosen.name,
      error: null,
    }
  } catch {
    return { connected: false, working: false, provider: 'system-printer', model: 'Unknown', error: 'Printer discovery failed.' }
  }
}

export function updateCameraReport(report: CameraReport): void {
  cameraReport = { ...report }
}

export async function recordCapture(): Promise<number> {
  return incrementCounter('shutterCount')
}

export async function hardwareSnapshot() {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const counters = await getCounters()
  const kioskDisplay = displays.find((display) => display.id !== primary.id) ?? primary

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
      ...(await printerStatus()),
      printsTotal: counters.printsTotal,
      queueDepth: 0,
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
}

export interface PrintResult {
  success: boolean
  jobId: string
  provider: string
  copies: number
  printsTotal: number
  warning: string
}

// Renders the print bitmap in a hidden window and sends it to the system
// printer. Dye-sub booth printers (DNP, Citizen, Hiti) ship OS printer
// drivers, so the platform print pipeline is the production path until a
// native SDK bridge lands.
async function printBitmap(bitmapDataUrl: string, landscape: boolean): Promise<void> {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  try {
    await win.loadURL('about:blank')
    await win.webContents.executeJavaScript(`
      document.body.style.margin = '0';
      document.body.innerHTML = '<img id="p" src="${bitmapDataUrl}" style="width:100%;display:block"/>';
      document.getElementById('p').decode();
    `)
    await new Promise<void>((resolve, reject) => {
      win.webContents.print(
        { silent: true, printBackground: true, margins: { marginType: 'none' }, landscape, pagesPerSheet: 1, pageRanges: [{ from: 1, to: 1 }] },
        (success: boolean, reason: string) => (success ? resolve() : reject(new Error(reason || 'The printer rejected the job.')))
      )
    })
  } finally {
    win.destroy()
  }
}

export async function printJob(request: PrintRequest): Promise<PrintResult> {
  const copies = Math.max(1, Math.min(10, Math.round(request.copies)))
  const counts = await getCounters()

  if (!request.bitmapDataUrl) {
    return {
      success: false,
      jobId: '',
      provider: 'none',
      copies,
      printsTotal: counts.printsTotal,
      warning: 'No printable image was produced for this job.',
    }
  }

  // Landscape prints orient the bitmap across the paper.
  const landscape = /-h\d+$/.test(request.layoutId)
  const jobId = `PRINT-${Date.now()}`

  try {
    for (let index = 0; index < copies; index += 1) {
      await printBitmap(request.bitmapDataUrl, landscape)
    }
  } catch (reason) {
    return {
      success: false,
      jobId,
      provider: 'system-printer',
      copies,
      printsTotal: counts.printsTotal,
      warning: reason instanceof Error ? reason.message : 'The printer did not accept this job.',
    }
  }

  const printsTotal = await incrementCounter('printsTotal', copies)
  return {
    success: true,
    jobId,
    provider: 'system-printer',
    copies,
    printsTotal,
    warning: '',
  }
}
