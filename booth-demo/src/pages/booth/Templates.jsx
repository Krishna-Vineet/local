import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import BoothHeader from '../../components/BoothHeader'
import Loader from '../../components/Loader'
import TemplateCanvas from '../../components/TemplateCanvas'
import { useBooth } from '../../context/BoothContext'
import { TEMPLATES } from '../../data/templates'

export default function Templates(){
  const nav = useNavigate()
  const { config, session, setSession } = useBooth()
  const [secondsLeft,setSecondsLeft]=useState(60)
  const [loading,setLoading]=useState(false)
  const [filterSize,setFilterSize]=useState('All')
  const [filterShots,setFilterShots]=useState('All')
  const [selectedId,setSelectedId]=useState(session.template?.id || null)

  useEffect(()=>{ const t=setInterval(()=>setSecondsLeft(s=>Math.max(0,s-1)),1000); return()=>clearInterval(t)},[])
  useEffect(()=>{ if(secondsLeft===0) nav('/booth/start')},[secondsLeft])

  const orientation = session.orientation || 'portrait'
  const isLandscape = orientation==='landscape'

  const filtered = useMemo(()=>{
    let arr = TEMPLATES.filter(t=> t.orientation===orientation && (t.category===config.eventType || config.eventType==='party' ? true : t.category===config.eventType || t.category===config.eventType))
    // Actually always show templates that match eventType; fallback to show all for party if too few
    let byType = TEMPLATES.filter(t=> t.orientation===orientation && t.category===config.eventType)
    if(byType.length>=3) arr = byType
    else {
      // mix: include matching + some generics
      const others = TEMPLATES.filter(t=> t.orientation===orientation && t.category!==config.eventType).slice(0, 3)
      arr = [...byType, ...others]
    }
    if(filterSize!=='All') arr = arr.filter(t=> t.printSize===filterSize)
    if(filterShots!=='All') arr = arr.filter(t=> String(t.slots)===String(filterShots))
    return arr
  },[orientation, filterSize, filterShots, config.eventType])

  function handleSelect(item){
    setSelectedId(item.id)
    setSession(s=>({...s, template:item}))
  }
  function handleNext(){
    if(!selectedId) return
    setLoading(true)
    setTimeout(()=> nav('/booth/prints'), 850)
  }

  if(loading) return <Loader text="Preparing print studio…" sub="Calibrating colors & frames" />

  return (
    <div className="booth-container">
      <BoothHeader title="Pick Your Template" subtitle={`For ${config.eventName} • ${config.orgName} • ${orientation} • ${filtered.length} designs`} step="STEP 2 OF 5" secondsLeft={secondsLeft} />

      {/* filters */}
      <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap', padding:'6px 16px', alignItems:'center' }}>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ color:'#71717a', fontSize:10, fontWeight:800, letterSpacing:1 }}>SIZE</span>
          {['All','4x6','5x7','6x8','2x6'].map(s=>(
            <button key={s} onClick={()=>setFilterSize(s)} style={{ padding:'6px 12px', borderRadius:14, border:'1px solid #242432', background: filterSize===s ? '#8b5cf6' : '#13131c', color: filterSize===s ? '#fff' : '#a1a1aa', fontSize:12, fontWeight:600 }}>{s}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ color:'#71717a', fontSize:10, fontWeight:800, letterSpacing:1 }}>PHOTOS</span>
          {['All','1','2','3','4'].map(s=>(
            <button key={s} onClick={()=>setFilterShots(s)} style={{ padding:'6px 12px', borderRadius:14, border:'1px solid #242432', background: filterShots===s ? '#8b5cf6' : '#13131c', color: filterShots===s ? '#fff' : '#a1a1aa', fontSize:12, fontWeight:600 }}>{s=== 'All' ? 'All' : `${s} shot${s==='1'?'':'s'}`}</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'10px 16px' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:14, justifyContent:'center' }}>
          {filtered.map(item=>{
            const isSelected = selectedId===item.id
            return (
              <button key={item.id} onClick={()=>handleSelect(item)} style={{
                background: isSelected ? 'rgba(139,92,246,0.08)' : 'rgba(18,18,27,0.55)',
                border:`1.5px solid ${isSelected ? '#8b5cf6' : '#1f1f2e'}`, borderRadius:16, padding:'10px 8px 10px', width: isLandscape ? 280 : 220, display:'flex', flexDirection:'column', alignItems:'center', gap:8, position:'relative', boxShadow:isSelected?'0 10px 24px rgba(139,92,246,0.2)':'none'
              }}>
                <div style={{ padding:3, borderRadius:13, border:`2px solid ${isSelected ? '#8b5cf6' : 'transparent'}`, boxShadow:isSelected?'0 0 18px rgba(139,92,246,0.5)':'none' }}>
                  <TemplateCanvas template={item} width={ isLandscape ? 220 : 160 } orgName={config.orgName} />
                  {isSelected && <span style={{ position:'absolute', top:12, right:12, width:24, height:24, borderRadius:999, background:'#8b5cf6', color:'#fff', display:'grid', placeItems:'center', fontWeight:900, fontSize:12, boxShadow:'0 4px 10px rgba(0,0,0,0.4)' }}>✓</span>}
                </div>
                <div style={{ width:'100%', background:isSelected ? 'rgba(139,92,246,0.12)' : '#12121b', border:`1px solid ${isSelected ? '#8b5cf6' : '#222230'}`, borderRadius:12, padding:'8px 10px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <div style={{ textAlign:'left' }}>
                    <div style={{ color:'#fff', fontSize:12, fontWeight:800 }}>{item.name}</div>
                    <div style={{ color:'#a1a1aa', fontSize:10 }}>{item.printSize} • {item.slots} {item.slots===1?'shot':'shots'}</div>
                  </div>
                  <span style={{ background: item.price===0 ? 'rgba(34,197,94,0.16)' : 'rgba(236,72,153,0.16)', color: item.price===0 ? '#4ade80' : '#f472b6', border:`1px solid ${item.price===0?'rgba(34,197,94,0.4)':'rgba(236,72,153,0.4)'}`, borderRadius:8, padding:'3px 8px', fontSize:11, fontWeight:900 }}>{item.price===0?'FREE':`₹${item.price}`}</span>
                </div>
              </button>
            )
          })}
        </div>
        {filtered.length===0 && <div style={{ textAlign:'center', padding:40, color:'#71717a' }}><div style={{ fontWeight:800, color:'#fff' }}>No templates found</div><div style={{ fontSize:12, marginTop:4 }}>Try another size or photo count.</div></div>}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 16px', borderTop:'1px solid #11111a' }}>
        <button onClick={()=>nav('/booth/orientation')} style={{ background:'#171720', border:'1px solid #262634', color:'#d4d4d8', padding:'12px 22px', borderRadius:12, fontWeight:600 }}>← Back</button>
        <button disabled={!selectedId} onClick={handleNext} style={{ background:selectedId?'#8b5cf6':'#2a2a3a', color:'#fff', padding:'12px 28px', borderRadius:12, fontWeight:800, border:'none', opacity:selectedId?1:0.4, boxShadow:selectedId?'0 10px 24px rgba(139,92,246,0.35)':'none' }}>Choose This Template →</button>
      </div>
    </div>
  )
}
