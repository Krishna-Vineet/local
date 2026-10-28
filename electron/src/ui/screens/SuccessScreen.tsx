import { useEffect, useState } from 'react'
import type { BoothSession, BoothSnapshot, Installation, PrintOutcome } from '../types'
import { ScreenShell } from '../components/ScreenShell'
import { PrimaryButton, SecondaryButton } from '../components/Controls'
import { Icon } from '../components/Icon'
import { useQrCode } from '../hooks/useQrCode'
import { boothApi } from '../services/api'

const CATEGORIES = [
  { id: 'printing', label: 'Printing / jam', desc: 'Print didn’t come out or jammed', icon: 'printer' },
  { id: 'payment', label: 'Payment issue', desc: 'Charged but the print failed', icon: 'wallet' },
  { id: 'quality', label: 'Photo quality', desc: 'Blur, alignment or cut issue', icon: 'camera' },
  { id: 'general', label: 'Something else', desc: 'A question or general help', icon: 'info' },
] as const

type CategoryId = typeof CATEGORIES[number]['id']

export function SuccessScreen({
  outcome,
  session,
  installation,
  snapshot,
  onDone,
  onRetryPrint,
}: {
  outcome: PrintOutcome
  session?: BoothSession | null
  installation?: Installation | null
  snapshot?: BoothSnapshot | null
  onDone: () => void
  onRetryPrint?: () => Promise<void> | void
}) {
  const [seconds, setSeconds] = useState(30)
  const [paused, setPaused] = useState(false)
  const [retryingPrint, setRetryingPrint] = useState(false)

  // Issue modal state
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [category, setCategory] = useState<CategoryId>('printing')
  const [guestName, setGuestName] = useState('')
  const [guestContact, setGuestContact] = useState('')
  const [issueMessage, setIssueMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null)
  const [ticketError, setTicketError] = useState<string | null>(null)

  const qr = useQrCode(outcome.shareUrl, 360)

  // Countdown — paused while issue modal is open or QR is generating
  useEffect(() => {
    if (paused || showIssueModal) return
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer)
          onDone()
          return 0
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [onDone, paused, showIssueModal])

  // Whenever QR becomes ready, give guest full time
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (outcome.shareUrl) setSeconds(30)
  }, [outcome.shareUrl])

  const isSuccess = outcome.success !== false

  const handleOpenIssue = () => {
    setPaused(true)
    setShowIssueModal(true)
  }
  const handleCloseIssue = () => {
    setShowIssueModal(false)
    setSubmittedTicketId(null)
    setTicketError(null)
    setPaused(false)
  }

  const handleSubmitIssue = async () => {
    if (!guestContact.trim() || !issueMessage.trim()) return
    if (!installation) {
      setTicketError('This booth is not paired — cannot submit ticket offline.')
      return
    }
    setSubmitting(true)
    setTicketError(null)
    try {
      const res = await boothApi.submitTicket(installation as any, {
        name: guestName.trim() || 'Booth Guest',
        email: guestContact.trim(),
        subject: `Booth issue: ${category.toUpperCase()}`,
        message: issueMessage.trim(),
        category,
        sessionId: session?.id,
        paymentReference: (session as any)?.payment?.paymentId || (session as any)?.quote?.quoteId || undefined,
        eventId: snapshot?.event?.id,
        deviceId: installation?.deviceId,
      } as any)
      if (!res?.ticketId && !(res as any)?.success) throw new Error('No ticket reference returned')
      const tid = (res as any).ticketId || (res as any).id || 'submitted'
      setSubmittedTicketId(String(tid))
    } catch (e) {
      setTicketError(e instanceof Error ? e.message : 'Could not reach HappyPix support. Check connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetryPrint = async () => {
    if (!onRetryPrint) return
    setRetryingPrint(true)
    try {
      await onRetryPrint()
    } finally {
      setRetryingPrint(false)
    }
  }

  return (
    <ScreenShell screen="success" className={`success-screen ${outcome.success ? '' : 'is-failed'}`}>
      <div className="success-layout">
        <section className="success-copy">
          <div className="success-mark">{outcome.success ? <Icon name="check" size={58} /> : <Icon name="x" size={58} />}</div>
          <span className="eyebrow">{outcome.success ? 'ALL DONE' : isSuccess ? 'ALL DONE' : 'PRINTING NEEDS HELP'}</span>
          <h1>{outcome.success ? 'Your memories are printing!' : outcome.error && outcome.error.toLowerCase().includes('printer') ? 'Printer Not Connected' : 'We couldn’t finish the print.'}</h1>
          <p>{outcome.success ? 'Please collect every copy from the printer tray. They may still be warm.' : outcome.error || 'No printer is connected right now. Your digital photos are safe — please ask the booth attendant to check the printer connection and tap Retry Print.'}</p>
          {outcome.jobId && <div className="job-reference">Print job <b>{outcome.jobId}</b></div>}

          {!outcome.success && onRetryPrint && (
            <SecondaryButton onClick={handleRetryPrint} disabled={retryingPrint} className="retry-print-btn">
              {retryingPrint ? <span className="button-loader" /> : null} {retryingPrint ? 'Retrying…' : 'Retry Print'}
            </SecondaryButton>
          )}

          <PrimaryButton onClick={onDone} style={{ width: '100%', marginTop: 14 }}>Finish now <span>{seconds}s</span></PrimaryButton>

          <button className="raise-issue-btn" onClick={handleOpenIssue} type="button">
            ⚠ Need Help? Raise a Guest Support Ticket
          </button>
        </section>

        {outcome.shareUrl ? (
          <section className="download-card">
            <span className="section-kicker">YOUR DIGITAL COPY</span>
            <h2>Scan. Save. Share.</h2>
            <div className="download-qr">{qr ? <img src={qr} alt="QR code to download digital photos" /> : <span className="loader" />}</div>
            <p>Open the camera on your phone and scan this QR.</p>
            <small>🔒 Link is secured and valid for 24 hours.</small>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--faint)', wordBreak: 'break-all' }}>{outcome.shareUrl}</div>
          </section>
        ) : (
          <section className="thank-you-card">
            <Icon name="heart" size={52} />
            <h2>Thank you for making memories with us.</h2>
            <p>Your session will reset automatically for the next guest.</p>
          </section>
        )}
      </div>

      {showIssueModal && (
        <div className="issue-modal-overlay" role="dialog" aria-modal="true" aria-label="Guest Support Request">
          <div className="issue-modal-card">
            <span className="issue-modal-kicker"><Icon name="sparkles" size={14}/>GUEST SUPPORT</span>
            <div className="issue-modal-header">
              <h2>How can we help?</h2>
              <button className="issue-modal-close" onClick={handleCloseIssue} aria-label="Close">✕</button>
            </div>
            <p className="issue-modal-sub">Tell us what went wrong — the ticket goes straight to this event’s manager, and someone will find you at the booth.</p>

            {submittedTicketId ? (
              <div className="ticket-success">
                <div className="ticket-success-circle"><Icon name="check" size={28} /></div>
                <h3>Ticket Submitted!</h3>
                <p className="ticket-ref">Reference: #{submittedTicketId}</p>
                <p>The booth operator and support team have been notified. Someone will assist you shortly.</p>
                <PrimaryButton onClick={handleCloseIssue}>Done</PrimaryButton>
              </div>
            ) : (
              <>
                <div className="issue-cat-grid">
                  {CATEGORIES.map((cat) => (
                    <button key={cat.id} className={`cat-chip ${category === cat.id ? 'active' : ''}`} onClick={() => setCategory(cat.id as CategoryId)} type="button" aria-pressed={category === cat.id}>
                      <span className="cat-chip-icon"><Icon name={cat.icon} size={15}/></span>
                      <span className="cat-chip-copy"><b>{cat.label}</b><small>{cat.desc}</small></span>
                    </button>
                  ))}
                </div>

                <label className="issue-label">YOUR CONTACT (EMAIL OR MOBILE)
                  <input value={guestContact} onChange={(e) => setGuestContact(e.target.value)} placeholder="guest@example.com or mobile number" />
                </label>
                <label className="issue-label">GUEST NAME (OPTIONAL)
                  <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Your name" />
                </label>
                <label className="issue-label">WHAT HAPPENED?
                  <textarea value={issueMessage} onChange={(e) => setIssueMessage(e.target.value)} placeholder="Briefly describe what happened (e.g. print tray jammed, blank paper...)" rows={3} />
                </label>

                <div className="issue-meta">Session: {session?.id ? session.id.slice(-8) : '—'} • Event: {snapshot?.event?.name || 'HappyPix'}</div>

                {ticketError && <div className="issue-error">{ticketError}</div>}

                <PrimaryButton
                  onClick={handleSubmitIssue}
                  disabled={!guestContact.trim() || !issueMessage.trim() || submitting}
                  style={{ width: '100%', marginTop: 12 }}
                >
                  {submitting ? <><span className="button-loader" /> Submitting…</> : <>Submit support ticket<Icon name="arrow-right" size={18}/></>}
                </PrimaryButton>
                <SecondaryButton onClick={handleCloseIssue} style={{ width: '100%', marginTop: 8 }}>Cancel</SecondaryButton>
              </>
            )}
          </div>
        </div>
      )}
    </ScreenShell>
  )
}
