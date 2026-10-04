import { useEffect, useState, type FormEvent } from 'react'
import type { BoothSnapshot } from '../types'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { PrimaryButton } from '../components/Controls'
import { ScreenShell } from '../components/ScreenShell'
import { isDemoMode } from '../services/api'

export function BootScreen({ message }: { message: string }) {
  return (
    <main className="splash-screen">
      <div className="ambient ambient-a"/><div className="ambient ambient-b"/>
      <Brand/>
      <div className="boot-orbit"><span/><span/><span/></div>
      <h1>Waking up your booth</h1>
      <p>{message}</p>
    </main>
  )
}

export function LoginScreen({
  busy,
  error,
  onLogin,
}: {
  busy: boolean
  error: string | null
  onLogin: (values: { email: string; password: string; locationLabel: string; coordinates?: GeolocationCoordinates }) => Promise<void>
}) {
  const [email, setEmail] = useState(isDemoMode ? 'booth@happypix.in' : '')
  const [password, setPassword] = useState(isDemoMode ? 'demo123' : '')
  const [locationLabel, setLocationLabel] = useState('Main reception')
  const [coordinates, setCoordinates] = useState<GeolocationCoordinates | undefined>()
  const [locating, setLocating] = useState(Boolean(navigator.geolocation))

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates(position.coords)
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 300000 },
    )
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void onLogin({ email, password, locationLabel, coordinates })
  }

  return (
    <main className="login-screen">
      <section className="login-story">
        <div className="ambient ambient-a"/><div className="ambient ambient-c"/>
        <Brand/>
        <div className="story-copy">
          <span className="eyebrow">THE HAPPYPIX EXPERIENCE</span>
          <h1>Little moments.<br/><em>Beautifully kept.</em></h1>
          <p>Pair this kiosk securely, then let every guest make something worth taking home.</p>
        </div>
        <div className="story-film" aria-hidden="true"><span/><span/><span/><span/></div>
      </section>
      <section className="login-panel">
        <form onSubmit={submit} className="login-form">
          <div className="login-mark"><Icon name="sparkles"/><span>BOOTH PAIRING</span></div>
          <h2>Connect this booth</h2>
          <p>Use an active organization account. A fresh installation UUID will be paired securely.</p>
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required/></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength={6} required/></label>
          <label>Booth location<input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} placeholder="Main reception, Hall A…" required/></label>
          <div className="location-note"><Icon name={coordinates ? 'check' : 'info'} size={16}/>{coordinates ? 'Device location captured for this pairing' : locating ? 'Requesting device location…' : 'Precise location unavailable — the label will be used'}</div>
          {error && <div className="form-error"><Icon name="info" size={18}/>{error}</div>}
          <PrimaryButton type="submit" disabled={busy}>{busy ? 'Pairing booth…' : 'Pair & continue'}<Icon name="arrow-right" size={20}/></PrimaryButton>
          {isDemoMode && <div className="demo-note"><b>Demo build</b><span>booth@happypix.in · demo123</span></div>}
        </form>
      </section>
    </main>
  )
}

const WAITING_LINES = [
  'Polishing the pixels while we wait…',
  'A great photo is only one event away.',
  'Camera-ready. Confetti-ready. Guest-ready.',
]

export function WaitingScreen({ snapshot, refreshing, onRefresh }: { snapshot: BoothSnapshot; refreshing: boolean; onRefresh: () => void }) {
  const [line, setLine] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setLine((value) => (value + 1) % WAITING_LINES.length), 5000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <ScreenShell screen="waiting" className="waiting-screen">
      <div className="waiting-content">
        <div className="waiting-icon"><Icon name="sparkles" size={42}/><span className="pulse-ring"/></div>
        <span className="eyebrow">{snapshot.organization.name}</span>
        <h1>No event right now</h1>
        <p>{WAITING_LINES[line]}</p>
        <PrimaryButton onClick={onRefresh} disabled={refreshing}><Icon name="refresh" className={refreshing ? 'spin' : ''}/>{refreshing ? 'Checking…' : 'Check for event'}</PrimaryButton>
        <div className="waiting-device"><span className="status-dot"/> {snapshot.device.name} is connected and checking automatically</div>
      </div>
    </ScreenShell>
  )
}
