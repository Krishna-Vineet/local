// Designer templates — Classic / editorial family.
// Each component is a hand-crafted design: NO generic renderer.

import { Backdrop, Photo, LogoRow, Divider, FONTS, Pattern, uid } from '../primitives.jsx'

// 4x6 · Vertical · 1 image — clean white keyline postcard.
export function ClassicPostcard({ layout, geo, photos, logos, title = 'HappyPix', tagline }) {
  const { w, h } = layout.canvas
  const s = geo.photoSlots[0]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect width={w} height={h} fill="#FFFFFF" />
      <rect x="30" y="30" width={w - 60} height={h - 60} fill="none" stroke="#2A2338" strokeWidth="3" />
      <rect x="42" y="42" width={w - 84} height={h - 84} fill="none" stroke="#2A2338" strokeWidth="1" opacity="0.35" />
      <Photo x={58} y={58} w={w - 116} h={geo.footer.y - 150} src={photos?.[0]} index={0} stroke="#2A2338" strokeWidth="2.5" label="PHOTO 01" />
      <text x={w / 2} y={geo.footer.y - 40} textAnchor="middle" fontFamily={FONTS.serif} fontSize="34" fontWeight="600" letterSpacing="6" fill="#191424">
        {String(title).toUpperCase()}
      </text>
      <LogoRow x={70} y={geo.footer.y + 14} w={w - 140} h={geo.footer.h - 28} logos={logos} max={4} tagline={tagline} ring="rgba(25,20,36,0.35)" bg="rgba(25,20,36,0.06)" textColor="#403952" />
    </svg>
  )
}

// 5x7 · Vertical · 1 image — editorial monochrome with wide mat.
export function MinimalMono({ layout, geo, photos, logos, title = 'Untitled', tagline }) {
  const { w, h } = layout.canvas
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect width={w} height={h} fill="#FAFAF8" />
      <Photo x="95" y="95" w={w - 190} h={geo.footer.y - 190} src={photos?.[0]} index={6} label="PHOTO" labelColor="rgba(255,255,255,0.95)" />
      <rect x="95" y={geo.footer.y - 106} width="64" height="4" fill="#191424" />
      <text x="95" y={geo.footer.y - 62} fontFamily={FONTS.mono} fontSize="26" letterSpacing="5" fill="#403952">
        {String(title).toUpperCase().slice(0, 24)}
      </text>
      <LogoRow x={w / 2 - 180} y={geo.footer.y + 10} w={360} h={geo.footer.h - 24} logos={logos} max={3} tagline={tagline} ring="rgba(25,20,36,0.3)" bg="rgba(25,20,36,0.05)" textColor="#403952" align="center" />
    </svg>
  )
}

// 4x12 · Vertical · 5 images — cinematic stacked panorama.
export function PanoramaStory({ layout, geo, photos, logos, title = 'Panorama', tagline }) {
  const { w, h } = layout.canvas
  const bar = 14
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id={uid('pan')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241E33" />
          <stop offset="1" stopColor="#14101F" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${uid('pan')})`} />
      <rect x="0" y="0" width={bar} height={h} fill="#A99BE8" />
      {geo.photoSlots.map((s, i) => (
        <g key={s.id}>
          <Photo x={s.x + 34} y={s.y} w={s.width - 34} h={s.height} src={photos?.[i]} index={i} rx="6" stroke="#3A3348" strokeWidth="2" label={`SCENE ${i + 1}`} />
          <text x={s.x + 34 + s.width - 37} y={s.y + 34} textAnchor="end" fontFamily={FONTS.mono} fontSize="24" fill="rgba(255,255,255,0.5)">
            00:0{i + 1}
          </text>
        </g>
      ))}
      <text x={w / 2 + bar / 2} y={geo.footer.y + 74} textAnchor="middle" fontFamily={FONTS.sans} fontSize="52" fontWeight="800" letterSpacing="16" fill="#FFFFFF">
        {String(title).toUpperCase()}
      </text>
      <LogoRow x={w / 2 - 300 + bar / 2} y={geo.footer.y + 104} w={600} h={geo.footer.h - 120} logos={logos} max={4} tagline={tagline} ring="rgba(255,255,255,0.4)" bg="rgba(255,255,255,0.1)" textColor="#FFFFFF" align="center" />
    </svg>
  )
}
