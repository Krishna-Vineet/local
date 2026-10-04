const fs = require('fs');
const path = require('path');

// Base 64 transparent 1x1 PNG
const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const categories = {
  'glitter': [
    { id: 'gold-glitter', name: 'Gold Glitter', type: 'image' },
    { id: 'silver-glitter', name: 'Silver Glitter', type: 'image' },
    { id: 'rose-gold-glitter', name: 'Rose Gold Glitter', type: 'image' },
    { id: 'pink-glitter', name: 'Pink Glitter', type: 'image' },
    { id: 'red-glitter', name: 'Red Glitter', type: 'image' },
    { id: 'blue-glitter', name: 'Blue Glitter', type: 'image' },
    { id: 'black-glitter', name: 'Black Glitter', type: 'image' },
    { id: 'rainbow-glitter', name: 'Rainbow Glitter', type: 'image' }
  ],
  'floral': [
    { id: 'rose-petals', name: 'Rose Petals', type: 'image' },
    { id: 'small-flowers', name: 'Small Flowers', type: 'image' },
    { id: 'cherry-blossom', name: 'Cherry Blossom', type: 'image' },
    { id: 'daisy', name: 'Daisy', type: 'image' },
    { id: 'wildflower', name: 'Wildflower', type: 'image' },
    { id: 'tropical-flowers', name: 'Tropical Flowers', type: 'image' },
    { id: 'elegant-floral', name: 'Elegant Floral', type: 'image' },
    { id: 'vintage-floral', name: 'Vintage Floral', type: 'image' }
  ],
  'luxury': [
    { id: 'white-marble', name: 'White Marble', type: 'image' },
    { id: 'black-marble', name: 'Black Marble', type: 'image' },
    { id: 'gold-marble', name: 'Gold Marble', type: 'image' },
    { id: 'gold-foil', name: 'Gold Foil', type: 'image' },
    { id: 'silver-foil', name: 'Silver Foil', type: 'image' },
    { id: 'rose-gold-foil', name: 'Rose Gold Foil', type: 'image' },
    { id: 'luxury-damask', name: 'Luxury Damask', type: 'image' },
    { id: 'ornamental-gold', name: 'Ornamental Gold', type: 'image' }
  ],
  'cute': [
    { id: 'pink-hearts', name: 'Pink Hearts', type: 'procedural', skiaType: 'hearts', primary: '#FFC0CB', secondary: '#FFFFFF' },
    { id: 'red-hearts', name: 'Red Hearts', type: 'procedural', skiaType: 'hearts', primary: '#FF0000', secondary: '#FFFFFF' },
    { id: 'white-hearts', name: 'White Hearts', type: 'procedural', skiaType: 'hearts', primary: '#FFFFFF', secondary: '#FFC0CB' },
    { id: 'tiny-stars', name: 'Tiny Stars', type: 'procedural', skiaType: 'stars', primary: '#FFD700', secondary: '#FFFFFF' },
    { id: 'golden-stars', name: 'Golden Stars', type: 'procedural', skiaType: 'stars', primary: '#DAA520', secondary: '#000000' },
    { id: 'cute-dots', name: 'Cute Dots', type: 'procedural', skiaType: 'dots', primary: '#FF69B4', secondary: '#FFFFFF' },
    { id: 'pink-bows', name: 'Pink Bows', type: 'image' },
    { id: 'candy-pattern', name: 'Candy Pattern', type: 'image' }
  ],
  'geometric': [
    { id: 'black-grid', name: 'Black Grid', type: 'procedural', skiaType: 'grid', primary: '#000000', secondary: '#FFFFFF' },
    { id: 'white-grid', name: 'White Grid', type: 'procedural', skiaType: 'grid', primary: '#FFFFFF', secondary: '#000000' },
    { id: 'gold-grid', name: 'Gold Grid', type: 'procedural', skiaType: 'grid', primary: '#D4AF37', secondary: '#000000' },
    { id: 'argyle', name: 'Argyle', type: 'procedural', skiaType: 'argyle', primary: '#18181B', secondary: '#E5E5E5' },
    { id: 'diamond', name: 'Diamond', type: 'procedural', skiaType: 'diamond', primary: '#2563EB', secondary: '#FFFFFF' },
    { id: 'hexagon', name: 'Hexagon', type: 'image' },
    { id: 'chevron', name: 'Chevron', type: 'procedural', skiaType: 'chevron', primary: '#10B981', secondary: '#FFFFFF' },
    { id: 'diagonal-stripes', name: 'Diagonal Stripes', type: 'procedural', skiaType: 'stripes', primary: '#F59E0B', secondary: '#FFFFFF' }
  ],
  'animal': [
    { id: 'leopard', name: 'Leopard', type: 'image' },
    { id: 'zebra', name: 'Zebra', type: 'image' },
    { id: 'tiger', name: 'Tiger', type: 'image' },
    { id: 'cow', name: 'Cow', type: 'image' },
    { id: 'snake-skin', name: 'Snake Skin', type: 'image' },
    { id: 'dalmatian', name: 'Dalmatian', type: 'image' }
  ],
  'nature': [
    { id: 'green-leaves', name: 'Green Leaves', type: 'image' },
    { id: 'tropical-leaves', name: 'Tropical Leaves', type: 'image' },
    { id: 'palm-leaves', name: 'Palm Leaves', type: 'image' },
    { id: 'forest', name: 'Forest', type: 'image' },
    { id: 'ocean', name: 'Ocean', type: 'image' },
    { id: 'water-waves', name: 'Water Waves', type: 'image' },
    { id: 'clouds', name: 'Clouds', type: 'image' },
    { id: 'sand', name: 'Sand', type: 'image' }
  ],
  'party': [
    { id: 'colorful-confetti', name: 'Colorful Confetti', type: 'image' },
    { id: 'gold-confetti', name: 'Gold Confetti', type: 'image' },
    { id: 'silver-confetti', name: 'Silver Confetti', type: 'image' },
    { id: 'balloons', name: 'Balloons', type: 'image' },
    { id: 'party-stars', name: 'Party Stars', type: 'image' },
    { id: 'fireworks', name: 'Fireworks', type: 'image' },
    { id: 'party-streamers', name: 'Party Streamers', type: 'image' },
    { id: 'birthday-pattern', name: 'Birthday Pattern', type: 'image' }
  ],
  'seasonal': [
    { id: 'christmas', name: 'Christmas', type: 'image' },
    { id: 'snowflakes', name: 'Snowflakes', type: 'image' },
    { id: 'halloween', name: 'Halloween', type: 'image' },
    { id: 'pumpkin', name: 'Pumpkin', type: 'image' },
    { id: 'valentine', name: 'Valentine', type: 'image' },
    { id: 'easter', name: 'Easter', type: 'image' },
    { id: 'new-year', name: 'New Year', type: 'image' },
    { id: 'birthday', name: 'Birthday', type: 'image' }
  ],
  'fabric': [
    { id: 'denim', name: 'Denim', type: 'image' },
    { id: 'tweed', name: 'Tweed', type: 'image' },
    { id: 'knit', name: 'Knit', type: 'image' },
    { id: 'linen', name: 'Linen', type: 'image' },
    { id: 'canvas', name: 'Canvas', type: 'image' },
    { id: 'leather', name: 'Leather', type: 'image' }
  ],
  'vintage': [
    { id: 'vintage-paper', name: 'Vintage Paper', type: 'image' },
    { id: 'newspaper', name: 'Newspaper', type: 'image' },
    { id: 'retro-ornament', name: 'Retro Ornament', type: 'image' },
    { id: 'vintage-floral-2', name: 'Vintage Floral', type: 'image' },
    { id: 'old-paper', name: 'Old Paper', type: 'image' },
    { id: 'classic-ornament', name: 'Classic Ornament', type: 'image' }
  ],
  'premium': [
    { id: 'galaxy', name: 'Galaxy', type: 'image' },
    { id: 'aurora', name: 'Aurora', type: 'image' },
    { id: 'cosmic', name: 'Cosmic', type: 'image' },
    { id: 'nebula', name: 'Nebula', type: 'image' },
    { id: 'luxury-waves', name: 'Luxury Waves', type: 'image' },
    { id: 'abstract-silk', name: 'Abstract Silk', type: 'image' }
  ]
};

const assetsDir = path.join(__dirname, '../src/assets/patterns');
const registryFile = path.join(__dirname, '../../../../packages/ui/src/constants/patterns.ts');

if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

let registryOutput = `export type PatternType = 'image' | 'procedural';
export type ProceduralPatternType = 'grid' | 'dots' | 'checker' | 'stripes' | 'hearts' | 'stars' | 'argyle' | 'diamond' | 'chevron';

export interface BoothPattern {
  id: string;
  name: string;
  category: string;
  type: PatternType;
  asset?: any;
  skiaType?: ProceduralPatternType;
  primary?: string;
  secondary?: string;
  enabled: boolean;
}

export const PATTERN_CATEGORIES = [
  'Glitter', 'Floral', 'Luxury', 'Cute', 'Geometric', 'Animal', 
  'Nature', 'Party', 'Seasonal', 'Fabric', 'Vintage', 'Premium'
];

export const PATTERNS: BoothPattern[] = [
`;

for (const [categoryKey, patterns] of Object.entries(categories)) {
  const catFolder = path.join(assetsDir, categoryKey);
  if (!fs.existsSync(catFolder)) fs.mkdirSync(catFolder, { recursive: true });

  const catName = categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);

  for (const pat of patterns) {
    let assetRequire = 'undefined';
    if (pat.type === 'image') {
      const imgPath = path.join(catFolder, pat.id + '.png');
      fs.writeFileSync(imgPath, png1x1);
      // Require path relative to packages/ui/src/constants/patterns.ts
      // -> ../../../../apps/booth/src/assets/patterns/...
      assetRequire = \`require('../../../../apps/booth/src/assets/patterns/\${categoryKey}/\${pat.id}.png')\`;
    }

    registryOutput += \`  {
    id: '\${pat.id}',
    name: '\${pat.name}',
    category: '\${catName}',
    type: '\${pat.type}',
    asset: \${assetRequire},
    skiaType: \${pat.skiaType ? "'" + pat.skiaType + "'" : 'undefined'},
    primary: \${pat.primary ? "'" + pat.primary + "'" : 'undefined'},
    secondary: \${pat.secondary ? "'" + pat.secondary + "'" : 'undefined'},
    enabled: true
  },
\`;
  }
}

registryOutput += \`];

export const LEGACY_PATTERN_MAP: Record<string, string> = {
  'pat_glitter_pink': 'pink-glitter',
  'pat_plaid_pink': 'pink-hearts',
  'pat_plaid_blue': 'blue-glitter',
  'pat_argyle_bw': 'argyle',
  'pat_argyle_w': 'argyle',
  'pat_quilt_pink': 'pink-glitter',
  'pat_check_blk': 'black-grid',
  'pat_check_pnk': 'pink-bows',
  'pat_check_red': 'red-hearts',
  'pat_ging_pnk': 'cute-dots',
  'pat_ging_red': 'candy-pattern',
  'pat_ging_grn': 'green-leaves',
  'pat_ging_blu': 'blue-glitter',
  'pat_strp_pnk': 'diagonal-stripes',
  'pat_strp_yel': 'gold-grid',
  'pat_chk_by': 'diamond',
  'pat_chk_nw': 'hexagon',
  'pat_leopard': 'leopard',
  'pat_cow': 'cow',
  'pat_glit_red': 'red-glitter',
  'pat_flo_pnk1': 'rose-petals',
  'pat_flo_pnk2': 'cherry-blossom',
  'pat_knit_wht': 'knit',
  'pat_knit_gry': 'tweed',
  'pat_space_1': 'galaxy',
  'pat_space_2': 'cosmic',
  'pat_solid_gry': 'canvas',
  'pat_paper_1': 'old-paper',
  'pat_paper_2': 'vintage-paper',
  'pat_glit_wht': 'silver-glitter',
  'pat_water': 'water-waves',
  'pat_sky': 'clouds',
  'pat_forest': 'forest',
  'pat_ocean': 'ocean',
  'pat_beach': 'sand',
  'pat_stars_pnk': 'tiny-stars',
  'pat_damask': 'luxury-damask',
  'pat_vin_flo': 'vintage-floral',
  'pat_roses': 'roses',
  'pat_foil_sil': 'silver-foil',
  'pat_foil_blk': 'black-marble',
  'pat_marble': 'white-marble',
  'pat_strp_blu': 'diagonal-stripes',
  'pat_tweed': 'tweed',
  'pat_denim': 'denim'
};
\`;

fs.mkdirSync(path.dirname(registryFile), { recursive: true });
fs.writeFileSync(registryFile, registryOutput);

console.log('Successfully generated assets and patterns.ts!');
