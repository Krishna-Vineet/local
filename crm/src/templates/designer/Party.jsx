// Designer templates — Parties & fun family.

import { Backdrop, Photo, LogoRow, Sprockets, Pattern, FONTS, uid, remapSlots } from '../primitives.jsx'

// 4x6 · Vertical · 4 images — neon glow 2x2 grid.
export function NeonParty({ layout, geo, photos, logos, title = 'NEON NIGHT', tagline }) {
  const { w, h } = layout.canvas
  const glowId = uid('glow')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <Backdrop w={w} h={h} bg={{ type: 'gradient', colors: ['#EA097F', '#5F4CAA'] }} />
      {geo.photoSlots.map((s, i) => (
        <g key={s.id}>
          <rect x={s.x + 26} y={s.y + 26} width={s.width - 52} height={s.height - 52} rx="30" fill="none" stroke="#FF7AC1" strokeWidth="16" opacity="0.3" filter={`url(#${glowId})`} />
          <Photo x={s.x + 26} y={s.y + 26} w={s.width - 52} h={s.height - 52} src={photos?.[i]} index={1} rx="26" stroke="rgba(255,255,255,0.9)" strokeWidth="3" label={`PHOTO ${i + 1}`} />
        </g>
      ))}
      <rect x="0" y={geo.footer.y} width={w} height="4" fill="rgba(255,255,255,0.5)" />
      <text x="34" y={geo.footer.y + 64} fontFamily={FONTS.sans} fontSize="44" fontWeight="800" letterSpacing="6" fill="#FFFFFF">
        {title}
      </text>
      <LogoRow x={34} y={geo.footer.y + 82} w={w - 68} h={geo.footer.h - 100} logos={logos} max={4} tagline={tagline} ring="rgba(255,255,255,0.6)" bg="rgba(255,255,255,0.14)" textColor="#FFFFFF" />
    </svg>
  )
}

// 2x6 · Vertical · 3 images — warm sunset strip.
export function SunsetStrip({ layout, geo, photos, logos, title = 'SUNSET', tagline }) {
  const { w, h } = layout.canvas
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <Pattern id={uid('st')} type="dots" color="rgba(255,255,255,0.2)" size={40} />
      </defs>
      <Backdrop w={w} h={h} bg={{ type: 'gradient', colors: ['#F7B733', '#EA097F'] }} patternId={uid('st')} pattern />
      {geo.photoSlots.map((s, i) => (
        <Photo key={s.id} x={s.x + 24} y={s.y + 18} w={s.width - 48} h={s.height - 36} src={photos?.[i]} index={i} rx="18" stroke="#FFFFFF" strokeWidth="4" label={`PHOTO ${i + 1}`} />
      ))}
      <rect x="0" y={geo.footer.y + 12} width={w} height={geo.footer.h - 24} fill="rgba(255,255,255,0.18)" rx="12" />
      <text x={w / 2} y={geo.footer.y + 62} textAnchor="middle" fontFamily={FONTS.sans} fontSize="34" fontWeight="800" letterSpacing="8" fill="#FFFFFF">
        {title}
      </text>
      <LogoRow x={26} y={geo.footer.y + 74} w={w - 52} h={geo.footer.h - 92} logos={logos} max={2} tagline={tagline} ring="rgba(255,255,255,0.75)" bg="rgba(255,255,255,0.2)" textColor="#FFFFFF" align="center" />
    </svg>
  )
}

// 2x6 · Vertical · 4 images — retro film strip with sprockets.
export function FilmStrip({ layout, geo, photos, logos, title = 'HAPPYPIX FILM', tagline }) {
  const { w, h } = layout.canvas
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect width={w} height={h} fill="#141414" />
      <Sprockets x={20} y={16} len={h - 32} vertical pitch={52} hole={10} />
      <Sprockets x={w - 20} y={16} len={h - 32} vertical pitch={52} hole={10} />
      {geo.photoSlots.map((s, i) => (
        <Photo key={s.id} x={s.x + 44} y={s.y + 10} w={s.width - 88} h={s.height - 20} src={photos?.[i]} index={7} rx="4" stroke="#2E2E2E" strokeWidth="2" label={`${i + 1}`} />
      ))}
      <text x={w / 2} y={geo.footer.y + 58} textAnchor="middle" fontFamily={FONTS.mono} fontSize="26" fontWeight="700" letterSpacing="4" fill="#FFB000">
        {title}
      </text>
      <text x={w / 2} y={geo.footer.y + 96} textAnchor="middle" fontFamily={FONTS.mono} fontSize="22" fill="rgba(255,176,0,0.7)">
        {tagline || 'FRAME 04 · 2026'}
      </text>
      <LogoRow x={w / 2 - 90} y={geo.footer.y + 112} w={180} h={geo.footer.h - 124} logos={logos} max={2} ring="rgba(255,176,0,0.6)" bg="rgba(255,176,0,0.12)" textColor="#FFB000" align="center" />
    </svg>
  )
}

// 2x10 · Vertical · 5 images — numbered collector reel on teal stock.
export function CollectorReel({ layout, geo, photos, logos, title = 'COLLECTOR 2026', tagline }) {
  const { w, h } = layout.canvas
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id={uid('tl')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DFF2F2" />
          <stop offset="1" stopColor="#B7DFDF" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${uid('tl')})`} />
      <rect x="14" y="14" width={w - 28} height={h - 28} fill="none" stroke="#0E7490" strokeWidth="2.5" strokeDasharray="1 0" opacity="0.7" />
      {geo.photoSlots.map((s, i) => (
        <g key={s.id}>
          <Photo x={s.x + 26} y={s.y + 12} w={s.width - 52} h={s.height - 24} src={photos?.[i]} index={5} rx="14" stroke="#0E7490" strokeWidth="3" label={`FRAME ${i + 1}`} labelColor="rgba(255,255,255,0.95)" />
          <rect x={s.x + 12} y={s.y + 2} width="64" height="40" rx="8" fill="#0E7490" />
          <text x={s.x + 44} y={s.y + 29} textAnchor="middle" fontFamily={FONTS.mono} fontSize="22" fontWeight="700" fill="#FFFFFF">
            {String(i + 1).padStart(2, '0')}
          </text>
        </g>
      ))}
      <circle cx={w / 2} cy={geo.footer.y + 66} r="34" fill="none" stroke="#0E7490" strokeWidth="2.5" strokeDasharray="6 5" />
      <text x={w / 2} y={geo.footer.y + 74} textAnchor="middle" fontFamily={FONTS.mono} fontSize="20" fontWeight="700" fill="#0E7490">
        26
      </text>
      <text x={w / 2} y={geo.footer.y + 138} textAnchor="middle" fontFamily={FONTS.mono} fontSize="24" letterSpacing="3" fill="#0B5D73">
        {title}
      </text>
      <LogoRow x={40} y={geo.footer.y + 156} w={w - 80} h={geo.footer.h - 170} logos={logos} max={2} tagline={tagline} ring="rgba(14,116,144,0.55)" bg="rgba(14,116,144,0.1)" textColor="#0B5D73" align="center" />
    </svg>
  )
}

// 4x6 · Horizontal · 3 images — playful dots, tilted frames.
export function KidsSplash({ layout, geo, photos, logos, title = 'Splash Time!', tagline }) {
  const { w, h } = layout.canvas
  const tilts = [-2.2, 2, -1.4]
  const centers = geo.photoSlots.map((s) => ({ cx: s.x + s.width / 2, cy: s.y + s.height / 2 }))
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <Pattern id={uid('pd')} type="dots" color="rgba(56,113,193,0.16)" size={44} />
      </defs>
      <Backdrop w={w} h={h} bg={{ type: 'gradient', colors: ['#DDEBFF', '#FFE9F2'] }} patternId={uid('pd')} pattern />
      {geo.photoSlots.map((s, i) => (
        <g key={s.id} transform={`rotate(${tilts[i % tilts.length]} ${centers[i].cx} ${centers[i].cy})`}>
          <Photo x={s.x + 16} y={s.y + 14} w={s.width - 32} h={s.height - 28} src={photos?.[i]} index={i} rx="28" stroke="#FFFFFF" strokeWidth="6" label={`PHOTO ${i + 1}`} />
        </g>
      ))}
      <circle cx={w - 56} cy={48} r="26" fill="#FFD166" />
      <circle cx={w - 96} cy={92} r="10" fill="#06D6A0" />
      <circle cx={64} cy={h - 190} r="12" fill="#EF476F" />
      <text x="30" y={geo.footer.y + 56} fontFamily='"Comic Sans MS", "Segoe Print", cursive' fontSize="46" fontWeight="700" fill="#2A6FBE">
        {title}
      </text>
      <LogoRow x={w - 480} y={geo.footer.y + 14} w={450} h={geo.footer.h - 30} logos={logos} max={3} tagline={tagline} ring="rgba(42,111,190,0.45)" bg="rgba(255,255,255,0.7)" textColor="#2A6FBE" align="right" />
    </svg>
  )
}
