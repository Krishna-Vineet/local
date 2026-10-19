import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BoothHeader from '../../components/BoothHeader'
import Loader from '../../components/Loader'
import TemplateCanvas from '../../components/TemplateCanvas'
import { useBooth } from '../../context/BoothContext'
import { TEMPLATES, EVENT_SAMPLES, EVENT_TYPES } from '../../data/templates'

const SIZES = ['All','4x6','5x7','6x8','2x6']
const SHOTS = ['All','1','2','3','4']

export default function Templates(){
  const nav = useNavigate()
  const { config, session, setSession } = useBooth()
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [loading, setLoading] = useState(false)
  const [filterSize, setFilterSize] = useState('All')
  const [filterShots, setFilterShots] = useState('All')
  const [selectedId, setSelectedId] = useState(session.template?.id || null)

  useEffect(()=>{ const t = setInterval(()=>setSecondsLeft(s=>Math.max(0,s-1)),1000); return ()=>clearInterval(t) },[])
  useEffect(()=>{ if(secondsLeft===0) nav('/booth/start') },[secondsLeft])

  const orientation = session.orientation || 'portrait'
  const type = EVENT_TYPES.find(t=>t.id===config.eventType) || EVENT_TYPES[0]

  const collection = useMemo(()=>{
    const forOrientation = TEMPLATES.filter(t=>t.orientation===orientation)
    const byType = forOrientation.filter(t=>t.category===config.eventType)
    let arr = byType.length >= 4
      ? byType
      : [...byType, ...forOrientation.filter(t=>t.category!==config.eventType).slice(0, 4 - byType.length)]
    if(filterSize !== 'All') arr = arr.filter(t=>t.printSize===filterSize)
    if(filterShots !== 'All') arr = arr.filter(t=>String(t.slots)===filterShots)
    return arr
  },[orientation, filterSize, filterShots, config.eventType])

  function select(item){
    setSelectedId(item.id)
    setSession(s=>({...s, template:item}))
  }
  function next(){
    if(!selectedId) return
    setLoading(true)
    setTimeout(()=> nav('/booth/prints'), 850)
  }
  if(loading) return <Loader text="Preparing your print studio…" sub="Loading frames and colour profiles" />

  const selected = TEMPLATES.find(t=>t.id===selectedId)

  return (
    <div className="booth-container">
      <BoothHeader
        title="Choose your template"
        subtitle={`${type.short} collection · ${orientation === 'portrait' ? 'vertical' : 'horizontal'} · ${EVENT_SAMPLES[config.eventType] ? 'styled for your event' : ''}`}
        step="STEP 2 OF 5"
        secondsLeft={secondsLeft}
      />

      <div className="template-toolbar">
        <div className="chip-group">
          <span className="chip-label">Size</span>
          {SIZES.map(sz=>(
            <button key={sz} className={`chip ${filterSize===sz?'is-active':''}`} onClick={()=>setFilterSize(sz)}>{sz === 'All' ? 'All sizes' : sz}</button>
          ))}
        </div>
        <div className="chip-group">
          <span className="chip-label">Photos</span>
          {SHOTS.map(n=>(
            <button key={n} className={`chip ${filterShots===n?'is-active':''}`} onClick={()=>setFilterShots(n)}>{n === 'All' ? 'Any' : `${n} shot${n==='1'?'':'s'}`}</button>
          ))}
        </div>
      </div>

      <div className="template-scroll">
        {collection.length === 0 ? (
          <div className="template-empty">
            <div className="template-empty-title">No designs match those filters</div>
            <div className="template-empty-sub">Try another print size or photo count.</div>
          </div>
        ) : (
          <div className="template-grid">
            {collection.map(item=>{
              const isSelected = selectedId === item.id
              return (
                <button
                  key={item.id}
                  className={`template-card ${isSelected?'is-selected':''}`}
                  onClick={()=>select(item)}
                  aria-pressed={isSelected}
                >
                  <div className="template-card-art">
                    <TemplateCanvas
                      template={item}
                      height={
                        orientation === 'portrait'
                          ? (item.printSize === '2x6' ? 240 : 224)
                          : (item.printSize === '2x6' ? 100 : 196)
                      }
                      maxWidth={orientation==='portrait' ? 170 : 300}
                      photos={(EVENT_SAMPLES[item.category] || []).slice(0, item.slots)}
                      orgName={config.orgName}
                      eventName={config.eventName}
                    />
                    {isSelected && <span className="template-tick">✓</span>}
                  </div>
                  <div className="template-card-info">
                    <div className="template-card-text">
                      <span className="template-card-name">{item.name}</span>
                      <span className="template-card-meta">{item.printSize} · {item.slots} shot{item.slots===1?'':'s'}</span>
                    </div>
                    <span className="template-card-price">{item.price === 0 ? 'Free' : `₹${item.price}`}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="booth-footer">
        <button className="btn-ghost" onClick={()=>nav('/booth/orientation')}>← Back</button>
        <div className="booth-footer-mid">
          {selected ? `Selected: ${selected.name} · ${selected.printSize}` : 'Pick a design to continue'}
        </div>
        <button className="btn-primary" disabled={!selectedId} onClick={next}>Continue →</button>
      </div>
    </div>
  )
}
