import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BoothHeader from '../../components/BoothHeader'
import Loader from '../../components/Loader'
import TemplateCanvas from '../../components/TemplateCanvas'
import { useBooth } from '../../context/BoothContext'
import { EVENT_SAMPLES } from '../../data/templates'

export default function Photos(){
  const nav = useNavigate()
  const { config, session, photos, setSelectedPhotos, selectedPhotos } = useBooth()
  const [secondsLeft, setSecondsLeft] = useState(90)
  const [loading, setLoading] = useState(false)

  const template = session.template
  const slotsCount = template?.slots || 1

  const [slots, setSlots] = useState(()=>{
    const base = Array.from({ length: slotsCount }, ()=>null)
    const seed = (selectedPhotos && selectedPhotos.length ? selectedPhotos : photos || []).slice(0, slotsCount)
    seed.forEach((p,i)=>{ base[i] = p })
    return base
  })
  const [activeIdx, setActiveIdx] = useState(()=>{
    const firstEmpty = Array.from({ length: slotsCount }).findIndex((_,i)=> !(selectedPhotos && selectedPhotos[i]))
    return firstEmpty === -1 ? 0 : firstEmpty
  })

  useEffect(()=>{ const t = setInterval(()=>setSecondsLeft(s=>Math.max(0,s-1)),1000); return ()=>clearInterval(t) },[])
  useEffect(()=>{ if(secondsLeft===0) nav('/booth/start') },[secondsLeft])

  if(!template){
    return (
      <div className="booth-container" style={{ display:'grid', placeItems:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:700 }}>No template selected</div>
          <button className="btn-primary" style={{ marginTop:12 }} onClick={()=>nav('/booth/templates')}>Choose a template</button>
        </div>
      </div>
    )
  }
  if(!photos || photos.length === 0){
    return (
      <div className="booth-container" style={{ display:'grid', placeItems:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:700 }}>No shots yet</div>
          <div style={{ color:'#8b8b99', fontSize:12, marginTop:6 }}>Head back to the camera to capture your session.</div>
          <button className="btn-primary" style={{ marginTop:12 }} onClick={()=>nav('/booth/camera')}>Open camera</button>
        </div>
      </div>
    )
  }

  function place(photo){
    const next = [...slots]
    const existing = next.findIndex(s=> s && s.uri === photo.uri)
    if(existing >= 0){
      if(existing === activeIdx){ next[activeIdx] = null; setSlots(next); return }
      const previous = next[activeIdx]
      next[activeIdx] = photo
      next[existing] = previous
      setSlots(next)
      return
    }
    next[activeIdx] = photo
    setSlots(next)
    const empty = next.findIndex((s, i)=> i > activeIdx && !s)
    if(empty >= 0) setActiveIdx(empty)
  }

  const filled = slots.filter(Boolean).length
  const complete = filled === slotsCount
  const fill = slots.map((s,i)=> s?.uri || (EVENT_SAMPLES[template.category] || [])[i % 3])

  function next(){
    if(!complete) return
    setLoading(true)
    setSelectedPhotos(slots.filter(Boolean))
    setTimeout(()=>nav('/booth/customize'), 800)
  }
  if(loading) return <Loader text="Composing your print…" sub="Fitting your favourites into the layout" />

  return (
    <div className="booth-container">
      <BoothHeader
        title="Choose your favourites"
        subtitle={`Slot ${activeIdx + 1} is selected — tap a shot to place it`}
        step="SELECT SHOTS"
        secondsLeft={secondsLeft}
      />

      <div className="shots-body">
        <section className="shots-reel">
          <div className="shots-reel-head">
            <div className="shots-reel-title">Your shots</div>
            <div className="shots-progress">{filled} of {slotsCount} placed</div>
          </div>

          <div className="slot-row">
            {slots.map((slot, i)=>(
              <button
                key={i}
                className={`slot-pill ${activeIdx === i ? 'is-active' : ''} ${slot ? 'is-filled' : ''}`}
                onClick={()=>setActiveIdx(i)}
                aria-label={`Select slot ${i+1}`}
              >
                {slot ? <img src={slot.uri} alt="" /> : <span>{i+1}</span>}
              </button>
            ))}
          </div>

          <div className="shots-grid">
            {photos.map((photo, i)=>(
              <button key={photo.id || i} className="shot-tile" onClick={()=>place(photo)}>
                <img src={photo.uri} alt={`Shot ${i+1}`} />
                <span className="shot-tile-num">{String(i+1).padStart(2,'0')}</span>
                {slots.some(s=> s && s.uri === photo.uri) && <span className="shot-tile-tick">✓</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="shots-preview">
          <div className="panel-label" style={{ marginBottom:10 }}>Layout preview</div>
          <TemplateCanvas
            template={template}
            photos={fill}
            height={250}
            maxWidth={286}
            orgName={config.orgName}
            eventName={config.eventName}
            showSlotNumbers
          />
          <div className="shots-preview-note">
            {complete ? 'All slots filled — looking good.' : `Place ${slotsCount - filled} more shot${slotsCount-filled===1?'':'s'} to continue.`}
          </div>
        </section>
      </div>

      <div className="booth-footer">
        <button className="btn-ghost" onClick={()=>nav('/booth/camera')}>Retake</button>
        <div className="booth-footer-mid">Tap a placed shot again to free its slot.</div>
        <button className="btn-primary" disabled={!complete} onClick={next}>Continue →</button>
      </div>
    </div>
  )
}
