// Templates grouped by event type. Each category has ~6 templates in both orientations & multiple sizes.
// We replicate the booth's PrintTemplate layout concept for web preview.

export const EVENT_TYPES = [
  { id: 'party', label: 'Party & Celebration', emoji: '🎉', color: '#f59e0b' },
  { id: 'formal', label: 'Formal & Elegant', emoji: '🎩', color: '#475569' },
  { id: 'wedding', label: 'Wedding', emoji: '💍', color: '#ec4899' },
  { id: 'birthday', label: 'Birthday', emoji: '🎂', color: '#8b5cf6' },
  { id: 'corporate', label: 'Corporate & Brand', emoji: '🏢', color: '#0ea5e9' },
  { id: 'cinema', label: 'Cinema & Red Carpet', emoji: '🎬', color: '#ef4444' },
  { id: 'festival', label: 'Festival & Cultural', emoji: '🎭', color: '#22c55e' },
  { id: 'kids', label: 'Kids & Family', emoji: '🧒', color: '#06b6d4' },
  { id: 'cinema2', label: 'Glam / Fashion', emoji: '✨', color: '#a855f7' },
]

// helper to generate template obj
function t({ id, name, category, orientation, printSize, slots, price, gradient, accentStrip, decor, sample }) {
  const canvas = orientation === 'portrait' ? { w: 300, h: 450 } : { w: 460, h: 300 }
  if (printSize === '2x6' || printSize === '2x6_strip') {
    canvas.w = orientation === 'portrait' ? 220 : 520
    canvas.h = orientation === 'portrait' ? 520 : 220
  }
  return {
    id, name, category, orientation, printSize, slots, price,
    gradient, accentStrip, decor, sample,
    canvas,
    // slot positions as relative [x,y,w,h] in %
    slotLayout: buildSlots(slots, orientation, printSize),
  }
}
function buildSlots(count, orientation, size) {
  // create evenly spaced slot boxes similar to real booth
  if (size === '2x6_strip' || size === '2x6') {
    // 2x6 strip : slots stacked vertically in portrait or horizontally in landscape
    if (orientation === 'portrait') {
      const h = 88 / count
      return Array.from({length:count}, (_,i)=>({ x:6, y:6 + i*(h+2), w:88, h:h-1 }))
    } else {
      const w = 88 / count
      return Array.from({length:count}, (_,i)=>({ x:6 + i*(w+2), y:12, w:w-1, h:72 }))
    }
  }
  if (orientation === 'portrait') {
    if (count === 1) return [{ x:6, y:6, w:88, h:72 }]
    if (count === 2) return [{ x:6, y:6, w:88, h:35 }, { x:6, y:43, w:88, h:35 }]
    if (count === 3) return [{ x:6, y:6, w:88, h:23 }, { x:6, y:31, w:88, h:23 }, { x:6, y:56, w:88, h:21 }]
    if (count === 4) return [{ x:6, y:6, w:42, h:35 }, { x:52, y:6, w:42, h:35 }, { x:6, y:43, w:42, h:35 }, { x:52, y:43, w:42, h:35 }]
  } else {
    if (count === 1) return [{ x:6, y:6, w:88, h:72 }]
    if (count === 2) return [{ x:6, y:6, w:43, h:68 }, { x:51, y:6, w:43, h:68 }]
    if (count === 3) return [{ x:5, y:8, w:28, h:66 }, { x:36, y:8, w:28, h:66 }, { x:67, y:8, w:28, h:66 }]
    if (count === 4) return [{ x:5, y:6, w:43, h:33 }, { x:52, y:6, w:43, h:33 }, { x:5, y:42, w:43, h:33 }, { x:52, y:42, w:43, h:33 }]
  }
  return Array.from({length:count}, (_,i)=>({ x:6, y:6 + i*18, w:88, h:16 }))
}

export const TEMPLATES = [
  // PARTY
  t({ id:'party-p-1', name:'Neon Bash', category:'party', orientation:'portrait', printSize:'4x6', slots:3, price:149, gradient:['#7c3aed','#ec4899'], accentStrip:'HAPPYPIX • LET\'S PARTY', decor:'confetti', sample:['https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=400&q=80','https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=400&q=80'] }),
  t({ id:'party-p-2', name:'Golden Hour', category:'party', orientation:'portrait', printSize:'6x8', slots:2, price:199, gradient:['#f59e0b','#f43f5e'], accentStrip:'CELEBRATE • SHINE • DANCE', decor:'stars', sample:[] }),
  t({ id:'party-p-3', name:'Midnight Strip', category:'party', orientation:'portrait', printSize:'2x6', slots:3, price:99, gradient:['#0f0f14','#27272a'], accentStrip:'PARTY MODE ON', decor:'bubbles', sample:[] }),
  t({ id:'party-l-1', name:'Disco Wide', category:'party', orientation:'landscape', printSize:'5x7', slots:3, price:179, gradient:['#db2777','#7c3aed'], accentStrip:'GOOD VIBES ONLY', decor:'confetti', sample:[] }),
  t({ id:'party-l-2', name:'Retro Wave', category:'party', orientation:'landscape', printSize:'4x6', slots:2, price:149, gradient:['#06b6d4','#8b5cf6'], accentStrip:'PARTY TIME', decor:'none', sample:[] }),
  t({ id:'party-l-3', name:'Carnival Strip', category:'party', orientation:'landscape', printSize:'2x6', slots:4, price:129, gradient:['#f97316','#ec4899'], accentStrip:'CARNIVAL', decor:'confetti', sample:[] }),

  // FORMAL
  t({ id:'formal-p-1', name:'Noir Elegance', category:'formal', orientation:'portrait', printSize:'5x7', slots:2, price:249, gradient:['#0f0f14','#1f1f2e'], accentStrip:'BLACK TIE • GRACE', decor:'none', sample:[] }),
  t({ id:'formal-p-2', name:'Champagne', category:'formal', orientation:'portrait', printSize:'4x6', slots:3, price:199, gradient:['#f8f0d8','#c9a86a'], accentStrip:'AN EVENING OF ELEGANCE', decor:'stars', sample:[] }),
  t({ id:'formal-p-3', name:'Velvet Strip', category:'formal', orientation:'portrait', printSize:'2x6', slots:3, price:149, gradient:['#2a1848','#6d28d9'], accentStrip:'FORMAL AFFAIR', decor:'none', sample:[] }),
  t({ id:'formal-l-1', name:'Gala Wide', category:'formal', orientation:'landscape', printSize:'6x8', slots:3, price:299, gradient:['#1e1b4b','#312e81'], accentStrip:'THE GRAND GALA', decor:'stars', sample:[] }),
  t({ id:'formal-l-2', name:'Pearl', category:'formal', orientation:'landscape', printSize:'4x6', slots:2, price:199, gradient:['#f1f5f9','#cbd5e1'], accentStrip:'TIMELESS', decor:'none', sample:[] }),

  // WEDDING
  t({ id:'wed-p-1', name:'Blush Vow', category:'wedding', orientation:'portrait', printSize:'4x6', slots:3, price:299, gradient:['#ffe4e6','#fda4af'], accentStrip:'FOREVER & ALWAYS', decor:'hearts', sample:[] }),
  t({ id:'wed-p-2', name:'Ivory Love', category:'wedding', orientation:'portrait', printSize:'5x7', slots:2, price:349, gradient:['#fffaf0','#e7c9a0'], accentStrip:'TWO HEARTS • ONE LOVE', decor:'hearts', sample:[] }),
  t({ id:'wed-p-3', name:'Love Strip', category:'wedding', orientation:'portrait', printSize:'2x6', slots:4, price:199, gradient:['#fce7f3','#f9a8d4'], accentStrip:'HAPPILY EVER AFTER', decor:'hearts', sample:[] }),
  t({ id:'wed-l-1', name:'Golden Vows Wide', category:'wedding', orientation:'landscape', printSize:'6x8', slots:3, price:399, gradient:['#fef3c7','#f59e0b'], accentStrip:'CELEBRATING LOVE', decor:'hearts', sample:[] }),
  t({ id:'wed-l-2', name:'Mehendi Bloom', category:'wedding', orientation:'landscape', printSize:'4x6', slots:2, price:249, gradient:['#dcfce7','#f97316'], accentStrip:'SHAADI CELEBRATION', decor:'confetti', sample:[] }),

  // BIRTHDAY
  t({ id:'bday-p-1', name:'Cake Smash', category:'birthday', orientation:'portrait', printSize:'4x6', slots:3, price:129, gradient:['#fde68a','#ec4899'], accentStrip:'HAPPY BIRTHDAY!', decor:'confetti', sample:[] }),
  t({ id:'bday-p-2', name:'Unicorn Magic', category:'birthday', orientation:'portrait', printSize:'5x7', slots:2, price:149, gradient:['#ede9fe','#fbcfe8'], accentStrip:'MAGICAL DAY', decor:'bubbles', sample:[] }),
  t({ id:'bday-p-3', name:'Birthday Strip', category:'birthday', orientation:'portrait', printSize:'2x6', slots:4, price:99, gradient:['#8b5cf6','#06b6d4'], accentStrip:'MAKE A WISH', decor:'confetti', sample:[] }),
  t({ id:'bday-l-1', name:'Balloon Blast Wide', category:'birthday', orientation:'landscape', printSize:'5x7', slots:3, price:159, gradient:['#fef08a','#facc15'], accentStrip:'PARTY LIKE IT\'S YOUR BIRTHDAY', decor:'bubbles', sample:[] }),
  t({ id:'bday-l-2', name:'Candy Pop', category:'birthday', orientation:'landscape', printSize:'4x6', slots:2, price:129, gradient:['#f9a8d4','#a78bfa'], accentStrip:'SWEET CELEBRATION', decor:'confetti', sample:[] }),

  // CORPORATE
  t({ id:'corp-p-1', name:'Brand Pro', category:'corporate', orientation:'portrait', printSize:'4x6', slots:2, price:99, gradient:['#0f172a','#1e40af'], accentStrip:'YOUR BRAND • YOUR EVENT', decor:'none', sample:[] }),
  t({ id:'corp-p-2', name:'Summit', category:'corporate', orientation:'portrait', printSize:'5x7', slots:3, price:129, gradient:['#f1f5f9','#0f172a'], accentStrip:'CORPORATE SUMMIT 2026', decor:'none', sample:[] }),
  t({ id:'corp-l-1', name:'Launch Wide', category:'corporate', orientation:'landscape', printSize:'6x8', slots:3, price:179, gradient:['#e0f2fe','#0ea5e9'], accentStrip:'PRODUCT LAUNCH', decor:'none', sample:[] }),
  t({ id:'corp-l-2', name:'Team Strip', category:'corporate', orientation:'landscape', printSize:'2x6', slots:3, price:99, gradient:['#1e293b','#475569'], accentStrip:'TEAM SPIRIT', decor:'none', sample:[] }),

  // CINEMA
  t({ id:'cin-p-1', name:'Red Carpet', category:'cinema', orientation:'portrait', printSize:'4x6', slots:3, price:199, gradient:['#1a0a0a','#dc2626'], accentStrip:'RED CARPET MOMENT', decor:'stars', sample:[] }),
  t({ id:'cin-p-2', name:'Spotlight', category:'cinema', orientation:'portrait', printSize:'5x7', slots:1, price:249, gradient:['#0f0f14','#facc15'], accentStrip:'STAR OF THE NIGHT', decor:'stars', sample:[] }),
  t({ id:'cin-l-1', name:'Premiere Wide', category:'cinema', orientation:'landscape', printSize:'6x8', slots:2, price:299, gradient:['#000000','#991b1b'], accentStrip:'PREMIERE NIGHT', decor:'none', sample:[] }),
  t({ id:'cin-l-2', name:'Film Strip', category:'cinema', orientation:'landscape', printSize:'2x6', slots:4, price:149, gradient:['#111827','#4b5563'], accentStrip:'CINEMA MAGIC', decor:'none', sample:[] }),

  // FESTIVAL
  t({ id:'fest-p-1', name:'Holi Splash', category:'festival', orientation:'portrait', printSize:'4x6', slots:3, price:99, gradient:['#f97316','#8b5cf6'], accentStrip:'RANG BARSE', decor:'confetti', sample:[] }),
  t({ id:'fest-p-2', name:'Diwali Glow', category:'festival', orientation:'portrait', printSize:'5x7', slots:2, price:129, gradient:['#fef08a','#f59e0b'], accentStrip:'SHUBH DEEPAWALI', decor:'stars', sample:[] }),
  t({ id:'fest-l-1', name:'Navratri Wide', category:'festival', orientation:'landscape', printSize:'6x8', slots:3, price:149, gradient:['#dc2626','#facc15'], accentStrip:'GARBA NIGHTS', decor:'confetti', sample:[] }),

  // KIDS
  t({ id:'kids-p-1', name:'Jungle Fun', category:'kids', orientation:'portrait', printSize:'4x6', slots:3, price:99, gradient:['#22c55e','#15803d'], accentStrip:'WILD ADVENTURE', decor:'bubbles', sample:[] }),
  t({ id:'kids-p-2', name:'Space Cadet', category:'kids', orientation:'portrait', printSize:'5x7', slots:2, price:109, gradient:['#1e1b4b','#06b6d4'], accentStrip:'TO THE STARS!', decor:'stars', sample:[] }),
  t({ id:'kids-l-1', name:'Carnival Kids Wide', category:'kids', orientation:'landscape', printSize:'4x6', slots:2, price:99, gradient:['#fde047','#f97316'], accentStrip:'FUN ZONE', decor:'bubbles', sample:[] }),
]

export const FILTERS = [
  { id:'original', label:'Natural', color:'#a1a1aa', desc:'True natural tones' },
  { id:'warm', label:'Warm Sun', color:'#f59e0b', desc:'Golden amber glow' },
  { id:'cool', label:'Cool Breeze', color:'#0ea5e9', desc:'Fresh oceanic blues' },
  { id:'bw', label:'Classic B&W', color:'#3f3f46', desc:'High-contrast monochrome' },
  { id:'vintage', label:'Vintage Film', color:'#b45309', desc:'Warm retro sepia' },
  { id:'soft', label:'Soft Dream', color:'#f472b6', desc:'Dreamy pastel glow' },
  { id:'party', label:'Party Pop', color:'#ec4899', desc:'Vibrant punchy colors' },
]

export const STICKERS = ['❤️','✨','🎉','📸','👑','🦋','🌸','🥳','💍','🥂','🔥','⭐','🎈','🌟','💖','🎊']
