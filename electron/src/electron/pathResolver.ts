import { app } from 'electron'
import path from 'node:path'
import { isDev } from './util.js'

export function getPreloadPath(): string {
  if (isDev()) return path.join(app.getAppPath(), 'dist-electron', 'preload.cjs')
  return path.join(process.resourcesPath, 'dist-electron', 'preload.cjs')
}
