import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Card, Chip, PageLoader, Select, Button, Drawer, TextArea, EmptyState } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { relativeTime, dateMed, initials, avatarColor, inr } from '../../lib/format.js'
import { TICKET_STATUSES, TICKET_PRIORITIES, FILTER_BY_ID } from '../../lib/plans.js'

const CATEGORY_ICONS = { device: 'monitor', payment: 'wallet', photo: 'image', event: 'calendar', general: 'headset' }

export default function Support() {
  const { toast } = useApp()
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [openId, setOpenId] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    const q = new URLSearchParams()
    if (status) q.set('status', status)
    if (priority) q.set('priority', priority)
    api.org.tickets(q.toString() ? '?' + q : '').then(setData).catch((e) => toast(e.message, 'error'))
  }, [status, priority])

  useEffect(() => { load() }, [load])

  const open = (id) => {
    setOpenId(id)
    setTicket(null)
    api.org.ticket(id).then((r) => setTicket(r.ticket)).catch((e) => { toast(e.message, 'error'); setOpenId(null) })
  }

  const sendReply = async () => {
    if (!reply.trim() || !openId) return
    setBusy(true)
    try {
      const r = await api.org.replyTicket(openId, reply.trim())
      setTicket(r.ticket)
      setReply('')
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const resolve = async () => {
    if (!openId) return
    setBusy(true)
    try {
      const note = reply.trim() || undefined
      const r = await api.org.resolveTicket(openId, note)
      setTicket(r.ticket)
      setReply('')
      toast('Ticket marked resolved')
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const reopen = async () => {
    if (!openId) return
    setBusy(true)
    try {
      const r = await api.org.reopenTicket(openId)
      setTicket(r.ticket)
      toast('Ticket reopened', 'info')
      load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Guest Support</div>
          <div className="page-sub">Guest issues raised from your booths and download pages. Organization-to-HappyPix requests live in HappyPix Support.</div>
        </div>
      </div>

      <Card>
        <div className="row wrap gap-12" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
          <div className="row gap-8">
            {['', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
              <button
                key={s || 'all'}
                className={`chip${status === s ? ' chip-pink' : ' chip-neutral'}`}
                style={{ height: 28, cursor: 'pointer', border: 'none', fontSize: 12 }}
                onClick={() => setStatus(s)}
              >
                {s ? TICKET_STATUSES[s].label : 'All'}
                {data ? ` · ${s ? data.counts[s] : Object.values(data.counts).reduce((a, b) => a + b, 0)}` : ''}
              </button>
            ))}
          </div>
          <div className="grow" />
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ width: 130, height: 34, fontSize: 12.5 }}>
            <option value="">All priorities</option>
            {Object.entries(TICKET_PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>

        {!data ? (
          <PageLoader />
        ) : data.tickets.length === 0 ? (
          <EmptyState icon="headset" title="No tickets here" message="When guests raise an issue from a booth or download page, it lands in this inbox." />
        ) : (
          <div className="table-wrap">
            <table className="hp-table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Event</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Guest</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.tickets.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => open(t.id)}>
                    <td>
                      <div className="row gap-10">
                        <span className="stat-ico" style={{ width: 30, height: 30, background: 'var(--surface-2)', color: 'var(--muted)' }}>
                          <Icon name={CATEGORY_ICONS[t.category] || 'headset'} size={15} />
                        </span>
                        <div>
                          <div className="cell-main">{t.subject}</div>
                          <div className="cell-sub">{t.messages?.length || 0} message(s)</div>
                        </div>
                      </div>
                    </td>
                    <td className="t13">{t.event?.name || '—'}</td>
                    <td><Chip tone={TICKET_PRIORITIES[t.priority].chip.replace('chip-', '')}>{TICKET_PRIORITIES[t.priority].label}</Chip></td>
                    <td><Chip tone={TICKET_STATUSES[t.status].chip.replace('chip-', '')} dot>{TICKET_STATUSES[t.status].label}</Chip></td>
                    <td>
                      <div className="t13">{t.guest?.name || '—'}</div>
                      {t.guest?.contact ? <div className="t11 faint">{t.guest.contact}</div> : null}
                    </td>
                    <td className="t12 muted">{relativeTime(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer
        open={!!openId}
        onClose={() => { setOpenId(null); setReply('') }}
        title={ticket?.subject || 'Ticket'}
        sub={ticket ? `${ticket.event?.name || 'General'}${ticket.device ? ` · ${ticket.device.name}` : ''} · raised ${dateMed(ticket.createdAt)}` : ''}
        icon="headset"
        footer={
          ticket ? (
            <div>
              <div className="row gap-12">
                <TextArea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={ticket.status === 'resolved' || ticket.status === 'closed' ? 'Add a note…' : 'Write a reply or note for the conversation…'}
                  style={{ flex: 1 }}
                />
                <Button variant="primary" icon="send" onClick={sendReply} disabled={busy || !reply.trim()}>Send</Button>
              </div>
              <div className="row gap-12 mt-12">
                {ticket.status === 'resolved' || ticket.status === 'closed' ? (
                  <Button variant="outline" icon="refresh" onClick={reopen} disabled={busy} style={{ flex: 1 }}>Reopen ticket</Button>
                ) : (
                  <>
                    <Button variant="outline" style={{ flex: 1 }} onClick={resolve} disabled={busy}>
                      <Icon name="check" size={15} /> Mark resolved {reply.trim() ? '(with note)' : ''}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : null
        }
      >
        {!ticket ? (
          <div className="page-load" style={{ padding: '60px 0' }}><span className="spinner" /></div>
        ) : (
          <div>
            <div className="row wrap gap-8 mb-16">
              <Chip tone={TICKET_STATUSES[ticket.status].chip.replace('chip-', '')} dot>{TICKET_STATUSES[ticket.status].label}</Chip>
              <Chip tone={TICKET_PRIORITIES[ticket.priority].chip.replace('chip-', '')}>{TICKET_PRIORITIES[ticket.priority].label} priority</Chip>
              <Chip tone="neutral">{ticket.category}</Chip>
              {ticket.device ? <Chip tone="info">Booth: {ticket.device.name}</Chip> : null}
            </div>

            <SessionContext ticket={ticket} />

            <div>
              {ticket.messages.map((m) => {
                const mine = m.author.includes('Organization')
                return (
                  <div key={m.id} className="thread-msg" style={mine ? { flexDirection: 'row-reverse' } : undefined}>
                    <span className="avatar" style={{ width: 28, height: 28, fontSize: 10.5, background: mine ? 'var(--hp-pink)' : avatarColor(m.author), flex: 'none' }}>
                      {initials(mine ? 'Me' : m.author)}
                    </span>
                    <div style={{ maxWidth: '88%' }}>
                      <div className="thread-meta" style={mine ? { textAlign: 'right' } : undefined}>{m.author} · {relativeTime(m.at)}</div>
                      <div className={`thread-bubble${mine ? ' mine' : ''}`}>{m.text}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {ticket.resolution && (ticket.status === 'resolved' || ticket.status === 'closed') ? (
              <div className="card card-pad mt-16" style={{ background: 'var(--hp-green-soft)', borderColor: 'rgba(111,168,43,.25)' }}>
                <div className="row gap-8 t12 fw7 mb-8" style={{ color: 'var(--hp-green-ink)' }}>
                  <Icon name="check-circle" size={14} /> RESOLUTION
                </div>
                <p className="t13" style={{ color: 'var(--hp-green-ink)' }}>{ticket.resolution}</p>
              </div>
            ) : null}
          </div>
        )}
      </Drawer>
    </div>
  )
}

// ---------------- Booth session context ----------------
// The booth app records the guest's session and attaches it when a ticket is
// raised (after session end / after payment): guest phone number, slot they
// picked, camera clicks, what they customised, and the payment transaction.
// The CRM just displays this snapshot — it is created by the booth via
// POST /api/booth/tickets.

const timeStr = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  let h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`
}
const sameDay = (a, b) => {
  const x = new Date(a); const y = new Date(b)
  return x && y && x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}
const slotRange = (slot) => {
  if (!slot) return null
  if (slot.start && slot.end && sameDay(slot.start, slot.end)) return `${timeStr(slot.start)} – ${timeStr(slot.end)}`
  if (slot.start && slot.end) return `${dateMed(slot.start)} → ${timeStr(slot.end)}`
  return null
}
const PAY_CHIP = { paid: 'active', pending: 'warn', failed: 'danger' }

function SessionContext({ ticket }) {
  const s = ticket.session
  if (!s) {
    return (
      <div className="card card-pad mb-16" style={{ background: 'var(--surface-2)', borderColor: 'var(--line-soft)' }}>
        <div className="row gap-10">
          <span className="avatar" style={{ width: 30, height: 30, fontSize: 11, background: avatarColor(ticket.guest?.name || '?') }}>{initials(ticket.guest?.name || '?')}</span>
          <div>
            <div className="t13 fw6">{ticket.guest?.name || 'Guest'}</div>
            <div className="t11 muted">{ticket.guest?.contact || 'No contact provided'}</div>
          </div>
        </div>
        <p className="t11 faint mt-12" style={{ lineHeight: 1.5 }}>
          No booth session attached to this ticket — raised outside a booth session.
        </p>
      </div>
    )
  }

  const pkg = s.package || {}
  const pay = s.payment || null
  const duration = s.startedAt && s.endedAt ? Math.max(1, Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 60000)) : null
  const filters = (s.filtersUsed || []).map((f) => FILTER_BY_ID[f]?.label || f)

  return (
    <div className="card mb-16" style={{ overflow: 'hidden' }}>
      {/* Guest + phone (what the booth collected when raising the ticket) */}
      <div className="row between gap-12 wrap" style={{ padding: '13px 16px', borderBottom: '1px solid var(--line-soft)', background: 'var(--surface-2)' }}>
        <div className="row gap-10">
          <span className="avatar" style={{ width: 34, height: 34, fontSize: 12, background: avatarColor(ticket.guest?.name || s.phone) }}>{initials(ticket.guest?.name || '?')}</span>
          <div>
            <div className="t13 fw6">{ticket.guest?.name || 'Guest'}</div>
            <div className="t11 muted">Guest phone from the booth session</div>
          </div>
        </div>
        {s.phone ? (
          <a className="btn btn-sm btn-outline" href={`tel:${s.phone.replace(/[^+\d]/g, '')}`} title="Call the guest">
            <Icon name="phone" size={13} /> {s.phone}
          </a>
        ) : (
          <Chip tone="neutral">No phone</Chip>
        )}
      </div>

      {/* Session snapshot */}
      <div style={{ padding: '13px 16px' }}>
        <div className="row between wrap gap-8" style={{ marginBottom: 8 }}>
          <div className="sess-block-title" style={{ marginBottom: 0 }}>
            <Icon name="camera" size={13} /> Booth session {s.id ? <span className="num" style={{ letterSpacing: '0.04em' }}>· {s.id}</span> : null}
          </div>
          {duration ? <span className="t11 faint num">{duration} min · ended {relativeTime(s.endedAt)}</span> : null}
        </div>

        <div className="sess-grid">
          {/* Slot the guest picked — label AND time shown separately */}
          <div>
            <KV2 k="Slot picked" v={s.slot?.label || '—'} />
            <KV2 k="Slot time" v={slotRange(s.slot) || '—'} />
            {s.event ? <KV2 k="Event" v={s.event.name} /> : null}
            {s.device ? <KV2 k="Booth" v={s.device.name} /> : null}
          </div>
          {/* What they customised + clicked */}
          <div>
            <KV2 k="Camera clicks" v={`${s.cameraClicks ?? '—'} click${s.cameraClicks === 1 ? '' : 's'}`} />
            <KV2 k="Template used" v={pkg.templateName || '—'} />
            <KV2 k="Frame" v={pkg.frame || '—'} />
            <KV2 k="Prints" v={pkg.prints != null ? `${pkg.prints} print${pkg.prints === 1 ? '' : 's'}${pkg.digitalCopy ? ' + digital copy' : ''}` : '—'} />
          </div>
        </div>

        {filters.length ? (
          <div className="row wrap gap-6" style={{ marginTop: 9 }}>
            <span className="t11 faint">Filters used:</span>
            {filters.map((f) => <Chip key={f} tone="purple">{f}</Chip>)}
          </div>
        ) : null}

        {/* Payment transaction */}
        <div style={{ marginTop: 11, padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--line-soft)' }}>
          <div className="sess-block-title"><Icon name="wallet" size={12} /> Payment</div>
          {pay && (pay.utr || pay.amount != null) ? (
            <div className="row between wrap gap-8">
              <div className="row gap-10 wrap">
                <span className="t12 muted">Txn&nbsp;
                  {pay.utr
                    ? <b className="num" style={{ fontSize: 12.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{pay.utr}</b>
                    : <b style={{ fontSize: 12.5 }}>no UTR</b>}
                </span>
                <span className="t12 muted">Amount&nbsp;<b className="num" style={{ color: 'var(--ink)' }}>{inr(pay.amount)}</b></span>
                {pay.method ? <span className="t12 muted">via&nbsp;<b style={{ color: 'var(--ink)' }}>{pay.method}</b></span> : null}
                {pay.status === 'paid' ? (
                  <span className="t12 muted">received in&nbsp;
                    <b style={{ color: pay.settlement === 'wallet' ? 'var(--hp-purple)' : 'var(--hp-green-ink)' }}>
                      {pay.settlement === 'wallet' ? 'HappyPix wallet' : pay.settlement === 'upi' ? 'your UPI (direct)' : 'Not available'}
                    </b>
                  </span>
                ) : null}
              </div>
              <Chip tone={PAY_CHIP[pay.status] || 'neutral'} dot>{pay.status || 'unknown'}</Chip>
            </div>
          ) : (
            <span className="t12 faint">No payment in this session.</span>
          )}
        </div>
      </div>
    </div>
  )
}

function KV2({ k, v }) {
  return (
    <div className="sess-kv">
      <span className="k">{k}</span>
      <span className="v ellipsis" title={String(v)}>{v}</span>
    </div>
  )
}
