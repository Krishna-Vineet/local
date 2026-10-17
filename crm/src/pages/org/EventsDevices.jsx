// Events & Devices (org screen).
//
// Event creation/updates include event-specific layout price overrides and no passkey:
//   1. General       — event name, client/host, location, start, end,
//                      digital-copy toggle
//   2. Customisation — photo filters + the TEMPLATE GALLERY: every
//                      published platform template, grouped by its layout
//                      variant (cut size × orientation × image slots) and
//                      filterable. All templates are pre-selected; the
//                      organiser deselects what they don't want, with
//                      select-all / clear-all bulk actions on the filtered
//                      view.
//   3. Branding      — event logos (sponsors / host / venue / teams —
//                      NOT the org logo; up to 15, optional) placed by
//                      each template at its reserved footer positions,
//                      + default tagline (editable later)
//
// Organization Defaults supplies the starting price for every layout iteration.
// Each event stores its own effective price snapshot, which can be overridden
// while creating or editing the event. Booth access is handled by the booth app.

import { useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import {
  Card, Tabs, Chip, PageLoader, SearchInput, Button, Modal, Field, TextInput,
  Select, ConfirmDialog, EmptyState, WarnBanner, Toggle,
} from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { dateShort, dateMed, relativeTime, uuidShort } from '../../lib/format.js'
import { FILTERS, EVENT_STATUSES } from '../../lib/plans.js'
import { ROLES } from '../../lib/roles.js'
import TemplatePreview from '../../components/TemplatePreview.jsx'
import {
  LAYOUT_FAMILIES, LAYOUTS, layoutById, layoutLabel, layoutShortLabel, PRICE_KEY,
  ORIENTATION_OPTIONS, SHEET_OPTIONS, SLOT_OPTIONS, TEMPLATE_CATEGORIES, resolveLayout
} from '../../lib/layouts.js'

const statusChip = (s) => EVENT_STATUSES[s] || EVENT_STATUSES.upcoming

export default function EventsDevices() {
  const { user, toast, readOnly, orgNotice } = useApp()
  const isAdmin = user.role === ROLES.ORG_ADMIN
  const [tab, setTab] = useState('events')
  const [events, setEvents] = useState(null)
  const [devices, setDevices] = useState(null)
  const [templates, setTemplates] = useState(null)
  const [defaults, setDefaults] = useState(null)
  const [search, setSearch] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [editor, setEditor] = useState(null) // 'new' | event
  const [deleting, setDeleting] = useState(null)
  const [removingDevice, setRemovingDevice] = useState(null)
  const [editingDevice, setEditingDevice] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.org.events().then((r) => setEvents(r)).catch((e) => toast(e.message, 'error'))
    api.org.devices().then((r) => setDevices(r)).catch(() => {})
    Promise.all([
      api.org.templates().catch(() => ({ templates: [] })),
      api.org.aiTemplates().catch(() => ({ templates: [] }))
    ]).then(([platformRes, orgRes]) => {
      const combined = [
        ...(platformRes.templates || []),
        ...(orgRes.templates || []).map(t => ({
           ...t,
           id: t._id || t.id,
           type: 'org',
           layoutId: t.layout?.code || t.layoutCode || 'custom',
           originalLayoutCode: t.layout?.code || t.layoutCode,
           source: t.source === 'manual' ? 'manual' : 'ai_generated',
           category: t.category || 'Custom'
        }))
      ];
      setTemplates(combined);
    })
    api.org.defaults().then(setDefaults).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const filteredEvents = useMemo(() => {
    if (!events) return []
    let r = events.events
    if (eventFilter) r = r.filter((e) => e.status === eventFilter)
    if (search) {
      const s = search.toLowerCase()
      r = r.filter((e) => e.name.toLowerCase().includes(s) || (e.location || '').toLowerCase().includes(s) || (e.clientName || '').toLowerCase().includes(s))
    }
    return r
  }, [events, eventFilter, search])

  const assignments = useMemo(() => {
    if (!devices) return []
    return devices.devices.map((d) => ({
      device: d,
      event: d.assignedEvent ? d.assignedEvent : null,
    }))
  }, [devices])

  const doAssign = async (device, eventId) => {
    if (readOnly) { toast(orgNotice?.message || 'This organization is suspended — changes are disabled until HappyPix restores it.', 'error'); return }
    try {
      if (eventId) await api.org.assignDevice(device.id, eventId)
      else await api.org.unassignDevice(device.id)
      toast(eventId ? 'Event assigned — booth picks it up on next sync' : 'Assignment removed')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const pauseResume = async (ev) => {
    if (readOnly) { toast(orgNotice?.message || 'This organization is suspended — changes are disabled until HappyPix restores it.', 'error'); return }
    try {
      if (ev.status === 'paused') await api.org.resumeEvent(ev.id)
      else await api.org.pauseEvent(ev.id)
      toast(ev.status === 'paused' ? `Resumed “${ev.name}”` : `Paused “${ev.name}”`, 'info')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const confirmDelete = async () => {
    if (readOnly) { toast(orgNotice?.message || 'This organization is suspended — changes are disabled until HappyPix restores it.', 'error'); return }
    if (!deleting) return
    setBusy(true)
    try {
      await api.org.deleteEvent(deleting.id)
      toast(`Deleted “${deleting.name}”`)
      setDeleting(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const confirmRemoveDevice = async () => {
    if (readOnly) { toast(orgNotice?.message || 'This organization is suspended — changes are disabled until HappyPix restores it.', 'error'); return }
    if (!removingDevice) return
    setBusy(true)
    try {
      await api.org.removeDevice(removingDevice.id)
      toast(`Removed ${removingDevice.deviceName}`)
      setRemovingDevice(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const assignableEvents = useMemo(
    () => (events ? events.events.filter((e) => e.status === 'active' || e.status === 'upcoming') : []),
    [events]
  )

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Events & Devices</div>
          <div className="page-sub">Create events, override layout prices from your organization defaults, register booths, and assign events to devices.</div>
        </div>
        {isAdmin || user.role === ROLES.ORG_MANAGER ? (
          <Button variant="primary" icon="plus" onClick={() => setEditor('new')} disabled={(!!events && !events.canCreate) || !templates || !defaults}>
            Create event
          </Button>
        ) : null}
      </div>

      {events && !events.canCreate && (
        <div style={{ marginBottom: 14 }}>
          <WarnBanner tone="warn" icon="alert">
            You cannot create a new active event right now — plan limit reached or plan inactive.
            Finished events don't count against the limit.
          </WarnBanner>
        </div>
      )}

      <Tabs
        tabs={[
          { id: 'events', label: 'Events', icon: 'calendar', count: events?.events.length },
          { id: 'devices', label: 'Devices', icon: 'monitor', count: devices?.devices.length },
          { id: 'assign', label: 'Assignments', icon: 'link', count: assignments.filter((a) => a.event).length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <Card className="mt-16" style={{ paddingTop: 0 }}>
        {tab === 'events' && (
          <div>
            <div className="row wrap gap-12" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search events…" style={{ width: 250 }} />
              <Select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} style={{ width: 140, height: 36 }}>
                <option value="">All statuses</option>
                {Object.entries(EVENT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </div>
            {!events ? (
              <PageLoader />
            ) : filteredEvents.length === 0 ? (
              <EmptyState icon="calendar" title="No events" message="Create your first event — pick filters, platform templates and the client's branding." action={<Button variant="primary" icon="plus" onClick={() => setEditor('new')}>Create event</Button>} />
            ) : (
              <div className="table-wrap">
                <table className="hp-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Schedule</th>
                      <th>Status</th>
                      <th>Customisation</th>
                      <th>Digital</th>
                      <th className="t-right">Devices</th>
                      <th className="t-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((e) => {
                      const sm = statusChip(e.status)
                      const tpls = (e.templateIds || []).map((id) => templates?.find((t) => t.id === id)).filter(Boolean)
                      return (
                        <tr key={e.id}>
                          <td>
                            <div className="cell-main">{e.name}</div>
                            <div className="cell-sub">{e.clientName || '—'} · {e.location || '—'}</div>
                          </td>
                          <td>
                            <div className="t13">{dateMed(e.startDate)}</div>
                            <div className="t11 faint">to {dateShort(e.endDate)}</div>
                          </td>
                          <td><Chip tone={sm.chip.replace('chip-', '')} dot>{sm.label}</Chip></td>
                          <td>
                            <div className="row wrap gap-6" style={{ maxWidth: 260 }}>
                              {(e.filters || []).slice(0, 2).map((f) => (
                                <Chip key={f} tone="info">{FILTERS.find((x) => x.id === f)?.label || f}</Chip>
                              ))}
                              {(e.filters || []).length > 2 ? <span className="t11 faint">+{(e.filters || []).length - 2}</span> : null}
                              {tpls.length > 0 ? (
                                <span className="t11 muted" title={tpls.map((t) => t.name).join(', ')}>
                                  <Icon name="template" size={12} style={{ verticalAlign: '-1px', marginRight: 3 }} />
                                  {tpls.length} template{tpls.length > 1 ? 's' : ''}
                                </span>
                              ) : null}
                              {e.overrideTemplatePrices ? (
                                <span className="chip chip-pink" title="Event has custom price overrides" style={{ height: 20, fontSize: 10.5, fontWeight: 600 }}>
                                  ✏️ Custom Pricing
                                </span>
                              ) : (
                                <span className="chip chip-neutral" title="Uses Organization Defaults" style={{ height: 20, fontSize: 10.5 }}>
                                  ⚡ Org Defaults
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {e.digitalCopy
                              ? <Chip tone="active">Enabled</Chip>
                              : <Chip tone="neutral">Off</Chip>}
                          </td>
                          <td className="t-right">
                            {e.assignedDevices.length > 0 ? (
                              <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                                {e.assignedDevices.slice(0, 3).map((d) => (
                                  <span key={d.id} className="row gap-8" title={d.name}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.online ? 'var(--hp-green)' : 'var(--faint)', flex: 'none' }} />
                                    <span className="t12 ellipsis" style={{ maxWidth: 90 }}>{d.name}</span>
                                  </span>
                                ))}
                                {e.assignedDevices.length > 3 ? <span className="t11 faint">+{e.assignedDevices.length - 3}</span> : null}
                              </div>
                            ) : (
                              <span className="t12 faint">None</span>
                            )}
                          </td>
                          <td className="t-right">
                            <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                              <Button size="sm" variant="ghost" onClick={() => setEditor(e)} title="Edit event"><Icon name="edit" size={14} /></Button>
                              {e.status !== 'finished' ? (
                                <Button size="sm" variant="ghost" icon={e.status === 'paused' ? 'play' : 'pause'} onClick={() => pauseResume(e)} title={e.status === 'paused' ? 'Resume' : 'Pause'} />
                              ) : null}
                              {e.status !== 'active' ? (
                                <Button size="sm" variant="ghost" icon="trash" style={{ color: 'var(--danger)' }} onClick={() => setDeleting(e)} title="Delete event" />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'devices' && (
          <div>
            {!devices ? (
              <PageLoader />
            ) : devices.devices.length === 0 ? (
              <EmptyState
                icon="monitor"
                title="No devices yet"
                message="When a booth app signs in with your HappyPix account, it pairs automatically and appears here with its own UUID. No manual tokens."
              />
            ) : (
              <div className="table-wrap">
                <table className="hp-table">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>UUID</th>
                      <th>Hardware health</th>
                      <th>Status</th>
                      <th>Booth operator</th>
                      <th>Last seen</th>
                      <th>Assigned event</th>
                      <th className="t-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.devices.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <div className="cell-main">{d.deviceName}</div>
                          <div className="cell-sub">{d.location || '—'} · reg. {dateShort(d.registeredAt)}</div>
                        </td>
                        <td><code className="t11" style={{ background: 'var(--surface-2)', padding: '3px 7px', borderRadius: 5 }}>{uuidShort(d.deviceUuid)}</code></td>
                        <td><TelemetryCell device={d} /></td>
                        <td><Chip tone={d.online ? 'active' : 'neutral'} dot>{d.online ? 'Online' : 'Offline'}</Chip></td>
                        <td><OperatorCell device={d} /></td>
                        <td className="t13 muted">{d.lastSeenAt ? relativeTime(d.lastSeenAt) : 'never'}</td>
                        <td>
                          {d.assignedEvent ? (
                            <div className="row gap-8">
                              <Chip tone={d.assignedEvent.status === 'active' ? 'active' : d.assignedEvent.status === 'upcoming' ? 'info' : 'warn'}>{d.assignedEvent.name}</Chip>
                              <Button size="sm" variant="ghost" icon="x" title="Remove assignment" onClick={() => doAssign(d, null)} />
                            </div>
                          ) : (
                            <span className="t12 faint">No event</span>
                          )}
                        </td>
                        <td className="t-right">
                          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                            <Button size="sm" variant="ghost" icon="edit" title="Rename device / set booth operator" onClick={() => setEditingDevice(d)} />
                            <Button size="sm" variant="ghost" icon="trash" style={{ color: 'var(--danger)' }} title="Remove device" onClick={() => setRemovingDevice(d)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line-soft)' }}>
              <div className="row between t12">
                <span className="muted">
                  <Icon name="shield" size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                  Devices pair themselves: booth app → your HappyPix login → generated UUID → appears here.
                </span>
                {devices ? (
                  <span className="num fw6">{devices.limit.used} / {devices.limit.allowed} device limit</span>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {tab === 'assign' && (
          <div>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
              <p className="t13 muted">
                Assign an active or upcoming event to a device. The booth receives the assignment on its next heartbeat and starts serving that event's guests.
              </p>
            </div>
            {!devices ? (
              <PageLoader />
            ) : (
              <div>
                {assignments.map(({ device, event }) => (
                  <div key={device.id} className="row between wrap" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-soft)', gap: 12 }}>
                    <div className="row gap-12" style={{ minWidth: 0, flex: '1 1 260px' }}>
                      <span className="stat-ico" style={{ width: 38, height: 38, background: device.online ? 'var(--hp-green-soft)' : 'var(--surface-2)', color: device.online ? 'var(--hp-green-ink)' : 'var(--faint)' }}>
                        <Icon name="monitor" size={17} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="t13 fw6 ellipsis">{device.deviceName}</div>
                        <div className="t11 muted">{device.location || '—'} · {device.online ? 'online' : 'offline'}</div>
                        {device.operatorName ? (
                          <div className="t11 row gap-6" style={{ color: 'var(--hp-green-ink)', marginTop: 2 }} title="Booth operator on ground">
                            <Icon name="user-check" size={11} />
                            <span className="ellipsis">{device.operatorName}{device.operatorPhone ? ` · ${device.operatorPhone}` : ''}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <Icon name="chevron-right" size={15} style={{ color: 'var(--faint)', flex: 'none' }} />
                    <div style={{ flex: '1 1 280px' }}>
                      <Select
                        value={event ? event.id : ''}
                        onChange={(e) => doAssign(device, e.target.value)}
                        style={{ height: 36 }}
                      >
                        <option value="">— No event assigned —</option>
                        {assignableEvents.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.name} ({ev.status === 'active' ? 'live' : 'upcoming'})
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                ))}
                {assignments.length === 0 ? (
                  <EmptyState icon="monitor" title="No devices" message="Register a booth first from the Devices tab." />
                ) : null}
              </div>
            )}
          </div>
        )}
      </Card>

      <EventEditor
        key={editor === 'new' ? 'new' : editor?.id}
        open={!!editor}
        initial={editor === 'new' ? null : editor}
        templates={templates || []}
        defaults={defaults}
        onClose={() => setEditor(null)}
        onSaved={() => { setEditor(null); load() }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        danger
        loading={busy}
        title={`Delete “${deleting?.name}”?`}
        message="Device assignments and coupon links to this event are removed. Historical payments stay in revenue reports."
        confirmLabel="Delete event"
      />

      <ConfirmDialog
        open={!!removingDevice}
        onClose={() => setRemovingDevice(null)}
        onConfirm={confirmRemoveDevice}
        danger
        loading={busy}
        title={`Remove ${removingDevice?.deviceName}?`}
        message="The booth will be blocked from connecting. Its registration record is deleted; re-pairing creates a new UUID."
        confirmLabel="Remove device"
      />

      {editingDevice ? (
        <DeviceEditModal
          device={editingDevice}
          onClose={() => setEditingDevice(null)}
          onSaved={() => { setEditingDevice(null); load() }}
        />
      ) : null}
    </div>
  )
}

// ---------------- Device telemetry (Hardware health column) ----------------
// The booth heartbeat reports both lifetime counters and live peripheral
// connections: camera, printer and the external kiosk display.

const PERIPHERALS = [
  { key: 'camera', label: 'Camera', short: 'Camera', icon: 'camera' },
  { key: 'printer', label: 'Printer', short: 'Printer', icon: 'printer' },
  { key: 'kioskScreen', label: 'External kiosk screen', short: 'Screen', icon: 'monitor' },
]

function TelemetryCell({ device }) {
  const t = device.telemetry
  const num = (n) => Number(n || 0).toLocaleString('en-IN')
  return (
    <div className="tel">
      <div className="hw-health" aria-label="Peripheral connection health">
        {PERIPHERALS.map((item) => {
          const connected = device.connections?.[item.key] === true
          return (
            <span key={item.key} className="hw-health-item">
              <span
                className={`hw-connection ${connected ? 'connected' : 'disconnected'}`}
                title={`${item.label}: ${connected ? 'connected' : 'not connected'}`}
                aria-label={`${item.label} ${connected ? 'connected' : 'not connected'}`}
              >
                <Icon name={item.icon} size={15} />
                <span className="hw-connection-mark"><Icon name={connected ? 'check' : 'x'} size={8} strokeWidth={3} /></span>
              </span>
              <span>{item.short}</span>
            </span>
          )
        })}
      </div>
      {t ? (
        <>
          {device.hardware?.includes('printer') ? (
            <span className="tel-row" title="Prints this printer has made (pushed by the booth app)">
              <Icon name="printer" size={13} />
              <b>{num(t.prints)}</b>&nbsp;prints
            </span>
          ) : null}
          {device.hardware?.includes('camera') ? (
            <span className="tel-row" title="Camera shutter count (pushed by the booth app)">
              <Icon name="aperture" size={13} />
              <b>{num(t.shutters)}</b>&nbsp;clicks
            </span>
          ) : null}
          {t.batteryPct != null ? <BatteryPill pct={t.batteryPct} /> : null}
          <span className="tel-stale" title={`Last pushed ${new Date(device.connections?.updatedAt || t.updatedAt).toLocaleString()}`}>
            via booth · {relativeTime(device.connections?.updatedAt || t.updatedAt)}
          </span>
        </>
      ) : (
        <span className="tel-stale">No counters reported yet</span>
      )}
    </div>
  )
}

function BatteryPill({ pct }) {
  const color = pct >= 50 ? 'var(--hp-green-ink)' : pct >= 25 ? 'var(--warn)' : 'var(--danger)'
  const fill = Math.max(0, Math.min(12.4, (pct / 100) * 12.4))
  return (
    <span className="tel-row" title={`Camera battery ${pct}%`}>
      <span className="batt">
        <svg width="23" height="13" viewBox="0 0 23 13" fill="none" aria-hidden="true">
          <rect x="0.6" y="0.6" width="18.2" height="11.8" rx="2.6" stroke={color} strokeWidth="1.2" />
          <path d="M21.2 4.4v4.2" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
          {fill > 0.5 ? <rect x="2.4" y="2.4" width={fill} height="8.2" rx="1.4" fill={color} /> : null}
        </svg>
        <b style={{ marginLeft: 5, color, minWidth: 34 }}>{pct}%</b>
      </span>
    </span>
  )
}

function OperatorCell({ device }) {
  if (!device.operatorName) return <span className="t12 faint">Not assigned</span>
  return (
    <div>
      <div className="row gap-6 t13 fw6">
        <Icon name="user-check" size={13} style={{ color: 'var(--hp-green-ink)', flex: 'none' }} />
        <span className="ellipsis">{device.operatorName}</span>
      </div>
      {device.operatorPhone ? (
        <a
          href={`tel:${device.operatorPhone.replace(/[^+\d]/g, '')}`}
          className="row gap-6 t11 muted"
          style={{ marginTop: 2 }}
          title="Call the booth operator"
        >
          <Icon name="phone" size={11} style={{ flex: 'none' }} />
          {device.operatorPhone}
        </a>
      ) : (
        <div className="t11 faint" style={{ marginTop: 2 }}>No phone saved</div>
      )}
    </div>
  )
}

// ---------------- Device edit: rename + booth operator ----------------

function DeviceEditModal({ device, onClose, onSaved }) {
  const { toast } = useApp()
  const [name, setName] = useState(device.deviceName || '')
  const [opName, setOpName] = useState(device.operatorName || '')
  const [opPhone, setOpPhone] = useState(device.operatorPhone || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!name.trim()) return setError('Device name cannot be empty.')
    if (opPhone.trim() && !/^[+\d][\d\s\-()]{5,19}$/.test(opPhone.trim())) {
      return setError('Phone number looks invalid — use digits, spaces or dashes.')
    }
    setBusy(true)
    setError('')
    try {
      await api.org.updateDevice(device.id, {
        deviceName: name.trim(),
        operatorName: opName.trim(),
        operatorPhone: opPhone.trim(),
      })
      toast('Device updated')
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit device"
      sub={`${device.deviceName} · UUID ${uuidShort(device.deviceUuid)}`}
      footer={
        <>
          {error ? <span className="input-error" style={{ marginRight: 'auto' }}>{error}</span> : null}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
        </>
      }
    >
      <Field label="Device name" required hint="Shown across the CRM — events, assignments, revenue and support tickets.">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Booth 02 — Lawn" autoFocus />
      </Field>

      <div className="divider" />

      <div className="sess-block-title" style={{ color: 'var(--hp-green-ink)' }}>
        <Icon name="user-check" size={13} /> Booth operator — on-ground contact
      </div>
      <p className="t12 muted" style={{ marginBottom: 12, lineHeight: 1.55 }}>
        The person physically stationed at this booth (not a CRM user). They watch for hardware
        issues and guide guests. Whoever assigns the operator records them here — every org admin
        and manager can then see the name and number to reach them.
      </p>
      <div className="row gap-12">
        <div style={{ flex: 1 }}>
          <Field label="Operator name">
            <TextInput value={opName} onChange={(e) => setOpName(e.target.value)} placeholder="e.g. Sunil Yadav" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Operator phone" hint="Visible to the whole organization team.">
            <TextInput type="tel" value={opPhone} onChange={(e) => setOpPhone(e.target.value)} placeholder="+91 98110 55220" />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

// ---------------- Event editor: General / Customisation / Branding ----------------

const FAMILY_ORDER = Object.fromEntries(LAYOUT_FAMILIES.map((f, i) => [f.id, i]))

function EventEditor({ open, initial, templates, defaults, onClose, onSaved }) {
  const { toast } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    clientName: initial?.clientName || '',
    location: initial?.location || '',
    startDate: initial ? toLocalInput(initial.startDate) : '',
    endDate: initial ? toLocalInput(initial.endDate) : '',
    digitalCopy: initial ? initial.digitalCopy !== false : false,
    filters: initial?.filters || [],
    // Templates: every published template is pre-selected for new events;
    // edits keep the event's saved selection.
    templateIds: initial ? (initial.templateIds || []) : templates.map((t) => t.id),
    // A full effective snapshot is saved on the event. Existing event values
    // win; otherwise start from the organization's current defaults.
    layoutPrices: { ...(defaults?.layoutPrices || {}), ...(initial?.layoutPrices || {}) },
    overrideTemplatePrices: initial ? !!initial.overrideTemplatePrices : false,
    templatePrices: { ...(defaults?.templatePrices || {}), ...(initial?.templatePrices || {}) },
    logos: initial?.branding?.logos || (initial?.branding?.logoUrl ? [initial.branding.logoUrl] : []),
    tagline: initial?.branding?.tagline || '',
    gatewayPriority: initial?.gatewayPriority || defaults?.gatewayPriority || 'razorpay',
    boothTimeout: initial?.boothTimeout || defaults?.boothTimeoutSec || 60,
    qrTimeoutMinutes: initial?.qrTimeoutMinutes || defaults?.qrTimeoutMinutes || 5,
    customGateways: !!(initial?.razorpayKeyId || initial?.cashfreeAppId),
    razorpayKeyId: initial?.razorpayKeyId || '',
    razorpayKeySecret: '',
    hasRazorpayKeySecret: !!initial?.hasRazorpayKeySecret,
    cashfreeAppId: initial?.cashfreeAppId || '',
    cashfreeSecretKey: '',
    hasCashfreeSecretKey: !!initial?.hasCashfreeSecretKey,
    cashfreeEnv: initial?.cashfreeEnv || 'production',
  }))
  const [pricingSubTab, setPricingSubTab] = useState('templates')
  const [tf, setTf] = useState({ orientation: '', sheet: '', slots: '', category: '' })
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (open) {
      setStep(0)
      setError('')
      if (initial) {
        setForm({
          name: initial.name || '',
          clientName: initial.clientName || '',
          location: initial.location || '',
          startDate: toLocalInput(initial.startDate),
          endDate: toLocalInput(initial.endDate),
          digitalCopy: initial.digitalCopy !== false,
          filters: initial.filters || [],
          templateIds: initial.templateIds || [],
          layoutPrices: { ...(defaults?.layoutPrices || {}), ...(initial.layoutPrices || {}) },
          overrideTemplatePrices: !!initial.overrideTemplatePrices,
          templatePrices: { ...(defaults?.templatePrices || {}), ...(initial.templatePrices || {}) },
          logos: initial.branding?.logos || (initial.branding?.logoUrl ? [initial.branding.logoUrl] : []),
          tagline: initial.branding?.tagline || '',
          gatewayPriority: initial.gatewayPriority || defaults?.gatewayPriority || 'razorpay',
          boothTimeout: initial.boothTimeout || defaults?.boothTimeoutSec || 60,
          qrTimeoutMinutes: initial.qrTimeoutMinutes || defaults?.qrTimeoutMinutes || 5,
          customGateways: !!(initial.razorpayKeyId || initial.cashfreeAppId),
          razorpayKeyId: initial.razorpayKeyId || '',
          razorpayKeySecret: '',
          hasRazorpayKeySecret: !!initial.hasRazorpayKeySecret,
          cashfreeAppId: initial.cashfreeAppId || '',
          cashfreeSecretKey: '',
          hasCashfreeSecretKey: !!initial.hasCashfreeSecretKey,
          cashfreeEnv: initial.cashfreeEnv || 'production',
        })
      }
    }
  }, [open, initial, defaults])

  // Step 1 needs a name and a valid time range before the guest-facing parts are configured.
  const validateDetails = () => {
    if (!form.name.trim()) return 'Event name is required.'
    if (!form.startDate || !form.endDate) return 'Start and end times are required.'
    if (new Date(form.startDate) >= new Date(form.endDate)) return 'End time must be after start time.'
    return ''
  }
  const goTo = (target) => {
    if (target > step && step === 0) {
      const problem = validateDetails()
      if (problem) return setError(problem)
    }
    setError('')
    setStep(target)
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!defaults?.layoutPrices) return
    setForm((current) => {
      if (Object.keys(current.layoutPrices || {}).length) return current
      return { ...current, layoutPrices: { ...defaults.layoutPrices, ...(initial?.layoutPrices || {}) } }
    })
  }, [defaults, initial])

  const toggleIn = (key, id) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }))

  const toggleTemplate = (id) => toggleIn('templateIds', id)

  const filteredTemplates = useMemo(() => {
    let r = templates
    if (tf.orientation) r = r.filter((t) => t.layout?.orientation === tf.orientation)
    if (tf.sheet) r = r.filter((t) => t.layout?.sheets?.includes(tf.sheet))
    if (tf.slots) r = r.filter((t) => t.layout?.slots === Number(tf.slots))
    if (tf.category) r = r.filter((t) => t.category === tf.category)
    return r
  }, [templates, tf])

  // Group the visible templates by layout variant, catalogue order.
  const groups = useMemo(() => {
    const map = new Map()
    for (const t of filteredTemplates) {
      if (!map.has(resolveLayout(t)?.id)) map.set(resolveLayout(t)?.id, [])
      map.get(resolveLayout(t)?.id).push(t)
    }
    return [...map.entries()]
      .map(([layoutId, list]) => {
        const layout = resolveLayout(list[0]);
        return { layout, list }
      })
      .filter((g) => g.layout)
      .sort((a, b) =>
        (FAMILY_ORDER[a.layout.familyId] || 99) - (FAMILY_ORDER[b.layout.familyId] || 99) ||
        a.layout.slots - b.layout.slots ||
        (a.layout.orientation === 'portrait' ? -1 : 1)
      )
  }, [filteredTemplates])

  const selectedPriceRows = useMemo(() => {
    const byKey = new Map()
    for (const template of templates) {
      if (!form.templateIds.includes(template.id)) continue
      const layout = resolveLayout(template)
      if (!layout) continue
      const key = PRICE_KEY(layout.familyId, layout.slots)
      if (!byKey.has(key)) byKey.set(key, { key, layout })
    }
    return [...byKey.values()].sort((a, b) =>
      FAMILY_ORDER[a.layout.familyId] - FAMILY_ORDER[b.layout.familyId] || a.layout.slots - b.layout.slots
    )
  }, [templates, form.templateIds])

  const setEventPrice = (key, value) => {
    if (value === '') return
    const amount = Math.max(0, Math.round(Number(value) || 0))
    setForm((current) => ({ ...current, layoutPrices: { ...current.layoutPrices, [key]: amount } }))
  }

  const selectedTemplatesList = useMemo(() => {
    return templates.filter((t) => form.templateIds.includes(t.id))
  }, [templates, form.templateIds])

  const getTemplateDefaultPrice = useCallback((t) => {
    if (defaults?.templatePrices?.[t.id] != null) {
      return defaults.templatePrices[t.id]
    }
    const layout = resolveLayout(t)
    if (!layout) return 0
    const key = PRICE_KEY(layout.familyId, layout.slots)
    return defaults?.layoutPrices?.[key] ?? 0
  }, [defaults])

  const toggleOverrideTemplatePrices = (override) => {
    setForm((f) => {
      if (override) {
        const prefilled = { ...(defaults?.templatePrices || {}) }
        for (const t of selectedTemplatesList) {
          if (prefilled[t.id] == null) {
            prefilled[t.id] = getTemplateDefaultPrice(t)
          }
        }
        return {
          ...f,
          overrideTemplatePrices: true,
          templatePrices: { ...prefilled, ...(f.templatePrices || {}) },
          layoutPrices: { ...(defaults?.layoutPrices || {}), ...(f.layoutPrices || {}) },
        }
      }
      return {
        ...f,
        overrideTemplatePrices: false,
      }
    })
  }

  const setEventTemplatePrice = (templateId, value) => {
    setForm((f) => {
      const tp = { ...(f.templatePrices || {}) }
      if (value === '' || value == null) {
        delete tp[templateId]
      } else {
        tp[templateId] = Math.max(0, Math.round(Number(value) || 0))
      }
      return { ...f, templatePrices: tp }
    })
  }

  const customTemplatesCount = useMemo(() => {
    if (!form.overrideTemplatePrices) return 0
    return selectedTemplatesList.filter((t) => {
      const def = getTemplateDefaultPrice(t)
      return form.templatePrices?.[t.id] != null && form.templatePrices?.[t.id] !== def
    }).length
  }, [form.overrideTemplatePrices, form.templatePrices, selectedTemplatesList, getTemplateDefaultPrice])

  const selectAllShown = () =>
    setForm((f) => ({ ...f, templateIds: [...new Set([...f.templateIds, ...filteredTemplates.map((t) => t.id)])] }))
  const clearShown = () =>
    setForm((f) => ({ ...f, templateIds: f.templateIds.filter((id) => !filteredTemplates.some((t) => t.id === id)) }))

  const addLogos = (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setForm((f) => {
      const room = 15 - f.logos.length
      if (room <= 0) {
        toast('A maximum of 15 logos per event.', 'error')
        return f
      }
      const take = files.slice(0, room)
      const tooBig = files.length > room || files.length > 15
      Promise.all(
        take.map(
          (file) =>
            new Promise((resolve) => {
              if (file.size > 300 * 1024) {
                toast(`“${file.name}” is over 300 KB — skipped.`, 'error')
                resolve(null)
                return
              }
              const r = new FileReader()
              r.onload = () => resolve(r.result)
              r.onerror = () => resolve(null)
              r.readAsDataURL(file)
            })
        )
      ).then((urls) => {
        const ok = urls.filter(Boolean)
        setForm((cur) => ({ ...cur, logos: [...cur.logos, ...ok].slice(0, 15) }))
        if (ok.length) toast(`${ok.length} logo${ok.length > 1 ? 's' : ''} added`)
      })
      if (tooBig && f.logos.length + files.length > 15) toast('A maximum of 15 logos per event.', 'error')
      return f
    })
  }

  const previewTemplate = useMemo(
    () => templates.find((t) => t.id === form.templateIds[0]) || templates[0] || null,
    [templates, form.templateIds]
  )

  const save = async () => {
    setError('')
    const problem = validateDetails()
    if (problem) {
      setStep(0)
      return setError(problem)
    }
    setBusy(true)
    try {
      const body = {
        name: form.name.trim(),
        clientName: form.clientName.trim(),
        location: form.location.trim(),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        digitalCopy: form.digitalCopy,
        filters: form.filters,
        templateIds: form.templateIds,
        layoutPrices: form.layoutPrices,
        overrideTemplatePrices: !!form.overrideTemplatePrices,
        templatePrices: form.overrideTemplatePrices ? form.templatePrices : {},
        gatewayPriority: form.gatewayPriority || 'razorpay',
        boothTimeout: Math.max(10, Math.min(600, Number(form.boothTimeout) || 60)),
        qrTimeoutMinutes: Math.max(1, Math.min(30, Number(form.qrTimeoutMinutes) || 5)),
        branding: { logos: form.logos, tagline: form.tagline.trim() },
      }
      if (form.customGateways) {
        body.razorpayKeyId = form.razorpayKeyId.trim()
        if (form.razorpayKeySecret.trim()) body.razorpayKeySecret = form.razorpayKeySecret.trim()
        body.cashfreeAppId = form.cashfreeAppId.trim()
        if (form.cashfreeSecretKey.trim()) body.cashfreeSecretKey = form.cashfreeSecretKey.trim()
        body.cashfreeEnv = form.cashfreeEnv || 'production'
      } else if (initial && (initial.razorpayKeyId || initial.cashfreeAppId)) {
        // Explicitly clear overrides if user turned off custom gateways
        body.razorpayKeyId = ''
        body.razorpayKeySecret = ''
        body.cashfreeAppId = ''
        body.cashfreeSecretKey = ''
      }
      if (initial) await api.org.updateEvent(initial.id, body)
      else await api.org.createEvent(body)
      toast(initial ? 'Event updated' : `Event “${body.name}” created`)
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const priceFor = (l) => form.layoutPrices?.[PRICE_KEY(l?.familyId, l?.slots)]
  const priceForTemplate = (tpl) => {
    if (!tpl) return null
    if (form.overrideTemplatePrices) {
      if (form.templatePrices?.[tpl.id] != null) return form.templatePrices[tpl.id]
      return getTemplateDefaultPrice(tpl)
    }
    return getTemplateDefaultPrice(tpl)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Edit “${initial.name}”` : 'Create event'}
      sub={STEPS[step].sub}
      width="wide"
      footer={
        <>
          {error ? <span className="input-error" style={{ marginRight: 'auto' }}>{error}</span> : null}
          {step > 0 ? (
            <Button variant="ghost" onClick={() => goTo(step - 1)}>Back</Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          )}
          {initial && step < STEPS.length - 1 ? (
            <Button variant="outline" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => goTo(step + 1)}>Next: {STEPS[step + 1].label}</Button>
          ) : (
            <Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Create event'}</Button>
          )}
        </>
      }
    >
      <Stepper steps={STEPS} current={step} onJump={goTo} />
      {step === 0 && (
        <div className="wiz-step">
          <SectionLabel n={1} title="General" />
          <Field label="Event name" required>
            <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Kapoor–Verma Wedding" />
          </Field>
          <div className="row gap-12">
            <div style={{ flex: 1 }}>
              <Field label="Client / host">
                <TextInput value={form.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Who is the event for" />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Location">
                <TextInput value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Venue, city" />
              </Field>
            </div>
          </div>
          <div className="row gap-12">
            <div style={{ flex: 1 }}>
              <Field label="Starts" required>
                <TextInput type="datetime-local" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Ends" required>
                <TextInput type="datetime-local" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="row between" style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }}>
            <div>
              <div className="t13 fw6">Digital copy</div>
              <div className="t11 muted">Let guests receive a digital copy of their prints (download link after printing).</div>
            </div>
            <Toggle on={form.digitalCopy} onChange={(v) => set('digitalCopy', v)} />
          </div>

          <div className="row gap-12" style={{ marginTop: 14 }}>
            <div style={{ flex: 1 }}>
              <Field
                label="Screen Idle Timeout (Seconds)"
                hint="Inactivity timeout for step screens (templates, coupon, filters)."
              >
                <TextInput
                  type="number"
                  min="10"
                  max="600"
                  value={form.boothTimeout}
                  onChange={(e) => set('boothTimeout', e.target.value)}
                  placeholder="60"
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field
                label="Payment QR Expiry (Minutes)"
                hint="Time guests have to scan & pay the QR before timeout (default: 5 min)."
              >
                <TextInput
                  type="number"
                  min="1"
                  max="30"
                  value={form.qrTimeoutMinutes}
                  onChange={(e) => set('qrTimeoutMinutes', e.target.value)}
                  placeholder="5"
                />
              </Field>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Field
              label="Payment Gateway Priority"
              hint="Select which gateway to use first for this event. If primary fails, the booth falls back automatically."
            >
              <Select
                value={form.gatewayPriority || 'razorpay'}
                onChange={(e) => set('gatewayPriority', e.target.value)}
              >
                <option value="razorpay">Razorpay First (Fallback to Cashfree / UPI)</option>
                <option value="cashfree">Cashfree First (Fallback to Razorpay / UPI)</option>
              </Select>
            </Field>
          </div>

          <div className="row between" style={{ marginTop: 14, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }}>
            <div>
              <div className="t13 fw6">Custom Payment Gateways for this Event</div>
              <div className="t11 muted">
                {form.customGateways
                  ? 'Enter custom API keys for this event. Leave secret blank to keep existing.'
                  : 'Using Organization Default payment gateways and credentials.'}
              </div>
            </div>
            <Toggle on={form.customGateways} onChange={(v) => set('customGateways', v)} />
          </div>

          {form.customGateways && (
            <div style={{ marginTop: 12, padding: 14, background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
              <div className="t12 fw7 muted" style={{ marginBottom: 10, textTransform: 'uppercase' }}>Razorpay Override</div>
              <div className="row gap-12">
                <div style={{ flex: 1 }}>
                  <Field label="Razorpay Key ID">
                    <TextInput
                      value={form.razorpayKeyId}
                      onChange={(e) => set('razorpayKeyId', e.target.value)}
                      placeholder="rzp_live_..."
                    />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Razorpay Key Secret" hint={form.hasRazorpayKeySecret ? 'Secret is saved (leave blank to keep).' : 'Enter secret key'}>
                    <TextInput
                      type="password"
                      value={form.razorpayKeySecret}
                      onChange={(e) => set('razorpayKeySecret', e.target.value)}
                      placeholder={form.hasRazorpayKeySecret ? '••••••••••••••••' : 'Key Secret'}
                    />
                  </Field>
                </div>
              </div>

              <div className="t12 fw7 muted" style={{ marginTop: 12, marginBottom: 10, textTransform: 'uppercase' }}>Cashfree Override</div>
              <div className="row gap-12">
                <div style={{ flex: 1 }}>
                  <Field label="Cashfree App ID">
                    <TextInput
                      value={form.cashfreeAppId}
                      onChange={(e) => set('cashfreeAppId', e.target.value)}
                      placeholder="CF App ID"
                    />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Cashfree Secret Key" hint={form.hasCashfreeSecretKey ? 'Secret is saved (leave blank to keep).' : 'Enter secret key'}>
                    <TextInput
                      type="password"
                      value={form.cashfreeSecretKey}
                      onChange={(e) => set('cashfreeSecretKey', e.target.value)}
                      placeholder={form.hasCashfreeSecretKey ? '••••••••••••••••' : 'Secret Key'}
                    />
                  </Field>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <Field label="Cashfree Environment">
                  <Select value={form.cashfreeEnv} onChange={(e) => set('cashfreeEnv', e.target.value)}>
                    <option value="production">Production</option>
                    <option value="sandbox">Sandbox (Testing)</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}

        </div>
      )}
      {step === 1 && (
        <div className="wiz-step">
          <div>
            <SectionLabel n={2} title="Templates available at this event" />
            <div className="row between wrap gap-8" style={{ marginBottom: 8 }}>
              <label className="label" style={{ marginBottom: 0 }}>
                Choose templates for booth guests
                <span className="t11 muted" style={{ fontWeight: 400 }}> · {form.templateIds.length} of {templates.length} selected</span>
              </label>
              <div className="row gap-6">
                <Button size="sm" variant="outline" icon="check" onClick={selectAllShown}>Select all shown</Button>
                <Button size="sm" variant="ghost" icon="x" onClick={clearShown}>Clear shown</Button>
              </div>
            </div>
            <div className="row wrap gap-8" style={{ marginBottom: 10 }}>
              <Select value={tf.orientation} onChange={(e) => setTf((x) => ({ ...x, orientation: e.target.value }))} style={{ width: 118, height: 32, fontSize: 12 }}>
                <option value="">Orientation</option>
                {ORIENTATION_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
              <Select value={tf.sheet} onChange={(e) => setTf((x) => ({ ...x, sheet: e.target.value }))} style={{ width: 96, height: 32, fontSize: 12 }}>
                <option value="">Sheet</option>
                {SHEET_OPTIONS.map((sh) => <option key={sh} value={sh}>{sh}</option>)}
              </Select>
              <Select value={tf.slots} onChange={(e) => setTf((x) => ({ ...x, slots: e.target.value }))} style={{ width: 104, height: 32, fontSize: 12 }}>
                <option value="">Images</option>
                {SLOT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
              <Select value={tf.category} onChange={(e) => setTf((x) => ({ ...x, category: e.target.value }))} style={{ width: 122, height: 32, fontSize: 12 }}>
                <option value="">Category</option>
                {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <span className="t11 faint">{filteredTemplates.length} shown across {groups.length} layout{groups.length === 1 ? '' : 's'}</span>
            </div>

            <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--line-soft)', borderRadius: 'var(--r-md)', padding: '10px 12px', background: 'var(--surface-2)' }}>
              {groups.map(({ layout, list }) => (
                <div key={layout.id} style={{ marginBottom: 12 }}>
                  <div className="row between wrap gap-8" style={{ padding: '4px 2px 6px' }}>
                    <span className="t12 fw6">
                      {layout.name}
                      <span className="t11 muted fw400" style={{ fontWeight: 400 }}> · {layoutLabel(layout)}</span>
                    </span>
                    <span className="chip chip-info" style={{ height: 19, fontSize: 10.5 }} title="Guest price saved for this event">
                      {priceFor(layout) != null ? `₹${priceFor(layout)}/print` : 'not priced'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
                    {list.map((t) => {
                      const sel = form.templateIds.includes(t.id)
                      const a = layout.canvas.w / layout.canvas.h
                      const pw = a < 0.45 ? 52 : a < 1 ? 84 : 108
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTemplate(t.id)}
                          title={`${t.name} — ${t.category}`}
                          style={{
                            position: 'relative', padding: 6, borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                            border: `1.5px solid ${sel ? 'var(--hp-pink)' : 'var(--line)'}`,
                            background: sel ? 'var(--hp-pink-soft)' : 'var(--surface)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'center', opacity: sel ? 1 : 0.75 }}>
                            <TemplatePreview template={t} width={pw} />
                          </div>
                          <div className="t11 fw6 mt-8 ellipsis" style={{ fontSize: 10.5 }} title={t.name}>{t.name}</div>
                          <div className="t11 faint" style={{ fontSize: 9 }}>{t.source === 'designer' ? 'Designer' : t.source === 'ai_generated' ? 'AI' : 'Playground'}</div>
                          {sel ? (
                            <span style={{
                              position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%',
                              background: 'var(--hp-pink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Icon name="check" size={11} />
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {groups.length === 0 ? (
                <div className="t12 faint" style={{ padding: '14px 4px' }}>
                  No published templates match these filters — widen them, or ask the platform to publish more.
                </div>
              ) : null}
            </div>
            <p className="t11 faint mt-8" style={{ lineHeight: 1.5 }}>
              Templates are pinned to one layout variant each ({LAYOUTS.length} exist — both orientations). At the booth,
              guests filter by orientation and image count, see your page-size prices, then pick from the templates this
              event offers.
            </p>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="wiz-step">
          <SectionLabel n={3} title="Photo filters available at this event" />
          <p className="t11 muted mb-12">Guests at the booth will only see the filters you enable below. Select the filters allowed for this event:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 18 }}>
            {FILTERS.map((fl) => {
              const sel = form.filters.includes(fl.id)
              return (
                <button
                  key={fl.id}
                  type="button"
                  onClick={() => toggleIn('filters', fl.id)}
                  className="row between"
                  style={{
                    padding: '12px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${sel ? 'var(--hp-pink)' : 'var(--line)'}`,
                    background: sel ? 'var(--hp-pink-soft)' : 'var(--surface-2)',
                    color: sel ? 'var(--hp-pink-deep)' : 'var(--text)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div className="row gap-8">
                    <Icon name={sel ? 'check' : 'filter'} size={15} />
                    <span>{fl.label}</span>
                  </div>
                  <span className={`chip ${sel ? 'chip-pink' : 'chip-neutral'}`} style={{ height: 20, fontSize: 11 }}>
                    {sel ? 'Enabled' : 'Off'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="wiz-step">
          <SectionLabel n={4} title="Event print & template pricing" />

          {/* High-Visibility Active Pricing Confirmation Card */}
          <div
            style={{
              background: form.overrideTemplatePrices
                ? 'linear-gradient(135deg, rgba(234, 9, 127, 0.12) 0%, rgba(234, 9, 127, 0.03) 100%)'
                : 'linear-gradient(135deg, rgba(0, 200, 117, 0.12) 0%, rgba(0, 200, 117, 0.03) 100%)',
              border: `1.5px solid ${form.overrideTemplatePrices ? 'var(--hp-pink)' : 'var(--hp-green)'}`,
              borderRadius: 'var(--r-md)',
              padding: '14px 18px',
              marginBottom: 16,
              boxShadow: form.overrideTemplatePrices ? '0 0 16px rgba(234, 9, 127, 0.1)' : '0 0 16px rgba(0, 200, 117, 0.1)',
            }}
          >
            <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: form.overrideTemplatePrices ? 'var(--hp-pink)' : 'var(--hp-green)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 16,
                    flex: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                >
                  <Icon name={form.overrideTemplatePrices ? 'edit' : 'shield'} size={18} />
                </div>
                <div>
                  <div className="row gap-8" style={{ alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: form.overrideTemplatePrices ? 'var(--hp-pink)' : 'var(--hp-green)',
                        color: '#fff',
                      }}
                    >
                      {form.overrideTemplatePrices ? 'Event Override Active' : 'Org Defaults Active'}
                    </span>
                    <span className="t13 fw7" style={{ color: 'var(--ink)' }}>
                      {form.overrideTemplatePrices ? 'Custom Event Prices Confirmed' : 'Organization Defaults Confirmed'}
                    </span>
                  </div>
                  <div className="t11 faint mt-4">
                    {form.overrideTemplatePrices
                      ? `This event will use the custom rates set below. Org settings will NOT affect these templates.`
                      : `Booth will charge standard rates from Org Defaults. Any changes in Org Settings apply automatically.`}
                  </div>
                </div>
              </div>

              {/* Strategy Switcher */}
              <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', padding: 3, borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                <button
                  type="button"
                  onClick={() => toggleOverrideTemplatePrices(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 'var(--r-sm)',
                    fontSize: 12,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: !form.overrideTemplatePrices ? 'var(--hp-green)' : 'transparent',
                    color: !form.overrideTemplatePrices ? '#fff' : 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon name="check" size={13} />
                  <span>Use Org Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleOverrideTemplatePrices(true)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 'var(--r-sm)',
                    fontSize: 12,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: form.overrideTemplatePrices ? 'var(--hp-pink)' : 'transparent',
                    color: form.overrideTemplatePrices ? '#fff' : 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon name="edit" size={13} />
                  <span>Override for Event</span>
                </button>
              </div>
            </div>
          </div>

          {!form.overrideTemplatePrices ? (
            /* Using Org Defaults view */
            <div className="card" style={{ marginBottom: 18, overflow: 'hidden', boxShadow: 'none' }}>
              <div style={{ padding: '16px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line-soft)', textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(234, 9, 127, 0.12)', color: 'var(--hp-pink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Icon name="shield" size={20} />
                </div>
                <div className="t14 fw6">Standard Organization Defaults Active</div>
                <div className="t12 faint mt-4" style={{ maxWidth: 440, margin: '4px auto 12px', lineHeight: 1.5 }}>
                  All templates and print layouts will use their organization defaults at the booth. If you change defaults in Org Settings, this event updates automatically.
                </div>
                <Button size="sm" variant="ghost" icon="edit" onClick={() => toggleOverrideTemplatePrices(true)}>
                  Override rates specifically for this event
                </Button>
              </div>

              <div style={{ padding: '12px 16px', background: 'var(--surface)' }}>
                <div className="t11 fw6 uppercase muted mb-8" style={{ letterSpacing: '0.05em' }}>
                  Effective Prices ({selectedTemplatesList.length} Selected Template{selectedTemplatesList.length === 1 ? '' : 's'})
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {selectedTemplatesList.map((t) => {
                    const defaultPrice = getTemplateDefaultPrice(t)
                    const layout = resolveLayout(t)
                    return (
                      <div key={t.id} className="row between gap-12" style={{ padding: '8px 4px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="t12 fw6 ellipsis">{t.name}</div>
                          <div className="t11 faint">{layout ? `${layout.slots} photo${layout.slots > 1 ? 's' : ''}` : ''} {t.category ? `· ${t.category}` : ''}</div>
                        </div>
                        <span className="chip chip-neutral" style={{ height: 22, fontSize: 11, fontWeight: 600 }}>
                          ₹{defaultPrice} (Org Default)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Overridden view */
            <div className="card" style={{ marginBottom: 18, overflow: 'hidden', boxShadow: 'none' }}>
              <div style={{ padding: '10px 14px', background: 'rgba(234, 9, 127, 0.04)', borderBottom: '1px solid var(--line-soft)' }}>
                <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div className="t12 muted">
                    ⚡ <b>Pre-filled from defaults:</b> Edit prices for any template or layout. Changes apply only to this event.
                  </div>
                  <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', padding: 2, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                    <button
                      type="button"
                      onClick={() => setPricingSubTab('templates')}
                      style={{
                        padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                        background: pricingSubTab === 'templates' ? 'var(--hp-pink)' : 'transparent',
                        color: pricingSubTab === 'templates' ? '#fff' : 'var(--muted)',
                      }}
                    >
                      Per-Template ({selectedTemplatesList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingSubTab('matrix')}
                      style={{
                        padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                        background: pricingSubTab === 'matrix' ? 'var(--hp-pink)' : 'transparent',
                        color: pricingSubTab === 'matrix' ? '#fff' : 'var(--muted)',
                      }}
                    >
                      Paper-Size Baselines ({selectedPriceRows.length})
                    </button>
                  </div>
                </div>
              </div>

              {pricingSubTab === 'templates' ? (
                <div style={{ maxHeight: 310, overflowY: 'auto', padding: '6px 14px' }}>
                  {selectedTemplatesList.length ? (
                    selectedTemplatesList.map((t) => {
                      const defaultPrice = getTemplateDefaultPrice(t)
                      const currentPrice = form.templatePrices?.[t.id] ?? defaultPrice
                      const isModified = form.templatePrices?.[t.id] != null && form.templatePrices?.[t.id] !== defaultPrice
                      const layout = resolveLayout(t)

                      return (
                        <div key={t.id} className="row between gap-12" style={{ padding: '9px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}>
                          <div style={{ minWidth: 0 }}>
                            <div className="t12 fw6 ellipsis">{t.name}</div>
                            <div className="t11 faint">
                              {layout ? `${layout.slots} photo${layout.slots > 1 ? 's' : ''}` : ''}
                              {isModified ? ` · Overridden (Default was ₹${defaultPrice})` : ` · Default ₹${defaultPrice}`}
                            </div>
                          </div>
                          <div className="row gap-6" style={{ flex: 'none', alignItems: 'center' }}>
                            <span className="t12 muted">₹</span>
                            <TextInput
                              type="number"
                              min="0"
                              max="100000"
                              value={currentPrice}
                              onChange={(e) => setEventTemplatePrice(t.id, e.target.value)}
                              style={{ width: 82, height: 32 }}
                              aria-label={`${t.name} price`}
                            />
                            {isModified ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                icon="refresh"
                                title="Reset to organization default"
                                onClick={() => setEventTemplatePrice(t.id, defaultPrice)}
                              />
                            ) : null}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="t12 faint" style={{ padding: '14px 0' }}>Select templates in Step 2 to configure pricing.</p>
                  )}
                </div>
              ) : (
                <div style={{ maxHeight: 310, overflowY: 'auto', padding: '6px 14px' }}>
                  {selectedPriceRows.length ? selectedPriceRows.map(({ key, layout }) => {
                    const value = form.layoutPrices?.[key]
                    const defaultValue = defaults?.layoutPrices?.[key]
                    const changed = value !== defaultValue
                    return (
                      <div key={key} className="row between gap-12" style={{ padding: '9px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="t12 fw6 ellipsis">{layout.name} · {layout.slots} image{layout.slots === 1 ? '' : 's'}</div>
                          <div className="t11 faint">{changed ? `Overridden · default ₹${defaultValue ?? 0}` : 'Using organization default'}</div>
                        </div>
                        <div className="row gap-6" style={{ flex: 'none', alignItems: 'center' }}>
                          <span className="t12 muted">₹</span>
                          <TextInput
                            type="number"
                            min="0"
                            max="100000"
                            value={value ?? ''}
                            onChange={(e) => setEventPrice(key, e.target.value)}
                            style={{ width: 82, height: 32 }}
                            aria-label={`${layout.name} ${layout.slots} image price`}
                          />
                          {changed ? (
                            <Button size="sm" variant="ghost" icon="refresh" title="Reset to organization default" onClick={() => setEventPrice(key, defaultValue ?? 0)} />
                          ) : null}
                        </div>
                      </div>
                    )
                  }) : (
                    <p className="t12 faint" style={{ padding: '14px 0' }}>Select templates in Step 2 to configure baseline layout prices.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {step === 4 && (
        <div className="wiz-step">
          <SectionLabel n={5} title="Branding & Final Review" />
          <Field
            label="Event logos — sponsors, host, venue, teams"
            hint="Optional, up to 15. These are NOT your organization logo — they are the extra layer of personalisation for this event (like BMW, Audi and Ferrari logos at a car race). Each template places them at its reserved footer positions."
          >
            <div
              style={{
                border: '2px dashed var(--line)', borderRadius: 10, padding: 14, textAlign: 'center',
                cursor: 'pointer', position: 'relative', background: 'var(--surface-2)',
              }}
            >
              <input type="file" accept="image/png, image/jpeg, image/svg+xml" multiple onChange={addLogos} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
              <Icon name="upload" size={20} style={{ color: 'var(--faint)' }} />
              <div className="t12 muted mt-8">Click to add logos — or leave blank ({form.logos.length}/15)</div>
            </div>
            {form.logos.length > 0 ? (
              <div className="row wrap gap-8 mt-12">
                {form.logos.map((src, i) => (
                  <span key={i} style={{ position: 'relative', display: 'inline-flex' }}>
                    <img
                      src={src}
                      alt={`Logo ${i + 1}`}
                      style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)' }}
                    />
                    <button
                      type="button"
                      title="Remove logo"
                      onClick={() => set('logos', form.logos.filter((_, j) => j !== i))}
                      style={{
                        position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%',
                        background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icon name="x" size={10} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </Field>
          <Field label="Default tagline" hint="Shown in the print footer beside the logos. Editable any time from this screen.">
            <TextInput value={form.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="e.g. Shubh Vivah — Kapoor & Verma" />
          </Field>

          {/* Explicit Pricing Confirmation Box in Final Step */}
          <div
            style={{
              marginTop: 18,
              marginBottom: 16,
              background: 'var(--surface-2)',
              border: form.overrideTemplatePrices ? '1.5px solid var(--hp-pink)' : '1.5px solid var(--hp-green)',
              borderRadius: 'var(--r-md)',
              padding: '13px 16px',
            }}
          >
            <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div className="row gap-8" style={{ alignItems: 'center' }}>
                  <span
                    className={`chip ${form.overrideTemplatePrices ? 'chip-pink' : 'chip-info'}`}
                    style={{ height: 22, fontSize: 11, fontWeight: 700 }}
                  >
                    {form.overrideTemplatePrices ? '✏️ EVENT CUSTOM PRICING' : '⚡ ORGANIZATION DEFAULTS'}
                  </span>
                  <span className="t13 fw6">
                    {form.overrideTemplatePrices ? 'Custom Overrides Confirmed' : 'Org Defaults Confirmed'}
                  </span>
                </div>
                <div className="t12 faint mt-6" style={{ maxWidth: 480, lineHeight: 1.5 }}>
                  {form.overrideTemplatePrices
                    ? `This event will run with custom overridden rates (${customTemplatesCount} template rate(s) explicitly modified).`
                    : `This event is locked to your Organization Defaults. All ${selectedTemplatesList.length} enabled templates inherit default rates.`}
                </div>
              </div>
              <Button size="sm" variant="ghost" icon="edit" onClick={() => goTo(3)}>
                Edit Pricing
              </Button>
            </div>

            {/* Quick Rates Breakdown */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line-soft)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedTemplatesList.slice(0, 5).map((t) => {
                const defaultPrice = getTemplateDefaultPrice(t)
                const effectivePrice = form.overrideTemplatePrices ? (form.templatePrices?.[t.id] ?? defaultPrice) : defaultPrice
                const isOverridden = form.overrideTemplatePrices
                const isModified = form.overrideTemplatePrices && form.templatePrices?.[t.id] != null && form.templatePrices?.[t.id] !== defaultPrice
                return (
                  <div
                    key={t.id}
                    style={{
                      background: 'var(--surface)',
                      border: `1px solid ${isOverridden ? 'var(--hp-pink)' : 'var(--line-soft)'}`,
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 11.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span className="ellipsis" style={{ maxWidth: 110, color: 'var(--ink)' }}>{t.name}</span>
                    <span className="fw6" style={{ color: isOverridden ? 'var(--hp-pink)' : 'var(--ink)' }}>₹{effectivePrice}</span>
                    <span style={{ fontSize: 9.5, opacity: 0.85, color: isOverridden ? 'var(--hp-pink)' : 'var(--muted)', fontWeight: 600 }}>
                      {isOverridden ? (isModified ? '(Custom)' : '(Event)') : '(Org)'}
                    </span>
                  </div>
                )
              })}
              {selectedTemplatesList.length > 5 ? (
                <div style={{ padding: '4px 8px', fontSize: 11.5, color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                  +{selectedTemplatesList.length - 5} more
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-16">
            <label className="label">Output preview</label>
            {previewTemplate ? (
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 10, display: 'flex', justifyContent: 'center' }}>
                  <TemplatePreview
                    template={previewTemplate}
                    width={resolveLayout(previewTemplate)?.canvas.w / resolveLayout(previewTemplate)?.canvas.h < 0.45 ? 96 : resolveLayout(previewTemplate)?.canvas.w / resolveLayout(previewTemplate)?.canvas.h < 1 ? 150 : 210}
                    logos={form.logos.map((src, i) => ({ src, name: `Logo ${i + 1}` }))}
                    tagline={form.tagline}
                  />
                </div>
                <div className="t11 muted" style={{ maxWidth: 190, lineHeight: 1.55 }}>
                  Previewing <b>{previewTemplate.name}</b> ({layoutShortLabel(resolveLayout(previewTemplate))}). Guests pay{' '}
                  <b>{priceForTemplate(previewTemplate) != null ? `₹${priceForTemplate(previewTemplate)}` : 'no price set'}</b> for
                  this layout using this event's saved price. <b>{form.templateIds.length}</b> template(s) available at this event.
                </div>
              </div>
            ) : (
              <p className="t12 faint">Select at least one template to preview the output.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

const STEPS = [
  { id: 'details', label: '1. Details', sub: 'Name, client, venue and when the event runs.' },
  { id: 'templates', label: '2. Templates', sub: 'Choose which print templates are available at this event.' },
  { id: 'filters', label: '3. Photo filters', sub: 'Select which photo filters guests can use.' },
  { id: 'pricing', label: '4. Print pricing', sub: 'Confirm Org Defaults or configure event-specific template overrides.' },
  { id: 'branding', label: '5. Branding & review', sub: 'Sponsor logos, tagline, pricing confirmation and output preview.' },
]

function Stepper({ steps, current, onJump }) {
  return (
    <div className="wiz-stepper" style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 6 }}>
      {steps.map((item, index) => {
        const active = index === current
        const done = index < current
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onJump(index)}
            className="t12"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999,
              border: `1.5px solid ${active ? 'var(--hp-pink)' : done ? 'var(--hp-pink-soft)' : 'var(--line)'}`,
              background: active ? 'var(--hp-pink-soft)' : 'var(--surface-2)',
              color: active ? 'var(--hp-pink-deep)' : done ? 'var(--text)' : 'var(--muted)',
              fontWeight: active ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', fontSize: 11,
              background: active ? 'var(--hp-pink)' : done ? 'var(--hp-pink)' : 'var(--line)',
              color: '#fff',
            }}>{done ? '✓' : index + 1}</span>
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function SectionLabel({ n, title }) {
  return (
    <div className="row gap-8" style={{ alignItems: 'center', marginBottom: 12 }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%', background: 'var(--hp-pink)', color: '#fff',
        fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{n}</span>
      <span className="t13 fw7">{title}</span>
    </div>
  )
}

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
