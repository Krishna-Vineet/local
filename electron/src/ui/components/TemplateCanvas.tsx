import { type CSSProperties, type ComponentType, type ReactNode, useRef } from 'react'
import type { BoothTemplate, CapturedPhoto, Customization, PlacedSticker } from '../types'

interface DesignerProps {
  accent: string
  children: ReactNode
}

function RoyalWedding({ accent, children }: DesignerProps) {
  return <div className="designer-layer designer-royal" style={{ '--accent': accent } as CSSProperties}><span className="corner corner-a">❦</span><span className="corner corner-b">❦</span>{children}</div>
}

function ClassicWhite({ accent, children }: DesignerProps) {
  return <div className="designer-layer designer-classic" style={{ '--accent': accent } as CSSProperties}><span className="classic-line"/>{children}</div>
}

function BlushBloom({ accent, children }: DesignerProps) {
  return <div className="designer-layer designer-blush" style={{ '--accent': accent } as CSSProperties}><span className="bloom bloom-a">✿</span><span className="bloom bloom-b">✿</span>{children}</div>
}

function MidnightReel({ accent, children }: DesignerProps) {
  return <div className="designer-layer designer-midnight" style={{ '--accent': accent } as CSSProperties}><span className="star-field">✦ · ✧ · ✦ · ✧</span>{children}</div>
}

function PartyPop({ accent, children }: DesignerProps) {
  return <div className="designer-layer designer-party" style={{ '--accent': accent } as CSSProperties}><span className="party-ribbon">● ▲ ◆ ● ▲ ◆</span>{children}</div>
}

const DESIGNER_REGISTRY: Record<string, ComponentType<DesignerProps>> = {
  RoyalWedding,
  ClassicWhite,
  BlushBloom,
  MidnightReel,
  PartyPop,
}

const emptyCustomization: Customization = {
  ornament: 'none',
  filter: 'original',
  logo: null,
  title: '',
  subtitle: '',
  stickers: [],
}

export function TemplateCanvas({
  template,
  photos = [],
  customization = emptyCustomization,
  interactiveSlot,
  onStickerMove,
  className = '',
  activeSlotIndex,
}: {
  template: BoothTemplate
  photos?: CapturedPhoto[]
  customization?: Customization
  interactiveSlot?: (index: number) => void
  onStickerMove?: (id: string, x: number, y: number) => void
  onStickerDelete?: (id: string) => void
  className?: string
  activeSlotIndex?: number
}) {
  const { layout, design } = template
  const frameRef = useRef<HTMLDivElement>(null)
  const dAny: any = design || {}

  const resolveUrl = (u?: string | null) => {
    if (!u) return ''
    if (u.startsWith('data:') || u.startsWith('http://') || u.startsWith('https://')) return u
    const base = (import.meta as any).env?.VITE_BOOTH_API_URL || 'http://localhost:5000'
    return `${String(base).replace(/\/+$/, '')}/${u.replace(/^\/+/, '')}`
  }

  const templateAssets: any[] = Array.isArray((template as any)?.assets) ? (template as any).assets : []
  const bg: any = dAny?.background
  const rawBgUrl =
    bg?.url ||
    (typeof bg === 'string' && (bg.startsWith('http') || bg.startsWith('data:') || bg.startsWith('/')) ? bg : null) ||
    dAny?.bg?.url ||
    templateAssets.find((a: any) => a.role === 'background' || a.type === 'background')?.url ||
    null
  const bgColors: string[] = (Array.isArray(bg?.colors) && bg.colors.length > 0)
    ? bg.colors
    : (Array.isArray(dAny?.bg?.colors) && dAny.bg.colors.length > 0)
      ? dAny.bg.colors
      : ['#ffffff']
  const background = rawBgUrl
    ? `url(${resolveUrl(rawBgUrl)}) center / cover`
    : bgColors.length > 1
      ? `linear-gradient(145deg, ${bgColors.join(', ')})`
      : bgColors[0]
  const aspect = layout.canvas.width / layout.canvas.height
  const Designer = template.componentId ? DESIGNER_REGISTRY[template.componentId] : undefined

  const overlayDecorations: any[] = []
  if (Array.isArray(dAny?.decorations)) {
    for (const dec of dAny.decorations) {
      if (dec && dec.url && dec.overlay !== false && dec.position !== 'background') {
        overlayDecorations.push(dec)
      }
    }
  }
  for (const asset of templateAssets) {
    if (asset?.role === 'overlay' || asset?.role === 'frame' || asset?.type === 'overlay') {
      if (!overlayDecorations.some((d) => d.url === asset.url || (d.assetId && d.assetId === asset.assetId))) {
        overlayDecorations.push({ url: asset.url })
      }
    }
  }
  const logos: string[] = []
  // Support legacy single-logo + new sponsor multi-logo fields
  const custom = customization as any
  if (Array.isArray(custom.sponsorLogos) && custom.sponsorLogos.length) logos.push(...custom.sponsorLogos.filter(Boolean))
  if (custom.sponsorLogo && !logos.includes(custom.sponsorLogo)) logos.push(custom.sponsorLogo)
  if (customization.logo && !logos.includes(customization.logo)) logos.push(customization.logo)
  const templateLogos: string[] = Array.isArray((template as any).sponsorLogos) ? (template as any).sponsorLogos : []
  const headerLogos = logos.length ? logos.slice(0, 3) : templateLogos.slice(0, 3)
  const title = customization.title || design.title
  const subtitle = customization.subtitle || design.subtitle
  // Respect explicit 'none' to hide ornament; otherwise fallback to template decor/ornament
  const rawDecor = (custom as any).decor
  const rawOrnament = customization.ornament
  let ornament: string | undefined
  if (rawOrnament === 'none' || rawDecor === 'none') ornament = 'none'
  else if (rawOrnament) ornament = rawOrnament
  else if (rawDecor) ornament = rawDecor
  else if ((design as any).decor) ornament = (design as any).decor
  else ornament = design.ornament

  const handleStickerPointerDown = (sticker: PlacedSticker, e: React.PointerEvent<HTMLSpanElement>) => {
    if (!onStickerMove) return
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const frame = frameRef.current
    if (!frame) return
    const startX = e.clientX
    const startY = e.clientY
    const startStickerX = sticker.x
    const startStickerY = sticker.y
    const onMove = (me: PointerEvent) => {
      const rect = frame.getBoundingClientRect()
      const dx = ((me.clientX - startX) / rect.width) * 100
      const dy = ((me.clientY - startY) / rect.height) * 100
      const nx = Math.max(0, Math.min(100, startStickerX + dx))
      const ny = Math.max(0, Math.min(100, startStickerY + dy))
      onStickerMove(sticker.id, nx, ny)
    }
    const target = e.currentTarget as HTMLElement
    const handler = onMove as EventListener
    target.addEventListener('pointermove', handler)
    target.addEventListener('pointerup', () => {
      target.removeEventListener('pointermove', handler)
    }, { once: true })
  }

  const content = (
    <>
      {ornament && ornament !== 'none' && <div className={`ornament ornament--${ornament}`} aria-hidden="true"/>}
      {layout.photoSlots.map((slot, index) => {
        const photo = photos[index]
        const style: CSSProperties = {
          left: `${slot.x / layout.canvas.width * 100}%`,
          top: `${slot.y / layout.canvas.height * 100}%`,
          width: `${slot.width / layout.canvas.width * 100}%`,
          height: `${slot.height / layout.canvas.height * 100}%`,
          transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
        }
        if (interactiveSlot) {
          return (
            <button
              type="button"
              key={slot.id}
              className={`template-slot shape--${design.slotShape} filter--${customization.filter} is-interactive${activeSlotIndex === index ? ' is-active' : ''}`}
              style={style}
              data-slot={index + 1}
              onClick={() => interactiveSlot(index)}
            >
              {photo ? <img src={photo.dataUrl} alt={`Selected photo ${index + 1}`}/> : <span><b>{index + 1}</b><small>PHOTO</small></span>}
            </button>
          )
        }
        return (
          <div
            key={slot.id}
            className={`template-slot shape--${design.slotShape} filter--${customization.filter}${activeSlotIndex === index ? ' is-active' : ''}`}
            style={style}
            data-slot={index + 1}
          >
            {photo ? <img src={photo.dataUrl} alt={`Selected photo ${index + 1}`}/> : <span><b>{index + 1}</b><small>PHOTO</small></span>}
          </div>
        )
      })}
      {overlayDecorations.map((dec, i) => (
        <img
          key={`overlay-dec-${i}`}
          src={resolveUrl(dec.url)}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      ))}
      <div className="template-footer" style={{ color: design.textColor }}>
        <div className="template-footer-logos">
          {headerLogos.map((src, i) => (
            <img key={i} src={src} alt={`Sponsor ${i + 1}`} style={{ height: '70%', maxWidth: '30%', objectFit: 'contain', background: '#fff', borderRadius: 4, padding: 2, border: '1px solid rgba(0,0,0,.08)', marginRight: 6 }} />
          ))}
        </div>
        <div className="template-footer-copy"><strong>{title}</strong><span>{subtitle}</span></div>
      </div>
      {customization.stickers.map((sticker) => (
        <span
          key={sticker.id}
          className={`placed-sticker${onStickerMove ? ' is-draggable' : ''}`}
          style={{
            left: `${sticker.x}%`,
            top: `${sticker.y}%`,
            fontSize: `${(sticker.scale ?? 1) * 1.8}em`,
            touchAction: 'none',
          }}
          onPointerDown={(e) => handleStickerPointerDown(sticker, e)}
        >
          {sticker.emoji}
        </span>
      ))}
    </>
  )

  return (
    <div ref={frameRef} className={`template-frame ${className}`} style={{ aspectRatio: String(aspect), background }}>
      {Designer ? <Designer accent={design.accent}>{content}</Designer> : content}
    </div>
  )
}
