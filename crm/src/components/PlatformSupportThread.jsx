import { useState } from 'react'
import { Avatar, Button, Chip, TextArea, WarnBanner } from './ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { relativeTime } from '../lib/format.js'

export const SUPPORT_STATUS = {
  new: { label: 'Awaiting review', tone: 'warn' },
  denied: { label: 'Denied', tone: 'danger' },
  open: { label: 'Open', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'purple' },
  resolved: { label: 'Resolved', tone: 'active' },
}

export const SUPPORT_PRIORITY = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warn' },
  urgent: { label: 'Urgent', tone: 'danger' },
}

export const SUPPORT_CATEGORIES = {
  technical: 'Technical / product',
  billing: 'Billing / subscription',
  account: 'Account / access',
  feature: 'Feature request',
  other: 'Other',
}

export function SupportMeta({ request }) {
  const status = SUPPORT_STATUS[request.status] || SUPPORT_STATUS.new
  const priority = SUPPORT_PRIORITY[request.priority] || SUPPORT_PRIORITY.medium
  return (
    <div className="row wrap gap-8">
      <Chip tone={status.tone} dot>{status.label}</Chip>
      <Chip tone={priority.tone}>{priority.label} priority</Chip>
      <Chip tone="neutral">{SUPPORT_CATEGORIES[request.category] || request.category}</Chip>
      {request.ticketNo ? <Chip tone="pink">{request.ticketNo}</Chip> : null}
    </div>
  )
}

export function SupportDecision({ request }) {
  if (request.status === 'denied' && request.decision?.reason) {
    return (
      <WarnBanner tone="danger" icon="ban">
        <b>Request denied by {request.decision.byName || 'HappyPix'}.</b>
        <div style={{ marginTop: 4, fontWeight: 450, lineHeight: 1.55 }}>{request.decision.reason}</div>
      </WarnBanner>
    )
  }
  if (request.status === 'resolved' && request.resolution) {
    return (
      <WarnBanner tone="info" icon="check-circle">
        <b>Platform resolution</b>
        <div style={{ marginTop: 4, fontWeight: 450, lineHeight: 1.55 }}>{request.resolution}</div>
        <div className="t11" style={{ marginTop: 5 }}>Only the HappyPix platform team can reopen this ticket.</div>
      </WarnBanner>
    )
  }
  if (request.status === 'new') {
    return (
      <WarnBanner tone="warn" icon="clock">
        This request is waiting for platform review. HappyPix will either accept it as a ticket or deny it with a written reason.
      </WarnBanner>
    )
  }
  return null
}

export function SupportThread({ request, mineSide }) {
  return (
    <div className="support-thread">
      {(request.messages || []).map((message) => {
        const mine = message.side === mineSide
        return (
          <div key={message.id} className="thread-msg" style={mine ? { flexDirection: 'row-reverse' } : undefined}>
            <Avatar name={message.authorName || 'User'} size={29} style={mine ? { background: 'var(--hp-pink)' } : undefined} />
            <div style={{ maxWidth: '88%', minWidth: 0 }}>
              <div className="thread-meta" style={mine ? { textAlign: 'right' } : undefined}>
                {message.authorName} · {message.authorRole} · {relativeTime(message.at)}
              </div>
              {message.text ? <div className={`thread-bubble${mine ? ' mine' : ''}`} style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div> : null}
              {message.images?.length ? (
                <div className="support-images" style={mine ? { justifyContent: 'flex-end' } : undefined}>
                  {message.images.map((src, index) => (
                    <a key={index} href={src} target="_blank" rel="noreferrer" title="Open image">
                      <img src={src} alt={`Attachment ${index + 1}`} />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function MessageComposer({ onSend, busy = false, placeholder = 'Write a message…', buttonLabel = 'Send', requireText = false }) {
  const [message, setMessage] = useState('')
  const [images, setImages] = useState([])
  const [fileError, setFileError] = useState('')

  const addImages = (event) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    setFileError('')
    if (images.length + files.length > 4) {
      setFileError('Attach up to 4 images per message.')
      return
    }
    const valid = files.filter((file) => {
      if (!file.type.startsWith('image/')) return false
      if (file.size > 350 * 1024) {
        setFileError('Each image must be 350 KB or smaller in demo mode.')
        return false
      }
      return true
    })
    Promise.all(valid.map((file) => new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }))).then((items) => setImages((current) => [...current, ...items.filter(Boolean)].slice(0, 4)))
  }

  const send = async () => {
    if (requireText && !message.trim()) return
    if (!message.trim() && !images.length) return
    const ok = await onSend({ message: message.trim(), images })
    if (ok !== false) {
      setMessage('')
      setImages([])
      setFileError('')
    }
  }

  return (
    <div>
      <TextArea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={placeholder} />
      {images.length ? (
        <div className="support-compose-images">
          {images.map((src, index) => (
            <span key={index}>
              <img src={src} alt={`Selected attachment ${index + 1}`} />
              <button type="button" onClick={() => setImages(images.filter((_, i) => i !== index))} title="Remove image"><Icon name="x" size={10} /></button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="row between gap-12 mt-8">
        <div>
          <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
            <Icon name="image" size={14} /> Add images
            <input type="file" accept="image/*" multiple onChange={addImages} style={{ display: 'none' }} />
          </label>
          {fileError ? <div className="input-error">{fileError}</div> : null}
        </div>
        <Button variant="primary" size="sm" icon="send" onClick={send} disabled={busy || (requireText ? !message.trim() : (!message.trim() && !images.length))}>
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}
