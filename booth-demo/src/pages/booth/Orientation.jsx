import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BoothHeader from '../../components/BoothHeader'
import Loader from '../../components/Loader'
import { useBooth } from '../../context/BoothContext'
import { EVENT_SAMPLES, TEMPLATES } from '../../data/templates'

function FormatArt({ orientation, photos, orgName }){
  if(orientation === 'portrait'){
    return (
      <div className="format-art format-art-portrait">
        <div className="format-photo"><img src={photos[0]} alt="" /></div>
        <div className="format-photo"><img src={photos[1]} alt="" /></div>
        <div className="format-caption">{(orgName || 'HAPPYPIX').toUpperCase().slice(0,14)}</div>
      </div>
    )
  }
  return (
    <div className="format-art format-art-landscape">
      <div className="format-row">
        <div className="format-photo"><img src={photos[0]} alt="" /></div>
        <div className="format-photo"><img src={photos[2]} alt="" /></div>
      </div>
      <div className="format-caption">{(orgName || 'HAPPYPIX').toUpperCase().slice(0,18)}</div>
    </div>
  )
}

export default function Orientation(){
  const nav = useNavigate()
  const { config, session, setSession } = useBooth()
  const [selected, setSelected] = useState(session.orientation || null)
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{ const t = setInterval(()=>setSecondsLeft(s=>Math.max(0,s-1)),1000); return ()=>clearInterval(t) },[])
  useEffect(()=>{ if(secondsLeft===0) nav('/booth/start') },[secondsLeft])

  const photos = EVENT_SAMPLES[config.eventType] || EVENT_SAMPLES.party
  const counts = {
    portrait: TEMPLATES.filter(t=>t.orientation==='portrait' && t.category===config.eventType).length,
    landscape: TEMPLATES.filter(t=>t.orientation==='landscape' && t.category===config.eventType).length,
  }

  function next(){
    if(!selected) return
    setLoading(true)
    setTimeout(()=>{
      setSession(s=>({...s, orientation:selected, template:null}))
      nav('/booth/templates')
    }, 800)
  }
  if(loading) return <Loader text="Loading your templates…" sub="Arranging the collection" />

  return (
    <div className="booth-container">
      <BoothHeader
        title="Choose a format"
        subtitle="Pick the shape of your print — you can change your mind at the template step"
        step="STEP 1 OF 5"
        secondsLeft={secondsLeft}
      />

      <div className="format-body">
        {['portrait','landscape'].map(o=>{
          const isSelected = selected === o
          return (
            <button
              key={o}
              className={`format-card ${isSelected ? 'is-selected' : ''}`}
              onClick={()=>setSelected(o)}
              aria-pressed={isSelected}
            >
              <div className="format-art-wrap">
                <FormatArt orientation={o} photos={photos} orgName={config.orgName} />
                {isSelected && <span className="format-check">✓</span>}
              </div>
              <div className="format-info">
                <div className="format-name">{o === 'portrait' ? 'Portrait' : 'Landscape'}</div>
                <div className="format-desc">
                  {o === 'portrait'
                    ? 'Classic strips and tall prints — the guest favourite.'
                    : 'Wide frames for groups and full scenes.'}
                </div>
                <div className="format-meta">{counts[o]} design{counts[o]===1?'':'s'} in this format</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="booth-footer">
        <button className="btn-ghost" onClick={()=>nav('/booth/start')}>← Back</button>
        <div className="booth-footer-mid">{selected ? `${selected === 'portrait' ? 'Portrait' : 'Landscape'} selected` : 'Select a format to continue'}</div>
        <button className="btn-primary" disabled={!selected} onClick={next}>See templates →</button>
      </div>
    </div>
  )
}
