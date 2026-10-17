const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('booth', {
  getInstallation: () => ipcRenderer.invoke('booth:get-installation'),
  saveInstallation: (value: unknown) => ipcRenderer.invoke('booth:save-installation', value),
  clearInstallation: () => ipcRenderer.invoke('booth:clear-installation'),
  getDeviceUuid: () => ipcRenderer.invoke('booth:get-device-uuid'),
  clearDeviceIdentity: () => ipcRenderer.invoke('booth:clear-device-identity'),
  getSystemSnapshot: () => ipcRenderer.invoke('booth:system-snapshot'),
  reportCamera: (value: unknown) => ipcRenderer.invoke('booth:camera-report', value),
  recordCapture: () => ipcRenderer.invoke('booth:record-capture'),
  print: (value: unknown) => ipcRenderer.invoke('booth:print', value),
  setKiosk: (enabled: boolean) => ipcRenderer.invoke('booth:set-kiosk', enabled),
  appInfo: () => ipcRenderer.invoke('booth:app-info'),
})
