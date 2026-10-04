import { useEffect, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Card, Chip, PageLoader, Button, Modal, Field, TextInput, Select, ConfirmDialog, Avatar, WarnBanner } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { dateShort, relativeTime } from '../../lib/format.js'
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../lib/roles.js'

export default function TeamAndRoles() {
  const { user, toast } = useApp()
  const isOwner = user.role === ROLES.OWNER
  const [users, setUsers] = useState(null)
  const [editing, setEditing] = useState(null) // 'new' only — existing identities are self-managed
  const [draft, setDraft] = useState(null)
  const [deactFor, setDeactFor] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.platform.users().then((r) => setUsers(r.users)).catch((e) => toast(e.message, 'error'))
  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    if (!draft) return
    setBusy(true)
    try {
      await api.platform.createUser(draft)
      toast(`Created ${ROLE_LABELS[draft.role]} account`)
      setEditing(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const doDeactivate = async () => {
    if (!deactFor) return
    setBusy(true)
    try {
      const isActive = deactFor.status === 'active'
      await api.platform.updateUser(deactFor.id, { status: isActive ? 'inactive' : 'active' })
      toast(isActive ? `Deactivated ${deactFor.name}` : `Re-activated ${deactFor.name}`, 'info')
      setDeactFor(null)
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
          <div className="page-title">Team & Roles</div>
          <div className="page-sub">
            {isOwner
              ? 'Internal HappyPix platform team. Existing names and emails are self-managed; the Owner can only deactivate or re-activate accounts.'
              : 'Read-only view of the internal platform team. Permissions are fixed by platform policy.'}
          </div>
        </div>
        {isOwner ? <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>New internal user</Button> : null}
      </div>

      {!isOwner && (
        <div  className="mb-16">
          <WarnBanner tone="info" icon="info">
            Your role has read-only visibility here. User management is restricted to the Owner.
          </WarnBanner>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <Card>
          <div className="card-head"><div className="card-title">Internal team</div><span className="t11 faint">{users ? users.length : '…'} accounts</span></div>
          {!users ? (
            <PageLoader />
          ) : (
            <div>
              {users.map((u) => (
                <div key={u.id} className="row between" style={{ padding: '13px 18px', borderBottom: '1px solid var(--line-soft)' }}>
                  <div className="row gap-12" style={{ minWidth: 0 }}>
                    <Avatar name={u.name} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div className="t13 fw6 ellipsis">{u.name} {u.id === user.id ? <span className="t11 faint">(you)</span> : null}</div>
                      <div className="t11 muted ellipsis">{u.email}</div>
                      <div className="t11 faint">Last login {relativeTime(u.lastLoginAt)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <Chip tone={u.role === ROLES.OWNER ? 'pink' : u.role === ROLES.PLATFORM_ADMIN ? 'purple' : 'info'}>{ROLE_LABELS[u.role]}</Chip>
                    {isOwner && u.id !== user.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={u.status === 'active' ? 'ban' : 'check'}
                        title={u.status === 'active' ? 'Deactivate' : 'Re-activate'}
                        onClick={() => setDeactFor(u)}
                        style={{ color: u.status === 'active' ? 'var(--danger)' : 'var(--hp-green-ink)' }}
                      >
                        {u.status === 'active' ? 'Deactivate' : 'Re-activate'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="card-head">
            <div>
              <div className="card-title">Fixed role model</div>
              <div className="card-sub">Five roles · no custom permissions · no booth operator role</div>
            </div>
          </div>
          <div>
            {[ROLES.OWNER, ROLES.PLATFORM_ADMIN, ROLES.SUPPORT_MANAGER, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER].map((r, i) => (
              <div key={r} style={{ padding: '13px 18px', borderBottom: i === 4 ? 'none' : '1px solid var(--line-soft)' }}>
                <div className="row between">
                  <Chip tone={r === ROLES.OWNER ? 'pink' : r === ROLES.PLATFORM_ADMIN ? 'purple' : r === ROLES.SUPPORT_MANAGER ? 'info' : r === ROLES.ORG_ADMIN ? 'active' : 'neutral'}>
                    {ROLE_LABELS[r]}
                  </Chip>
                  <span className="t11 faint">{r === ROLES.OWNER || r === ROLES.PLATFORM_ADMIN || r === ROLES.SUPPORT_MANAGER ? 'Platform scope' : 'Organization scope'}</span>
                </div>
                <p className="t12 muted mt-8" style={{ lineHeight: 1.5 }}>{ROLE_DESCRIPTIONS[r]}</p>
              </div>
            ))}
            <div style={{ padding: '14px 18px', background: 'var(--surface-2)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
              <p className="t11" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                <Icon name="shield" size={12} style={{ verticalAlign: '-1px', marginRight: 5 }} />
                Booths are <b>devices</b>, not users — they pair with a generated UUID and never hold a CRM account.
                Guest users never exist in the CRM.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Create internal user"
        sub="Only Platform Admin and Support Manager accounts can be created here. After creation, they manage their own name and email from Profile."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy || !draft}>{busy ? 'Saving…' : 'Create user'}</Button>
          </>
        }
      >
        {editing ? (
          <UserForm key="new" initial={null} onChange={setDraft} isOwnerView={isOwner} />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deactFor}
        onClose={() => setDeactFor(null)}
        onConfirm={doDeactivate}
        danger={deactFor?.status === 'active'}
        title={deactFor?.status === 'active' ? `Deactivate ${deactFor?.name}?` : `Re-activate ${deactFor?.name}?`}
        message={deactFor?.status === 'active' ? 'They will not be able to sign in until re-activated. This is audit logged.' : 'They regain CRM access immediately.'}
        confirmLabel={deactFor?.status === 'active' ? 'Deactivate' : 'Re-activate'}
        loading={busy}
      />

    </div>
  )
}

function UserForm({ initial, onChange, isOwnerView }) {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, email: initial.email, password: '', role: initial.role, status: initial.status }
      : { name: '', email: '', password: '', role: ROLES.PLATFORM_ADMIN, status: 'active' }
  )
  useEffect(() => {
    onChange({ ...form, password: initial ? undefined : form.password })
  }, [form, initial, onChange])
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <div>
      <Field label="Full name" required>
        <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Priya Nair" />
      </Field>
      <Field label="Email" required>
        <TextInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@happypix.com" />
      </Field>
      {!initial ? (
        <>
          <Field label="Initial password" required hint="Minimum 8 characters with at least one letter and one number. The user changes it themselves; passwords are never re-issued by admins.">
            <TextInput type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" />
          </Field>
          <Field label="Role" required hint="Fixed by the platform model. Owner is a single bootstrap account and cannot be created.">
            <Select value={form.role} onChange={(e) => set('role', e.target.value)} disabled={!isOwnerView}>
              <option value={ROLES.PLATFORM_ADMIN}>Platform Admin</option>
              <option value={ROLES.SUPPORT_MANAGER}>Support Manager</option>
            </Select>
          </Field>
        </>
      ) : null}
    </div>
  )
}
