import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BoothTemplate, CapturedPhoto } from '../types'
import { ScreenShell } from '../components/ScreenShell'
import { Icon } from '../components/Icon'
import { bridge } from '../services/bridge'
import { sound } from '../services/sound'

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function syntheticPhoto(index: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 900
  const context = canvas.getContext('2d')
  if (!context) return ''
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  const palettes = [['#42275a', '#734b6d'], ['#ec008c', '#fc6767'], ['#141e30', '#243b55'], ['#4568dc', '#b06ab3']]
  const palette = palettes[index % palettes.length]
  gradient.addColorStop(0, palette[0])
  gradient.addColorStop(1, palette[1])
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(255,255,255,.12)'
  context.beginPath()
  context.arc(600, 350, 210, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#fff'
  context.textAlign = 'center'
  context.font = '700 58px system-ui'
  context.fillText(`HAPPYPIX · ${index + 1}`, 600, 690)
  context.font = '32px system-ui'
  context.fillText(new Date().toLocaleTimeString(), 600, 744)
  return canvas.toDataURL('image/jpeg', 0.9)
}

export function CameraScreen({ template, secondsLeft, onComplete }: {
  template: BoothTemplate
  secondsLeft: number
  onComplete: (photos: CapturedPhoto[]) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const photosRef = useRef<CapturedPhoto[]>([])
  const [cameraReady, setCameraReady] = useState(false)
  const [hasLiveStream, setHasLiveStream] = useState(false)
  const [cameraName, setCameraName] = useState('Looking for camera…')
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const totalShots = Math.max(3, Math.min(10, template.layout.slots * 2))

  useEffect(() => {
    let active = true
    async function connect() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Media camera API is not available on this machine.')
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        const label = stream.getVideoTracks()[0]?.label || 'Connected camera'
        setCameraName(label)
        setHasLiveStream(true)
        setCameraReady(true)
        await bridge.reportCamera({ connected: true, working: true, batteryPct: null, model: label, error: null })
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Camera could not be opened.'
        setError(`${message} Simulator captures remain available.`)
        setCameraName('Canon adapter simulator')
        setCameraReady(true)
        await bridge.reportCamera({ connected: false, working: false, batteryPct: null, model: null, error: message })
      }
    }
    void connect()
    return () => {
      active = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
      void bridge.reportCamera({ connected: false, working: false, batteryPct: null, model: null, error: 'Camera preview closed' })
    }
  }, [])

  const captureFrame = useCallback((index: number): CapturedPhoto => {
    const video = videoRef.current
    let dataUrl = ''
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const context = canvas.getContext('2d')
      context?.drawImage(video, 0, 0)
      dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    }
    if (!dataUrl) dataUrl = syntheticPhoto(index)
    return { id: `photo-${Date.now()}-${index}`, dataUrl, capturedAt: new Date().toISOString() }
  }, [])

  const startCapture = async () => {
    if (running || !cameraReady) return
    setRunning(true)
    setPhotos([])
    photosRef.current = []
    for (let shot = 0; shot < totalShots; shot += 1) {
      for (let value = 3; value >= 1; value -= 1) {
        setCountdown(value)
        sound.countdown()
        await wait(700)
      }
      setCountdown(0)
      sound.shutter()
      const photo = captureFrame(shot)
      photosRef.current = [...photosRef.current, photo]
      setPhotos(photosRef.current)
      void bridge.recordCapture()
      await wait(450)
      setCountdown(null)
    }
    await wait(850)
    onComplete(photosRef.current)
  }

  const currentShot = Math.min(photos.length + 1, totalShots)
  const filmItems = useMemo(() => Array.from({ length: totalShots }, (_, index) => photos[index] ?? null), [photos, totalShots])

  return (
    <ScreenShell screen="camera" secondsLeft={secondsLeft} className="camera-screen">
      <div className="camera-hud">
        <div><span className={`hardware-dot ${error ? 'warning' : ''}`}/><span><b>{cameraName}</b><small>{error ? 'Fallback simulator active' : 'Live preview · ready'}</small></span></div>
        <div className="capture-progress"><span>CAPTURE</span><strong>{photos.length} / {totalShots}</strong><i><b style={{ width: `${photos.length / totalShots * 100}%` }}/></i></div>
      </div>
      <div className="camera-workspace">
        <aside className="film-reel">
          <div className="film-label">YOUR SHOTS</div>
          <div className="film-track">
            {filmItems.map((photo, index) => <div key={index} className={`film-cell ${index === photos.length && running ? 'is-current' : ''}`}><span>{String(index + 1).padStart(2, '0')}</span>{photo ? <img src={photo.dataUrl} alt={`Capture ${index + 1}`}/> : <div><Icon name="camera" size={20}/></div>}</div>)}
          </div>
        </aside>
        <section className="viewfinder">
          <div className="viewfinder-rebate top"><span>KODAK PORTRA 400</span><span>HAPPYPIX LIVE</span><span>ISO AUTO</span></div>
          <div className="video-wrap">
            <video ref={videoRef} muted playsInline/>
            {!hasLiveStream && <div className="camera-fallback"><Icon name="camera" size={52}/><span>Native Canon SDK adapter pending</span><small>Using capture simulator for this build</small></div>}
            <i className="focus-corner corner-tl"/><i className="focus-corner corner-tr"/><i className="focus-corner corner-bl"/><i className="focus-corner corner-br"/>
            {countdown !== null && <div className={`countdown-flash ${countdown === 0 ? 'is-flash' : ''}`}>{countdown > 0 ? countdown : ''}</div>}
            {!running && <button className="shutter-button" onClick={() => void startCapture()} disabled={!cameraReady}><span><Icon name="camera" size={27}/></span><b>Start shooting</b><small>{totalShots} photos · includes extra choices</small></button>}
          </div>
          <div className="viewfinder-rebate bottom"><span>EXP {currentShot}/{totalShots}</span><span>LOOK HERE & SMILE</span><span>SAFETY FILM</span></div>
        </section>
      </div>
    </ScreenShell>
  )
}
