import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BoothHeader from '../../components/BoothHeader'
import Loader from '../../components/Loader'
import TemplateCanvas from '../../components/TemplateCanvas'
import { useBooth } from '../../context/BoothContext'
import { FILTERS, STICKERS } from '../../data/templates'

const ORNAMENTS = [
  { id:'none', label:'Clean', symbol:'○', desc:'No extras' },
  { id:'hearts', label:'Hearts', symbol:'♡', desc:'Floating hearts' },
  { id:'stars', label:'Stars', symbol:'✦', desc:'Starlight sparkles' },
  { id:'bubbles', label:'Bubbles', symbol:'◌', desc:'Bubbles' },
  { id:'confetti', label:'Confetti', symbol:'⌁', desc:'Festive ribbons' },
]

export default function Customize(){
  const nav = useNavigate()
  const { config, session, selectedPhotos, customization, setCustomization, photos } = useBooth()
  const [secondsLeft,setSecondsLeft]=useState(60)
  const [activeTab,setActiveTab]=useState('filters')
  const [subtitle,setSubtitle]=useState(customization.subtitle || session.template?.accentStrip || '')
  const [printing,setPrinting]=useState(false)

  const template = session.template
  const availableFilters = FILTERS // could filter by event
  const effectivePhotos = (selectedPhotos && selectedPhotos.length>0 ? selectedPhotos : photos || []).map(p=> typeof p==='string'? p : p.uri)

  useEffect(()=>{ const t=setInterval(()=>setSecondsLeft(s=>Math.max(0,s-1)),1000); return()=>clearInterval(t)},[])
  useEffect(()=>{ if(secondsLeft===0 && !printing) nav('/booth/start')},[secondsLeft])
  if(!template) return <div style={{ background:'#050508', minHeight:'100vh', display:'grid', placeItems:'center', color:'#fff' }}>No template.</div>

  function update(patch){ setCustomization(s=>({...s, ...patch})) }
  function addSticker(emoji){
    const id = `${Date.now()}-${emoji}`
    const sticker = { id, emoji, x: 10 + Math.random()*70, y: 10 + Math.random()*60, size: 22, rotation: (Math.random()*20-10) }
    update({ stickers: [...(customization.stickers||[]), sticker] })
  }
  function removeSticker(id){ update({ stickers: customization.stickers.filter(s=>s.id!==id) }) }

  async function finish(){
    setPrinting(true)
    // simulate render + print
    setTimeout(()=> nav('/booth/success'), 1200)
  }

  if(printing) return <Loader text="Printing & syncing…" sub="Compositing final artwork — please wait" />

  return (
    <div className="booth-container">
      <BoothHeader title="Make It Yours" subtitle="Filters, stickers & finishing touches — just like the native app" step="FINISH" secondsLeft={secondsLeft} />
      <div style={{ flex:1, display:'flex', gap:16, padding:'12px 16px', flexWrap:'wrap', justifyContent:'center', alignItems:'flex-start' }}>
        {/* tabs */}
        <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:16, padding:10, width:360 }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {[
              { id:'filters', label:'Filters' },
              { id:'stickers', label:'Stickers' },
              { id:'text', label:'Text' },
              { id:'patterns', label:'Patterns' },
            ].map(tab=>(
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{ flex:1, background: activeTab===tab.id ? '#8b5cf6' : '#18181f', color: activeTab===tab.id ? '#fff' : '#a1a1aa', border:'1px solid '+(activeTab===tab.id?'#a78bfa':'#27272a'), borderRadius:10, padding:'8px 10px', fontSize:12, fontWeight:700 }}>{tab.label}</button>
            ))}
          </div>

          <div style={{ marginTop:12, minHeight:180 }}>
            {activeTab==='filters' && (
              <div>
                <div style={{ color:'#a78bfa', fontSize:10, fontWeight:800, letterSpacing:0.8 }}>COLOR MOOD</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
                  {availableFilters.map(f=>(
                    <button key={f.id} onClick={()=>update({ filter:f.id })} style={{ textAlign:'left', background: customization.filter===f.id ? 'rgba(139,92,246,0.12)' : '#12121c', border:`1px solid ${customization.filter===f.id ? '#8b5cf6' : '#222232'}`, borderRadius:12, padding:10 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span style={{ width:16, height:16, borderRadius:999, background:f.color, border:'1px solid #333' }} />
                        <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{f.label}</span>
                      </div>
                      <div style={{ fontSize:10, color:'#71717a', marginTop:4 }}>{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeTab==='stickers' && (
              <div>
                <div style={{ color:'#a78bfa', fontSize:10, fontWeight:800, letterSpacing:0.8 }}>TAP TO PLACE</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:8 }}>
                  {STICKERS.map(e=> <button key={e} onClick={()=>addSticker(e)} style={{ width:44, height:44, borderRadius:10, background:'#12121c', border:'1px solid #222232', fontSize:20 }}>{e}</button>)}
                </div>
                {customization.stickers.length>0 && <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:6 }}>{customization.stickers.map(s=> <span key={s.id} onClick={()=>removeSticker(s.id)} style={{ background:'#18181f', border:'1px solid #27272a', borderRadius:999, padding:'4px 8px', fontSize:12, cursor:'pointer' }}>{s.emoji} ✕</span>)}</div>}
                <div style={{ marginTop:8, color:'#71717a', fontSize:11 }}>Tap a placed sticker chip to remove. Drag support coming in native app.</div>
              </div>
            )}
            {activeTab==='text' && (
              <div>
                <div style={{ color:'#a78bfa', fontSize:10, fontWeight:800, letterSpacing:0.8 }}>CAPTION</div>
                <input value={subtitle} onChange={e=>setSubtitle(e.target.value)} placeholder="e.g. Annual Gala 2026 — Mumbai" style={{ marginTop:8, width:'100%', background:'#18181f', border:'1px solid #27272a', color:'#fff', padding:'10px 12px', borderRadius:10, fontSize:13, outline:'none' }} />
                <button onClick={()=>update({ subtitle })} style={{ marginTop:8, background:'#18181f', border:'1px solid #27272a', color:'#d4d4d8', padding:'8px 12px', borderRadius:10, fontSize:12, fontWeight:700 }}>Apply caption</button>
                <div style={{ marginTop:8, color:'#71717a', fontSize:11 }}>This text appears on the print footer next to HAPPYPIX.</div>
              </div>
            )}
            {activeTab==='patterns' && (
              <div>
                <div style={{ color:'#a78bfa', fontSize:10, fontWeight:800, letterSpacing:0.8 }}>DECOR</div>
                <div style={{ display:'grid', gap:8, marginTop:8 }}>
                  {ORNAMENTS.map(o=>(
                    <button key={o.id} onClick={()=>update({ ornament:o.id })} style={{ textAlign:'left', background: customization.ornament===o.id ? 'rgba(139,92,246,0.12)' : '#12121c', border:`1px solid ${customization.ornament===o.id ? '#8b5cf6' : '#222232'}`, borderRadius:12, padding:10, display:'flex', gap:10, alignItems:'center' }}>
                      <span style={{ width:28, height:28, borderRadius:10, background:'#18181f', border:'1px solid #27272a', display:'grid', placeItems:'center' }}>{o.symbol}</span>
                      <div><div style={{ fontWeight:800, fontSize:12, color:'#fff' }}>{o.label}</div><div style={{ fontSize:10, color:'#71717a' }}>{o.desc}</div></div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={finish} style={{ marginTop:12, width:'100%', background:'linear-gradient(90deg,#8b5cf6,#ec4899)', color:'#fff', border:'none', padding:'14px', borderRadius:12, fontWeight:900, fontSize:14, boxShadow:'0 10px 24px rgba(139,92,246,0.35)' }}>Print & Finish →</button>
          <div style={{ marginTop:8, color:'#71717a', fontSize:10, textAlign:'center' }}>Final composite rendered at 300dpi in the native app — preview is live here.</div>
        </div>

        {/* canvas preview */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
          <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:16, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ color:'#71717a', fontSize:9, fontWeight:800, letterSpacing:1 }}>LIVE PREVIEW</div>
            <div style={{ color:'#fff', fontSize:12, fontWeight:800, marginTop:2 }}>{template.name} • {template.printSize}</div>
          </div>
          <TemplateCanvas template={template} photos={effectivePhotos} width={280} filterId={customization.filter} stickers={customization.stickers} subtitle={customization.subtitle || subtitle} orgName={config.orgName} />
          <div style={{ display:'flex', gap:8 }}>
            <span style={{ background:'#18181f', border:'1px solid #27272a', borderRadius:999, padding:'6px 10px', fontSize:11, color:'#a1a1aa' }}>Filter: {customization.filter}</span>
            <span style={{ background:'#18181f', border:'1px solid #27272a', borderRadius:999, padding:'6px 10px', fontSize:11, color:'#a1a1aa' }}>{(customization.stickers||[]).length} stickers</span>
          </div>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 16px', borderTop:'1px solid #11111a' }}>
        <button onClick={()=>nav('/booth/photos')} style={{ background:'#171720', border:'1px solid #262634', color:'#d4d4d8', padding:'10px 16px', borderRadius:10, fontWeight:600 }}>← Photos</button>
        <span style={{ color:'#71717a', fontSize:11, alignSelf:'center' }}>Stickers are draggable in the native Android build.</span>
      </div>
    </div>
  )
}
