import { useState, lazy, Suspense } from 'react'
import { USE_MOCK } from '../api/client.js'

// The demo quick-login panel is code-split and only ever imported when
// VITE_MOCK=true — production bundles contain no demo accounts.
const DemoQuickLogin = USE_MOCK ? lazy(() => import('../components/DemoQuickLogin.jsx')) : () => null
import { useApp } from '../context/AppContext.jsx'
import { api } from '../api/index.js'
import { FullLogo } from '../components/Logo.jsx'
import { Icon } from '../lib/icons.jsx'
import { Field, TextInput, PasswordInput, Button, Spinner, Modal, ThemeToggle, WarnBanner } from '../components/ui.jsx'


export default function Login() {
  const { login, useMock, theme, toggleTheme } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)

  const doLogin = async (em, pw) => {
    setBusy(true)
    setError('')
    try {
      const u = await login(em, pw)
      location.hash = ''
      location.hash = u.role.startsWith('ORG') ? '#/org/dashboard' : '#/platform/dashboard'
    } catch (e) {
      setError(e.message || 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Enter your email and password.')
      return
    }
    doLogin(email, password)
  }

  return (
    <div className="login-wrap">
      <ThemeToggle floating theme={theme} onToggle={toggleTheme} />

      <div className="login-brand">
        <div style={{ position: 'relative', zIndex: 2 }}>
          <FullLogo width={168} onDark />
        </div>
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 480 }}>
          <h1 style={{ fontSize: 40, lineHeight: 1.12, fontWeight: 760, letterSpacing: '-0.03em' }}>
            Run your entire<br />
            photobooth empire<br />
            <span style={{ color: '#EA097F' }}>from one place.</span>
          </h1>
          <p style={{ marginTop: 18, fontSize: 15, color: 'rgba(255,255,255,0.66)', lineHeight: 1.65 }}>
            Events, booths, prints, payments, coupons and guest support —
            one role-aware workspace for the platform and every client.
          </p>
          <div className="row wrap gap-12" style={{ marginTop: 28 }}>
            {[
              ['monitor', 'Booth devices pair by UUID'],
              ['revenue', 'Live revenue per event & booth'],
              ['tag', 'Organization-owned coupons'],
              ['headset', 'Guest support inbox'],
            ].map(([ic, t]) => (
              <span key={t} className="chip" style={{ background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.85)', height: 28, fontSize: 12, backdropFilter: 'blur(6px)' }}>
                <Icon name={ic} size={13} /> {t}
              </span>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 2, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          © 2026 HappyPix CRM · v2
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <div style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 22, fontWeight: 740, letterSpacing: '-0.02em' }}>Sign in to CRM</h2>
            <p className="t13 muted" style={{ marginTop: 5 }}>Use the email and password from your HappyPix account.</p>
          </div>
          <form onSubmit={submit}>
            <Field label="Email address" required>
              <TextInput type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Password" required error={error || undefined}>
              <PasswordInput placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--hp-pink-deep)' }} onClick={() => setForgotOpen(true)}>
                Forgot password?
              </button>
            </div>
            <Button type="submit" variant="primary" size="lg" style={{ width: '100%' }} disabled={busy}>
              {busy ? <Spinner small /> : <Icon name="arrow-up-right" size={16} />}
              {busy ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          {useMock ? (
            <Suspense fallback={null}>
              <DemoQuickLogin busy={busy} onPick={doLogin} />
            </Suspense>
          ) : null}
        </div>
      </div>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  )
}

// ---------------- Forgot password (OTP-style, 3 steps) ----------------
// 1. Email → server issues a 6-digit code (demo shows it; production emails/SMSes it)
// 2. Code + new password → verified and set
// 3. Success → back to sign in

function ForgotPasswordModal({ open, onClose }) {
  const { toast, useMock } = useApp()
  const [step, setStep] = useState('email') // email | reset | done
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [cf, setCf] = useState('')
  const [devCode, setDevCode] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setStep('email'); setEmail(''); setCode(''); setPw(''); setCf(''); setDevCode(null); setError('')
  }

  const close = () => {
    onClose()
    setTimeout(reset, 200)
  }

  const requestCode = async (e) => {
    e?.preventDefault()
    if (!email.trim()) return setError('Enter the email on your HappyPix account.')
    setBusy(true)
    setError('')
    try {
      const r = await api.auth.forgotPassword(email.trim())
      setDevCode(r.code || null)
      setStep('reset')
      toast('Reset code issued — valid for 10 minutes', 'info')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const doReset = async (e) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code.')
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return setError('New password needs 8+ characters with at least one letter and one number.')
    if (pw !== cf) return setError('New passwords do not match.')
    setBusy(true)
    setError('')
    try {
      await api.auth.resetPassword(email.trim(), code.trim(), pw)
      setStep('done')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={step === 'done' ? 'Password updated' : 'Reset your password'}
      sub={
        step === 'email' ? 'We will send a 6-digit reset code to your registered email.'
        : step === 'reset' ? `Enter the code we sent to ${email}.`
        : undefined
      }
      footer={
        step === 'done' ? (
          <Button variant="primary" onClick={close}>Back to sign in</Button>
        ) : step === 'email' ? (
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={requestCode} disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Send reset code'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => { setStep('email'); setCode(''); setPw(''); setCf(''); setError('') }} disabled={busy}>
              Change email
            </Button>
            <Button variant="primary" onClick={doReset} disabled={busy || !code || !pw || !cf}>
              {busy ? 'Updating…' : 'Set new password'}
            </Button>
          </>
        )
      }
    >
      {step === 'email' && (
        <form onSubmit={requestCode}>
          <Field label="Registered email address" required>
            <TextInput type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" />
          </Field>
          {error ? <div className="input-error" style={{ marginTop: -6 }}>{error}</div> : null}
          <p className="t11 faint mt-8">The code is valid for 10 minutes and can be used once.</p>
          <button type="submit" hidden />
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={doReset}>
          {devCode && useMock ? (
            <div style={{ marginBottom: 16 }}>
              <WarnBanner tone="info" icon="info">
                <span>
                  <b>Demo mode:</b> no email server here, so your reset code is <b className="num" style={{ fontSize: 15, letterSpacing: '0.14em' }}>{devCode}</b>.
                  In production this arrives by email/SMS.
                </span>
              </WarnBanner>
            </div>
          ) : null}
          <Field label="6-digit reset code" required>
            <TextInput
              inputMode="numeric"
              placeholder="••••••"
              maxLength={6}
              className="num"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ fontSize: 18, letterSpacing: '0.4em', textAlign: 'center', fontWeight: 700 }}
              autoFocus
            />
          </Field>
          <Field label="New password" required hint="Minimum 6 characters.">
            <PasswordInput placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" required error={error || undefined}>
            <PasswordInput placeholder="Repeat new password" value={cf} onChange={(e) => setCf(e.target.value)} autoComplete="new-password" />
          </Field>
          <button type="submit" hidden />
        </form>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
          <span className="stat-ico" style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--hp-green-soft)', color: 'var(--hp-green-ink)', margin: '0 auto 12px' }}>
            <Icon name="check-circle" size={26} />
          </span>
          <p className="t13" style={{ fontWeight: 640 }}>Your password has been changed.</p>
          <p className="t12 muted" style={{ marginTop: 4 }}>Sign in with your email and the new password.</p>
        </div>
      )}
    </Modal>
  )
}
