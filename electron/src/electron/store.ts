import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface StoredInstallation {
  deviceUuid: string
  deviceToken: string
  deviceId: string
  organizationId: string
  pairedAt: string
  locationLabel?: string
}

interface StoreShape {
  installation: StoredInstallation | null
  counters: {
    printsTotal: number
    shutterCount: number
  }
}

const emptyStore = (): StoreShape => ({
  installation: null,
  counters: { printsTotal: 0, shutterCount: 0 },
})

function storePath(): string {
  return path.join(app.getPath('userData'), 'booth-state.json')
}

async function readStore(): Promise<StoreShape> {
  try {
    const value = JSON.parse(await readFile(storePath(), 'utf8')) as Partial<StoreShape>
    return {
      installation: value.installation ?? null,
      counters: {
        printsTotal: Number(value.counters?.printsTotal ?? 0),
        shutterCount: Number(value.counters?.shutterCount ?? 0),
      },
    }
  } catch {
    return emptyStore()
  }
}

async function writeStore(value: StoreShape): Promise<void> {
  const destination = storePath()
  const temporary = `${destination}.${randomUUID()}.tmp`
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(temporary, JSON.stringify(value, null, 2), 'utf8')
  await rename(temporary, destination)
}

export async function getInstallation(): Promise<StoredInstallation | null> {
  return (await readStore()).installation
}

export async function saveInstallation(installation: StoredInstallation): Promise<void> {
  const current = await readStore()
  await writeStore({ ...current, installation })
}

export async function clearInstallation(): Promise<void> {
  const current = await readStore()
  await writeStore({ ...current, installation: null })
}

export async function getCounters(): Promise<StoreShape['counters']> {
  return (await readStore()).counters
}

export async function incrementCounter(counter: keyof StoreShape['counters'], amount = 1): Promise<number> {
  const current = await readStore()
  current.counters[counter] = Math.max(0, current.counters[counter] + amount)
  await writeStore(current)
  return current.counters[counter]
}
