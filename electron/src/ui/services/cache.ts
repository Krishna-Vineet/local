import type { BoothSnapshot } from '../types'

const SNAPSHOT_KEY = 'happypix.booth.snapshot.v1'

export function readCachedSnapshot(): BoothSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    return raw ? JSON.parse(raw) as BoothSnapshot : null
  } catch {
    return null
  }
}

export function cacheSnapshot(snapshot: BoothSnapshot): void {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
}

export function clearCachedSnapshot(): void {
  localStorage.removeItem(SNAPSHOT_KEY)
}
