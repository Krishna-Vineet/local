import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useBooth } from '../context/BoothContext'
import { EVENT_TYPES, EVENT_COPY, EVENT_SAMPLES } from '../data/templates'
import TemplateCanvas from '../components/TemplateCanvas'

function Chevron({ open }){
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform .18s ease' }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Setup(){
  const nav = useNavigate()
  const { config, setConfig, resetSession } = useBooth()

  const [orgName, setOrgName] = useState(config.orgName || '')
  const [eventName, setEventName] = useState(config.eventName || '')
  const [eventType, setEventType] = useState(config.eventType || 'party')
  const [orgLogo, setOrgLogo] = useState(config.orgLogoUrl || null)
  const [sponsors, setSponsors] = useState(config.sponsorLogos || [])
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [pendingSponsorIdx, setPendingSponsorIdx] = useState(null)
  const menuRef = useRef(null)
  const sponsorInput = useRef(null)

  const type = EVENT_TYPES.find(t=>t.id===eventType) || EVENT_TYPES[0]
  const shortLabel = (label)=> label.split('&')[0].split('/')[0].trim()
  const samples = (EVENT_SAMPLES[eventType] || EVENT_SAMPLES.party).slice(0,2)

  useEffect(()=>{
    function onDoc(e){ if(menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    function onKey(e){ if(e.key==='Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return ()=>{ document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  },[])

  function pickLogo(e){
    const file = e.target.files?.[0]
    if(!file) return
    setOrgLogo(URL.createObjectURL(file))
    e.target.value = ''
  }
  function handleSponsorSlotClick(idx){
    setPendingSponsorIdx(idx)
    sponsorInput.current?.click()
  }
  function pickSponsors(e){
    const files = Array.from(e.target.files || [])
    if(!files.length) {
      setPendingSponsorIdx(null)
      return
    }
    const urls = files.map(f=>URL.createObjectURL(f))
    setSponsors(prev=>{
      const next = [...prev]
      // ensure we work with a stable 3-slot model but keep compact array for display
      // If user clicked a specific slot
      if(pendingSponsorIdx !== null){
        const target = pendingSponsorIdx
        // If target is within current length, replace it
        // If target is at the end (e.g. empty slot), append / insert
        if(target < next.length){
          // single file replaces that slot
          if(urls.length === 1) next[target] = urls[0]
          else {
            // multiple files from explicit slot: replace target and fill forward
            let c = 0
            for(let i=target; i<3 && c < urls.length; i++){
              if(i < next.length) next[i] = urls[c++]
              else { next.push(urls[c++]) }
            }
          }
        } else {
          // target beyond length => append in order filling gaps
          // fill any undefined holes first, then push
          for(const u of urls){
            if(next.length < 3) next.push(u)
            else break
          }
        }
        return next.slice(0,3)
      }
      // No specific target: fill empty slots sequentially (up to 3)
      for(const u of urls){
        if(next.length < 3) next.push(u)
        else break
      }
      return next.slice(0,3)
    })
    setPendingSponsorIdx(null)
    e.target.value = ''
  }
  function removeSponsor(e, i){
    e.stopPropagation()
    setSponsors(s=>s.filter((_,idx)=>idx!==i))
  }

  function start(e){
    e.preventDefault()
    if(!orgName.trim() || !eventName.trim()){
      setError('Add an organisation name and an event name to continue.')
      return
    }
    setError('')
    setConfig({
      orgName: orgName.trim(),
      orgLogo: null,
      orgLogoUrl: orgLogo,
      eventName: eventName.trim(),
      eventType,
      sponsorLogos: sponsors,
    })
    resetSession()
    nav('/booth/start')
  }

  return (
    <div className="setup-page">
      <div className="setup-glow setup-glow-a" aria-hidden="true" />
      <div className="setup-glow setup-glow-b" aria-hidden="true" />

      <div className="setup-shell">
        <header className="setup-top">
          <Logo height={62} />
          <div className="setup-status">
            <span className="setup-status-dot" />
            <span>Demo build — no hardware connected</span>
          </div>
        </header>

        <main className="setup-panel">
          <section className="setup-form">
            <div className="setup-eyebrow"><span className="setup-eyebrow-line" />Session setup</div>
            <h1 className="setup-title">Set up your booth.</h1>
            <p className="setup-lede">
              Add the details for this event. The welcome screen, templates, prints and download page all carry this branding.
            </p>

            <form onSubmit={start} noValidate>
              <div className="field">
                <label className="field-label" htmlFor="org-name">Organisation</label>
                <div className="org-row">
                  <label className={`logo-drop ${orgLogo ? 'has-logo' : ''}`} title="Upload organisation logo">
                    {orgLogo
                      ? <img src={orgLogo} alt="Organisation logo" />
                      : <><span className="logo-drop-plus">+</span><span className="logo-drop-text">Logo</span></>}
                    <input type="file" accept="image/*" onChange={pickLogo} hidden />
                  </label>
                  <input
                    id="org-name"
                    className="field-input"
                    value={orgName}
                    onChange={e=>{setOrgName(e.target.value); setError('')}}
                    placeholder="The Leela Palace"
                    autoComplete="organization"
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label className="field-label" htmlFor="event-name">Event name</label>
                  <input
                    id="event-name"
                    className="field-input"
                    value={eventName}
                    onChange={e=>{setEventName(e.target.value); setError('')}}
                    placeholder="Annual Gala 2026"
                  />
                </div>

                <div className="field">
                  <label className="field-label" id="event-type-label">Event type</label>
                  <div className="select" ref={menuRef}>
                    <button
                      type="button"
                      className={`select-trigger ${menuOpen ? 'is-open' : ''}`}
                      aria-labelledby="event-type-label"
                      aria-expanded={menuOpen}
                      onClick={()=>setMenuOpen(o=>!o)}
                    >
                      <span className="select-swatch" style={{ background:type.color }} />
                      <span className="select-value">{shortLabel(type.label)}</span>
                      <span className="select-chevron"><Chevron open={menuOpen} /></span>
                    </button>
                    {menuOpen && (
                      <div className="select-menu" role="listbox">
                        {EVENT_TYPES.map(t=>(
                          <button
                            key={t.id}
                            type="button"
                            role="option"
                            aria-selected={t.id===eventType}
                            className={`select-option ${t.id===eventType ? 'is-selected' : ''}`}
                            onClick={()=>{ setEventType(t.id); setMenuOpen(false) }}
                          >
                            <span className="select-swatch" style={{ background:t.color }} />
                            <span className="select-option-text">
                              <span className="select-option-label">{t.label}</span>
                              <span className="select-option-desc">{EVENT_COPY[t.id] || 'Curated templates'}</span>
                            </span>
                            {t.id===eventType && <span className="select-check">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="field">
                <div className="field-label-row">
                  <span className="field-label">Sponsor logos</span>
                  <span className="field-optional">Optional · up to 3</span>
                </div>
                <div className="sponsor-row">
                  {[0,1,2].map(i=>(
                    <button
                      key={i}
                      type="button"
                      className={`sponsor-slot ${sponsors[i] ? 'has-logo' : ''}`}
                      onClick={()=>handleSponsorSlotClick(i)}
                    >
                      {sponsors[i]
                        ? <><img src={sponsors[i]} alt={`Sponsor logo ${i+1}`} /><span className="sponsor-remove" onClick={e=>removeSponsor(e,i)}>×</span></>
                        : <span className="sponsor-plus">+</span>}
                    </button>
                  ))}
                  <span className="field-help">Shown in the print header alongside your organisation. Tap each + to add a different logo.</span>
                </div>
                <input ref={sponsorInput} type="file" accept="image/*" multiple onChange={pickSponsors} hidden />
              </div>

              {error && <div className="setup-error">{error}</div>}

              <button className="start-btn" type="submit">
                <span>Start session</span>
                <span className="start-btn-arrow" aria-hidden="true">→</span>
              </button>
              <p className="start-meta">Takes about two minutes · Camera access is requested when you reach the booth</p>
            </form>
          </section>

          <aside className="setup-side">
            <div className="side-head">
              <span className="side-head-label">Print preview</span>
              <span className="side-live"><span />Live</span>
            </div>

            <div className="preview-stage">
              <TemplateCanvas
                template={PREVIEW_TEMPLATE(shortLabel(type.label))}
                width={216}
                photos={samples}
                orgName={orgName.trim() || 'Your organisation'}
                eventName={eventName.trim() || 'Your event name'}
                orgLogo={orgLogo}
                sponsorLogos={sponsors}
                showSlotNumbers={false}
              />
            </div>

            <p className="side-note">A 4×6 guest print, updating as you type.</p>

            <div className="side-meta">
              <div className="side-meta-row"><span>Format</span><span>Portrait & landscape</span></div>
              <div className="side-meta-row"><span>Prints</span><span>1 – 10 copies</span></div>
              <div className="side-meta-row"><span>Delivery</span><span>Print + digital QR</span></div>
            </div>

            <div className="side-divider" />
            <div className="flow-label">Guest flow</div>
            <div className="flow">
              {['Format','Template','Prints','Payment','Capture','Print'].map((step,i)=>(
                <span className="flow-step" key={step}>
                  <span className="flow-num">{String(i+1).padStart(2,'0')}</span>{step}
                </span>
              ))}
            </div>
          </aside>
        </main>

        <footer className="setup-foot">
          <span>HappyPix Booth</span>
          <span>Frontend demo · nothing is charged or printed</span>
        </footer>
      </div>
    </div>
  )
}

function PREVIEW_TEMPLATE(typeLabel){
  return {
    id:'preview',
    name:'Preview',
    category:'party',
    orientation:'portrait',
    printSize:'4x6',
    slots:2,
    price:0,
    palette:{ bg:'#ffffff', ink:'#15151a', soft:'#8e8e96', accent:'#7c3aed', accent2:'#ec4899', band:'gradient' },
    accentStrip:typeLabel ? typeLabel.toUpperCase() : 'PHOTOBOOTH',
    decor:'none',
    serif:false,
    canvas:{ w:667, h:1000 },
    slotLayout:[
      { x:0, y:0, w:100, h:48.8 },
      { x:0, y:51.2, w:100, h:48.8 },
    ],
  }
}
