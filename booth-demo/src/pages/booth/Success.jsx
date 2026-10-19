import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useBooth } from '../../context/BoothContext'

export default function Success(){
  const nav = useNavigate()
  const { config, session, photos, selectedPhotos } = useBooth()
  const [seconds,setSeconds]=useState(28)
  const shareUrl = `https://happypix.in/download/demo?org=${encodeURIComponent(config.orgName)}&event=${encodeURIComponent(config.eventName)}`
  const hasDigital = session.digitalCopy !== false

  useEffect(()=>{
    const t=setInterval(()=> setSeconds(s=>{
      if(s<=1){ clearInterval(t); nav('/booth/start'); return 0 }
      return s-1
    }),1000)
    return()=>clearInterval(t)
  },[])

  return (
    <div style={{ minHeight:'100vh', background:'#050508', padding:'12px 16px' }}>
      <div style={{ maxWidth:980, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0f0f16', border:'1px solid #222232', borderRadius:16, padding:'12px 16px' }}>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'#22c55e', display:'grid', placeItems:'center', fontWeight:900 }}>✓</div>
            <div>
              <div style={{ fontWeight:900, fontSize:14 }}>Order complete — print dispatched!</div>
              <div style={{ color:'#a1a1aa', fontSize:11 }}>Job ref: HP-{Date.now().toString().slice(-6)} • {config.eventName} • {session.prints} {session.prints===1?'copy':'copies'}</div>
            </div>
          </div>
          <button onClick={()=>nav('/booth/start')} style={{ background:'#8b5cf6', color:'#fff', border:'none', padding:'10px 14px', borderRadius:10, fontWeight:800, fontSize:12 }}>Finish Now ({seconds}s)</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:16, marginTop:16 }}>
          <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:20, padding:18, textAlign:'center' }}>
            <div style={{ width:68, height:68, borderRadius:34, background:'#22c55e', display:'grid', placeItems:'center', margin:'0 auto', fontSize:34, color:'#fff', fontWeight:900 }}>✓</div>
            <div style={{ color:'#a78bfa', fontSize:10, fontWeight:800, letterSpacing:1, marginTop:10 }}>SUCCESS</div>
            <div style={{ fontWeight:900, fontSize:20, marginTop:4 }}>Thank you for making memories with us!</div>
            <div style={{ color:'#a1a1aa', fontSize:12, marginTop:6, lineHeight:1.6 }}>Your print is on its way. This screen will auto-reset for the next guest. Need help? Raise a guest support ticket — just like the real booth.</div>
            <div style={{ marginTop:14, display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={()=> window.location.href='https://happypix.in'} style={{ background:'#8b5cf6', color:'#fff', border:'none', padding:'10px 16px', borderRadius:999, fontWeight:800, fontSize:12 }}>Visit Website</button>
              <button onClick={()=>nav('/')} style={{ background:'#18181f', border:'1px solid #27272a', color:'#d4d4d8', padding:'10px 16px', borderRadius:999, fontWeight:700, fontSize:12 }}>Back to landing</button>
            </div>
            <div style={{ marginTop:12, background:'#12121c', border:'1px solid #222232', borderRadius:12, padding:10, display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
              <img src={photos?.[0]?.uri || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=200&q=80'} alt="" style={{ width:56, height:56, objectFit:'cover', borderRadius:8, border:'1px solid #27272a' }} />
              <img src={photos?.[1]?.uri || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=200&q=80'} alt="" style={{ width:56, height:56, objectFit:'cover', borderRadius:8, border:'1px solid #27272a' }} />
              <img src={photos?.[2]?.uri || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'} alt="" style={{ width:56, height:56, objectFit:'cover', borderRadius:8, border:'1px solid #27272a' }} />
            </div>
          </div>

          <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:20, padding:18, textAlign:'center' }}>
            {hasDigital ? (
              <>
                <div style={{ color:'#a78bfa', fontSize:10, fontWeight:800, letterSpacing:1 }}>YOUR DIGITAL PASS</div>
                <div style={{ fontWeight:900, fontSize:18, marginTop:4 }}>Scan. Save. Share.</div>
                <div style={{ background:'#fff', borderRadius:14, padding:14, display:'inline-block', marginTop:12 }}>
                  <QRCodeSVG value={shareUrl} size={180} level="H" />
                </div>
                <div style={{ color:'#a1a1aa', fontSize:11, marginTop:10, lineHeight:1.6 }}>Open your camera to scan and download high-resolution photos.</div>
                <div style={{ color:'#22c55e', fontSize:11, marginTop:6 }}>🔒 Link valid for 24 hours • happypix.in/download/demo</div>
                <div style={{ marginTop:12, display:'flex', gap:8, justifyContent:'center' }}>
                  <a href={shareUrl} target="_blank" rel="noreferrer" style={{ background:'#18181f', border:'1px solid #27272a', color:'#d4d4d8', padding:'8px 12px', borderRadius:10, fontSize:12, fontWeight:700 }}>Open demo page</a>
                  <button onClick={()=>navigator.clipboard?.writeText(shareUrl)} style={{ background:'#8b5cf6', color:'#fff', border:'none', padding:'8px 12px', borderRadius:10, fontSize:12, fontWeight:700 }}>Copy link</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize:34 }}>♥</div>
                <div style={{ fontWeight:900, fontSize:16, marginTop:6 }}>Thank you for visiting the booth!</div>
                <div style={{ color:'#a1a1aa', fontSize:12, marginTop:6 }}>No digital copy selected — your prints are ready at the collection desk.</div>
              </>
            )}
            <div style={{ marginTop:14, background:'#12121c', border:'1px solid #222232', borderRadius:12, padding:10, textAlign:'left' }}>
              <div style={{ fontWeight:800, fontSize:12 }}>{config.orgName} — {config.eventName}</div>
              <div style={{ color:'#71717a', fontSize:11, marginTop:2, textTransform:'capitalize' }}>{config.eventType} • {session.template?.name} • {session.template?.printSize}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop:12, background:'#09090f', border:'1px solid #11111a', borderRadius:14, padding:12, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
          <div style={{ color:'#71717a', fontSize:11 }}>Want to pitch with your own branding next time? Your config is saved — just tap <b style={{ color:'#fff' }}>Experience</b> again.</div>
          <button onClick={()=>nav('/experience')} style={{ background:'linear-gradient(90deg,#8b5cf6,#ec4899)', color:'#fff', border:'none', padding:'10px 16px', borderRadius:10, fontWeight:800, fontSize:12 }}>Brand again →</button>
        </div>
      </div>
    </div>
  )
}
