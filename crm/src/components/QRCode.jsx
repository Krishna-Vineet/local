// Renders a QR as crisp SVG. Used for the org UPI payment QR preview.
import { useMemo } from 'react'
import { qrMatrix } from '../lib/qr.js'

export function QRCode({ value, size = 160, fg = '#141020', bg = '#ffffff', quiet = 2, style }) {
  const m = useMemo(() => {
    try { return qrMatrix(value) } catch { return null }
  }, [value])
  if (!m) return null
  const n = m.length + quiet * 2
  let d = ''
  for (let y = 0; y < m.length; y++) for (let x = 0; x < m.length; x++) if (m[y][x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label="UPI QR code" style={style}>
      <rect width={n} height={n} fill={bg} />
      <path d={d} fill={fg} />
    </svg>
  )
}
