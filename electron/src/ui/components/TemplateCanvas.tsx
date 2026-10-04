import type { CSSProperties, ComponentType, ReactNode } from 'react'
import type { BoothTemplate, CapturedPhoto, Customization } from '../types'

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
  className = '',
}: {
  template: BoothTemplate
  photos?: CapturedPhoto[]
  customization?: Customization
  interactiveSlot?: (index: number) => void
  className?: string
}) {
  const { layout, design } = template
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
        return (
          <button
            type="button"
            key={slot.id}
            className={`template-slot shape--${design.slotShape} filter--${customization.filter} ${interactiveSlot ? 'is-interactive' : ''}`}
            style={style}
            onClick={() => interactiveSlot?.(index)}
            tabIndex={interactiveSlot ? 0 : -1}
          >
            {photo ? <img src={photo.dataUrl} alt={`Selected photo ${index + 1}`}/> : <span><b>{index + 1}</b><small>PHOTO</small></span>}
          </button>
        )
      })}
      <div className="template-footer" style={{ color: design.textColor }}>
        <div className="template-footer-logos">
          {selectedLogo && <img src={selectedLogo} alt="Selected event logo"/>}
        </div>
        <div className="template-footer-copy"><strong>{title}</strong><span>{subtitle}</span></div>
      </div>
      {customization.stickers.map((sticker) => (
        <span key={sticker.id} className="placed-sticker" style={{ left: `${sticker.x}%`, top: `${sticker.y}%` }}>{sticker.emoji}</span>
      ))}
    </>
  )

  return (
    <div className={`template-frame ${className}`} style={{ aspectRatio: String(aspect), background }}>
      {Designer ? <Designer accent={design.accent}>{content}</Designer> : content}
    </div>
  )
}
