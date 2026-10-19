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
    update({ stickers: [...(customization.stickers || []), sticker] })
  }
  function removeSticker(id){ update({ stickers: customization.stickers.filter(s=>s.id !== id) }) }

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
              </div>
            )}

            {tab==='stickers' && (
              <div>
                <div className="panel-hint" style={{ marginTop:0, marginBottom:10 }}>Tap to place. Remove from the list below.</div>
                <div className="sticker-grid">
                  {STICKERS.map(e=>(
                    <button key={e} className="sticker-btn" onClick={()=>addSticker(e)}>{e}</button>
                  ))}
                </div>
                {(customization.stickers || []).length > 0 && (
                  <div className="sticker-active-row">
                    {customization.stickers.map(s=>(
                      <button key={s.id} className="sticker-chip" onClick={()=>removeSticker(s.id)}>
                        <span>{s.emoji}</span><span className="sticker-chip-x">×</span>
                      </button>
                    ))}
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
          <div className="panel-label" style={{ marginBottom:10 }}>Live preview</div>
          <TemplateCanvas
            template={template}
            photos={frames}
            height={264}
            maxWidth={330}
            filterId={customization.filter}
            decor={customization.decor}
            stickers={customization.stickers}
            subtitle={customization.subtitle || ''}
            orgName={config.orgName}
            eventName={config.eventName}
          />
          <div className="customize-meta">
            <span>{template.name}</span>
            <span className="dot">·</span>
            <span>{template.printSize}</span>
          </div>
        </section>
      </div>

      <div className="booth-footer">
        <button className="btn-ghost" onClick={()=>nav('/booth/photos')}>← Back</button>
        <div className="booth-footer-mid">{session.prints} print{session.prints===1?'':'s'} queued</div>
        <span style={{ width:88 }} />
      </div>
    </div>
  )
}
