import React from 'react'

export default function Loader({ text = 'One moment…', sub }){
  return (
    <div className="loader-overlay" role="status" aria-live="polite">
      <div className="loader-mark" aria-hidden="true">
        <span className="loader-ring" />
        <span className="loader-shutter" />
      </div>
      <div className="loader-text">{text}</div>
      {sub && <div className="loader-sub">{sub}</div>}
    </div>
  )
}
