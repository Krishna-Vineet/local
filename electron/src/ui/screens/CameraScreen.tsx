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

// ── Camera provider detection ────────────────────────────────────────────────

type CameraMode = 'nikon' | 'canon-ccapi' | 'webcam' | 'simulator'

interface CameraInfo {
  mode:    CameraMode
  label:   string
  battery: number | null
}

export function CameraScreen({ template, onComplete }: {
  template: BoothTemplate
  onComplete: (photos: CapturedPhoto[]) => void
}) {
  const videoRef        = useRef<HTMLVideoElement>(null)
  const nikonImageRef   = useRef<HTMLImageElement>(null)
  const streamRef       = useRef<MediaStream | null>(null)
  const photosRef       = useRef<CapturedPhoto[]>([])
  const lvUnsubRef      = useRef<(() => void) | null>(null)
  const nikonLvImgRef   = useRef<string | null>(null)   // latest Nikon LV frame

  const [cameraInfo, setCameraInfo]     = useState<CameraInfo>({ mode: 'simulator', label: 'Looking for camera…', battery: null })
  const [cameraReady, setCameraReady]   = useState(false)
  const [hasLiveStream, setHasLiveStream] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [running, setRunning]           = useState(false)
  const [countdown, setCountdown]       = useState<number | null>(null)
  const [photos, setPhotos]             = useState<CapturedPhoto[]>([])
  const totalShots = Math.max(3, Math.min(10, template.layout.slots * 2))

  // ── Camera initialization ────────────────────────────────────────────────

  useEffect(() => {
    let active = true

    async function connect() {
      // ── 1. Try Nikon SDK ────────────────────────────────────────────────
      if (window.booth?.nikon) {
        const st = await window.booth.nikon.getStatus().catch(() => null)

        if (st?.connected && st.provider === 'nikon-sdk') {
          // Camera already connected (hot-start)
          if (!active) return
          const info: CameraInfo = {
            mode:    'nikon',
            label:   st.model ? `${st.model} (Nikon SDK)` : 'Nikon Camera (SDK)',
            battery: st.batteryPct,
          }
          setCameraInfo(info)
          setHasLiveStream(false)
          setCameraReady(true)
          setError(null)
          await bridge.reportCamera({ connected: true, working: true, provider: 'nikon-sdk', livePreview: false, batteryPct: st.batteryPct, model: st.model, error: null })

          // Subscribe before status can be considered ready: an SDK connection
          // alone is not proof that Live View is returning frames.
          let previewReported = false
          lvUnsubRef.current = window.booth.nikon.onLiveViewFrame(({ frameDataUrl }) => {
            nikonLvImgRef.current = frameDataUrl
            if (nikonImageRef.current) nikonImageRef.current.src = frameDataUrl
            setHasLiveStream(true)
            if (!previewReported) {
              previewReported = true
              void bridge.reportCamera({ connected: true, working: true, provider: 'nikon-sdk', livePreview: true, batteryPct: st.batteryPct, model: st.model, error: null })
            }
          })
          const liveView = await window.booth.nikon.startLiveView().catch((reason) => ({ ok: false, error: reason instanceof Error ? reason.message : String(reason) }))
          if (!liveView?.ok) setError(liveView?.error || 'Nikon connected, but Live View could not start.')
          return
        }

        // Not connected yet — try connecting
        const connectResult = await window.booth.nikon.connect().catch(() => null)
        if (connectResult?.ok && connectResult.connected && active) {
          const newSt = await window.booth.nikon.getStatus().catch(() => null)
          const info: CameraInfo = {
            mode:    'nikon',
            label:   connectResult.name ? `${connectResult.name} (Nikon SDK)` : 'Nikon Camera (SDK)',
            battery: newSt?.batteryPct ?? null,
          }
          setCameraInfo(info)
          setHasLiveStream(false)
          setCameraReady(true)
          setError(null)
          await bridge.reportCamera({ connected: true, working: true, provider: 'nikon-sdk', livePreview: false, batteryPct: info.battery, model: info.label, error: null })

          let previewReported = false
          lvUnsubRef.current = window.booth.nikon.onLiveViewFrame(({ frameDataUrl }) => {
            nikonLvImgRef.current = frameDataUrl
            if (nikonImageRef.current) nikonImageRef.current.src = frameDataUrl
            setHasLiveStream(true)
            if (!previewReported) {
              previewReported = true
              void bridge.reportCamera({ connected: true, working: true, provider: 'nikon-sdk', livePreview: true, batteryPct: info.battery, model: info.label, error: null })
            }
          })
          const liveView = await window.booth.nikon.startLiveView().catch((reason) => ({ ok: false, error: reason instanceof Error ? reason.message : String(reason) }))
          if (!liveView?.ok) setError(liveView?.error || 'Nikon connected, but Live View could not start.')
          return
        }
      }

      // ── 2. Try Canon CCAPI (Wi-Fi) ──────────────────────────────────────
      const ccapi = await bridge.canonProbe().catch(() => null)
      if (ccapi?.connected && active) {
        const info: CameraInfo = {
          mode:    'canon-ccapi',
          label:   `${ccapi.model || 'Canon EOS'} (Wi-Fi CCAPI)`,
          battery: ccapi.batteryPct,
        }
        setCameraInfo(info)
      }

      // ── 3. Try webcam / UVC ─────────────────────────────────────────────
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Media camera API not available.')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        const trackLabel = stream.getVideoTracks()[0]?.label || 'Connected camera'
        const isCcapi = ccapi?.connected
        const label = isCcapi ? `${ccapi!.model || 'Canon EOS'} (Wi-Fi CCAPI)` : trackLabel
        const info: CameraInfo = {
          mode:    isCcapi ? 'canon-ccapi' : 'webcam',
          label,
          battery: ccapi?.batteryPct ?? null,
        }
        setCameraInfo(info)
        setHasLiveStream(true)
        setCameraReady(true)
        setError(null)
        await bridge.reportCamera({ connected: true, working: true, provider: isCcapi ? 'canon-ccapi-wifi' : 'webcam', livePreview: true, batteryPct: info.battery, model: label, error: null })
      } catch (reason) {
        if (ccapi?.connected && active) {
          // CCAPI is connected even without webcam
          setCameraReady(true)
          setError(null)
          await bridge.reportCamera({ connected: true, working: true, provider: 'canon-ccapi-wifi', livePreview: false, batteryPct: ccapi.batteryPct, model: ccapi.model, error: null })
        } else {
          const message = reason instanceof Error ? reason.message : 'Camera could not be opened.'
          setError(`${message} Simulator captures remain available.`)
          setCameraInfo({ mode: 'simulator', label: 'Simulator (no camera)', battery: null })
          setCameraReady(true)
          await bridge.reportCamera({ connected: false, working: false, provider: 'simulator', livePreview: false, batteryPct: null, model: null, error: message })
        }
      }
    }

    void connect()

    return () => {
      active = false
      // Cleanup webcam stream
      streamRef.current?.getTracks().forEach((t) => t.stop())
      // Cleanup Nikon LV subscription
      lvUnsubRef.current?.()
      lvUnsubRef.current = null
      if (window.booth?.nikon) {
        void window.booth.nikon.stopLiveView().catch(() => {})
      }
      void bridge.reportCamera({ connected: false, working: false, provider: 'none', livePreview: false, batteryPct: null, model: null, error: 'Camera preview closed' })
    }
  }, [])

  // ── Capture logic ────────────────────────────────────────────────────────

  const captureFrame = useCallback(async (index: number): Promise<{ photo: CapturedPhoto; countClick: boolean }> => {
    const id = `photo-${Date.now()}-${index}`
    let countClick = false

    // ── Nikon SDK capture ──────────────────────────────────────────────────
    if (cameraInfo.mode === 'nikon' && window.booth?.nikon) {
      try {
        const result = await window.booth.nikon.capture()
        if (result.success && result.dataUrl) {
          setError(null)
          // A full-resolution image returned by the camera bridge confirms the
          // physical release. SDK acknowledgements and preview fallbacks do not.
          return { photo: { id, dataUrl: result.dataUrl, capturedAt: new Date().toISOString() }, countClick: true }
        }
        setError('Nikon shutter did not return a full-resolution photo; preview fallback used.')
      } catch {
        setError('Nikon capture failed; preview fallback used.')
      }
    }

    // ── Canon CCAPI shutter ────────────────────────────────────────────────
    if (cameraInfo.mode === 'canon-ccapi') {
      // CCAPI acknowledgement confirms command receipt, not a completed
      // physical exposure, so it does not increment the shutter counter.
      await bridge.canonCapture().catch(() => ({ success: false, error: 'Capture failed' }))
    }

    // ── Webcam canvas capture ──────────────────────────────────────────────
    const video = videoRef.current
    let dataUrl = ''
    if (cameraInfo.mode === 'nikon' && nikonLvImgRef.current) {
      // This is a live-view frame, not a verified shutter capture.
      dataUrl = nikonLvImgRef.current
      countClick = false
    } else if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      const canvas = document.createElement('canvas')
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      // Webcam frames are not physical shutter releases.
    }

    if (!dataUrl) {
      dataUrl = syntheticPhoto(index)
      countClick = false
    }
    return { photo: { id, dataUrl, capturedAt: new Date().toISOString() }, countClick }
  }, [cameraInfo.mode])

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

      const { photo, countClick } = await captureFrame(shot)
      photosRef.current = [...photosRef.current, photo]
      setPhotos([...photosRef.current])
      if (countClick) void bridge.recordCapture()
      await wait(450)
      setCountdown(null)
    }

    await wait(850)
    onComplete(photosRef.current)
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  const currentShot = Math.min(photos.length + 1, totalShots)
  const filmItems = useMemo(() => Array.from({ length: totalShots }, (_, i) => photos[i] ?? null), [photos, totalShots])

  const providerBadge =
    cameraInfo.mode === 'nikon'       ? 'Nikon SDK · USB'  :
    cameraInfo.mode === 'canon-ccapi' ? 'Canon CCAPI · Wi-Fi' :
    cameraInfo.mode === 'webcam'      ? 'Live preview · ready' :
    'Fallback simulator active'

  return (
    <ScreenShell screen="camera" className="camera-screen">
      <div className="camera-hud">
        <div>
          <span className={`hardware-dot ${error ? 'warning' : ''}`}/>
          <span>
            <b>{cameraInfo.label}</b>
            <small>{error || providerBadge}</small>
          </span>
        </div>
        <div className="capture-progress">
          <span>CAPTURE</span>
          <strong>{photos.length} / {totalShots}</strong>
          <i><b style={{ width: `${photos.length / totalShots * 100}%` }}/></i>
        </div>
      </div>

      <div className="camera-workspace">
        <aside className="film-reel">
          <div className="film-label">YOUR SHOTS</div>
          <div className="film-track">
            {filmItems.map((photo, index) => (
              <div key={index} className={`film-cell ${index === photos.length && running ? 'is-current' : ''}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {photo
                  ? <img src={photo.dataUrl} alt={`Capture ${index + 1}`}/>
                  : <div><Icon name="camera" size={20}/></div>}
              </div>
            ))}
          </div>
        </aside>

        <section className="viewfinder">
          <div className="viewfinder-rebate top">
            <span>KODAK PORTRA 400</span>
            <span>HAPPYPIX LIVE</span>
            <span>ISO AUTO</span>
          </div>
          <div className="video-wrap">
            {/* Webcam stream */}
            <video ref={videoRef} muted playsInline/>
            {/* Nikon Live View image fills the viewfinder without letterboxing. */}
            {cameraInfo.mode === 'nikon' && (
              <img ref={nikonImageRef} className="nikon-liveview" alt="Nikon live view" style={{ display: hasLiveStream ? 'block' : 'none' }} />
            )}

            {!hasLiveStream && (
              <div className="camera-fallback">
                <Icon name="camera" size={52}/>
                <span>
                  {error || (cameraInfo.mode === 'nikon'
                    ? 'Nikon connected — waiting for live view…'
                    : 'Native camera adapter pending')}
                </span>
                {!error && <small>Using capture simulator for this build</small>}
              </div>
            )}

            <i className="focus-corner corner-tl"/>
            <i className="focus-corner corner-tr"/>
            <i className="focus-corner corner-bl"/>
            <i className="focus-corner corner-br"/>

            {countdown !== null && (
              <div className={`countdown-flash ${countdown === 0 ? 'is-flash' : ''}`}>
                {countdown > 0 ? countdown : ''}
              </div>
            )}

            {!running && (
              <button
                className="shutter-button"
                onClick={() => void startCapture()}
                disabled={!cameraReady}
              >
                <span><Icon name="camera" size={27}/></span>
                <b>Start shooting</b>
                <small>{totalShots} photos · includes extra choices</small>
              </button>
            )}
          </div>

          <div className="viewfinder-rebate bottom">
            <span>EXP {currentShot}/{totalShots}</span>
            <span>LOOK HERE &amp; SMILE</span>
            <span>SAFETY FILM</span>
          </div>
        </section>
      </div>
    </ScreenShell>
  )
}
