// Designer templates — Corporate family.

import { Photo, LogoRow, LogoDot, FONTS, remapSlots } from '../primitives.jsx'

// 4x6 · Horizontal · 4 images — brand header band + clean grid.
export function CorporateGrid({ layout, geo, photos, logos, title = 'Team Offsite 2026', tagline }) {
  const { w, h } = layout.canvas
  const slots = remapSlots(geo.photoSlots, 0, 150, w, geo.footer.y - 170)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect width={w} height={h} fill="#FFFFFF" />
      <rect width={w} height="128" fill="#3871C1" />
      <rect x="0" y="128" width={w} height="6" fill="#EA097F" />
      <text x="46" y="82" fontFamily={FONTS.sans} fontSize="52" fontWeight="800" fill="#FFFFFF" letterSpacing="1">
        {title}
      </text>
      {logos?.[0] ? <LogoDot cx={w - 90} cy={64} r={40} src={logos[0].src} name={logos[0].name} ring="rgba(255,255,255,0.7)" bg="rgba(255,255,255,0.2)" /> : null}
      {slots.map((s, i) => (
        <Photo key={s.id} x={s.x} y={s.y} w={s.width} h={s.height} src={photos?.[i]} index={i} rx="10" stroke="#C9D4E8" strokeWidth="2.5" label={`PHOTO ${i + 1}`} />
      ))}
      <text x="46" y={geo.footer.y + 62} fontFamily={FONTS.sans} fontSize="30" fill="#403952" fontWeight="600">
        {tagline || 'HappyPix · captured & printed on site'}
      </text>
      <LogoRow x={w - 440} y={geo.footer.y + 12} w={400} h={geo.footer.h - 30} logos={(logos || []).slice(1)} max={3} ring="rgba(56,113,193,0.45)" bg="rgba(56,113,193,0.08)" textColor="#3871C1" align="right" />
    </svg>
  )
}
