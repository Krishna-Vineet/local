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
  onStickerDelete,
  className = '',
}: {
  template: BoothTemplate
  photos?: CapturedPhoto[]
  customization?: Customization
  interactiveSlot?: (index: number) => void
  onStickerMove?: (id: string, x: number, y: number) => void
  onStickerDelete?: (id: string) => void
  className?: string
}) {
  const { layout, design } = template
  const frameRef = useRef<HTMLDivElement>(null)
  const background = design.background.type === 'image' && design.background.url
    ? `url(${design.background.url}) center / cover`
    : design.background.colors.length > 1
      ? `linear-gradient(145deg, ${design.background.colors.join(', ')})`
      : design.background.colors[0]
  const aspect = layout.canvas.width / layout.canvas.height
  const Designer = template.componentId ? DESIGNER_REGISTRY[template.componentId] : undefined
  const selectedLogo = customization.logo
  const title = customization.title || design.title
  const subtitle = customization.subtitle || design.subtitle
  const ornament = customization.ornament === 'none' ? design.ornament : customization.ornament

  // Drag support for stickers
  const handleStickerPointerDown = (sticker: PlacedSticker, e: React.PointerEvent<HTMLSpanElement>) => {
    if (!onStickerMove) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
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
    e.currentTarget.addEventListener('pointermove', onMove as EventListener)
    e.currentTarget.addEventListener('pointerup', () => {
      e.currentTarget.removeEventListener('pointermove', onMove as EventListener)
    }, { once: true })
  }

  const content = (
    <>
      <div className={`ornament ornament--${ornament}`} aria-hidden="true"/>
      {layout.photoSlots.map((slot, index) => {
        const photo = photos[index]
        const style: CSSProperties = {
          left: `${slot.x / layout.canvas.width * 100}%`,
          top: `${slot.y / layout.canvas.height * 100}%`,
          width: `${slot.width / layout.canvas.width * 100}%`,
          height: `${slot.height / layout.canvas.height * 100}%`,
          transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
        }
        // Only render as <button> when interactive - avoids nested button warning
        if (interactiveSlot) {
          return (
            <button
              type="button"
              key={slot.id}
              className={`template-slot shape--${design.slotShape} filter--${customization.filter} is-interactive`}
              style={style}
              onClick={() => interactiveSlot(index)}
            >
              {photo ? <img src={photo.dataUrl} alt={`Selected photo ${index + 1}`}/> : <span><b>{index + 1}</b><small>PHOTO</small></span>}
            </button>
          )
        }
        return (
          <div
            key={slot.id}
            className={`template-slot shape--${design.slotShape} filter--${customization.filter}`}
            style={style}
          >
            {photo ? <img src={photo.dataUrl} alt={`Selected photo ${index + 1}`}/> : <span><b>{index + 1}</b><small>PHOTO</small></span>}
          </div>
        )
      })}
      <div className="template-footer" style={{ color: design.textColor }}>
        <div className="template-footer-logos">
          {selectedLogo && <img src={selectedLogo} alt="Selected event logo"/>}
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
          {onStickerDelete && (
            <button
              type="button"
              className="sticker-delete"
              onClick={(e) => { e.stopPropagation(); onStickerDelete(sticker.id) }}
              title="Remove sticker"
            >×</button>
          )}
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
