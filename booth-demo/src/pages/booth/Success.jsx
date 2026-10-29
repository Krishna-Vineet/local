import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useBooth } from '../../context/BoothContext'

const DOWNLOAD_URL = 'https://happypix.in/download/demo'

export default function Success(){
  const nav = useNavigate()
  const { config, session, photos, selectedPhotos } = useBooth()
  const [seconds, setSeconds] = useState(30)
  const [copied, setCopied] = useState(false)

  const hasDigital = session.digitalCopy !== false
  const shareUrl = `${DOWNLOAD_URL}?org=${encodeURIComponent(config.orgName || '')}&event=${encodeURIComponent(config.eventName || '')}`
  const jobRef = `HP-${String(Date.now()).slice(-6)}`
  const shots = (selectedPhotos?.length ? selectedPhotos : photos || []).slice(0, 3)

  useEffect(()=>{
    const t = setInterval(()=> setSeconds(s=>{
      if(s <= 1){ clearInterval(t); nav('/booth/start'); return 0 }
      return s - 1
    }), 1000)
    return ()=>clearInterval(t)
  },[nav])

  function copy(){
    navigator.clipboard?.writeText(shareUrl)
    setCopied(true)
    setTimeout(()=>setCopied(false), 1800)
  }

  return (
    <div className="done-page">
      <div className="done-shell">
        <header className="done-top">
          <div className="done-top-left">
            <span className="done-mark">✓</span>
            <div>
              <div className="done-top-title">Your print is on its way</div>
              <div className="done-top-sub">Job {jobRef} · {config.eventName || 'Event'} · {session.prints} {session.prints === 1 ? 'copy' : 'copies'}</div>
            </div>
          </div>
          <button className="btn-primary" onClick={()=>nav('/booth/start')}>New session · {seconds}s</button>
        </header>

        <main className="done-grid">
          <section className="done-card">
            <div className="done-big">✓</div>
            <div className="done-eyebrow">Session complete</div>
            <h1 className="done-title">Thanks for stepping in.</h1>
            <p className="done-copy">
              Collect your print at the desk. This screen resets for the next guest in {seconds} seconds.
            </p>

            <div className="done-shots">
              {shots.length === 0 && <span className="done-shot-empty">No shots saved</span>}
              {shots.map((p,i)=>(
                <img key={i} src={p.uri || p} alt="" className="done-shot" />
              ))}
            </div>

            <div className="done-details">
              <div className="done-details-title">{config.orgName || 'Your organisation'}</div>
              <div className="done-details-meta">
                {session.template?.name} · {session.template?.printSize} · {session.template?.slots} shot{session.template?.slots === 1 ? '' : 's'}
              </div>
            </div>
          </section>

          <section className="done-card done-card-center">
            {hasDigital ? (
              <>
                <div className="done-eyebrow">Digital copy</div>
                <h2 className="done-subtitle">Scan to save your photos</h2>
                <div className="done-qr">
                  <QRCodeSVG value={shareUrl} size={172} level="H" />
                </div>
                <p className="done-qr-note">Open any camera app to download the full-resolution files.</p>
                <div className="done-qr-meta">Link valid for 24 hours</div>
                <div className="done-actions">
                  <a href={shareUrl} target="_blank" rel="noreferrer" className="btn-ghost">Open download page</a>
                  <button className="btn-primary" onClick={copy}>{copied ? 'Link copied' : 'Copy link'}</button>
                </div>
              </>
            ) : (
              <>
                <div className="done-eyebrow">Print only</div>
                <h2 className="done-subtitle">Your prints are waiting</h2>
                <p className="done-qr-note" style={{ marginTop:12 }}>Pick them up at the print desk. No digital copy was selected for this session.</p>
              </>
            )}
          </section>
        </main>

        <footer className="done-footer">
          <span>Demo build · no printer, payment or upload is real</span>
          <div className="done-footer-actions">
            <button className="btn-ghost" onClick={()=>nav('/')}>Change setup</button>
            <button className="btn-ghost" onClick={()=>nav('/booth/start')}>Next guest</button>
          </div>
        </footer>
      </div>
    </div>
  )
}
