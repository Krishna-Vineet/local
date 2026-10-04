import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Button, Card, Chip, Drawer, EmptyState, Field, Modal, PageLoader, Select, Tabs, TextInput, WarnBanner } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { dateMed, relativeTime } from '../../lib/format.js'
import {
  MessageComposer, SUPPORT_CATEGORIES, SUPPORT_PRIORITY, SUPPORT_STATUS,
  SupportDecision, SupportMeta, SupportThread,
} from '../../components/PlatformSupportThread.jsx'

export default function PlatformSupport() {
  const { toast } = useApp()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('all')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ subject: '', category: 'technical', priority: 'medium' })
  const [openId, setOpenId] = useState(null)
  const [request, setRequest] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.org.platformSupportRequests()
    .then(setData)
    .catch((e) => toast(e.message, 'error'))

  useEffect(() => { load() }, [])

  const rows = useMemo(() => {
    const all = data?.requests || []
    if (tab === 'active') return all.filter((row) => ['open', 'in_progress'].includes(row.status))
    if (tab === 'decisions') return all.filter((row) => ['denied', 'resolved'].includes(row.status))
    return all
  }, [data, tab])

  const openTicket = async (id) => {
    setOpenId(id)
    setRequest(null)
    try {
      const result = await api.org.platformSupportRequest(id)
      setRequest(result.request)
    } catch (e) {
      toast(e.message, 'error')
      setOpenId(null)
    }
  }

  const create = async ({ message, images }) => {
    if (!draft.subject.trim()) {
      toast('Add a subject before submitting.', 'error')
      return false
    }
    setBusy(true)
    try {
      const result = await api.org.createPlatformSupportRequest({
        subject: draft.subject.trim(), category: draft.category, priority: draft.priority, message, images,
      })
      toast('Request sent to the HappyPix platform team')
      setCreating(false)
      setDraft({ subject: '', category: 'technical', priority: 'medium' })
      load()
      openTicket(result.request.id)
      return true
    } catch (e) {
      toast(e.message, 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const send = async (body) => {
    if (!openId) return false
    setBusy(true)
    try {
      const result = await api.org.replyPlatformSupportTicket(openId, body)
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

  const reapply = async ({ message, images }) => {
    if (!openId || !message.trim()) return false
    setBusy(true)
    try {
      const result = await api.org.reapplyPlatformSupportRequest(openId, { message: message.trim(), images })
      setRequest(result.request)
      toast('Request re-applied with your new message')
      load()
      return true
    } catch (e) {
      toast(e.message, 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const activeCount = (data?.requests || []).filter((row) => ['open', 'in_progress'].includes(row.status)).length
  const decisionCount = (data?.requests || []).filter((row) => ['denied', 'resolved'].includes(row.status)).length

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">HappyPix Support</div>
          <div className="page-sub">Raise an organization-level issue for the HappyPix platform team. Every team member in your organization can participate.</div>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Raise an issue</Button>
      </div>

      <WarnBanner tone="info" icon="info">
        New issues are reviewed before becoming tickets. If denied, you will see a reason and can re-apply with a new text message. Only HappyPix can resolve or reopen accepted tickets.
      </WarnBanner>

      <Tabs
        tabs={[
          { id: 'all', label: 'All requests', icon: 'mail', count: data?.requests.length || 0 },
          { id: 'active', label: 'Active tickets', icon: 'headset', count: activeCount },
          { id: 'decisions', label: 'Decisions', icon: 'check-circle', count: decisionCount },
        ]}
        active={tab}
        onChange={setTab}
      />

      <Card className="mt-16">
        {!data ? <PageLoader /> : rows.length === 0 ? (
          <EmptyState
            icon="headset"
            title="No support requests here"
            message="Raise an issue when your organization needs help from HappyPix."
            action={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Raise an issue</Button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="hp-table">
              <thead><tr><th>Issue</th><th>Priority</th><th>Status</th><th>Messages</th><th>Updated</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const status = SUPPORT_STATUS[row.status]
                  const priority = SUPPORT_PRIORITY[row.priority]
                  return (
                    <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => openTicket(row.id)}>
                      <td><div className="cell-main">{row.subject}</div><div className="cell-sub">{row.ticketNo || SUPPORT_CATEGORIES[row.category]}</div></td>
                      <td><Chip tone={priority?.tone || 'neutral'}>{priority?.label || row.priority}</Chip></td>
                      <td><Chip tone={status?.tone || 'neutral'} dot>{status?.label || row.status}</Chip></td>
                      <td className="t13">{row.messages?.length || 0}</td>
                      <td className="t12 muted">{relativeTime(row.updatedAt)}</td>
                      <td className="t-right"><Icon name="chevron-right" size={15} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Raise an issue with HappyPix"
        sub="This starts as a review request. Acceptance creates a numbered support ticket."
        width="wide"
      >
        <Field label="Subject" required>
          <TextInput value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Briefly describe what you need help with" maxLength={160} />
        </Field>
        <div className="form-grid-2">
          <Field label="Category" required>
            <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {Object.entries(SUPPORT_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Priority" required>
            <Select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
              {Object.entries(SUPPORT_PRIORITY).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="What happened, or what do you need?" required hint="Include the steps already tried. You can attach up to 4 screenshots.">
          <MessageComposer onSend={create} busy={busy} requireText buttonLabel="Submit for review" placeholder="Explain the issue or request in enough detail for HappyPix to review it…" />
        </Field>
      </Modal>

      <Drawer
        open={!!openId}
        onClose={() => { setOpenId(null); setRequest(null) }}
        title={request?.subject || 'Support request'}
        sub={request ? `${request.ticketNo || 'Pending request'} · raised ${dateMed(request.createdAt)}` : ''}
        icon="headset"
        footer={request && ['open', 'in_progress'].includes(request.status) ? (
          <MessageComposer onSend={send} busy={busy} placeholder="Reply to HappyPix; attach screenshots if useful…" />
        ) : request?.status === 'denied' ? (
          <div>
            <div className="t12 fw6 mb-8">Re-apply with new information</div>
            <MessageComposer onSend={reapply} busy={busy} requireText buttonLabel="Re-apply" placeholder="Explain what changed or add the information requested in the denial reason…" />
          </div>
        ) : null}
      >
        {!request ? <PageLoader /> : (
          <div>
            <SupportMeta request={request} />
            <div className="t12 muted mt-12">Raised by {request.creator?.name} on {dateMed(request.createdAt)}</div>
            <div className="mt-16"><SupportDecision request={request} /></div>
            <div className="mt-16"><SupportThread request={request} mineSide="org" /></div>
            {request.status === 'resolved' ? (
              <p className="t12 faint" style={{ textAlign: 'center', padding: '10px 0' }}>This ticket is read-only. Contact remains visible to your whole organization team.</p>
            ) : null}
          </div>
        )}
      </Drawer>
    </div>
  )
}
