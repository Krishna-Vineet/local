// Team & Roles (organization screen).
//
// Org Admins add and manage their own Organization Admins and Managers —
// same fixed role model as the platform, scoped to this organization:
//   • Admin can add members and deactivate/re-activate existing members.
//     Existing names, emails and roles are immutable here.
//   • Managers get a read-only view (no actions, server-enforced too).
// Passwords are never issued here: every member uses self-service
// Forgot Password (OTP to their email) — server has no reset-password API.

import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Card, Chip, PageLoader, Button, Modal, Field, TextInput, Select, ConfirmDialog, Avatar, WarnBanner, EmptyState } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { dateShort, relativeTime } from '../../lib/format.js'
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../lib/roles.js'

export default function OrgTeam() {
  const { user, toast } = useApp()
  const canManage = user.role === ROLES.ORG_ADMIN
  const [members, setMembers] = useState(null)
  const [editing, setEditing] = useState(null) // 'new' only — existing identity is self-managed
  const [draft, setDraft] = useState(null)
  const [deactFor, setDeactFor] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => api.org.team().then((r) => setMembers(r.members || r.team || [])).catch((e) => toast(e.message, 'error'))
  useEffect(() => {
    load()
  }, [])

  const activeAdmins = useMemo(
    () => (members || []).filter((m) => m.role === ROLES.ORG_ADMIN && m.status === 'active').length,
    [members]
  )

  const openNew = () => {
    setError('')
    setDraft({ name: '', email: '', password: '', role: ROLES.ORG_MANAGER })
    setEditing('new')
  }

  const save = async () => {
    if (!draft) return
    setError('')
    if (!draft.name.trim() || !draft.email.trim() || !draft.password) {
      return setError('Name, email and password are required.')
    }
    setBusy(true)
    try {
      await api.org.createMember({ name: draft.name.trim(), email: draft.email.trim(), password: draft.password, role: draft.role })
      toast(`${draft.role === ROLES.ORG_ADMIN ? 'Organization Admin' : 'Organization Manager'} added — share the password securely, they change it after first sign-in`)
      setEditing(null)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const doDeactivate = async () => {
    if (!deactFor) return
    setBusy(true)
    try {
      const isActive = deactFor.status === 'active'
      if (isActive) await api.org.deactivateMember(deactFor.id)
      else await api.org.activateMember(deactFor.id)
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
          <div className="page-title">Team &amp; Roles</div>
          <div className="page-sub">
            {canManage
              ? 'Add team members, or deactivate and re-activate existing accounts. Names, emails and roles cannot be edited by an Organization Admin.'
              : 'Your organization team. Read-only for your role — ask an Organization Admin to make changes.'}
          </div>
        </div>
        {canManage ? <Button variant="primary" icon="plus" onClick={openNew}>Add member</Button> : null}
      </div>

      {!canManage && (
        <WarnBanner tone="info" icon="info" className="mb-16">
          Your role has read-only visibility here. Members are added and managed by Organization Admins.
        </WarnBanner>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <Card>
          <div className="card-head"><div className="card-title">Organization team</div><span className="t11 faint">{members ? `${members.length} member${members.length === 1 ? '' : 's'}` : '…'}</span></div>
          {!members ? (
            <PageLoader />
          ) : members.length === 0 ? (
            <EmptyState icon="users" title="No members yet" message="Add your first admin or manager." />
          ) : (
            <div>
              {members.map((m) => (
                <div key={m.id} className="row between" style={{ padding: '13px 18px', borderBottom: '1px solid var(--line-soft)', opacity: m.status === 'active' ? 1 : 0.55 }}>
                  <div className="row gap-12" style={{ minWidth: 0 }}>
                    <Avatar name={m.name} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div className="t13 fw6 ellipsis">
                        {m.name} {m.id === user.id ? <span className="t11 faint">(you)</span> : null}
                        {m.status !== 'active' ? <span className="t11" style={{ color: 'var(--danger)', fontWeight: 700 }}> · deactivated</span> : null}
                      </div>
                      <div className="t11 muted ellipsis">{m.email || 'Email not available'}</div>
                      <div className="t11 faint">Joined {dateShort(m.createdAt)} · last login {relativeTime(m.lastLoginAt)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <Chip tone={m.role === ROLES.ORG_ADMIN ? 'active' : 'neutral'}>{ROLE_LABELS[m.role]}</Chip>
                    {canManage && m.id !== user.id && (
                      <div className="row gap-8">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={m.status === 'active' ? 'ban' : 'check'}
                          title={m.status === 'active' ? 'Deactivate' : 'Re-activate'}
                          disabled={m.role === ROLES.ORG_ADMIN && m.status === 'active' && activeAdmins <= 1}
                          onClick={() => setDeactFor(m)}
                          style={{ color: m.status === 'active' ? 'var(--danger)' : 'var(--hp-green-ink)' }}
                        >
                          {m.status === 'active' ? 'Deactivate' : 'Re-activate'}
                        </Button>
                      </div>
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
              <div className="card-sub">Organization scope · no custom permissions</div>
            </div>
          </div>
          <div>
            {[ROLES.ORG_ADMIN, ROLES.ORG_MANAGER].map((r, i) => (
              <div key={r} style={{ padding: '13px 18px', borderBottom: i === 1 ? 'none' : '1px solid var(--line-soft)' }}>
                <div className="row between">
                  <Chip tone={r === ROLES.ORG_ADMIN ? 'active' : 'neutral'}>{ROLE_LABELS[r]}</Chip>
                  <span className="t11 faint">{r === ROLES.ORG_ADMIN ? 'Full organization control' : 'Operations only'}</span>
                </div>
                <p className="t12 muted mt-8" style={{ lineHeight: 1.5 }}>{ROLE_DESCRIPTIONS[r]}</p>
              </div>
            ))}
            <div style={{ padding: '14px 18px', background: 'var(--surface-2)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
              <p className="t11" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                <Icon name="lock" size={12} style={{ verticalAlign: '-1px', marginRight: 5 }} />
                Passwords are <b>self-service</b> — members use “Forgot password” on the sign-in screen (a 6-digit code goes to their
                email). Admins can never see or reset another member's password. The last active admin cannot be demoted or
                deactivated, so an organization can never lock itself out.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Add team member"
        sub="Choose the fixed role when creating the account. Existing identity and role cannot be changed by another admin."
        footer={
          <>
            {error ? <span className="input-error" style={{ marginRight: 'auto' }}>{error}</span> : null}
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Add member'}</Button>
          </>
        }
      >
        {draft ? (
          <div>
            <Field label="Full name" required>
              <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Meera Iyer" />
            </Field>
            <Field label="Email" required hint="This becomes their login ID and can only be changed by the member through the self-service flow.">
              <TextInput type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="name@company.com" />
            </Field>
            {editing ? (
              <Field label="Initial password" required hint="Minimum 8 characters with at least one letter and one number. They can change it in their Profile, or self-reset via Forgot password.">
                <TextInput type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} placeholder="••••••••" />
              </Field>
            ) : null}
            <Field label="Role" required hint={draft.role === ROLES.ORG_ADMIN ? 'Admins manage events, devices, revenue, coupons, defaults and the team.' : 'Managers operate events, devices and guest support — read-only elsewhere.'}>
              <Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                <option value={ROLES.ORG_ADMIN}>Organization Admin</option>
                <option value={ROLES.ORG_MANAGER}>Organization Manager</option>
              </Select>
            </Field>
          </div>
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
