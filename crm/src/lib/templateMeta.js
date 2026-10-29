// ============================================================
// Template metadata — the Designer catalogue.
//
// A TEMPLATE is a hand-crafted React component (one per design —
// no generic renderer). Designer templates live in
// `src/templates/<Component>.jsx` and are registered by
// `componentId` in `src/templates/registry.jsx`. They cannot be
// deleted from the CRM (they are code); they are published /
// unpublished to control global availability to organizations.
//
// Playground / AI templates store a `design` config instead and
// are rendered by the Composable component; the playground can
// export their JSX scaffold so a developer can hand-finish them
// as dedicated designer components.
//
// This file is data-only (no JSX) so the mock server, seed DB
// and node test scripts can import it.
// ============================================================

export const TEMPLATE_CATEGORIES = ['Classic', 'Weddings', 'Parties', 'Corporate', 'Celebrations', 'Custom']

export const DESIGNER_TEMPLATES = [
  { id: 'hp-classic-46v1', componentId: 'ClassicPostcard', name: 'Classic White', category: 'Classic', layoutId: '46-v1', accent: '#3871C1', usage: 131, description: 'Clean white postcard with a fine keyline — the everyday workhorse.' },
  { id: 'hp-royal-57v3', componentId: 'RoyalWedding', name: 'Royal Wedding', category: 'Weddings', layoutId: '57-v3', accent: '#5F4CAA', usage: 87, description: 'Deep royal purple, gold arch frames and a script title — the wedding signature.' },
  { id: 'hp-neon-46v4', componentId: 'NeonParty', name: 'Neon Party Grid', category: 'Parties', layoutId: '46-v4', accent: '#EA097F', usage: 63, description: 'Magenta-to-purple glow with rounded slots — club nights and pop-ups.' },
  { id: 'hp-filmstrip-4626v4', componentId: 'FilmStrip', name: 'Retro Film Strip', category: 'Classic', layoutId: '46-26-v4', accent: '#B45309', usage: 54, description: 'Black strip with sprocket holes and four frames, retro lab label.' },
  { id: 'hp-sunset-4626v3', componentId: 'SunsetStrip', name: 'Sunset Strip Trio', category: 'Parties', layoutId: '46-26-v3', accent: '#F7B733', usage: 28, description: 'Warm sunset gradient with three glowing frames.' },
  { id: 'hp-vintage-6838v3', componentId: 'VintageBookmark', name: 'Vintage Bookmark', category: 'Weddings', layoutId: '68-38-v3', accent: '#8C6D1F', usage: 19, description: 'Sepia bookmark with ornate dividers and a classic serif.' },
  { id: 'hp-corporate-46h4', componentId: 'CorporateGrid', name: 'Corporate Blue', category: 'Corporate', layoutId: '46-h4', accent: '#3871C1', usage: 42, description: 'Crisp landscape grid with a brand header band — offsites and activations.' },
  { id: 'hp-gala-68v1', componentId: 'GalaGold', name: 'Gala Gold Full', category: 'Weddings', layoutId: '68-v1', accent: '#D9B44A', usage: 35, description: 'One full-bleed portrait inside a gold gallery frame on black.' },
  { id: 'hp-kids-46h3', componentId: 'KidsSplash', name: 'Kids Splash', category: 'Celebrations', layoutId: '46-h3', accent: '#6FA82B', usage: 19, description: 'Polka-dot playground with tilted frames — birthdays and kids events.' },
  { id: 'hp-mono-57v1', componentId: 'MinimalMono', name: 'Mono Studio', category: 'Corporate', layoutId: '57-v1', accent: '#191424', usage: 24, description: 'Editorial monochrome with a wide mat and whisper caption.' },
  { id: 'hp-festive-812v6', componentId: 'FestiveMaroon', name: 'Festive Maroon', category: 'Weddings', layoutId: '812-v6', accent: '#6E1F2A', usage: 31, description: 'Traditional maroon poster, gold separators, six photos — sangeet ready.' },
  { id: 'hp-collector-810210v5', componentId: 'CollectorReel', name: 'Collector Reel', category: 'Celebrations', layoutId: '810-210-v5', accent: '#0E7490', usage: 12, description: 'Numbered five-frame reel on collector-stock teal.' },
  { id: 'hp-legacy-810v9', componentId: 'LegacyGuestbook', name: 'Legacy Guestbook', category: 'Weddings', layoutId: '810-v9', accent: '#1E3E70', usage: 16, description: 'Nine-up navy grid with gold hairlines — the grand guestbook print.' },
  { id: 'hp-panorama-812412v5', componentId: 'PanoramaStory', name: 'Panorama Story', category: 'Classic', layoutId: '812-412-v5', accent: '#403952', usage: 9, description: 'Cinematic tall panorama — one wide moment over four frames.', active: false },
]

// Seeds for non-designer sources (rendered by the Composable component).
export const AI_SEED_TEMPLATES = [
  {
    id: 'hp-ai-royal-46v3',
    name: 'Regal Glow',
    category: 'Weddings',
    layoutId: '46-v3',
    source: 'ai_generated',
    status: 'published',
    active: true,
    usage: 21,
    description: 'AI background (prompt: “royal wedding, gold light, marble”) finished in the playground.',
    design: {
      bg: { type: 'image', url: '__BG_ROYAL__' },
      accent: '#D9B44A', textColor: '#FFFFFF',
      ornament: 'flourish', font: 'serif', slotShape: 'arch',
      title: 'Royal Moments', tagline: '',
    },
  },
  {
    id: 'hp-ai-neon-57v3',
    name: 'Retro Wave',
    category: 'Parties',
    layoutId: '57-v3',
    source: 'ai_generated',
    status: 'published',
    active: true,
    usage: 14,
    description: 'AI background (prompt: “retrowave sun grid, neon horizon”).',
    design: {
      bg: { type: 'image', url: '__BG_NEON__' },
      accent: '#F42E93', textColor: '#FFFFFF',
      ornament: 'none', font: 'sans', slotShape: 'rect',
      title: 'RETRO WAVE', tagline: 'party nights',
    },
  },
]

export const PLAYGROUND_SEED_TEMPLATES = [
  {
    id: 'hp-pg-golden-68v4',
    name: 'Golden Hour Gala',
    category: 'Celebrations',
    layoutId: '68-v4',
    source: 'playground',
    status: 'published',
    active: true,
    usage: 7,
    description: 'Built in the Template Playground — champagne gradient, rounded slots.',
    design: {
      bg: { type: 'gradient', colors: ['#D9B44A', '#8C6D1F'] },
      accent: '#FFF3D6', textColor: '#2B2109',
      ornament: 'dots', font: 'serif', slotShape: 'round',
      title: 'Golden Hour', tagline: 'celebrate in style',
    },
  },
]
