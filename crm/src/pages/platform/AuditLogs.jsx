import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Card, Chip, PageLoader, Select, SearchInput, Pagination } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { dateMed, dateShort } from '../../lib/format.js'
import { ROLES, ROLE_LABELS, isPlatformRole } from '../../lib/roles.js'

const ACTION_GROUPS = [
  { id: 'auth', label: 'Logins & auth' },
  { id: 'organization', label: 'Organizations' },
  { id: 'user', label: 'Users & team' },
  { id: 'template', label: 'Templates' },
  { id: 'event', label: 'Events' },
  { id: 'device', label: 'Devices' },
  { id: 'coupon', label: 'Coupons' },
  { id: 'ticket', label: 'Tickets' },
  { id: 'plan', label: 'Plans & billing' },
  { id: 'defaults', label: 'Defaults' },
]

const SEVERITY_TONES = { info: 'info', warn: 'warn', danger: 'danger' }

export default function AuditLogs() {
  const { user } = useApp()
  const platform = isPlatformRole(user.role)
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const q = new URLSearchParams()
    q.set('limit', '15')
    q.set('page', String(page))
    if (action) q.set('action', action)
    if (actor) q.set('actor', actor)
    const call = platform ? api.platform.audit('?' + q) : api.org.audit('?' + q)
    call.then(setData).catch(() => setData(null))
  }, [page, action, actor])

  const userById = useMemo(() => {
    const map = {}
    if (data?.actors) data.actors.forEach((a) => { map[a.id] = a })
    return map
  }, [data])

  const rows = useMemo(() => {
    if (!data) return []
    let r = data.items
    if (search) {
      const s = search.toLowerCase()
      r = r.filter((x) => x.summary.toLowerCase().includes(s) || x.action.toLowerCase().includes(s) || (x.entity || '').toLowerCase().includes(s))
    }
    return r
  }, [data, search])

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Audit & Logs</div>
          <div className="page-sub">
            {platform
              ? 'Platform-level actions: logins, organizations, plans, templates, internal users and failed auth.'
              : 'Actions inside your organization: events, devices, coupons, team, defaults and ticket resolutions.'}
          </div>
        </div>
      </div>

      <Card>
        <div className="row wrap gap-12" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }} style={{ width: 170, height: 36 }}>
            <option value="">All action types</option>
            {ACTION_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </Select>
          {data?.actors?.length ? (
            <Select value={actor} onChange={(e) => { setActor(e.target.value); setPage(1) }} style={{ width: 190, height: 36 }}>
              <option value="">All actors</option>
              {data.actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          ) : null}
          <SearchInput value={search} onChange={setSearch} placeholder="Search summary, action or entity…" style={{ width: 260 }} />
        </div>

        {!data ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <div className="empty">
            <div className="empty-ico"><Icon name="log" size={24} /></div>
            <h3>No log entries</h3>
            <p>No audit events match the current filters.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 620, overflowY: 'auto' }}>
            <table className="hp-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Summary</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const actorUser = userById[a.actorId]
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="t13" style={{ whiteSpace: 'nowrap' }}>{dateMed(a.at)}</div>
                        <div className="t11 faint">{dateShort(a.at)}</div>
                      </td>
                      <td>
                        <div className="t13 fw6">{actorUser?.name || 'System'}</div>
                        <div className="t11 faint">{actorUser ? ROLE_LABELS[actorUser.role] : '—'}</div>
                      </td>
                      <td><Chip tone={SEVERITY_TONES[a.severity] || 'neutral'}>{a.action}</Chip></td>
                      <td className="t13 muted">{a.entity}</td>
                      <td className="t13" style={{ maxWidth: 380 }}>{a.summary}</td>
                      <td className="t12 faint num">{a.ip}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={data?.page || 1} pages={data?.pages || 1} total={data?.total || 0} onPage={setPage} pageSize={15} />
      </Card>
    </div>
  )
}
