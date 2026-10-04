// Organization Defaults — the org's single configuration surface.
//
// What lives here (and nothing else):
//   • Identity            — organization name + logo
//   • Payments & payouts  — the org UPI ID guests pay to, and whether money
//                           goes straight to that UPI or to the HappyPix wallet
//   • Booth behaviour     — idle timeout, in SECONDS
//   • Layouts & pricing   — the 16 platform layout families (cut sizes)
//                           with their image-slot iterations. The org
//                           admin sets the guest-facing price per
//                           iteration; a cleared price removes that
//                           layout from the booth.
//
// There is no per-event pricing anywhere in the CRM — this is the only
// place print prices live.

import { useEffect, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Card, CardHead, Field, TextInput, Button, PageLoader, WarnBanner, Toggle, Chip } from '../../components/ui.jsx'
import { QRCode } from '../../components/QRCode.jsx'
import { upiIntent } from '../../lib/qr.js'
import { inr } from '../../lib/format.js'
import { Icon } from '../../lib/icons.jsx'
import { LAYOUT_FAMILIES, LAYOUTS, PRICE_KEY } from '../../lib/layouts.js'
import { ROLES } from '../../lib/roles.js'

const TIMEOUT_PRESETS = [
  { label: '10s', value: 10 },
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
]

export default function OrgDefaults() {
  const { user, toast } = useApp()
  const readOnly = user.role !== ROLES.ORG_ADMIN
  const [d, setD] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    api.org.defaults().then(setD).catch((e) => toast(e.message, 'error'))
  }, [])

  if (!d) return <PageLoader />

  const set = (k, v) => {
    if (readOnly) return
    setD((x) => ({ ...x, [k]: v }))
    setDirty(true)
  }
  const setPrice = (familyId, slots, v) => {
    if (readOnly) return
    const key = PRICE_KEY(familyId, slots)
    setD((x) => {
      const prices = { ...x.layoutPrices }
      if (v === '' || v == null) delete prices[key]
      else prices[key] = Math.max(0, Number(v) || 0)
      return { ...x, layoutPrices: prices }
    })
    setDirty(true)
  }

  const onLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 300 * 1024) {
      toast('Logo must be under 300 KB.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => set('logoUrl', reader.result)
    reader.readAsDataURL(file)
  }
  const disabledInput = readOnly
    ? { background: 'var(--surface-2)', color: 'var(--muted)' }
    : undefined

  const save = async () => {
    setBusy(true)
    try {
      const saved = await api.org.saveDefaults({
        name: d.name,
        logoUrl: d.logoUrl,
        boothTimeoutSec: Number(d.boothTimeoutSec) || 600,
        layoutPrices: d.layoutPrices,
        upiId: d.upiId || '',
        payoutMode: d.payoutMode,
      })
      setD(saved)
      setDirty(false)
      toast('Organization defaults saved')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const offeredCount = Object.keys(d.layoutPrices || {}).length

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Organization Defaults</div>
          <div className="page-sub">
            Your organization's single configuration surface: identity, booth idle timeout, and what guests pay for
            every layout at your booths. Events never carry prices.
          </div>
        </div>
        {readOnly ? null : (
          <Button variant="primary" icon="check" onClick={save} disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save defaults'}
          </Button>
        )}
      </div>

      {readOnly ? (
        <div style={{ marginBottom: 14 }}>
          <WarnBanner tone="info" icon="info">
            Read-only — layout prices, logo and booth settings can only be changed by your Organization Admin.
          </WarnBanner>
        </div>
      ) : dirty ? (
        <div style={{ marginBottom: 14 }}>
          <WarnBanner tone="pink" icon="edit">You have unsaved changes.</WarnBanner>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        <Card>
          <CardHead title="Identity" sub="Shown to guests on prints and download pages" />
          <div style={{ padding: '18px 20px' }}>
            <div className="row gap-16 mb-16" style={{ alignItems: 'center' }}>
              {d.logoUrl ? (
                <img src={d.logoUrl} alt="logo" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }} />
              ) : (
                <span className="stat-ico" style={{ width: 64, height: 64, borderRadius: 14, background: 'var(--hp-pink-soft)', color: 'var(--hp-pink)', flex: 'none' }}>
                  <Icon name="camera" size={28} />
                </span>
              )}
              <div>
                {!readOnly ? (
                  <Button size="sm" variant="outline" icon="upload" onClick={() => document.getElementById('logo-input')?.click()}>Upload logo</Button>
                ) : null}
                <input id="logo-input" type="file" accept="image/*" hidden onChange={onLogo} />
                {d.logoUrl ? (
                  <div className="t11 faint mt-8">PNG or SVG, square works best. Max 300 KB.</div>
                ) : (
                  <div className="t11 faint mt-8">No logo yet — guests will see your name only.</div>
                )}
              </div>
            </div>
            <Field label="Organization name" required>
              <TextInput value={d.name} onChange={(e) => set('name', e.target.value)} disabled={readOnly} style={disabledInput} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHead
            title="Payments & payouts"
            sub="Where guest money goes"
          >
            <Chip tone={d.payoutMode === 'upi' ? 'active' : 'info'} dot>{d.payoutMode === 'upi' ? 'Direct to UPI' : 'HappyPix wallet'}</Chip>
          </CardHead>
          <div style={{ padding: '18px 20px' }}>
            <div className="row gap-16" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <Field label="Organization UPI ID" hint="Guests scan this UPI QR at the booth. Wallet withdrawals are also paid to this ID.">
                  <TextInput
                    value={d.upiId || ''}
                    onChange={(e) => set('upiId', e.target.value.trim())}
                    placeholder="business@okaxis"
                    disabled={readOnly}
                    style={disabledInput}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </Field>
                <div className="row between gap-12" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="t13 fw6">Receive money directly in UPI</div>
                    <div className="t11 muted" style={{ marginTop: 2, lineHeight: 1.45 }}>
                      {d.payoutMode === 'upi'
                        ? 'ON — guests pay your UPI ID; money lands in your bank instantly.'
                        : 'PAUSED — HappyPix collects guest payments and credits your wallet. Withdraw any time (min ₹500) to your UPI ID.'}
                    </div>
                  </div>
                  <Toggle
                    on={d.payoutMode === 'upi'}
                    disabled={readOnly || (!d.upiId && d.payoutMode !== 'upi')}
                    onChange={(on) => set('payoutMode', on ? 'upi' : 'wallet')}
                  />
                </div>
                {!d.upiId && !readOnly ? <div className="t11" style={{ color: 'var(--warn)', marginTop: 6 }}>Add a UPI ID to enable direct payouts.</div> : null}
                {d.wallet ? (
                  <div className="row between mt-12 t12">
                    <span className="muted">Wallet balance</span>
                    <span className="num fw7">{inr(d.wallet.balance)} <a href="#/org/revenue" className="t11" style={{ color: 'var(--hp-pink-deep)', fontWeight: 600, marginLeft: 6 }}>Withdraw →</a></span>
                  </div>
                ) : null}
              </div>
              <div style={{ textAlign: 'center', flex: 'none' }}>
                {d.upiId ? (
                  <>
                    <div style={{ padding: 8, background: '#fff', borderRadius: 12, border: '1px solid var(--line)', display: 'inline-block' }}>
                      <QRCode value={upiIntent({ pa: d.upiId, pn: d.name })} size={128} />
                    </div>
                    <div className="t11 muted mt-8" style={{ maxWidth: 150, lineHeight: 1.4 }}>
                      {d.payoutMode === 'upi' ? 'This QR is shown to guests at your booths.' : 'Preview only — guests see the HappyPix QR while paused.'}
                    </div>
                  </>
                ) : (
                  <div style={{ width: 144, height: 144, borderRadius: 12, border: '1.5px dashed var(--line)', display: 'grid', placeItems: 'center', color: 'var(--faint)' }}>
                    <Icon name="qr" size={34} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Booth behaviour" sub="Idle timeout for the kiosk — in seconds" />
          <div style={{ padding: '18px 20px' }}>
            <Field
              label="Booth idle timeout (seconds)"
              hint="How long a booth waits for guest action before returning to the event welcome screen. 10 s to 24 h."
            >
              <div className="row gap-8">
                <TextInput
                  type="number"
                  value={d.boothTimeoutSec}
                  onChange={(e) => set('boothTimeoutSec', e.target.value)}
                  disabled={readOnly}
                  style={{ width: 120, ...disabledInput }}
                />
                <span className="t12 muted">
                  ≈ {Number(d.boothTimeoutSec) >= 60 ? `${Math.floor(Number(d.boothTimeoutSec) / 60)} min ${Number(d.boothTimeoutSec) % 60 ? `${Number(d.boothTimeoutSec) % 60} s` : ''}` : `${d.boothTimeoutSec} s`}
                </span>
              </div>
            </Field>
            {!readOnly ? (
              <div className="row gap-8 mt-8">
                {TIMEOUT_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => set('boothTimeoutSec', p.value)}
                    style={{
                      padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${Number(d.boothTimeoutSec) === p.value ? 'var(--hp-pink)' : 'var(--line)'}`,
                      background: Number(d.boothTimeoutSec) === p.value ? 'var(--hp-pink-soft)' : 'var(--surface)',
                      color: Number(d.boothTimeoutSec) === p.value ? 'var(--hp-pink-deep)' : 'var(--ink-2)',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 14 }}>
        <CardHead
          title={`Layouts & print pricing · ${LAYOUTS.length} layout variants on ${LAYOUT_FAMILIES.length} cut sizes`}
          sub="Guests pick a layout at the booth (orientation → image count → page size) and see these prices. Set a price to offer a layout; clear it to remove the layout from your booths. Managers have read-only access."
        />
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 12 }}>
          {LAYOUT_FAMILIES.map((f) => (
            <div
              key={f.id}
              style={{
                border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--surface-2)',
                padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10,
              }}
            >
              <div className="row between" style={{ gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="t13 fw6 ellipsis">{f.name}</div>
                  <div className="t11 faint">{f.blurb}</div>
                </div>
                <span className="chip chip-neutral" style={{ flex: 'none' }} title="Print code">{f.code}</span>
              </div>
              <div className="row wrap gap-6 t11 muted">
                <span className="chip chip-info" style={{ height: 19, fontSize: 10.5 }}>cut {f.cutout[0]}×{f.cutout[1]} in</span>
                {f.sheets.map((sh) => (
                  <span key={sh} className="chip chip-neutral" style={{ height: 19, fontSize: 10.5 }} title="Native media / sheet">sheet {sh}</span>
                ))}
              </div>
              <div className="row wrap gap-8">
                {f.slots.map((sl) => {
                  const val = d.layoutPrices?.[PRICE_KEY(f.id, sl)]
                  return (
                    <div
                      key={sl}
                      style={{
                        border: `1.5px solid ${val != null ? 'var(--line)' : 'var(--line-soft)'}`,
                        borderRadius: 'var(--r-sm)', padding: '7px 10px 8px', background: 'var(--surface)',
                        opacity: val != null ? 1 : 0.62, minWidth: 86,
                      }}
                    >
                      <div className="row gap-6 t11" style={{ marginBottom: 4 }}>
                        <span className="fw6" style={{ color: val != null ? 'var(--hp-pink-deep)' : 'var(--faint)' }}>{sl}</span>
                        <span className="faint">image{sl > 1 ? 's' : ''}</span>
                      </div>
                      <div className="row gap-6">
                        <span className="t12 muted">₹</span>
                        <TextInput
                          type="number"
                          placeholder="—"
                          value={val != null ? val : ''}
                          onChange={(e) => setPrice(f.id, sl, e.target.value)}
                          disabled={readOnly}
                          title={val != null ? `Guests pay ₹${val} for ${f.name} (${sl} images)` : 'No price — layout hidden from guests'}
                          style={{ width: 64, height: 28, fontSize: 12.5, padding: '0 8px', ...disabledInput }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line-soft)' }}>
          <p className="t11 faint" style={{ lineHeight: 1.6 }}>
            <Icon name="shield" size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
            Every layout exists in vertical AND horizontal ({LAYOUTS.length} variants in all — both orientations share
            one price). Currently <b>{offeredCount}</b> iteration(s) are priced and visible to guests at your booths.
            The layout catalogue itself is a platform asset; here you only set what your booths charge.
          </p>
        </div>
      </Card>
    </div>
  )
}
