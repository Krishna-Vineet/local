import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBooth } from '../../context/BoothContext'

export default function Camera(){
  const nav = useNavigate()
  const { session, setPhotos, photos } = useBooth()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [running,setRunning]=useState(false)
  const [countdown,setCountdown]=useState(null)
  const [flash,setFlash]=useState(false)
  const [hasCam,setHasCam]=useState(false)
  const [error,setError]=useState('')
  const totalShots = Math.max(3, Math.min(10, (session.template?.slots || 1) * 2))
  const [localPhotos,setLocalPhotos]=useState([])

  useEffect(()=>{
    let stream
    async function init(){
      try{
        stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user', width:{ ideal:1280 }, height:{ ideal:720 } }, audio:false })
        if(videoRef.current){ videoRef.current.srcObject = stream; await videoRef.current.play(); setHasCam(true) }
      }catch(e){ setError('Camera permission denied or unavailable. You can still demo with placeholders.'); setHasCam(false) }
    }
    init()
    return ()=>{ if(stream) stream.getTracks().forEach(t=>t.stop()) }
  },[])

  async function captureFrame(){
    if(videoRef.current && hasCam){
      const v = videoRef.current
      const c = canvasRef.current
      c.width = v.videoWidth || 1280
      c.height = v.videoHeight || 720
      const ctx = c.getContext('2d')
      ctx.drawImage(v,0,0,c.width,c.height)
      return c.toDataURL('image/jpeg', 0.92)
    } else {
      // fallback: use unsplash placeholder rotating
      const placeholders = [
        'https://images.unsplash.com/photo-1520854221256-589c8c66b100?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&w=600&q=80',
      ]
      return placeholders[Math.floor(Math.random()*placeholders.length)]
    }
  }

  async function startCapture(){
    if(running) return
    setRunning(true); setLocalPhotos([])
    const captured=[]
    const wait = ms=> new Promise(r=>setTimeout(r,ms))
    for(let shot=0; shot< totalShots; shot++){
      for(let v=3; v>=1; v--){ setCountdown(v); beep(); await wait(700) }
      setCountdown(0); setFlash(true); shutterSound(); // visual flash
      const dataUrl = await captureFrame()
      const photo = { id:`photo-${Date.now()}-${shot}`, uri:dataUrl, dataUrl, capturedAt: new Date().toISOString() }
      captured.push(photo); setLocalPhotos([...captured])
      await wait(300); setFlash(false); setCountdown(null); await wait(500)
    }
    setRunning(false)
    setPhotos(captured)
    // also set selected photos default first n
    // store via context setSession? we use navigation and next page reads photos
    setTimeout(()=> nav('/booth/photos'), 400)
  }

  function beep(){
    try{ const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); o.frequency.value=880; o.connect(ctx.destination); o.start(); setTimeout(()=>{ o.stop(); ctx.close()},120)}catch{}
  }
  function shutterSound(){
    try{ const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); o.frequency.value=320; o.connect(ctx.destination); o.start(); setTimeout(()=>{ o.stop(); ctx.close()},90)}catch{}
  }

  const currentShot = Math.min(localPhotos.length+1, totalShots)

  return (
    <div style={{ minHeight:'100vh', background:'#000', display:'flex', flexDirection:'column' }}>
      <div style={{ flex:1, position:'relative', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', background:'#09090f' }}>
        {/* video */}
        <video ref={videoRef} autoPlay playsInline muted style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
        {!hasCam && !videoRef.current?.srcObject && (
          <div style={{ textAlign:'center', zIndex:1, padding:20 }}>
            <div style={{ width:72, height:72, borderRadius:36, background:'rgba(139,92,246,0.15)', border:'1.5px solid rgba(139,92,246,0.4)', display:'grid', placeItems:'center', margin:'0 auto 12px', fontSize:28 }}>📸</div>
            <div style={{ color:'#fff', fontWeight:900, fontSize:20 }}>Full Widescreen Viewfinder</div>
            <div style={{ color:'#a1a1aa', fontSize:13, marginTop:4 }}>{error || 'Allow camera for live capture — or use demo capture.'}</div>
          </div>
        )}

        {/* reticles */}
        <span style={{ position:'absolute', top:20, left:20, width:32, height:32, borderTop:'2.5px solid rgba(255,255,255,0.7)', borderLeft:'2.5px solid rgba(255,255,255,0.7)' }} />
        <span style={{ position:'absolute', top:20, right:20, width:32, height:32, borderTop:'2.5px solid rgba(255,255,255,0.7)', borderRight:'2.5px solid rgba(255,255,255,0.7)' }} />
        <span style={{ position:'absolute', bottom:20, left:20, width:32, height:32, borderBottom:'2.5px solid rgba(255,255,255,0.7)', borderLeft:'2.5px solid rgba(255,255,255,0.7)' }} />
        <span style={{ position:'absolute', bottom:20, right:20, width:32, height:32, borderBottom:'2.5px solid rgba(255,255,255,0.7)', borderRight:'2.5px solid rgba(255,255,255,0.7)' }} />

        {/* top pill */}
        <div style={{ position:'absolute', top:14, background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:16, padding:'6px 14px', display:'flex', alignItems:'center', gap:8, fontSize:10, fontWeight:800, letterSpacing:1, color:'#fff' }}>
          <span style={{ width:8, height:8, borderRadius:999, background: hasCam?'#22c55e':'#f59e0b' }} /> {hasCam?'FULL WIDE CAMERA VIEW':'SIMULATOR MODE'} <span style={{ color:'#71717a' }}>•</span> <span style={{ color:'#a78bfa' }}>SHOT {currentShot} OF {totalShots}</span>
        </div>

        {/* countdown */}
        {countdown!==null && (
          <div style={{ position:'absolute', background:'rgba(0,0,0,0.85)', padding:'20px 44px', borderRadius:28, border:'3px solid #8b5cf6', boxShadow:'0 12px 32px rgba(139,92,246,0.5)' }}>
            <div style={{ color:'#fff', fontSize:64, fontWeight:900, letterSpacing:2 }}>{countdown>0? countdown : 'SMILE!'}</div>
          </div>
        )}

        {/* shutter button */}
        {!running && (
          <button onClick={startCapture} style={{ position:'absolute', bottom:96, background:'#8b5cf6', border:'2.5px solid #fff', color:'#fff', padding:'14px 32px', borderRadius:36, display:'flex', alignItems:'center', gap:12, fontWeight:800, boxShadow:'0 12px 28px rgba(139,92,246,0.5)' }}>
            <span style={{ width:38, height:38, borderRadius:999, background:'rgba(255,255,255,0.2)', display:'grid', placeItems:'center' }}>📸</span>
            <span style={{ textAlign:'left' }}><span style={{ display:'block', fontSize:16, letterSpacing:1 }}>TAKE PHOTOS</span><span style={{ display:'block', fontSize:11, fontWeight:600, opacity:0.9 }}>{totalShots} rapid shots • Pick your favorites</span></span>
          </button>
        )}

        {/* film strip bottom */}
        <div style={{ position:'absolute', bottom:10, left:12, right:12, background:'rgba(10,10,14,0.72)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:14, padding:'6px 10px' }}>
          <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
            {Array.from({length:totalShots}).map((_,i)=>{
              const p = localPhotos[i]
              const isCurrent = i===localPhotos.length && running
              return (
                <div key={i} style={{ width:64, height:50, borderRadius:6, border:`1.5px solid ${isCurrent? '#8b5cf6' : p ? '#3f3f50' : '#222232'}`, background:'#12121c', padding:2, textAlign:'center', boxShadow:isCurrent?'0 0 10px rgba(139,92,246,0.5)':'none' }}>
                  <div style={{ fontSize:7, fontWeight:800, color:'#71717a' }}>{String(i+1).padStart(2,'0')}</div>
                  {p ? <img src={p.uri} alt="" style={{ width:'100%', height:32, objectFit:'cover', borderRadius:4 }} /> : <div style={{ width:'100%', height:32, background:'#1a1a26', borderRadius:4 }} />}
                </div>
              )
            })}
          </div>
        </div>

        {flash && <div className="flash-overlay" />}
        <canvas ref={canvasRef} style={{ display:'none' }} />
      </div>
    </div>
  )
}
