import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import BoothHeader from '../../components/BoothHeader'
import Loader from '../../components/Loader'
import { useBooth } from '../../context/BoothContext'
import TemplateCanvas from '../../components/TemplateCanvas'
import { EVENT_SAMPLES } from '../../data/templates'

const VALID_COUPONS = { HAPPY18: 18, WELCOME10: 10, PARTY20: 20, GALA15: 15 }

export default function Payment(){
  const nav = useNavigate()
  const { config, session, coupon, setCoupon, couponApplied, setCouponApplied } = useBooth()
  const [secondsLeft, setSecondsLeft] = useState(90)
  const [phase, setPhase] = useState('summary') // summary | creating | waiting | paid
  const [couponError, setCouponError] = useState('')
  const [paySeconds, setPaySeconds] = useState(120)

  const unit = session.template?.price || 0
  const total = session.prints * unit
  const percent = couponApplied ? (VALID_COUPONS[coupon.trim().toUpperCase()] || 0) : 0
  const discount = Math.round((total * percent) / 100)
  const amount = Math.max(total - discount, 0)

  useEffect(()=>{ const t = setInterval(()=>setSecondsLeft(s=>Math.max(0,s-1)),1000); return ()=>clearInterval(t) },[])
  useEffect(()=>{ if(phase==='summary' && secondsLeft===0) nav('/booth/start') },[secondsLeft, phase])

  useEffect(()=>{
    if(phase!=='waiting') return
    const t = setInterval(()=> setPaySeconds(v=>{
      if(v<=1){ clearInterval(t); setPhase('summary'); setPaySeconds(120); return 0 }
      return v-1
    }),1000)
    return ()=>clearInterval(t)
  },[phase])

  function applyCoupon(){
    const code = coupon.trim().toUpperCase()
    if(!code) return
    if(VALID_COUPONS[code]){
      setCoupon(code); setCouponApplied(true); setCouponError('')
    } else {
      setCouponApplied(false)
      setCouponError('That code isn’t valid for this event.')
    }
  }
  function clearCoupon(){ setCouponApplied(false); setCoupon(''); setCouponError('') }

  function pay(){
    if(amount === 0){
      setPhase('creating')
      setTimeout(()=>{ setPhase('paid'); setTimeout(()=>nav('/booth/camera'), 600) }, 650)
      return
    }
    setPhase('creating')
    setTimeout(()=>{ setPhase('waiting'); setPaySeconds(120) }, 850)
  }
  function confirmed(){
    setPhase('paid')
    setTimeout(()=>nav('/booth/camera'), 600)
  }

  if(phase==='creating') return <Loader text={amount===0 ? 'Confirming your session…' : 'Creating the payment request…'} sub="This only takes a second" />
  if(phase==='paid') return <Loader text="Payment received" sub="Opening the camera" />

  const template = session.template

  return (
    <div className="booth-container">
      <BoothHeader
        title={phase==='waiting' ? 'Scan to pay' : 'Review & pay'}
        subtitle={phase==='waiting' ? 'Use any UPI app — the booth unlocks as soon as it clears' : 'A coupon can be applied before you pay'}
        step="STEP 4 OF 5"
        secondsLeft={phase==='waiting' ? paySeconds : secondsLeft}
      />

      {phase==='waiting' ? (
        <div className="pay-body">
          <div className="pay-qr-card">
            <div className="pay-qr-label">Scan with any UPI app</div>
            <div className="pay-amount">₹{amount}</div>
            <div className="pay-qr-box">
              <QRCodeSVG value="https://happypix.in/#demo-payment" size={186} level="H" />
            </div>
            <div className="pay-upi">or pay to <b>happypix@upi</b></div>
            <div className="pay-qr-actions">
              <button className="btn-ghost" onClick={()=>setPhase('summary')}>Cancel</button>
              <button className="btn-success" onClick={confirmed}>Done</button>
            </div>
            <p className="pay-demo-note">
              Demo mode. The QR is a placeholder — press Done to simulate a successful payment and open the camera.
            </p>
          </div>

          <div className="pay-summary-card">
            <div className="pay-summary-title">Order summary</div>
            <div className="pay-summary-row"><span>Template</span><span>{template?.name}</span></div>
            <div className="pay-summary-row"><span>{session.prints} × ₹{unit}</span><span>₹{total}</span></div>
            {discount > 0 && <div className="pay-summary-row is-discount"><span>Coupon {coupon.toUpperCase()}</span><span>− ₹{discount}</span></div>}
            <div className="pay-summary-row is-total"><span>Total</span><span>₹{amount}</span></div>
            <div className="pay-note">
              QR expires in {Math.floor(paySeconds/60)}:{String(paySeconds%60).padStart(2,'0')} · digital copy {session.digitalCopy ? 'included' : 'not included'}
            </div>
          </div>
        </div>
      ) : (
        <div className="pay-body">
          <div className="pay-form-card">
            <div className="panel-label">Coupon</div>
            <div className="pay-coupon-row">
              <input
                className="field-input"
                value={coupon}
                onChange={e=>{ setCoupon(e.target.value); setCouponError('') }}
                placeholder="Enter code"
              />
              {couponApplied
                ? <button className="btn-ghost" onClick={clearCoupon}>Remove</button>
                : <button className="btn-primary" onClick={applyCoupon}>Apply</button>}
            </div>
            {couponError && <div className="pay-error">{couponError}</div>}
            {couponApplied && <div className="pay-success">Coupon applied — {percent}% off.</div>}
            <div className="pay-hint">Demo codes: HAPPY18 · PARTY20 · GALA15</div>

            <div className="pay-breakdown">
              <div className="pay-summary-row"><span>Prints ({session.prints})</span><span>₹{total}</span></div>
              {discount > 0 && <div className="pay-summary-row is-discount"><span>Discount</span><span>− ₹{discount}</span></div>}
              <div className="pay-summary-row is-total"><span>Amount due</span><span>{amount === 0 ? 'Free' : `₹${amount}`}</span></div>
            </div>

            <button className="btn-primary pay-cta" onClick={pay}>
              {amount === 0 ? 'Start complimentary session →' : `Pay ₹${amount} →`}
            </button>
          </div>

          <div className="pay-order-card">
            <div className="panel-label">Your print</div>
            <TemplateCanvas
              template={template}
              height={196}
              maxWidth={236}
              photos={(EVENT_SAMPLES[template?.category] || []).slice(0, template?.slots || 2)}
              orgName={config.orgName}
              eventName={config.eventName}
            />
            <div className="pay-order-meta" style={{ marginTop:10 }}>
              {template?.name} · {template?.printSize} · {template?.slots} shot{template?.slots===1?'':'s'}
            </div>
            <div className="pay-order-meta">{session.prints} print{session.prints===1?'':'s'} · {session.digitalCopy ? 'digital copy included' : 'print only'}</div>
            <div className="pay-order-divider" />
            <div className="pay-order-line"><span>Organisation</span><span>{config.orgName || '—'}</span></div>
            <div className="pay-order-line"><span>Event</span><span>{config.eventName || '—'}</span></div>
          </div>
        </div>
      )}

      <div className="booth-footer">
        <button className="btn-ghost" onClick={()=>nav('/booth/prints')}>← Back</button>
        <div className="booth-footer-mid">No real payment is taken in this demo.</div>
        <span style={{ width:88 }} />
      </div>
    </div>
  )
}
