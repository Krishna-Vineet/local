// Composable template — renders Playground / AI template configs.
// This is NOT the general renderer for designer templates: those are
// hand-crafted components. The Composable exists so a template born in
// the Template Playground (palette + ornament + typography + optional
// AI background) is a first-class template everywhere, and its config
// can later be exported as a dedicated component scaffold.

import { Backdrop, Photo, LogoRow, Flourish, Pattern, FONTS, uid } from './primitives.jsx'

export function ComposableTemplate({ layout, geo, template, photos, logos, title, tagline }) {
  const d = template?.design || {}
  const { w, h } = layout?.canvas || { w: 1000, h: 1500 }
  const accent = d.accent || '#EA097F'
  const textColor = d.textColor || '#FFFFFF'
  const font = FONTS[d.font] || FONTS.sans
  const shape = d.slotShape || 'rect'
  const showTitle = title ?? d.title ?? ''
  const showTagline = tagline ?? d.tagline ?? ''
  const patId = uid('cp')
  const usePattern = ['dots', 'stripes', 'grid'].includes(d.ornament)
  const slots = d.titleBand
    ? remapSafe(geo.photoSlots, 30, 210, w - 60, (geo.footer.y || h * 0.85) - 250)
    : geo.photoSlots
  const fy = geo.footer?.y ?? h * 0.85
  const fh = geo.footer?.h ?? h * 0.15

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>{usePattern ? <Pattern id={patId} type={d.ornament} color={hexA(accent, 0.18)} size={34} /> : null}</defs>
      <Backdrop w={w} h={h} bg={d.bg || { type: 'gradient', colors: ['#5F4CAA', '#3A3170'] }} patternId={patId} pattern={usePattern} />
      {d.ornament === 'flourish' ? (
        <>
          <Flourish x={40} y={36} size={70} color={accent} />
          <Flourish x={w - 40} y={36} size={70} color={accent} flipX />
          <Flourish x={40} y={h - 36} size={70} color={accent} flipY />
          <Flourish x={w - 40} y={h - 36} size={70} color={accent} flipX flipY />
        </>
      ) : null}
      {d.titleBand ? (
        <>
          <text x={w / 2} y={140} textAnchor="middle" fontFamily={font} fontSize="78" fontWeight="700" fill={textColor} letterSpacing="3">
            {showTitle}
          </text>
          <rect x={w / 2 - 90} y={168} width={180} height="4" fill={accent} />
        </>
      ) : null}
      {slots.map((s, i) => (
        <Photo
          key={s.id}
          x={s.x + (d.titleBand ? 0 : Math.min(28, w * 0.03))}
          y={s.y + (d.titleBand ? 0 : Math.min(28, w * 0.03))}
          w={s.width - (d.titleBand ? 0 : Math.min(56, w * 0.06))}
          h={s.height - (d.titleBand ? 0 : Math.min(56, w * 0.06))}
          src={photos?.[i]}
          index={i}
          shape={shape}
          rx={shape === 'rect' ? Math.min(22, w * 0.03) : 0}
          stroke={accent}
          strokeWidth={Math.max(3, w * 0.005)}
          label={`PHOTO ${i + 1}`}
          labelColor={textColor}
        />
      ))}
      {!d.titleBand && showTitle ? (
        <text x={w / 2} y={fy + fh * 0.17} textAnchor="middle" fontFamily={font} fontSize={Math.min(64, w * 0.09)} fontWeight="700" fill={textColor} letterSpacing="2">
          {showTitle}
        </text>
      ) : null}
      <LogoRow x={w * 0.05} y={fy + fh * 0.08} w={w * 0.9} h={fh * 0.84} logos={logos} max={4} tagline={showTagline} ring={hexA(accent, 0.75)} bg={hexA(accent, 0.16)} textColor={textColor} />
    </svg>
  )
}

function remapSafe(slots, x, y, w, h) {
  if (!slots?.length) return []
  const maxX = Math.max(...slots.map((s) => s.x + s.width))
  const maxY = Math.max(...slots.map((s) => s.y + s.height))
  return slots.map((s) => ({
    ...s,
    x: x + (s.x / maxX) * w,
    y: y + (s.y / maxY) * h,
    width: (s.width / maxX) * w,
    height: (s.height / maxY) * h,
  }))
}

function hexA(hex, a) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  if (!m) return `rgba(255,255,255,${a})`
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`
}
