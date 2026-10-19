import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BoothHeader from '../../components/BoothHeader'
import Loader from '../../components/Loader'
import TemplateCanvas from '../../components/TemplateCanvas'
import { useBooth } from '../../context/BoothContext'
import { EVENT_SAMPLES } from '../../data/templates'

const CHOICES = [1,2,4,6,8,10]

export default function Prints(){
  const nav = useNavigate()
  const { config, session, setSession } = useBooth()
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{ const t = setInterval(()=>setSecondsLeft(s=>Math.max(0,s-1)),1000); return ()=>clearInterval(t) },[])
  useEffect(()=>{ if(secondsLeft===0) nav('/booth/start') },[secondsLeft])

  if(!session.template){
    return (
      <div className="booth-container" style={{ display:'grid', placeItems:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:700 }}>No template selected</div>
          <button className="btn-primary" style={{ marginTop:12 }} onClick={()=>nav('/booth/templates')}>Choose a template</button>
        </div>
      </div>
    )
  }

  const template = session.template
  const total = session.prints * template.price
  const maxPrints = 10

  function next(){ setLoading(true); setTimeout(()=>nav('/booth/payment'), 800) }
  if(loading) return <Loader text="Reserving your prints…" sub="Checking paper and queue" />

  return (
    <div className="booth-container">
      <BoothHeader
        title="Prints & digital copy"
        subtitle="Choose how many copies you want — the digital QR is included at no extra cost"
        step="STEP 3 OF 5"
        secondsLeft={secondsLeft}
      />

      <div className="prints-layout">
        <section className="prints-panel">
          <div className="panel-block">
            <div className="panel-label">Number of prints</div>
            <div className="print-choice-row">
              {CHOICES.map(n=>(
                <button
                  key={n}
                  className={`print-choice ${session.prints===n?'is-active':''}`}
                  onClick={()=>setSession(s=>({...s, prints:n}))}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="panel-hint">Up to {maxPrints} copies per session.</div>
          </div>

          <div className="panel-block panel-block-row">
            <div>
              <div className="panel-label" style={{ marginBottom:4 }}>Digital copy</div>
              <div className="panel-hint" style={{ marginTop:0 }}>QR code on the last screen — save and share.</div>
            </div>
            <div className="segmented">
              <button className={session.digitalCopy ? 'is-active' : ''} onClick={()=>setSession(s=>({...s, digitalCopy:true}))}>Yes</button>
              <button className={!session.digitalCopy ? 'is-active' : ''} onClick={()=>setSession(s=>({...s, digitalCopy:false}))}>No</button>
            </div>
          </div>

          <div className="order-box">
            <div className="order-row">
              <span>{session.prints} print{session.prints===1?'':'s'} × ₹{template.price}</span>
              <span>₹{total}</span>
            </div>
            <div className="order-row order-row-muted">
              <span>Digital copy</span>
              <span>{session.digitalCopy ? 'Included' : '—'}</span>
            </div>
            <div className="order-row order-row-total">
              <span>Total</span>
              <span>₹{total}</span>
            </div>
          </div>
        </section>

        <section className="prints-preview">
          <div className="panel-label" style={{ alignSelf:'flex-start', marginBottom:2 }}>Your print</div>
          <TemplateCanvas
            template={template}
            height={272}
            maxWidth={296}
            photos={(EVENT_SAMPLES[template.category] || []).slice(0, template.slots)}
            orgName={config.orgName}
            eventName={config.eventName}
          />
          <div className="prints-preview-meta">{template.name} · {template.printSize} · {template.slots} shot{template.slots===1?'':'s'}</div>
        </section>
      </div>

      <div className="booth-footer">
        <button className="btn-ghost" onClick={()=>nav('/booth/templates')}>← Back</button>
        <div className="booth-footer-mid">Coupon codes apply at payment.</div>
        <button className="btn-primary" onClick={next}>Continue to payment →</button>
      </div>
    </div>
  )
}
