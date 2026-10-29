import { useEffect, useState, type FormEvent } from 'react'
import type { BoothSnapshot } from '../types'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { HardwareDock } from '../components/HardwareDock'
import { PrimaryButton } from '../components/Controls'
import { ScreenShell } from '../components/ScreenShell'

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
        <div className="login-stack">
        <form onSubmit={submit} className="login-form">
          <div className="login-mark"><Icon name="sparkles"/><span>BOOTH PAIRING</span></div>
          <h2>Connect this booth</h2>
          <p>Use an active organization account. A fresh installation UUID will be paired securely.</p>
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required/></label>
          <label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength={6} required/><button type="button" className="password-visibility" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
          <label>Booth location<input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} placeholder="Main reception, Hall A…" required/></label>
          {!error && <div className="location-note"><Icon name={coordinates ? 'check' : 'info'} size={16}/>{coordinates ? 'Device location captured for this pairing' : locating ? 'Requesting device location…' : 'Precise location unavailable — the label will be used'}</div>}
          {error && <div className="form-error"><Icon name="info" size={18}/>{error}</div>}
          <PrimaryButton type="submit" disabled={busy}>{busy ? 'Pairing booth…' : 'Pair & continue'}<Icon name="arrow-right" size={20}/></PrimaryButton>
        </form>
        <HardwareDock online={navigator.onLine} locating={locating}/>
        </div>
      </section>
    </main>
  )
}

export function StandbyScreen({
  busy,
  onRetry,
  onPairNew,
}: {
  busy: boolean
  onRetry: () => void
  onPairNew?: () => void
}) {
  return (
    <main className="splash-screen standby-screen">
      <div className="ambient ambient-a"/><div className="ambient ambient-b"/>
      <Brand/>
      <div className="boot-orbit"><span/><span/><span/></div>
      <span className="eyebrow" style={{ letterSpacing: '0.15em', color: '#ff4f9a', fontWeight: 700 }}>
        ENTERPRISE PHOTO KIOSK
      </span>
      <h1 style={{ fontSize: '2.4rem', margin: '12px 0 8px' }}>Booth Standing By</h1>
      <p style={{ maxWidth: '500px', margin: '0 auto 26px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
        Hardware calibrated. Connecting securely to the HappyPix Cloud Network…
      </p>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '380px',
        width: '100%',
        margin: '0 auto 28px',
        padding: '16px 20px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: '16px',
        backdropFilter: 'blur(12px)',
        textAlign: 'left',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.92rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.9)' }}>📷 Camera System</span>
          <span style={{ color: '#4ade80', fontWeight: 600 }}>● Ready</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.92rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.9)' }}>🖨️ Photo Printer</span>
          <span style={{ color: '#4ade80', fontWeight: 600 }}>● Online</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.92rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.9)' }}>☁️ Cloud Network</span>
          <span style={{ color: '#facc15', fontWeight: 600 }}>● Calibrating…</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
        <PrimaryButton onClick={onRetry} disabled={busy}>
          <Icon name="refresh" className={busy ? 'spin' : ''}/>
          {busy ? 'Connecting…' : 'Reconnect Booth'}
        </PrimaryButton>
        {onPairNew && (
          <button
            onClick={onPairNew}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.22)',
              color: 'rgba(255,255,255,0.85)',
              padding: '0 20px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '0.92rem',
              fontWeight: 500,
            }}
          >
            Pair Booth
          </button>
        )}
      </div>
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
