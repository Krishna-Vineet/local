// ─────────────────────────────────────────────────────────────────────────────
//  cameraIpc.ts
//  Registers all Nikon camera IPC handlers for Electron main ↔ renderer.
//  Call registerCameraIpc() once from main.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { ipcMain } from 'electron'
import { cameraManager } from './cameraManager.js'
import { liveViewService, IPC_LIVE_VIEW_FRAME } from './liveViewService.js'
import { captureService } from './captureService.js'
import { settingsService } from './settingsService.js'
import { nikonAdapter, NikonCapability } from './nikonAdapter.js'

// ── IPC Channel names ─────────────────────────────────────────────────────────

export const NIKON_IPC = {
  STATUS:          'nikon:status',
  DEVICES:         'nikon:devices',
  CONNECT:         'nikon:connect',
  DISCONNECT:      'nikon:disconnect',
  LIVEVIEW_START:  'nikon:liveview-start',
  LIVEVIEW_STOP:   'nikon:liveview-stop',
  LIVEVIEW_FRAME:  IPC_LIVE_VIEW_FRAME,        // push channel (main→renderer)
  CAPTURE:         'nikon:capture',
  SETTINGS_READ:   'nikon:settings-read',
  SETTINGS_ISO:    'nikon:settings-iso',
  SETTINGS_EXPMODE:'nikon:settings-expmode',
  SETTINGS_SHUTTER:'nikon:settings-shutter',
  SETTINGS_APERTURE:'nikon:settings-aperture',
  CAP_GET:         'nikon:cap-get',
  CAP_SET:         'nikon:cap-set',
} as const

// ── Registration ──────────────────────────────────────────────────────────────

export function registerCameraIpc(): void {

  // ── Camera state & discovery ───────────────────────────────────────────

  ipcMain.handle(NIKON_IPC.STATUS, () => cameraManager.getState())

  ipcMain.handle(NIKON_IPC.DEVICES, async () => {
    if (!nikonAdapter.isReady) return { devices: [] }
    const devices = await nikonAdapter.listDevices().catch(() => [])
    return { devices }
  })

  ipcMain.handle(NIKON_IPC.CONNECT, async () => {
    try {
      const result = await nikonAdapter.connect()
      return { ok: true, ...result }
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle(NIKON_IPC.DISCONNECT, async () => {
    await cameraManager.shutdown()
    return { ok: true }
  })

  // ── Live View ──────────────────────────────────────────────────────────

  ipcMain.handle(NIKON_IPC.LIVEVIEW_START, async (event) => {
    const result = await liveViewService.start(event.sender)
    return result
  })

  ipcMain.handle(NIKON_IPC.LIVEVIEW_STOP, async (event) => {
    await liveViewService.stop(event.sender)
    return { ok: true }
  })

  // ── Capture ────────────────────────────────────────────────────────────

  ipcMain.handle(NIKON_IPC.CAPTURE, async () => {
    const result = await captureService.capture()
    return result
  })

  // ── Settings ───────────────────────────────────────────────────────────

  ipcMain.handle(NIKON_IPC.SETTINGS_READ, async () => {
    try {
      const settings = await settingsService.readAll()
      return { ok: true, settings }
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle(NIKON_IPC.SETTINGS_ISO, async (_event, iso: string) => {
    const ok = await settingsService.setISO(iso)
    return { ok }
  })

  ipcMain.handle(NIKON_IPC.SETTINGS_EXPMODE, async (_event, mode: string) => {
    const ok = await settingsService.setExposureMode(mode)
    return { ok }
  })

  ipcMain.handle(NIKON_IPC.SETTINGS_SHUTTER, async (_event, rawValue: number) => {
    const ok = await settingsService.setShutterSpeed(rawValue)
    return { ok }
  })

  ipcMain.handle(NIKON_IPC.SETTINGS_APERTURE, async (_event, rawValue: number) => {
    const ok = await settingsService.setAperture(rawValue)
    return { ok }
  })

  // ── Raw capability access ──────────────────────────────────────────────

  ipcMain.handle(NIKON_IPC.CAP_GET, async (_event, capId: number) => {
    const value = await cameraManager.getCapability(capId)
    return { ok: value !== null, capId, value }
  })

  ipcMain.handle(NIKON_IPC.CAP_SET, async (_event, capId: number, value: number) => {
    const ok = await cameraManager.setCapability(capId, value)
    return { ok }
  })

  console.log('[CameraIPC] Nikon SDK IPC handlers registered')
}

// ── Preload-side type declarations (for reference) ────────────────────────────
// These are the exact APIs that preload.cts will expose via contextBridge.
// See preload.cts for the actual bridge wiring.

export type NikonBridgeAPI = {
  getStatus:        () => Promise<ReturnType<typeof cameraManager.getState>>
  listDevices:      () => Promise<{ devices: Awaited<ReturnType<typeof nikonAdapter.listDevices>> }>
  connect:          () => Promise<{ ok: boolean; connected?: boolean; name?: string; error?: string }>
  disconnect:       () => Promise<{ ok: boolean }>
  startLiveView:    () => Promise<{ ok: boolean; error?: string }>
  stopLiveView:     () => Promise<{ ok: boolean }>
  capture:          () => Promise<{ success: boolean; dataUrl: string | null; path: string | null; durationMs: number }>
  readSettings:     () => Promise<{ ok: boolean; settings?: Awaited<ReturnType<typeof settingsService.readAll>> }>
  setISO:           (iso: string)  => Promise<{ ok: boolean }>
  setExposureMode:  (mode: string) => Promise<{ ok: boolean }>
  setShutterSpeed:  (raw: number)  => Promise<{ ok: boolean }>
  setAperture:      (raw: number)  => Promise<{ ok: boolean }>
  getCapability:    (capId: number) => Promise<{ ok: boolean; capId: number; value: number | null }>
  setCapability:    (capId: number, value: number) => Promise<{ ok: boolean }>
  NikonCapability:  typeof NikonCapability
  onLiveViewFrame:  (cb: (payload: { frameDataUrl: string; frameIndex: number }) => void) => () => void
}

