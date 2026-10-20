import React, { useRef, useState, useCallback } from 'react'

export default function TemplateCanvas({
  template,
  photos = [],
  width,
  height,
  maxWidth,
  filterId = 'original',
  stickers = [],
  onStickersChange,
  subtitle,
  orgName = '',
  orgLogo = null,
  eventName = '',
  showSlotNumbers = false,
  decor,
  sponsorLogo = null,
  sponsorLogos = null,
}){
  if(!template) return null
  const p = template.palette || { bg:'#fff', ink:'#16161a', soft:'#8e8e96', accent:'#8b5cf6', accent2:'#ec4899', band:'gradient' }
  const ratio = template.canvas.w / template.canvas.h
  let w = width || Math.round((height || 260) * ratio)
  let h = height || Math.round(w / ratio)
  if(maxWidth && w > maxWidth){ w = maxWidth; h = Math.round(w / ratio) }
  const s = w / 260
  const pad = Math.max(6, Math.round(10 * s))
  const filter = getFilterStyle(filterId)
  const photoList = photos.filter(Boolean)
  const hasPhotos = photoList.length > 0
  const title = subtitle || eventName || template.accentStrip
  const displayPhotos = template.slotLayout.map((_, i) => {
    if(!hasPhotos) return null
    const item = photoList[i % photoList.length]
    return typeof item === 'string' ? item : item?.uri || item?.url || null
  })
  const darkCard = isDark(p.bg)
  const compact = h < 190 || w < 120
  // decor: explicit prop overrides template.decor. If decor is null/undefined, fallback to template.decor
  // but if decor === 'none', we want ornament = 'none' (meaning clean)
  const ornament = (decor !== null && decor !== undefined) ? decor : template.decor
  const canvasRef = useRef(null)
  const [dragId, setDragId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  // Resolve sponsor display: single sponsorLogo takes priority, else sponsorLogos array, else none
  const sponsorsToShow = sponsorLogo ? [sponsorLogo] : (Array.isArray(sponsorLogos) ? sponsorLogos.filter(Boolean).slice(0,3) : [])

  const beginDrag = useCallback((e, st) => {
    if(!onStickersChange) return
    e.preventDefault()
    e.stopPropagation()
    setSelectedId(st.id)
    setDragId(st.id)
    const rect = canvasRef.current?.getBoundingClientRect()
    if(!rect) return
    const startX = e.clientX
    const startY = e.clientY
    const origX = st.x
    const origY = st.y

    const onMove = (ev) => {
      const r = canvasRef.current?.getBoundingClientRect()
      if(!r) return
      const dxPct = ((ev.clientX - startX) / r.width) * 100
      const dyPct = ((ev.clientY - startY) / r.height) * 100
      const nx = Math.max(2, Math.min(96, origX + dxPct))
      const ny = Math.max(2, Math.min(94, origY + dyPct))
      onStickersChange(stickers.map(sx => sx.id === st.id ? { ...sx, x: nx, y: ny } : sx))
    }
    const onUp = () => {
      setDragId(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [onStickersChange, stickers])

  return (
    <div
      ref={canvasRef}
      onPointerDownCapture={(e)=> { if(e.target === canvasRef.current) setSelectedId(null)}}
      style={{
      width:w, height:h,
      background:p.bg,
      borderRadius:Math.round(4 * s),
      padding:pad,
      display:'flex', flexDirection:'column',
      position:'relative', overflow:'hidden',
      boxShadow:'0 14px 34px rgba(0,0,0,0.45)',
      border: darkCard ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
      color:p.ink,
      touchAction:'none',
      userSelect:'none'
    }}>
      {!compact && <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:Math.round(6*s), paddingBottom:Math.round(7*s) }}>
        <div style={{ display:'flex', alignItems:'center', gap:Math.round(5*s), minWidth:0 }}>
          {orgLogo
            ? <img src={orgLogo} alt="" style={{ height:Math.round(13*s), maxWidth:Math.round(34*s), objectFit:'contain' }} />
            : <LogoBars s={s} color={p.accent} />}
          <span style={{ fontSize:Math.max(4.6, 5.6*s), fontWeight:800, letterSpacing:1.07*s, color:p.accent, whiteSpace:'nowrap' }}>HAPPYPIX</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:Math.round(4*s), maxWidth:'58%', minWidth:0, justifyContent:'flex-end' }}>
          {sponsorsToShow.length>0 && (
            <div style={{ display:'flex', alignItems:'center', gap:Math.round(3*s), flexShrink:0 }}>
              {sponsorsToShow.map((url, idx)=>(
                <img key={idx} src={url} alt={`Sponsor logo ${idx+1}`} style={{ height:Math.round(12*s), maxWidth:Math.round(32*s), objectFit:'contain', background:'#fff', borderRadius:Math.round(2*s), padding:Math.round(1.2*s), border:'1px solid rgba(0,0,0,0.08)' }} />
              ))}
            </div>
          )}
          <span style={{
            fontSize:Math.max(4.4, 5.2*s), fontWeight:700, letterSpacing:0.75*s,
            color:p.soft, textTransform:'uppercase', whiteSpace:'nowrap',
            overflow:'hidden', textOverflow:'ellipsis',
          }}>{orgName || 'PHOTOBOOTH'}</span>
        </div>
      </div>}

      <div style={{ flex:1, position:'relative', minHeight:0 }}>
        {template.slotLayout.map((slot, i)=>(
          <div key={i} style={{
            position:'absolute',
            left:`${slot.x}%`, top:`${slot.y}%`,
            width:`${slot.w}%`, height:`${slot.h}%`,
            overflow:'hidden',
            borderRadius:Math.round(2 * s),
            background: darkCard ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.055)',
            border: darkCard ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)',
          }}>
            {displayPhotos[i]
              ? <img src={displayPhotos[i]} alt="" draggable={false} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', filter }} />
              : <Placeholder s={s} ink={p.soft} />}
            {showSlotNumbers && (
              <span style={{
                position:'absolute', top:Math.round(4*s), left:Math.round(4*s),
                background:'rgba(0,0,0,0.6)', color:'#fff',
                fontSize:Math.max(4.5, 5.5*s), fontWeight:800,
                padding:`${Math.round(1.5*s)}px ${Math.round(4*s)}px`, borderRadius:Math.round(3*s),
              }}>{String(i+1).padStart(2,'0')}</span>
            )}
          </div>
        ))}

        {ornament !== 'none' && ornament === 'hearts' && <Ornament s={s} color={p.accent} kind="hearts" />}
        {ornament !== 'none' && ornament === 'stars' && <Ornament s={s} color={p.accent} kind="stars" />}
        {ornament !== 'none' && ornament === 'confetti' && <Ornament s={s} color={p.accent2} kind="confetti" />}
        {ornament !== 'none' && ornament === 'bubbles' && <Ornament s={s} color={p.accent} kind="bubbles" />}

        {stickers.map(st=>{
          const isSelected = selectedId === st.id
          const isDragging = dragId === st.id
          return (
            <span
              key={st.id}
              onPointerDown={(e)=> beginDrag(e, st)}
              onClick={(e)=> { e.stopPropagation(); setSelectedId(st.id)}}
              style={{
                position:'absolute', left:`${st.x}%`, top:`${st.y}%`,
                fontSize:(st.size || 20) * s,
                transform:`translate(-50%,-50%) rotate(${st.rotation || 0}deg)`,
                lineHeight:1,
                cursor: onStickersChange ? (isDragging ? 'grabbing' : 'grab') : 'default',
                filter: isSelected ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.55)) drop-shadow(0 0 0 rgba(139,92,246,0.6))' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.45))',
                transition: isDragging ? 'none' : 'transform 0.12s ease',
                padding: isSelected ? `${2*s}px` : 0,
                borderRadius: 6,
                boxShadow: isSelected ? `0 0 0 ${Math.max(1, s*1.2)}px rgba(139,92,246,0.9)` : 'none',
                background: isSelected ? 'rgba(139,92,246,0.08)' : 'transparent',
                touchAction:'none',
                zIndex: isSelected ? 10 : 2,
              }}
            >{st.emoji}</span>
          )
        })}
      </div>

      {!compact && <div style={{
        paddingTop:Math.round(8*s), paddingBottom:Math.round(6*s),
        textAlign:'center',
        fontFamily: template.serif ? "'Fraunces', Georgia, serif" : 'inherit',
        fontSize: Math.max(7.5, (template.serif ? 12.5 : 10.5) * s),
        fontWeight: template.serif ? 700 : 800,
        letterSpacing: template.serif ? -0.15*s : 0.9*s,
        textTransform: template.serif ? 'none' : 'uppercase',
        lineHeight:1.15,
        color:p.ink,
        overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
      }}>{title}</div>}

      <div style={{
        borderRadius:Math.round(2.5*s),
        padding:`${Math.round(4*s)}px ${Math.round(7*s)}px`,
        background: p.band === 'gradient'
          ? `linear-gradient(90deg, ${p.accent}, ${p.accent2})`
          : p.accent,
        color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:Math.round(6*s),
      }}>
        <span style={{ fontSize:Math.max(4.2, 5.1*s), fontWeight:800, letterSpacing:0.85*s, whiteSpace:'nowrap' }}>
          {(orgName || 'HAPPYPIX').toUpperCase().slice(0, 22)}
        </span>
        {!compact && <span style={{
          fontSize:Math.max(4.2, 5.1*s), fontWeight:700, letterSpacing:0.85*s,
          opacity:0.92, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        }}>{template.accentStrip}</span>}
      </div>
    </div>
  )
}

function LogoBars({ s, color }){
  return (
    <span style={{ display:'inline-flex', alignItems:'flex-end', gap:1.2*s, height:Math.round(9*s) }}>
      {[0.55, 1, 0.7].map((v,i)=>(
        <span key={i} style={{ width:1.6*s, height:9*s*v, background:color, borderRadius:1*s, opacity:0.95 }} />
      ))}
    </span>
  )
}

function Placeholder({ s, ink }){
  return (
    <div style={{ width:'100%', height:'100%', display:'grid', placeItems:'center' }}>
      <svg width={18*s} height={18*s} viewBox="0 0 24 24" fill="none" style={{ opacity:0.35 }}>
        <circle cx="12" cy="12" r="8.4" stroke={ink} strokeWidth="1.4" />
        <circle cx="12" cy="12" r="3" stroke={ink} strokeWidth="1.4" />
      </svg>
    </div>
  )
}

function Ornament({ s, color, kind }){
  const base = { position:'absolute', pointerEvents:'none', color, opacity:0.72 }
  if(kind === 'hearts') return (
    <>
      <span style={{ ...base, top:4*s, right:7*s, fontSize:11*s, lineHeight:1 }}>♡</span>
      <span style={{ ...base, bottom:6*s, left:7*s, fontSize:9*s, opacity:0.55, lineHeight:1 }}>♥</span>
      <span style={{ ...base, top:18*s, right:18*s, fontSize:7*s, opacity:0.45 }}>♡</span>
    </>
  )
  if(kind === 'stars') return (
    <>
      <span style={{ ...base, top:3*s, left:6*s, fontSize:11*s, lineHeight:1 }}>✦</span>
      <span style={{ ...base, bottom:7*s, right:9*s, fontSize:9*s, opacity:0.6, lineHeight:1 }}>✧</span>
      <span style={{ ...base, top:14*s, right:10*s, fontSize:6*s, opacity:0.5 }}>✦</span>
    </>
  )
  if(kind === 'bubbles') return (
    <>
      <span style={{ ...base, top:5*s, right:9*s, width:7*s, height:7*s, border:`1.2px solid ${color}`, borderRadius:999, opacity:0.65, display:'block' }} />
      <span style={{ ...base, bottom:9*s, left:10*s, width:5*s, height:5*s, border:`1.2px solid ${color}`, borderRadius:999, opacity:0.55, display:'block' }} />
      <span style={{ ...base, top:22*s, left:12*s, width:3.5*s, height:3.5*s, border:`1px solid ${color}`, borderRadius:999, opacity:0.5, display:'block' }} />
    </>
  )
  // confetti
  return (
    <>
      <span style={{ ...base, top:4*s, left:7*s, width:4*s, height:4*s, background:color, borderRadius:1.2*s, opacity:0.75, display:'block', transform:'rotate(14deg)' }} />
      <span style={{ ...base, bottom:7*s, right:8*s, width:3.2*s, height:3.2*s, background:color, borderRadius:1.2*s, opacity:0.65, display:'block', transform:'rotate(-8deg)' }} />
      <span style={{ ...base, bottom:15*s, right:15*s, width:2.6*s, height:2.6*s, background:color, borderRadius:1*s, opacity:0.55, display:'block' }} />
      <span style={{ ...base, top:16*s, left:14*s, width:2.2*s, height:2.2*s, background:color, borderRadius:1*s, opacity:0.5, display:'block' }} />
    </>
  )
}

function isDark(hex){
  if(!hex || hex[0] !== '#') return false
  const n = hex.length === 4
    ? hex.slice(1).split('').map(c=>parseInt(c + c, 16))
    : [parseInt(hex.slice(1,3), 16), parseInt(hex.slice(3,5), 16), parseInt(hex.slice(5,7), 16)]
  const [r,g,b] = n
  return (0.2126*r + 0.7152*g + 0.0722*b) < 90
}

function getFilterStyle(id){
  switch(id){
    case 'bw': return 'grayscale(1) contrast(1.15) brightness(0.98)'
    case 'warm': return 'sepia(0.36) saturate(1.32) hue-rotate(-9deg) brightness(1.06) contrast(1.02)'
    case 'cool': return 'saturate(1.16) hue-rotate(12deg) brightness(1.05) contrast(1.05) sepia(0.05)'
    case 'vintage': return 'sepia(0.58) contrast(1.1) brightness(0.96) saturate(1.2) hue-rotate(-3deg)'
    case 'soft': return 'saturate(1.08) brightness(1.09) contrast(0.93) sepia(0.12) blur(0px)'
    case 'party': return 'saturate(1.62) contrast(1.14) brightness(1.05) hue-rotate(-2deg)'
    default: return 'none'
  }
}
