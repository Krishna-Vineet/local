import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BoothHeader from '../../components/BoothHeader'
import Loader from '../../components/Loader'
import { useBooth } from '../../context/BoothContext'

export default function Orientation(){
  const nav = useNavigate()
  const { config, session, setSession } = useBooth()
  const [selected, setSelected] = useState(session.orientation)
  const [secondsLeft, setSecondsLeft]=useState(60)
  const [loading, setLoading]=useState(false)

  useEffect(()=>{ const t=setInterval(()=>setSecondsLeft(s=> Math.max(0,s-1)),1000); return()=>clearInterval(t)},[])
  useEffect(()=>{ if(secondsLeft===0) nav('/booth/start')},[secondsLeft])

  function next(){
    if(!selected) return
    setLoading(true)
    setTimeout(()=>{
      setSession(s=>({...s, orientation:selected, template:null}))
      nav('/booth/templates')
    }, 900)
  }

  if(loading) return <Loader text="Loading templates…" sub="Curating your event's collection" />

  return (
    <div className="booth-container">
      <BoothHeader title="Choose Your Orientation" subtitle="Select vertical strips or widescreen landscape for your final print" step="STEP 1 OF 5" secondsLeft={secondsLeft} />

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:28, padding:16, flexWrap:'wrap' }}>
        {/* portrait */}
        <button onClick={()=>setSelected('portrait')} style={{
          width:320, background:selected==='portrait' ? 'rgba(139,92,246,0.12)' : '#0f0f16', border:`2px solid ${selected==='portrait' ? '#8b5cf6' : '#242434'}`, borderRadius:24, padding:'24px 28px', position:'relative', textAlign:'center', boxShadow:selected==='portrait' ? '0 12px 32px rgba(139,92,246,0.25)' : '0 10px 24px rgba(0,0,0,0.4)'
        }}>
          <div style={{ height:160, display:'grid', placeItems:'center' }}>
            <div style={{ width:85, height:145, background:'#fff', borderRadius:10, padding:7, display:'flex', flexDirection:'column', gap:6, boxShadow:'0 6px 16px rgba(0,0,0,0.3)' }}>
              <div style={{ flex:'1 1 40%', background:'#11111a', borderRadius:6, overflow:'hidden' }}><img src="https://images.unsplash.com/photo-1519741497674-611481863552?w=300&q=80" alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
              <div style={{ flex:'1 1 40%', background:'#11111a', borderRadius:6, overflow:'hidden' }}><img src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=300&q=80" alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
              <div style={{ textAlign:'center', fontSize:7, fontWeight:900, color:'#8b5cf6', letterSpacing:1 }}>HAPPYPIX</div>
            </div>
          </div>
          <div style={{ fontWeight:900, fontSize:22, color:'#fff', marginTop:6 }}>Vertical</div>
          <div style={{ color:'#a1a1aa', fontSize:13, marginTop:4, lineHeight:1.4 }}>Portraits, classic 3-cut photo strips & reels</div>
          {selected==='portrait' && <span style={{ position:'absolute', top:12, right:12, width:26, height:26, borderRadius:999, background:'#8b5cf6', color:'#fff', display:'grid', placeItems:'center', fontWeight:900 }}>✓</span>}
        </button>

        {/* landscape */}
        <button onClick={()=>setSelected('landscape')} style={{
          width:320, background:selected==='landscape' ? 'rgba(139,92,246,0.12)' : '#0f0f16', border:`2px solid ${selected==='landscape' ? '#8b5cf6' : '#242434'}`, borderRadius:24, padding:'24px 28px', position:'relative', textAlign:'center'
        }}>
          <div style={{ height:160, display:'grid', placeItems:'center' }}>
            <div style={{ width:145, height:95, background:'#fff', borderRadius:10, padding:6, display:'flex', flexDirection:'column', gap:4, boxShadow:'0 6px 16px rgba(0,0,0,0.3)' }}>
              <div style={{ display:'flex', gap:4, flex:1 }}>
                <div style={{ flex:1, background:'#111', borderRadius:5, overflow:'hidden' }}><img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80" alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
                <div style={{ flex:1, background:'#111', borderRadius:5, overflow:'hidden' }}><img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&q=80" alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
              </div>
              <div style={{ textAlign:'center', fontSize:7, fontWeight:900, color:'#8b5cf6', letterSpacing:1 }}>HAPPYPIX • {config.orgName?.toUpperCase().slice(0,14)}</div>
            </div>
          </div>
          <div style={{ fontWeight:900, fontSize:22, color:'#fff', marginTop:6 }}>Horizontal</div>
          <div style={{ color:'#a1a1aa', fontSize:13, marginTop:4, lineHeight:1.4 }}>Wide moments, group poses & postcard grids</div>
          {selected==='landscape' && <span style={{ position:'absolute', top:12, right:12, width:26, height:26, borderRadius:999, background:'#8b5cf6', color:'#fff', display:'grid', placeItems:'center', fontWeight:900 }}>✓</span>}
        </button>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 16px', borderTop:'1px solid #11111a' }}>
        <button onClick={()=>nav('/booth/start')} style={{ background:'#171720', border:'1px solid #262634', color:'#d4d4d8', padding:'12px 22px', borderRadius:12, fontWeight:700 }}>← Back</button>
        <button disabled={!selected} onClick={next} style={{ background: selected ? '#8b5cf6' : '#2a2a3a', color:'#fff', padding:'12px 28px', borderRadius:12, fontWeight:800, border:'none', opacity:selected?1:0.5, boxShadow:selected?'0 10px 24px rgba(139,92,246,0.35)':'none' }}>See Templates →</button>
      </div>
    </div>
  )
}
