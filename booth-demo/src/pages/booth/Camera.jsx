import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBooth } from '../../context/BoothContext'
import { EVENT_SAMPLES } from '../../data/templates'

function beep(freq=760){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    gain.gain.value = 0.06
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start()
    setTimeout(()=>{ osc.stop(); ctx.close() }, 110)
  }catch{}
}

export default function Camera(){
  const nav = useNavigate()
  const { session, setPhotos } = useBooth()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const samples = EVENT_SAMPLES[session.template?.category] || EVENT_SAMPLES.party

  const [cameraState,setCameraState] = useState('checking') // checking | ready | unavailable
  const [shots,setShots] = useState([])
  const [countdown,setCountdown] = useState(null)
  const [flash,setFlash] = useState(false)
  const [running,setRunning] = useState(false)

  const totalShots = Math.min(5, Math.max(3, (session.template?.slots || 1) + 1))

  useEffect(()=>{
    let cancelled = false
    async function init(){
      try{
        if(!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode:'user', width:{ ideal:1280 }, height:{ ideal:720 } },
          audio:false,
        })
        if(cancelled){ stream.getTracks().forEach(t=>t.stop()); return }
        streamRef.current = stream
        if(videoRef.current){ videoRef.current.srcObject = stream; await videoRef.current.play() }
        setCameraState('ready')
      }catch{
        if(!cancelled) setCameraState('unavailable')
      }
    }
    init()
    return ()=>{
      cancelled = true
      streamRef.current?.getTracks().forEach(t=>t.stop())
    }
  },[])

  function grabFrame(index){
    if(cameraState==='ready' && videoRef.current && videoRef.current.videoWidth){
      const v = videoRef.current
      const c = canvasRef.current
      c.width = v.videoWidth
      c.height = v.videoHeight
      c.getContext('2d').drawImage(v,0,0,c.width,c.height)
      return c.toDataURL('image/jpeg', 0.92)
    }
    return samples[index % samples.length]
  }

  async function capture(){
    if(running) return
    setRunning(true)
    setShots([])
    const wait = ms => new Promise(r=>setTimeout(r,ms))
    const captured = []
    for(let i=0;i<totalShots;i++){
      for(let n=2;n>=1;n--){ setCountdown(n); beep(680); await wait(800) }
      setCountdown('smile'); beep(900); await wait(420)
      setFlash(true)
      await wait(70)
      captured.push({ id:`shot-${Date.now()}-${i}`, uri:grabFrame(i), index:i })
      setShots([...captured])
      await wait(150)
      setFlash(false)
      setCountdown(null)
      await wait(420)
    }
    setRunning(false)
    setPhotos(captured)
    await wait(200)
    nav('/booth/photos')
  }

  function exit(){ nav('/booth/payment') }

  const shotNumber = Math.min(shots.length + 1, totalShots)

  return (
    <div className="capture-screen">
      <video ref={videoRef} autoPlay playsInline muted className="capture-video" />
      {cameraState!=='ready' && (
        <>
          <div className="capture-video-fallback" aria-hidden="true" />
          <div
            className="capture-video-demo"
            aria-hidden="true"
            style={{ backgroundImage:`url(${samples[0]})` }}
          />
        </>
      )}

      <div className="capture-top">
        <button className="capture-close" onClick={exit} aria-label="Exit camera">✕</button>
        <div className="capture-status">
          <span className={`capture-dot ${cameraState==='ready' ? 'is-live' : ''}`} />
          <span className="capture-status-label">
            {cameraState==='checking' ? 'Starting camera…' : cameraState==='ready' ? 'Live camera' : 'Demo capture'}
          </span>
        </div>
        <div className="capture-count">{running ? `SHOT ${shotNumber} / ${totalShots}` : `${totalShots} SHOTS`}</div>
      </div>

      {cameraState==='unavailable' && !running && (
        <div className="capture-notice">
          <div className="capture-notice-title">Camera not available</div>
          <div className="capture-notice-text">
            Allow camera access for live capture, or continue in demo mode — the session still runs end to end with sample frames.
          </div>
        </div>
      )}

      <div className="capture-corner capture-corner-tl" />
      <div className="capture-corner capture-corner-tr" />
      <div className="capture-corner capture-corner-bl" />
      <div className="capture-corner capture-corner-br" />

      {countdown!==null && (
        <div className="countdown-wrap">
          <div className="countdown-ring">
            <span className={`countdown-value ${countdown==='smile' ? 'is-word' : ''}`}>{countdown==='smile' ? 'Smile' : countdown}</span>
          </div>
          <div className="countdown-hint">{countdown==='smile' ? 'Hold it…' : 'Look at the camera'}</div>
        </div>
      )}

      {!running && (
        <button className="shutter" onClick={capture}>
          <span className="shutter-ring"><span className="shutter-dot" /></span>
          <span className="shutter-text">
            <span className="shutter-title">Start capture</span>
            <span className="shutter-sub">{totalShots} shots · choose your favourites next</span>
          </span>
        </button>
      )}

      <div className="filmstrip">
        <div className="filmstrip-rail" aria-hidden="true">
          {Array.from({length:12}).map((_,i)=><span key={i} />)}
        </div>
        <div className="filmstrip-frames">
          {Array.from({length:totalShots}).map((_,i)=>{
            const shot = shots[i]
            const isNext = running && i===shots.length
            return (
              <div key={i} className={`filmstrip-frame ${shot ? 'has-shot' : ''} ${isNext ? 'is-next' : ''}`}>
                {shot ? <img src={shot.uri} alt={`Shot ${i+1}`} /> : <span className="filmstrip-index">{String(i+1).padStart(2,'0')}</span>}
              </div>
            )
          })}
        </div>
        <div className="filmstrip-rail" aria-hidden="true">
          {Array.from({length:12}).map((_,i)=><span key={i} />)}
        </div>
      </div>

      {flash && <div className="flash-overlay" />}
      <canvas ref={canvasRef} style={{ display:'none' }} />
    </div>
  )
}
