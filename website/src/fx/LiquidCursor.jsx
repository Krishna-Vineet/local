import { useEffect, useRef } from 'react'

// ─── Liquid cursor ───────────────────────────────────────────
// Three small droplets trail the pointer while it moves. They stretch in the
// direction of travel, keep reshaping their edge, and merge through a gooey
// filter. The trail fades out once the mouse stops.
//   • over buttons / cards  → swell
//   • over images or links  → recede: shrink, fade, and drop behind the page
//     (z-index −1), so they never sit on top of what you're pointing at
// Desktop with a mouse only; the native cursor stays visible.

const SIZE = 160 // stage box the droplets live in (px)
const DROPS = [
  { d: 30, ease: 0.26, cls: 'lc-a' },
  { d: 20, ease: 0.14, cls: 'lc-b' },
  { d: 12, ease: 0.08, cls: 'lc-c' },
]
const BACK_SEL = 'a, img, picture, video, .photo-card, .simg, .dl-card'
const GROW_SEL = 'button, .btn, .card, .plan-card, .story-card, input, select, textarea, label, [role="button"]'
const IDLE_MS = 320

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
    let mx = 0, my = 0, seen = false, lastMove = 0
    let lastX = 0, lastY = 0, speed = 0, angle = 0
    let fade = 0, grow = 1, growT = 1, press = 1, pressT = 1, back = 0, backT = 0
    let isBack = false
    let raf = 0

    const onMove = (e) => {
      if (!seen) {
        seen = true
        pos.forEach((p) => { p.x = e.clientX; p.y = e.clientY })
        lastX = e.clientX; lastY = e.clientY
      }
      mx = e.clientX
      my = e.clientY
      lastMove = performance.now()
    }
    const onOver = (e) => {
      const t = e.target instanceof Element ? e.target : null
      if (t && t.closest(BACK_SEL)) { backT = 1; growT = 1 }
      else if (t && t.closest(GROW_SEL)) { backT = 0; growT = 1.9 }
      else { backT = 0; growT = 1 }
    }
    const onDown = () => { pressT = 0.7 }
    const onUp = () => { pressT = 1 }
    const onLeaveWindow = (e) => { if (!e.relatedTarget) seen = false }

    const frame = (now) => {
      const vx = mx - lastX, vy = my - lastY
      lastX = mx; lastY = my
      const sp = Math.hypot(vx, vy)
      speed += (sp - speed) * 0.2
      if (sp > 0.5) angle = (Math.atan2(vy, vx) * 180) / Math.PI
      grow += (growT - grow) * 0.12
      press += (pressT - press) * 0.22
      back += (backT - back) * 0.1

      // visible only while moving (short fade in / out)
      const moving = seen && now - lastMove < IDLE_MS
      fade += ((moving ? 1 : 0) - fade) * 0.18
      root.style.opacity = (fade * (1 - 0.7 * back)).toFixed(3)
      if (back > 0.5 !== isBack) {
        isBack = back > 0.5
        root.classList.toggle('is-back', isBack)
      }
      root.style.transform = `translate3d(${mx - SIZE / 2}px, ${my - SIZE / 2}px, 0)`

      const t = now / 1000
      const stretch = Math.min(speed, 45)
      DROPS.forEach((cfg, i) => {
        const p = pos[i]
        const leadX = i === 0 ? mx : pos[i - 1].x
        const leadY = i === 0 ? my : pos[i - 1].y
        p.x += (leadX - p.x) * cfg.ease
        p.y += (leadY - p.y) * cfg.ease

        const k = (i === 0 ? grow : 1) * press * (1 - 0.5 * back)
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
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
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
