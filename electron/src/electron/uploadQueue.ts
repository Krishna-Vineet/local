import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import fs, { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getInstallation } from './store.js'

export type QueueSessionState = 'pending' | 'uploading' | 'uploaded' | 'failed'

export interface EnqueueSessionPayload {
  sessionId: string
  eventId?: string | null
  digitalCopy?: boolean
  guestConsent?: boolean
  composite: string // base64 data URL
  photos: string[] // base64 data URLs
  apiUrl?: string
}

export interface QueueSessionManifest {
  sessionId: string
  eventId: string | null
  digitalCopy: boolean
  guestConsent: boolean
  createdAt: string
  updatedAt: string
  attempts: number
  lastAttemptAt: string | null
  nextRetryAt: number | null
  lastError: string | null
  state: QueueSessionState
  compositeFile: string
  photoFiles: string[]
  downloadId: string | null
  downloadUrl: string | null
  downloadExpiresAt: string | null
  apiUrl?: string
}

export interface QueueStatusSummary {
  pendingCount: number
  uploadingCount: number
  uploadedCount: number
  failedCount: number
  totalBytesOnDisk: number
}

// Limits and constants
const MAX_PHOTOS_PER_SESSION = 40
const MAX_IMAGE_BYTES = 25 * 1024 * 1024 // 25 MB per image
const MAX_QUEUE_DISK_BYTES = 500 * 1024 * 1024 // 500 MB max queue storage
const MAX_ATTEMPTS = 10
const WORKER_INTERVAL_MS = 5000

// In-memory locks to prevent concurrent worker execution for the same session
const activeUploadingSessions = new Set<string>()
let workerTimer: NodeJS.Timeout | null = null

export function getQueueDir(): string {
  return path.join(app.getPath('userData'), 'upload-queue')
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; ext: string; mime: string } | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null
  }
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return null

  const header = dataUrl.slice(0, commaIndex)
  const base64Data = dataUrl.slice(commaIndex + 1).replace(/\s/g, '')
  const mimeMatch = header.match(/^data:([^;]+);base64/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'

  let ext = 'jpg'
  if (mime.includes('png')) ext = 'png'
  else if (mime.includes('webp')) ext = 'webp'
  else if (!mime.includes('jpeg') && !mime.includes('jpg')) return null // Disallowed type

  const buffer = Buffer.from(base64Data, 'base64')
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null

  return { buffer, ext, mime }
}

async function calculateDirectorySize(dirPath: string): Promise<number> {
  let total = 0
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += await calculateDirectorySize(fullPath)
      } else if (entry.isFile()) {
        const fileStat = await stat(fullPath)
        total += fileStat.size
      }
    }
  } catch {
    // Directory might not exist yet
  }
  return total
}

export async function validateAndStageSession(
  payload: EnqueueSessionPayload,
  queueRoot: string = getQueueDir()
): Promise<{ success: boolean; sessionId: string; error?: string }> {
  const sessionId = String(payload.sessionId || '').trim()
  if (!sessionId || !/^[a-zA-Z0-9_\-.]{3,128}$/.test(sessionId)) {
    return { success: false, sessionId, error: 'Invalid sessionId format.' }
  }

  // Check queue storage limit
  const currentBytes = await calculateDirectorySize(queueRoot)
  if (currentBytes > MAX_QUEUE_DISK_BYTES) {
    return {
      success: false,
      sessionId,
      error: 'Queue storage limit exceeded (500MB). Sync pending items to free space.',
    }
  }

  // Parse composite image
  const parsedComposite = parseDataUrl(payload.composite)
  if (!parsedComposite) {
    return { success: false, sessionId, error: 'Invalid or unsupported composite image.' }
  }

  // Parse photos
  const submittedPhotos = Array.isArray(payload.photos) ? payload.photos.slice(0, MAX_PHOTOS_PER_SESSION) : []
  const parsedPhotos: Array<{ buffer: Buffer; ext: string; mime: string }> = []
  for (let i = 0; i < submittedPhotos.length; i++) {
    const parsed = parseDataUrl(submittedPhotos[i])
    if (parsed) {
      parsedPhotos.push(parsed)
    }
  }

  const sessionDir = path.join(queueRoot, sessionId)
  const stagingDir = path.join(queueRoot, `.staging-${sessionId}-${randomUUID()}`)

  try {
    await mkdir(stagingDir, { recursive: true })

    // Save composite image
    const compositeFileName = `composite.${parsedComposite.ext}`
    await writeFile(path.join(stagingDir, compositeFileName), parsedComposite.buffer)

    // Save individual photo frames
    const photoFileNames: string[] = []
    for (let i = 0; i < parsedPhotos.length; i++) {
      const fileName = `photo-${i}.${parsedPhotos[i].ext}`
      await writeFile(path.join(stagingDir, fileName), parsedPhotos[i].buffer)
      photoFileNames.push(fileName)
    }

    const now = new Date().toISOString()
    const manifest: QueueSessionManifest = {
      sessionId,
      eventId: payload.eventId || null,
      digitalCopy: payload.digitalCopy !== false,
      guestConsent: payload.guestConsent ?? true,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      lastAttemptAt: null,
      nextRetryAt: null,
      lastError: null,
      state: 'pending',
      compositeFile: compositeFileName,
      photoFiles: photoFileNames,
      downloadId: null,
      downloadUrl: null,
      downloadExpiresAt: null,
      apiUrl: payload.apiUrl,
    }

    // Write manifest atomically
    const manifestPath = path.join(stagingDir, 'manifest.json')
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    // Ensure target session directory is clear if an interrupted prior staging existed
    await rm(sessionDir, { recursive: true, force: true })

    // Atomic move from staging to final session directory
    await rename(stagingDir, sessionDir)

    return { success: true, sessionId }
  } catch (err: any) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {})
    return { success: false, sessionId, error: err.message || 'Failed to durably stage session.' }
  }
}

export async function recoverQueue(queueRoot: string = getQueueDir()): Promise<void> {
  try {
    await mkdir(queueRoot, { recursive: true })
    const entries = await readdir(queueRoot, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(queueRoot, entry.name)

      // Clean up orphaned staging directories
      if (entry.isDirectory() && entry.name.startsWith('.staging-')) {
        await rm(fullPath, { recursive: true, force: true }).catch(() => {})
        continue
      }

      // Check valid session directories
      if (entry.isDirectory()) {
        const manifestPath = path.join(fullPath, 'manifest.json')
        try {
          const raw = await readFile(manifestPath, 'utf8')
          const manifest = JSON.parse(raw) as QueueSessionManifest

          // If a crash happened mid-upload, reset back to pending so it can be resumed
          if (manifest.state === 'uploading') {
            manifest.state = 'pending'
            manifest.updatedAt = new Date().toISOString()
            await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
          }
          // If already marked uploaded, delete completed directory
          if (manifest.state === 'uploaded') {
            await rm(fullPath, { recursive: true, force: true }).catch(() => {})
          }
        } catch {
          // Incomplete session folder without readable manifest: safe to remove
          await rm(fullPath, { recursive: true, force: true }).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.warn('[UploadQueue] Error recovering queue:', err)
  }
}

export async function getQueueStatus(queueRoot: string = getQueueDir()): Promise<QueueStatusSummary> {
  const summary: QueueStatusSummary = {
    pendingCount: 0,
    uploadingCount: 0,
    uploadedCount: 0,
    failedCount: 0,
    totalBytesOnDisk: 0,
  }

  try {
    summary.totalBytesOnDisk = await calculateDirectorySize(queueRoot)
    const entries = await readdir(queueRoot, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        try {
          const raw = await readFile(path.join(queueRoot, entry.name, 'manifest.json'), 'utf8')
          const manifest = JSON.parse(raw) as QueueSessionManifest
          if (manifest.state === 'pending') summary.pendingCount++
          else if (manifest.state === 'uploading') summary.uploadingCount++
          else if (manifest.state === 'uploaded') summary.uploadedCount++
          else if (manifest.state === 'failed') summary.failedCount++
        } catch {
          // Non-manifest directory ignored
        }
      }
    }
  } catch {
    // Queue directory might not exist yet
  }

  return summary
}

export async function getSessionStatus(
  sessionId: string,
  queueRoot: string = getQueueDir()
): Promise<QueueSessionManifest | null> {
  try {
    const manifestPath = path.join(queueRoot, sessionId, 'manifest.json')
    const raw = await readFile(manifestPath, 'utf8')
    return JSON.parse(raw) as QueueSessionManifest
  } catch {
    return null
  }
}

export async function uploadSessionFromDisk(
  sessionId: string,
  queueRoot: string = getQueueDir(),
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  if (activeUploadingSessions.has(sessionId)) {
    return false // Already active
  }

  activeUploadingSessions.add(sessionId)
  const sessionDir = path.join(queueRoot, sessionId)
  const manifestPath = path.join(sessionDir, 'manifest.json')

  try {
    const raw = await readFile(manifestPath, 'utf8')
    const manifest = JSON.parse(raw) as QueueSessionManifest

    // Retrieve booth device credentials
    const installation = await getInstallation()
    if (!installation || !installation.deviceToken) {
      // Not paired or logged in yet: leave pending for when installation completes
      return false
    }

    // Mark as uploading
    manifest.state = 'uploading'
    manifest.attempts += 1
    manifest.lastAttemptAt = new Date().toISOString()
    manifest.updatedAt = manifest.lastAttemptAt
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    // Read composite image
    const compositeBuffer = await readFile(path.join(sessionDir, manifest.compositeFile))
    const compositeExt = path.extname(manifest.compositeFile).replace('.', '')
    const compositeMime = compositeExt === 'png' ? 'image/png' : compositeExt === 'webp' ? 'image/webp' : 'image/jpeg'
    const compositeDataUrl = `data:${compositeMime};base64,${compositeBuffer.toString('base64')}`

    // Read photo frames
    const photoDataUrls: string[] = []
    for (const photoFile of manifest.photoFiles) {
      const buf = await readFile(path.join(sessionDir, photoFile))
      const ext = path.extname(photoFile).replace('.', '')
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      photoDataUrls.push(`data:${mime};base64,${buf.toString('base64')}`)
    }

    const apiUrl = manifest.apiUrl || process.env.VITE_BOOTH_API_URL || 'http://localhost:5000'
    const url = `${apiUrl.replace(/\/+$/, '')}/api/booth/sessions/complete`

    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': installation.deviceToken,
        'x-device-uuid': installation.deviceUuid,
      },
      body: JSON.stringify({
        sessionId: manifest.sessionId,
        eventId: manifest.eventId,
        digitalCopy: manifest.digitalCopy,
        guestConsent: manifest.guestConsent,
        composite: compositeDataUrl,
        photos: photoDataUrls,
      }),
      signal: AbortSignal.timeout(35000),
    })

    if (response.ok) {
      let rawText = ''
      let data: any = null
      try {
        if (typeof response.text === 'function') {
          rawText = await response.text()
          data = JSON.parse(rawText)
        } else if (typeof (response as any).json === 'function') {
          data = await (response as any).json()
          rawText = JSON.stringify(data)
        }
      } catch {
        // Response was not valid JSON (e.g. HTML captive portal splash page)
      }

      // Validate against the documented backend completion contract
      const isValidPayload = Boolean(data && typeof data === 'object' && !Array.isArray(data))
      const downloadId = typeof data?.downloadId === 'string' && data.downloadId.trim().length > 0
        ? data.downloadId.trim()
        : null
      const rawUrl = typeof (data?.downloadUrl || data?.shareUrl) === 'string'
        ? (data.downloadUrl || data.shareUrl).trim()
        : null

      // Validate download URL structure
      let isSafeDownloadUrl = false
      if (rawUrl) {
        try {
          const parsed = new URL(rawUrl)
          if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.pathname.includes('/download/')) {
            isSafeDownloadUrl = true
          }
        } catch {
          isSafeDownloadUrl = false
        }
      }

      const isConfirmedSuccess = isValidPayload && (
        (manifest.digitalCopy && downloadId && isSafeDownloadUrl) ||
        (!manifest.digitalCopy && typeof data?.photosStored === 'number')
      )

      if (!isConfirmedSuccess) {
        // Response was HTTP 200 but did NOT carry a valid canonical completion record!
        // Preserve all queued binary files and apply bounded retry with backoff.
        manifest.attempts += 1
        const errorSnippet = rawText.slice(0, 100).replace(/\s+/g, ' ').trim()
        manifest.lastError = `Invalid backend completion response: missing canonical downloadId/downloadUrl or received HTML/invalid JSON (${errorSnippet || 'empty body'})`
        if (manifest.attempts >= MAX_ATTEMPTS) {
          manifest.state = 'failed'
          manifest.nextRetryAt = null
        } else {
          manifest.state = 'pending'
          const backoffMs = Math.min(60000, 2000 * Math.pow(1.5, manifest.attempts)) + Math.floor(Math.random() * 1000)
          manifest.nextRetryAt = Date.now() + backoffMs
        }
        manifest.updatedAt = new Date().toISOString()
        await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
        return false
      }

      // Server confirmed durable completion: update manifest state first
      manifest.state = 'uploaded'
      manifest.downloadId = downloadId
      manifest.downloadUrl = rawUrl
      manifest.downloadExpiresAt = data.downloadExpiresAt || null
      manifest.updatedAt = new Date().toISOString()
      manifest.lastError = null

      // Write final successful manifest before deleting any local photo binaries
      try {
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
      } catch (persistErr: any) {
        // If persisting the completed metadata fails, retain binaries and do not mark uploaded
        manifest.state = 'pending'
        manifest.lastError = `Failed to persist completed queue metadata: ${persistErr?.message}`
        return false
      }

      // Durable completion confirmed by server AND recorded in metadata: now safe to remove binaries
      await rm(path.join(sessionDir, manifest.compositeFile), { force: true }).catch(() => {})
      for (const photoFile of manifest.photoFiles) {
        await rm(path.join(sessionDir, photoFile), { force: true }).catch(() => {})
      }

      // Clean up directory once confirmed
      await rm(sessionDir, { recursive: true, force: true }).catch(() => {})
      return true
    }

    // Handle HTTP errors
    const errText = await response.text().catch(() => `HTTP ${response.status}`)
    const isPermanent = response.status === 400 || response.status === 401 || response.status === 403 || response.status === 409

    manifest.lastError = `Upload rejected (${response.status}): ${errText.slice(0, 200)}`
    if (isPermanent || manifest.attempts >= MAX_ATTEMPTS) {
      manifest.state = 'failed'
      manifest.nextRetryAt = null
    } else {
      // Exponential backoff with jitter
      manifest.state = 'pending'
      const backoffMs = Math.min(60000, 2000 * Math.pow(1.5, manifest.attempts)) + Math.floor(Math.random() * 1000)
      manifest.nextRetryAt = Date.now() + backoffMs
    }

    manifest.updatedAt = new Date().toISOString()
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
    return false
  } catch (err: any) {
    // Network / timeout / transient failure
    try {
      const raw = await readFile(manifestPath, 'utf8')
      const manifest = JSON.parse(raw) as QueueSessionManifest
      manifest.lastError = err.message || 'Network/timeout error'
      if (manifest.attempts >= MAX_ATTEMPTS) {
        manifest.state = 'failed'
        manifest.nextRetryAt = null
      } else {
        manifest.state = 'pending'
        const backoffMs = Math.min(60000, 2000 * Math.pow(1.5, manifest.attempts)) + Math.floor(Math.random() * 1000)
        manifest.nextRetryAt = Date.now() + backoffMs
      }
      manifest.updatedAt = new Date().toISOString()
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
    } catch {
      // Ignore write errors on missing file
    }
    return false
  } finally {
    activeUploadingSessions.delete(sessionId)
  }
}

export async function processQueueTick(
  queueRoot: string = getQueueDir(),
  fetchFn: typeof fetch = fetch
): Promise<void> {
  try {
    const entries = await readdir(queueRoot, { withFileTypes: true })
    const now = Date.now()

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const sessionId = entry.name
        if (activeUploadingSessions.has(sessionId)) continue

        const manifestPath = path.join(queueRoot, sessionId, 'manifest.json')
        try {
          const raw = await readFile(manifestPath, 'utf8')
          const manifest = JSON.parse(raw) as QueueSessionManifest

          if (manifest.state === 'pending') {
            if (!manifest.nextRetryAt || manifest.nextRetryAt <= now) {
              // Upload single item per tick to avoid overwhelming network or concurrency
              await uploadSessionFromDisk(sessionId, queueRoot, fetchFn)
              break
            }
          }
        } catch {
          // Corrupt or missing manifest
        }
      }
    }
  } catch {
    // Directory unreadable
  }
}

export function startQueueWorker(queueRoot: string = getQueueDir()): void {
  if (workerTimer) return
  void recoverQueue(queueRoot)
  workerTimer = setInterval(() => {
    void processQueueTick(queueRoot)
  }, WORKER_INTERVAL_MS)
}

export function stopQueueWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer)
    workerTimer = null
  }
}

export async function enqueueSession(payload: EnqueueSessionPayload): Promise<{ success: boolean; sessionId: string; error?: string }> {
  const result = await validateAndStageSession(payload)
  if (result.success) {
    // Trigger immediate background process attempt without waiting for interval
    void processQueueTick()
  }
  return result
}
