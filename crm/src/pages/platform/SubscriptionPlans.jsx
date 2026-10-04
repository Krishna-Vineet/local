import { useEffect, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Button, Card, Chip, EmptyState, Field, Modal, PageLoader, TextArea, TextInput, Toggle } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { inr, relativeTime } from '../../lib/format.js'

const emptyPlan = {
  key: '', name: '', description: '', price: '', durationMonths: 3,
  durationLabel: '3 months', devices: 1, events: 1, active: true,
}

export default function SubscriptionPlans() {
  const { toast } = useApp()
  const [plans, setPlans] = useState(null)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => api.platform.plans()
    .then((result) => setPlans(result.plans))
    .catch((e) => toast(e.message, 'error'))

  useEffect(() => { load() }, [])

  const openNew = () => {
    setError('')
    setEditing('new')
    setDraft({ ...emptyPlan })
  }

  const openEdit = (plan) => {
    setError('')
    setEditing(plan)
    setDraft({ ...plan, price: plan.price == null ? '' : plan.price })
  }

  const save = async () => {
    setError('')
    if (!draft?.name.trim() || (editing === 'new' && !draft.key.trim())) {
      return setError('Plan name and key are required.')
    }
    setBusy(true)
    try {
      const body = {
        ...draft,
        name: draft.name.trim(),
        key: draft.key.trim().toLowerCase(),
        description: draft.description.trim(),
        price: draft.price === '' ? null : Number(draft.price),
        durationMonths: Number(draft.durationMonths),
        devices: Number(draft.devices),
        events: Number(draft.events),
      }
      if (editing === 'new') await api.platform.createPlan(body)
      else await api.platform.updatePlan(editing.id, body)
      toast(editing === 'new' ? `Plan “${body.name}” added` : `Plan “${body.name}” updated`)
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
          <div className="page-title">Subscription Plans</div>
          <div className="page-sub">Owner-managed plan catalogue. Limits edited here are enforced for organizations using that plan.</div>
        </div>
        <Button variant="primary" icon="plus" onClick={openNew}>Add plan</Button>
      </div>

      {!plans ? <PageLoader /> : plans.length === 0 ? (
        <Card><EmptyState icon="tag" title="No subscription plans" message="Add the first plan offered to organizations." /></Card>
      ) : (
        <div className="plan-grid">
          {plans.map((plan) => (
            <Card key={plan.id} style={{ overflow: 'hidden', opacity: plan.active ? 1 : 0.66 }}>
              <div style={{ padding: '17px 18px 14px', borderBottom: '1px solid var(--line-soft)' }}>
                <div className="row between gap-12">
                  <div className="row gap-8" style={{ minWidth: 0 }}>
                    <span className="stat-ico" style={{ background: 'var(--hp-pink-soft)', color: 'var(--hp-pink-deep)' }}><Icon name="tag" size={15} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="t13 fw7 ellipsis">{plan.name}</div>
                      <div className="t11 faint">{plan.key}</div>
                    </div>
                  </div>
                  <Chip tone={plan.active ? 'active' : 'neutral'} dot>{plan.active ? 'Active' : 'Hidden'}</Chip>
                </div>
                <div style={{ fontSize: 24, fontWeight: 730, letterSpacing: '-.03em', marginTop: 14 }}>
                  {plan.price == null ? 'Contact sales' : inr(plan.price)}
                </div>
                <div className="t11 muted">{plan.durationLabel || `${plan.durationMonths} months`}</div>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <p className="t12 muted" style={{ lineHeight: 1.55, minHeight: 38 }}>{plan.description || 'No description.'}</p>
                <div className="row gap-8 wrap mt-12">
                  <Chip tone="info">{plan.devices} device{plan.devices === 1 ? '' : 's'}</Chip>
                  <Chip tone="purple">{plan.events} parallel event{plan.events === 1 ? '' : 's'}</Chip>
                </div>
                <div className="row between mt-16" style={{ paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
                  <div className="t11 faint">
                    {plan.organizations} org{plan.organizations === 1 ? '' : 's'} · updated {relativeTime(plan.updatedAt)}
                  </div>
                  <Button size="sm" variant="outline" icon="edit" onClick={() => openEdit(plan)}>Edit</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add subscription plan' : `Edit ${editing?.name}`}
        sub={editing === 'new' ? 'The permanent key is used by billing and organization records.' : 'Existing organizations immediately use updated device and parallel-event limits.'}
        width="wide"
        footer={
          <>
            {error ? <span className="input-error" style={{ marginRight: 'auto' }}>{error}</span> : null}
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : editing === 'new' ? 'Add plan' : 'Save changes'}</Button>
          </>
        }
      >
        {draft ? (
          <div>
            <div className="form-grid-2">
              <Field label="Plan name" required>
                <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Growth" />
              </Field>
              <Field label="Permanent key" required hint={editing === 'new' ? 'Lowercase letters, numbers and hyphens.' : 'Cannot be changed after creation.'}>
                <TextInput value={draft.key} disabled={editing !== 'new'} onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="growth" />
              </Field>
            </div>
            <Field label="Description">
              <TextArea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Who this plan is designed for" />
            </Field>
            <div className="form-grid-2">
              <Field label="Price (₹)" hint="Leave blank for Contact sales.">
                <TextInput type="number" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="Contact sales" />
              </Field>
              <Field label="Duration label" hint="Shown exactly as written.">
                <TextInput value={draft.durationLabel} onChange={(e) => setDraft({ ...draft, durationLabel: e.target.value })} placeholder="6 months" />
              </Field>
              <Field label="Duration (months)" hint="Use 0 for a trial/custom period.">
                <TextInput type="number" min="0" max="120" value={draft.durationMonths} onChange={(e) => setDraft({ ...draft, durationMonths: e.target.value })} />
              </Field>
              <Field label="Device limit" required>
                <TextInput type="number" min="1" max="1000" value={draft.devices} onChange={(e) => setDraft({ ...draft, devices: e.target.value })} />
              </Field>
              <Field label="Parallel event limit" required>
                <TextInput type="number" min="1" max="1000" value={draft.events} onChange={(e) => setDraft({ ...draft, events: e.target.value })} />
              </Field>
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
    </div>
  )
}
