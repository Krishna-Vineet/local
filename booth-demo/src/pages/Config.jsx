import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useBooth } from '../context/BoothContext'
import { EVENT_TYPES } from '../data/templates'

export default function Config(){
  const nav = useNavigate()
  const { config, setConfig, resetSession } = useBooth()
  const [orgName, setOrgName] = useState(config.orgName)
  const [eventName, setEventName] = useState(config.eventName)
  const [eventType, setEventType] = useState(config.eventType)
  const [orgLogoPreview, setOrgLogoPreview] = useState(config.orgLogoUrl)
  const [sponsorPreviews, setSponsorPreviews] = useState(config.sponsorLogos || [])
  const [err, setErr] = useState('')

  function onOrgLogo(e){
    const f = e.target.files?.[0]
    if(!f) return
    const url = URL.createObjectURL(f)
    setOrgLogoPreview(url)
  }
  function onSponsor(e){
    const files = Array.from(e.target.files || []).slice(0,3)
    const urls = files.map(f=>URL.createObjectURL(f))
    setSponsorPreviews(urls)
  }
  function handleStart(e){
    e.preventDefault()
    if(!orgName.trim() || !eventName.trim()){ setErr('Organization and event name are required.'); return }
    setConfig({
      orgName: orgName.trim(),
      orgLogo: null,
      orgLogoUrl: orgLogoPreview,
      eventName: eventName.trim(),
      eventType,
      sponsorLogos: sponsorPreviews,
    })
    resetSession()
    nav('/booth/start')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#050508' }}>
      <nav style={{ height:56, borderBottom:'1px solid #11111a', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px' }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, fontWeight:900 }}>
          <span style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#8b5cf6,#ec4899)', display:'grid', placeItems:'center', fontSize:13 }}>HP</span> HappyPix
        </Link>
        <div style={{ display:'flex', gap:10, fontSize:12 }}>
          <a href="https://happypix.in" target="_blank" rel="noreferrer" style={{ color:'#a1a1aa', fontWeight:700 }}>Website ↗</a>
          <a href="#" style={{ color:'#a1a1aa', fontWeight:700 }}>CRM Demo</a>
          <span style={{ background:'#18181f', border:'1px solid #27272a', borderRadius:999, padding:'6px 12px', fontWeight:800 }}>Booth Setup</span>
        </div>
      </nav>

      <div className="container" style={{ padding:'18px 0 28px' }}>
        <div style={{ textAlign:'center', maxWidth:640, margin:'0 auto' }}>
          <div style={{ display:'inline-block', background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#a78bfa', padding:'6px 12px', borderRadius:999, fontSize:11, fontWeight:800, letterSpacing:0.8 }}>STEP 0 — BRAND IT</div>
          <h1 style={{ marginTop:10, fontSize:32, fontWeight:900, letterSpacing:-0.5 }}>Get the Happypix Booth Experience</h1>
          <p style={{ marginTop:8, color:'#a1a1aa', fontSize:13, lineHeight:1.6 }}>Personalize the booth for your pitch. This branding will appear on every preview, print frame and the final success QR.</p>
        </div>

        <form onSubmit={handleStart} style={{ marginTop:18, display:'grid', gridTemplateColumns:'1.1fr 0.9fr', gap:16, maxWidth:920, margin:'18px auto 0' }}>
          <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:20, padding:18 }}>
            <h3 style={{ fontWeight:800, fontSize:14 }}>Your pitch branding</h3>

            <label style={labelStyle}>Organization name *</label>
            <input value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="e.g. The Leela Palace" style={inputStyle} />

            <label style={labelStyle}>Organization logo</label>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <label style={{ flex:1, background:'#18181f', border:'1px dashed #2a2a3e', borderRadius:12, padding:14, textAlign:'center', cursor:'pointer', fontSize:12, color:'#a1a1aa', fontWeight:600 }}>
                {orgLogoPreview ? '✓ Logo selected — tap to change' : 'Upload PNG / JPG (white bg works best)'}
                <input type="file" accept="image/*" onChange={onOrgLogo} style={{ display:'none' }} />
              </label>
              {orgLogoPreview && <img src={orgLogoPreview} alt="" style={{ width:56, height:56, objectFit:'cover', borderRadius:10, border:'1px solid #222232' }} />}
            </div>

            <label style={labelStyle}>Event / activation name *</label>
            <input value={eventName} onChange={e=>setEventName(e.target.value)} placeholder="e.g. Annual Gala 2026" style={inputStyle} />

            <label style={labelStyle}>Type of event</label>
            <select value={eventType} onChange={e=>setEventType(e.target.value)} style={inputStyle}>
              {EVENT_TYPES.map(t=> <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
            </select>
            <div style={{ marginTop:8, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:12, padding:10, fontSize:11, color:'#c4b5fd', lineHeight:1.6 }}>
              Templates are curated per event type. Try <b>Party</b> for energy, <b>Formal</b> for elegance, <b>Cinema</b> for a red carpet vibe.
            </div>

            <label style={labelStyle}>Sponsor / template logos (up to 3)</label>
            <div style={{ background:'#18181f', border:'1px dashed #2a2a3e', borderRadius:12, padding:14, textAlign:'center' }}>
              <label style={{ cursor:'pointer', fontSize:12, color:'#a1a1aa', fontWeight:600 }}>
                Upload up to 3 small logos (appear on print header)
                <input type="file" accept="image/*" multiple onChange={onSponsor} style={{ display:'none' }} />
              </label>
              {sponsorPreviews.length>0 && (
                <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:10 }}>
                  {sponsorPreviews.map((u,i)=><img key={i} src={u} alt="" style={{ width:44, height:44, objectFit:'cover', borderRadius:8, border:'1px solid #222232' }} />)}
                </div>
              )}
            </div>

            {err && <div style={{ marginTop:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#fda4af', padding:'8px 10px', borderRadius:10, fontSize:12, fontWeight:600 }}>{err}</div>}

            <button type="submit" style={{ marginTop:14, width:'100%', background:'linear-gradient(90deg,#8b5cf6,#ec4899)', color:'#fff', padding:'14px 18px', borderRadius:14, fontWeight:900, fontSize:15, border:'none', boxShadow:'0 10px 24px rgba(139,92,246,0.35)' }}>
              Start Session →
            </button>
            <div style={{ marginTop:8, textAlign:'center', color:'#71717a', fontSize:11 }}>You’ll see a loader between booth screens to make it feel real & engaging.</div>
          </div>

          {/* preview */}
          <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:20, padding:18, alignSelf:'start' }}>
            <div style={{ fontWeight:800, fontSize:13 }}>Live preview</div>
            <div style={{ marginTop:10, background:'#09090f', border:'1px solid #1a1a28', borderRadius:16, padding:14, textAlign:'center' }}>
              <div style={{ display:'inline-block', background:'#18181f', border:'1px solid #27272a', borderRadius:999, padding:'6px 10px', fontSize:10, fontWeight:800, letterSpacing:0.8, color:'#a78bfa' }}>{EVENT_TYPES.find(x=>x.id===eventType)?.label.toUpperCase()} • {eventName || 'EVENT NAME'}</div>
              <div style={{ marginTop:12, width:220, margin:'12px auto 0', background:'#fff', borderRadius:12, padding:6, display:'flex', flexDirection:'column', gap:4, boxShadow:'0 12px 32px rgba(0,0,0,0.45)' }}>
                <div style={{ height:78, background:'#11111a', borderRadius:8, display:'grid', placeItems:'center', color:'#71717a', fontSize:10, fontWeight:700 }}>YOUR PRINT PREVIEW</div>
                <div style={{ background:'linear-gradient(90deg,#8b5cf6,#ec4899)', borderRadius:8, padding:'6px 8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ color:'#fff', fontSize:7, fontWeight:900 }}>HAPPYPIX</div>
                  <div style={{ color:'#fff', fontSize:6, fontWeight:800 }}>{(orgName||'YOUR ORG').slice(0,20).toUpperCase()}</div>
                </div>
              </div>
              {orgLogoPreview && <div style={{ marginTop:10, fontSize:11, color:'#a1a1aa' }}>Org logo will float on the print header & success screen.</div>}
              {sponsorPreviews.length>0 && <div style={{ marginTop:4, fontSize:11, color:'#a1a1aa' }}>{sponsorPreviews.length} sponsor logo(s) will be composited on templates.</div>}
              <div style={{ marginTop:12, display:'flex', gap:8, justifyContent:'center' }}>
                <span style={{ background:'#18181f', border:'1px solid #27272a', borderRadius:999, padding:'6px 10px', fontSize:10, fontWeight:700, color:'#a1a1aa' }}>4x6 • 5x7 • 6x8 • 2x6 strip</span>
              </div>
            </div>

            <div style={{ marginTop:14, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:12, padding:10, fontSize:11, lineHeight:1.6, color:'#86efac' }}>
              <b style={{ color:'#4ade80' }}>Sales tip:</b> Fill this right before you hand the device to the client — they see their own name on the booth instantly.
            </div>

            <div style={{ marginTop:14, display:'flex', gap:8 }}>
              <Link to="/" style={{ flex:1, textAlign:'center', background:'#18181f', border:'1px solid #27272a', color:'#d4d4d8', padding:'10px', borderRadius:12, fontWeight:700, fontSize:13 }}>← Back to site</Link>
              <button onClick={handleStart} style={{ flex:1, background:'#8b5cf6', color:'#fff', padding:'10px', borderRadius:12, fontWeight:800, fontSize:13, border:'none' }}>Start Session →</button>
            </div>
          </div>
        </form>

        <div style={{ maxWidth:920, margin:'16px auto 0', display:'flex', gap:8, flexWrap:'wrap', fontSize:11, color:'#71717a' }}>
          <span>Quick fills:</span>
          {[
            { org:'The Leela • Mumbai', ev:'The Founders Gala' },
            { org:'PVR Cinemas • Delhi', ev:'Premiere Night' },
            { org:'Taj Weddings', ev:'Aarav & Sneha' },
          ].map(q=>(
            <button key={q.org} onClick={()=>{ setOrgName(q.org); setEventName(q.ev); }} style={{ background:'#0f0f16', border:'1px solid #222232', color:'#a1a1aa', padding:'6px 10px', borderRadius:999, fontSize:11, fontWeight:600 }}>{q.org} — {q.ev}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
const labelStyle = { display:'block', marginTop:12, fontSize:11, fontWeight:800, letterSpacing:0.8, color:'#a78bfa', textTransform:'uppercase' }
const inputStyle = { marginTop:6, width:'100%', background:'#18181f', border:'1px solid #27272a', color:'#fff', padding:'10px 12px', borderRadius:12, fontSize:14, outline:'none' }
