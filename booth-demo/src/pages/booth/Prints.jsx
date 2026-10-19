import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BoothHeader from '../../components/BoothHeader'
import Loader from '../../components/Loader'
import TemplateCanvas from '../../components/TemplateCanvas'
import { useBooth } from '../../context/BoothContext'

export default function Prints(){
  const nav = useNavigate()
  const { config, session, setSession } = useBooth()
  const [secondsLeft,setSecondsLeft]=useState(60)
  const [loading,setLoading]=useState(false)
  useEffect(()=>{ const t=setInterval(()=>setSecondsLeft(s=>Math.max(0,s-1)),1000); return()=>clearInterval(t)},[])
  useEffect(()=>{ if(secondsLeft===0) nav('/booth/start')},[secondsLeft])
  if(!session.template){ return <div style={{ background:'#050508', minHeight:'100vh', display:'grid', placeItems:'center', color:'#fff' }}>No template selected — <button onClick={()=>nav('/booth/templates')} style={{ color:'#8b5cf6', marginLeft:8, background:'none', border:'none', fontWeight:800 }}>Go back</button></div> }

  const template = session.template
  const unitPrice = template.price
  const total = session.prints * unitPrice
  const choices = [1,2,4,6,8,10]

  function next(){
    setLoading(true); setTimeout(()=> nav('/booth/payment'), 800)
  }
  if(loading) return <Loader text="Securing your order…" sub="Checking best available offer" />

  return (
    <div className="booth-container">
      <BoothHeader title="Print Copies & Digital Pass" subtitle="Select copies for your friends and family. Final discount is verified next." step="STEP 3 OF 5" secondsLeft={secondsLeft} />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:20, padding:'16px', flexWrap:'wrap' }}>
        <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:24, padding:26, width:340 }}>
          <div style={{ color:'#8b5cf6', fontSize:10, fontWeight:800, letterSpacing:2 }}>NUMBER OF PHYSICAL PRINTS</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginTop:14 }}>
            {choices.map(n=>{
              const active = session.prints===n
              return <button key={n} onClick={()=>setSession(s=>({...s, prints:n}))} style={{ width:52, height:52, borderRadius:14, background: active ? '#8b5cf6' : '#171722', border:`1.5px solid ${active ? '#a78bfa' : '#28283a'}`, color: active ? '#fff' : '#a1a1aa', fontSize:18, fontWeight:active?900:700, boxShadow:active?'0 6px 16px rgba(139,92,246,0.35)':'none' }}>{n}</button>
            })}
          </div>
          <div style={{ marginTop:16, borderTop:'1px solid #1f1f2c', borderBottom:'1px solid #1f1f2c', padding:'14px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div><div style={{ color:'#fff', fontSize:13, fontWeight:700 }}>Include Digital Download QR?</div><div style={{ color:'#a1a1aa', fontSize:11 }}>Instant phone download link on success screen.</div></div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>setSession(s=>({...s, digitalCopy:true}))} style={{ background: session.digitalCopy ? '#8b5cf6' : '#18181f', color: session.digitalCopy ? '#fff' : '#a1a1aa', border:'1px solid '+(session.digitalCopy ? '#a78bfa':'#27272a'), borderRadius:10, padding:'8px 10px', fontSize:11, fontWeight:800 }}>YES</button>
              <button onClick={()=>setSession(s=>({...s, digitalCopy:false}))} style={{ background: !session.digitalCopy ? '#8b5cf6' : '#18181f', color: !session.digitalCopy ? '#fff' : '#a1a1aa', border:'1px solid '+(!session.digitalCopy ? '#a78bfa':'#27272a'), borderRadius:10, padding:'8px 10px', fontSize:11, fontWeight:800 }}>NO</button>
            </div>
          </div>
          <div style={{ marginTop:14, background:'#12121c', border:'1px solid #222232', borderRadius:12, padding:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:800 }}><span>{session.prints} × {unitPrice===0?'Free':`₹${unitPrice}`}</span><span style={{ color: total===0 ? '#4ade80' : '#fff' }}>{total===0?'Free':`₹${total}`}</span></div>
            <div style={{ color:'#71717a', fontSize:11, marginTop:6 }}>Coupon and payment verified securely on the next step.</div>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
          <div style={{ background:'#0f0f16', border:'1.5px solid #222232', borderRadius:16, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ color:'#71717a', fontSize:9, fontWeight:800, letterSpacing:1 }}>SELECTED DESIGN</div>
            <div style={{ color:'#fff', fontSize:13, fontWeight:800, marginTop:2 }}>{template.name}</div>
            <div style={{ color:'#a1a1aa', fontSize:11 }}>{template.printSize} • {template.slots} {template.slots===1?'shot':'shots'}</div>
          </div>
          <TemplateCanvas template={template} width={260} orgName={config.orgName} />
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 16px', borderTop:'1px solid #11111a' }}>
        <button onClick={()=>nav('/booth/templates')} style={{ background:'#171720', border:'1px solid #262634', color:'#d4d4d8', padding:'12px 22px', borderRadius:12, fontWeight:600 }}>← Back</button>
        <button onClick={next} style={{ background:'#8b5cf6', color:'#fff', padding:'12px 28px', borderRadius:12, fontWeight:800, border:'none', boxShadow:'0 10px 24px rgba(139,92,246,0.35)' }}>Continue to Payment →</button>
      </div>
    </div>
  )
}
