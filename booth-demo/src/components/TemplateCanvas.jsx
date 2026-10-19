import React from 'react'

// Web replica of TemplateCanvas — renders template with slots + decor
export default function TemplateCanvas({ template, photos=[], width=260, filterId='original', stickers=[], subtitle, orgName }){
  if(!template) return null
  const aspect = template.canvas.w / template.canvas.h
  const w = width
  const h = Math.round(w / aspect)
  const filterStyle = getFilterStyle(filterId)
  const showPhotos = photos.length>0

  return (
    <div style={{ width:w, height:h, background:'#fff', borderRadius:12, overflow:'hidden', position:'relative', padding:6, display:'flex', flexDirection:'column', gap:4, boxShadow:'0 12px 32px rgba(0,0,0,0.45)' }}>
      {/* gradient header accent */}
      <div style={{ position:'absolute', inset:0, background:`linear-gradient(135deg, ${template.gradient[0]}, ${template.gradient[1]})`, opacity:0.12, pointerEvents:'none' }}/>
      {/* slots */}
      <div style={{ flex:1, display:'relative', width:'100%', height:'100%', position:'relative' }}>
        {template.slotLayout.map((slot, i)=>{
          const photo = showPhotos ? (photos[i % photos.length]) : null
          // photo may be string url or object with uri
          const src = typeof photo === 'string' ? photo : photo?.uri || photo?.url
          return (
            <div key={i} style={{
              position:'absolute',
              left:`${slot.x}%`, top:`${slot.y}%`, width:`${slot.w}%`, height:`${slot.h}%`,
              background:'#11111a', borderRadius:6, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
              border:'1px solid #e5e7eb',
              filter: filterStyle,
            }}>
              {src ? <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false} /> : (
                <span style={{ fontSize:20, opacity:0.25 }}>📸</span>
              )}
              {/* slot number badge */}
              <span style={{ position:'absolute', top:4, left:4, background:'rgba(0,0,0,0.65)', color:'#fff', fontSize:7, fontWeight:800, padding:'2px 5px', borderRadius:6 }}>{String(i+1).padStart(2,'0')}</span>
              {/* stickers overlay for this slot area approximated */}
            </div>
          )
        })}
        {/* floating stickers overlay */}
        {stickers.map(s=>(
          <span key={s.id} style={{ position:'absolute', left:`${s.x}%`, top:`${s.y}%`, fontSize: s.size||20, transform:`rotate(${s.rotation||0}deg)`, pointerEvents:'none', filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>{s.emoji}</span>
        ))}
        {/* decor dots */}
        {template.decor==='hearts' && <span style={{position:'absolute', right:8, top:8, fontSize:10, opacity:0.5}}>♡ ♡</span>}
        {template.decor==='stars' && <span style={{position:'absolute', right:8, top:6, fontSize:10, opacity:0.4}}>✦ ✧</span>}
      </div>
      {/* footer strip */}
      <div style={{ background:`linear-gradient(90deg, ${template.gradient[0]}, ${template.gradient[1]})`, borderRadius:8, padding:'6px 8px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', flexDirection:'column' }}>
          <span style={{ color:'#fff', fontSize:7, fontWeight:900, letterSpacing:1.4, lineHeight:1 }}>HAPPYPIX</span>
          <span style={{ color:'rgba(255,255,255,0.9)', fontSize:6, fontWeight:700, letterSpacing:0.6 }}>{(orgName||'HAPPYPIX DEMO').toUpperCase()}</span>
        </div>
        <span style={{ color:'#fff', fontSize:6, fontWeight:800, letterSpacing:0.5, opacity:0.95, textAlign:'right', maxWidth:110 }}>{subtitle || template.accentStrip}</span>
      </div>
    </div>
  )
}
function getFilterStyle(id){
  switch(id){
    case 'bw': return 'grayscale(1) contrast(1.15)'
    case 'warm': return 'sepia(0.35) saturate(1.3) hue-rotate(-8deg) brightness(1.05)'
    case 'cool': return 'saturate(1.2) hue-rotate(12deg) brightness(1.05) contrast(1.05)'
    case 'vintage': return 'sepia(0.6) contrast(1.1) brightness(0.98) saturate(1.2)'
    case 'soft': return 'saturate(1.15) brightness(1.08) contrast(0.95) sepia(0.12)'
    case 'party': return 'saturate(1.6) contrast(1.15) brightness(1.05)'
    default: return 'none'
  }
}
