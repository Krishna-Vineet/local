import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Card, CardHead, StatCard, Chip, PageLoader, Select, Button, Modal, Field, TextInput, KV, NA } from '../../components/ui.jsx'
import { BarChart, Donut, ChartLegend } from '../../components/charts.jsx'
import { Icon } from '../../lib/icons.jsx'
import { inr, dateShort, relativeTime } from '../../lib/format.js'
import { ROLES } from '../../lib/roles.js'

const WD_CHIP = { paid: 'active', processing: 'warn', failed: 'danger' }

export default function OrgRevenue() {
  const { user, toast } = useApp()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [eventId, setEventId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  const load = () => api.org.revenue().then(setData).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!data) return null
    // client-side refinement for the demo (real API accepts the same query params)
    let byEvent = data.byEvent
    let byDevice = data.byDevice
    let matrix = data.matrix || []
    if (eventId) { byEvent = byEvent.filter((e) => e.id === eventId); matrix = matrix.filter((c) => c.eventId === eventId) }
    if (deviceId) { byDevice = byDevice.filter((d) => d.id === deviceId); matrix = matrix.filter((c) => c.deviceId === deviceId) }
    return { ...data, byEvent, byDevice, matrix }
  }, [data, eventId, deviceId])

  if (error) return <div className="empty"><div className="empty-ico"><Icon name="alert" size={24} /></div><h3>Access denied</h3><p>{error}</p></div>
  if (!filtered) return <PageLoader />
  const d = filtered
  const wallet = d.wallet || null
  const payout = d.payout || {}
  const isAdmin = user.role === ROLES.ORG_ADMIN
  const matrixTotal = d.matrix.reduce((s, c) => s + c.total, 0)
  const matrixMax = d.matrix.reduce((m, c) => Math.max(m, c.total), 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Organization Revenue</div>
          <div className="page-sub">What your booths earn — print sales per event, per device. Read-only reporting.</div>
        </div>
        <div className="row gap-8">
          <Select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ width: 190, height: 36 }}>
            <option value="">All events</option>
            {d.events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
          <Select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} style={{ width: 170, height: 36 }}>
            <option value="">All booths</option>
            {d.devices.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </div>
      </div>

      <div className="stat-grid mb-16">
        <StatCard label="Total booth revenue" value={inr(d.total)} icon="revenue" foot="all paid prints, all time" />
        <StatCard label="This month" value={inr(d.thisMonth)} icon="calendar" iconBg="var(--hp-blue-soft)" iconColor="var(--hp-blue)" foot="September 2026" />
        <StatCard label="This financial year" value={inr(d.fy)} icon="zap" iconBg="var(--hp-green-soft)" iconColor="var(--hp-green-ink)" foot="Apr 2026 → Mar 2027" />
        <StatCard label="Payment health" value={`${Math.round((d.byStatus.paid / Math.max(1, d.byStatus.paid + d.byStatus.pending + d.byStatus.failed)) * 100)}%`} icon="check-circle" iconBg="var(--hp-purple-soft)" iconColor="var(--hp-purple)" foot={`${d.byStatus.paid} paid · ${d.byStatus.pending} pending · ${d.byStatus.failed} failed`} />
      </div>

      {/* ---- Wallet & payout routing ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.1fr) minmax(300px, 1fr)', gap: 14 }} className="mb-16 wallet-grid">
        <Card>
          <CardHead title="HappyPix wallet" sub={payout.payoutMode === 'upi' ? 'Direct UPI is ON — new payments skip the wallet' : 'Direct UPI paused — guest payments accrue here'}>
            <Chip tone={payout.payoutMode === 'upi' ? 'active' : 'info'} dot>{payout.payoutMode === 'upi' ? 'Paying to UPI' : 'Collecting to wallet'}</Chip>
          </CardHead>
          <div style={{ padding: '18px 20px' }}>
            <div className="row between gap-16" style={{ flexWrap: 'wrap' }}>
              <div>
                <div className="t11 muted fw7" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Available to withdraw</div>
                <div className="num" style={{ fontSize: 32, fontWeight: 780, letterSpacing: '-0.02em', marginTop: 2 }}>{wallet ? inr(wallet.balance) : <NA />}</div>
                <div className="t11 faint mt-4">
                  {wallet && wallet.processing > 0 ? `${inr(wallet.processing)} on its way to ${payout.upiId}` : payout.upiId ? `Payouts go to ${payout.upiId}` : 'No UPI ID saved yet'}
                </div>
              </div>
              {isAdmin ? (
                <Button
                  variant="primary"
                  icon="arrow-up-right"
                  disabled={!wallet || wallet.balance < (wallet.minWithdrawal || 500) || !payout.upiId}
                  onClick={() => setWithdrawOpen(true)}
                  title={!payout.upiId ? 'Add your UPI ID in Organization Defaults first' : wallet && wallet.balance < (wallet.minWithdrawal || 500) ? `Minimum withdrawal is ${inr(wallet.minWithdrawal || 500)}` : undefined}
                >
                  Withdraw
                </Button>
              ) : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
              <MiniStat label="Credited to wallet" value={wallet ? inr(wallet.credited) : null} />
              <MiniStat label="Withdrawn" value={wallet ? inr(wallet.withdrawn) : null} />
              <MiniStat label="Paid direct to UPI" value={wallet ? inr(wallet.viaUpi) : null} />
            </div>
            {!payout.upiId && isAdmin ? (
              <div className="t12 mt-12" style={{ color: 'var(--warn)' }}>
                <Icon name="alert" size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                Add your UPI ID in <a href="#/org/defaults" style={{ color: 'var(--hp-pink-deep)', fontWeight: 600 }}>Organization Defaults</a> to withdraw.
              </div>
            ) : null}
          </div>
          {wallet && wallet.withdrawals.length ? (
            <div style={{ borderTop: '1px solid var(--line-soft)' }}>
              <div className="t11 muted fw7" style={{ padding: '10px 20px 4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Recent withdrawals</div>
              {wallet.withdrawals.slice(0, 4).map((w) => (
                <div key={w.id} className="row between" style={{ padding: '8px 20px', borderBottom: '1px dashed var(--line-soft)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="t13 fw6">{inr(w.amount)} <span className="t11 muted fw6" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>· {w.reference}</span></div>
                    <div className="t11 faint">{w.status === 'paid' ? `Credited ${dateShort(w.paidAt)}` : `Requested ${relativeTime(w.requestedAt)}`} → {w.upiId}</div>
                  </div>
                  <Chip tone={WD_CHIP[w.status] || 'neutral'} dot>{w.status}</Chip>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHead title="Where the money went" sub="Paid transactions by settlement route" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '20px', flexWrap: 'wrap' }}>
            <Donut
              size={140}
              data={[
                { label: 'Direct to UPI', value: d.settlement?.upi || 0, color: 'var(--hp-green)' },
                { label: 'HappyPix wallet', value: d.settlement?.wallet || 0, color: 'var(--hp-purple)' },
              ]}
              centerLabel={inr((d.settlement?.upi || 0) + (d.settlement?.wallet || 0))}
              centerSub="paid"
            />
            <div style={{ flex: 1, minWidth: 160 }}>
              <ChartLegend
                items={[
                  { color: 'var(--hp-green)', label: 'Direct to your UPI', value: inr(d.settlement?.upi || 0) },
                  { color: 'var(--hp-purple)', label: 'Via HappyPix wallet', value: inr(d.settlement?.wallet || 0) },
                ]}
              />
              <p className="t11 faint mt-12" style={{ lineHeight: 1.5 }}>
                Route is decided by your <b>Receive money directly in UPI</b> switch at the moment each guest pays. Change it in Organization Defaults.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }} className="mb-16">
        <Card>
          <CardHead title="Monthly booth revenue" sub="Paid print sales, last 8 months" />
          <div style={{ padding: '14px 16px 8px' }}>
            <BarChart data={d.monthWise} height={185} formatValue={(v) => inr(v)} />
          </div>
        </Card>
        <Card>
          <CardHead title="Payment status" sub="All transactions" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '20px', flexWrap: 'wrap' }}>
            <Donut
              size={150}
              data={[
                { label: 'Paid', value: d.byStatus.paid, color: 'var(--hp-green)' },
                { label: 'Pending', value: d.byStatus.pending, color: '#B45309' },
                { label: 'Failed', value: d.byStatus.failed, color: 'var(--danger)' },
              ]}
              centerLabel={d.byStatus.paid + d.byStatus.pending + d.byStatus.failed}
              centerSub="transactions"
            />
            <ChartLegend
              items={[
                { color: 'var(--hp-green)', label: 'Paid', value: d.byStatus.paid },
                { color: '#B45309', label: 'Pending', value: d.byStatus.pending },
                { color: 'var(--danger)', label: 'Failed', value: d.byStatus.failed },
              ]}
            />
          </div>
        </Card>
      </div>

      <Card className="mb-16">
        <CardHead title="Revenue by event × booth" sub="How much each event earned from each booth — use the filters above to narrow">
          <span className="t12 num fw7">{inr(matrixTotal)}</span>
        </CardHead>
        <div className="table-wrap">
          <table className="hp-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Booth</th>
                <th className="t-right">Prints</th>
                <th className="t-right">Txns</th>
                <th className="t-right">To UPI</th>
                <th className="t-right">To wallet</th>
                <th className="t-right">Revenue</th>
                <th style={{ width: 120 }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {d.matrix.map((c) => (
                <tr key={`${c.eventId}|${c.deviceId}`}>
                  <td className="cell-main">{c.eventName}</td>
                  <td>
                    <div className="row gap-8"><Icon name="monitor" size={14} style={{ color: 'var(--faint)' }} /><span className="t13">{c.deviceName}</span></div>
                  </td>
                  <td className="t-right num">{c.prints}</td>
                  <td className="t-right num muted">{c.transactions}</td>
                  <td className="t-right num" style={{ color: 'var(--hp-green-ink)' }}>{c.viaUpi ? inr(c.viaUpi) : <span className="faint">—</span>}</td>
                  <td className="t-right num" style={{ color: 'var(--hp-purple)' }}>{c.viaWallet ? inr(c.viaWallet) : <span className="faint">—</span>}</td>
                  <td className="t-right num fw7">{inr(c.total)}</td>
                  <td>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ width: `${matrixMax ? Math.round((c.total / matrixMax) * 100) : 0}%`, height: '100%', background: 'var(--hp-pink)' }} />
                    </div>
                  </td>
                </tr>
              ))}
              {d.matrix.length === 0 ? <tr><td colSpan={8} className="t13 muted" style={{ textAlign: 'center', padding: 24 }}>No paid transactions for this combination.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHead title="Revenue by event" sub="Highest earning first" />
        <div className="table-wrap">
          <table className="hp-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th className="t-right">Prints</th>
                <th className="t-right">Transactions</th>
                <th className="t-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {d.byEvent.map((e) => (
                <tr key={e.id}>
                  <td className="cell-main">{e.name}</td>
                  <td><Chip tone={e.status === 'active' ? 'active' : e.status === 'upcoming' ? 'info' : e.status === 'paused' ? 'warn' : 'neutral'} dot>{e.status[0].toUpperCase() + e.status.slice(1)}</Chip></td>
                  <td className="t-right num">{e.prints}</td>
                  <td className="t-right num muted">{e.transactions}</td>
                  <td className="t-right num fw7">{inr(e.total)}</td>
                </tr>
              ))}
              {d.byEvent.length === 0 ? <tr><td colSpan={5} className="t13 muted" style={{ textAlign: 'center', padding: 24 }}>No events yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-16">
        <CardHead title="Revenue by booth" sub="Which device earns what" />
        <div className="table-wrap">
          <table className="hp-table">
            <thead>
              <tr>
                <th>Booth</th>
                <th>Status</th>
                <th className="t-right">Prints</th>
                <th className="t-right">Transactions</th>
                <th className="t-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {d.byDevice.map((x) => (
                <tr key={x.id}>
                  <td>
                    <div className="row gap-10">
                      <Icon name="monitor" size={15} style={{ color: x.online ? 'var(--hp-green-ink)' : 'var(--faint)' }} />
                      <span className="cell-main">{x.name}</span>
                    </div>
                  </td>
                  <td><Chip tone={x.online ? 'active' : 'neutral'} dot>{x.online ? 'Online' : 'Offline'}</Chip></td>
                  <td className="t-right num">{x.prints}</td>
                  <td className="t-right num muted">{x.transactions}</td>
                  <td className="t-right num fw7">{inr(x.total)}</td>
                </tr>
              ))}
              {d.byDevice.length === 0 ? <tr><td colSpan={5} className="t13 muted" style={{ textAlign: 'center', padding: 24 }}>No devices yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        wallet={wallet}
        upiId={payout.upiId}
        onDone={(w) => { toast(`Withdrawal of ${inr(w.amount)} requested — ${w.reference}`, 'success'); setWithdrawOpen(false); load() }}
      />
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
      <div className="t11 muted">{label}</div>
      <div className="num fw7 t13" style={{ marginTop: 2 }}>{value == null ? <NA /> : value}</div>
    </div>
  )
}

// Withdraw from the wallet to the org UPI ID. Min ₹500, ≤ balance.
function WithdrawModal({ open, onClose, wallet, upiId, onDone }) {
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const min = wallet?.minWithdrawal || 500
  const max = wallet?.balance || 0
  const n = Math.round(Number(amount) || 0)
  const valid = n >= min && n <= max
  useEffect(() => { if (open) { setAmount(''); setError('') } }, [open])

  const submit = async (e) => {
    e?.preventDefault()
    if (n < min) return setError(`Minimum withdrawal is ${inr(min)}.`)
    if (n > max) return setError(`You can withdraw up to ${inr(max)}.`)
    setBusy(true); setError('')
    try {
      const r = await api.org.withdraw(n)
      onDone(r.withdrawal)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Withdraw from wallet"
      sub="Money is credited to the bank account linked to your organization UPI ID."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={busy || !valid}>{busy ? 'Requesting…' : `Withdraw ${valid ? inr(n) : ''}`}</Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <KV k="Available balance" v={inr(max)} />
        <KV k="Credited to" v={upiId} mono />
        <div style={{ height: 12 }} />
        <Field label="Amount to withdraw (₹)" required hint={`Minimum ${inr(min)} · whole rupees · up to ${inr(max)}`}>
          <TextInput
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(min)}
            autoFocus
            style={{ fontSize: 18, fontWeight: 700 }}
          />
        </Field>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {[min, Math.floor(max / 2), max].filter((v, i, a) => v >= min && v <= max && a.indexOf(v) === i).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(String(v))}
              style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${n === v ? 'var(--hp-pink)' : 'var(--line)'}`, background: n === v ? 'var(--hp-pink-soft)' : 'var(--surface)', color: n === v ? 'var(--hp-pink-deep)' : 'var(--ink-2)' }}
            >
              {v === max ? `All · ${inr(v)}` : v === min ? `Min · ${inr(v)}` : `Half · ${inr(v)}`}
            </button>
          ))}
        </div>
        {error ? <div className="input-error mt-12">{error}</div> : null}
        <p className="t11 faint mt-12" style={{ lineHeight: 1.5 }}>
          <Icon name="info" size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          Payouts are processed by HappyPix within 1 business day and appear in your recent withdrawals as “processing” until the bank confirms.
        </p>
      </form>
    </Modal>
  )
}
