// ─────────────────────────────────────────────────────────────────────────────
//  SettingsService.ts
//  Read and write Nikon camera settings via the MAID Capability system.
//  Maps human-readable setting names to Nikon Capability IDs and
//  provides type-safe accessors for ISO, Aperture, Shutter Speed, and more.
// ─────────────────────────────────────────────────────────────────────────────

import { cameraManager } from './cameraManager.js'
import { NikonCapability } from './nikonAdapter.js'

// ── Setting value maps ────────────────────────────────────────────────────────

/**
 * ISO values: MAID enum index → human-readable string
 * (Typical values — actual supported range depends on camera model)
 */
const ISO_MAP: Record<number, string> = {
  0:  'Auto',
  1:  '100',
  2:  '125',
  3:  '160',
  4:  '200',
  5:  '250',
  6:  '320',
  7:  '400',
  8:  '500',
  9:  '640',
  10: '800',
  11: '1000',
  12: '1250',
  13: '1600',
  14: '2000',
  15: '2500',
  16: '3200',
  17: '4000',
  18: '5000',
  19: '6400',
  20: '12800',
  21: '25600',
  22: '51200',
  23: 'Hi 1',
  24: 'Hi 2',
}

/**
 * Exposure Mode: MAID enum index → human-readable
 */
const EXPOSURE_MODE_MAP: Record<number, string> = {
  0: 'P',     // Programmed auto
  1: 'A',     // Aperture priority
  2: 'S',     // Shutter priority
  3: 'M',     // Manual
  4: 'AUTO',  // Auto
  5: 'Portrait',
  6: 'Landscape',
  7: 'Close Up',
  8: 'Sports',
  9: 'Night Portrait',
  10: 'Flash Off',
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface CameraSettings {
  iso: string | null
  exposureMode: string | null
  shutterSpeed: number | null   // raw MAID value
  aperture: number | null       // raw MAID value
  batteryPct: number | null
}

// ── SettingsService ───────────────────────────────────────────────────────────

class SettingsService {

  /**
   * Read all key camera settings in one call.
   */
  async readAll(): Promise<CameraSettings> {
    const [iso, expMode, shutter, aperture, battery] = await Promise.all([
      cameraManager.getCapability(NikonCapability.ISO),
      cameraManager.getCapability(NikonCapability.ExposureMode),
      cameraManager.getCapability(NikonCapability.ShutterSpeed),
      cameraManager.getCapability(NikonCapability.Aperture),
      cameraManager.refreshBattery(),
    ])

    return {
      iso:          iso !== null ? (ISO_MAP[iso] ?? `ISO_${iso}`) : null,
      exposureMode: expMode !== null ? (EXPOSURE_MODE_MAP[expMode] ?? `Mode_${expMode}`) : null,
      shutterSpeed: shutter,
      aperture,
      batteryPct:   battery,
    }
  }

  /**
   * Set ISO by human-readable label (e.g. "400", "Auto").
   * Returns true on success.
   */
  async setISO(label: string): Promise<boolean> {
    const entry = Object.entries(ISO_MAP).find(([, v]) => v === label)
    if (!entry) return false
    return cameraManager.setCapability(NikonCapability.ISO, Number(entry[0]))
  }

  /**
   * Set Exposure Mode by label ("P", "A", "S", "M", "AUTO").
   */
  async setExposureMode(mode: string): Promise<boolean> {
    const entry = Object.entries(EXPOSURE_MODE_MAP).find(([, v]) => v === mode)
    if (!entry) return false
    return cameraManager.setCapability(NikonCapability.ExposureMode, Number(entry[0]))
  }

  /**
   * Set Shutter Speed by raw MAID enum index.
   * Caller should consult camera's capability range before setting.
   */
  async setShutterSpeed(rawValue: number): Promise<boolean> {
    return cameraManager.setCapability(NikonCapability.ShutterSpeed, rawValue)
  }

  /**
   * Set Aperture by raw MAID enum index.
   */
  async setAperture(rawValue: number): Promise<boolean> {
    return cameraManager.setCapability(NikonCapability.Aperture, rawValue)
  }

  /**
   * Get current battery percentage (refreshed from camera).
   */
  async getBattery(): Promise<number | null> {
    return cameraManager.refreshBattery()
  }

  /**
   * Get raw capability value by ID.
   */
  async getCapability(capId: number): Promise<number | null> {
    return cameraManager.getCapability(capId)
  }

  /**
   * Set raw capability value by ID.
   */
  async setCapabilityRaw(capId: number, value: number): Promise<boolean> {
    return cameraManager.setCapability(capId, value)
  }

  // Expose maps for UI use
  getIsoMap() { return { ...ISO_MAP } }
  getExposureModeMap() { return { ...EXPOSURE_MODE_MAP } }
}

export const settingsService = new SettingsService()

