import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BoothHeader from '../../components/BoothHeader'
import Loader from '../../components/Loader'
import { useBooth } from '../../context/BoothContext'
import { QRCodeSVG } from 'qrcode.react'

export default function Payment(){
  const nav = useNavigate()
  const { config, session, coupon, setCoupon, couponApplied, setCouponApplied } = useBooth()
  const [secondsLeft,setSecondsLeft]=useState(60)
  const [phase,setPhase]=useState('summary') // summary | creating | waiting | paid | error
  const [couponError,setCouponError]=useState('')
  const [payTimer,setPayTimer]=useState(120)

  const unit = session.template?.price || 0
  const total = session.prints * unit
  const discount = couponApplied ? Math.round(total * 0.18) : 0 // 18% fake
  const finalAmount = Math.max(total - discount, 0)

  useEffect(()=>{ const t=setInterval(()=>setSecondsLeft(s=>Math.max(0,s-1)),1000); return()=>clearInterval(t)},[])
  useEffect(()=>{ if(phase==='summary' && secondsLeft===0) nav('/booth/start')},[secondsLeft, phase])

  useEffect(()=>{
    if(phase==='waiting'){
      const t=setInterval(()=> setPayTimer(v=>{
        if(v<=1){ clearInterval(t); nav('/booth/start'); return 0 }
        return v-1
      }),1000)
      return()=>clearInterval(t)
    }
  },[phase])

  function applyCoupon(){
    if(!coupon.trim()) return
    const code = coupon.trim().toUpperCase()
    if(['HAPPY18','BOOTH18','WELCOME10','PARTY20'].includes(code)){
      setCouponApplied(true); setCouponError('')
    } else {
      setCouponError('Invalid or expired coupon code.')
    }
  }
  function removeCoupon(){ setCouponApplied(false); setCoupon(''); setCouponError('') }

  function beginPayment(){
    if(finalAmount===0){
      setPhase('creating'); setTimeout(()=>{ setPhase('paid'); setTimeout(()=> nav('/booth/camera'), 700)}, 700)
      return
    }
    setPhase('creating')
    setTimeout(()=> { setPhase('waiting'); setPayTimer(120) }, 900)
  }
  function handleDone(){
    setPhase('paid'); setTimeout(()=> nav('/booth/camera'), 700)
  }
  function handleCancel(){ setPhase('summary') }

  if(phase==='creating') return <Loader text={finalAmount===0 ? 'Activating complimentary session…' : 'Generating UPI QR code…'} sub="Contacting secure gateway" />
  if(phase==='paid') return <Loader text="Payment confirmed ✓" sub="Unlocking camera…" />

  // waiting (QR) screen
  if(phase==='waiting'){
    return (
      <div className="booth-container">
        <BoothHeader title="Scan to Pay" subtitle={`Secure UPI checkout • ${config.orgName} • ${config.eventName}`} step="STEP 4 OF 5" secondsLeft={payTimer} />
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:20, padding:16, flexWrap:'wrap' }}>
          <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:20, padding:18, width:340, textAlign:'center' }}>
            <div style={{ color:'#a78bfa', fontSize:10, fontWeight:800, letterSpacing:1 }}>SCAN WITH ANY UPI APP</div>
            <div style={{ fontSize:28, fontWeight:900, marginTop:6 }}>₹{finalAmount}</div>
            <div style={{ marginTop:10, background:'#fff', borderRadius:12, padding:14, display:'inline-block' }}>
              <QRCodeSVG value="https://happypix.in/#demo-payment" size={190} level="H" />
            </div>
            <div style={{ marginTop:10, color:'#a1a1aa', fontSize:11 }}>Or enter UPI ID manually: <b style={{ color:'#fff' }}>happypix@upi</b></div>
            <div style={{ marginTop:10, display:'flex', gap:8, justifyContent:'center' }}>
              <button onClick={handleCancel} style={{ background:'#171720', border:'1px solid #262634', color:'#d4d4d8', padding:'10px 16px', borderRadius:10, fontWeight:700 }}>Cancel</button>
              <button onClick={handleDone} style={{ background:'#22c55e', color:'#fff', border:'none', padding:'10px 18px', borderRadius:10, fontWeight:800 }}>I’ve Paid — Continue →</button>
            </div>
            <div style={{ marginTop:8, color:'#71717a', fontSize:11, lineHeight:1.5 }}>Demo mode: this QR points to <b>#</b>. Tap “I’ve Paid” to continue to the camera — just like the real booth.</div>
          </div>
          <div style={{ width:360, background:'#0f0f16', border:'1px solid #222232', borderRadius:20, padding:16 }}>
            <div style={{ fontWeight:800, fontSize:13 }}>Order summary</div>
            <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8, fontSize:12, color:'#d4d4d8' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}><span>Template</span><span style={{ fontWeight:700 }}>{session.template?.name}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between' }}><span>Prints ({session.prints} × ₹{unit})</span><span style={{ fontWeight:700 }}>₹{total}</span></div>
              {discount>0 && <div style={{ display:'flex', justifyContent:'space-between', color:'#4ade80' }}><span>Coupon ({coupon.toUpperCase()}) −18%</span><span>−₹{discount}</span></div>}
              <div style={{ borderTop:'1px solid #222232', paddingTop:8, display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:14 }}><span>To pay</span><span>₹{finalAmount}</span></div>
            </div>
            <div style={{ marginTop:12, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:12, padding:10, fontSize:11, color:'#c4b5fd' }}>
              ⏱ QR expires in <b>{Math.floor(payTimer/60)}:{String(payTimer%60).padStart(2,'0')}</b>. Digital delivery {session.digitalCopy ? 'enabled ✓' : 'skipped'}.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // summary
  return (
    <div className="booth-container">
      <BoothHeader title="Payment & Order Review" subtitle="All prices and discounts are verified securely before shooting begins" step="STEP 4 OF 5" secondsLeft={secondsLeft} />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:20, padding:16, flexWrap:'wrap' }}>
        <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:20, padding:18, width:380 }}>
          <div style={{ color:'#a78bfa', fontSize:10, fontWeight:800, letterSpacing:1 }}>HAVE A COUPON?</div>
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <input value={coupon} onChange={e=>setCoupon(e.target.value)} placeholder="HAPPY18 / WELCOME10" style={{ flex:1, background:'#18181f', border:'1px solid #27272a', color:'#fff', padding:'10px 12px', borderRadius:10, fontSize:13, outline:'none' }} />
            {!couponApplied ? <button onClick={applyCoupon} style={{ background:'#8b5cf6', color:'#fff', border:'none', padding:'10px 14px', borderRadius:10, fontWeight:800, fontSize:12 }}>Apply</button>
            : <button onClick={removeCoupon} style={{ background:'#18181f', border:'1px solid #27272a', color:'#fda4af', padding:'10px 14px', borderRadius:10, fontWeight:700, fontSize:12 }}>Remove</button>}
          </div>
          {couponError && <div style={{ marginTop:6, color:'#fda4af', fontSize:11 }}>{couponError}</div>}
          {!couponError && couponApplied && <div style={{ marginTop:6, color:'#4ade80', fontSize:11 }}>✓ Coupon applied — 18% off!</div>}
          <div style={{ marginTop:8, color:'#71717a', fontSize:11 }}>Try: <b>HAPPY18</b>, <b>WELCOME10</b>, <b>PARTY20</b> for demo discount.</div>

          <div style={{ marginTop:14, background:'#12121c', border:'1px solid #222232', borderRadius:12, padding:12, display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#d4d4d8' }}><span>Subtotal</span><span>₹{total}</span></div>
            {discount>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#4ade80' }}><span>Discount</span><span>−₹{discount}</span></div>}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:900, borderTop:'1px solid #222232', paddingTop:8 }}><span>Amount to pay</span><span style={{ color: finalAmount===0 ? '#4ade80':'#fff' }}>{finalAmount===0?'FREE':`₹${finalAmount}`}</span></div>
          </div>

          <button onClick={beginPayment} style={{ marginTop:14, width:'100%', background:'linear-gradient(90deg,#8b5cf6,#ec4899)', color:'#fff', border:'none', padding:'14px', borderRadius:12, fontWeight:800, fontSize:14, boxShadow:'0 10px 24px rgba(139,92,246,0.35)' }}>{finalAmount===0 ? 'Continue (Complimentary) →' : 'Pay ₹'+finalAmount+' →'}</button>
        </div>

        <div style={{ width:340, background:'#0f0f16', border:'1px solid #222232', borderRadius:20, padding:16 }}>
          <div style={{ fontWeight:800, fontSize:13 }}>Your order</div>
          <div style={{ marginTop:10, display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ width:64, height:48, borderRadius:8, background:`linear-gradient(135deg, ${session.template?.gradient?.[0]}, ${session.template?.gradient?.[1]})`, border:'1px solid #222232' }} />
            <div>
              <div style={{ fontWeight:800, fontSize:12 }}>{session.template?.name}</div>
              <div style={{ color:'#a1a1aa', fontSize:11 }}>{session.template?.printSize} • {session.template?.slots} shot{session.template?.slots===1?'':'s'} • {session.prints} copies</div>
              <div style={{ color:'#a78bfa', fontSize:11, marginTop:2 }}>{session.digitalCopy ? '📱 Digital copy included' : 'No digital copy'}</div>
            </div>
          </div>
          <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
            <span style={{ background:'#18181f', border:'1px solid #27272a', color:'#a1a1aa', padding:'6px 10px', borderRadius:999, fontSize:11, fontWeight:600 }}>Org: {config.orgName}</span>
            <span style={{ background:'#18181f', border:'1px solid #27272a', color:'#a1a1aa', padding:'6px 10px', borderRadius:999, fontSize:11, fontWeight:600 }}>Event: {config.eventName}</span>
          </div>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 16px', borderTop:'1px solid #11111a' }}>
        <button onClick={()=>nav('/booth/prints')} style={{ background:'#171720', border:'1px solid #262634', color:'#d4d4d8', padding:'10px 16px', borderRadius:10, fontWeight:600 }}>← Back</button>
        <span style={{ color:'#71717a', fontSize:11, alignSelf:'center' }}>Payments are simulated — safe to demo.</span>
      </div>
    </div>
  )
}
