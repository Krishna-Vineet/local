import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import {
  Avatar, Button, Card, Chip, ConfirmDialog, Drawer, EmptyState,
  Field, IconButton, KV, PageLoader, SearchInput, Select, StatCard, Tabs, TextArea,
} from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { dateMed, dateShort, relativeTime } from '../../lib/format.js'

const STATUS_META = {
  new: { label: 'New', tone: 'pink', dot: true },
  contacted: { label: 'Contacted', tone: 'info', dot: true },
  closed: { label: 'Closed', tone: 'neutral', dot: false },
}

const TYPE_META = {
  demo: { label: 'Book a Demo', tone: 'purple', icon: 'calendar' },
  hardware: { label: 'Hardware / Pre-order', tone: 'warn', icon: 'printer' },
  support: { label: 'Support', tone: 'info', icon: 'headset' },
  contact: { label: 'General Inquiry', tone: 'neutral', icon: 'mail' },
}

export default function WebsiteLeads() {
  const { toast } = useApp()
  const [data, setData] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState('new')
  const [typeDraft, setTypeDraft] = useState('contact')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = () => {
    api.platform.leads()
      .then((res) => {
        setData(res)
        if (selected) {
          const fresh = (res.leads || []).find((l) => l.id === selected.id)
          if (fresh) {
            setSelected(fresh)
          }
        }
      })
      .catch((e) => toast(e.message || 'Could not load website leads', 'error'))
  }

  useEffect(() => { load() }, [])

  const openLead = (lead) => {
    setSelected(lead)
    setNotesDraft(lead.notes || '')
    setStatusDraft(lead.status || 'new')
    setTypeDraft(lead.type || 'contact')
  }

  const leads = data?.leads || []
  const counts = data?.counts || {
    total: leads.length,
    new: leads.filter((l) => l.status === 'new').length,
    contacted: leads.filter((l) => l.status === 'contacted').length,
    closed: leads.filter((l) => l.status === 'closed').length,
    demo: leads.filter((l) => l.type === 'demo').length,
    hardware: leads.filter((l) => l.type === 'hardware').length,
    support: leads.filter((l) => l.type === 'support').length,
    contact: leads.filter((l) => l.type === 'contact').length,
  }

  const filtered = useMemo(() => {
    let rows = leads
    if (statusFilter !== 'all') {
      rows = rows.filter((l) => (l.status || 'new') === statusFilter)
    }
    if (typeFilter !== 'all') {
      rows = rows.filter((l) => (l.type || 'contact') === typeFilter)
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      rows = rows.filter((l) =>
        (l.name || '').toLowerCase().includes(s) ||
        (l.email || '').toLowerCase().includes(s) ||
        (l.phone || '').toLowerCase().includes(s) ||
        (l.company || '').toLowerCase().includes(s) ||
        (l.message || '').toLowerCase().includes(s) ||
        (l.notes || '').toLowerCase().includes(s),
      )
    }
    return rows
  }, [leads, statusFilter, typeFilter, search])

  const quickStatusChange = async (lead, nextStatus) => {
    try {
      const res = await api.platform.updateLead(lead.id, { status: nextStatus })
      toast(`Marked ${lead.name} as ${STATUS_META[nextStatus]?.label || nextStatus}`)
      if (selected?.id === lead.id) {
        setSelected(res.lead)
        setStatusDraft(res.lead.status)
      }
      load()
    } catch (e) {
      toast(e.message || 'Failed to update lead', 'error')
    }
  }

  const saveLeadDetails = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await api.platform.updateLead(selected.id, {
        status: statusDraft,
        type: typeDraft,
        notes: notesDraft,
      })
      setSelected(res.lead)
      toast('Lead updated')
      load()
    } catch (e) {
      toast(e.message || 'Could not save lead', 'error')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await api.platform.deleteLead(deleting.id)
      toast(`Deleted lead from ${deleting.name}`)
      if (selected?.id === deleting.id) setSelected(null)
      setDeleting(null)
      load()
    } catch (e) {
      toast(e.message || 'Could not delete lead', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const copyText = (txt, label) => {
    if (!txt) return
    navigator.clipboard?.writeText(txt)
    toast(`${label} copied`)
  }

  const whatsappUrl = (phone, name) => {
    const digits = String(phone || '').replace(/[^\d]/g, '')
    if (!digits) return null
    const clean = digits.length === 10 ? `91${digits}` : digits
    const msg = encodeURIComponent(`Hi ${name || ''}, reaching out from HappyPix regarding your inquiry!`)
    return `https://wa.me/${clean}?text=${msg}`
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Website Leads</div>
          <div className="page-sub">
            Inquiries submitted from the public HappyPix website Contact, Book a Demo, Hardware &amp; Support forms (Owner-only).
          </div>
        </div>
        <div className="row gap-8">
          <Button size="sm" variant="outline" icon="refresh" onClick={load}>Refresh</Button>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="grid-4 mb-20">
        <StatCard
          label="Total Website Leads"
          value={counts.total}
          foot="All-time inquiries"
          icon="mail"
          iconBg="var(--hp-pink-soft)"
          iconColor="var(--hp-pink)"
          onClick={() => setStatusFilter('all')}
        />
        <StatCard
          label="New / Unread"
          value={counts.new}
          foot="Needs follow-up"
          icon="bell"
          iconBg="var(--warn-soft)"
          iconColor="var(--warn)"
          onClick={() => setStatusFilter('new')}
        />
        <StatCard
          label="Contacted"
          value={counts.contacted}
          foot="In conversation"
          icon="phone"
          iconBg="var(--hp-blue-soft)"
          iconColor="var(--hp-blue)"
          onClick={() => setStatusFilter('contacted')}
        />
        <StatCard
          label="Demo & Hardware"
          value={(counts.demo || 0) + (counts.hardware || 0)}
          foot={`${counts.demo || 0} demos · ${counts.hardware || 0} hardware`}
          icon="calendar"
          iconBg="var(--hp-purple-soft)"
          iconColor="var(--hp-purple)"
          onClick={() => setTypeFilter(typeFilter === 'demo' ? 'all' : 'demo')}
        />
      </div>

      <Card>
        <div style={{ padding: '12px 16px 0', borderBottom: '1px solid var(--line-soft)' }}>
          <Tabs
            active={statusFilter}
            onChange={setStatusFilter}
            tabs={[
              { id: 'all', label: 'All Leads', count: counts.total },
              { id: 'new', label: 'New', count: counts.new },
              { id: 'contacted', label: 'Contacted', count: counts.contacted },
              { id: 'closed', label: 'Closed', count: counts.closed },
            ]}
          />
        </div>

        <div className="row wrap between gap-12" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-soft)' }}>
          <div className="row wrap gap-10">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: 200, height: 36 }}>
              <option value="all">All inquiry topics</option>
              <option value="demo">Book a Demo ({counts.demo || 0})</option>
              <option value="hardware">Hardware / Pre-order ({counts.hardware || 0})</option>
              <option value="support">Support ({counts.support || 0})</option>
              <option value="contact">General Inquiry ({counts.contact || 0})</option>
            </Select>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name, email, phone, company or message…"
              style={{ width: 320 }}
            />
          </div>
          <div className="t12 muted">
            Showing <b>{filtered.length}</b> of {counts.total} lead{counts.total === 1 ? '' : 's'}
          </div>
        </div>

        {!data ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="mail"
            title="No website leads found"
            message={
              leads.length === 0
                ? 'When visitors submit the Contact / Book a Demo form on your website, their inquiries appear here immediately.'
                : 'No leads match your current status, topic, or search filters.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="hp-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Contact</th>
                  <th>Company / Studio</th>
                  <th>Topic</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const sMeta = STATUS_META[lead.status] || STATUS_META.new
                  const tMeta = TYPE_META[lead.type] || TYPE_META.contact
                  return (
                    <tr
                      key={lead.id}
                      style={{
                        cursor: 'pointer',
                        background: lead.status === 'new' ? 'var(--hp-pink-softer, rgba(234,9,127,0.035))' : undefined,
                      }}
                      onClick={() => openLead(lead)}
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div className="t13 fw6">{relativeTime(lead.createdAt)}</div>
                        <div className="t11 faint">{dateMed(lead.createdAt)}</div>
                      </td>
                      <td>
                        <div className="row gap-10">
                          <Avatar name={lead.name} size={32} />
                          <div style={{ minWidth: 0 }}>
                            <div className="t13 fw7 ellipsis">{lead.name}</div>
                            <div className="t11 muted ellipsis">{lead.email}</div>
                            {lead.phone ? <div className="t11 faint mono">{lead.phone}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        {lead.company ? (
                          <span className="t13 fw6">{lead.company}</span>
                        ) : (
                          <span className="t12 faint">—</span>
                        )}
                      </td>
                      <td>
                        <Chip tone={tMeta.tone}>
                          <Icon name={tMeta.icon} size={11} style={{ marginRight: 4 }} />
                          {tMeta.label}
                        </Chip>
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        <div className="t12" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45 }}>
                          {lead.message || <span className="faint" style={{ fontStyle: 'italic' }}>No message body provided</span>}
                        </div>
                        {lead.notes ? (
                          <div className="t11" style={{ color: 'var(--hp-purple)', marginTop: 3, fontWeight: 600 }}>
                            📌 Note: {lead.notes.slice(0, 60)}{lead.notes.length > 60 ? '…' : ''}
                          </div>
                        ) : null}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Chip tone={sMeta.tone} dot={sMeta.dot}>{sMeta.label}</Chip>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <div className="row gap-6" style={{ justifyContent: 'flex-end' }}>
                          {lead.status === 'new' ? (
                            <Button size="sm" variant="outline" icon="check" onClick={() => quickStatusChange(lead, 'contacted')}>
                              Mark Contacted
                            </Button>
                          ) : null}
                          <Button size="sm" variant="ghost" icon="eye" onClick={() => openLead(lead)}>
                            Manage
                          </Button>
                          <IconButton icon="trash" danger title="Delete lead" onClick={() => setDeleting(lead)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Lead Management Drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        icon="mail"
        title={selected ? selected.name : 'Lead Details'}
        sub={selected ? `${selected.email}${selected.company ? ` · ${selected.company}` : ''}` : ''}
        footer={
          selected ? (
            <div className="row between gap-12">
              <Button variant="ghost" style={{ color: 'var(--danger)' }} icon="trash" onClick={() => setDeleting(selected)}>
                Delete Lead
              </Button>
              <div className="row gap-8">
                <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
                <Button variant="primary" icon="check" disabled={saving} onClick={saveLeadDetails}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div style={{ display: 'grid', gap: 18 }}>
            {/* Quick Contact Bar */}
            <div className="row wrap gap-8">
              <a
                className="btn btn-primary btn-sm"
                href={`mailto:${selected.email}?subject=${encodeURIComponent(`HappyPix — Regarding your ${TYPE_META[selected.type]?.label || 'inquiry'}`)}`}
                style={{ textDecoration: 'none' }}
              >
                <Icon name="mail" size={14} /> Reply via Email
              </a>
              {selected.phone ? (
                <a className="btn btn-outline btn-sm" href={`tel:${selected.phone}`} style={{ textDecoration: 'none' }}>
                  <Icon name="phone" size={14} /> Call {selected.phone}
                </a>
              ) : null}
              {whatsappUrl(selected.phone, selected.name) ? (
                <a
                  className="btn btn-outline btn-sm"
                  href={whatsappUrl(selected.phone, selected.name)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <Icon name="send" size={14} /> WhatsApp
                </a>
              ) : null}
              <Button size="sm" variant="ghost" icon="copy" onClick={() => copyText(selected.email, 'Email')}>
                Copy Email
              </Button>
            </div>

            {/* Metadata Card */}
            <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line-soft)' }}>
              <KV k="Name" v={selected.name} />
              <KV k="Email" v={selected.email} mono />
              <KV k="Phone" v={selected.phone || 'Not provided'} mono />
              <KV k="Company / Studio" v={selected.company || 'Not provided'} />
              <KV k="Submitted" v={`${dateMed(selected.createdAt)} (${relativeTime(selected.createdAt)})`} />
              {selected.contactedAt ? <KV k="First Contacted" v={dateMed(selected.contactedAt)} /> : null}
              {selected.closedAt ? <KV k="Closed At" v={dateMed(selected.closedAt)} /> : null}
            </div>

            {/* Inquiry Message */}
            <div>
              <div className="t12 fw7 muted" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Message from {selected.name}
              </div>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 10,
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  color: 'var(--ink)',
                }}
              >
                {selected.message || 'No message text submitted.'}
              </div>
            </div>

            {/* Status & Topic Controls */}
            <div className="grid-2 gap-12">
              <Field label="Lead Status">
                <Select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)}>
                  <option value="new">New (Unread / Needs follow-up)</option>
                  <option value="contacted">Contacted (In progress)</option>
                  <option value="closed">Closed (Converted / Archived)</option>
                </Select>
              </Field>
              <Field label="Inquiry Topic">
                <Select value={typeDraft} onChange={(e) => setTypeDraft(e.target.value)}>
                  <option value="demo">Book a Demo</option>
                  <option value="hardware">Hardware / Pre-order</option>
                  <option value="support">Support</option>
                  <option value="contact">General Inquiry</option>
                </Select>
              </Field>
            </div>

            {/* Internal Owner Notes */}
            <Field
              label="Owner Follow-up Notes (Private)"
              hint="Only visible to the Platform Owner in this CRM."
            >
              <TextArea
                rows={4}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Add call notes, quoted plan, city, number of booths needed, or follow-up date…"
              />
            </Field>
          </div>
        ) : null}
      </Drawer>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete Website Lead"
        danger
        loading={deleteBusy}
        confirmLabel="Delete Lead"
        message={
          deleting
            ? `Are you sure you want to permanently delete the inquiry from ${deleting.name} (${deleting.email})?`
            : ''
        }
      />
    </div>
  )
}