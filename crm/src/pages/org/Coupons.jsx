import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import {
  Card, Chip, PageLoader, Button, Modal, Field, TextInput, Select,
  ConfirmDialog, EmptyState, ProgressBar, Checkbox,
} from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { dateShort } from '../../lib/format.js'
import { COUPON_STATUSES } from '../../lib/plans.js'

export default function Coupons() {
  const { toast } = useApp()
  const [data, setData] = useState(null)
  const [editor, setEditor] = useState(null) // 'new' | coupon
  const [draft, setDraft] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.org.coupons().then(setData).catch((e) => toast(e.message, 'error'))
  }, [])
  useEffect(() => { load() }, [load])

  const toggle = async (c) => {
    try {
      if (c.status === 'paused') await api.org.activateCoupon(c.id)
      else await api.org.pauseCoupon(c.id)
      toast(c.status === 'paused' ? `Coupon ${c.code} re-activated` : `Coupon ${c.code} paused`, 'info')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const save = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const body = {
        code: draft.code,
        type: draft.type,
        value: Number(draft.value),
        quantity: Number(draft.quantity),
        expiryDate: new Date(draft.expiryDate + 'T23:59:00').toISOString(),
        eventIds: draft.eventIds,
      }
      if (editor === 'new') {
        await api.org.createCoupon(body)
        toast(`Coupon ${body.code.toUpperCase()} created`)
      } else {
        await api.org.updateCoupon(editor.id, body)
        toast(`Coupon ${body.code.toUpperCase()} updated`)
      }
      setEditor(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.org.deleteCoupon(deleting.id)
      toast(`Coupon ${deleting.code} deleted`)
      setDeleting(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!data) return <PageLoader />

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Coupon Management</div>
          <div className="page-sub">
            Private, organization-owned coupons. Booths show only an “Enter Coupon” field — your coupons are never listed publicly.
          </div>
        </div>
        <Button variant="primary" icon="plus" onClick={() => { setEditor('new'); setDraft(null) }}>New coupon</Button>
      </div>

      {data.coupons.length === 0 ? (
        <Card>
          <EmptyState
            icon="tag"
            title="No coupons yet"
            message="Create a coupon for an event — promote it on posters or via venue messaging. Guests enter the code at the booth."
            action={<Button variant="primary" icon="plus" onClick={() => setEditor('new')}>Create your first coupon</Button>}
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
          {data.coupons.map((c) => {
            const eff = c.expired ? 'expired' : c.status
            const meta = COUPON_STATUSES[eff]
            return (
              <Card key={c.id} style={{ opacity: eff !== 'active' ? 0.82 : 1 }}>
                <div style={{ padding: 16 }}>
                  <div className="row between">
                    <div className="row gap-10">
                      <span className="stat-ico" style={{ background: 'var(--hp-pink-soft)', color: 'var(--hp-pink)' }}>
                        <Icon name="tag" size={15} />
                      </span>
                      <div>
                        <div className="num" style={{ fontSize: 17, fontWeight: 740, letterSpacing: '0.02em' }}>{c.code}</div>
                        <div className="t11 muted">
                          {c.type === 'percentage' ? `${c.value}% off` : `₹${c.value} off`} · expires {dateShort(c.expiryDate)}
                        </div>
                      </div>
                    </div>
                    <Chip tone={meta.chip.replace('chip-', '')} dot>{meta.label}</Chip>
                  </div>

                  <div className="mt-16">
                    <div className="row between t12 mb-8">
                      <span className="muted">Usage</span>
                      <span className="num fw6">{c.usedCount} / {c.quantity}</span>
                    </div>
                    <ProgressBar
                      value={c.usedCount}
                      max={c.quantity}
                      height={7}
                      color={c.isExhausted ? 'var(--danger)' : 'var(--hp-pink)'}
                      showLabel={false}
                    />
                    {c.isExhausted ? <div className="t11" style={{ color: 'var(--danger)', marginTop: 6, fontWeight: 600 }}>Fully used — booth will reject this code.</div> : null}
                  </div>

                  <div className="mt-12">
                    <div className="t11 fw7" style={{ color: 'var(--faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                      {c.events.length ? 'Valid for events' : 'Valid for all events'}
                    </div>
                    <div className="row wrap gap-8">
                      {c.events.length ? (
                        c.events.map((e) => <span key={e.id} className="chip chip-neutral" style={{ height: 20, fontSize: 10.5 }}>{e.name}</span>)
                      ) : (
                        <span className="chip chip-purple" style={{ height: 20, fontSize: 10.5 }}>All events</span>
                      )}
                    </div>
                  </div>

                  <div className="row gap-8 mt-16">
                    <Button size="sm" variant="outline" icon="edit" style={{ flex: 1 }} onClick={() => { setEditor(c); setDraft(null) }}>Edit</Button>
                    <Button size="sm" variant="outline" icon={c.status === 'paused' ? 'play' : 'pause'} onClick={() => toggle(c)} title={c.status === 'paused' ? 'Re-activate' : 'Pause'} />
                    <Button size="sm" variant="ghost" icon="trash" style={{ color: 'var(--danger)' }} onClick={() => setDeleting(c)} title="Delete" />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor === 'new' ? 'Create coupon' : `Edit “${editor?.code}”`}
        sub="Guests discover your coupons through posters and word of mouth — never from the booth screen."
        width="wide"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditor(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy || !draft}>{busy ? 'Saving…' : editor === 'new' ? 'Create coupon' : 'Save changes'}</Button>
          </>
        }
      >
        {editor ? <CouponForm key={editor === 'new' ? 'new' : editor.id} initial={editor === 'new' ? null : editor} events={data.events} onChange={setDraft} /> : null}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        danger
        loading={busy}
        title={`Delete “${deleting?.code}”?`}
        message="The code stops working immediately. Historical usage remains in reports and audit."
        confirmLabel="Delete coupon"
      />
    </div>
  )
}

function CouponForm({ initial, events, onChange }) {
  const [form, setForm] = useState(() => ({
    code: initial?.code || '',
    type: initial?.type || 'percentage',
    value: initial?.value ?? 10,
    quantity: initial?.quantity ?? 100,
    expiryDate: initial ? initial.expiryDate.slice(0, 10) : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    eventIds: initial?.eventIds || [],
  }))
  useEffect(() => {
    onChange({ ...form })
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <div>
      <div className="row gap-12">
        <div style={{ flex: 1 }}>
          <Field label="Coupon code" required hint="Uppercase A–Z, 0–9. Guests type this at the booth.">
            <TextInput value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20))} placeholder="e.g. WEDDING20" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Expiry date" required>
            <TextInput type="date" value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="row gap-12">
        <div style={{ flex: 1 }}>
          <Field label="Discount type">
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed amount (₹)</option>
            </Select>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label={form.type === 'percentage' ? 'Discount (%)' : 'Discount (₹)'} required>
            <TextInput type="number" value={form.value} onChange={(e) => set('value', e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Quantity limit" required hint="Total times this code can be redeemed.">
            <TextInput type="number" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="field">
        <label className="label">Applicable events</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {events.map((e) => (
            <Checkbox
              key={e.id}
              checked={form.eventIds.includes(e.id)}
              onChange={(v) => set('eventIds', v ? [...form.eventIds, e.id] : form.eventIds.filter((x) => x !== e.id))}
              label={e.name}
            />
          ))}
          {events.length === 0 ? <div className="t12 faint">No events yet — the coupon will apply to all events.</div> : null}
        </div>
        {form.eventIds.length === 0 && events.length > 0 ? (
          <div className="input-hint">No events selected → coupon applies to all events.</div>
        ) : null}
      </div>
    </div>
  )
}
