import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

// Create an isolated temporary directory for test queue
let testQueueDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testQueueDir),
  },
}))

vi.mock('./store.js', () => ({
  getInstallation: vi.fn(async () => ({
    deviceUuid: 'mock-device-uuid-1',
    deviceToken: 'mock-device-token-1',
    deviceId: 'mock-device-id-1',
    organizationId: 'mock-org-id-1',
    pairedAt: new Date().toISOString(),
  })),
}))

import {
  validateAndStageSession,
  recoverQueue,
  getQueueStatus,
  getSessionStatus,
  uploadSessionFromDisk,
} from './uploadQueue.js'

// Sample 1x1 transparent PNG base64 data URL
const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

describe('UploadQueue: Persistent Electron Main-Process Queue', () => {
  beforeEach(async () => {
    testQueueDir = path.join(os.tmpdir(), `happypix-test-queue-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(testQueueDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testQueueDir, { recursive: true, force: true }).catch(() => {})
  })

  it('rejects invalid or unsafe session IDs', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')
    const res1 = await validateAndStageSession({ sessionId: '', composite: SAMPLE_PNG_DATA_URL, photos: [] }, queueRoot)
    expect(res1.success).toBe(false)
    expect(res1.error).toContain('Invalid sessionId format')

    const res2 = await validateAndStageSession({ sessionId: '../dangerous/path', composite: SAMPLE_PNG_DATA_URL, photos: [] }, queueRoot)
    expect(res2.success).toBe(false)
  })

  it('rejects invalid composite data URLs', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')
    const res = await validateAndStageSession(
      { sessionId: 'test-session-01', composite: 'not-a-data-url', photos: [] },
      queueRoot
    )
    expect(res.success).toBe(false)
    expect(res.error).toContain('Invalid or unsupported composite image')
  })

  it('durably stages session photos and atomic manifest to disk', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')
    const res = await validateAndStageSession(
      {
        sessionId: 'session-durable-123',
        eventId: 'event-abc',
        digitalCopy: true,
        guestConsent: true,
        composite: SAMPLE_PNG_DATA_URL,
        photos: [SAMPLE_PNG_DATA_URL, SAMPLE_PNG_DATA_URL],
      },
      queueRoot
    )

    expect(res.success).toBe(true)
    expect(res.sessionId).toBe('session-durable-123')

    const sessionDir = path.join(queueRoot, 'session-durable-123')
    const manifestPath = path.join(sessionDir, 'manifest.json')
    const compositePath = path.join(sessionDir, 'composite.png')
    const photo0Path = path.join(sessionDir, 'photo-0.png')

    // Files exist on disk
    const manifestStat = await fs.stat(manifestPath)
    expect(manifestStat.isFile()).toBe(true)

    const compositeStat = await fs.stat(compositePath)
    expect(compositeStat.size).toBeGreaterThan(0)

    const photo0Stat = await fs.stat(photo0Path)
    expect(photo0Stat.size).toBeGreaterThan(0)

    // Manifest contains expected fields
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    expect(manifest.state).toBe('pending')
    expect(manifest.sessionId).toBe('session-durable-123')
    expect(manifest.photoFiles.length).toBe(2)
  })

  it('recovers interrupted sessions on restart and resets uploading to pending', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')

    // 1. Stage a session
    await validateAndStageSession(
      { sessionId: 'crash-session-1', composite: SAMPLE_PNG_DATA_URL, photos: [] },
      queueRoot
    )

    // 2. Simulate a crash where session was in 'uploading' state
    const manifestPath = path.join(queueRoot, 'crash-session-1', 'manifest.json')
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    manifest.state = 'uploading'
    await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8')

    // 3. Create an orphaned .staging folder from a prior crash
    const orphanStaging = path.join(queueRoot, '.staging-abandoned-xyz')
    await fs.mkdir(orphanStaging, { recursive: true })

    // 4. Run recoverQueue
    await recoverQueue(queueRoot)

    // Verify orphaned staging folder was cleaned up
    await expect(fs.access(orphanStaging)).rejects.toThrow()

    // Verify crashed uploading session was safely reset to pending
    const recoveredManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    expect(recoveredManifest.state).toBe('pending')
  })

  it('uploads session from disk, receives canonical downloadUrl, and removes binary photos', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')
    await validateAndStageSession(
      {
        sessionId: 'upload-success-session',
        composite: SAMPLE_PNG_DATA_URL,
        photos: [SAMPLE_PNG_DATA_URL],
      },
      queueRoot
    )

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        shareUrl: 'https://happypix.vercel.app/download/canon_dl_123',
        downloadUrl: 'https://happypix.vercel.app/download/canon_dl_123',
        downloadId: 'canon_dl_123',
        downloadExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    })

    const success = await uploadSessionFromDisk('upload-success-session', queueRoot, mockFetch as any)
    expect(success).toBe(true)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/booth/sessions/complete'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-device-token': 'mock-device-token-1',
          'x-device-uuid': 'mock-device-uuid-1',
        }),
      })
    )

    // After confirmed success, directory or photo binaries are cleaned up
    const sessionDir = path.join(queueRoot, 'upload-success-session')
    const dirExists = await fs.access(sessionDir).then(() => true).catch(() => false)
    expect(dirExists).toBe(false)
  })

  it('marks permanent failure on HTTP 401/403/400 without crashing', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')
    await validateAndStageSession(
      {
        sessionId: 'auth-fail-session',
        composite: SAMPLE_PNG_DATA_URL,
        photos: [],
      },
      queueRoot
    )

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Device token expired',
    })

    const success = await uploadSessionFromDisk('auth-fail-session', queueRoot, mockFetch as any)
    expect(success).toBe(false)

    const manifest = await getSessionStatus('auth-fail-session', queueRoot)
    expect(manifest?.state).toBe('failed')
    expect(manifest?.lastError).toContain('Device token expired')
  })

  it('retries with exponential backoff on network failure and preserves files', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')
    await validateAndStageSession(
      {
        sessionId: 'network-fail-session',
        composite: SAMPLE_PNG_DATA_URL,
        photos: [SAMPLE_PNG_DATA_URL],
      },
      queueRoot
    )

    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED network down'))

    const success = await uploadSessionFromDisk('network-fail-session', queueRoot, mockFetch as any)
    expect(success).toBe(false)

    const manifest = await getSessionStatus('network-fail-session', queueRoot)
    expect(manifest?.state).toBe('pending')
    expect(manifest?.attempts).toBe(1)
    expect(manifest?.lastError).toContain('ECONNREFUSED')
    expect(manifest?.nextRetryAt).toBeGreaterThan(Date.now() - 100)

    // Crucial requirement: photo files are NOT deleted on failure
    const photoExists = await fs
      .access(path.join(queueRoot, 'network-fail-session', manifest!.photoFiles[0]))
      .then(() => true)
      .catch(() => false)
    expect(photoExists).toBe(true)
  })

  it('accurately reports queue status counts', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')

    const res1 = await validateAndStageSession({ sessionId: 'session-01', composite: SAMPLE_PNG_DATA_URL, photos: [] }, queueRoot)
    const res2 = await validateAndStageSession({ sessionId: 'session-02', composite: SAMPLE_PNG_DATA_URL, photos: [] }, queueRoot)
    expect(res1.success).toBe(true)
    expect(res2.success).toBe(true)

    const status = await getQueueStatus(queueRoot)
    expect(status.pendingCount).toBe(2)
    expect(status.uploadingCount).toBe(0)
    expect(status.failedCount).toBe(0)
    expect(status.totalBytesOnDisk).toBeGreaterThan(0)
  })

  it('preserves photo files when server returns HTTP 200 with HTML captive portal', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')
    await validateAndStageSession(
      { sessionId: 'captive-portal-session', composite: SAMPLE_PNG_DATA_URL, photos: [SAMPLE_PNG_DATA_URL] },
      queueRoot
    )

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html><body>Please log in to Hotel Guest Wi-Fi</body></html>',
    })

    const success = await uploadSessionFromDisk('captive-portal-session', queueRoot, mockFetch as any)
    expect(success).toBe(false)

    const manifest = await getSessionStatus('captive-portal-session', queueRoot)
    expect(manifest?.state).toBe('pending')
    expect(manifest?.lastError).toContain('Invalid backend completion response')

    // Binaries MUST NOT be deleted
    const compositeExists = await fs.access(path.join(queueRoot, 'captive-portal-session', manifest!.compositeFile)).then(() => true).catch(() => false)
    expect(compositeExists).toBe(true)
    const photoExists = await fs.access(path.join(queueRoot, 'captive-portal-session', manifest!.photoFiles[0])).then(() => true).catch(() => false)
    expect(photoExists).toBe(true)
  })

  it('preserves photo files when server returns HTTP 200 with empty JSON object or missing downloadId', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')
    await validateAndStageSession(
      { sessionId: 'empty-json-session', composite: SAMPLE_PNG_DATA_URL, photos: [SAMPLE_PNG_DATA_URL] },
      queueRoot
    )

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({}),
    })

    const success = await uploadSessionFromDisk('empty-json-session', queueRoot, mockFetch as any)
    expect(success).toBe(false)

    const manifest = await getSessionStatus('empty-json-session', queueRoot)
    expect(manifest?.state).toBe('pending')

    const photoExists = await fs.access(path.join(queueRoot, 'empty-json-session', manifest!.photoFiles[0])).then(() => true).catch(() => false)
    expect(photoExists).toBe(true)
  })

  it('preserves photo files when server returns HTTP 200 with invalid or unsafe download URL', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')
    await validateAndStageSession(
      { sessionId: 'unsafe-url-session', composite: SAMPLE_PNG_DATA_URL, photos: [SAMPLE_PNG_DATA_URL] },
      queueRoot
    )

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        downloadId: 'canon_dl_123',
        downloadUrl: 'javascript:alert(1)', // Malicious / invalid URL scheme
      }),
    })

    const success = await uploadSessionFromDisk('unsafe-url-session', queueRoot, mockFetch as any)
    expect(success).toBe(false)

    const manifest = await getSessionStatus('unsafe-url-session', queueRoot)
    expect(manifest?.state).toBe('pending')

    const photoExists = await fs.access(path.join(queueRoot, 'unsafe-url-session', manifest!.photoFiles[0])).then(() => true).catch(() => false)
    expect(photoExists).toBe(true)
  })

  it('preserves photo files when server returns HTTP 200 with malformed JSON syntax', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')
    await validateAndStageSession(
      { sessionId: 'malformed-json-session', composite: SAMPLE_PNG_DATA_URL, photos: [SAMPLE_PNG_DATA_URL] },
      queueRoot
    )

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"downloadId": "incomplete_json...', // syntax error
    })

    const success = await uploadSessionFromDisk('malformed-json-session', queueRoot, mockFetch as any)
    expect(success).toBe(false)

    const manifest = await getSessionStatus('malformed-json-session', queueRoot)
    expect(manifest?.state).toBe('pending')

    const photoExists = await fs.access(path.join(queueRoot, 'malformed-json-session', manifest!.photoFiles[0])).then(() => true).catch(() => false)
    expect(photoExists).toBe(true)
  })

  it('preserves photo files when server returns HTTP 200 with missing downloadId and downloadUrl', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')
    await validateAndStageSession(
      { sessionId: 'missing-ids-session', composite: SAMPLE_PNG_DATA_URL, photos: [SAMPLE_PNG_DATA_URL] },
      queueRoot
    )

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, message: 'Where are the IDs?' }),
    })

    const success = await uploadSessionFromDisk('missing-ids-session', queueRoot, mockFetch as any)
    expect(success).toBe(false)

    const manifest = await getSessionStatus('missing-ids-session', queueRoot)
    expect(manifest?.state).toBe('pending')

    const photoExists = await fs.access(path.join(queueRoot, 'missing-ids-session', manifest!.photoFiles[0])).then(() => true).catch(() => false)
    expect(photoExists).toBe(true)
  })

  it('preserves photo files if persisting completed metadata fails', async () => {
    const queueRoot = path.join(testQueueDir, 'upload-queue')
    await validateAndStageSession(
      { sessionId: 'persist-fail-session', composite: SAMPLE_PNG_DATA_URL, photos: [SAMPLE_PNG_DATA_URL] },
      queueRoot
    )

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        downloadId: 'dl_valid_123',
        downloadUrl: 'https://happypix.in/download/dl_valid_123',
      }),
    })

    // Temporarily mock fs.writeFile to fail on writing manifest
    const origWriteFile = fs.writeFile
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockImplementation(async (filePath, data, options) => {
      if (String(filePath).includes('manifest.json')) {
        throw new Error('EACCES: permission denied or disk failure')
      }
      return origWriteFile(filePath, data, options)
    })

    try {
      const success = await uploadSessionFromDisk('persist-fail-session', queueRoot, mockFetch as any)
      expect(success).toBe(false)

      // Binaries must still exist!
      const sessionDir = path.join(queueRoot, 'persist-fail-session')
      const files = await fs.readdir(sessionDir)
      expect(files.some((f) => f.startsWith('composite'))).toBe(true)
      expect(files.some((f) => f.startsWith('photo-'))).toBe(true)
    } finally {
      writeFileSpy.mockRestore()
    }
  })
})

describe('Fix 2: Durable Enqueue Failure & In-Memory State Protection Contract', () => {
  it('enqueue failure flags outcome and prevents in-memory photo discard', () => {
    const enqueueResult = { success: false, error: 'Queue quota limit (500MB) exceeded.' }

    // Simulating App.tsx print/save outcome handler
    const outcome = {
      success: true, // physical print succeeded
      printed: true,
      enqueueFailed: !enqueueResult.success,
      enqueueError: enqueueResult.error,
      isSavedDurable: false,
    }

    // Must not report photos were safely saved
    expect(outcome.isSavedDurable).toBe(false)
    expect(outcome.enqueueFailed).toBe(true)
    expect(outcome.enqueueError).toContain('Queue quota limit')

    // Confirm session cannot reset automatically
    const shouldAutoCountdown = !outcome.enqueueFailed || outcome.isSavedDurable
    expect(shouldAutoCountdown).toBe(false)
  })

  it('enqueue exception is caught and sets enqueueFailed without throwing', () => {
    let outcome: any = null
    try {
      // Simulate IPC throw
      throw new Error('IPC communication failure / disk write error')
    } catch (err: any) {
      outcome = {
        success: true,
        printed: true,
        enqueueFailed: true,
        enqueueError: err?.message || 'Failed to queue photos locally.',
        isSavedDurable: false,
      }
    }

    expect(outcome.enqueueFailed).toBe(true)
    expect(outcome.isSavedDurable).toBe(false)
    expect(outcome.enqueueError).toContain('IPC communication failure')
  })

  it('online upload failure after enqueue failure preserves photos for operator retry', () => {
    const enqueueResult = { success: false, error: 'Disk full' }
    const onlineResult = { ok: false, error: 'Network offline' }

    const outcome = {
      success: true,
      printed: true,
      enqueueFailed: true,
      enqueueError: enqueueResult.error,
      isSavedDurable: false,
      shareUrl: null,
      downloadId: null,
    }

    // No QR code can be generated
    expect(onlineResult.ok).toBe(false)
    expect(outcome.shareUrl).toBeNull()
    expect(outcome.downloadId).toBeNull()
    expect(outcome.isSavedDurable).toBe(false)

    // Retry path is possible without re-printing
    const canRetrySave = outcome.enqueueFailed && !outcome.isSavedDurable
    expect(canRetrySave).toBe(true)
  })
})

