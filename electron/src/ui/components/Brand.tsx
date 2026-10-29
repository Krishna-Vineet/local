import logo from '../assets/happypix-logo-light.svg'

export function Brand({ compact = false }: { compact?: boolean }) {
  // Compact shows logomark + brandmark together from single asset;
  // CSS constrains size so header never overflows. Full variant adds BOOTH pill.
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="HappyPix">
      <img src={logo} alt="HappyPix" />
      {!compact && <span>BOOTH</span>}
    </div>
  )
}

export function BrandMark() {
  return <Brand compact />
}
