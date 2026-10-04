import logo from '../assets/happypix-logo-light.svg'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="HappyPix">
      <img src={logo} alt="HappyPix" />
      {!compact && <span>BOOTH</span>}
    </div>
  )
}
