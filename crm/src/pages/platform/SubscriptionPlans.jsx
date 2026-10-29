import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Button, Card, Chip, ConfirmDialog, EmptyState, Field, Modal, PageLoader, Select, TextArea, TextInput, Toggle } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { inr, relativeTime } from '../../lib/format.js'

const emptyPlan = {
  key: '', name: '', description: '', price: '', durationMonths: 1,
  durationLabel: 'per month', devices: 2, events: 2, active: true,
  kind: 'plan', priceMonthly: '', priceQuarterly: '', priceSemiannual: '', priceAnnual: '',
  billingNote: 'excluding GST 18%', aiCredits: 0,
  discountType: 'none', discountValue: '', discountLabel: '', discountStartsAt: '', discountEndsAt: '',
  discountMaxRedemptions: '', 
}

const DURATION_OPTIONS = [
  { id: 'annual', label: '12 Months', months: 12, unitLabel: '/year' },
  { id: 'semiannual', label: '6 Months', months: 6, unitLabel: '/6 Months' },
  { id: 'quarterly', label: '3 Months', months: 3, unitLabel: '/3 Months' },
  { id: 'monthly', label: '1 Month', months: 1, unitLabel: '/year' },
]

// Mirror of backend services/planService.js planPricing() — used ONLY for
// instant preview in the editor; the server remains the source of truth and
// returns `plan.pricing` which the cards prefer when present.
export function computePricing(plan, now = new Date()) {
  const price = plan.price === '' || plan.price == null ? null : Number(plan.price)
  const type = ['percent', 'flat'].includes(plan.discountType) ? plan.discountType : 'none'
  const value = Number(plan.discountValue) || 0
  const starts = plan.discountStartsAt ? new Date(plan.discountStartsAt) : null
  const ends = plan.discountEndsAt ? new Date(plan.discountEndsAt) : null
  const maxRedemptions = Number(plan.discountMaxRedemptions) || 0
  const redemptions = Number(plan.discountRedemptions) || 0
  let active = type !== 'none' && value > 0 && price != null && price > 0
  if (active && starts && now < starts) active = false
  if (active && ends && now > ends) active = false
  if (active && maxRedemptions > 0 && redemptions >= maxRedemptions) active = false
  const scheduled = type !== 'none' && value > 0 && price != null && price > 0 && starts && now < starts
  const amount = active ? (type === 'percent' ? Math.round((price * Math.min(100, value)) / 100) : Math.min(price, Math.round(value))) : 0
  return {
    price, effectivePrice: price == null ? null : price - amount, discountAmount: amount,
    discountPercent: price && amount ? Math.round((amount / price) * 100) : 0,
    active, scheduled, type, value, starts, ends, maxRedemptions, redemptions,
    slotsLeft: maxRedemptions > 0 ? Math.max(0, maxRedemptions - redemptions) : null,
  }
}

const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null)

function PlanCard({ plan, selectedDuration = 'annual', onEdit, onDelete }) {
  const pricing = plan.pricing
    ? {
        price: plan.pricing.originalPrice,
        effectivePrice: plan.pricing.effectivePrice,
        discountAmount: plan.pricing.discountAmount,
        discountPercent: plan.pricing.discountPercent,
        active: plan.pricing.discount.active,
        scheduled: false,
        type: plan.pricing.discount.discountType,
        ends: plan.pricing.discount.discountEndsAt ? new Date(plan.pricing.discount.discountEndsAt) : null,
        starts: plan.pricing.discount.discountStartsAt ? new Date(plan.pricing.discount.discountStartsAt) : null,
        redemptions: Number(plan.pricing.discount.discountRedemptions) || 0,
        slotsLeft: plan.pricing.discount.discountMaxRedemptions > 0 ? Math.max(0, Number(plan.pricing.discount.discountMaxRedemptions) - (Number(plan.pricing.discount.discountRedemptions) || 0)) : null,
      }
    : computePricing(plan)

  const inrMap = plan.billing?.inr || {}
  const isFree = pricing.price === 0 && plan.key === 'trial'
  const isCustom = pricing.price == null && inrMap.monthly == null

  let perMonthDisplay = pricing.active ? pricing.effectivePrice : pricing.price
  let periodSubtitle = plan.durationLabel || `${plan.durationMonths} months`

  if (!isFree && !isCustom) {
    const devLabel = `${plan.devices} Device${plan.devices === 1 ? '' : 's'}`
    if (selectedDuration === 'annual' && (inrMap.annual != null || plan.priceAnnual != null)) {
      const total = Number(inrMap.annual ?? plan.priceAnnual)
      perMonthDisplay = inrMap.annualPerMonth ?? Math.round(total / 12)
      periodSubtitle = `Annual: ${inr(perMonthDisplay)}/Month - ${devLabel} = ${inr(total)}/year (excluding GST 18%)`
    } else if (selectedDuration === 'semiannual' && (inrMap.semiannual != null || plan.priceSemiannual != null)) {
      const total = Number(inrMap.semiannual ?? plan.priceSemiannual)
      perMonthDisplay = inrMap.semiannualPerMonth ?? Math.round(total / 6)
      periodSubtitle = `${inr(perMonthDisplay)}/Month - ${devLabel} = ${inr(total)}/6 Months (excluding GST 18%)`
    } else if (selectedDuration === 'quarterly' && (inrMap.quarterly != null || plan.priceQuarterly != null)) {
      const total = Number(inrMap.quarterly ?? plan.priceQuarterly)
      perMonthDisplay = inrMap.quarterlyPerMonth ?? Math.round(total / 3)
      periodSubtitle = `${inr(perMonthDisplay)}/Month - ${devLabel} = ${inr(total)}/3 Months (excluding GST 18%)`
    } else if (inrMap.monthly != null || plan.priceMonthly != null || pricing.price != null) {
      const m = Number(inrMap.monthly ?? plan.priceMonthly ?? pricing.price)
      perMonthDisplay = pricing.active ? pricing.effectivePrice : m
      const annualized = inrMap.monthlyAnnualized ?? m * 12
      periodSubtitle = `Monthly: ${inr(perMonthDisplay)}/Month - ${devLabel} = ${inr(annualized)}/year (excluding GST 18%)`
    }
  }

  return (
    <Card style={{ overflow: 'hidden', opacity: plan.active ? 1 : 0.66, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--line-soft)', background: 'var(--surface)' }}>
        <div className="row between gap-12">
          <div className="row gap-8" style={{ minWidth: 0, alignItems: 'center' }}>
            <span className="stat-ico" style={{ background: 'var(--hp-pink-soft)', color: 'var(--hp-pink-deep)', width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
              <Icon name="tag" size={15} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="t13 fw7 ellipsis" style={{ color: 'var(--ink)' }}>{plan.name}</div>
              <div className="t11 faint mono">{plan.key}</div>
            </div>
          </div>
          <Chip tone={plan.active ? 'active' : 'neutral'} dot>{plan.active ? 'Active' : 'Hidden'}</Chip>
        </div>

        <div className="row gap-8" style={{ alignItems: 'baseline', marginTop: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 24, fontWeight: 750, letterSpacing: '-.03em', color: 'var(--ink)' }}>
            {isCustom ? 'Contact sales' : isFree ? 'Free' : `${inr(perMonthDisplay)}/Month`}
          </div>
          {pricing.active && selectedDuration === 'monthly' ? <div className="t13 faint" style={{ textDecoration: 'line-through' }}>{inr(pricing.price)}</div> : null}
          {pricing.active ? <Chip tone="pink">−{pricing.discountPercent}%</Chip> : pricing.scheduled ? <Chip tone="info">Discount scheduled</Chip> : null}
        </div>
        <div className="t11 muted" style={{ marginTop: 3 }}>
          {periodSubtitle}
          {pricing.active ? ` · You save ${inr(pricing.discountAmount)}${pricing.ends ? ` · ends ${relativeTime(pricing.ends.toISOString())}` : ''}` : ''}
          {pricing.scheduled && pricing.starts ? ` · ${plan.discountType === 'percent' ? `${plan.discountValue}%` : inr(Number(plan.discountValue))} off from ${relativeTime(pricing.starts.toISOString())}` : ''}
          {!pricing.active && !pricing.scheduled && plan.discountLabel ? ` · ${plan.discountLabel}` : ''}
          {pricing.active && pricing.slotsLeft != null ? ` · ${pricing.slotsLeft} discounted slot${pricing.slotsLeft === 1 ? '' : 's'} left (${pricing.redemptions} used)` : ''}
          {pricing.active && pricing.slotsLeft == null ? ` · ${pricing.redemptions} discounted checkout${pricing.redemptions === 1 ? '' : 's'} so far` : ''}
        </div>
      </div>

      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
        <div>
          <p className="t12 muted" style={{ lineHeight: 1.55, minHeight: 38 }}>{plan.description || 'No description.'}</p>
          <div className="row gap-6 wrap mt-12">
            <Chip tone="info"><Icon name="monitor" size={11} style={{ marginRight: 3 }} /> {plan.devices} device{plan.devices === 1 ? '' : 's'}</Chip>
            <Chip tone="purple"><Icon name="calendar" size={11} style={{ marginRight: 3 }} /> {plan.events} parallel event{plan.events === 1 ? '' : 's'}</Chip>
            {plan.aiCredits ? <Chip tone="warn"><Icon name="sparkles" size={11} style={{ marginRight: 3 }} /> {plan.aiCredits} AI credits</Chip> : null}
          </div>

          {!isFree && !isCustom && plan.billing ? (
            <div className="t11 muted" style={{ marginTop: 12, lineHeight: 1.65, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--line-soft)', display: 'grid', gap: 2 }}>
              {inrMap.annual != null ? (
                <div><b>12 Months:</b> {inr(inrMap.annualPerMonth ?? Math.round(inrMap.annual / 12))}/mo · {inr(inrMap.annual)}/year</div>
              ) : null}
              {inrMap.semiannual != null ? (
                <div><b>6 Months:</b> {inr(inrMap.semiannualPerMonth ?? Math.round(inrMap.semiannual / 6))}/mo · {inr(inrMap.semiannual)}/6 Months</div>
              ) : null}
              {inrMap.quarterly != null ? (
                <div><b>3 Months:</b> {inr(inrMap.quarterlyPerMonth ?? Math.round(inrMap.quarterly / 3))}/mo · {inr(inrMap.quarterly)}/3 Months</div>
              ) : null}
              {inrMap.monthly != null ? (
                <div><b>1 Month:</b> {inr(inrMap.monthly)}/mo · {inr(inrMap.monthlyAnnualized ?? inrMap.monthly * 12)}/year</div>
              ) : null}
              <div className="faint" style={{ fontSize: 10.5, marginTop: 2 }}>All prices excluding GST 18% · {plan.devices} Device{plan.devices === 1 ? '' : 's'}</div>
            </div>
          ) : null}
        </div>

        <div className="row between mt-16" style={{ paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
          <div className="t11 faint">
            <span className="fw6" style={{ color: 'var(--ink)' }}>{plan.organizations}</span> org{plan.organizations === 1 ? '' : 's'} · updated {relativeTime(plan.updatedAt)}
          </div>
          <div className="row gap-6">
            {plan.key !== 'trial' ? (
              <Button size="sm" variant="ghost" icon="trash" onClick={() => onDelete(plan)} style={{ color: 'var(--danger)' }}>Delete</Button>
            ) : null}
            <Button size="sm" variant="outline" icon="edit" onClick={() => onEdit(plan)}>Edit Plan</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function AddonCard({ addon, onEdit, onDelete }) {
  const pricing = addon.pricing
    ? {
        price: addon.pricing.originalPrice,
        effectivePrice: addon.pricing.effectivePrice,
        discountAmount: addon.pricing.discountAmount,
        discountPercent: addon.pricing.discountPercent,
        active: addon.pricing.discount.active,
      }
    : computePricing(addon)

  return (
    <Card style={{ overflow: 'hidden', opacity: addon.active ? 1 : 0.66, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--line-soft)', background: 'var(--surface)' }}>
        <div className="row between gap-12">
          <div className="row gap-8" style={{ minWidth: 0, alignItems: 'center' }}>
            <span className="stat-ico" style={{ background: 'var(--hp-purple-soft)', color: 'var(--hp-purple)', width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
              <Icon name="sparkles" size={15} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="t13 fw7 ellipsis" style={{ color: 'var(--ink)' }}>{addon.name}</div>
              <div className="t11 faint mono">{addon.key}</div>
            </div>
          </div>
          <Chip tone={addon.active ? 'active' : 'neutral'} dot>{addon.active ? 'Active' : 'Hidden'}</Chip>
        </div>

        <div className="row gap-8" style={{ alignItems: 'baseline', marginTop: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 24, fontWeight: 750, letterSpacing: '-.03em', color: 'var(--ink)' }}>
            {pricing.price == null ? 'Contact sales' : inr(pricing.active ? pricing.effectivePrice : pricing.price)}
          </div>
          <div className="t11 muted fw6">
            {addon.billingNote || addon.durationLabel || 'per month'}
          </div>
        </div>
        <div className="t11 muted" style={{ marginTop: 2 }}>
          {addon.billing?.inr?.annual != null && addon.billing.inr.annual !== addon.billing.inr.monthly ? (
            <span>Annual upfront: <b>{inr(addon.billing.inr.annual)}</b></span>
          ) : (
            <span>Standard bolt-on rate</span>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
        <div>
          <p className="t12 muted" style={{ lineHeight: 1.55, minHeight: 38 }}>{addon.description || 'No description provided.'}</p>
          <div className="row gap-6 wrap mt-12">
            <Chip tone="pink">Add-on</Chip>
            {addon.billingNote ? <Chip tone="info">{addon.billingNote}</Chip> : null}
            {addon.aiCredits ? <Chip tone="warn"><Icon name="sparkles" size={11} style={{ marginRight: 3 }} /> {addon.aiCredits} AI credits</Chip> : null}
          </div>
        </div>

        <div className="row between mt-16" style={{ paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
          <div className="t11 faint">
            <span className="fw6" style={{ color: 'var(--ink)' }}>{addon.organizations}</span> active org{addon.organizations === 1 ? '' : 's'} · updated {relativeTime(addon.updatedAt)}
          </div>
          <div className="row gap-6">
            <Button size="sm" variant="ghost" icon="trash" onClick={() => onDelete(addon)} style={{ color: 'var(--danger)' }}>Delete</Button>
            <Button size="sm" variant="outline" icon="edit" onClick={() => onEdit(addon)}>Edit Add-on</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function SubscriptionPlans() {
  const { toast } = useApp()
  const [plans, setPlans] = useState(null)
  const [selectedDuration, setSelectedDuration] = useState('annual')
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => api.platform.plans()
    .then((result) => setPlans(result.plans))
    .catch((e) => toast(e.message, 'error'))

  useEffect(() => { load() }, [])

  const subscriptionPlans = useMemo(() => {
    if (!plans) return []
    return plans.filter((p) => p.kind !== 'addon')
  }, [plans])

  const addons = useMemo(() => {
    if (!plans) return []
    return plans.filter((p) => p.kind === 'addon')
  }, [plans])

  const openNew = (defaultKind = 'plan') => {
    setError('')
    setEditing('new')
    setDraft({
      ...emptyPlan,
      kind: defaultKind,
      price: defaultKind === 'addon' ? 249 : '',
      priceMonthly: defaultKind === 'addon' ? 249 : '',
      priceQuarterly: defaultKind === 'addon' ? 249 : '',
      priceSemiannual: defaultKind === 'addon' ? 249 : '',
      priceAnnual: defaultKind === 'addon' ? 249 : '',
      devices: defaultKind === 'addon' ? 0 : 2,
      events: defaultKind === 'addon' ? 0 : 2,
      durationLabel: defaultKind === 'addon' ? 'per add-on' : 'per month',
      billingNote: defaultKind === 'addon' ? 'per add-on · excluding GST 18%' : 'excluding GST 18%',
    })
  }

  const openEdit = (plan) => {
    setError('')
    setEditing(plan)
    setDraft({
      ...plan,
      price: plan.price == null ? '' : plan.price,
      kind: plan.kind || 'plan',
      priceMonthly: plan.priceMonthly == null ? '' : plan.priceMonthly,
      priceQuarterly: plan.priceQuarterly == null ? (plan.billing?.inr?.quarterly ?? '') : plan.priceQuarterly,
      priceSemiannual: plan.priceSemiannual == null ? (plan.billing?.inr?.semiannual ?? '') : plan.priceSemiannual,
      priceAnnual: plan.priceAnnual == null ? (plan.billing?.inr?.annual ?? '') : plan.priceAnnual,
      discountMaxRedemptions: plan.discountMaxRedemptions || '',
      discountRedemptions: Number(plan.discountRedemptions) || 0,
      billingNote: plan.billingNote || '',
      aiCredits: plan.aiCredits || 0,
      discountType: plan.discountType || 'none',
      discountValue: plan.discountValue || '',
      discountLabel: plan.discountLabel || '',
      discountStartsAt: toLocalInput(plan.discountStartsAt),
      discountEndsAt: toLocalInput(plan.discountEndsAt),
    })
  }

  const handleDelete = async () => {
    if (!deleting) return
    const idOrKey = deleting.id || deleting.key
    setBusy(true)
    try {
      await api.platform.deletePlan(idOrKey)
      toast(`${deleting.kind === 'addon' ? 'Add-on' : 'Plan'} “${deleting.name}” deleted`)
      setDeleting(null)
      if (editing && (editing.id === deleting.id || editing.key === deleting.key)) {
        setEditing(null)
      }
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setError('')
    if (!draft?.name.trim() || (editing === 'new' && !draft.key.trim())) {
      return setError('Plan/Add-on name and permanent key are required.')
    }
    // Discount validation mirrors the backend (planService.parseDiscountInput).
    if (draft.discountType !== 'none') {
      const value = Number(draft.discountValue)
      const price = draft.price === '' ? null : Number(draft.price)
      if (!value || value <= 0) return setError('Enter a discount value, or set the discount type to None.')
      if (draft.discountType === 'percent' && value > 100) return setError('Percent discount must be between 1 and 100.')
      if (draft.discountType === 'flat' && (price == null || price === 0)) return setError('A flat (₹) discount needs a priced plan.')
      if (draft.discountType === 'flat' && price != null && value >= price) return setError('Flat discount must be less than the plan price.')
      if (draft.discountType === 'percent' && (price == null || price === 0)) return setError('A percent discount needs a priced plan.')
      if (draft.discountStartsAt && draft.discountEndsAt && new Date(draft.discountEndsAt) <= new Date(draft.discountStartsAt)) {
        return setError('Discount end must be after its start.')
      }
    }
    setBusy(true)
    try {
      const body = {
        ...draft,
        name: draft.name.trim(),
        key: draft.key.trim().toLowerCase(),
        description: draft.description.trim(),
        price: draft.price === '' ? null : Number(draft.price),
        durationMonths: Number(draft.durationMonths) || 0,
        devices: draft.kind === 'addon' ? Math.max(0, Number(draft.devices) || 0) : Math.max(1, Number(draft.devices) || 1),
        events: draft.kind === 'addon' ? Math.max(0, Number(draft.events) || 0) : Math.max(1, Number(draft.events) || 1),
        kind: draft.kind === 'addon' ? 'addon' : 'plan',
        priceMonthly: draft.priceMonthly === '' || draft.priceMonthly == null ? null : Number(draft.priceMonthly),
        priceQuarterly: draft.priceQuarterly === '' || draft.priceQuarterly == null ? null : Number(draft.priceQuarterly),
        priceSemiannual: draft.priceSemiannual === '' || draft.priceSemiannual == null ? null : Number(draft.priceSemiannual),
        priceAnnual: draft.priceAnnual === '' || draft.priceAnnual == null ? null : Number(draft.priceAnnual),
        discountMaxRedemptions: Math.max(0, Math.floor(Number(draft.discountMaxRedemptions) || 0)),
        discountRedemptions: Number(draft.discountRedemptions) || 0,
        billingNote: (draft.billingNote || '').trim(),
        aiCredits: Math.max(0, Number(draft.aiCredits) || 0),
        discountType: draft.discountType || 'none',
        discountValue: draft.discountType === 'none' ? 0 : Number(draft.discountValue) || 0,
        discountLabel: (draft.discountLabel || '').trim(),
        discountStartsAt: draft.discountType === 'none' ? null : fromLocalInput(draft.discountStartsAt),
        discountEndsAt: draft.discountType === 'none' ? null : fromLocalInput(draft.discountEndsAt),
      }
      if (editing === 'new') await api.platform.createPlan(body)
      else await api.platform.updatePlan(editing.id, body)
      toast(editing === 'new' ? `${body.kind === 'addon' ? 'Add-on' : 'Plan'} “${body.name}” added` : `${body.kind === 'addon' ? 'Add-on' : 'Plan'} “${body.name}” updated`)
      setEditing(null)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Subscription Plans & Add-ons</div>
          <div className="page-sub">Owner-managed plan catalogue. Limits and pricing configured here are strictly enforced for organizations.</div>
        </div>
        <div className="row gap-8">
          <Button variant="outline" icon="plus" onClick={() => openNew('addon')}>Add Add-on</Button>
          <Button variant="primary" icon="plus" onClick={() => openNew('plan')}>Add Subscription Plan</Button>
        </div>
      </div>

      {!plans ? (
        <PageLoader />
      ) : plans.length === 0 ? (
        <Card><EmptyState icon="tag" title="No subscription plans" message="Add the first plan offered to organizations." /></Card>
      ) : (
        <div>
          {/* ─── Upper Section: Core Subscription Plans ─── */}
          <div style={{ marginBottom: 38 }}>
            <div className="row between gap-12 items-center" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
              <div className="row gap-10 items-center">
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--hp-pink-soft)', color: 'var(--hp-pink-deep)', display: 'grid', placeItems: 'center' }}>
                  <Icon name="tag" size={17} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Subscription Plans</div>
                  <div className="t12 muted">Tiered organization subscriptions (12, 6, 3, and 1 Month durations · 2 devices included · excluding GST 18%).</div>
                </div>
              </div>
              <div className="row gap-8 items-center" style={{ flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedDuration(opt.id)}
                      style={{
                        border: 'none',
                        cursor: 'pointer',
                        padding: '5px 11px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 650,
                        background: selectedDuration === opt.id ? 'var(--hp-pink)' : 'transparent',
                        color: selectedDuration === opt.id ? '#fff' : 'var(--ink-2)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <Chip tone="pink">{subscriptionPlans.length} Tier{subscriptionPlans.length === 1 ? '' : 's'}</Chip>
                <Button size="sm" variant="primary" icon="plus" onClick={() => openNew('plan')}>Add Plan</Button>
              </div>
            </div>

            {subscriptionPlans.length === 0 ? (
              <Card><EmptyState icon="tag" title="No subscription plans" message="No core subscription plans created yet." /></Card>
            ) : (
              <div className="plan-grid">
                {subscriptionPlans.map((plan) => (
                  <PlanCard key={plan.id || plan.key} plan={plan} selectedDuration={selectedDuration} onEdit={openEdit} onDelete={setDeleting} />
                ))}
              </div>
            )}
          </div>

          {/* ─── Lower Section: Modular Add-ons (Niche Adds On) ─── */}
          <div style={{ paddingTop: 26, borderTop: '1.5px dashed var(--line)' }}>
            <div className="row between gap-12 items-center" style={{ marginBottom: 16 }}>
              <div className="row gap-10 items-center">
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--hp-purple-soft)', color: 'var(--hp-purple)', display: 'grid', placeItems: 'center' }}>
                  <Icon name="sparkles" size={17} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Modular Add-ons & Bolt-ons (₹249 each)</div>
                  <div className="t12 muted">Any add-on is ₹249 (excluding GST 18%) — optional superpowers sold alongside any subscription plan.</div>
                </div>
              </div>
              <div className="row gap-8 items-center">
                <Chip tone="purple">{addons.length} Add-on{addons.length === 1 ? '' : 's'}</Chip>
                <Button size="sm" variant="outline" icon="plus" onClick={() => openNew('addon')}>Add Add-on</Button>
              </div>
            </div>

            {addons.length === 0 ? (
              <Card><EmptyState icon="sparkles" title="No add-ons available" message="Add optional modular bolt-ons available to organizations." /></Card>
            ) : (
              <div className="plan-grid">
                {addons.map((addon) => (
                  <AddonCard key={addon.id || addon.key} addon={addon} onEdit={openEdit} onDelete={setDeleting} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={
          editing === 'new'
            ? (draft?.kind === 'addon' ? 'Add Modular Add-on' : 'Add Subscription Plan')
            : `Edit ${editing?.name} (${editing?.kind === 'addon' ? 'Add-on' : 'Subscription Plan'})`
        }
        sub={
          draft?.kind === 'addon'
            ? 'Add-ons are modular extras available to any organization (e.g. AI Headshots, Video Booth, Extra Device).'
            : 'Subscription plans define the device, event, and AI quotas for subscribed organizations.'
        }
        width="wide"
        footer={
          <>
            {error ? <span className="input-error" style={{ marginRight: 'auto' }}>{error}</span> : null}
            {editing && editing !== 'new' && editing.key !== 'trial' ? (
              <Button
                variant="ghost"
                icon="trash"
                style={{ color: 'var(--danger)', marginRight: 'auto' }}
                onClick={() => setDeleting(editing)}
              >
                Delete {editing?.kind === 'addon' ? 'Add-on' : 'Plan'}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : editing === 'new' ? (draft?.kind === 'addon' ? 'Add Add-on' : 'Add Plan') : 'Save changes'}</Button>
          </>
        }
      >
        {draft ? (
          <div>
            {editing === 'new' ? (
              <div style={{ display: 'inline-flex', gap: 6, padding: 4, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)', marginBottom: 16 }}>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: draft.kind !== 'addon' ? 'var(--hp-pink)' : 'transparent',
                    color: draft.kind !== 'addon' ? '#fff' : 'var(--ink-2)',
                  }}
                  onClick={() => setDraft({ ...draft, kind: 'plan', billingNote: '', devices: 2, events: 2 })}
                >
                  <Icon name="tag" size={13} style={{ marginRight: 6 }} /> Subscription Plan
                </button>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: draft.kind === 'addon' ? 'var(--hp-purple)' : 'transparent',
                    color: draft.kind === 'addon' ? '#fff' : 'var(--ink-2)',
                  }}
                  onClick={() => setDraft({ ...draft, kind: 'addon', billingNote: 'per user / month', devices: 0, events: 0 })}
                >
                  <Icon name="sparkles" size={13} style={{ marginRight: 6 }} /> Modular Add-on
                </button>
              </div>
            ) : null}

            <div className="form-grid-2">
              <Field label={draft.kind === 'addon' ? 'Add-on name' : 'Plan name'} required>
                <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={draft.kind === 'addon' ? 'e.g. Extra Device Slot' : 'e.g. Growth'} />
              </Field>
              <Field label="Permanent key" required hint={editing === 'new' ? 'Lowercase letters, numbers and hyphens.' : 'Cannot be changed after creation.'}>
                <TextInput value={draft.key} disabled={editing !== 'new'} onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder={draft.kind === 'addon' ? 'addon-extra-device' : 'growth'} />
              </Field>
            </div>
            <Field label="Description">
              <TextArea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder={draft.kind === 'addon' ? 'What superpower this add-on unlocks for the booth' : 'Who this plan is designed for'} />
            </Field>
            <div className="form-grid-2">
              <Field label="Kind">
                <Select value={draft.kind || 'plan'} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                  <option value="plan">Plan (Basic / Pro / Premium / Custom)</option>
                  <option value="addon">Add-on (Modular Extras)</option>
                </Select>
              </Field>
              <Field label="AI credits / period" hint="e.g. Premium includes 500, or 1000 for credit pack.">
                <TextInput type="number" min="0" value={draft.aiCredits} onChange={(e) => setDraft({ ...draft, aiCredits: e.target.value })} />
              </Field>
              <Field label="1 Month price ₹ (Monthly)" hint="Billed monthly (e.g. Basic 1099, Pro 1299, Premium 1499, Add-on 249).">
                <TextInput type="number" min="0" value={draft.priceMonthly} onChange={(e) => setDraft({ ...draft, priceMonthly: e.target.value, price: e.target.value })} placeholder="1099" />
              </Field>
              <Field label="3 Months price ₹ (Quarterly total)" hint="Total for 3 months (e.g. Basic 2847 = ₹949/mo, Pro 3447 = ₹1,149/mo, Premium 3897 = ₹1,299/mo).">
                <TextInput type="number" min="0" value={draft.priceQuarterly} onChange={(e) => setDraft({ ...draft, priceQuarterly: e.target.value })} placeholder="2847" />
              </Field>
              <Field label="6 Months price ₹ (6-Month total)" hint="Total for 6 months (e.g. Basic 4794 = ₹799/mo, Pro 5994 = ₹999/mo, Premium 6594 = ₹1,099/mo).">
                <TextInput type="number" min="0" value={draft.priceSemiannual} onChange={(e) => setDraft({ ...draft, priceSemiannual: e.target.value })} placeholder="4794" />
              </Field>
              <Field label="12 Months price ₹ (Annual total)" hint="Total for 12 months (e.g. Basic 5988 = ₹499/mo, Pro 8388 = ₹699/mo, Premium 9588 = ₹799/mo).">
                <TextInput type="number" min="0" value={draft.priceAnnual} onChange={(e) => setDraft({ ...draft, priceAnnual: e.target.value })} placeholder="5988" />
              </Field>
              <Field label="Billing note" hint="e.g. per user / month, one-time, per booth / month.">
                <TextInput value={draft.billingNote} onChange={(e) => setDraft({ ...draft, billingNote: e.target.value })} placeholder={draft.kind === 'addon' ? 'per user / month' : ''} />
              </Field>
              <Field label="Base list price (₹)" hint="Leave blank for Contact sales.">
                <TextInput type="number" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="Contact sales" />
              </Field>
              <Field label="Duration label" hint="Shown exactly as written (e.g. per month, 14 days).">
                <TextInput value={draft.durationLabel} onChange={(e) => setDraft({ ...draft, durationLabel: e.target.value })} placeholder="per month" />
              </Field>
              <Field label="Duration (months)" hint="Use 0 for a trial/custom period.">
                <TextInput type="number" min="0" max="120" value={draft.durationMonths} onChange={(e) => setDraft({ ...draft, durationMonths: e.target.value })} />
              </Field>
              <Field label="Device limit" required hint={draft.kind === 'addon' ? '0 for standard feature add-ons; or booth slots added.' : 'Number of connected booths.'}>
                <TextInput type="number" min={draft.kind === 'addon' ? 0 : 1} max="1000" value={draft.devices} onChange={(e) => setDraft({ ...draft, devices: e.target.value })} />
              </Field>
              <Field label="Parallel event limit" required hint={draft.kind === 'addon' ? '0 for standard feature add-ons; or parallel events added.' : 'Active parallel events allowed.'}>
                <TextInput type="number" min={draft.kind === 'addon' ? 0 : 1} max="1000" value={draft.events} onChange={(e) => setDraft({ ...draft, events: e.target.value })} />
              </Field>
            </div>
            <div style={{ padding: '13px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--hp-pink-softer)', marginBottom: 14 }}>
              <div className="t13 fw7" style={{ marginBottom: 2 }}>Discount campaign</div>
              <div className="t11 muted" style={{ marginBottom: 12 }}>
                Percent (%) or a flat ₹ amount off. The discount is live only between its start and end — leave either date empty for an open-ended side. The public pricing page and checkout use the discounted price automatically while it is live.
              </div>
              <div className="form-grid-2">
                <Field label="Discount type">
                  <Select value={draft.discountType} onChange={(e) => setDraft({ ...draft, discountType: e.target.value })}>
                    <option value="none">No discount</option>
                    <option value="percent">Percent off (%)</option>
                    <option value="flat">Flat amount off (₹)</option>
                  </Select>
                </Field>
                <Field label={draft.discountType === 'percent' ? 'Percent off' : 'Amount off (₹)'} hint={draft.discountType === 'flat' ? 'A static ₹ amount, e.g. 500.' : draft.discountType === 'percent' ? 'e.g. 20 means 20% off.' : 'Pick a discount type first.'}>
                  <TextInput type="number" min="0" max={draft.discountType === 'percent' ? '100' : undefined} value={draft.discountValue} disabled={draft.discountType === 'none'} onChange={(e) => setDraft({ ...draft, discountValue: e.target.value })} placeholder="0" />
                </Field>
                <Field label="Campaign label" hint="Shown to buyers, e.g. Launch Week.">
                  <TextInput value={draft.discountLabel} disabled={draft.discountType === 'none'} onChange={(e) => setDraft({ ...draft, discountLabel: e.target.value })} placeholder="Launch Week" />
                </Field>
                <Field label="Max discounted clients (0 = unlimited)" hint="Campaign stops after this many discounted checkouts. Manual stop: set Discount type to None.">
                  <TextInput type="number" min="0" value={draft.discountMaxRedemptions} disabled={draft.discountType === 'none'} onChange={(e) => setDraft({ ...draft, discountMaxRedemptions: e.target.value })} placeholder="0 = unlimited" />
                </Field>
                <Field label="Discounted checkouts so far" hint="Live counter from completed discounted orders.">
                  <TextInput type="number" value={draft.discountRedemptions} disabled onChange={() => {}} />
                </Field>
                <Field label="Discount starts" hint="Discount duration — start.">
                  <TextInput type="datetime-local" value={draft.discountStartsAt} disabled={draft.discountType === 'none'} onChange={(e) => setDraft({ ...draft, discountStartsAt: e.target.value })} />
                </Field>
                <Field label="Discount ends" hint="Discount duration — end.">
                  <TextInput type="datetime-local" value={draft.discountEndsAt} disabled={draft.discountType === 'none'} onChange={(e) => setDraft({ ...draft, discountEndsAt: e.target.value })} />
                </Field>
              </div>
              {draft.discountType !== 'none' && draft.price !== '' && Number(draft.price) > 0 ? (() => {
                const preview = computePricing({ ...draft, price: Number(draft.price), discountValue: Number(draft.discountValue) || 0, discountStartsAt: fromLocalInput(draft.discountStartsAt), discountEndsAt: fromLocalInput(draft.discountEndsAt) })
                return (
                  <div className="t12" style={{ marginTop: 10, padding: '9px 11px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', border: '1px solid var(--line-soft)' }}>
                    {preview.active
                      ? <>Live now: <b>{inr(preview.price)}</b> → <b style={{ color: 'var(--hp-pink-deep)' }}>{inr(preview.effectivePrice)}</b> (saves {inr(preview.discountAmount)}, −{preview.discountPercent}%)</>
                      : preview.scheduled
                        ? <>Scheduled: becomes <b>{inr(preview.price - (preview.type === 'percent' ? Math.round((preview.price * Math.min(100, preview.value || Number(draft.discountValue))) / 100) : Math.min(preview.price, Number(draft.discountValue))))}</b> when the window starts.</>
                        : <>Not live at the current price/dates — check the value and the discount duration.</>}
                  </div>
                )
              })() : null}
            </div>
            <div className="row between gap-12" style={{ padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)' }}>
              <div>
                <div className="t13 fw6">Available for sale</div>
                <div className="t11 muted">Hidden plans continue to work for organizations already subscribed.</div>
              </div>
              <Toggle on={draft.active} onChange={(active) => setDraft({ ...draft, active })} />
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleting?.kind === 'addon' ? 'Add-on' : 'Subscription Plan'}`}
        message={`Are you sure you want to permanently delete “${deleting?.name}”? This will remove it from the platform catalogue.`}
        confirmLabel="Delete"
        danger
        loading={busy}
      />
    </div>
  )
}
