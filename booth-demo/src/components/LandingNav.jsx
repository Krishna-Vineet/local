import React from 'react'
import { Link } from 'react-router-dom'
export default function LandingNav(){
  return (
    <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(5,5,8,0.75)', backdropFilter:'blur(12px)', borderBottom:'1px solid #11111a' }}>
      <div className="container" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', height:64 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#8b5cf6,#ec4899)', display:'grid', placeItems:'center', fontWeight:900, fontSize:16 }}>HP</div>
          <span style={{ fontWeight:900, fontSize:18, letterSpacing:-0.5 }}>HappyPix</span>
          <span style={{ background:'#18181f', border:'1px solid #27272a', borderRadius:999, padding:'4px 8px', fontSize:10, fontWeight:700, color:'#a1a1aa' }}>BOOTH DEMO</span>
        </Link>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <a href="#features" style={{ fontSize:13, fontWeight:600, color:'#a1a1aa' }}>Features</a>
          <a href="#testimonials" style={{ fontSize:13, fontWeight:600, color:'#a1a1aa' }}>Reviews</a>
          <a href="https://happypix.in" target="_blank" rel="noreferrer" style={{ fontSize:13, fontWeight:600, color:'#a1a1aa' }}>Website ↗</a>
          <a href="#" style={{ fontSize:13, fontWeight:600, color:'#a1a1aa' }}>CRM</a>
          <Link to="/experience" style={{ background:'#8b5cf6', color:'#fff', padding:'10px 18px', borderRadius:999, fontSize:13, fontWeight:800, boxShadow:'0 8px 20px rgba(139,92,246,0.35)' }}>Try Booth Experience →</Link>
        </div>
      </div>
    </nav>
  )
}
