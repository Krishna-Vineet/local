import type { ReactNode } from 'react'
import { Brand } from './Brand'
import { Icon } from './Icon'
import { useBoothContext } from '../context/BoothContext'

const FLOW = ['orientation', 'templates', 'prints', 'payment', 'camera', 'photos', 'customize']

export function ScreenShell({
  children,
  screen,
  secondsLeft,
  online = true,
  title,
  subtitle,
  className = '',
}: {
  children: ReactNode
  screen: string
  secondsLeft?: number
  online?: boolean
  title?: string
  subtitle?: string
  className?: string
}) {
  const { orgName, orgLogoUrl } = useBoothContext()
  const step = FLOW.indexOf(screen)
  return (
    <main className={`screen-shell ${className}`}>
      <header className="booth-header">
        <Brand compact />
        {orgLogoUrl ? (
          <div className="org-brand">
            <img src={orgLogoUrl} alt={orgName} className="org-brand-logo"/>
            <span className="org-brand-name">{orgName}</span>
          </div>
        ) : (
          <span className="org-brand-name-only">{orgName}</span>
        )}
        {step >= 0 && (
          <div className="flow-progress" aria-label={`Step ${step + 1} of ${FLOW.length}`}>
            {FLOW.map((item, index) => <span key={item} className={index <= step ? 'is-done' : ''}/>) }
          </div>
        )}
        <div className="header-status">
          <span className={`connection-state ${online ? 'is-online' : 'is-offline'}`}>
            <Icon name="wifi" size={16}/>{online ? 'Connected' : 'Offline'}
          </span>
          {secondsLeft !== undefined && (
            <span className={`timer-pill ${secondsLeft <= 10 ? 'is-urgent' : ''}`}>
              <Icon name="clock" size={16}/>{secondsLeft}s
            </span>
          )}
        </div>
      </header>
      {(title || subtitle) && (
        <div className="screen-heading">
          {title && <h1>{title}</h1>}
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}
      <div className="screen-content">{children}</div>
    </main>
  )
}

export function IdleWarning({ secondsLeft, onContinue }: { secondsLeft: number; onContinue: () => void }) {
  if (secondsLeft > 10) return null
  return (
    <div className="idle-overlay" role="alertdialog" aria-modal="true" aria-label="Inactivity warning">
      <div className="idle-card">
        <div className={`idle-count ${secondsLeft <= 5 ? 'is-critical' : ''}`}>{secondsLeft}</div>
        <h2>Are you still there?</h2>
        <p>Your photo session will reset shortly.</p>
        <p className="idle-hindi">क्या आप यहाँ हैं? आपका सत्र जल्द रीसेट होगा।</p>
        <button className="button button--primary" onClick={onContinue}>Yes, keep my session</button>
      </div>
    </div>
  )
}
