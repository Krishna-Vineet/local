import { screen } from 'electron'
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
      connected: true,
      working: true,
      provider: 'dnp-sdk-simulator',
      model: 'DNP adapter simulator',
      printsTotal: counters.printsTotal,
      queueDepth: 0,
      error: null,
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

export async function printJob(request: PrintRequest) {
  const copies = Math.max(1, Math.min(10, Math.round(request.copies)))
  const printsTotal = await incrementCounter('printsTotal', copies)
  return {
    success: true,
    jobId: `SIM-${Date.now()}`,
    provider: 'dnp-sdk-simulator',
    copies,
    printsTotal,
    warning: request.bitmapDataUrl
      ? 'Simulated DNP job accepted; native SDK bridge is pending.'
      : 'No bitmap supplied; simulated counter only.',
  }
}
