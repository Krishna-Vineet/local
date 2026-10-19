import React from 'react'
export default function BoothHeader({ title, subtitle, step, secondsLeft=60, showTimer=true }){
  const urgent = secondsLeft <=10, warn = secondsLeft <=20 && !urgent
  return (
    <div className="booth-header">
      <div className="booth-header-left">
        {step ? <div className="booth-step-pill">{step}</div> : <div style={{width:84}}/>}
      </div>
      <div className="booth-header-center">
        <div className="booth-header-title">{title}</div>
        {subtitle && <div className="booth-header-sub">{subtitle}</div>}
      </div>
      <div style={{minWidth:96, display:'flex', justifyContent:'flex-end'}}>
        {showTimer && secondsLeft>0 ? (
          <div className={`booth-timer ${urgent?'urgent': warn?'warn':''}`}>⏳ {secondsLeft>=60 ? `${Math.floor(secondsLeft/60)}:${String(secondsLeft%60).padStart(2,'0')}` : `${secondsLeft}s`}</div>
        ): <div style={{width:78}}/>}
      </div>
    </div>
  )
}
