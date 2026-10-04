// Designer templates — Weddings & celebrations family.

import { Backdrop, Photo, LogoRow, Divider, Flourish, Pattern, FONTS, uid, remapSlots } from '../primitives.jsx'

// 5x7 · Vertical · 3 images — royal purple, gold arches, script title.
export function RoyalWedding({ layout, geo, photos, logos, title = 'Royal Wedding', tagline }) {
  const { w, h } = layout.canvas
  const slots = geo.photoSlots
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <Pattern id={uid('dt')} type="dots" color="rgba(255,255,255,0.10)" size={30} />
      </defs>
      <Backdrop w={w} h={h} bg={{ type: 'gradient', colors: ['#5F4CAA', '#3A3170'] }} patternId={uid('dt')} pattern />
      <rect x="24" y="24" width={w - 48} height={h - 48} fill="none" stroke="#D9B44A" strokeWidth="3.5" />
      <rect x="36" y="36" width={w - 72} height={h - 72} fill="none" stroke="#D9B44A" strokeWidth="1" opacity="0.7" />
      <Flourish x={44} y={40} size={64} color="#D9B44A" />
      <Flourish x={w - 44} y={40} size={64} color="#D9B44A" flipX />
      <text x={w / 2} y={130} textAnchor="middle" fontFamily={FONTS.script} fontSize="96" fill="#F3D9A4">
        {title}
      </text>
      <Divider x={w / 2 - 130} y={162} w={260} color="#D9B44A" />
      {slots.map((s, i) => (
        <Photo key={s.id} x={s.x + 54} y={s.y + 34} w={s.width - 108} h={s.height - 48} src={photos?.[i]} index={i} shape="arch" stroke="#D9B44A" strokeWidth="4" label={`PHOTO ${i + 1}`} />
      ))}
      <LogoRow x={60} y={geo.footer.y + 10} w={w - 120} h={geo.footer.h - 24} logos={logos} max={4} tagline={tagline} ring="rgba(217,180,74,0.8)" bg="rgba(217,180,74,0.16)" textColor="#F3D9A4" />
    </svg>
  )
}

// 3x8 · Vertical · 3 images — sepia bookmark with ornate dividers.
export function VintageBookmark({ layout, geo, photos, logos, title = 'A Keepsake', tagline }) {
  const { w, h } = layout.canvas
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <Pattern id={uid('pp')} type="dots" color="rgba(107,91,62,0.12)" size={22} />
      </defs>
      <rect width={w} height={h} fill="#F5EEDC" />
      <rect width={w} height={h} fill={`url(#${uid('pp')})`} />
      <rect x="22" y="22" width={w - 44} height={h - 44} fill="none" stroke="#6B5B3E" strokeWidth="4" />
      <rect x="34" y="34" width={w - 68} height={h - 68} fill="none" stroke="#6B5B3E" strokeWidth="1.2" opacity="0.8" />
      <circle cx={w / 2} cy="52" r="7" fill="#8C6D1F" />
      {geo.photoSlots.map((s, i) => (
        <g key={s.id}>
          <Photo x={s.x + 42} y={s.y + 26} w={s.width - 84} h={s.height - 52} src={photos?.[i]} index={4} stroke="#6B5B3E" strokeWidth="3" label={`PHOTO ${i + 1}`} labelColor="rgba(255,255,255,0.95)" />
          {i < geo.photoSlots.length - 1 ? (
            <Divider x={w / 2 - 90} y={s.y + s.height + 10} w={180} color="#8C6D1F" />
          ) : null}
        </g>
      ))}
      <text x={w / 2} y={geo.footer.y + 66} textAnchor="middle" fontFamily={FONTS.serif} fontSize="40" fontStyle="italic" fill="#4C3F26">
        {title}
      </text>
      <LogoRow x={56} y={geo.footer.y + 96} w={w - 112} h={geo.footer.h - 122} logos={logos} max={3} tagline={tagline} ring="rgba(107,91,62,0.5)" bg="rgba(107,91,62,0.08)" textColor="#4C3F26" align="center" />
    </svg>
  )
}

// 6x8 · Vertical · 1 image — full-bleed portrait in a gold gallery frame.
export function GalaGold({ layout, geo, photos, logos, title = 'Gala Night', tagline }) {
  const { w, h } = layout.canvas
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect width={w} height={h} fill="#191420" />
      <rect x="40" y="40" width={w - 80} height={geo.footer.y - 20} fill="none" stroke="#D9B44A" strokeWidth="2" opacity="0.9" />
      <Photo x="62" y="62" w={w - 124} h={geo.footer.y - 142} src={photos?.[0]} index={2} stroke="#D9B44A" strokeWidth="6" label="PORTRAIT" />
      <text x="70" y={geo.footer.y + 92} fontFamily={FONTS.serif} fontSize="64" fill="#F3D9A4" letterSpacing="2">
        {title}
      </text>
      <text x="70" y={geo.footer.y + 150} fontFamily={FONTS.serif} fontStyle="italic" fontSize="36" fill="rgba(243,217,164,0.75)">
        {tagline || 'Presented with joy'}
      </text>
      <LogoRow x={w - 460} y={geo.footer.y + 34} w={390} h={geo.footer.h - 60} logos={logos} max={3} ring="rgba(217,180,74,0.8)" bg="rgba(217,180,74,0.14)" textColor="#F3D9A4" align="right" tagline="" />
    </svg>
  )
}

// 8x12 · Vertical · 6 images — maroon poster, gold separators, title band.
export function FestiveMaroon({ layout, geo, photos, logos, title = 'Festive Wishes', tagline }) {
  const { w, h } = layout.canvas
  const slots = remapSlots(geo.photoSlots, 36, 226, w - 72, geo.footer.y - 286)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <Pattern id={uid('st')} type="stripes" color="rgba(255,233,214,0.06)" size={64} />
      </defs>
      <Backdrop w={w} h={h} bg={{ type: 'solid', colors: ['#6E1F2A'] }} patternId={uid('st')} pattern />
      <rect x="18" y="18" width={w - 36} height={h - 36} fill="none" stroke="#D9B44A" strokeWidth="3" opacity="0.85" />
      <text x={w / 2} y={128} textAnchor="middle" fontFamily={FONTS.serif} fontSize="86" fontWeight="700" fill="#FFE9D6" letterSpacing="4">
        {title}
      </text>
      <Divider x={w / 2 - 220} y={170} w={440} color="#D9B44A" />
      {slots.map((s, i) => (
        <Photo key={s.id} x={s.x} y={s.y} w={s.width} h={s.height} src={photos?.[i]} index={i} rx="14" stroke="#D9B44A" strokeWidth="3" label={`PHOTO ${i + 1}`} />
      ))}
      <LogoRow x={70} y={geo.footer.y + 14} w={w - 140} h={geo.footer.h - 30} logos={logos} max={5} tagline={tagline} ring="rgba(217,180,74,0.85)" bg="rgba(217,180,74,0.15)" textColor="#FFE9D6" />
    </svg>
  )
}

// 8x10 · Vertical · 9 images — navy grid, gold hairlines, grand title.
export function LegacyGuestbook({ layout, geo, photos, logos, title = 'The Guest Book', tagline }) {
  const { w, h } = layout.canvas
  const slots = remapSlots(geo.photoSlots, 44, 210, w - 88, geo.footer.y - 264)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <Backdrop w={w} h={h} bg={{ type: 'gradient', colors: ['#1E3E70', '#12264A'] }} />
      <rect x="20" y="20" width={w - 40} height={h - 40} fill="none" stroke="#D9B44A" strokeWidth="2.5" opacity="0.9" />
      <rect x="30" y="30" width={w - 60} height={h - 60} fill="none" stroke="#D9B44A" strokeWidth="1" opacity="0.5" />
      <text x={w / 2} y={128} textAnchor="middle" fontFamily={FONTS.serif} fontSize="84" fill="#F3D9A4" letterSpacing="3">
        {title}
      </text>
      <Divider x={w / 2 - 200} y={166} w={400} color="#D9B44A" />
      {slots.map((s, i) => (
        <Photo key={s.id} x={s.x} y={s.y} w={s.width} h={s.height} src={photos?.[i]} index={i} rx="8" stroke="rgba(217,180,74,0.85)" strokeWidth="2.5" label={`${i + 1}`} />
      ))}
      <LogoRow x={90} y={geo.footer.y + 12} w={w - 180} h={geo.footer.h - 26} logos={logos} max={5} tagline={tagline} ring="rgba(217,180,74,0.8)" bg="rgba(217,180,74,0.14)" textColor="#F3D9A4" align="center" />
    </svg>
  )
}
