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

const MAX_IMAGES = 4
const MAX_RAW_IMAGE_BYTES = 15 * 1024 * 1024 // 15 MB raw input; compressed client-side before sending

function compressImageToDataUrl(file, maxDim = 1400, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => resolve(null)
    reader.onload = () => {
      const rawUrl = String(reader.result || '')
      if (!rawUrl.startsWith('data:image/')) {
        resolve(null)
        return
      }
      const img = new Image()
      img.onerror = () => resolve(rawUrl)
      img.onload = () => {
        try {
          let { width, height } = img
          if (width <= maxDim && height <= maxDim && file.size <= 300 * 1024) {
            resolve(rawUrl)
            return
          }
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height)
            width = Math.max(1, Math.round(width * ratio))
            height = Math.max(1, Math.round(height * ratio))
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(rawUrl)
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          const mime = file.type === 'image/png' && file.size <= 600 * 1024 ? 'image/png' : 'image/jpeg'
          const compressed = canvas.toDataURL(mime, quality)
          resolve(compressed || rawUrl)
        } catch {
          resolve(rawUrl)
        }
      }
      img.src = rawUrl
    }
    reader.readAsDataURL(file)
  })
}

export function SupportThread({ request, mineSide }) {
  const [previewSrc, setPreviewSrc] = useState(null)
  return (
    <>
      <div className="support-thread">
        {(request.messages || []).map((message, idx) => {
          const mine = message.side === mineSide
          const imgs = Array.isArray(message.images)
            ? message.images.filter((src) => typeof src === 'string' && src.trim().length > 0)
            : []
          return (
            <div key={message.id || idx} className="thread-msg" style={mine ? { flexDirection: 'row-reverse' } : undefined}>
              <Avatar name={message.authorName || 'User'} size={29} style={mine ? { background: 'var(--hp-pink)' } : undefined} />
              <div style={{ maxWidth: '88%', minWidth: 0 }}>
                <div className="thread-meta" style={mine ? { textAlign: 'right' } : undefined}>
                  {message.authorName} · {message.authorRole} · {relativeTime(message.at)}
                </div>
                {message.text ? <div className={`thread-bubble${mine ? ' mine' : ''}`} style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div> : null}
                {imgs.length ? (
                  <div className="support-images" style={mine ? { justifyContent: 'flex-end' } : undefined}>
                    {imgs.map((src, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setPreviewSrc(src)}
                        title="Click to view full image"
                        style={{
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'zoom-in',
                          display: 'inline-block',
                        }}
                      >
                        <img src={src} alt={`Attachment ${index + 1}`} loading="lazy" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {previewSrc ? (
        <div
          className="modal-backdrop"
          onClick={() => setPreviewSrc(null)}
          style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '88vh',
              background: 'var(--surface, #161822)',
              border: '1px solid var(--line, rgba(255,255,255,0.12))',
              borderRadius: 14,
              padding: 14,
              boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div className="row between gap-12">
              <span className="t12 muted">Attachment Preview</span>
              <div className="row gap-8">
                <a
                  href={previewSrc}
                  download={`support-image-${Date.now()}.jpg`}
                  className="btn btn-outline btn-sm"
                >
                  Download
                </a>
                <Button variant="ghost" size="sm" onClick={() => setPreviewSrc(null)}>
                  Close
                </Button>
              </div>
            </div>
            <img
              src={previewSrc}
              alt="Support attachment preview"
              style={{ maxWidth: '84vw', maxHeight: '76vh', objectFit: 'contain', borderRadius: 10 }}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}

export function MessageComposer({ onSend, busy = false, placeholder = 'Write a message…', buttonLabel = 'Send', requireText = false }) {
  const [message, setMessage] = useState('')
  const [images, setImages] = useState([])
  const [fileError, setFileError] = useState('')
  const [processingFiles, setProcessingFiles] = useState(false)

  const processFiles = async (files) => {
    setFileError('')
    if (!files.length) return
    if (images.length + files.length > MAX_IMAGES) {
      setFileError(`Attach up to ${MAX_IMAGES} images per message.`)
      return
    }
    const valid = files.filter((file) => {
      if (!file.type || !file.type.startsWith('image/')) {
        setFileError('Only image files are supported.')
        return false
      }
      if (file.size > MAX_RAW_IMAGE_BYTES) {
        setFileError('Each image must be 15 MB or smaller.')
        return false
      }
      return true
    })
    if (!valid.length) return
    setProcessingFiles(true)
    try {
      const items = await Promise.all(valid.map((file) => compressImageToDataUrl(file)))
      setImages((current) => [...current, ...items.filter(Boolean)].slice(0, MAX_IMAGES))
    } finally {
      setProcessingFiles(false)
    }
  }

  const addImages = (event) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    void processFiles(files)
  }

  const handlePaste = (event) => {
    const items = [...(event.clipboardData?.items || [])]
    const imageFiles = items
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean)
    if (imageFiles.length > 0) {
      event.preventDefault()
      void processFiles(imageFiles)
    }
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
      <TextArea value={message} onChange={(e) => setMessage(e.target.value)} onPaste={handlePaste} placeholder={placeholder} />
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
          <label className="btn btn-outline btn-sm" style={{ cursor: processingFiles ? 'wait' : 'pointer', opacity: processingFiles ? 0.7 : 1 }}>
            <Icon name="image" size={14} /> {processingFiles ? 'Processing…' : `Add images (${images.length}/${MAX_IMAGES})`}
            <input type="file" accept="image/*" multiple onChange={addImages} disabled={processingFiles || busy} style={{ display: 'none' }} />
          </label>
          {fileError ? <div className="input-error">{fileError}</div> : null}
        </div>
        <Button variant="primary" size="sm" icon="send" onClick={send} disabled={busy || processingFiles || (requireText ? !message.trim() : (!message.trim() && !images.length))}>
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}
