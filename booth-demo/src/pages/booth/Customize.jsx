import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BoothHeader from '../../components/BoothHeader'
import Loader from '../../components/Loader'
import TemplateCanvas from '../../components/TemplateCanvas'
import { useBooth } from '../../context/BoothContext'
import { FILTERS, STICKERS, EVENT_SAMPLES } from '../../data/templates'

const DECOR = [
  { id:'none', label:'Clean', hint:'No extra marks' },
  { id:'hearts', label:'Hearts', hint:'Two small hearts' },
  { id:'stars', label:'Stars', hint:'Sparkle accents' },
  { id:'confetti', label:'Confetti', hint:'Colour flecks' },
  { id:'bubbles', label:'Bubbles', hint:'Soft circles' },
]

const TABS = [
  { id:'filters', label:'Filters' },
  { id:'stickers', label:'Stickers' },
  { id:'caption', label:'Caption' },
  { id:'decor', label:'Decor' },
]

export default function Customize(){
  const nav = useNavigate()
  const { config, session, selectedPhotos, photos, customization, setCustomization } = useBooth()
  const [secondsLeft, setSecondsLeft] = useState(90)
  const [tab, setTab] = useState('filters')
  const [caption, setCaption] = useState(customization.subtitle || '')
  const [printing, setPrinting] = useState(false)
  const [selectedStickerId, setSelectedStickerId] = useState(null)

  const template = session.template

  useEffect(()=>{ const t = setInterval(()=>setSecondsLeft(s=>Math.max(0,s-1)),1000); return ()=>clearInterval(t) },[])
  useEffect(()=>{ if(secondsLeft===0 && !printing) nav('/booth/start') },[secondsLeft, printing])

  if(!template){
    return (
      <div className="booth-container" style={{ display:'grid', placeItems:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:700 }}>Nothing to customise yet</div>
          <button className="btn-primary" style={{ marginTop:12 }} onClick={()=>nav('/booth/templates')}>Pick a template</button>
        </div>
      </div>
    )
  }

  const chosen = (selectedPhotos && selectedPhotos.length ? selectedPhotos : photos || []).map(p=> typeof p === 'string' ? p : p.uri)
  const frames = Array.from({ length: template.slots }, (_, i)=> chosen[i] || (EVENT_SAMPLES[template.category] || [])[i % 3])

  function update(patch){ setCustomization(prev=>({ ...prev, ...patch })) }
  function addSticker(emoji){
    const sticker = {
      id:`s-${Date.now()}-${Math.random().toString(16).slice(2,6)}`,
      emoji,
      x: 12 + Math.random() * 66,
      y: 12 + Math.random() * 58,
      size: 20,
      rotation: Math.random() * 16 - 8,
    }
    const next = [...(customization.stickers || []), sticker]
    update({ stickers: next })
    setSelectedStickerId(sticker.id)
    setTab('stickers')
  }
  function removeSticker(id){
    update({ stickers: (customization.stickers||[]).filter(s=>s.id !== id) })
    if(selectedStickerId === id) setSelectedStickerId(null)
  }

  const selectedSticker = (customization.stickers||[]).find(s=> s.id === selectedStickerId) || null

  function updateSelected(patch){
    if(!selectedStickerId) return
    update({ stickers: customization.stickers.map(s=> s.id===selectedStickerId ? { ...s, ...patch } : s)})
  }

  function finish(){
    setPrinting(true)
    setTimeout(()=>nav('/booth/success'), 1300)
  }
  if(printing) return <Loader text="Sending to the printer…" sub="Rendering your final artwork" />

  return (
    <div className="booth-container">
      <BoothHeader
        title="Finishing touches"
        subtitle="Filters, stickers and a caption — then send it to print"
        step="FINAL STEP"
        secondsLeft={secondsLeft}
      />

      <div className="customize-body">
        <section className="customize-panel">
          <div className="tab-row">
            {TABS.map(t=>(
              <button key={t.id} className={`tab ${tab===t.id ? 'is-active' : ''}`} onClick={()=>setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          <div className="tab-content">
            {tab==='filters' && (
              <div className="filter-grid">
                {FILTERS.map(f=>(
                  <button
                    key={f.id}
                    className={`filter-tile ${customization.filter === f.id ? 'is-active' : ''}`}
                    onClick={()=>update({ filter:f.id })}
                  >
                    <span className="filter-swatch" style={{ background:f.color }} />
                    <span className="filter-text">
                      <span className="filter-name">{f.label}</span>
                      <span className="filter-desc">{f.desc}</span>
                    </span>
                  </button>
                ))}
                <div style={{ gridColumn:'1 / -1', marginTop:2, fontSize:10.5, color:'#6f6f80', background:'#0a0a0f', border:'1px solid #1c1c24', borderRadius:8, padding:'8px 10px' }}>
                  <b style={{ color:'#c4b5fd' }}>{FILTERS.find(f=> f.id===customization.filter)?.label}</b> — applied live. Compare Natural vs Warm/Cool clearly on skin tones.
                </div>
              </div>
            )}

            {tab==='stickers' && (
              <div>
                <div className="panel-hint" style={{ marginTop:0, marginBottom:10 }}>Tap to place. Then drag directly on the preview.</div>
                <div className="sticker-grid">
                  {STICKERS.map(e=>(
                    <button key={e} className="sticker-btn" onClick={()=>addSticker(e)}>{e}</button>
                  ))}
                </div>
                {(customization.stickers || []).length > 0 && (
                  <div style={{ marginTop:14 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#d1d5db', marginBottom:6 }}>On canvas — drag to reposition</div>
                    <div className="sticker-active-row">
                      {customization.stickers.map(s=>(
                        <button
                          key={s.id}
                          className={`sticker-chip ${selectedStickerId===s.id ? 'is-selected' : ''}`}
                          onClick={()=> setSelectedStickerId(s.id)}
                        >
                          <span>{s.emoji}</span>
                          <span className="sticker-chip-x" onClick={(e)=>{ e.stopPropagation(); removeSticker(s.id)}}>×</span>
                        </button>
                      ))}
                    </div>
                    {selectedSticker && (
                      <div style={{ marginTop:12, background:'#0a0a0f', border:'1px solid #232331', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, fontWeight:600, color:'#e5e7eb' }}>
                          <span style={{ fontSize:16 }}>{selectedSticker.emoji}</span> Selected
                          <button onClick={()=> removeSticker(selectedSticker.id)} style={{ marginLeft:'auto', fontSize:11, background:'#1a0f0f', border:'1px solid #3a1a1a', color:'#fca5a5', borderRadius:7, padding:'4px 8px' }}>Remove</button>
                        </div>
                        <label style={{ display:'flex', alignItems:'center', gap:10, fontSize:11, color:'#a1a1aa' }}>
                          Size <input type="range" min="12" max="44" value={selectedSticker.size||20} onChange={e=> updateSelected({ size: Number(e.target.value)})} style={{ flex:1, accentColor:'#8b5cf6'}} />
                          <span style={{ minWidth:28, textAlign:'right', color:'#e4e4e7' }}>{selectedSticker.size||20}</span>
                        </label>
                        <label style={{ display:'flex', alignItems:'center', gap:10, fontSize:11, color:'#a1a1aa' }}>
                          Rotate <input type="range" min="-45" max="45" value={selectedSticker.rotation||0} onChange={e=> updateSelected({ rotation: Number(e.target.value)})} style={{ flex:1, accentColor:'#8b5cf6'}} />
                          <span style={{ minWidth:28, textAlign:'right', color:'#e4e4e7' }}>{selectedSticker.rotation||0}°</span>
                        </label>
                        <div style={{ fontSize:10.5, color:'#6f6f80' }}>Tip: drag the emoji on the preview to move it — no handle needed.</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab==='caption' && (
              <div>
                <label className="field-label" htmlFor="caption">Caption on the print</label>
                <input
                  id="caption"
                  className="field-input"
                  style={{ marginTop:8 }}
                  value={caption}
                  onChange={e=>setCaption(e.target.value)}
                  placeholder={template.accentStrip}
                />
                <div className="customize-actions">
                  <button className="btn-primary" onClick={()=>update({ subtitle:caption })}>Use this caption</button>
                  <button className="btn-ghost" onClick={()=>{ setCaption(''); update({ subtitle:'' }) }}>Reset</button>
                </div>
                <div className="panel-hint">Leave it empty to keep the template’s original line.</div>
              </div>
            )}

            {tab==='decor' && (
              <div className="decor-list">
                {DECOR.map(d=>(
                  <button
                    key={d.id}
                    className={`decor-row ${(customization.decor || template.decor) === d.id ? 'is-active' : ''}`}
                    onClick={()=>update({ decor:d.id })}
                  >
                    <span className="decor-label">{d.label}</span>
                    <span className="decor-hint">{d.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="btn-primary customize-cta" onClick={finish}>Print & finish →</button>
        </section>

        <section className="customize-preview">
          <div className="panel-label" style={{ marginBottom:10 }}>Live preview — drag stickers</div>
          <TemplateCanvas
            template={template}
            photos={frames}
            height={320}
            maxWidth={360}
            filterId={customization.filter}
            decor={customization.decor}
            stickers={customization.stickers}
            onStickersChange={(next)=> update({ stickers: next })}
            subtitle={customization.subtitle || ''}
            orgName={config.orgName}
            orgLogo={config.orgLogoUrl}
            eventName={config.eventName}
          />
          <div className="customize-meta">
            <span>{template.name}</span>
            <span className="dot">·</span>
            <span>{template.printSize}</span>
            <span style={{ color:'#71717a', marginLeft:6 }}>Filter: {customization.filter}</span>
          </div>
        </section>
      </div>

      <div className="booth-footer">
        <button className="btn-ghost" onClick={()=>nav('/booth/photos')}>← Back</button>
        <div className="booth-footer-mid">{session.prints} print{session.prints===1?'':'s'} queued • stickers draggable</div>
        <span style={{ width:88 }} />
      </div>
    </div>
  )
}
