// Shared SVG primitives for template components.
// Every template renders as a single <svg viewBox="0 0 W H"> at the
// layout's print proportions — crisp at any preview size, and the
// booth app can drop real photos into the same slots.

import React from 'react'

let uidCounter = 0
export function uid(prefix) {
  return `${prefix}-${++uidCounter}`
}

// deterministic placeholder photo gradients
const PHOTO_GRADIENTS = [
  ['#B9A8E0', '#7A63B8'], ['#F0B7CE', '#D96AA0'], ['#A9C7EC', '#5F8FC9'],
  ['#BFE3B4', '#7FB56E'], ['#F3D9A4', '#D9A85E'], ['#A9DBE8', '#5FA8BC'],
  ['#D7C2B0', '#A5806A'], ['#C9C4D8', '#8F88A6'],
]
export function photoGradientDef(defsId, i) {
  const [c1, c2] = PHOTO_GRADIENTS[Math.abs(i) % PHOTO_GRADIENTS.length]
  return (
    <linearGradient id={defsId} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={c1} />
      <stop offset="1" stopColor={c2} />
    </linearGradient>
  )
}

// Aperture-style camera glyph (scaled to r)
export function Aperture({ cx, cy, r, color = 'rgba(255,255,255,0.85)' }) {
  const blades = []
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 * Math.PI) / 180
    blades.push(
      <line
        key={i}
        x1={cx + Math.cos(a) * r * 0.32}
        y1={cy + Math.sin(a) * r * 0.32}
        x2={cx + Math.cos(a + 2.1) * r * 0.78}
        y2={cy + Math.sin(a + 2.1) * r * 0.78}
        stroke={color}
        strokeWidth={r * 0.09}
        strokeLinecap="round"
      />
    )
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={r * 0.12} />
      <circle cx={cx} cy={cy} r={r * 0.3} fill={color} opacity="0.9" />
      {blades}
    </g>
  )
}

// One photo slot: real photo if provided, styled placeholder otherwise.
export function Photo({
  x, y, w, h, src, index = 0, rx = 0, shape = 'rect',
  stroke = 'none', strokeWidth = 0, label = 'PHOTO', labelColor = 'rgba(255,255,255,0.92)',
  dim = false,
}) {
  const clipId = uid('clip')
  const gradId = uid('pg')
  const path = shape === 'arch' ? archPath(x, y, w, h) : shape === 'round' ? circlePath(x, y, w, h) : null
  const clipShape = path || <rect x={x} y={y} width={w} height={h} rx={rx} />
  return (
    <g>
      <defs>
        {photoGradientDef(gradId, index)}
        <clipPath id={clipId}>{clipShape}</clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {src ? (
          <image href={src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <rect x={x} y={y} width={w} height={h} fill={`url(#${gradId})`} />
            <Aperture cx={x + w / 2} cy={y + h / 2 - h * 0.03} r={Math.min(w, h) * 0.11} color="rgba(255,255,255,0.8)" />
            <text
              x={x + w / 2}
              y={y + h / 2 + Math.min(w, h) * 0.14}
              textAnchor="middle"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={Math.min(w, h) * 0.075}
              fontWeight="700"
              letterSpacing={Math.min(w, h) * 0.02}
              fill={labelColor}
              opacity="0.9"
            >
              {label}
            </text>
          </>
        )}
        {dim ? <rect x={x} y={y} width={w} height={h} fill="rgba(10,8,18,0.35)" /> : null}
      </g>
      {stroke !== 'none' && strokeWidth > 0
        ? (path
            ? React.cloneElement(path, { fill: 'none', stroke, strokeWidth })
            : <rect x={x} y={y} width={w} height={h} rx={rx} fill="none" stroke={stroke} strokeWidth={strokeWidth} />)
        : null}
    </g>
  )
}

function archPath(x, y, w, h) {
  const r = w / 2
  return <path d={`M ${x} ${y + h} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} L ${x + w} ${y + h} Z`} />
}
function circlePath(x, y, w, h) {
  const rx = w / 2
  const ry = h / 2
  return <ellipse cx={x + rx} cy={y + ry} rx={rx} ry={ry} />
}

// Sponsor / host / venue / team logo — real artwork when provided,
// otherwise a monogram dot. Event branding may carry up to 15 logos;
// each template places as many as its design reserves room for.
export function LogoDot({ cx, cy, r, src, name = '?', ring = 'rgba(255,255,255,0.55)', bg = 'rgba(255,255,255,0.14)', textColor = '#FFFFFF' }) {
  const clipId = uid('lclip')
  const initials = String(name)
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={bg} />
      {src ? (
        <image href={src} x={cx - r} y={cy - r} width={2 * r} height={2 * r} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
      ) : (
        <text x={cx} y={cy + r * 0.36} textAnchor="middle" fontFamily="Georgia, serif" fontSize={r * 0.95} fontWeight="700" fill={textColor}>
          {initials}
        </text>
      )}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={ring} strokeWidth={r * 0.08} />
    </g>
  )
}

// Footer strip: event logos left, tagline right (inside the 15% footer)
export function LogoRow({
  x, y, w, h, logos = [], max = 4, tagline = '', textColor = '#FFFFFF',
  ring = 'rgba(255,255,255,0.55)', bg = 'rgba(255,255,255,0.14)', align = 'left',
}) {
  const r = h * 0.32
  const gap = r * 2.35
  const shown = (logos || []).slice(0, max)
  const extra = (logos || []).length - shown.length
  const dots = shown.length + (extra > 0 ? 1 : 0)
  const totalW = dots * gap - (gap - 2 * r)
  const startX = align === 'center' ? x + (w - totalW) / 2 : x + r
  const cy = y + h / 2
  return (
    <g>
      {shown.map((lg, i) => (
        <LogoDot key={i} cx={startX + i * gap} cy={cy} r={r} src={lg?.src} name={lg?.name || `Logo ${i + 1}`} ring={ring} bg={bg} textColor={textColor} />
      ))}
      {extra > 0 ? (
        <text x={startX + shown.length * gap + r} y={cy + r * 0.4} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize={r * 0.9} fontWeight="700" fill={textColor} opacity="0.85">
          +{extra}
        </text>
      ) : null}
      {tagline ? (
        <text
          x={x + w - r * 0.4}
          y={cy + h * 0.045}
          textAnchor="end"
          fontFamily="Georgia, serif"
          fontStyle="italic"
          fontSize={h * 0.3}
          fill={textColor}
          opacity="0.92"
        >
          {tagline}
        </text>
      ) : null}
    </g>
  )
}

// Film sprocket hole columns/rows
export function Sprockets({ x, y, len, pitch = 34, hole = 9, color = 'rgba(255,255,255,0.85)', vertical = true }) {
  const holes = []
  const n = Math.max(2, Math.floor(len / pitch))
  const step = len / n
  for (let i = 0; i < n; i++) {
    const cx = vertical ? x : x + step * (i + 0.5)
    const cy = vertical ? y + step * (i + 0.5) : y
    holes.push(<rect key={i} x={cx - (vertical ? hole : hole * 1.3)} y={cy - (vertical ? hole * 1.3 : hole)} width={vertical ? hole * 2 : hole * 2.6} height={vertical ? hole * 2.6 : hole * 2} rx={hole * 0.55} fill={color} />)
  }
  return <g opacity="0.9">{holes}</g>
}

// Corner flourish (calligraphic swirl)
export function Flourish({ x, y, size = 60, color = '#D9B44A', flipX = false, flipY = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${(flipX ? -1 : 1) * size / 60} ${(flipY ? -1 : 1) * size / 60})`} opacity="0.9">
      <path d="M2 58 C 8 34, 22 16, 46 8 C 34 18, 26 30, 24 44 C 30 36, 40 30, 52 30 C 40 36, 32 46, 30 58 Z" fill={color} />
      <circle cx="52" cy="30" r="3.2" fill={color} />
    </g>
  )
}

// Ornamental divider (small diamond + lines)
export function Divider({ x, y, w, color = '#D9B44A', opacity = 0.85 }) {
  const cy = y
  return (
    <g opacity={opacity}>
      <line x1={x} y1={cy} x2={x + w / 2 - 10} y2={cy} stroke={color} strokeWidth="1.6" />
      <line x1={x + w / 2 + 10} y1={cy} x2={x + w} y2={cy} stroke={color} strokeWidth="1.6" />
      <rect x={x + w / 2 - 4.4} y={cy - 4.4} width="8.8" height="8.8" transform={`rotate(45 ${x + w / 2} ${cy})`} fill={color} />
    </g>
  )
}

// dot / stripe pattern overlay
export function Pattern({ id, type = 'dots', color = 'rgba(255,255,255,0.16)', size = 26, w = 0, h = 0 }) {
  if (type === 'stripes') {
    return (
      <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={size * 0.32} height={size} fill={color} />
      </pattern>
    )
  }
  if (type === 'grid') {
    return (
      <pattern id={id} width={size * 2} height={size * 2} patternUnits="userSpaceOnUse">
        <path d={`M ${size * 2} 0 L 0 0 0 ${size * 2}`} fill="none" stroke={color} strokeWidth="1.4" />
      </pattern>
    )
  }
  return (
    <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
      <circle cx={size / 2} cy={size / 2} r={size * 0.09} fill={color} />
    </pattern>
  )
}

// background: solid / gradient / image + optional pattern overlay
export function Backdrop({ w, h, bg = {}, patternId, pattern }) {
  const gid = uid('bg')
  const type = bg?.type || 'gradient'
  return (
    <g>
      <defs>
        {type === 'image' && bg.url ? null : type === 'solid' ? (
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={bg.colors?.[0] || '#FFFFFF'} />
            <stop offset="1" stopColor={bg.colors?.[0] || '#FFFFFF'} />
          </linearGradient>
        ) : (
          <linearGradient id={gid} x1="0" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor={bg.colors?.[0] || '#5F4CAA'} />
            <stop offset="1" stopColor={bg.colors?.[1] || '#3A3170'} />
          </linearGradient>
        )}
      </defs>
      {type === 'image' && bg.url ? (
        <image href={bg.url} x="0" y="0" width={w} height={h} preserveAspectRatio="xMidYMid slice" />
      ) : (
        <rect width={w} height={h} fill={`url(#${gid})`} />
      )}
      {pattern ? <rect width={w} height={h} fill={`url(#${patternId})`} /> : null}
    </g>
  )
}

export const FONTS = {
  sans: 'Inter, "SF Pro Text", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  script: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

// Scale/translate a geometry slot set into a custom design area
// (e.g. reserve a title band above the photos).
export function remapSlots(photoSlots, x, y, w, h) {
  if (!photoSlots?.length) return []
  const maxX = Math.max(...photoSlots.map((s) => s.x + s.width))
  const maxY = Math.max(...photoSlots.map((s) => s.y + s.height))
  const sx = w / maxX
  const sy = h / maxY
  return photoSlots.map((s) => ({
    ...s,
    x: x + s.x * sx,
    y: y + s.y * sy,
    width: s.width * sx,
    height: s.height * sy,
  }))
}
