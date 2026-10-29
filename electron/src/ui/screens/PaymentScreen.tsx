import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { CheckoutQuote, PaymentOrder } from '../types'
import { ScreenShell } from '../components/ScreenShell'
import { BackButton, PrimaryButton, SecondaryButton } from '../components/Controls'
import { Icon } from '../components/Icon'
import { useQrCode } from '../hooks/useQrCode'
import { sound } from '../services/sound'

export function PaymentScreen({
  secondsLeft,
  onBack,
  requestQuote,
  createPayment,
  paymentStatus,
  completeFree,
  onComplete,
}: {
  secondsLeft: number
  onBack: () => void
  requestQuote: (coupon?: string) => Promise<CheckoutQuote>
  createPayment: (quote: CheckoutQuote) => Promise<PaymentOrder>
  paymentStatus: (paymentId: string) => Promise<PaymentOrder['status']>
  completeFree: (quote: CheckoutQuote) => Promise<void>
  onComplete: (quote: CheckoutQuote, payment: PaymentOrder | null) => void
}) {
  const [quote, setQuote] = useState<CheckoutQuote | null>(null)
  const [coupon, setCoupon] = useState('')
  const [couponError, setCouponError] = useState<string | null>(null)
  const [payment, setPayment] = useState<PaymentOrder | null>(null)
  const [phase, setPhase] = useState<'quoting' | 'summary' | 'creating' | 'waiting' | 'paid' | 'error'>('quoting')
  const [error, setError] = useState<string | null>(null)
  const polling = useRef<number | null>(null)
  const qrSource = useQrCode(payment?.qrPayload ?? null, 400)

  const loadQuote = useCallback(async (code?: string) => {
    setPhase('quoting')
    setCouponError(null)
    setError(null)
    try {
      const next = await requestQuote(code)
      setQuote(next)
      setPayment(null)
      setPhase('summary')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not calculate this order.'
      if (code) {
        setCouponError(message)
        setPhase('summary')
      } else {
        setError(message)
        setPhase('error')
      }
    }
  }, [requestQuote])

  useEffect(() => {
    let active = true
    void requestQuote().then((next) => {
      if (!active) return
      setQuote(next)
      setPhase('summary')
    }).catch((reason: unknown) => {
      if (!active) return
      setError(reason instanceof Error ? reason.message : 'Could not calculate this order.')
      setPhase('error')
    })
    return () => {
      active = false
    }
  }, [requestQuote])

  useEffect(() => () => {
    if (polling.current) window.clearInterval(polling.current)
  }, [])

  const applyCoupon = (event: FormEvent) => {
    event.preventDefault()
    if (coupon.trim()) void loadQuote(coupon.trim())
  }

  const removeCoupon = () => {
    setCoupon('')
    void loadQuote()
  }

  const beginPayment = async () => {
    if (!quote) return
    setError(null)
    setPhase('creating')
    try {
      if (quote.finalAmount === 0) {
        await completeFree(quote)
        sound.success()
        setPhase('paid')
        window.setTimeout(() => onComplete(quote, null), 900)
        return
      }
      const order = await createPayment(quote)
      setPayment(order)
      setPhase('waiting')
      polling.current = window.setInterval(async () => {
        try {
          const status = await paymentStatus(order.paymentId)
          if (status === 'paid') {
            if (polling.current) window.clearInterval(polling.current)
            setPayment({ ...order, status })
            setPhase('paid')
            sound.success()
            window.setTimeout(() => onComplete(quote, { ...order, status }), 1200)
          } else if (status === 'failed') {
            if (polling.current) window.clearInterval(polling.current)
            setPhase('error')
            setError('Payment was not completed. No amount has been charged by HappyPix.')
          }
        } catch {
          // A temporary polling failure should not discard a valid payment QR.
        }
      }, 1800)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start payment.')
      setPhase('error')
    }
  }

  const cancelPayment = () => {
    if (polling.current) window.clearInterval(polling.current)
    setPayment(null)
    setPhase('summary')
  }

  return (
    <ScreenShell screen="payment" secondsLeft={secondsLeft} title="Secure payment" subtitle="Your price and coupon are verified by HappyPix before a payment QR is created.">
      {phase === 'quoting' || phase === 'creating' ? (
        <div className="center-state"><span className="loader"/><h2>{phase === 'quoting' ? 'Checking event price…' : 'Creating secure UPI QR…'}</h2><p>Please keep this screen open.</p></div>
      ) : phase === 'waiting' && quote && payment ? (
        <div className="payment-waiting">
          <section className="qr-panel">
            <span className="section-kicker">SCAN WITH ANY UPI APP</span>
            <div className="payment-amount">₹{quote.finalAmount}</div>
            <div className="qr-frame">{qrSource ? <img src={qrSource} alt="UPI payment QR code"/> : <span className="loader"/>}<i/><i/><i/><i/></div>
            <p>GPay · PhonePe · Paytm · BHIM</p>
          </section>
          <section className="payment-status-card">
            <div className="waiting-animation"><span/><span/><span/></div>
            <h2>Waiting for payment</h2>
            <p>We will continue automatically after the payment provider confirms it.</p>
            <dl><div><dt>Payment ID</dt><dd>{payment.paymentId}</dd></div><div><dt>Settlement</dt><dd>{quote.settlement === 'wallet' ? 'HappyPix wallet' : 'Organization UPI'}</dd></div><div><dt>Amount</dt><dd>₹{quote.finalAmount}</dd></div></dl>
            <SecondaryButton onClick={cancelPayment}>Cancel this QR</SecondaryButton>
          </section>
        </div>
      ) : phase === 'paid' ? (
        <div className="center-state success-state"><div className="big-check"><Icon name="check" size={52}/></div><h2>{quote?.finalAmount === 0 ? 'Free order registered' : 'Payment received!'}</h2><p>Get ready for your photo session…</p></div>
      ) : (
        <div className="payment-summary-layout">
          <section className="summary-card">
            <span className="section-kicker">ORDER SUMMARY</span>
            {quote && <>
              <div className="summary-line"><span>{quote.prints} print{quote.prints === 1 ? '' : 's'} × ₹{quote.unitPrice}</span><b>₹{quote.gross}</b></div>
              {quote.discount > 0 && <div className="summary-line discount"><span>Discount · {quote.couponCode}</span><b>− ₹{quote.discount}</b></div>}
              <div className="summary-total"><span>Final total</span><strong>₹{quote.finalAmount}</strong></div>
              {quote.couponMessage && <div className="coupon-success"><Icon name="ticket"/>{quote.couponMessage}<button onClick={removeCoupon}>Remove</button></div>}
            </>}
          </section>
          <section className="coupon-card">
            <div className="coupon-icon"><Icon name="ticket" size={28}/></div>
            <h2>Have a coupon?</h2>
            <p>We’ll validate the code, event and remaining quantity securely.</p>
            {!quote?.couponCode && <form onSubmit={applyCoupon}><input value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="ENTER CODE"/><button disabled={!coupon.trim()}>Apply</button></form>}
            {couponError && <div className="coupon-error"><Icon name="info" size={17}/>{couponError}</div>}
            {error && <div className="form-error"><Icon name="info" size={18}/>{error}</div>}
            <div className="payment-trust"><Icon name="wallet"/><span><b>{quote?.settlement === 'upi' ? 'Organization UPI' : 'HappyPix wallet'}</b>Your QR is created after the server locks the final price.</span></div>
          </section>
        </div>
      )}
      {(phase === 'summary' || phase === 'error') && <div className="screen-actions"><BackButton onClick={onBack}/><PrimaryButton onClick={() => void beginPayment()} disabled={!quote}>{quote?.finalAmount === 0 ? 'Register free order' : 'Generate UPI QR'}<Icon name="arrow-right"/></PrimaryButton></div>}
    </ScreenShell>
  )
}
