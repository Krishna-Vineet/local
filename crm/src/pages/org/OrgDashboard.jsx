import { useEffect, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Card, CardHead, StatCard, Chip, PageLoader, ProgressBar, WarnBanner, Button, Avatar } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { inr, dateShort, relativeTime } from '../../lib/format.js'
import { ENV, openExternal } from '../../lib/env.js'
import { PLANS } from '../../lib/plans.js'
import { ROLES } from '../../lib/roles.js'
import { Link } from '../../lib/router.jsx'

const PLAN_ORDER = ['trial', 'starter', 'basic', 'professional', 'business', 'custom']

export default function OrgDashboard() {
  const { user } = useApp()
  const isAdmin = user.role === ROLES.ORG_ADMIN
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.org.dashboard().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="empty"><div className="empty-ico"><Icon name="alert" size={24} /></div><h3>Could not load dashboard</h3><p>{error}</p></div>
  if (!data) return <PageLoader />

  const { plan, usage, devices, events, tickets, warnings, revenue, organization } = data

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">{organization.name}</div>
          <div className="page-sub">
            {isAdmin
              ? 'Your organization at a glance — plan, booths, events and guest support.'
              : 'Operations view — events, devices and guest support.'}
          </div>
        </div>
        {isAdmin ? (
          <Button variant="ink" icon="arrow-up-right" onClick={() => openExternal(ENV.WEBSITE_URL)}>
            Upgrade plan
          </Button>
        ) : null}
      </div>

      {warnings.map((w, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <WarnBanner tone={w.tone === 'danger' ? 'danger' : w.tone === 'info' ? 'info' : 'warn'} icon={w.kind === 'booth_offline' ? 'wifi-off' : w.kind === 'org_blocked' ? 'ban' : 'alert'}>
            {w.text}
          </WarnBanner>
        </div>
      ))}

      <div className="stat-grid mb-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))' }}>
        <StatCard label="Current plan" value={plan.planName} icon="zap" foot={plan.daysLeft != null ? `${plan.daysLeft} days left` : '—'} iconBg={plan.status === 'trial' ? 'var(--hp-blue-soft)' : 'var(--hp-pink-soft)'} iconColor={plan.status === 'trial' ? 'var(--hp-blue)' : 'var(--hp-pink)'} />
        <StatCard label="Booths online" value={`${devices.online}/${devices.total}`} icon="monitor" iconBg="var(--hp-green-soft)" iconColor="var(--hp-green-ink)" foot={`${devices.offline} offline`} />
        <StatCard label="Active events" value={events.active.length} icon="calendar" iconBg="var(--hp-purple-soft)" iconColor="var(--hp-purple)" foot={`${events.upcoming.length} upcoming`} />
        <StatCard label="Open tickets" value={tickets.open} icon="headset" iconBg={tickets.open > 0 ? 'var(--warn-soft)' : 'var(--hp-green-soft)'} iconColor={tickets.open > 0 ? 'var(--warn)' : 'var(--hp-green-ink)'} foot="guest issues" />
        {isAdmin && revenue ? (
          <StatCard label="Booth revenue (month)" value={inr(revenue.thisMonth)} icon="revenue" onClick={() => { location.hash = '#/org/revenue' }} foot={`all-time ${inr(revenue.total)}`} />
        ) : null}
        {isAdmin && revenue?.wallet ? (
          <StatCard
            label="Wallet balance"
            value={inr(revenue.wallet.balance)}
            icon="wallet"
            iconBg={revenue.payout?.payoutMode === 'upi' ? 'var(--hp-green-soft)' : 'var(--hp-purple-soft)'}
            iconColor={revenue.payout?.payoutMode === 'upi' ? 'var(--hp-green-ink)' : 'var(--hp-purple)'}
            onClick={() => { location.hash = '#/org/revenue' }}
            foot={revenue.payout?.payoutMode === 'upi' ? `guests pay ${revenue.payout.upiId || 'your UPI'} directly` : revenue.wallet.processing ? `${inr(revenue.wallet.processing)} payout processing` : 'UPI paused · collecting to wallet'}
          />
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Card>
          <CardHead title="Plan usage" sub={isAdmin ? `${plan.planName} · expires ${dateShort(plan.endDate)}` : `${plan.planName} plan limits`} />
          <div style={{ padding: '18px 20px' }}>
            <div className="row between t12 mb-8">
              <span className="muted">Devices used</span>
              <span className="num fw6">{usage.devicesUsed} / {usage.deviceLimit}</span>
            </div>
            <ProgressBar value={usage.devicesUsed} max={usage.deviceLimit} height={8} color={usage.devicesUsed >= usage.deviceLimit ? 'var(--danger)' : 'var(--hp-pink)'} showLabel={false} />
            <div className="row between t12 mb-8 mt-16">
              <span className="muted">Parallel active events</span>
              <span className="num fw6">{usage.eventsUsed} / {usage.eventLimit}</span>
            </div>
            <ProgressBar value={usage.eventsUsed} max={usage.eventLimit} height={8} color={usage.eventsUsed >= usage.eventLimit ? 'var(--danger)' : 'var(--hp-purple)'} showLabel={false} />

            {isAdmin ? (
              <div className="mt-24">
                <div className="t11 fw7" style={{ letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 10 }}>Plans on the HappyPix website</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {PLAN_ORDER.filter((p) => p !== 'trial').map((p) => {
                    const pd = PLANS[p]
                    const current = p === plan.plan
                    return (
                      <div key={p} className="card" style={{ padding: '10px 12px', borderColor: current ? 'var(--hp-pink)' : undefined, background: current ? 'var(--hp-pink-softer)' : undefined, minWidth: 0 }}>
                        <div className="t12 fw7" style={{ textTransform: 'capitalize' }}>{pd.name}</div>
                        <div className="t11 num" style={{ color: 'var(--muted)' }}>{pd.price != null ? inr(pd.price) : 'Custom'}</div>
                        <div className="t10 t11 faint">{pd.devices} dev · {pd.events} evt</div>
                      </div>
                    )
                  })}
                </div>
                <p className="t11 faint mt-8">Upgrades complete on the HappyPix website — the CRM reflects the new plan automatically.</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHead title="Events" sub="Active, upcoming and recently finished" children={<Link to="/org/events" className="t12 fw6" style={{ color: 'var(--hp-pink-deep)' }}>Manage →</Link>} />
          <div>
            <EventGroup label="Live now" list={events.active} tone="active" />
            <EventGroup label="Upcoming" list={events.upcoming} tone="info" />
            {events.paused.length > 0 ? <EventGroup label="Paused" list={events.paused} tone="warn" /> : null}
            <EventGroup label="Recently finished" list={events.finished} tone="neutral" />
          </div>
        </Card>

        <Card>
          <CardHead title="Guest support" sub="Open issues from your booths" children={<Link to="/org/support" className="t12 fw6" style={{ color: 'var(--hp-pink-deep)' }}>Open inbox →</Link>} />
          {tickets.list.length === 0 ? (
            <div className="empty" style={{ padding: '34px 16px' }}>
              <h3>Inbox zero</h3>
              <p>No open guest tickets. Nice work.</p>
            </div>
          ) : (
            <div>
              {tickets.list.map((t) => (
                <Link key={t.id} to="/org/support" className="row between" style={{ padding: '12px 20px', borderBottom: '1px solid var(--line-soft)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="t13 fw6 ellipsis">{t.subject}</div>
                    <div className="t11 muted">{t.event?.name || 'General'} · {relativeTime(t.createdAt)}</div>
                  </div>
                  <Chip tone={t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warn' : 'info'}>{t.priority}</Chip>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function EventGroup({ label, list, tone }) {
  if (!list.length) return null
  const toneMap = { active: 'var(--hp-green-ink)', info: 'var(--hp-blue)', warn: 'var(--warn)', neutral: 'var(--faint)' }
  return (
    <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--line-soft)' }}>
      <div className="t11 fw7" style={{ color: toneMap[tone], letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      {list.map((e) => (
        <div key={e.id} className="row between" style={{ padding: '7px 0' }}>
          <div style={{ minWidth: 0 }}>
            <div className="t13 fw6 ellipsis">{e.name}</div>
            <div className="t11 muted">{dateShort(e.startDate)}{e.location ? ` · ${e.location}` : ''}</div>
          </div>
          <Chip tone={tone === 'neutral' ? 'neutral' : tone} dot>{tone === 'neutral' ? 'Finished' : tone === 'info' ? 'Upcoming' : tone === 'warn' ? 'Paused' : 'Live'}</Chip>
        </div>
      ))}
    </div>
  )
}
