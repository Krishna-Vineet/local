import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import {
  Card, Chip, PageLoader, SearchInput, Select, Button, Drawer, KV,
  ConfirmDialog, TextArea, ProgressBar, EmptyState, NA, orNA, isMissing,
} from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { inr, dateShort, relativeTime } from '../../lib/format.js'
import { statusMeta, PLANS } from '../../lib/plans.js'
import { ROLES } from '../../lib/roles.js'

export default function Organizations() {
  const { user, toast } = useApp()
  const isOwner = user.role === ROLES.OWNER
  const [rows, setRows] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [plan, setPlan] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [action, setAction] = useState(null) // {org, kind: 'suspend'|'ban'|'restore'}
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    const q = new URLSearchParams()
    if (search) q.set('search', search)
    if (status) q.set('status', status)
    if (plan) q.set('plan', plan)
    q.set('limit', '50')
    api.platform.organizations('?' + q.toString()).then((r) => setRows(r.items)).catch(() => setRows([]))
  }, [search, status, plan])

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const openDetail = (org) => {
    setDetailLoading(true)
    setDetail({ ...org, loading: true })
    api.platform.organization(org.id)
      .then((d) => setDetail({ ...org, ...d, loading: false, loadError: null }))
      .catch((e) => { toast(e.message, 'error'); setDetail({ ...org, loading: false, loadError: e.message }) })
  }

  const runAction = async () => {
    if (!action) return
    if ((action.kind === 'suspend' || action.kind === 'ban') && !reason.trim()) {
      toast('A reason is required.', 'error')
      return
    }
    setBusy(true)
    try {
      if (action.kind === 'suspend') await api.platform.suspend(action.org.id, reason.trim())
      if (action.kind === 'ban') await api.platform.ban(action.org.id, reason.trim())
      if (action.kind === 'restore') await api.platform.restore(action.org.id)
      toast(
        action.kind === 'restore' ? `Restored ${action.org.name}` : `${action.kind === 'ban' ? 'Banned' : 'Suspended'} ${action.org.name}`,
        'success'
      )
      setAction(null)
      setReason('')
      load()
      if (detail && detail.id === action.org.id) openDetail(action.org)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Organizations</div>
          <div className="page-sub">Every client on HappyPix with plan and operational health. Statuses are computed automatically — {isOwner ? 'you can suspend, ban or restore.' : 'read-only for your role.'}</div>
        </div>
      </div>

      <Card>
        <div className="row wrap gap-12" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or owner…" style={{ width: 280 }} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 150, height: 36 }}>
            <option value="">All statuses</option>
            {Object.entries(statusMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Select value={plan} onChange={(e) => setPlan(e.target.value)} style={{ width: 140, height: 36 }}>
            <option value="">All plans</option>
            {Object.keys(PLANS).map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}
          </Select>
        </div>

        {!rows ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <EmptyState icon="building" title="No organizations found" message="Try changing your search or filters." />
        ) : (
          <div className="table-wrap">
            <table className="hp-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Expiry</th>
                  <th className="t-right">Devices</th>
                  <th className="t-right">Active events</th>
                  <th>Created</th>
                  <th>Last active</th>
                  {isOwner ? <th className="t-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(o)}>
                    <td>
                      <div className="cell-main">{o.name}</div>
                      <div className="cell-sub">{o.ownerName} · {o.email}</div>
                    </td>
                    <td><span className="fw6" style={{ textTransform: 'capitalize' }}>{o.planName}</span></td>
                    <td><Chip tone={statusMeta(o.planStatus).chip.replace('chip-', '')} dot>{statusMeta(o.planStatus).label}</Chip></td>
                    <td>
                      <div className="t13">{dateShort(o.planExpiry)}</div>
                      {o.planDaysLeft != null && o.planDaysLeft <= 14 && ['active', 'expiring_soon', 'trial'].includes(o.planStatus) ? (
                        <div className="cell-sub" style={{ color: 'var(--warn)', fontWeight: 600 }}>{o.planDaysLeft}d left</div>
                      ) : null}
                    </td>
                    <td className="t-right">
                      <span className="num fw6">{o.onlineDevices}</span>
                      <span className="t11 muted"> / {o.devices}</span>
                    </td>
                    <td className="t-right num fw6">{o.activeEvents}</td>
                    <td className="t13 muted">{dateShort(o.createdAt)}</td>
                    <td className="t13 muted">{relativeTime(o.lastActiveAt)}</td>
                    {isOwner ? (
                      <td className="t-right" onClick={(e) => e.stopPropagation()}>
                        {['suspended', 'banned'].includes(o.status) ? (
                          <Button size="sm" variant="outline" icon="check" onClick={() => setAction({ org: o, kind: 'restore' })}>Restore</Button>
                        ) : (
                          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                            <Button size="sm" variant="outline" onClick={() => setAction({ org: o, kind: 'suspend' })}>Suspend</Button>
                            <Button size="sm" variant="danger-soft" icon="ban" onClick={() => setAction({ org: o, kind: 'ban' })}>Ban</Button>
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name || ''}
        sub={detail ? `${detail.ownerName} · ${detail.email}` : ''}
        icon="building"
        footer={
          detail && isOwner && !detail.loading ? (
            ['suspended', 'banned'].includes(detail.status) ? (
              <Button variant="primary" icon="check" style={{ width: '100%' }} onClick={() => setAction({ org: detail, kind: 'restore' })}>Restore organization</Button>
            ) : (
              <div className="row gap-12">
                <Button variant="outline" style={{ flex: 1 }} onClick={() => setAction({ org: detail, kind: 'suspend' })}>Suspend</Button>
                <Button variant="danger-soft" icon="ban" style={{ flex: 1 }} onClick={() => setAction({ org: detail, kind: 'ban' })}>Ban</Button>
              </div>
            )
          ) : null
        }
      >
        {detail ? (
          detail.loading ? (
            <div className="page-load" style={{ padding: '60px 0' }}><span className="spinner" /></div>
          ) : (
            <OrgDetailBody detail={detail} onRetry={() => openDetail(detail)} />
          )
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={!!action}
        onClose={() => { setAction(null); setReason('') }}
        onConfirm={runAction}
        loading={busy}
        danger={action?.kind === 'ban'}
        title={
          action?.kind === 'suspend' ? `Suspend ${action?.org?.name}?`
            : action?.kind === 'ban' ? `Ban ${action?.org?.name}?`
            : `Restore ${action?.org?.name}?`
        }
        message={
          action?.kind === 'suspend'
            ? 'The organization can log in to view limited account status, but cannot create events or register devices. This action is audit logged.'
            : action?.kind === 'ban'
              ? 'The organization will lose CRM access and its booths will be blocked from connecting. Restore later if needed. This action is audit logged.'
              : 'The organization regains full access according to its plan state. This action is audit logged.'
        }
        confirmLabel={action?.kind === 'suspend' ? 'Suspend' : action?.kind === 'ban' ? 'Ban organization' : 'Restore'}
      >
        {action && action.kind !== 'restore' ? (
          <FieldWrap label="Reason" required>
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this organization being suspended/banned? This is stored in the audit log."
            />
          </FieldWrap>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}

function FieldWrap({ label, required, children }) {
  return (
    <div className="field">
      <label className="label">{label} {required ? <span className="req">*</span> : null}</label>
      {children}
    </div>
  )
}

// ---- Organization detail (drawer body) ----
// Every section renders an explicit "not available" state when the API
// omitted it, instead of blank/undefined cells.
function OrgDetailBody({ detail, onRetry }) {
  const plan = detail.plan && typeof detail.plan === 'object' ? detail.plan : null
  const devices = Array.isArray(detail.devices) ? detail.devices : null
  const events = Array.isArray(detail.events) ? detail.events : null
  const revenue = detail.revenue && typeof detail.revenue === 'object' ? detail.revenue : null
  const activeEvents = events ? events.filter((e) => e.status === 'active').length : null
  const planStatus = plan?.status || detail.planStatus || detail.status
  const sm = statusMeta(planStatus)

  return (
    <div>
      {detail.loadError ? (
        <div className="card card-pad mb-16" style={{ background: 'var(--warn-soft)', borderColor: 'rgba(180,83,9,.2)' }}>
          <div className="row between gap-12">
            <div>
              <div className="t12 fw7" style={{ color: 'var(--warn)' }}>Details could not be loaded</div>
              <div className="t12 muted mt-4">{detail.loadError} — showing the summary from the list.</div>
            </div>
            <Button size="sm" variant="outline" icon="refresh" onClick={onRetry}>Retry</Button>
          </div>
        </div>
      ) : null}

      <div className="row wrap gap-8 mb-16">
        <Chip tone={sm.chip.replace('chip-', '')} dot>{sm.label}</Chip>
        <Chip tone="neutral">{plan?.planName || detail.planName || 'Plan not available'}{plan?.planName || detail.planName ? ' plan' : ''}</Chip>
        {plan?.daysLeft != null && plan.daysLeft <= 14 ? <Chip tone="warn">{plan.daysLeft}d to expiry</Chip> : null}
      </div>

      {detail.suspendReason ? (
        <div className="card card-pad mb-16" style={{ background: 'var(--danger-soft)', borderColor: 'rgba(217,45,32,.2)' }}>
          <div className="row gap-8 t12 fw7 mb-8" style={{ color: 'var(--danger)' }}>
            <Icon name="ban" size={14} /> {detail.status === 'banned' ? 'BANNED' : 'SUSPENDED'}
          </div>
          <p className="t13" style={{ color: 'var(--danger)' }}>{detail.suspendReason}</p>
        </div>
      ) : null}

      <div className="card card-pad mb-16">
        <div className="card-title mb-12" style={{ fontSize: 13 }}>Contact</div>
        <KV k="Owner" v={detail.ownerName} />
        <KV k="Email" v={detail.email} mono />
        <KV k="Phone" v={detail.phone} mono />
        <KV k="Country" v={detail.country} />
        <KV k="Client since" v={dateShort(detail.createdAt)} />
        <KV k="Last active" v={detail.lastActiveAt ? relativeTime(detail.lastActiveAt) : undefined} />
      </div>

      <div className="card card-pad mb-16">
        <div className="card-title mb-12" style={{ fontSize: 13 }}>Subscription</div>
        {plan ? (
          <>
            <KV k="Plan" v={plan.planName} />
            <KV k="Status" v={statusMeta(plan.status).label} />
            <KV k="Started" v={dateShort(plan.startDate)} />
            <KV k="Expires" v={dateShort(plan.endDate)} />
            <KV k="Device limit" v={plan.deviceLimit != null ? `${plan.deviceLimit} devices` : undefined} />
            <KV k="Parallel events" v={plan.eventLimit != null ? `${plan.eventLimit} active` : undefined} />
            <KV k="Amount paid" v={detail.subscription ? inr(detail.subscription.amount) : detail.subscription === null ? 'Trial / none' : undefined} />
            <KV k="Invoice" v={detail.subscription ? (detail.subscription.invoice || 'Trial / none') : undefined} mono />
          </>
        ) : (
          <SectionNA what="Subscription details" />
        )}
      </div>

      <div className="card card-pad mb-16">
        <div className="card-title mb-12" style={{ fontSize: 13 }}>Usage</div>
        <div className="row between t12 mb-8">
          <span className="muted">Devices</span>
          <span className="num fw6">{devices ? devices.length : <NA />} / {orNA(plan?.deviceLimit)}</span>
        </div>
        <ProgressBar value={devices ? devices.length : 0} max={plan?.deviceLimit || 1} height={6} showLabel={false} />
        <div className="row between t12 mb-8 mt-12">
          <span className="muted">Parallel active events</span>
          <span className="num fw6">{activeEvents != null ? activeEvents : <NA />} / {orNA(plan?.eventLimit)}</span>
        </div>
        <ProgressBar value={activeEvents || 0} max={plan?.eventLimit || 1} height={6} showLabel={false} />
        <div className="row between t12 mb-8 mt-12">
          <span className="muted">Booth print revenue (all time)</span>
          <span className="num fw6">{revenue && !isMissing(revenue.total) ? inr(revenue.total) : <NA />}</span>
        </div>
        {revenue ? (
          <div className="row between t12">
            <span className="muted">Prints · transactions</span>
            <span className="num fw6">{orNA(revenue.prints)} · {orNA(revenue.transactions)}</span>
          </div>
        ) : null}
      </div>

      <div className="card mb-16">
        <div className="card-head" style={{ padding: '12px 16px' }}>
          <div className="card-title" style={{ fontSize: 13 }}>Devices{devices ? ` (${devices.length})` : ''}</div>
        </div>
        {!devices ? (
          <SectionNA what="Device list" pad />
        ) : devices.length === 0 ? (
          <div className="t13 muted" style={{ padding: '14px 16px' }}>No devices registered yet.</div>
        ) : devices.map((d) => (
          <div key={d.id} className="row between" style={{ padding: '10px 16px', borderBottom: '1px solid var(--line-soft)' }}>
            <div className="row gap-10" style={{ minWidth: 0 }}>
              <Icon name="monitor" size={16} style={{ color: d.online ? 'var(--hp-green-ink)' : 'var(--faint)', flex: 'none' }} />
              <div style={{ minWidth: 0 }}>
                <div className="t13 fw6 ellipsis">{orNA(d.deviceName)}</div>
                <div className="t11 muted">{d.location || d.eventName || <NA text="No location" />}</div>
              </div>
            </div>
            <Chip tone={d.online ? 'active' : 'neutral'} dot>{d.online ? 'Online' : 'Offline'}</Chip>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head" style={{ padding: '12px 16px' }}>
          <div className="card-title" style={{ fontSize: 13 }}>Events{events ? ` (${events.length})` : ''}</div>
        </div>
        {!events ? (
          <SectionNA what="Event list" pad />
        ) : events.length === 0 ? (
          <div className="t13 muted" style={{ padding: '14px 16px' }}>No events yet.</div>
        ) : events.map((e) => (
          <div key={e.id} className="row between" style={{ padding: '10px 16px', borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ minWidth: 0 }}>
              <div className="t13 fw6 ellipsis">{orNA(e.name)}</div>
              <div className="t11 muted">{dateShort(e.startDate)}</div>
            </div>
            <Chip tone={e.status === 'active' ? 'active' : e.status === 'upcoming' ? 'info' : e.status === 'paused' ? 'warn' : 'neutral'} dot>
              {e.status ? e.status[0].toUpperCase() + e.status.slice(1) : 'Unknown'}
            </Chip>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionNA({ what, pad = false }) {
  return (
    <div className="row gap-8 t12" style={{ color: 'var(--faint)', padding: pad ? '14px 16px' : '4px 0', fontStyle: 'italic' }}>
      <Icon name="info" size={13} /> {what} not available — the server did not return this section.
    </div>
  )
}
