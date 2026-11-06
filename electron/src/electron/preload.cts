const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('booth', {
  // ── Existing booth APIs (unchanged) ────────────────────────────────────
  getInstallation: () => ipcRenderer.invoke('booth:get-installation'),
  saveInstallation: (value: unknown) => ipcRenderer.invoke('booth:save-installation', value),
  clearInstallation: () => ipcRenderer.invoke('booth:clear-installation'),
  getDeviceUuid: () => ipcRenderer.invoke('booth:get-device-uuid'),
  clearDeviceIdentity: () => ipcRenderer.invoke('booth:clear-device-identity'),
  getSystemSnapshot: () => ipcRenderer.invoke('booth:system-snapshot'),
  reportCamera: (value: unknown) => ipcRenderer.invoke('booth:camera-report', value),
  recordCapture: () => ipcRenderer.invoke('booth:record-capture'),
  print: (value: unknown) => ipcRenderer.invoke('booth:print', value),
  enqueueSession: (value: unknown) => ipcRenderer.invoke('booth:enqueue-session', value),
  markSessionUploaded: (sessionId: string, details?: unknown) => ipcRenderer.invoke('booth:mark-session-uploaded', sessionId, details),
  triggerQueueProcess: () => ipcRenderer.invoke('booth:trigger-queue-tick'),
  getQueueStatus: () => ipcRenderer.invoke('booth:get-queue-status'),
  getSessionStatus: (sessionId: string) => ipcRenderer.invoke('booth:get-session-status', sessionId),
  canonProbe: (ip?: string) => ipcRenderer.invoke('booth:canon-probe', ip),
  canonCapture: () => ipcRenderer.invoke('booth:canon-capture'),
  setKiosk: (enabled: boolean) => ipcRenderer.invoke('booth:set-kiosk', enabled),
  appInfo: () => ipcRenderer.invoke('booth:app-info'),

  // ── Nikon SDK APIs (new) ───────────────────────────────────────────────
  nikon: {
    /** Get current camera connection state */
    getStatus: () => ipcRenderer.invoke('nikon:status'),

    /** List detected Nikon cameras */
    listDevices: () => ipcRenderer.invoke('nikon:devices'),

    /** Connect to first available Nikon camera via USB */
    connect: () => ipcRenderer.invoke('nikon:connect'),

    /** Disconnect from camera */
    disconnect: () => ipcRenderer.invoke('nikon:disconnect'),

    /** Start Live View — frames pushed via onLiveViewFrame */
    startLiveView: () => ipcRenderer.invoke('nikon:liveview-start'),

    /** Stop Live View */
    stopLiveView: () => ipcRenderer.invoke('nikon:liveview-stop'),

    /** Trigger shutter and return captured image as dataUrl */
    capture: () => ipcRenderer.invoke('nikon:capture'),

    /** Read all camera settings (ISO, exposure, aperture, battery, etc.) */
    readSettings: () => ipcRenderer.invoke('nikon:settings-read'),

    /** Set ISO by label (e.g. "400", "Auto") */
    setISO: (iso: string) => ipcRenderer.invoke('nikon:settings-iso', iso),

    /** Set Exposure Mode by label (e.g. "P", "A", "M") */
    setExposureMode: (mode: string) => ipcRenderer.invoke('nikon:settings-expmode', mode),

    /** Set Shutter Speed by raw MAID value */
    setShutterSpeed: (raw: number) => ipcRenderer.invoke('nikon:settings-shutter', raw),

    /** Set Aperture by raw MAID value */
    setAperture: (raw: number) => ipcRenderer.invoke('nikon:settings-aperture', raw),

    /** Get raw capability value */
    getCapability: (capId: number) => ipcRenderer.invoke('nikon:cap-get', capId),

    /** Set raw capability value */
    setCapability: (capId: number, value: number) => ipcRenderer.invoke('nikon:cap-set', capId, value),

    /**
     * Subscribe to Live View frames pushed from main process.
     * Returns an unsubscribe function — call it to stop receiving frames.
     */
    onLiveViewFrame: (cb: (payload: { frameDataUrl: string; frameIndex: number }) => void): (() => void) => {
      const handler = (_event: unknown, payload: { frameDataUrl: string; frameIndex: number }) => cb(payload)
      ipcRenderer.on('nikon:liveview-frame', handler)
      return () => ipcRenderer.removeListener('nikon:liveview-frame', handler)
    },
  },
})
