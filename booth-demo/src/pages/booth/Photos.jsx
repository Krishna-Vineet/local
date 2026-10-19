import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BoothHeader from '../../components/BoothHeader'
import Loader from '../../components/Loader'
import TemplateCanvas from '../../components/TemplateCanvas'
import { useBooth } from '../../context/BoothContext'

export default function Photos(){
  const nav = useNavigate()
  const { config, session, photos, setSelectedPhotos, selectedPhotos } = useBooth()
  const [secondsLeft,setSecondsLeft]=useState(60)
  const [loading,setLoading]=useState(false)
  useEffect(()=>{ const t=setInterval(()=>setSecondsLeft(s=>Math.max(0,s-1)),1000); return()=>clearInterval(t)},[])
  useEffect(()=>{ if(secondsLeft===0) nav('/booth/start')},[secondsLeft])

  const template = session.template
  if(!template) return <div style={{ background:'#050508', minHeight:'100vh', display:'grid', placeItems:'center', color:'#fff' }}>No template — <button onClick={()=>nav('/booth/templates')} style={{ color:'#8b5cf6', background:'none', border:'none', fontWeight:800 }}>Go pick one</button></div>
  if(!photos || photos.length===0) return <div style={{ background:'#050508', minHeight:'100vh', display:'grid', placeItems:'center', color:'#fff' }}>No captured photos — please capture again. <button onClick={()=>nav('/booth/camera')} style={{ color:'#8b5cf6', background:'none', border:'none', fontWeight:800 }}>Camera</button></div>

  const slotsCount = template.slots
  const [selectedSlots,setSelectedSlots]=useState(()=>{
    const init = Array.from({length: slotsCount}, ()=>null)
    if(selectedPhotos && selectedPhotos.length>0){
      selectedPhotos.forEach((p,i)=>{ if(i<slotsCount) init[i]=p })
    } else {
      photos.slice(0,slotsCount).forEach((p,i)=> init[i]=p)
    }
    return init
  })
  const [activeIdx,setActiveIdx]=useState(0)

  function handlePhotoTap(photo){
    const newSlots=[...selectedSlots]
    const existing = newSlots.findIndex(s=> s && s.uri===photo.uri)
    if(existing>=0){
      if(existing===activeIdx){ newSlots[activeIdx]=null; setSelectedSlots(newSlots); return }
      const prev = newSlots[activeIdx]
      newSlots[activeIdx]=photo
      newSlots[existing]=prev
      setSelectedSlots(newSlots)
      const nextEmpty=newSlots.findIndex(s=> s===null)
      if(nextEmpty>=0) setActiveIdx(nextEmpty)
      return
    }
    newSlots[activeIdx]=photo
    setSelectedSlots(newSlots)
    const nextEmpty=newSlots.findIndex((s,idx)=> idx>activeIdx && s===null)
    if(nextEmpty>=0) setActiveIdx(nextEmpty)
    else { const anyEmpty=newSlots.findIndex(s=> s===null); if(anyEmpty>=0) setActiveIdx(anyEmpty) }
  }
  function handleSlotTap(i){
    if(activeIdx===i && selectedSlots[i]){
      const n=[...selectedSlots]; n[i]=null; setSelectedSlots(n)
    } else setActiveIdx(i)
  }
  const filled = selectedSlots.filter(Boolean).length
  const complete = filled===slotsCount

  function handleNext(){
    if(!complete) return
    setLoading(true)
    setSelectedPhotos(selectedSlots.filter(Boolean))
    setTimeout(()=> nav('/booth/customize'), 850)
  }

  if(loading) return <Loader text="Compositing your strip…" sub="Applying layout & borders" />

  const templatePhotos = selectedSlots.filter(Boolean).length>0 ? selectedSlots.filter(Boolean) : photos.slice(0, slotsCount)

  return (
    <div className="booth-container">
      <BoothHeader title="Pick Your Best Shots" subtitle={`Slot #${activeIdx+1} active. Tap any photo below to place it into your print.`} step="PHOTOS" secondsLeft={secondsLeft} />
      <div style={{ flex:1, display:'flex', gap:16, padding:'12px 16px', flexWrap:'wrap', justifyContent:'center', alignItems:'flex-start' }}>
        {/* reel */}
        <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:20, padding:12, width:560, maxWidth:'100%' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}><span style={{ width:8, height:8, borderRadius:999, background:'#f59e0b' }} /><span style={{ color:'#e4e4e7', fontSize:11, fontWeight:800, letterSpacing:0.8 }}>35MM FILM REEL</span></div>
            <span style={{ background:'#18181f', border:'1px solid #27272a', borderRadius:999, padding:'4px 8px', fontSize:11, fontWeight:700, color:'#a78bfa' }}>{filled}/{slotsCount} PLACED</span>
          </div>
          <div style={{ display:'flex', gap:4, marginTop:8, justifyContent:'center' }}>
            {Array.from({length:16}).map((_,i)=><span key={i} style={{ width:14, height:9, borderRadius:2.5, background:'#1f1f2e', display:'inline-block' }} />)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:10, marginTop:10, maxHeight:360, overflowY:'auto', padding:4 }}>
            {photos.map((photo,i)=>{
              const assignedIdx = selectedSlots.findIndex(s=> s && s.uri===photo.uri)
              const isAssigned = assignedIdx>=0
              const frameNum = String(i+1).padStart(2,'0')
              return (
                <button key={photo.id || i} onClick={()=>handlePhotoTap(photo)} style={{ background:'#12121c', border:`1.5px solid ${isAssigned ? '#a78bfa' : '#222232'}`, borderRadius:12, padding:6, textAlign:'left', position:'relative', overflow:'hidden' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ color:'#71717a', fontSize:9, fontWeight:800 }}>▷ SHOT {frameNum}</span>
                    {isAssigned && <span style={{ background:'#8b5cf6', color:'#fff', fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:999 }}>SLOT #{assignedIdx+1}</span>}
                  </div>
                  <div style={{ marginTop:6, borderRadius:8, overflow:'hidden', height:76, background:'#0a0a0e' }}>
                    <img src={photo.uri} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                  {isAssigned && <span style={{ position:'absolute', top:28, right:10, width:22, height:22, borderRadius:999, background:'rgba(139,92,246,0.95)', color:'#fff', display:'grid', placeItems:'center', fontWeight:900, fontSize:12 }}>✓</span>}
                </button>
              )
            })}
          </div>
          <div style={{ display:'flex', gap:4, marginTop:10, justifyContent:'center' }}>
            {Array.from({length:16}).map((_,i)=><span key={i} style={{ width:14, height:9, borderRadius:2.5, background:'#1f1f2e', display:'inline-block' }} />)}
          </div>
        </div>

        {/* preview */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
          <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:16, padding:12, width:320, textAlign:'center' }}>
            <div style={{ color:'#71717a', fontSize:9, fontWeight:800, letterSpacing:1 }}>TAP A NUMBERED SLOT TO FOCUS</div>
            <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:8, flexWrap:'wrap' }}>
              {Array.from({length:slotsCount}).map((_,i)=>(
                <button key={i} onClick={()=>handleSlotTap(i)} style={{ width:44, height:44, borderRadius:10, background: activeIdx===i ? '#8b5cf6' : selectedSlots[i] ? '#22c55e' : '#18181f', color:'#fff', border:`1px solid ${activeIdx===i ? '#a78bfa' : '#27272a'}`, fontSize:13, fontWeight:800 }}>{i+1}</button>
              ))}
            </div>
          </div>
          <div style={{ position:'relative' }}>
            <TemplateCanvas template={template} photos={selectedSlots.filter(Boolean).map(s=> s.uri )} width={260} orgName={config.orgName} />
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', pointerEvents:'none' }}>
              {/* overlay slot focus rings */}
            </div>
          </div>
          <div style={{ color:'#71717a', fontSize:11, textAlign:'center', maxWidth:280 }}>Photos are auto-placed. Tap a slot then a photo to swap. Must fill all {slotsCount} slots to continue.</div>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 16px', borderTop:'1px solid #11111a' }}>
        <button onClick={()=>nav('/booth/camera')} style={{ background:'#171720', border:'1px solid #262634', color:'#d4d4d8', padding:'10px 16px', borderRadius:10, fontWeight:600 }}>↺ Retake</button>
        <button disabled={!complete} onClick={handleNext} style={{ background: complete ? '#8b5cf6' : '#2a2a3a', color:'#fff', padding:'10px 18px', borderRadius:10, fontWeight:800, border:'none', opacity:complete?1:0.5, boxShadow:complete?'0 10px 24px rgba(139,92,246,0.35)':'none' }}>{complete ? 'Continue to Customize →' : `Fill ${slotsCount-filled} more slot${slotsCount-filled===1?'':''}s`}</button>
      </div>
    </div>
  )
}
