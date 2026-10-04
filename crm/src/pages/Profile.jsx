import { useEffect, useState } from 'react'
import { api } from '../api/index.js'
import { useApp } from '../context/AppContext.jsx'
import { Card, CardHead, Field, TextInput, PasswordInput, Button, Avatar, Chip, KV, ThemeSegmented, Modal } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '../lib/roles.js'
import { PLANS } from '../lib/plans.js'
import { dateShort, inr } from '../lib/format.js'
import { ENV, openExternal } from '../lib/env.js'

export default function Profile() {
  const { user, updateUser, toast, theme, toggleTheme } = useApp()
  const [name, setName] = useState(user?.name || '')
  const [photo, setPhoto] = useState(user?.photoUrl || null)
  const [cur, setCur] = useState('')
  const [nw, setNw] = useState('')
  const [cf, setCf] = useState('')
  const [busyName, setBusyName] = useState(false)
  const [busyPw, setBusyPw] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)

  const isOrgAdmin = user?.role === 'ORG_ADMIN'

  const saveName = async () => {
    if (!name.trim()) return toast('Name cannot be empty.', 'error')
    setBusyName(true)
    try {
      const r = await api.auth.updateProfile({ name: name.trim(), photoUrl: photo })
      updateUser(r.user)
      toast('Profile updated')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusyName(false)
    }
  }

  const changePw = async () => {
    if (nw.length < 8 || !/[A-Za-z]/.test(nw) || !/\d/.test(nw)) return toast('New password needs 8+ characters with at least one letter and one number.', 'error')
    if (nw !== cf) return toast('New passwords do not match.', 'error')
    setBusyPw(true)
    try {
      await api.auth.changePassword({ currentPassword: cur, newPassword: nw })
      setCur(''); setNw(''); setCf('')
      toast('Password changed')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusyPw(false)
    }
  }

  const onPhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 300 * 1024) return toast('Photo must be under 300 KB.', 'error')
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Profile</div>
          <div className="page-sub">Your own account — name, photo and password.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14 }}>
        <Card>
          <CardHead title="Account" />
          <div style={{ padding: '20px' }}>
            <div className="row gap-16 mb-16">
              {photo ? (
                <img src={photo} alt="profile" style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
              ) : (
                <Avatar name={user?.name || '?'} size={68} />
              )}
              <div>
                <Button size="sm" variant="outline" icon="upload" onClick={() => document.getElementById('pf-input')?.click()}>Change photo</Button>
                <input id="pf-input" type="file" accept="image/*" hidden onChange={onPhoto} />
                <div className="t11 faint mt-8">Square JPG/PNG, up to 300 KB.</div>
              </div>
            </div>
            <Field label="Full name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email ID" hint="Your login identifier. Changing it requires your password and a verification code sent to the new address.">
              <div className="row gap-8">
                <TextInput value={user?.email || ''} disabled style={{ background: 'var(--surface-2)', color: 'var(--muted)', flex: 1 }} />
                <Button variant="outline" size="sm" icon="edit" onClick={() => setEmailOpen(true)} style={{ height: 38, flex: 'none' }}>Change</Button>
              </div>
            </Field>
            <div className="row between" style={{ padding: '10px 0' }}>
              <span className="t12 muted">Role</span>
              <Chip tone={user?.role === 'OWNER' ? 'pink' : user?.role === 'PLATFORM_ADMIN' ? 'purple' : user?.role === 'SUPPORT_MANAGER' ? 'info' : user?.role === 'ORG_ADMIN' ? 'active' : 'neutral'}>
                {ROLE_LABELS[user?.role]}
              </Chip>
            </div>
            {user?.orgName ? (
              <div className="row between" style={{ padding: '10px 0' }}>
                <span className="t12 muted">Organization</span>
                <span className="t13 fw6">{user.orgName}</span>
              </div>
            ) : null}
            <Button variant="primary" icon="check" onClick={saveName} disabled={busyName} style={{ marginTop: 10 }}>
              {busyName ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Card>
            <CardHead title="Appearance" sub="Choose how the CRM looks on this device." />
            <div style={{ padding: '18px 20px' }}>
              <div className="row between gap-16" style={{ flexWrap: 'wrap' }}>
                <div style={{ minWidth: 180 }}>
                  <div className="t13 fw6">Colour theme</div>
                  <div className="t11 muted" style={{ marginTop: 2, lineHeight: 1.5 }}>
                    {theme === 'dark' ? 'Dark — easy on the eyes in low light.' : 'Light — the classic bright workspace.'}
                  </div>
                </div>
                <ThemeSegmented theme={theme} onChange={(t) => { if (t !== theme) toggleTheme() }} />
              </div>
              <p className="t11 faint mt-12" style={{ lineHeight: 1.5 }}>
                <Icon name="info" size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                Your choice is saved on this device and applied everywhere, including the login screen.
              </p>
            </div>
          </Card>

          <Card>
            <CardHead title="Change password" sub="This session stays active; every other device is signed out." />
            <div style={{ padding: '18px 20px' }}>
              <Field label="Current password">
                <PasswordInput value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
              </Field>
              <div className="row gap-12">
                <div style={{ flex: 1 }}>
                  <Field label="New password" hint="8+ chars, a letter and a number">
                    <PasswordInput value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Confirm new password">
                    <PasswordInput value={cf} onChange={(e) => setCf(e.target.value)} autoComplete="new-password" />
                  </Field>
                </div>
              </div>
              <Button variant="outline" icon="lock" onClick={changePw} disabled={busyPw || !cur || !nw || !cf}>
                {busyPw ? 'Updating…' : 'Update password'}
              </Button>
            </div>
          </Card>

          {isOrgAdmin ? (
            <Card>
              <CardHead title="Your plan" sub="Upgrades complete on the HappyPix website" />
              <div style={{ padding: '18px 20px' }}>
                <PlanCard />
              </div>
            </Card>
          ) : (
            <div className="card card-pad">
              <p className="t12 muted" style={{ lineHeight: 1.6 }}>
                <Icon name="info" size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                {ROLE_DESCRIPTIONS[user?.role]}
              </p>
            </div>
          )}
        </div>
      </div>

      <ChangeEmailModal open={emailOpen} onClose={() => setEmailOpen(false)} currentEmail={user?.email} onChanged={(u) => { updateUser({ ...user, ...u }); setEmailOpen(false) }} />
    </div>
  )
}

// ---------------- Change email (password + OTP to the NEW address) ----------------
// 1. new email + current password → server issues a 6-digit code to the new address
// 2. code → email swapped, other sessions signed out
function ChangeEmailModal({ open, onClose, currentEmail, onChanged }) {
  const { toast, useMock } = useApp()
  const [step, setStep] = useState('form') // form | code | done
  const [newEmail, setNewEmail] = useState('')
  const [pw, setPw] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reset = () => { setStep('form'); setNewEmail(''); setPw(''); setCode(''); setDevCode(null); setError('') }
  const close = () => { onClose(); setTimeout(reset, 200) }

  const requestCode = async (e) => {
    e?.preventDefault()
    const em = newEmail.trim().toLowerCase()
    if (!em) return setError('Enter your new email address.')
    if (em === String(currentEmail || '').toLowerCase()) return setError('That is already your email.')
    if (!pw) return setError('Enter your current password to confirm.')
    setBusy(true); setError('')
    try {
      const r = await api.auth.requestEmailChange(em, pw)
      setDevCode(r.code || null)
      setStep('code')
      toast(`Verification code sent to ${em} — valid for 10 minutes`, 'info')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (e) => {
    e?.preventDefault()
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code.')
    setBusy(true); setError('')
    try {
      const r = await api.auth.confirmEmailChange(code.trim())
      setStep('done')
      toast('Email updated', 'success')
      onChanged(r.user)
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
      title="Change email ID"
      sub={step === 'form' ? 'We verify the new address before it becomes your login.' : `Enter the 6-digit code we sent to ${newEmail.trim()}.`}
      footer={
        step === 'form' ? (
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={requestCode} disabled={busy || !newEmail.trim() || !pw}>{busy ? 'Sending…' : 'Send verification code'}</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => { setStep('form'); setCode(''); setError('') }} disabled={busy}>Back</Button>
            <Button variant="primary" onClick={confirm} disabled={busy || code.trim().length !== 6}>{busy ? 'Verifying…' : 'Verify & change email'}</Button>
          </>
        )
      }
    >
      {step === 'form' ? (
        <form onSubmit={requestCode}>
          <Field label="Current email">
            <TextInput value={currentEmail || ''} disabled style={{ background: 'var(--surface-2)', color: 'var(--muted)' }} />
          </Field>
          <Field label="New email address" required>
            <TextInput type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@company.com" autoFocus autoComplete="email" />
          </Field>
          <Field label="Current password" required hint="Confirms it is really you making this change.">
            <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          </Field>
          {error ? <div className="input-error" style={{ marginTop: -6 }}>{error}</div> : null}
        </form>
      ) : (
        <form onSubmit={confirm}>
          {devCode && useMock ? (
            <div className="card card-pad mb-16" style={{ background: 'var(--hp-pink-softer)', borderColor: 'var(--hp-pink-soft)' }}>
              <div className="t11 muted fw7" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Demo — your verification code</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 760, marginTop: 4, letterSpacing: '0.18em' }}>{devCode}</div>
              <div className="t11 faint mt-8">In production this is emailed to the new address and never shown here.</div>
            </div>
          ) : null}
          <Field label="6-digit verification code" required>
            <TextInput inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" autoFocus style={{ letterSpacing: '0.3em', fontWeight: 700 }} />
          </Field>
          {error ? <div className="input-error" style={{ marginTop: -6 }}>{error}</div> : null}
        </form>
      )}
    </Modal>
  )
}

function PlanCard() {
  const { user } = useApp()
  const [dash, setDash] = useState(null)
  useEffect(() => {
    api.org.dashboard().then((r) => setDash(r.plan)).catch(() => {})
  }, [])
  if (!dash) return null
  const pd = PLANS[dash.plan]
  return (
    <div>
      <div className="row between mb-12">
        <Chip tone="pink" dot>{dash.planName} plan</Chip>
        <span className="t12 num muted">{dash.daysLeft != null ? `${dash.daysLeft} days left` : ''}</span>
      </div>
      <KV k="Expires" v={dateShort(dash.endDate)} />
      <KV k="Devices" v={`${dash.deviceLimit} allowed`} />
      <KV k="Parallel active events" v={`${dash.eventLimit} allowed`} />
      {pd?.price ? <KV k="Paid" v={inr(pd.amount ?? pd.price)} /> : null}
      <Button variant="ink" icon="arrow-up-right" style={{ width: '100%', marginTop: 14 }} onClick={() => openExternal(ENV.WEBSITE_URL)}>
        Upgrade on website
      </Button>
      <p className="t11 faint mt-8">The new plan reflects in the CRM automatically once the payment is verified.</p>
    </div>
  )
}
