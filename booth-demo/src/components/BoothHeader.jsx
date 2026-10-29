import React from 'react'

function Clock({ urgent }){
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flex:'0 0 12px' }}>
      <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.6V12l3 1.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function BoothHeader({ title, subtitle, step, secondsLeft = 60, showTimer = true }){
  const urgent = secondsLeft <= 10
  const warn = secondsLeft <= 20 && !urgent
  const display = secondsLeft >= 60
    ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2,'0')}`
    : `${secondsLeft}s`
  return (
    <div className="booth-header">
      <div className="booth-header-left">
        {step ? <div className="booth-step-pill">{step}</div> : <div style={{ width:84 }} />}
      </div>
      <div className="booth-header-center">
        <div className="booth-header-title">{title}</div>
        {subtitle && <div className="booth-header-sub">{subtitle}</div>}
      </div>
      <div style={{ minWidth:96, display:'flex', justifyContent:'flex-end' }}>
        {showTimer && secondsLeft > 0 ? (
          <div className={`booth-timer ${urgent ? 'urgent' : warn ? 'warn' : ''}`}>
            <Clock urgent={urgent} /> {display}
          </div>
        ) : <div style={{ width:78 }} />}
      </div>
    </div>
  )
}
