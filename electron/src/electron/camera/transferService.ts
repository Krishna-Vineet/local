// ─────────────────────────────────────────────────────────────────────────────
//  TransferService.ts
//  Reads a captured image file from disk and converts it to a base64 data URL
//  suitable for the renderer / S3 upload pipeline.
//  For Nikon SDK: SDK writes the captured NEF/JPEG to the OS temp folder;
//  TransferService reads it back and hands it off.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

export interface TransferResult {
  ok: boolean
  dataUrl: string | null
  filePath: string | null
  sizeBytes: number
  mimeType: string
  error?: string
}

// ── TransferService ───────────────────────────────────────────────────────────

class TransferService {

  /**
   * Read an image file from disk and return as a base64 data URL.
   * The file is NOT deleted — callers should clean up if desired.
   */
  async readAsDataUrl(filePath: string): Promise<TransferResult> {
    if (!filePath) {
      return { ok: false, dataUrl: null, filePath: null, sizeBytes: 0, mimeType: '', error: 'No file path provided' }
    }

    try {
      const buffer = await fs.readFile(filePath)
      const ext = path.extname(filePath).toLowerCase().replace('.', '')
      const mimeType = this._mimeForExt(ext)
      const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`
      return {
        ok: true,
        dataUrl,
        filePath,
        sizeBytes: buffer.length,
        mimeType,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, dataUrl: null, filePath, sizeBytes: 0, mimeType: '', error: msg }
    }
  }

  /**
   * Find the most recently modified image file in a directory.
   * Used as a fallback when the exact filename is unknown.
   */
  async findLatestCapture(dir?: string): Promise<string | null> {
    const searchDir = dir ?? os.tmpdir()
    const extensions = new Set(['.jpg', '.jpeg', '.nef', '.nrw'])
    const maxAgeMs = 30_000  // only consider files modified in last 30s

    try {
      const entries = await fs.readdir(searchDir, { withFileTypes: true })
      let best: { path: string; mtime: number } | null = null

      for (const entry of entries) {
        if (!entry.isFile()) continue
        const ext = path.extname(entry.name).toLowerCase()
        if (!extensions.has(ext)) continue

        const fullPath = path.join(searchDir, entry.name)
        const stat = await fs.stat(fullPath).catch(() => null)
        if (!stat) continue
        const mtime = stat.mtimeMs
        if (Date.now() - mtime > maxAgeMs) continue
        if (!best || mtime > best.mtime) best = { path: fullPath, mtime }
      }

      return best?.path ?? null
    } catch {
      return null
    }
  }

  /**
   * Delete a temporary captured file after it has been safely transferred.
   */
  async cleanupFile(filePath: string): Promise<void> {
    if (!filePath) return
    try {
      await fs.unlink(filePath)
    } catch {
      // Non-fatal — file may already be gone
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _mimeForExt(ext: string): string {
    switch (ext) {
      case 'jpg':
      case 'jpeg': return 'image/jpeg'
      case 'png':  return 'image/png'
      case 'nef':
      case 'nrw':  return 'image/x-nikon-nef'
      case 'tif':
      case 'tiff': return 'image/tiff'
      default:     return 'application/octet-stream'
    }
  }
}

export const transferService = new TransferService()

