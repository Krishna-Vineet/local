import React from 'react'
export default function Loader({ text="Loading magic…", sub="Please wait" }) {
  return (
    <div className="loader-overlay">
      <div className="loader-ring" />
      <div className="loader-text">{text}</div>
      <div className="loader-sub">{sub}</div>
    </div>
  )
}
