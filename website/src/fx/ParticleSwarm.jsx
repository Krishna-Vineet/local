import { useEffect, useRef } from 'react'
import { mountCanvas } from './canvasLoop.js'

// ─── Particle swarm ──────────────────────────────────────────
// A small flock (cohesion · alignment · separation) that drifts around the
// hero, leaves soft trails and gently bends toward the cursor. Brand colours,
// low opacity, paused whenever it is off screen.

const COLORS = ['234,9,127', '255,122,184', '95,76,170', '56,113,193', '133,197,54', '247,183,49', '255,255,255']
const LINK = 90
const REACH = 180

export default function ParticleSwarm({ count = 64, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const mouse = { x: -1e4, y: -1e4 }
    let parts = []
    const N = Math.round(window.innerWidth < 720 ? count * 0.55 : count)

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
    }
    const onLeave = () => { mouse.x = mouse.y = -1e4 }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('blur', onLeave)

    const init = (st) => {
      parts = Array.from({ length: N }, () => ({
        x: Math.random() * st.w,
        y: Math.random() * st.h,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        r: 0.8 + Math.random() * 1.6,
      }))
    }

    const tick = (st, ctx, dt = 1) => {
      const { w, h } = st
      // fade the previous frame → soft comet trails
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.16)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'

      for (const p of parts) {
        let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, n = 0
        for (const q of parts) {
          if (q === p) continue
          const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy
          if (d2 < 60 * 60) {
            ax += q.vx; ay += q.vy; cx += q.x; cy += q.y; n++
            if (d2 < 16 * 16 && d2 > 0.01) { sx -= dx / d2; sy -= dy / d2 }
          }
        }
        if (n) {
          p.vx += (ax / n - p.vx) * 0.035 + (cx / n - p.x) * 0.0007 + sx * 0.5
          p.vy += (ay / n - p.vy) * 0.035 + (cy / n - p.y) * 0.0007 + sy * 0.5
        }
        const mx = mouse.x - p.x, my = mouse.y - p.y, md = Math.hypot(mx, my)
        if (md < REACH && md > 1) {
          const f = (1 - md / REACH) * 0.09
          p.vx += (mx / md) * f
          p.vy += (my / md) * f
        }
        p.vx += (Math.random() - 0.5) * 0.04
        p.vy += (Math.random() - 0.5) * 0.04
        const s = Math.hypot(p.vx, p.vy), max = 1.5
        if (s > max) { p.vx = (p.vx / s) * max; p.vy = (p.vy / s) * max }
      }

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20
        if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20
        for (let j = i + 1; j < parts.length; j++) {
          const q = parts[j]
          const d = Math.hypot(q.x - p.x, q.y - p.y)
          if (d < LINK) {
            ctx.strokeStyle = `rgba(${p.c},${((1 - d / LINK) * 0.3).toFixed(3)})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.stroke()
          }
        }
      }
      for (const p of parts) {
        ctx.fillStyle = `rgba(${p.c},0.95)`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const unmount = mountCanvas(canvas, { init, tick })
    return () => {
      unmount()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('blur', onLeave)
    }
  }, [count])

  return <canvas ref={ref} className={`fx-canvas ${className}`.trim()} aria-hidden="true" />
}
