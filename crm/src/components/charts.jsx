// Lightweight pure-SVG charts — no external dependencies.
// BarChart, LineChart (area), Donut.

import { useId } from 'react'

function niceMax(v) {
  if (v <= 0) return 10
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const norm = v / mag
  let step
  if (norm <= 1.2) step = 1
  else if (norm <= 2) step = 2
  else if (norm <= 2.5) step = 2.5
  else if (norm <= 5) step = 5
  else step = 10
  return step * mag
}

export function BarChart({ data, height = 190, color = 'var(--hp-pink)', formatValue = (v) => v, highlightLast = false, showValueTop = false }) {
  const W = 640
  const H = height
  const padL = 8
  const padB = 24
  const padT = showValueTop ? 22 : 10
  const max = niceMax(Math.max(...data.map((d) => d.value), 1))
  const n = data.length || 1
  const slot = (W - padL * 2) / n
  const bw = Math.min(slot * 0.55, 46)

  const ticks = 4
  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const y = padT + ((H - padT - padB) * i) / ticks
          return (
            <g key={i}>
              <line x1={padL} x2={W - padL} y1={y} y2={y} stroke="var(--line-soft)" strokeWidth="1" />
            </g>
          )
        })}
        {data.map((d, i) => {
          const h = Math.max(((H - padT - padB) * (d.value / max)) || 1.5, d.value > 0 ? 2 : 0)
          const x = padL + slot * i + (slot - bw) / 2
          const y = H - padB - h
          const last = highlightLast && i === data.length - 1
          return (
            <g key={i}>
              {d.value > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={bw}
                  height={h}
                  rx={Math.min(6, bw / 2)}
                  fill={last ? 'var(--hp-pink)' : color}
                  opacity={last ? 1 : 0.78}
                >
                  <title>{`${d.label}: ${formatValue(d.value)}`}</title>
                </rect>
              )}
              {d.value === 0 && <rect x={x} y={H - padB - 2} width={bw} height={2} rx={1} fill="var(--line)" />}
              {showValueTop && d.value > 0 && (
                <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="10.5" fontWeight="650" fill="var(--ink-2)">
                  {formatValue(d.value)}
                </text>
              )}
              <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize="10.5" fill="var(--faint)" fontWeight="560">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function LineChart({ data, height = 210, color = 'var(--hp-pink)', formatValue = (v) => v, yPrefix = '' }) {
  const gid = useId().replace(/:/g, '')
  const W = 640
  const H = height
  const padL = 46
  const padR = 14
  const padT = 14
  const padB = 26
  const max = niceMax(Math.max(...data.map((d) => d.value), 1))
  const n = data.length || 1
  const xFor = (i) => padL + ((W - padL - padR) * (n === 1 ? 0.5 : i / (n - 1)))
  const yFor = (v) => padT + ((H - padT - padB) * (1 - v / max))
  const pts = data.map((d, i) => [xFor(i), yFor(d.value)])
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1]?.[0] ?? padL},${H - padB} L${pts[0]?.[0] ?? padL},${H - padB} Z`
  const ticks = 4

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id={`lg-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (max / ticks) * (ticks - i)
        const y = yFor(v)
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--line-soft)" />
            <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill="var(--faint)" fontWeight="550">
              {yPrefix}{Math.round(v).toLocaleString('en-IN')}
            </text>
          </g>
        )
      })}
      <path d={area} fill={`url(#lg-${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="3.4" fill="var(--surface)" stroke={color} strokeWidth="2">
            <title>{`${data[i].label}: ${formatValue(data[i].value)}`}</title>
          </circle>
          {(n <= 12 || i % Math.ceil(n / 12) === 0) && (
            <text x={p[0]} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--faint)" fontWeight="550">
              {data[i].label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

export function Donut({ data, size = 150, thickness = 20, centerLabel, centerSub }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-soft)" strokeWidth={thickness} />
        {data.map((d, i) => {
          const frac = d.value / total
          const dash = frac * c
          const off = -acc * c
          acc += frac
          if (d.value === 0) return null
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={off}
              strokeLinecap="butt"
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          )
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 21, fontWeight: 720, letterSpacing: '-0.03em' }}>{centerLabel}</span>
        {centerSub ? <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 600 }}>{centerSub}</span> : null}
      </div>
    </div>
  )
}

export function ChartLegend({ items }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
      {items.map((it, i) => (
        <div key={i} className="row gap-8" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color, flex: 'none' }} />
          <span className="fw6">{it.label}</span>
          <span className="muted num">{it.value != null ? it.value : ''}</span>
        </div>
      ))}
    </div>
  )
}
