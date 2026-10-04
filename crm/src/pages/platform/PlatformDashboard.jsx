import { useEffect, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Card, CardHead, StatCard, Chip, PageLoader, Avatar, ProgressBar } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { relativeTime, dateShort, inr } from '../../lib/format.js'
import { PERMS, ROLES } from '../../lib/roles.js'
import { Link } from '../../lib/router.jsx'
import { roleHasPermission } from '../../lib/roles.js'

export default function PlatformDashboard() {
  const { user } = useApp()
  const [data, setData] = useState(null)
  const [rev, setRev] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.platform.dashboard().then(setData).catch((e) => setError(e.message))
    if (roleHasPermission(user.role, PERMS.PLATFORM_REVENUE_VIEW)) {
      api.platform.revenue().then((r) => setRev(r)).catch(() => {})
    }
  }, [user.role])

  if (error) return <div className="empty"><div className="empty-ico"><Icon name="alert" size={24} /></div><h3>Could not load dashboard</h3><p>{error}</p></div>
  if (!data) return <PageLoader />

  const canSeeRevenue = roleHasPermission(user.role, PERMS.PLATFORM_REVENUE_VIEW)

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Platform Dashboard</div>
          <div className="page-sub">Health and usage across every HappyPix organization — {dateShort(new Date().toISOString())}</div>
        </div>
      </div>

      {canSeeRevenue && (
        <div
          style={{
            background: 'linear-gradient(115deg, #2A0A1F 0%, #4A0E33 48%, #5F4CAA 130%)',
            borderRadius: 'var(--r-lg)', padding: '20px 24px', marginBottom: 16,
            color: '#fff', position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', right: -60, top: -90, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(234,9,127,0.4), transparent 70%)' }} />
          <div className="row between" style={{ position: 'relative', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="t12" style={{ opacity: 0.75, fontWeight: 650, letterSpacing: '0.04em' }}>PLATFORM REVENUE (OWNER)</div>
              <div className="row gap-24 mt-8" style={{ flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11.5, opacity: 0.7 }}>Net till date</div>
                  <div className="num" style={{ fontSize: 24, fontWeight: 740 }}>{rev ? inr(rev.net) : '₹ ---'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, opacity: 0.7 }}>This month</div>
                  <div className="num" style={{ fontSize: 24, fontWeight: 740 }}>{rev ? inr(rev.monthRevenue) : '₹ ---'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, opacity: 0.7 }}>This FY</div>
                  <div className="num" style={{ fontSize: 24, fontWeight: 740 }}>{rev ? inr(rev.fyRevenue) : '₹ ---'}</div>
                </div>
              </div>
            </div>
            <Link to="/platform/revenue" className="btn" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', backdropFilter: 'blur(4px)' }}>
              Open Platform Revenue <Icon name="arrow-up-right" size={15} />
            </Link>
          </div>
        </div>
      )}

      <div className="stat-grid mb-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <StatCard label="Organizations" value={data.orgs.total} icon="building" foot={`${data.orgs.active} active · ${data.orgs.trial} trial`} />
        <StatCard label="Active organizations" value={data.orgs.active} icon="check-circle" iconBg="var(--hp-green-soft)" iconColor="var(--hp-green-ink)" foot={`${data.orgs.suspended} suspended · ${data.orgs.banned} banned`} />
        <StatCard label="Devices connected" value={data.devices.total} icon="monitor" iconBg="var(--hp-blue-soft)" iconColor="var(--hp-blue)" foot={`${data.devices.online} online now`} />
        <StatCard label="Active events" value={data.events.active} icon="calendar" iconBg="var(--hp-purple-soft)" iconColor="var(--hp-purple)" foot={`${data.events.upcoming} upcoming`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Card>
          <CardHead title="Devices" sub="Online vs offline, platform-wide" />
          <div style={{ padding: '18px 20px' }}>
            <div className="row between t13 fw6 mb-12">
              <span>{data.devices.online} online</span>
              <span className="muted">{data.devices.offline} offline</span>
            </div>
            <ProgressBar value={data.devices.online} max={data.devices.total} color="var(--hp-green)" height={9} />
            <div className="row gap-16 mt-16" style={{ flexWrap: 'wrap' }}>
              <MiniMetric icon="monitor" label="Total registered" value={data.devices.total} />
              <MiniMetric icon="check-circle" label="Operational" value={data.devices.operational} />
              <MiniMetric icon="wifi-off" label="Offline" value={data.devices.offline} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Expiring plans & trials" sub="Renewals landing within 14 days" />
          {data.expiringSoon.length === 0 ? (
            <div className="empty" style={{ padding: '30px 16px' }}>
              <h3>Nothing expiring soon</h3>
              <p>No plans or trials end in the next 14 days.</p>
            </div>
          ) : (
            <div>
              {data.expiringSoon.map((e) => (
                <div key={e.id} className="row between" style={{ padding: '11px 20px', borderBottom: '1px solid var(--line-soft)' }}>
                  <div className="row gap-12" style={{ minWidth: 0 }}>
                    <Avatar name={e.name} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <div className="t13 fw6 ellipsis">{e.name}</div>
                      <div className="t11 muted">{e.plan} plan</div>
                    </div>
                  </div>
                  <Chip tone="warn" dot>{e.daysLeft}d left</Chip>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="Organizations near plan limits" sub="Upgrade conversations to start" />
          {data.nearLimits.length === 0 ? (
            <div className="empty" style={{ padding: '30px 16px' }}>
              <h3>All healthy</h3>
              <p>No organization is near its device or event limits.</p>
            </div>
          ) : (
            <div>
              {data.nearLimits.map((x) => (
                <div key={x.id} style={{ padding: '11px 20px', borderBottom: '1px solid var(--line-soft)' }}>
                  <div className="row between mb-8">
                    <span className="t13 fw6">{x.name}</span>
                    <span className="t11 muted">{x.deviceUsed}/{x.deviceLimit} devices · {x.eventUsed}/{x.eventLimit} events</span>
                  </div>
                  <ProgressBar value={Math.max(x.deviceUsed / Math.max(1, x.deviceLimit), x.eventUsed / Math.max(1, x.eventLimit)) * 100} max={100} color={x.deviceUsed >= x.deviceLimit || x.eventUsed >= x.eventLimit ? 'var(--danger)' : 'var(--warn)'} height={6} showLabel={false} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="Health alerts" sub="Needs platform attention" />
          {data.alerts.length === 0 ? (
            <div className="empty" style={{ padding: '30px 16px' }}>
              <h3>All clear</h3>
              <p>No platform health alerts right now.</p>
            </div>
          ) : (
            <div>
              {data.alerts.map((a, i) => (
                <div key={i} className="row gap-12" style={{ padding: '10px 20px', borderBottom: '1px solid var(--line-soft)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.tone === 'danger' ? 'var(--danger)' : 'var(--warn)', marginTop: 6, flex: 'none' }} />
                  <span className="t13" style={{ color: 'var(--ink-2)' }}>{a.text}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-16">
        <CardHead title="Recent organization signups" sub="New clients on the platform" />
        <div>
          {data.recentSignups.map((o) => (
            <div key={o.id} className="row between" style={{ padding: '12px 20px', borderBottom: '1px solid var(--line-soft)' }}>
              <div className="row gap-12">
                <Avatar name={o.name} size={32} />
                <div>
                  <div className="t13 fw6">{o.name}</div>
                  <div className="t11 muted">Joined {relativeTime(o.createdAt)} · {o.plan} plan</div>
                </div>
              </div>
              <Chip tone="pink">New</Chip>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function MiniMetric({ icon, label, value }) {
  return (
    <div className="row gap-12">
      <span className="stat-ico" style={{ width: 34, height: 34, background: 'var(--surface-2)', color: 'var(--muted)' }}>
        <Icon name={icon} size={16} />
      </span>
      <div>
        <div className="num" style={{ fontSize: 17, fontWeight: 720 }}>{value}</div>
        <div className="t11 muted">{label}</div>
      </div>
    </div>
  )
}
