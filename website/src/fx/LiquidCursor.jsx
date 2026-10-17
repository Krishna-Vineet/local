import { useEffect, useRef } from 'react'

// ─── Liquid cursor ───────────────────────────────────────────
// Three droplets trail the pointer. Each lags a little more than the one before,
// stretches in the direction you're moving, keeps reshaping its edge, and the
// three merge together through a gooey filter. They swell over links and
// buttons and squish on press. Desktop with a mouse only; the native cursor
// stays visible for accuracy.

const SIZE = 240 // stage box the droplets live in (px)
const DROPS = [
  { d: 52, ease: 0.24, cls: 'lc-a' },
  { d: 36, ease: 0.13, cls: 'lc-b' },
  { d: 22, ease: 0.07, cls: 'lc-c' },
]
const HOVER_SEL = 'a, button, .btn, .card, .plan-card, .story-card, input, select, textarea, label, [role="button"]'

export default function LiquidCursor() {
  const rootRef = useRef(null)
  const dropRefs = useRef([])

  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!finePointer || reduce) return

    const root = rootRef.current
    const drops = dropRefs.current
    const pos = DROPS.map(() => ({ x: 0, y: 0 }))
    let mx = 0, my = 0, seen = false
    let lastX = 0, lastY = 0, speed = 0, angle = 0
    let hover = 1, hoverTarget = 1, press = 1, pressTarget = 1
    let raf = 0

    const onMove = (e) => {
      if (!seen) {
        seen = true
        root.style.opacity = '1'
        pos.forEach((p) => { p.x = e.clientX; p.y = e.clientY })
        lastX = e.clientX; lastY = e.clientY
      }
      mx = e.clientX
      my = e.clientY
    }
    const onOver = (e) => {
      hoverTarget = e.target instanceof Element && e.target.closest(HOVER_SEL) ? 1.9 : 1
    }
    const onDown = () => { pressTarget = 0.7 }
    const onUp = () => { pressTarget = 1 }
    const onLeaveWindow = (e) => {
      if (!e.relatedTarget) { root.style.opacity = '0'; seen = false }
    }

    const frame = (now) => {
      const vx = mx - lastX, vy = my - lastY
      lastX = mx; lastY = my
      const sp = Math.hypot(vx, vy)
      speed += (sp - speed) * 0.2
      if (sp > 0.5) angle = (Math.atan2(vy, vx) * 180) / Math.PI
      hover += (hoverTarget - hover) * 0.12
      press += (pressTarget - press) * 0.22

      root.style.transform = `translate3d(${mx - SIZE / 2}px, ${my - SIZE / 2}px, 0)`

      const t = now / 1000
      const stretch = Math.min(speed, 45)
      DROPS.forEach((cfg, i) => {
        const p = pos[i]
        const leadX = i === 0 ? mx : pos[i - 1].x
        const leadY = i === 0 ? my : pos[i - 1].y
        p.x += (leadX - p.x) * cfg.ease
        p.y += (leadY - p.y) * cfg.ease

        const k = (i === 0 ? hover : 1) * press
        const sx = 1 + (stretch * 0.012) / (i + 1)
        const sy = 1 - stretch * 0.004
        const amp = 9 + stretch * 0.6 + i * 3
        const r = (n) => (50 + amp * Math.sin(t * (1.8 + i * 0.4) + n * 1.37 + i * 2.1)).toFixed(1)

        const cx = SIZE / 2 + (p.x - mx)
        const cy = SIZE / 2 + (p.y - my)
        const el = drops[i]
        if (!el) return
        el.style.borderRadius = `${r(0)}% ${r(1)}% ${r(2)}% ${r(3)}% / ${r(4)}% ${r(5)}% ${r(6)}% ${r(7)}%`
        el.style.transform = `translate3d(${cx - cfg.d / 2}px, ${cy - cfg.d / 2}px, 0) rotate(${angle}deg) scale(${k * sx}, ${k * sy})`
      })
      raf = requestAnimationFrame(frame)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerover', onOver, { passive: true })
    document.addEventListener('pointerdown', onDown, { passive: true })
    document.addEventListener('pointerup', onUp, { passive: true })
    document.documentElement.addEventListener('mouseout', onLeaveWindow)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
      document.documentElement.removeEventListener('mouseout', onLeaveWindow)
    }
  }, [])

  return (
    <>
      <svg className="fx-defs" aria-hidden="true" focusable="false">
        <filter id="fx-goo-cursor" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>
      <div ref={rootRef} className="lc-root" aria-hidden="true">
        {DROPS.map((d, i) => (
          <span
            key={d.cls}
            ref={(el) => { dropRefs.current[i] = el }}
            className={`lc-drop ${d.cls}`}
            style={{ width: d.d, height: d.d }}
          />
        ))}
      </div>
    </>
  )
}
