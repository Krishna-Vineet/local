import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Button, Card, Chip, Drawer, EmptyState, Field, Modal, PageLoader, Tabs, TextArea, WarnBanner } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { dateMed, relativeTime } from '../../lib/format.js'
import {
  MessageComposer, SUPPORT_CATEGORIES, SUPPORT_PRIORITY, SUPPORT_STATUS,
  SupportDecision, SupportMeta, SupportThread,
} from '../../components/PlatformSupportThread.jsx'

export default function PlatformSupport() {
  const { toast } = useApp()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('tickets')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewId, setReviewId] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [request, setRequest] = useState(null)
  const [denyReason, setDenyReason] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolution, setResolution] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.platform.supportRequests()
    .then(setData)
    .catch((e) => toast(e.message, 'error'))

  useEffect(() => { load() }, [])

  const pending = useMemo(() => (data?.requests || []).filter((row) => row.status === 'new'), [data])
  const tickets = useMemo(() => (data?.requests || []).filter((row) => ['open', 'in_progress', 'resolved'].includes(row.status)), [data])
  const denied = useMemo(() => (data?.requests || []).filter((row) => row.status === 'denied'), [data])
  const review = pending.find((row) => row.id === reviewId) || pending[0] || null

  useEffect(() => {
    if (reviewOpen && !reviewId && pending[0]) setReviewId(pending[0].id)
  }, [reviewOpen, reviewId, pending])

  const openTicket = async (id) => {
    setOpenId(id)
    setRequest(null)
    try {
      const result = await api.platform.supportRequest(id)
      setRequest(result.request)
    } catch (e) {
      toast(e.message, 'error')
      setOpenId(null)
    }
  }

  const accept = async () => {
    if (!review) return
    setBusy(true)
    try {
      const result = await api.platform.acceptSupportRequest(review.id, '')
      toast(`${result.request.ticketNo} created — the shared conversation is now open`)
      setReviewId(null)
      setDenyReason('')
      await load()
      if (pending.length <= 1) setReviewOpen(false)
      openTicket(review.id)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const deny = async () => {
    if (!review || !denyReason.trim()) return
    setBusy(true)
    try {
      await api.platform.denySupportRequest(review.id, denyReason.trim())
      toast('Request denied; the organization can see the reason and re-apply', 'info')
      setReviewId(null)
      setDenyReason('')
      await load()
      if (pending.length <= 1) setReviewOpen(false)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const send = async (body) => {
    if (!openId) return false
    setBusy(true)
    try {
      const result = await api.platform.replySupportTicket(openId, body)
      setRequest(result.request)
      load()
      return true
    } catch (e) {
      toast(e.message, 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const resolve = async () => {
    if (!openId || !resolution.trim()) return
    setBusy(true)
    try {
      const result = await api.platform.resolveSupportTicket(openId, resolution.trim())
      setRequest(result.request)
      setResolving(false)
      setResolution('')
      toast('Ticket resolved. Only platform staff can reopen it.')
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
      const result = await api.platform.reopenSupportTicket(openId, '')
      setRequest(result.request)
      toast('Ticket reopened', 'info')
      load()
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
          <div className="page-title">Organization Support</div>
          <div className="page-sub">Review organization requests, turn accepted requests into tickets, and work together in a shared image-enabled conversation.</div>
        </div>
      </div>

      {pending.length ? (
        <WarnBanner
          tone="pink"
          icon="bell"
          action={
            <Button size="sm" variant="primary" icon="mail" onClick={() => setReviewOpen(true)}>
              Review now · {pending.length}
            </Button>
          }
        >
          <b>{pending.length} request{pending.length === 1 ? '' : 's'} awaiting review.</b> Accept to create a ticket, or deny with a reason the organization can act on.
        </WarnBanner>
      ) : null}

      <Tabs
        tabs={[
          { id: 'tickets', label: 'Accepted tickets', icon: 'headset', count: tickets.length },
          { id: 'denied', label: 'Denied archive', icon: 'log', count: denied.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <Card className="mt-16">
        {!data ? <PageLoader /> : (
          <SupportTable rows={tab === 'tickets' ? tickets : denied} onOpen={openTicket} archive={tab === 'denied'} />
        )}
      </Card>

      <Modal
        open={reviewOpen}
        onClose={() => { setReviewOpen(false); setDenyReason('') }}
        title={`New support requests · ${pending.length}`}
        sub="This review inbox is separate from accepted tickets and the denied archive."
        width="xwide"
      >
        {!data ? <PageLoader /> : !pending.length ? (
          <EmptyState icon="check-circle" title="Review inbox is clear" message="New organization requests will appear here." />
        ) : (
          <div className="support-review-grid">
            <div className="support-review-list">
              {pending.map((row) => (
                <button key={row.id} type="button" className={review?.id === row.id ? 'active' : ''} onClick={() => { setReviewId(row.id); setDenyReason('') }}>
                  <div className="t12 fw6 ellipsis">{row.subject}</div>
                  <div className="t11 muted ellipsis">{row.organization?.name} · {relativeTime(row.updatedAt)}</div>
                </button>
              ))}
            </div>
            <div style={{ minWidth: 0 }}>
              {review ? (
                <>
                  <SupportMeta request={review} />
                  <h3 style={{ fontSize: 17, margin: '14px 0 4px' }}>{review.subject}</h3>
                  <div className="t12 muted">{review.organization?.name} · raised by {review.creator?.name} · {dateMed(review.createdAt)}</div>
                  <div className="t11 fw7 faint mt-16" style={{ letterSpacing: '.07em', textTransform: 'uppercase' }}>Original request</div>
                  <div className="card card-pad mt-8" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
                    <SupportThread request={{ ...review, messages: review.messages.slice(0, 1) }} mineSide="platform" />
                  </div>
                  {review.reapplyCount && review.lastReapplication ? (
                    <div className="mt-16">
                      <WarnBanner tone="info" icon="refresh">
                        <b>Re-application reason</b>
                        <div className="t11" style={{ marginTop: 3, fontWeight: 450 }}>
                          Re-applied {review.reapplyCount} time{review.reapplyCount === 1 ? '' : 's'} · latest response shown below
                        </div>
                      </WarnBanner>
                      <div className="card card-pad mt-8" style={{ boxShadow: 'none', borderColor: 'rgba(56,113,193,.25)' }}>
                        <SupportThread request={{ ...review, messages: [review.lastReapplication] }} mineSide="platform" />
                      </div>
                    </div>
                  ) : review.reapplyCount ? (
                    <div className="card card-pad mt-16" style={{ boxShadow: 'none', borderColor: 'rgba(56,113,193,.25)' }}>
                      <div className="t12 fw7" style={{ color: 'var(--hp-blue)', marginBottom: 10 }}>Re-application reason</div>
                      <SupportThread request={{ ...review, messages: review.messages.slice(-1) }} mineSide="platform" />
                    </div>
                  ) : null}
                  <div className="mt-16" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
                    <Field label="Reason required when denying" hint="The organization sees this text and may re-apply with a new message.">
                      <TextArea value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder="Explain why this request is being denied…" />
                    </Field>
                    <div className="row between gap-12">
                      <Button variant="danger" icon="ban" onClick={deny} disabled={busy || !denyReason.trim()}>Deny request</Button>
                      <Button variant="primary" icon="check" onClick={accept} disabled={busy}>Accept & create ticket</Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      <Drawer
        open={!!openId}
        onClose={() => { setOpenId(null); setRequest(null) }}
        title={request?.subject || 'Support ticket'}
        sub={request ? `${request.ticketNo || 'Request'} · ${request.organization?.name || 'Organization'}` : ''}
        icon="headset"
        footer={request && ['open', 'in_progress'].includes(request.status) ? (
          <div>
            <MessageComposer onSend={send} busy={busy} placeholder="Reply to the organization; images can be attached…" />
            <Button variant="outline" icon="check-circle" onClick={() => setResolving(true)} disabled={busy} style={{ width: '100%', marginTop: 12 }}>Mark resolved</Button>
          </div>
        ) : request?.status === 'resolved' ? (
          <Button variant="primary" icon="refresh" onClick={reopen} disabled={busy} style={{ width: '100%' }}>Reopen ticket</Button>
        ) : null}
      >
        {!request ? <PageLoader /> : (
          <div>
            <SupportMeta request={request} />
            <div className="t12 muted mt-12">Raised by {request.creator?.name} on {dateMed(request.createdAt)}</div>
            <div className="mt-16"><SupportDecision request={request} /></div>
            <div className="mt-16"><SupportThread request={request} mineSide="platform" /></div>
          </div>
        )}
      </Drawer>

      <Modal
        open={resolving}
        onClose={() => { setResolving(false); setResolution('') }}
        title={`Resolve ${request?.ticketNo || 'ticket'}`}
        sub="The organization can read this decision but cannot reopen the ticket."
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolving(false)}>Cancel</Button>
            <Button variant="primary" onClick={resolve} disabled={busy || !resolution.trim()}>Resolve ticket</Button>
          </>
        }
      >
        <Field label="Resolution" required>
          <TextArea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Describe what was decided or fixed…" />
        </Field>
      </Modal>
    </div>
  )
}

function SupportTable({ rows, onOpen, archive }) {
  if (!rows.length) {
    return <EmptyState icon={archive ? 'log' : 'headset'} title={archive ? 'No denied requests' : 'No accepted tickets'} message={archive ? 'Denied requests are kept here with their reason.' : 'Accept a new request to create the first ticket.'} />
  }
  return (
    <div className="table-wrap">
      <table className="hp-table">
        <thead><tr><th>{archive ? 'Request' : 'Ticket'}</th><th>Organization</th><th>Priority</th><th>Status</th><th>Updated</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => {
            const status = SUPPORT_STATUS[row.status]
            const priority = SUPPORT_PRIORITY[row.priority]
            return (
              <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(row.id)}>
                <td><div className="cell-main">{row.subject}</div><div className="cell-sub">{row.ticketNo || SUPPORT_CATEGORIES[row.category]}</div></td>
                <td className="t13">{row.organization?.name || '—'}</td>
                <td><Chip tone={priority?.tone || 'neutral'}>{priority?.label || row.priority}</Chip></td>
                <td><Chip tone={status?.tone || 'neutral'} dot>{status?.label || row.status}</Chip></td>
                <td className="t12 muted">{relativeTime(row.updatedAt)}</td>
                <td className="t-right"><Icon name="chevron-right" size={15} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
