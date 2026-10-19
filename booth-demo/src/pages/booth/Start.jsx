import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBooth } from '../../context/BoothContext'

export default function Start(){
  const nav = useNavigate()
  const { config } = useBooth()
  const [errOk,setErrOk]=useState({})
  const floatRef = useRef(null)

  const samplePhotos = [
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  ]
  const slotImages = [0,1,2].map(i=> samplePhotos[i])

  function go(){
    nav('/booth/orientation')
  }

  return (
    <div onClick={go} style={{ minHeight:'100vh', background:'#050508', position:'relative', overflow:'hidden', cursor:'pointer', display:'flex', flexDirection:'column' }}>
      {/* orbs */}
      <div style={{ position:'absolute', width:380, height:380, borderRadius:999, background:'radial-gradient(circle, rgba(139,92,246,0.55) 0%, rgba(139,92,246,0.2) 35%, transparent 75%)', left:-40, top:20, filter:'blur(2px)' }} />
      <div style={{ position:'absolute', width:360, height:360, borderRadius:999, background:'radial-gradient(circle, rgba(236,72,153,0.45) 0%, rgba(236,72,153,0.18) 40%, transparent 78%)', right:-30, top:10, filter:'blur(2px)' }} />
      <div style={{ position:'absolute', width:300, height:300, borderRadius:999, background:'radial-gradient(circle, rgba(6,182,214,0.18), transparent 65%)', left:'50%', top:120, transform:'translateX(-50%)' }} />

      {/* header */}
      <div style={{ position:'relative', zIndex:2, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#8b5cf6,#ec4899)', display:'grid', placeItems:'center', fontWeight:900, fontSize:13 }}>HP</div>
          <span style={{ fontWeight:900, letterSpacing:-0.3 }}>HappyPix</span>
          <span style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:999, padding:'4px 8px', fontSize:10, fontWeight:800, color:'#a1a1aa' }}>BOOTH • LIVE</span>
        </div>
        <div style={{ background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:999, padding:'6px 12px', fontSize:11, fontWeight:800, color:'#a78bfa' }}>
          {(config.orgName||'HappyPix Demo').toUpperCase()}
        </div>
      </div>

      {/* hero body */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', zIndex:2, padding:'16px 20px 26px' }}>
        {/* floating polaroids */}
        <div style={{ position:'relative', width:360, height:220, display:'flex', justifyContent:'center', alignItems:'center' }}>
          {/* left */}
          <div style={{ position:'absolute', left:10, top:18, width:150, background:'#fff', borderRadius:12, padding:6, paddingBottom:18, boxShadow:'0 12px 32px rgba(0,0,0,0.45)', transform:'rotate(-6deg)' }}>
            <img src={slotImages[0]} alt="" style={{ width:'100%', height:92, objectFit:'cover', borderRadius:8 }} />
            <div style={{ textAlign:'center', marginTop:8, fontSize:8, fontWeight:900, letterSpacing:1, color:'#8b5cf6' }}>HAPPYPIX LIVE</div>
          </div>
          {/* right */}
          <div style={{ position:'absolute', right:10, top:18, width:150, background:'#fff', borderRadius:12, padding:6, paddingBottom:18, boxShadow:'0 12px 32px rgba(0,0,0,0.45)', transform:'rotate(6deg)' }}>
            <img src={slotImages[1]} alt="" style={{ width:'100%', height:92, objectFit:'cover', borderRadius:8 }} />
            <div style={{ textAlign:'center', marginTop:8, fontSize:8, fontWeight:900, letterSpacing:1, color:'#ec4899' }}>{(config.orgName||'HappyPix').toUpperCase().slice(0,14)}</div>
          </div>
          {/* center */}
          <div style={{ position:'relative', zIndex:3, width:170, background:'#fff', borderRadius:14, padding:6, paddingBottom:20, boxShadow:'0 16px 40px rgba(0,0,0,0.55)', transform:'translateY(-6px)' }}>
            <img src={slotImages[2]} alt="" style={{ width:'100%', height:110, objectFit:'cover', borderRadius:10 }} />
            <div style={{ textAlign:'center', marginTop:10, fontSize:8, fontWeight:900, letterSpacing:1, color:'#8b5cf6' }}>✨ {config.eventName || 'Annual Gala 2026'} ✨</div>
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:10, maxWidth:560 }}>
          <h1 style={{ fontSize:42, fontWeight:900, letterSpacing:-1.2, lineHeight:0.95, fontFamily:'Fraunces, serif' }}>Step in.<br/><span style={{ background:'linear-gradient(90deg,#8b5cf6,#ec4899)', WebkitBackgroundClip:'text', color:'transparent' }}>Strike a pose.</span></h1>
          <p style={{ marginTop:8, color:'#a1a1aa', fontSize:13, lineHeight:1.6 }}>Branded for <b style={{ color:'#fff' }}>{config.orgName}</b> • {config.eventName} • {config.eventType} • Touch anywhere to begin your booth session</p>
        </div>

        <button onClick={go} style={{ marginTop:18, background:'#8b5cf6', color:'#fff', border:'none', padding:'14px 28px', borderRadius:999, fontWeight:800, fontSize:16, boxShadow:'0 12px 28px rgba(139,92,246,0.45)', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:36, height:36, borderRadius:999, background:'rgba(255,255,255,0.2)', display:'grid', placeItems:'center' }}>📸</span>
          <span style={{ textAlign:'left' }}><span style={{ display:'block', fontSize:15, lineHeight:1 }}>Tap anywhere to start</span><span style={{ display:'block', fontSize:11, fontWeight:600, opacity:0.9 }}>Your logo • Your event • Real flow</span></span>
          <span style={{ marginLeft:6, fontSize:18 }}>→</span>
        </button>

        <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
          <span style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:999, padding:'6px 10px', fontSize:11, color:'#a1a1aa' }}>⏱ 90-second flow</span>
          <span style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:999, padding:'6px 10px', fontSize:11, color:'#a1a1aa' }}>🖨 Prints + 📱 Digital</span>
          <span style={{ background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:999, padding:'6px 10px', fontSize:11, color:'#c4b5fd' }}>Event: {config.eventType}</span>
        </div>

        <div style={{ marginTop:14, color:'#52525b', fontSize:11, display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ width:6, height:6, borderRadius:999, background:'#22c55e' }} /> Camera • Loader • QR — all offline-safe demo
        </div>
      </div>

      <div style={{ textAlign:'center', padding:'10px 16px', borderTop:'1px solid #101018', background:'#070709', color:'#71717a', fontSize:11 }}>Need a real CRM walkthrough? <a href="#" style={{ color:'#a78bfa', fontWeight:800 }}>Open demo account →</a></div>
    </div>
  )
}
