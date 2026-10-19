import React from 'react'

// Web replica of the booth's print template renderer.
// Draws the card chrome (brand row, photo slots, caption, accent band)
// and composes captured photos or the event's sample frames.
export default function TemplateCanvas({
  template,
  photos = [],
  width,
  height,
  maxWidth,
  filterId = 'original',
  stickers = [],
  subtitle,
  orgName = '',
  orgLogo = null,
  eventName = '',
  showSlotNumbers = false,
  decor,
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
  const ornament = decor || template.decor

  return (
    <div style={{
      width:w, height:h,
      background:p.bg,
      borderRadius:Math.round(4 * s),
      padding:pad,
      display:'flex', flexDirection:'column',
      position:'relative', overflow:'hidden',
      boxShadow:'0 14px 34px rgba(0,0,0,0.45)',
      border: darkCard ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
      color:p.ink,
    }}>
      {/* brand row */}
      {!compact && <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:Math.round(6*s), paddingBottom:Math.round(7*s) }}>
        <div style={{ display:'flex', alignItems:'center', gap:Math.round(5*s), minWidth:0 }}>
          {orgLogo
            ? <img src={orgLogo} alt="" style={{ height:Math.round(13*s), maxWidth:Math.round(34*s), objectFit:'contain' }} />
            : <LogoBars s={s} color={p.accent} />}
          <span style={{ fontSize:Math.max(4.6, 5.6*s), fontWeight:800, letterSpacing:1.07*s, color:p.accent, whiteSpace:'nowrap' }}>HAPPYPIX</span>
        </div>
        <span style={{
          fontSize:Math.max(4.4, 5.2*s), fontWeight:700, letterSpacing:0.75*s,
          color:p.soft, textTransform:'uppercase', whiteSpace:'nowrap',
          overflow:'hidden', textOverflow:'ellipsis', maxWidth:'58%',
        }}>{orgName || 'PHOTOBOOTH'}</span>
      </div>}

      {/* photos */}
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

        {/* ornaments */}
        {ornament === 'hearts' && <Ornament s={s} color={p.accent} kind="hearts" />}
        {ornament === 'stars' && <Ornament s={s} color={p.accent} kind="stars" />}
        {ornament === 'confetti' && <Ornament s={s} color={p.accent2} kind="confetti" />}
        {ornament === 'bubbles' && <Ornament s={s} color={p.accent} kind="bubbles" />}

        {stickers.map(st=>(
          <span key={st.id} style={{
            position:'absolute', left:`${st.x}%`, top:`${st.y}%`,
            fontSize:(st.size || 20) * s,
            transform:`rotate(${st.rotation || 0}deg)`,
            pointerEvents:'none', lineHeight:1,
            filter:'drop-shadow(0 2px 3px rgba(0,0,0,0.45))',
          }}>{st.emoji}</span>
        ))}
      </div>

      {/* event caption */}
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

      {/* accent band */}
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
  const base = { position:'absolute', pointerEvents:'none', color, opacity:0.5 }
  if(kind === 'hearts') return (
    <>
      <span style={{ ...base, top:5*s, right:7*s, fontSize:9*s }}>♡</span>
      <span style={{ ...base, bottom:7*s, left:7*s, fontSize:6.5*s, opacity:0.35 }}>♡</span>
    </>
  )
  if(kind === 'stars') return (
    <>
      <span style={{ ...base, top:4*s, left:6*s, fontSize:8*s }}>✦</span>
      <span style={{ ...base, bottom:8*s, right:8*s, fontSize:6.5*s, opacity:0.35 }}>✧</span>
    </>
  )
  if(kind === 'bubbles') return (
    <>
      <span style={{ ...base, top:6*s, right:9*s, width:5*s, height:5*s, border:`1px solid ${color}`, borderRadius:999, opacity:0.45 }} />
      <span style={{ ...base, bottom:9*s, left:8*s, width:3.5*s, height:3.5*s, border:`1px solid ${color}`, borderRadius:999, opacity:0.4 }} />
    </>
  )
  return (
    <>
      <span style={{ ...base, top:5*s, left:6*s, width:3*s, height:3*s, background:color, borderRadius:1*s, opacity:0.55 }} />
      <span style={{ ...base, bottom:8*s, right:7*s, width:2.4*s, height:2.4*s, background:color, borderRadius:1*s, opacity:0.45 }} />
      <span style={{ ...base, bottom:14*s, right:14*s, width:1.8*s, height:1.8*s, background:color, borderRadius:1*s, opacity:0.4 }} />
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
    case 'bw': return 'grayscale(1) contrast(1.12)'
    case 'warm': return 'sepia(0.32) saturate(1.28) hue-rotate(-8deg) brightness(1.04)'
    case 'cool': return 'saturate(1.18) hue-rotate(10deg) brightness(1.04) contrast(1.04)'
    case 'vintage': return 'sepia(0.55) contrast(1.08) brightness(0.98) saturate(1.18)'
    case 'soft': return 'saturate(1.1) brightness(1.07) contrast(0.94) sepia(0.1)'
    case 'party': return 'saturate(1.55) contrast(1.12) brightness(1.03)'
    default: return 'none'
  }
}
