// ─────────────────────────────────────────────────────────────
// Template catalogue for the booth demo.
// Every event type gets its own art direction: palette, print
// styles, sizes and shot counts — in both orientations.
// ─────────────────────────────────────────────────────────────

export const EVENT_TYPES = [
  { id: 'party', label: 'Party & Celebration', short: 'Party', color: '#f59e0b' },
  { id: 'formal', label: 'Formal & Gala', short: 'Formal', color: '#94a3b8' },
  { id: 'wedding', label: 'Wedding', short: 'Wedding', color: '#f9a8d4' },
  { id: 'birthday', label: 'Birthday', short: 'Birthday', color: '#8b5cf6' },
  { id: 'corporate', label: 'Corporate & Brand', short: 'Corporate', color: '#38bdf8' },
  { id: 'cinema', label: 'Cinema & Premiere', short: 'Cinema', color: '#ef4444' },
  { id: 'festival', label: 'Festival & Cultural', short: 'Festival', color: '#f97316' },
  { id: 'kids', label: 'Kids & Family', short: 'Kids', color: '#22c55e' },
  { id: 'cinema2', label: 'Glam & Fashion', short: 'Glam', color: '#c084fc' },
]

// Local sample frames per event type (used for previews + demo capture)
export const EVENT_SAMPLES = {
  party: ['/samples/party.jpg', '/samples/festival.jpg', '/samples/birthday.jpg'],
  formal: ['/samples/formal.jpg', '/samples/glam.jpg', '/samples/cinema.jpg'],
  wedding: ['/samples/wedding.jpg', '/samples/formal.jpg', '/samples/glam.jpg'],
  birthday: ['/samples/birthday.jpg', '/samples/kids.jpg', '/samples/party.jpg'],
  corporate: ['/samples/corporate.jpg', '/samples/formal.jpg', '/samples/party.jpg'],
  cinema: ['/samples/cinema.jpg', '/samples/glam.jpg', '/samples/formal.jpg'],
  festival: ['/samples/festival.jpg', '/samples/party.jpg', '/samples/birthday.jpg'],
  kids: ['/samples/kids.jpg', '/samples/birthday.jpg', '/samples/party.jpg'],
  cinema2: ['/samples/glam.jpg', '/samples/cinema.jpg', '/samples/formal.jpg'],
}

export const EVENT_TAGLINES = {
  party: 'Good times, good people, one frame.',
  formal: 'An evening worth remembering.',
  wedding: 'Two hearts, one beautiful beginning.',
  birthday: 'Another year, another reason to celebrate.',
  corporate: 'People first. Moments that matter.',
  cinema: 'Lights. Camera. Memories.',
  festival: 'Colour, laughter and a little magic.',
  kids: 'Small hands, big memories.',
  cinema2: 'Own the frame.',
}

export const EVENT_COPY = {
  party: 'Neon, confetti and full-energy frames',
  formal: 'Understated sets for black-tie evenings',
  wedding: 'Soft palettes for the big day',
  birthday: 'Bold, playful and full of colour',
  corporate: 'Clean, brand-first layouts',
  cinema: 'Red-carpet, premiere styling',
  festival: 'Colour-drenched cultural frames',
  kids: 'Bright, playful and family friendly',
  cinema2: 'High-fashion editorial frames',
}

// Print paper aspect ratios (w:h)
const PAPER = {
  '4x6': 4 / 6,
  '5x7': 5 / 7,
  '6x8': 6 / 8,
  '2x6': 2 / 6,
}

const PALETTES = {
  noir:      { bg: '#101014', ink: '#f7f5f1', soft: '#9d9aa6', accent: '#c9a86a', accent2: '#8a6f3d', band: 'solid' },
  champagne: { bg: '#f7efe2', ink: '#2c2418', soft: '#8a7a63', accent: '#b98d4b', accent2: '#7d5a2a', band: 'solid' },
  ivory:     { bg: '#fbf8f2', ink: '#211d18', soft: '#8b8378', accent: '#c2703f', accent2: '#8b4a24', band: 'solid' },
  blush:     { bg: '#fdf0ee', ink: '#3a2126', soft: '#a3838a', accent: '#d98a94', accent2: '#b05f6c', band: 'solid' },
  sage:      { bg: '#f2f5ee', ink: '#222a21', soft: '#7c8a79', accent: '#7f9c74', accent2: '#4f6a48', band: 'solid' },
  paper:     { bg: '#ffffff', ink: '#16161a', soft: '#8e8e96', accent: '#8b5cf6', accent2: '#ec4899', band: 'gradient' },
  party:     { bg: '#0d0b14', ink: '#ffffff', soft: '#9a94b3', accent: '#8b5cf6', accent2: '#ec4899', band: 'gradient' },
  sunset:    { bg: '#fff6ec', ink: '#2b1b12', soft: '#9b7c63', accent: '#f08a3c', accent2: '#e2557a', band: 'gradient' },
  mint:      { bg: '#f0fbf6', ink: '#132a22', soft: '#6c8b80', accent: '#34b58b', accent2: '#14806a', band: 'solid' },
  sky:       { bg: '#f0f7ff', ink: '#122031', soft: '#72859a', accent: '#2f7fd4', accent2: '#1d4f8c', band: 'solid' },
  slate:     { bg: '#111820', ink: '#f4f7fb', soft: '#8b9cae', accent: '#38bdf8', accent2: '#1d4ed8', band: 'solid' },
  crimson:   { bg: '#120b0b', ink: '#fdf6f4', soft: '#b09a98', accent: '#e11d48', accent2: '#7f1027', band: 'solid' },
  gold:      { bg: '#0c0b0a', ink: '#f5eddd', soft: '#a2937a', accent: '#e0bd78', accent2: '#9c7a35', band: 'solid' },
  marigold:  { bg: '#fff7e8', ink: '#2b1d0a', soft: '#9c7f4b', accent: '#f09819', accent2: '#d0451b', band: 'gradient' },
  violet:    { bg: '#f6f2ff', ink: '#201735', soft: '#8478a3', accent: '#7c5cf0', accent2: '#b23fd6', band: 'gradient' },
  candy:     { bg: '#fff4f8', ink: '#2b1420', soft: '#a17a8b', accent: '#f472b6', accent2: '#8b5cf6', band: 'gradient' },
  playground:{ bg: '#fffdf2', ink: '#22200e', soft: '#968f6d', accent: '#f7c948', accent2: '#e2673f', band: 'solid' },
  editorial: { bg: '#0b0b0d', ink: '#fafafa', soft: '#9a9aa2', accent: '#d4d4d8', accent2: '#71717a', band: 'solid' },
  plum:      { bg: '#180f22', ink: '#fdf6ff', soft: '#a998b8', accent: '#c084fc', accent2: '#7e22ce', band: 'solid' },
}

function slots(count, orientation, strip){
  const gap = 2.4
  if (orientation === 'portrait'){
    if (count === 1) return [{ x:0, y:0, w:100, h:100 }]
    if (count === 2) return [
      { x:0, y:0, w:100, h:(100-gap)/2 },
      { x:0, y:(100+gap)/2, w:100, h:(100-gap)/2 },
    ]
    if (count === 3) return [
      { x:0, y:0, w:100, h:(100-gap*2)/3 },
      { x:0, y:(100+gap)/3, w:100, h:(100-gap*2)/3 },
      { x:0, y:(200+gap*2)/3, w:100, h:(100-gap*2)/3 },
    ]
    const h = (100-gap)/2
    return [
      { x:0, y:0, w:(100-gap)/2, h },
      { x:(100+gap)/2, y:0, w:(100-gap)/2, h },
      { x:0, y:(100+gap)/2, w:(100-gap)/2, h },
      { x:(100+gap)/2, y:(100+gap)/2, w:(100-gap)/2, h },
    ]
  }
  if (count === 1) return [{ x:0, y:0, w:100, h:100 }]
  if (count === 2) return [
    { x:0, y:0, w:(100-gap)/2, h:100 },
    { x:(100+gap)/2, y:0, w:(100-gap)/2, h:100 },
  ]
  if (count === 3) {
    const w = (100-gap*2)/3
    return [
      { x:0, y:0, w, h:100 },
      { x:(100+gap)/3, y:0, w, h:100 },
      { x:(200+gap*2)/3, y:0, w, h:100 },
    ]
  }
  const w = (100-gap)/2, h = (100-gap)/2
  return [
    { x:0, y:0, w, h },
    { x:(100+gap)/2, y:0, w, h },
    { x:0, y:(100+gap)/2, w, h },
    { x:(100+gap)/2, y:(100+gap)/2, w, h },
  ]
}

function make({ id, name, category, orientation, printSize, count, price, palette, accentStrip, decor='none', serif=false }){
  const ratio = PAPER[printSize]
  let canvas
  if(printSize === '2x6'){
    // a 2×6 strip is 1:3 — it turns with the format
    canvas = orientation === 'portrait' ? { w: 1000, h: 3000 } : { w: 3000, h: 1000 }
  } else {
    // portrait keeps w/h = paper ratio; landscape flips it
    canvas = orientation === 'portrait'
      ? { w: Math.round(ratio * 1000), h: 1000 }
      : { w: 1000, h: Math.round(ratio * 1000) }
  }
  return {
    id, name, category, orientation, printSize,
    slots: count,
    price,
    palette,
    accentStrip,
    decor,
    serif,
    canvas,
    // kept for older call sites
    gradient: [palette.accent, palette.accent2],
    slotLayout: slots(count, orientation, printSize === '2x6'),
  }
}

const DESIGNS = {
  party: [
    { name:'Neon Nights',    orientation:'portrait',  printSize:'4x6', count:3, price:149, palette:'party',     accentStrip:'GOOD VIBES ONLY', decor:'confetti' },
    { name:'Glitter Hour',   orientation:'portrait',  printSize:'6x8', count:2, price:199, palette:'sunset',    accentStrip:'CELEBRATE EVERYTHING', decor:'confetti', serif:true },
    { name:'After Party',    orientation:'portrait',  printSize:'5x7', count:4, price:229, palette:'noir',      accentStrip:'DANCE ALL NIGHT', decor:'stars' },
    { name:'Confetti Strip', orientation:'portrait',  printSize:'2x6', count:3, price:99,  palette:'paper',     accentStrip:'LET’S PARTY', decor:'confetti' },
    { name:'Club Light',     orientation:'portrait',  printSize:'2x6', count:4, price:119, palette:'plum',      accentStrip:'PARTY MODE ON', decor:'stars' },
    { name:'Disco Wide',     orientation:'landscape', printSize:'5x7', count:3, price:179, palette:'party',     accentStrip:'THE NIGHT IS YOUNG', decor:'confetti' },
    { name:'Retro Wave',     orientation:'landscape', printSize:'4x6', count:2, price:149, palette:'sunset',    accentStrip:'PARTY TIME', decor:'none' },
    { name:'Carnival Strip', orientation:'landscape', printSize:'2x6', count:4, price:129, palette:'violet',    accentStrip:'CARNIVAL NIGHTS', decor:'confetti' },
    { name:'Midnight Grid',  orientation:'landscape', printSize:'6x8', count:4, price:249, palette:'noir',      accentStrip:'STAY OUT LATE', decor:'stars' },
  ],
  formal: [
    { name:'Black Tie',      orientation:'portrait',  printSize:'4x6', count:2, price:249, palette:'noir',      accentStrip:'BLACK TIE AFFAIR', decor:'none', serif:true },
    { name:'Champagne',      orientation:'portrait',  printSize:'5x7', count:3, price:219, palette:'champagne', accentStrip:'AN EVENING OF ELEGANCE', decor:'none', serif:true },
    { name:'Ivory Invitation',orientation:'portrait', printSize:'6x8', count:1, price:279, palette:'ivory',     accentStrip:'THE GRAND GALA', decor:'none', serif:true },
    { name:'Velvet Strip',   orientation:'portrait',  printSize:'2x6', count:3, price:149, palette:'noir',      accentStrip:'FORMAL AFFAIR', decor:'none' },
    { name:'Gilded',         orientation:'portrait',  printSize:'2x6', count:4, price:169, palette:'gold',      accentStrip:'GOLDEN HOUR', decor:'none' },
    { name:'Gala Wide',      orientation:'landscape', printSize:'6x8', count:3, price:299, palette:'noir',      accentStrip:'THE GRAND GALA', decor:'none', serif:true },
    { name:'Pearl',          orientation:'landscape', printSize:'4x6', count:2, price:199, palette:'ivory',     accentStrip:'TIMELESS MOMENTS', decor:'none', serif:true },
    { name:'Salon Grid',     orientation:'landscape', printSize:'5x7', count:4, price:239, palette:'champagne', accentStrip:'A NIGHT TO REMEMBER', decor:'none' },
    { name:'Onyx Strip',     orientation:'landscape', printSize:'2x6', count:3, price:139, palette:'editorial', accentStrip:'AFTER DARK', decor:'none' },
  ],
  wedding: [
    { name:'Blush Vow',      orientation:'portrait',  printSize:'4x6', count:3, price:299, palette:'blush',     accentStrip:'FOREVER & ALWAYS', decor:'hearts', serif:true },
    { name:'Ivory Love',     orientation:'portrait',  printSize:'5x7', count:2, price:349, palette:'ivory',     accentStrip:'TWO HEARTS, ONE LOVE', decor:'hearts', serif:true },
    { name:'Happily Ever',   orientation:'portrait',  printSize:'2x6', count:4, price:199, palette:'blush',     accentStrip:'HAPPILY EVER AFTER', decor:'hearts', serif:true },
    { name:'Sage Ceremony',  orientation:'portrait',  printSize:'6x8', count:1, price:329, palette:'sage',      accentStrip:'THE PHERAS', decor:'none', serif:true },
    { name:'Mehendi',        orientation:'portrait',  printSize:'2x6', count:3, price:179, palette:'marigold',  accentStrip:'MEHENDI NIGHT', decor:'confetti' },
    { name:'Golden Vows',    orientation:'landscape', printSize:'6x8', count:3, price:399, palette:'champagne', accentStrip:'CELEBRATING LOVE', decor:'hearts', serif:true },
    { name:'Sangeet Wide',   orientation:'landscape', printSize:'5x7', count:4, price:289, palette:'marigold',  accentStrip:'SANGEET NIGHT', decor:'confetti' },
    { name:'Rose Garden',    orientation:'landscape', printSize:'4x6', count:2, price:249, palette:'blush',     accentStrip:'MR & MRS', decor:'hearts', serif:true },
    { name:'Vow Strip',      orientation:'landscape', printSize:'2x6', count:3, price:189, palette:'ivory',     accentStrip:'JUST MARRIED', decor:'hearts' },
  ],
  birthday: [
    { name:'Cake Smash',     orientation:'portrait',  printSize:'4x6', count:3, price:129, palette:'candy',     accentStrip:'HAPPY BIRTHDAY!', decor:'confetti' },
    { name:'Unicorn Magic',  orientation:'portrait',  printSize:'5x7', count:2, price:149, palette:'violet',    accentStrip:'MAKE A WISH', decor:'stars' },
    { name:'Candlelight',    orientation:'portrait',  printSize:'6x8', count:1, price:139, palette:'sunset',    accentStrip:'ANOTHER YEAR AROUND', decor:'confetti', serif:true },
    { name:'Birthday Strip', orientation:'portrait',  printSize:'2x6', count:4, price:99,  palette:'candy',     accentStrip:'PARTY LIKE A KID', decor:'confetti' },
    { name:'Sprinkles',      orientation:'portrait',  printSize:'2x6', count:3, price:89,  palette:'paper',     accentStrip:'MAKE IT A MEMORY', decor:'bubbles' },
    { name:'Balloon Blast',  orientation:'landscape', printSize:'5x7', count:3, price:159, palette:'sunset',    accentStrip:'LET THEM EAT CAKE', decor:'bubbles' },
    { name:'Candy Pop',      orientation:'landscape', printSize:'4x6', count:2, price:129, palette:'candy',     accentStrip:'SWEET CELEBRATION', decor:'confetti' },
    { name:'Pinata Grid',    orientation:'landscape', printSize:'6x8', count:4, price:189, palette:'playground',accentStrip:'BIRTHDAY CLUB', decor:'confetti' },
    { name:'Wish Strip',     orientation:'landscape', printSize:'2x6', count:3, price:109, palette:'violet',    accentStrip:'YOU’RE THE GIFT', decor:'stars' },
  ],
  corporate: [
    { name:'Brand Pro',      orientation:'portrait',  printSize:'4x6', count:2, price:99,  palette:'sky',       accentStrip:'YOUR BRAND, LIVE', decor:'none' },
    { name:'Summit',         orientation:'portrait',  printSize:'5x7', count:3, price:129, palette:'slate',     accentStrip:'ANNUAL SUMMIT', decor:'none' },
    { name:'Letterhead',     orientation:'portrait',  printSize:'6x8', count:1, price:119, palette:'paper',     accentStrip:'KNOWLEDGE EXCHANGE', decor:'none' },
    { name:'Team Strip',     orientation:'portrait',  printSize:'2x6', count:3, price:89,  palette:'slate',     accentStrip:'TEAM SPIRIT', decor:'none' },
    { name:'Offsite',        orientation:'portrait',  printSize:'2x6', count:4, price:109, palette:'sky',       accentStrip:'OFFSITE 2026', decor:'none' },
    { name:'Launch Wide',    orientation:'landscape', printSize:'6x8', count:3, price:179, palette:'sky',       accentStrip:'PRODUCT LAUNCH', decor:'none' },
    { name:'Keynote',        orientation:'landscape', printSize:'5x7', count:2, price:149, palette:'slate',     accentStrip:'KEYNOTE MOMENTS', decor:'none' },
    { name:'Deck',           orientation:'landscape', printSize:'4x6', count:4, price:159, palette:'paper',     accentStrip:'THE PEOPLE MAKE IT', decor:'none' },
    { name:'Night Shift',    orientation:'landscape', printSize:'2x6', count:3, price:99,  palette:'editorial', accentStrip:'AFTER HOURS', decor:'none' },
  ],
  cinema: [
    { name:'Red Carpet',     orientation:'portrait',  printSize:'4x6', count:3, price:199, palette:'crimson',   accentStrip:'RED CARPET MOMENT', decor:'stars', serif:true },
    { name:'Spotlight',      orientation:'portrait',  printSize:'5x7', count:1, price:249, palette:'noir',      accentStrip:'STAR OF THE NIGHT', decor:'stars', serif:true },
    { name:'Premiere',       orientation:'portrait',  printSize:'6x8', count:2, price:229, palette:'gold',      accentStrip:'PREMIERE NIGHT', decor:'none', serif:true },
    { name:'End Credits',    orientation:'portrait',  printSize:'2x6', count:4, price:139, palette:'noir',      accentStrip:'THE END', decor:'none' },
    { name:'Marquee',        orientation:'portrait',  printSize:'2x6', count:3, price:129, palette:'crimson',   accentStrip:'NOW SHOWING', decor:'stars' },
    { name:'Film Strip',     orientation:'landscape', printSize:'2x6', count:4, price:149, palette:'editorial', accentStrip:'CINEMA MAGIC', decor:'none' },
    { name:'Screening',      orientation:'landscape', printSize:'6x8', count:3, price:279, palette:'crimson',   accentStrip:'SPECIAL SCREENING', decor:'stars' },
    { name:'Gold Ticket',    orientation:'landscape', printSize:'5x7', count:2, price:239, palette:'gold',      accentStrip:'A-LIST ONLY', decor:'none', serif:true },
    { name:'Backlot',        orientation:'landscape', printSize:'4x6', count:4, price:189, palette:'noir',      accentStrip:'BEHIND THE SCENES', decor:'none' },
  ],
  festival: [
    { name:'Holi Splash',    orientation:'portrait',  printSize:'4x6', count:3, price:99,  palette:'marigold',  accentStrip:'RANG BARSE', decor:'confetti' },
    { name:'Diwali Glow',    orientation:'portrait',  printSize:'5x7', count:2, price:129, palette:'gold',      accentStrip:'SHUBH DEEPAWALI', decor:'stars', serif:true },
    { name:'Garba',          orientation:'portrait',  printSize:'6x8', count:1, price:119, palette:'violet',    accentStrip:'GARBA NIGHTS', decor:'confetti' },
    { name:'Festival Strip', orientation:'portrait',  printSize:'2x6', count:4, price:89,  palette:'sunset',    accentStrip:'CELEBRATE TOGETHER', decor:'confetti' },
    { name:'Mela',           orientation:'portrait',  printSize:'2x6', count:3, price:89,  palette:'party',     accentStrip:'MELA MOMENTS', decor:'stars' },
    { name:'Navratri Wide',  orientation:'landscape', printSize:'6x8', count:3, price:149, palette:'violet',    accentStrip:'NINE NIGHTS OF JOY', decor:'confetti' },
    { name:'Lohri Nights',   orientation:'landscape', printSize:'5x7', count:2, price:139, palette:'gold',      accentStrip:'AROUND THE FIRE', decor:'stars' },
    { name:'Carnival',       orientation:'landscape', printSize:'4x6', count:4, price:159, palette:'marigold',  accentStrip:'CARNIVAL DAYS', decor:'confetti' },
    { name:'Rath Yatra',     orientation:'landscape', printSize:'2x6', count:3, price:99,  palette:'sunset',    accentStrip:'TOGETHER IN COLOUR', decor:'none' },
  ],
  kids: [
    { name:'Jungle Fun',     orientation:'portrait',  printSize:'4x6', count:3, price:99,  palette:'mint',      accentStrip:'WILD ADVENTURE', decor:'bubbles' },
    { name:'Space Cadet',    orientation:'portrait',  printSize:'5x7', count:2, price:109, palette:'plum',      accentStrip:'TO THE STARS', decor:'stars' },
    { name:'Storybook',      orientation:'portrait',  printSize:'6x8', count:1, price:119, palette:'playground',accentStrip:'ONCE UPON A TIME', decor:'none', serif:true },
    { name:'Playdate Strip', orientation:'portrait',  printSize:'2x6', count:4, price:79,  palette:'candy',     accentStrip:'PLAY ALL DAY', decor:'confetti' },
    { name:'Little Star',    orientation:'portrait',  printSize:'2x6', count:3, price:79,  palette:'mint',      accentStrip:'LITTLE STAR', decor:'stars' },
    { name:'Fun Zone',       orientation:'landscape', printSize:'5x7', count:3, price:99,  palette:'playground',accentStrip:'FUN ZONE', decor:'bubbles' },
    { name:'Birthday Bash',  orientation:'landscape', printSize:'4x6', count:4, price:119, palette:'candy',     accentStrip:'BIRTHDAY BASH', decor:'confetti' },
    { name:'Cartoon Grid',   orientation:'landscape', printSize:'6x8', count:2, price:109, palette:'mint',      accentStrip:'BEST DAY EVER', decor:'bubbles' },
    { name:'Toy Box',        orientation:'landscape', printSize:'2x6', count:3, price:79,  palette:'sky',       accentStrip:'TOY BOX', decor:'confetti' },
  ],
  cinema2: [
    { name:'Editorial',      orientation:'portrait',  printSize:'4x6', count:2, price:279, palette:'editorial', accentStrip:'ISSUE Nº 01', decor:'none', serif:true },
    { name:'Violet Hour',    orientation:'portrait',  printSize:'5x7', count:3, price:259, palette:'plum',      accentStrip:'AFTER HOURS', decor:'stars', serif:true },
    { name:'Golden Muse',    orientation:'portrait',  printSize:'6x8', count:1, price:299, palette:'gold',      accentStrip:'THE COVER STORY', decor:'none', serif:true },
    { name:'Backstage',      orientation:'portrait',  printSize:'2x6', count:4, price:189, palette:'editorial', accentStrip:'BACKSTAGE', decor:'none' },
    { name:'Runway Strip',   orientation:'portrait',  printSize:'2x6', count:3, price:179, palette:'plum',      accentStrip:'RUNWAY', decor:'none' },
    { name:'Lookbook Wide',  orientation:'landscape', printSize:'6x8', count:3, price:319, palette:'editorial', accentStrip:'LOOKBOOK 2026', decor:'none', serif:true },
    { name:'Glam Grid',      orientation:'landscape', printSize:'5x7', count:4, price:289, palette:'plum',      accentStrip:'OWN THE FRAME', decor:'stars' },
    { name:'Portrait Mode',  orientation:'landscape', printSize:'4x6', count:2, price:249, palette:'noir',      accentStrip:'PORTRAIT MODE', decor:'none', serif:true },
    { name:'Flash Bulb',     orientation:'landscape', printSize:'2x6', count:3, price:199, palette:'gold',      accentStrip:'FLASH BULB', decor:'none' },
  ],
}

export const TEMPLATES = Object.entries(DESIGNS).flatMap(([category, list]) =>
  list.map((d, i) => make({
    ...d,
    id: `${category}-${d.orientation[0]}-${i + 1}`,
    category,
    palette: PALETTES[d.palette] || PALETTES.paper,
  }))
)

export const FILTERS = [
  { id:'original', label:'Natural', color:'#a1a1aa', desc:'True natural tones' },
  { id:'warm', label:'Warm Sun', color:'#f59e0b', desc:'Golden amber glow' },
  { id:'cool', label:'Cool Breeze', color:'#0ea5e9', desc:'Fresh oceanic blues' },
  { id:'bw', label:'Classic B&W', color:'#3f3f46', desc:'High-contrast monochrome' },
  { id:'vintage', label:'Vintage Film', color:'#b45309', desc:'Warm retro sepia' },
  { id:'soft', label:'Soft Dream', color:'#f472b6', desc:'Dreamy pastel glow' },
  { id:'party', label:'Party Pop', color:'#ec4899', desc:'Vibrant punchy colours' },
]

export const STICKERS = ['❤️','✨','🎉','📸','👑','🦋','🌸','🥳','💍','🥂','🔥','⭐','🎈','🌟','💖','🎊']
