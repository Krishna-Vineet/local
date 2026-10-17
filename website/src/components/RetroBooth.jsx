import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from './ui.jsx'

// ─── Interactive retro booth demo ────────────────────────────
// idle → countdown 3·2·1 → flash ×3 → the strip "prints" → QR card.
// The QR is drawn on canvas (decorative demo pattern) and points at
// the website's sample download page, exactly like a real booth:
// guests scan → /download/:id → digital copy for 24 hours.

const FRAMES = ['/images/hero-booth.jpg', '/images/wedding-booth.jpg', '/images/guests-party.jpg']

function drawDemoQr(canvas, url) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const size = 21
  const cell = canvas.width / size
  // deterministic pseudo-random pattern derived from the url string
  let seed = 7
  for (const ch of url) seed = (seed * 31 + ch.charCodeAt(0)) % 9973
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.width)
  ctx.fillStyle = '#141020'
  const finder = (x, y) => {
    ctx.fillRect(x * cell, y * cell, cell * 7, cell * 7)
    ctx.fillStyle = '#fff'; ctx.fillRect((x + 1) * cell, (y + 1) * cell, cell * 5, cell * 5)
    ctx.fillStyle = '#141020'; ctx.fillRect((x + 2) * cell, (y + 2) * cell, cell * 3, cell * 3)
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (rand() > 0.52) ctx.fillRect(x * cell, y * cell, cell, cell)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cell * 8, cell * 8); ctx.fillRect(canvas.width - cell * 8, 0, cell * 8, cell * 8); ctx.fillRect(0, canvas.width - cell * 8, cell * 8, cell * 8)
  ctx.fillStyle = '#141020'
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7)
}

export default function RetroBooth({ compact = false }) {
  const [phase, setPhase] = useState('idle') // idle | counting | flash | strip | done
  const [count, setCount] = useState(3)
  const [shots, setShots] = useState(0)
  const qrRef = useRef(null)
  const timers = useRef([])

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    if (phase === 'done') drawDemoQr(qrRef.current, `${window.location.origin}/download/demo`)
  }, [phase])

  const start = () => {
    timers.current.forEach(clearTimeout); timers.current = []
    setShots(0)
    setPhase('counting'); setCount(3)
    let c = 3
    const tick = () => {
      c -= 1
      if (c > 0) { setCount(c); later(tick, 750) } else {
        setPhase('flash')
        let s = 0
        const shoot = () => {
          s += 1; setShots(s)
          if (s < 3) later(shoot, 620)
          else { setPhase('strip'); later(() => setPhase('done'), 1500) }
        }
        later(shoot, 350)
      }
    }
    later(tick, 750)
  }

  return (
    <div className="booth-demo">
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1.15fr .85fr', gap: 'clamp(24px, 4vw, 52px)', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <div>
          <div className="booth-frame">
            {phase === 'idle' && (
              <div style={{ textAlign: 'center', padding: 26 }}>
                <div style={{ fontSize: '2.6rem' }}>📸</div>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '1.7rem', marginTop: 10 }}>Ready when you are…</div>
                <div style={{ color: 'rgba(255,247,234,.65)', fontSize: '.95rem' }}>This is the moment your guests fall in love with.</div>
              </div>
            )}
            {(phase === 'counting' || phase === 'flash') && (
              <>
                <img src={FRAMES[Math.min(shots, 2)]} alt="Live booth preview" />
                <AnimatePresence mode="popLayout">
                  {phase === 'counting' ? (
                    <motion.div key={count} className="countdown-num" style={{ position: 'absolute' }} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: .6, opacity: 0 }} transition={{ duration: .34 }}>
                      {count}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <motion.div key={`flash-${shots}`} className="flash" animate={{ opacity: [0, .95, 0] }} transition={{ duration: .38, times: [0, .25, 1] }} />
                <div style={{ position: 'absolute', top: 14, left: 16, display: 'flex', gap: 7 }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: shots > i ? 'var(--green)' : 'rgba(255,247,234,.35)', border: '2px solid rgba(0,0,0,.35)' }} />
                  ))}
                </div>
              </>
            )}
            {(phase === 'strip' || phase === 'done') && (
              <motion.div initial={{ y: -190, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }} style={{ padding: 18 }}>
                <div className="filmstrip" style={{ transform: 'rotate(-2deg)', width: 168 }}>
                  {FRAMES.map((src, i) => (
                    <figure key={i} style={{ aspectRatio: '4/3' }}><img src={src} alt="" /></figure>
                  ))}
                  <div style={{ textAlign: 'center', color: 'var(--paper)', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '.82rem', padding: '2px 0 4px' }}>HappyPix ✦ est. tonight</div>
                </div>
              </motion.div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-pink" onClick={start} disabled={phase === 'counting' || phase === 'flash'}>
              <Icon name="camera" size={19} /> {phase === 'idle' ? 'Start your session' : phase === 'done' || phase === 'strip' ? 'Pose again' : 'Smile…'}
            </button>
            <span style={{ fontSize: '.92rem', color: 'rgba(255,247,234,.7)' }}>
              {phase === 'idle' && 'Three poses. One strip. Zero awkwardness.'}
              {phase === 'counting' && 'Hold that pose — the ring light loves you.'}
              {phase === 'flash' && `Capturing magic… ${shots}/3`}
              {phase === 'strip' && 'Printing your strip…'}
              {phase === 'done' && 'Collect your print — then scan for the digital copy.'}
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {phase === 'done' ? (
            <motion.div
              key="qr"
              initial={{ opacity: 0, x: 44, rotate: 3 }}
              animate={{ opacity: 1, x: 0, rotate: -1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: .55, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: 'var(--paper)', color: 'var(--ink)', borderRadius: 24, padding: 28, textAlign: 'center', boxShadow: '0 24px 48px rgba(15,10,28,.28)', maxWidth: 330, marginInline: 'auto', width: '100%' }}
            >
              <span className="chip bg-pink">Your digital copy</span>
              <h3 style={{ margin: '14px 0 6px' }}>Scan. Save. Share.</h3>
              <p style={{ fontSize: '.93rem', color: 'var(--ink-soft)' }}>Point your phone camera at the code. Your strip opens on a private page — no app, no sign-up.</p>
              <canvas ref={qrRef} width={168} height={168} style={{ width: 168, height: 168, margin: '16px auto 6px', display: 'block', borderRadius: 10 }} />
              <a href="/download/demo" style={{ fontWeight: 700, color: 'var(--pink-deep)', fontSize: '.9rem' }}>Preview the download page →</a>
              <div style={{ marginTop: 12, fontSize: '.8rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon name="clock" size={14} /> Link lives for 24 hours only
              </div>
            </motion.div>
          ) : (
            <motion.div key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ padding: '6px 4px' }}>
              <span className="sticker">just like the real booth ✦</span>
              <h3 style={{ fontSize: 'clamp(1.7rem, 3vw, 2.3rem)', margin: '18px 0 14px' }}>The ritual never changed.<br /><em>The magic did.</em></h3>
              <p style={{ color: 'rgba(255,247,234,.78)', maxWidth: '44ch' }}>
                Curtain up, countdown on, flash — then a warm strip in your hand and a QR that puts the same strip on your phone. Try the exact rhythm your guests will feel.
              </p>
              <ul style={{ listStyle: 'none', marginTop: 20, display: 'grid', gap: 11, color: 'rgba(255,247,234,.88)', fontSize: '.98rem' }}>
                {['Studio light + a real Canon sensor', 'Printed on DNP dye-sub in ~12 seconds', 'Digital copy before you leave the booth'].map((line) => (
                  <li key={line} style={{ display: 'flex', gap: 10 }}><span style={{ color: 'var(--green)' }}><Icon name="check" size={17} /></span>{line}</li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
