// Shared UI primitives.

import { useEffect, useState } from 'react'
import Icon from '../lib/icons.jsx'
import { initials, avatarColor } from '../lib/format.js'

export function Button({ children, variant = 'outline', size, icon, onClick, disabled, type = 'button', style, title, className = '' }) {
  const cls = `btn btn-${variant}${size ? ` btn-${size}` : ''}${className}`
  return (
    <button className={cls} onClick={onClick} disabled={disabled} type={type} title={title} style={style}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  )
}

export function IconButton({ icon, onClick, title, danger = false, size = 18, disabled }) {
  return (
    <button
      className={`btn btn-ghost btn-icon${danger ? '' : ''}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={danger ? { color: 'var(--danger)' } : { color: 'var(--muted)' }}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}

export function Card({ children, pad = false, className = '', style }) {
  return <div className={`card${pad ? ' card-pad' : ''} ${className}`} style={style}>{children}</div>
}

export function CardHead({ title, sub, children }) {
  return (
    <div className="card-head">
      <div>
        <div className="card-title">{title}</div>
        {sub ? <div className="card-sub">{sub}</div> : null}
      </div>
      {children}
    </div>
  )
}

export function StatCard({ label, value, foot, icon, iconBg, iconColor, onClick, delta, deltaLabel }) {
  return (
    <div className="stat" style={onClick ? { cursor: 'pointer' } : undefined} onClick={onClick}>
      <div className="row between">
        <span className="stat-label">{label}</span>
        {icon ? (
          <span className="stat-ico" style={{ background: iconBg || 'var(--hp-pink-soft)', color: iconColor || 'var(--hp-pink)' }}>
            <Icon name={icon} size={16} />
          </span>
        ) : null}
      </div>
      <div className="stat-value num">{value}</div>
      {(foot || delta != null) && (
        <div className="stat-foot">
          {delta != null ? (
            <span className={delta >= 0 ? 'delta-up' : 'delta-down'}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
            </span>
          ) : null}
          {deltaLabel ? <span>{deltaLabel}</span> : null}
          {foot ? <span>{foot}</span> : null}
        </div>
      )}
    </div>
  )
}

export function Chip({ tone = 'neutral', children, dot = false, style }) {
  return (
    <span className={`chip chip-${tone}`} style={style}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  )
}

export function Avatar({ name = '', size = 34, style }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36, background: avatarColor(name), ...style }}>
      {initials(name)}
    </span>
  )
}

export function Field({ label, required = false, hint, error, children }) {
  return (
    <div className="field">
      {label ? (
        <label className="label">
          {label} {required ? <span className="req">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <div className="input-error">{error}</div> : hint ? <div className="input-hint">{hint}</div> : null}
    </div>
  )
}

export function TextInput(props) {
  return <input className="input" {...props} />
}
export function TextArea(props) {
  return <textarea className="textarea" {...props} />
}
export function Select({ children, ...props }) {
  return (
    <select className="select" {...props}>
      {children}
    </select>
  )
}

// Password field with a show/hide (eye) toggle.
export function PasswordInput({ style, ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-wrap" style={style}>
      <input className="input" type={show ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="pw-eye"
        onClick={() => setShow((s) => !s)}
        title={show ? 'Hide password' : 'Show password'}
        aria-label={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        <Icon name={show ? 'eye-off' : 'eye'} size={16} />
      </button>
    </div>
  )
}

// Light / dark switch — icon pill (floating on Login, inline in Profile).
export function ThemeToggle({ theme, onToggle, floating = false, style }) {
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      className={`theme-btn${floating ? ' float' : ''}`}
      onClick={onToggle}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={style}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={floating ? 18 : 16} />
      {!floating ? <span className="t12 fw6">{dark ? 'Light mode' : 'Dark mode'}</span> : null}
    </button>
  )
}

// Light/Dark segmented control (Profile → Appearance).
export function ThemeSegmented({ theme, onChange }) {
  return (
    <div className="theme-seg" role="group" aria-label="Colour theme">
      {[
        { id: 'light', label: 'Light', icon: 'sun' },
        { id: 'dark', label: 'Dark', icon: 'moon' },
      ].map((o) => (
        <button key={o.id} type="button" className={theme === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
          <Icon name={o.icon} size={14} /> {o.label}
        </button>
      ))}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', style }) {
  return (
    <div className="search-box" style={style}>
      <Icon name="search" size={15} />
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

export function Toggle({ on, onChange, disabled = false }) {
  return <button type="button" className={`toggle${on ? ' on' : ''}`} disabled={disabled} onClick={() => !disabled && onChange(!on)} aria-pressed={on} />
}

export function Checkbox({ checked, onChange, label, disabled }) {
  return (
    <label className="check" style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="box">
        <Icon name="check" size={11} strokeWidth={3.2} style={{ color: '#fff' }} />
      </span>
      {label != null ? <span>{label}</span> : null}
    </label>
  )
}

export function Modal({ open, onClose, title, sub, children, footer, width }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${width === 'wide' ? ' wide' : width === 'xwide' ? ' xwide' : ''}`}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            {sub ? <div className="modal-sub">{sub}</div> : null}
          </div>
          <IconButton icon="x" onClick={onClose} title="Close" />
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, loading = false, children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      {message ? <p className="t13 muted" style={{ marginBottom: children ? 14 : 0 }}>{message}</p> : null}
      {children}
    </Modal>
  )
}

export function Drawer({ open, onClose, title, sub, children, footer, icon }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div className="row gap-12">
            {icon ? (
              <span className="stat-ico" style={{ background: 'var(--hp-pink-soft)', color: 'var(--hp-pink)', width: 40, height: 40, borderRadius: 11 }}>
                <Icon name={icon} size={19} />
              </span>
            ) : null}
            <div>
              <div style={{ fontSize: 16, fontWeight: 680, letterSpacing: '-0.01em' }}>{title}</div>
              {sub ? <div className="t12 muted" style={{ marginTop: 2 }}>{sub}</div> : null}
            </div>
          </div>
          <IconButton icon="x" onClick={onClose} title="Close" />
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line-soft)', background: 'var(--surface-2)' }}>{footer}</div> : null}
      </div>
    </>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={`tab${active === t.id ? ' active' : ''}`} onClick={() => onChange(t.id)}>
          {t.icon ? <Icon name={t.icon} size={15} /> : null}
          {t.label}
          {t.count != null ? <span className="count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Spinner({ small = false }) {
  return <span className={`spinner${small ? ' sm' : ''}`} />
}

export function PageLoader() {
  return (
    <div className="page-load">
      <Spinner />
    </div>
  )
}

export function EmptyState({ icon = 'search', title, message, action }) {
  return (
    <div className="empty">
      <div className="empty-ico">
        <Icon name={icon} size={24} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  )
}

export function ProgressBar({ value, max, color = 'var(--hp-pink)', height = 7, showLabel = true, labelRight }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      {showLabel && (
        <div className="row between t12 mb-8" style={{ marginBottom: 5 }}>
          <span className="muted">{labelRight || ''}</span>
        </div>
      )}
      <div className="progress" style={{ height }}>
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function Pagination({ page, pages, total, onPage, pageSize = 10 }) {
  if (pages <= 1 && total <= pageSize) return null
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="pager">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="pager-btns">
        <Button size="sm" variant="outline" icon="chevron-left" disabled={page <= 1} onClick={() => onPage(page - 1)} />
        <span className="num" style={{ padding: '0 6px', fontSize: 12.5 }}>
          {page} / {pages}
        </span>
        <Button size="sm" variant="outline" icon="chevron-right" disabled={page >= pages} onClick={() => onPage(page + 1)} />
      </div>
    </div>
  )
}

// Placeholder for data the API did not return. Never render blank cells —
// an explicit "not available" tells the operator the gap is upstream.
export const NA_TEXT = 'Not available'
export function isMissing(v) {
  return v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v))
}
export function NA({ text = NA_TEXT, title = 'This data was not returned by the server.' }) {
  return <span className="t12" style={{ color: 'var(--faint)', fontStyle: 'italic' }} title={title}>{text}</span>
}
// Value-or-placeholder for plain text cells.
export function orNA(v, fmt) {
  if (isMissing(v)) return <NA />
  return fmt ? fmt(v) : v
}

export function KV({ k, v, mono = false }) {
  return (
    <div className="row between" style={{ padding: '7px 0', borderBottom: '1px dashed var(--line-soft)' }}>
      <span className="t12 muted">{k}</span>
      <span className="t13 fw6" style={{ fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined }}>{isMissing(v) || v === '—' ? <NA /> : v}</span>
    </div>
  )
}

export function WarnBanner({ tone = 'warn', icon = 'alert', children, action }) {
  const map = {
    warn: { bg: 'var(--warn-soft)', color: 'var(--warn)', line: 'rgba(180,83,9,.18)' },
    danger: { bg: 'var(--danger-soft)', color: 'var(--danger)', line: 'rgba(217,45,32,.18)' },
    info: { bg: 'var(--hp-blue-soft)', color: 'var(--hp-blue)', line: 'rgba(56,113,193,.18)' },
    pink: { bg: 'var(--hp-pink-soft)', color: 'var(--hp-pink-deep)', line: 'rgba(234,9,127,.18)' },
  }
  const s = map[tone]
  return (
    <div
      className="row gap-12"
      style={{ background: s.bg, border: `1px solid ${s.line}`, color: s.color, borderRadius: 'var(--r-md)', padding: '11px 14px', alignItems: 'flex-start', flexWrap: 'wrap' }}
    >
      <Icon name={icon} size={17} style={{ marginTop: 1, flex: 'none' }} />
      <div className="grow t13" style={{ fontWeight: 530 }}>{children}</div>
      {action}
    </div>
  )
}
