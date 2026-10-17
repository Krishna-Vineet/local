import { useEffect, useState } from 'react'
import type { PrintOutcome } from '../types'
import { ScreenShell } from '../components/ScreenShell'
import { PrimaryButton } from '../components/Controls'
import { Icon } from '../components/Icon'
import { useQrCode } from '../hooks/useQrCode'

export function SuccessScreen({ outcome, onDone }: { outcome: PrintOutcome; onDone: () => void }) {
  const [seconds, setSeconds] = useState(18)
  const qr = useQrCode(outcome.shareUrl, 360)
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) {
        window.clearInterval(timer)
        onDone()
        return 0
      }
      return value - 1
    }), 1000)
    return () => window.clearInterval(timer)
  }, [onDone])

  return (
    <ScreenShell screen="success" className={`success-screen ${outcome.success ? '' : 'is-failed'}`}>
      <div className="success-layout">
        <section className="success-copy">
          <div className="success-mark">{outcome.success ? <Icon name="check" size={58}/> : <Icon name="x" size={58}/>}</div>
          <span className="eyebrow">{outcome.success ? 'ALL DONE' : 'PRINTING NEEDS HELP'}</span>
          <h1>{outcome.success ? 'Your memories are printing!' : 'We couldn’t finish the print.'}</h1>
          <p>{outcome.success ? 'Please collect every copy from the printer tray. They may still be warm.' : outcome.error || 'Please ask the booth operator for help. Your payment and session have been recorded.'}</p>
          {outcome.jobId && <div className="job-reference">Print job <b>{outcome.jobId}</b></div>}
          <PrimaryButton onClick={onDone}>Finish now <span>{seconds}s</span></PrimaryButton>
        </section>
        {outcome.shareUrl ? <section className="download-card"><span className="section-kicker">YOUR DIGITAL COPY</span><h2>Scan. Save. Share.</h2><div className="download-qr">{qr ? <img src={qr} alt="QR code to download digital photos"/> : <span className="loader"/>}</div><p>Open the camera on your phone and scan this QR.</p><small>The secure download link is temporary.</small></section> : <section className="thank-you-card"><Icon name="heart" size={52}/><h2>Thank you for making memories with us.</h2><p>Your session will reset automatically for the next guest.</p></section>}
      </div>
    </ScreenShell>
  )
}
