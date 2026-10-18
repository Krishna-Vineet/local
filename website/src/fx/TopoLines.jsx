import { useEffect, useRef } from 'react'
import { fbm } from './noise.js'

// ─── Topographic lines ───────────────────────────────────────
// Contour lines of a noise "terrain" (marching squares). Drawn once per size
// and drifted by CSS (see .topo in fx.css) so it costs nothing per frame.

// marching-squares segments per case; edges: 0 top, 1 right, 2 bottom, 3 left
// case index m = a·8 + b·4 + c·2 + d  (a=TL, b=TR, c=BR, d=BL)
const CASES = [
  [], [[3, 2]], [[2, 1]], [[1, 3]], [[0, 1]], [[0, 3], [2, 1]], [[0, 2]], [[0, 3]],
  [[0, 3]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[1, 3]], [[1, 2]], [[3, 2]], [],
]

function drawContours(canvas, { seed, levels, color, alpha, scale, cell }) {
  const r = canvas.getBoundingClientRect()
  if (!r.width || !r.height) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(r.width * dpr)
  canvas.height = Math.round(r.height * dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, r.width, r.height)

  const cols = Math.ceil(r.width / cell) + 2
  const rows = Math.ceil(r.height / cell) + 2
  const grid = new Float32Array(cols * rows)
  let min = Infinity, max = -Infinity
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const v = fbm(i * cell * scale + seed, j * cell * scale - seed * 0.7, 4)
      grid[j * cols + i] = v
      if (v < min) min = v
      if (v > max) max = v
    }
  }

  for (let k = 1; k < levels; k++) {
    const t = min + ((max - min) * k) / levels
    const major = k % 4 === 0
    ctx.strokeStyle = `rgba(${color},${(alpha * (major ? 2.4 : 1)).toFixed(3)})`
    ctx.lineWidth = major ? 1.1 : 0.7
    ctx.beginPath()
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = grid[j * cols + i]
        const b = grid[j * cols + i + 1]
        const c = grid[(j + 1) * cols + i + 1]
        const d = grid[(j + 1) * cols + i]
        const m = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0)
        if (!CASES[m].length) continue
        const x0 = i * cell, y0 = j * cell
        const lerp = (v1, v2) => {
          const dv = v2 - v1
          return dv === 0 ? 0.5 : Math.min(1, Math.max(0, (t - v1) / dv))
        }
        const pt = (e) => {
          switch (e) {
            case 0: return [x0 + lerp(a, b) * cell, y0]
            case 1: return [x0 + cell, y0 + lerp(b, c) * cell]
            case 2: return [x0 + lerp(d, c) * cell, y0 + cell]
            default: return [x0, y0 + lerp(a, d) * cell]
          }
        }
        for (const [e1, e2] of CASES[m]) {
          const [x1, y1] = pt(e1)
          const [x2, y2] = pt(e2)
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
        }
      }
    }
    ctx.stroke()
  }
}

export default function TopoLines({
  seed = 3,
  levels = 18,
  color = '255,255,255',
  alpha = 0.1,
  scale = 0.0042,
  cell = 6,
}) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const opts = { seed, levels, color, alpha, scale, cell }
    drawContours(canvas, opts)
    const ro = new ResizeObserver(() => drawContours(canvas, opts))
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [seed, levels, color, alpha, scale, cell])

  return <canvas ref={ref} className="topo" aria-hidden="true" />
}
