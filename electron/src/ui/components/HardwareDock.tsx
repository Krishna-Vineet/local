import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { bridge } from '../services/bridge'
import type { HardwareSnapshot } from '../types'

/**
 * Hardware telemetry dock for the pairing screen.
 *
 * The tablet build has always shown camera/printer/network readiness before an
 * operator types a password; the desktop kiosk did not, so an operator only
 * discovered a dead DNP printer mid-event. This panel closes that gap using the
 * snapshot the main process already keeps (`booth:system-snapshot`), refreshed
 * every 5 s until the screen unmounts.
 *
 * Deliberately quiet: a green row reads as one line of confirmation, and only a
 * fault (`.is-warn`) draws the eye.
 */

type Status = 'ok' | 'warn' | 'checking'

interface Row {
  key: string
  icon: 'camera' | 'printer' | 'monitor' | 'wifi'
  label: string
  detail: string
  status: Status
}

const dot = (status: Status) => (status === 'ok' ? '●' : status === 'checking' ? '◌' : '▲')

function rowsFrom(snapshot: HardwareSnapshot | null, online: boolean, locating: boolean): Row[] {
  if (!snapshot) {
    return [
      { key: 'camera', icon: 'camera', label: 'Camera system', detail: 'Probing…', status: 'checking' },
      { key: 'printer', icon: 'printer', label: 'Photo printer', detail: 'Probing…', status: 'checking' },
      { key: 'screen', icon: 'monitor', label: 'Kiosk display', detail: 'Reading display…', status: 'checking' },
      { key: 'network', icon: 'wifi', label: 'Cloud network', detail: online ? 'Online' : 'Offline', status: online ? 'ok' : 'warn' },
    ]
  }

  const { camera, printer, kioskScreen } = snapshot
  return [
    {
      key: 'camera',
      icon: 'camera',
      label: 'Camera system',
      detail: camera.connected && camera.working ? (camera.model || camera.provider) : camera.error || 'Not connected',
      status: camera.connected && camera.working ? 'ok' : 'warn',
    },
    {
      key: 'printer',
      icon: 'printer',
      label: 'Photo printer',
      detail: printer.connected && printer.working ? `${printer.model}${printer.queueDepth ? ` · ${printer.queueDepth} queued` : ''}` : printer.error || 'Not connected',
      status: printer.connected && printer.working ? 'ok' : 'warn',
    },
    {
      key: 'screen',
      icon: 'monitor',
      label: 'Kiosk display',
      detail: `${kioskScreen.width}×${kioskScreen.height} @${kioskScreen.scaleFactor}×${kioskScreen.external ? ' · external' : ''}`,
      status: kioskScreen.connected ? 'ok' : 'warn',
    },
    {
      key: 'network',
      icon: 'wifi',
      label: 'Cloud network',
      detail: locating ? 'Resolving device location…' : online ? 'Online' : 'Offline',
      status: online ? 'ok' : 'warn',
    },
  ]
}

export function HardwareDock({ online = true, locating = false }: { online?: boolean; locating?: boolean }) {
  const [snapshot, setSnapshot] = useState<HardwareSnapshot | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let alive = true
    const read = async () => {
      try {
        const value = await bridge.hardware()
        if (alive) setSnapshot(value)
      } catch {
        /* the dock is diagnostics: never break pairing over it */
      }
    }
    void read()
    const timer = window.setInterval(read, 5000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const rows = rowsFrom(snapshot, online, locating)
  const faults = rows.filter((row) => row.status === 'warn').length
  const ready = faults === 0 && rows.every((row) => row.status === 'ok')

  return (
    <section className={`hw-dock${ready ? ' is-ready' : ''}`} aria-label="Hardware readiness">
      <header>
        <span className="hw-dock-eyebrow">{ready ? 'READY TO PAIR' : faults ? 'CHECK HARDWARE' : 'CHECKING HARDWARE'}</span>
        <span className={`hw-dock-pill${ready ? ' is-ok' : faults ? ' is-warn' : ''}`}>
          {dot(ready ? 'ok' : faults ? 'warn' : 'checking')} {ready ? 'All systems ready' : faults ? `${faults} needs attention` : 'Probing'}
        </span>
      </header>

      <ul>
        {(showAll ? rows : rows.slice(0, 3)).map((row) => (
          <li key={row.key} className={row.status === 'warn' ? 'is-warn' : undefined}>
            <span className="hw-dock-icon"><Icon name={row.icon} size={15} /></span>
            <span className="hw-dock-label">{row.label}</span>
            <span className="hw-dock-detail" title={row.detail}>{row.detail}</span>
          </li>
        ))}
      </ul>

      <footer>
        <button type="button" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll}>
          {showAll ? 'Show less' : 'Show all details'}
        </button>
        {snapshot ? <span>Snapshot {new Date(snapshot.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : <span>Awaiting snapshot…</span>}
      </footer>
    </section>
  )
}
