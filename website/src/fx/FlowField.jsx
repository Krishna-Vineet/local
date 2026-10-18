import { useEffect, useRef } from 'react'
import { mountCanvas } from './canvasLoop.js'
import { fbm } from './noise.js'

// ─── Flow fields ─────────────────────────────────────────────
// Thousands of tiny strokes riding a slowly evolving noise field. Each stroke
// fades into a streamline, so the header reads like wind through brand colour.

const PALETTE = ['234,9,127', '56,113,193', '133,197,54', '247,183,49', '95,76,170', '255,160,210']

export default function FlowField({ density = 1 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const N = Math.round((window.innerWidth < 720 ? 120 : 260) * density)
    let parts = []

    const spawn = (p, w, h) => {
      p.x = Math.random() * w
      p.y = Math.random() * h
      p.life = 70 + Math.random() * 160
      p.c = PALETTE[(Math.random() * PALETTE.length) | 0]
      p.alpha = 0.35 + Math.random() * 0.45
      p.sp = 0.6 + Math.random() * 0.9
    }

    const init = (st) => {
      parts = Array.from({ length: N }, () => {
        const p = {}
        spawn(p, st.w, st.h)
        return p
      })
    }

    const tick = (st, ctx, dt = 1) => {
      const { w, h } = st
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.07)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      ctx.lineWidth = 1.1
      ctx.lineCap = 'round'

      const t = (performance.now() / 1000) * 0.035
      for (const p of parts) {
        const a = fbm(p.x * 0.0021 + t, p.y * 0.0021 - t * 0.6, 3) * Math.PI * 4
        const nx = p.x + Math.cos(a) * p.sp * dt * 1.5
        const ny = p.y + Math.sin(a) * p.sp * dt * 1.5
        ctx.strokeStyle = `rgba(${p.c},${p.alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(nx, ny)
        ctx.stroke()
        p.x = nx
        p.y = ny
        p.life -= dt
        if (p.life <= 0 || p.x < 0 || p.x > w || p.y < 0 || p.y > h) spawn(p, w, h)
      }
    }

    return mountCanvas(canvas, { init, tick })
  }, [density])

  return <canvas ref={ref} className="fx-canvas" aria-hidden="true" />
}
