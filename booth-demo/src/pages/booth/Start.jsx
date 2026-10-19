import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo'
import Loader from '../../components/Loader'
import { useBooth } from '../../context/BoothContext'
import { EVENT_SAMPLES, EVENT_TAGLINES, EVENT_TYPES } from '../../data/templates'

function Heart(){
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#ffffff" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}

function Aperture(){
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M12 3v9M20.8 7.5l-7.8 4.5M20.8 16.5l-7.8-4.5M12 21v-9M3.2 16.5l7.8-4.5M3.2 7.5l7.8 4.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity=".9"/>
    </svg>
  )
}

export default function Start(){
  const nav = useNavigate()
  const { config, resetSession } = useBooth()
  const [starting, setStarting] = useState(false)
  const [imageErrors, setImageErrors] = useState({})

  const orgName = (config.orgName || '').trim()
  const eventName = (config.eventName || '').trim() || 'HappyPix Photo Booth'
  const typeLabel = (EVENT_TYPES.find(t=>t.id===config.eventType) || EVENT_TYPES[0]).label
  const tagline = EVENT_TAGLINES[config.eventType] || EVENT_TAGLINES.party
  const fallbackPhotos = EVENT_SAMPLES.party
  const photos = EVENT_SAMPLES[config.eventType] || fallbackPhotos

  useEffect(()=>{
    if(!starting) return
    const t = setTimeout(()=> nav('/booth/orientation'), 900)
    return ()=> clearTimeout(t)
  },[starting, nav])

  function begin(){
    if(starting) return
    resetSession()   // every guest starts from a clean session, branding is kept
    setStarting(true)
  }

  if(starting) return <Loader text="Starting your session…" sub="Warming up the booth" />

  return (
    <div
      className="start-screen"
      role="button"
      tabIndex={0}
      onClick={begin}
      onKeyDown={e=>{ if(e.key==='Enter' || e.key===' ') begin() }}
    >
      <div className="start-orb start-orb-a" aria-hidden="true" />
      <div className="start-orb start-orb-b" aria-hidden="true" />
      <div className="start-orb start-orb-c" aria-hidden="true" />

      <header className="start-top">
        <Logo height={54} />
        {orgName && <div className="start-org">{orgName.toUpperCase()}</div>}
      </header>

      <main className="start-body">
        <div className="cards-stage" aria-hidden="true">
          <div className="polaroid polaroid-left">
            {!imageErrors[0]
              ? <img src={photos[0]} alt="" onError={()=>setImageErrors(e=>({...e,0:true}))} />
              : <img src={fallbackPhotos[0]} alt="" />}
            <div className="polaroid-caption">HAPPYPIX LIVE</div>
          </div>
          <div className="polaroid polaroid-right">
            {!imageErrors[1]
              ? <img src={photos[1]} alt="" onError={()=>setImageErrors(e=>({...e,1:true}))} />
              : <img src={fallbackPhotos[1]} alt="" />}
            <div className="polaroid-caption">{orgName ? orgName.toUpperCase().slice(0,16) : 'PHOTOBOOTH'}</div>
          </div>
          <div className="polaroid polaroid-center">
            {!imageErrors[2]
              ? <img src={photos[2]} alt="" onError={()=>setImageErrors(e=>({...e,2:true}))} />
              : <img src={fallbackPhotos[2]} alt="" />}
            <div className="polaroid-caption">STUDIO EDITION</div>
            <div className="polaroid-gloss" />
          </div>
          <div className="heart-stamp"><Heart /></div>
        </div>

        <section className="start-info">
          <div className="start-eyebrow">
            <span className="start-eyebrow-line" />
            <span className="start-eyebrow-text">Welcome to</span>
            <span className="start-eyebrow-line" />
          </div>

          <h1 className="start-title">{eventName}</h1>

          <div className="start-pills">
            {orgName && <span className="start-pill is-brand">{orgName}</span>}
            <span className="start-pill">{typeLabel}</span>
          </div>

          <p className="start-tagline">“{tagline}”</p>
        </section>
      </main>

      <div className="start-cta-wrap">
        <div className="start-cta">
          <span className="start-cta-icon"><Aperture /></span>
          <span className="start-cta-label">Touch to start</span>
          <span className="start-cta-arrow">→</span>
        </div>
      </div>
    </div>
  )
}
