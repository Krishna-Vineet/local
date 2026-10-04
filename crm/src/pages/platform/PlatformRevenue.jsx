import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/index.js'
import { Card, CardHead, StatCard, Chip, PageLoader, Select, Avatar } from '../../components/ui.jsx'
import { BarChart, LineChart, ChartLegend } from '../../components/charts.jsx'
import { Icon } from '../../lib/icons.jsx'
import { inr, dateShort } from '../../lib/format.js'
import { statusMeta } from '../../lib/plans.js'

const SORTS = [
  { id: 'highest', label: 'Highest revenue' },
  { id: 'lowest', label: 'Lowest revenue' },
  { id: 'month', label: 'This month' },
  { id: 'fy', label: 'This financial year' },
  { id: 'plan', label: 'Plan type' },
  { id: 'expiring', label: 'Expiring soon' },
]

export default function PlatformRevenue() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState('highest')
  const [planFilter, setPlanFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [year, setYear] = useState(2026)

  useEffect(() => {
    api.platform.revenue().then(setData).catch((e) => setError(e.message))
  }, [])

  const rows = useMemo(() => {
    if (!data) return []
    let r = [...data.orgs]
    if (planFilter) r = r.filter((x) => x.plan === planFilter)
    if (statusFilter) r = r.filter((x) => x.planStatus === statusFilter)
    switch (sort) {
      case 'highest': r.sort((a, b) => b.revenue - a.revenue); break
      case 'lowest': r.sort((a, b) => a.revenue - b.revenue); break
      case 'month': r.sort((a, b) => b.revenueThisMonth - a.revenueThisMonth); break
      case 'fy': r.sort((a, b) => b.revenueFY - a.revenueFY); break
      case 'plan': r.sort((a, b) => a.plan.localeCompare(b.plan)); break
      case 'expiring': r.sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999)); break
    }
    return r
  }, [data, sort, planFilter, statusFilter])

  if (error) return <div className="empty"><div className="empty-ico"><Icon name="alert" size={24} /></div><h3>Access denied</h3><p>{error}</p></div>
  if (!data) return <PageLoader />

  const plans = [...new Set(data.orgs.map((o) => o.plan))]

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Platform Revenue</div>
          <div className="page-sub">Subscription revenue from the display website — computed by the billing system, never edited here.</div>
        </div>
        <Chip tone="pink" dot>Owner only</Chip>
      </div>

      <div className="stat-grid mb-16">
        <StatCard label="Net platform revenue" value={inr(data.net)} icon="revenue" foot="all subscriptions, till date" />
        <StatCard label="This financial year" value={inr(data.fyRevenue)} icon="calendar" iconBg="var(--hp-blue-soft)" iconColor="var(--hp-blue)" foot="Apr 2026 → Mar 2027" />
        <StatCard label="This month" value={inr(data.monthRevenue)} icon="zap" iconBg="var(--hp-green-soft)" iconColor="var(--hp-green-ink)" foot="September 2026" />
        <StatCard label="Paying organizations" value={data.orgs.filter((o) => o.revenue > 0).length} icon="building" iconBg="var(--hp-purple-soft)" iconColor="var(--hp-purple)" foot={`of ${data.orgs.length} total`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }} className="mb-16">
        <Card>
          <CardHead title="Monthly subscription revenue" sub="Last 12 months" />
          <div style={{ padding: '14px 16px 8px' }}>
            <BarChart data={data.monthWise} height={180} formatValue={(v) => inr(v)} />
          </div>
        </Card>
        <Card>
          <CardHead
            title={`Quarterly — ${year}`}
            sub="Revenue by quarter"
            children={
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 110, height: 30, fontSize: 12.5 }}>
                {data.yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            }
          />
          <div style={{ padding: '14px 16px 8px' }}>
            <BarChart data={data.quarterWise} height={180} color="var(--hp-purple)" formatValue={(v) => inr(v)} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHead
          title="All-time trend"
          sub="Cumulative subscription revenue"
          children={<span className="t11 faint">Updated from verified purchase webhooks</span>}
        />
        <div style={{ padding: '14px 16px 8px' }}>
          <LineChart
            data={data.monthWise.map((m, i, arr) => {
              let sum = 0
              for (let k = 0; k <= i; k++) sum += arr[k].value
              return { label: m.label, value: sum }
            })}
            height={200}
            formatValue={(v) => inr(v)}
            yPrefix="₹"
          />
        </div>
      </Card>

      <Card className="mt-16">
        <CardHead
          title="Organization revenue"
          sub="Subscription purchases per organization"
          children={
            <div className="row gap-8">
              <Select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} style={{ width: 130, height: 32, fontSize: 12.5 }}>
                <option value="">All plans</option>
                {plans.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 140, height: 32, fontSize: 12.5 }}>
                <option value="">All statuses</option>
                {['active', 'trial', 'expiring_soon', 'expired', 'not_subscribed', 'suspended', 'banned'].map((s) => (
                  <option key={s} value={s}>{statusMeta(s).label}</option>
                ))}
              </Select>
              <Select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 160, height: 32, fontSize: 12.5 }}>
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </div>
          }
        />
        <div className="table-wrap" style={{ maxHeight: 460, overflowY: 'auto' }}>
          <table className="hp-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Expiry</th>
                <th className="t-right">This month</th>
                <th className="t-right">This FY</th>
                <th className="t-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div className="row gap-12">
                      <Avatar name={o.name} size={30} />
                      <div>
                        <div className="cell-main">{o.name}</div>
                        <div className="cell-sub">{o.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="fw6" style={{ textTransform: 'capitalize' }}>{o.plan}</span></td>
                  <td><Chip tone={statusMeta(o.planStatus).chip.replace('chip-', '')} dot>{statusMeta(o.planStatus).label}</Chip></td>
                  <td>
                    <div className="t13">{dateShort(o.expiry)}</div>
                    {o.daysLeft != null && o.daysLeft <= 30 && o.planStatus !== 'expired' && o.planStatus !== 'banned' && o.planStatus !== 'suspended' ? (
                      <div className="cell-sub" style={{ color: o.daysLeft <= 14 ? 'var(--warn)' : undefined }}>{o.daysLeft}d left</div>
                    ) : null}
                  </td>
                  <td className="t-right num fw6">{inr(o.revenueThisMonth)}</td>
                  <td className="t-right num">{inr(o.revenueFY)}</td>
                  <td className="t-right num fw7">{inr(o.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line-soft)' }}>
          <ChartLegend
            items={[
              { color: 'var(--hp-pink)', label: 'Subscription revenue', value: inr(data.net) },
              { color: 'var(--hp-purple)', label: 'Quarterly view', value: '' },
            ]}
          />
        </div>
      </Card>
    </div>
  )
}
