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

import { useEffect, useState, useMemo } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Card, CardHead, Field, TextInput, Button, PageLoader, WarnBanner, Chip, Select, SearchInput } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { LAYOUT_FAMILIES, LAYOUTS, PRICE_KEY, resolveLayout } from '../../lib/layouts.js'
import { ROLES } from '../../lib/roles.js'
import TemplatePreview from '../../components/TemplatePreview.jsx'

const TIMEOUT_PRESETS = [
  { label: '10s', value: 10 },
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
]

export default function OrgDefaults() {
  const { user, toast, readOnly: suspended, orgNotice } = useApp()
  const readOnly = user.role !== ROLES.ORG_ADMIN
  const [d, setD] = useState(null)
  const canUseCustomGateways = d?.canUseCustomGateways ?? ['premium', 'custom'].includes(String(user?.plan || d?.plan || '').toLowerCase())
  const isGatewayDisabled = readOnly || !canUseCustomGateways
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showRzpSecret, setShowRzpSecret] = useState(false)
  const [showCfSecret, setShowCfSecret] = useState(false)
  const [gatewayTab, setGatewayTab] = useState('razorpay')
  const [templates, setTemplates] = useState([])
  const [pricingMode, setPricingMode] = useState('matrix') // 'matrix' | 'templates'
  const [templateSearch, setTemplateSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  useEffect(() => {
    api.org.defaults().then((res) => {
      setD({
        ...res,
        templatePrices: res.templatePrices || {},
      })
    }).catch((e) => toast(e.message, 'error'))
  }, [])

  useEffect(() => {
    Promise.all([
      api.org.templates().catch(() => ({ templates: [] })),
      api.org.aiTemplates().catch(() => ({ templates: [] }))
    ]).then(([platformRes, orgRes]) => {
      const combined = [
        ...(platformRes.templates || []),
        ...(orgRes.templates || []).map((t) => ({
           ...t,
           id: t._id || t.id,
           type: 'org',
           layoutId: t.layout?.code || t.layoutCode || 'custom',
           originalLayoutCode: t.layout?.code || t.layoutCode,
           source: t.source === 'manual' ? 'manual' : 'ai_generated',
           category: t.category || 'Custom'
        }))
      ];
      setTemplates(combined);
    }).catch(() => {});
  }, [])

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const nameMatch = !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase())
      const catMatch = !selectedCategory || t.category === selectedCategory
      return nameMatch && catMatch
    })
  }, [templates, templateSearch, selectedCategory])

  const templateCategories = useMemo(() => {
    const cats = new Set()
    for (const t of templates) {
      if (t.category) cats.add(t.category)
    }
    return Array.from(cats)
  }, [templates])

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

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

  const setTemplatePrice = (templateId, v) => {
    if (readOnly) return
    setD((x) => {
      const tPrices = { ...(x.templatePrices || {}) }
      if (v === '' || v == null) {
        delete tPrices[templateId]
      } else {
        tPrices[templateId] = Math.max(0, Math.round(Number(v) || 0))
      }
      return { ...x, templatePrices: tPrices }
    })
    setDirty(true)
  }

  const getBaselinePrice = (t) => {
    const layout = resolveLayout(t)
    if (!layout) return null
    const key = PRICE_KEY(layout.familyId, layout.slots)
    return d.layoutPrices?.[key] ?? null
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
    if (suspended) { toast(orgNotice?.message || 'This organization is suspended — changes are disabled until HappyPix restores it.', 'error'); return }
    setBusy(true)
    try {
      const payload = {
        name: d.name,
        logoUrl: d.logoUrl,
        boothTimeoutSec: Number(d.boothTimeoutSec) || 60,
        layoutPrices: d.layoutPrices,
        templatePrices: d.templatePrices || {},
        upiId: d.upiId || '',
        paymentDisplayName: d.paymentDisplayName || '',
        payoutMode: d.payoutMode,
        razorpayKeyId: d.razorpayKeyId || '',
        razorpayEnv: d.razorpayEnv || 'production',
        cashfreeAppId: d.cashfreeAppId || '',
        cashfreeEnv: d.cashfreeEnv || 'production',
        gatewayPriority: d.gatewayPriority || 'razorpay',
      }
      if (d.razorpayKeySecret && d.razorpayKeySecret.trim() !== '') {
        payload.razorpayKeySecret = d.razorpayKeySecret.trim()
      }
      if (d.cashfreeSecretKey && d.cashfreeSecretKey.trim() !== '') {
        payload.cashfreeSecretKey = d.cashfreeSecretKey.trim()
      }
      const saved = await api.org.saveDefaults(payload)
      setD({
        ...saved,
        templatePrices: saved.templatePrices || d.templatePrices || {},
        razorpayKeySecret: d.razorpayKeySecret || '',
        cashfreeSecretKey: d.cashfreeSecretKey || '',
      })
      setDirty(false)
      toast('Organization defaults saved successfully!')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const switchPriority = async (newPriority) => {
    if (readOnly) return
    set('gatewayPriority', newPriority)
    try {
      await api.org.saveDefaults({ gatewayPriority: newPriority })
      toast(`Priority saved: ${newPriority === 'cashfree' ? 'Cashfree 1st → Razorpay Fallback' : 'Razorpay 1st → Cashfree Fallback'}`)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const offeredCount = Object.keys(d.layoutPrices || {}).length
  const customTemplateCount = Object.keys(d.templatePrices || {}).filter(
    (k) => d.templatePrices[k] != null && d.templatePrices[k] !== ''
  ).length

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

      <div
        className="defaults-top-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(310px, 350px) minmax(480px, 1fr)',
          gap: 14,
          marginBottom: 14,
          alignItems: 'stretch',
        }}
      >
        {/* Left Column: Identity + Booth behaviour stacked & balanced */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <CardHead title="Identity" sub="Shown to guests on prints and download pages" />
            <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="row gap-14" style={{ alignItems: 'center' }}>
                {d.logoUrl ? (
                  <img
                    src={d.logoUrl}
                    alt="logo"
                    style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }}
                  />
                ) : (
                  <span
                    className="stat-ico"
                    style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--hp-pink-soft)', color: 'var(--hp-pink)', flex: 'none' }}
                  >
                    <Icon name="camera" size={24} />
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {!readOnly ? (
                    <Button size="sm" variant="outline" icon="upload" onClick={() => document.getElementById('logo-input')?.click()}>
                      Upload logo
                    </Button>
                  ) : null}
                  <input id="logo-input" type="file" accept="image/*" hidden onChange={onLogo} />
                  <div className="t11 faint mt-4">
                    {d.logoUrl ? 'Square PNG/SVG, max 300 KB' : 'No logo yet — guests will see name only'}
                  </div>
                </div>
              </div>

              <Field label="Organization name" required style={{ marginBottom: 0 }}>
                <TextInput
                  value={d.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Acme Corp"
                  disabled={readOnly}
                  style={disabledInput}
                />
              </Field>

              <div className="row gap-8" style={{ marginTop: 'auto', paddingTop: 8, alignItems: 'center' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.name ? 'var(--hp-green)' : 'var(--warn)' }} />
                <span className="t11 faint">
                  {d.name ? `Branding active for ${d.name}` : 'Set name & logo for booth prints'}
                </span>
              </div>
            </div>
          </Card>

          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <CardHead title="Booth behaviour" sub="Idle timeout for kiosk before session reset" />
            <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field
                label="Booth idle timeout (seconds)"
                hint="How long booth waits before returning to welcome screen"
                style={{ marginBottom: 0 }}
              >
                <div className="row gap-8" style={{ alignItems: 'center' }}>
                  <TextInput
                    type="number"
                    value={d.boothTimeoutSec}
                    onChange={(e) => set('boothTimeoutSec', e.target.value)}
                    disabled={readOnly}
                    style={{ width: 100, ...disabledInput }}
                  />
                  <span className="t12 fw6" style={{ color: 'var(--ink-2)' }}>seconds</span>
                  <span className="t11 muted" style={{ marginLeft: 'auto' }}>
                    ≈ {Number(d.boothTimeoutSec) >= 60 ? `${Math.floor(Number(d.boothTimeoutSec) / 60)} min ${Number(d.boothTimeoutSec) % 60 ? `${Number(d.boothTimeoutSec) % 60} s` : ''}` : `${d.boothTimeoutSec} s`}
                  </span>
                </div>
              </Field>

              {!readOnly ? (
                <div className="row gap-8 mt-2" style={{ flexWrap: 'wrap' }}>
                  {TIMEOUT_PRESETS.map((p) => {
                    const active = Number(d.boothTimeoutSec) === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => set('boothTimeoutSec', p.value)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: `1.5px solid ${active ? 'var(--hp-pink)' : 'var(--line)'}`,
                          background: active ? 'var(--hp-pink-soft)' : 'var(--surface)',
                          color: active ? 'var(--hp-pink-deep)' : 'var(--muted)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="row gap-8" style={{ marginTop: 'auto', paddingTop: 8, alignItems: 'center' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--hp-blue)' }} />
                <span className="t11 faint">
                  Auto-resets kiosk to welcome screen after idle timeout
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Payment Gateways (Takes remaining width, balanced height) */}
        <Card style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CardHead
            title="Payment Gateways"
            sub="Real-time dynamic UPI QR verification"
          >
            {!canUseCustomGateways ? (
              <Chip tone="purple">Business Plan Only</Chip>
            ) : (
              <Chip tone={d.razorpayKeyId && d.cashfreeAppId ? 'active' : d.razorpayKeyId || d.cashfreeAppId ? 'info' : 'warn'} dot>
                {d.razorpayKeyId && d.cashfreeAppId
                  ? 'Dual Gateways Ready'
                  : d.razorpayKeyId
                  ? 'Razorpay Active'
                  : d.cashfreeAppId
                  ? 'Cashfree Active'
                  : 'Not Configured'}
              </Chip>
            )}
          </CardHead>

          <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!canUseCustomGateways && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🔒</span>
                  <div>
                    <div className="t12 fw7" style={{ color: 'var(--hp-purple, #9333ea)' }}>
                      Own Merchant Payment Gateways is a Business (Premium) Plan Feature
                    </div>
                    <div className="t11 muted">
                      Direct Razorpay & Cashfree API settlements into your bank account are reserved for Business & Enterprise tiers.
                    </div>
                  </div>
                </div>
                <span className="t11 fw7" style={{ color: 'var(--hp-pink, #ea097f)' }}>
                  Upgrade plan to unlock
                </span>
              </div>
            )}

            {/* Sleek Interactive Priority Strip */}
            <div
              className="row between gap-12"
              style={{
                alignItems: 'center',
                padding: '9px 13px',
                borderRadius: 10,
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                flexWrap: 'wrap',
                opacity: isGatewayDisabled ? 0.6 : 1,
              }}
            >
              <div className="row gap-8" style={{ alignItems: 'center' }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: 'var(--hp-pink-soft)',
                    color: 'var(--hp-pink)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  ⚡
                </span>
                <div>
                  <span className="t12 fw7">Gateway Priority & Automatic Failover:</span>
                  <span className="t11 muted" style={{ marginLeft: 6 }}>
                    Primary is tried first; booth auto-switches if offline.
                  </span>
                </div>
              </div>

              <div style={{ display: 'inline-flex', padding: 2, gap: 2, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <button
                  type="button"
                  onClick={() => switchPriority('razorpay')}
                  disabled={isGatewayDisabled}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: 'none',
                    cursor: isGatewayDisabled ? 'not-allowed' : 'pointer',
                    padding: '4px 11px',
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 650,
                    background: (d.gatewayPriority || 'razorpay') === 'razorpay' ? 'var(--hp-pink-soft)' : 'transparent',
                    color: (d.gatewayPriority || 'razorpay') === 'razorpay' ? 'var(--hp-pink-deep)' : 'var(--muted)',
                    boxShadow: (d.gatewayPriority || 'razorpay') === 'razorpay' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: '#3b82f6', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 9, fontWeight: 800 }}>R</span>
                  1. Razorpay → Cashfree
                </button>
                <button
                  type="button"
                  onClick={() => switchPriority('cashfree')}
                  disabled={isGatewayDisabled}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: 'none',
                    cursor: isGatewayDisabled ? 'not-allowed' : 'pointer',
                    padding: '4px 11px',
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 650,
                    background: d.gatewayPriority === 'cashfree' ? 'var(--hp-green-soft)' : 'transparent',
                    color: d.gatewayPriority === 'cashfree' ? 'var(--hp-green-ink)' : 'var(--muted)',
                    boxShadow: d.gatewayPriority === 'cashfree' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: '#10b981', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 9, fontWeight: 800 }}>C</span>
                  1. Cashfree → Razorpay
                </button>
              </div>
            </div>

            {/* Side-by-side Dual Gateways with perfectly matched heights */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, flex: 1 }}>
              {/* Razorpay Panel */}
              <div
                style={{
                  border: (d.gatewayPriority || 'razorpay') === 'razorpay'
                    ? '1.5px solid var(--hp-pink)'
                    : '1px solid var(--line)',
                  boxShadow: (d.gatewayPriority || 'razorpay') === 'razorpay'
                    ? '0 0 12px rgba(234, 9, 127, 0.08)'
                    : 'none',
                  borderRadius: 12,
                  padding: '13px 15px',
                  background: 'var(--surface-2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div className="row between" style={{ alignItems: 'center' }}>
                  <div className="row gap-8" style={{ alignItems: 'center' }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: 'rgba(59, 130, 246, 0.18)',
                        color: '#3b82f6',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      R
                    </span>
                    <div>
                      <div className="t13 fw7">Razorpay Gateway</div>
                      <div className="t11 faint">Dynamic single-use UPI QR</div>
                    </div>
                  </div>
                  {(d.gatewayPriority || 'razorpay') === 'razorpay' ? (
                    <Chip tone="active">PRIMARY</Chip>
                  ) : (
                    <Chip tone="neutral">FALLBACK</Chip>
                  )}
                </div>

                <Field label="Key ID" required style={{ marginBottom: 2 }}>
                  <TextInput
                    value={d.razorpayKeyId || ''}
                    onChange={(e) => set('razorpayKeyId', e.target.value.trim())}
                    placeholder="rzp_live_xxxxxxxxxx"
                    disabled={isGatewayDisabled}
                    style={disabledInput}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </Field>

                <Field
                  label="Key Secret"
                  required
                  hint={
                    d.hasRazorpaySecret
                      ? (d.razorpayKeySecret ? 'New secret entered — click Save to apply.' : '✓ Saved on server. Leave blank to keep existing.')
                      : 'Generated alongside Key ID in Razorpay Dashboard.'
                  }
                  style={{ marginBottom: 2 }}
                >
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <TextInput
                      type={showRzpSecret ? 'text' : 'password'}
                      value={d.razorpayKeySecret || ''}
                      onChange={(e) => set('razorpayKeySecret', e.target.value)}
                      placeholder={d.hasRazorpaySecret ? '•••••••••••••••• (Saved on server)' : 'Enter Key Secret'}
                      disabled={isGatewayDisabled}
                      style={{ flex: 1, paddingRight: 54, ...disabledInput }}
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRzpSecret(!showRzpSecret)}
                      disabled={isGatewayDisabled}
                      style={{
                        position: 'absolute',
                        right: 6,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: isGatewayDisabled ? 'not-allowed' : 'pointer',
                        fontSize: 11,
                        fontWeight: 650,
                        padding: '4px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {showRzpSecret ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </Field>

                <Field label="Environment" style={{ marginBottom: 0 }}>
                  <Select
                    value={d.razorpayEnv || (d.razorpayKeyId?.startsWith('rzp_test_') ? 'sandbox' : 'production')}
                    onChange={(e) => set('razorpayEnv', e.target.value)}
                    disabled={isGatewayDisabled}
                    style={disabledInput}
                  >
                    <option value="production">Production (Live Transactions)</option>
                    <option value="sandbox">Sandbox (Testing / Simulation)</option>
                  </Select>
                </Field>

                <div className="row between" style={{ marginTop: 'auto', paddingTop: 6, alignItems: 'center' }}>
                  <div className="t11" style={{ color: d.razorpayKeyId ? 'var(--hp-green-ink)' : 'var(--muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.razorpayKeyId ? 'var(--hp-green)' : 'var(--faint)' }} />
                    {d.razorpayKeyId ? 'Razorpay Ready' : 'Enter Key ID & Secret'}
                  </div>
                  <a
                    href="https://dashboard.razorpay.com/#/access/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="t11"
                    style={{ color: 'var(--hp-blue)', textDecoration: 'none', fontWeight: 550 }}
                  >
                    Get Keys ↗
                  </a>
                </div>
              </div>

              {/* Cashfree Panel */}
              <div
                style={{
                  border: d.gatewayPriority === 'cashfree'
                    ? '1.5px solid var(--hp-green)'
                    : '1px solid var(--line)',
                  boxShadow: d.gatewayPriority === 'cashfree'
                    ? '0 0 12px rgba(16, 185, 129, 0.08)'
                    : 'none',
                  borderRadius: 12,
                  padding: '13px 15px',
                  background: 'var(--surface-2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div className="row between" style={{ alignItems: 'center' }}>
                  <div className="row gap-8" style={{ alignItems: 'center' }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: 'rgba(16, 185, 129, 0.18)',
                        color: '#10b981',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      C
                    </span>
                    <div>
                      <div className="t13 fw7">Cashfree Payments</div>
                      <div className="t11 faint">Auto dynamic UPI QR & polling</div>
                    </div>
                  </div>
                  {d.gatewayPriority === 'cashfree' ? (
                    <Chip tone="active">PRIMARY</Chip>
                  ) : (
                    <Chip tone="neutral">FALLBACK</Chip>
                  )}
                </div>

                <Field label="App ID (Client ID)" required style={{ marginBottom: 2 }}>
                  <TextInput
                    value={d.cashfreeAppId || ''}
                    onChange={(e) => set('cashfreeAppId', e.target.value.trim())}
                    placeholder="e.g. 1234567890abcdef"
                    disabled={isGatewayDisabled}
                    style={disabledInput}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </Field>

                <Field
                  label="Secret Key"
                  required
                  hint={
                    d.hasCashfreeSecret
                      ? (d.cashfreeSecretKey ? 'New secret entered — click Save to apply.' : '✓ Saved on server. Leave blank to keep existing.')
                      : 'Generated in Cashfree Dashboard.'
                  }
                  style={{ marginBottom: 2 }}
                >
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <TextInput
                      type={showCfSecret ? 'text' : 'password'}
                      value={d.cashfreeSecretKey || ''}
                      onChange={(e) => set('cashfreeSecretKey', e.target.value)}
                      placeholder={d.hasCashfreeSecret ? '•••••••••••••••• (Saved on server)' : 'Enter Secret Key'}
                      disabled={isGatewayDisabled}
                      style={{ flex: 1, paddingRight: 54, ...disabledInput }}
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCfSecret(!showCfSecret)}
                      disabled={isGatewayDisabled}
                      style={{
                        position: 'absolute',
                        right: 6,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: isGatewayDisabled ? 'not-allowed' : 'pointer',
                        fontSize: 11,
                        fontWeight: 650,
                        padding: '4px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {showCfSecret ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </Field>

                <Field label="Environment" style={{ marginBottom: 0 }}>
                  <Select
                    value={d.cashfreeEnv || 'production'}
                    onChange={(e) => set('cashfreeEnv', e.target.value)}
                    disabled={isGatewayDisabled}
                    style={disabledInput}
                  >
                    <option value="production">Production (Live Transactions)</option>
                    <option value="sandbox">Sandbox (Testing / Simulation)</option>
                  </Select>
                </Field>

                <div className="row between" style={{ marginTop: 'auto', paddingTop: 6, alignItems: 'center' }}>
                  <div className="t11" style={{ color: d.cashfreeAppId ? 'var(--hp-green-ink)' : 'var(--muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.cashfreeAppId ? 'var(--hp-green)' : 'var(--faint)' }} />
                    {d.cashfreeAppId ? 'Cashfree Ready' : 'Enter App ID & Secret'}
                  </div>
                  <a
                    href="https://merchant.cashfree.com/merchants/pg"
                    target="_blank"
                    rel="noreferrer"
                    className="t11"
                    style={{ color: 'var(--hp-green-ink)', textDecoration: 'none', fontWeight: 550 }}
                  >
                    Get Keys ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 14 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-soft)' }}>
          <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="t16 fw6" style={{ color: 'var(--ink)' }}>
                Print & Template Pricing Architecture
              </div>
              <div className="t12 faint mt-4">
                Set baseline prices for paper sizes/layouts, and optionally assign custom prices to specific templates.
              </div>
            </div>

            {/* Segmented Switcher */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
              <button
                type="button"
                onClick={() => setPricingMode('matrix')}
                style={{
                  padding: '7px 14px', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: pricingMode === 'matrix' ? 'var(--hp-pink)' : 'transparent',
                  color: pricingMode === 'matrix' ? '#fff' : 'var(--muted)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon name="grid" size={14} />
                <span>Paper Size Matrix ({offeredCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setPricingMode('templates')}
                style={{
                  padding: '7px 14px', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: pricingMode === 'templates' ? 'var(--hp-pink)' : 'transparent',
                  color: pricingMode === 'templates' ? '#fff' : 'var(--muted)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon name="palette" size={14} />
                <span>Custom Template Rates ({customTemplateCount})</span>
              </button>
            </div>
          </div>
        </div>

        {pricingMode === 'matrix' ? (
          <>
            <div style={{ padding: '12px 20px 4px', background: 'rgba(234, 9, 127, 0.04)', borderBottom: '1px solid var(--line-soft)' }}>
              <p className="t12 muted" style={{ margin: 0, paddingBottom: 8 }}>
                💡 <b>Baseline Matrix:</b> Guests pick a layout size (e.g. 4×6 3-photo) and see these prices. Templates without an individual custom rate will automatically charge these prices.
              </p>
            </div>
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
              <p className="t11 faint" style={{ lineHeight: 1.6, margin: 0 }}>
                <Icon name="shield" size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                Every layout exists in vertical AND horizontal ({LAYOUTS.length} variants in all — both orientations share one price). Currently <b>{offeredCount}</b> iteration(s) are priced.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Custom Template Rates View */}
            <div style={{ padding: '14px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line-soft)' }}>
              <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: '1 1 240px', maxWidth: 360 }}>
                  <SearchInput
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates by name..."
                    style={{ height: 34, fontSize: 13 }}
                  />
                </div>
                <div className="row gap-8" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{ height: 34, fontSize: 12.5, minWidth: 150 }}
                  >
                    <option value="">All Categories ({templates.length})</option>
                    {templateCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                  <span className="chip chip-pink" style={{ height: 26, fontSize: 12, fontWeight: 600 }}>
                    {customTemplateCount} Custom Rate{customTemplateCount === 1 ? '' : 's'} Active
                  </span>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map((t) => {
                  const layout = resolveLayout(t)
                  const baselinePrice = getBaselinePrice(t)
                  const customPrice = d.templatePrices?.[t.id] != null && d.templatePrices?.[t.id] !== ''
                    ? d.templatePrices[t.id]
                    : (t.price != null && Number(t.price) > 0 ? Number(t.price) : undefined)
                  const hasCustom = customPrice != null && customPrice !== ''

                  return (
                    <div
                      key={t.id}
                      style={{
                        border: `1.5px solid ${hasCustom ? 'var(--hp-pink)' : 'var(--line)'}`,
                        borderRadius: 'var(--r-md)',
                        background: 'var(--surface-2)',
                        padding: '12px 14px',
                        display: 'flex',
                        gap: 14,
                        alignItems: 'center',
                        boxShadow: hasCustom ? '0 0 12px rgba(234, 9, 127, 0.12)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ flex: 'none', width: 72, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', borderRadius: 6, overflow: 'hidden' }}>
                        <TemplatePreview template={t} width={72} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div className="row between" style={{ alignItems: 'flex-start', gap: 6 }}>
                          <div className="t13 fw6 ellipsis" title={t.name}>{t.name}</div>
                          {hasCustom ? (
                            <span className="chip chip-pink" style={{ height: 18, fontSize: 10, padding: '0 6px', fontWeight: 600, flex: 'none' }}>Custom</span>
                          ) : (
                            <span className="chip chip-neutral" style={{ height: 18, fontSize: 10, padding: '0 6px', flex: 'none' }}>Baseline</span>
                          )}
                        </div>

                        <div className="row wrap gap-6 t11 muted">
                          <span className="chip chip-info" style={{ height: 18, fontSize: 10.5 }}>
                            {layout ? `${layout.slots} photo${layout.slots > 1 ? 's' : ''}` : 'Layout'}
                          </span>
                          {t.category && (
                            <span className="chip chip-neutral" style={{ height: 18, fontSize: 10.5 }}>{t.category}</span>
                          )}
                        </div>

                        <div className="t11 faint">
                          Baseline: <span style={{ fontWeight: 600, color: baselinePrice != null ? 'var(--ink)' : 'var(--muted)' }}>{baselinePrice != null ? `₹${baselinePrice}` : 'Unpriced'}</span>
                        </div>

                        <div className="row gap-8" style={{ alignItems: 'center', marginTop: 2 }}>
                          <span className="t12 fw6 muted">₹</span>
                          <TextInput
                            type="number"
                            min="0"
                            placeholder={baselinePrice != null ? `₹${baselinePrice}` : '—'}
                            value={hasCustom ? customPrice : ''}
                            onChange={(e) => setTemplatePrice(t.id, e.target.value)}
                            disabled={readOnly}
                            style={{ width: 84, height: 28, fontSize: 12.5, padding: '0 8px', ...disabledInput }}
                            title={hasCustom ? `Custom price ₹${customPrice} active for this template` : `Using baseline layout price (₹${baselinePrice ?? 0})`}
                          />
                          {hasCustom && !readOnly && (
                            <button
                              type="button"
                              onClick={() => setTemplatePrice(t.id, '')}
                              title="Reset to baseline layout price"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--hp-pink-deep)',
                                fontSize: 11,
                                cursor: 'pointer',
                                fontWeight: 600,
                                padding: '2px 6px',
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{ gridColumn: '1 / -1', padding: '36px 20px', textAlign: 'center' }}>
                  <Icon name="search" size={32} style={{ color: 'var(--muted)', marginBottom: 8 }} />
                  <div className="t14 fw6">No templates match your search</div>
                  <div className="t12 faint mt-4">Try clearing the search query or selecting another category.</div>
                </div>
              )}
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line-soft)' }}>
              <p className="t11 faint" style={{ lineHeight: 1.6, margin: 0 }}>
                <Icon name="shield" size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                Leave price blank to inherit the baseline layout price. Setting an explicit price overrides the baseline for that specific template across all booths.
              </p>
            </div>
          </>
        )}
      </Card>

      {dirty && !readOnly ? (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '10px 22px',
            borderRadius: 999,
            background: 'var(--surface)',
            border: '2px solid var(--hp-pink)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(234, 9, 127, 0.25)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--hp-pink)' }} />
            You have unsaved changes in defaults!
          </span>
          <Button
            variant="primary"
            size="sm"
            icon="check"
            onClick={save}
            disabled={busy}
            style={{ padding: '6px 18px', fontSize: 12.5 }}
          >
            {busy ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
