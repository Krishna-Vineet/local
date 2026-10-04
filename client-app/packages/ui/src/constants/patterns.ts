export type PatternType = 'image' | 'procedural';
export type ProceduralPatternType =
  | 'grid' | 'dots' | 'checker' | 'stripes' | 'vstripes'
  | 'hearts' | 'stars' | 'argyle' | 'diamond' | 'chevron'
  | 'quilt' | 'scales' | 'cow' | 'leopard' | 'glitter'
  | 'waves' | 'floral' | 'confetti' | 'triangles' | 'hexagons';

export interface BoothPattern {
  id: string;
  name: string;
  category: string;
  type: PatternType;
  asset?: any;
  placeholderName?: string;
  skiaType?: ProceduralPatternType;
  primary?: string;
  secondary?: string;
  enabled: boolean;
}

export const PATTERN_CATEGORIES = [
  'All', 'Glitter', 'Floral', 'Luxury', 'Cute', 'Geometric', 'Animal',
  'Nature', 'Party', 'Seasonal', 'Fabric', 'Vintage', 'Premium'
];

export const PATTERNS: BoothPattern[] = [
  // GLITTER — procedural sparkle/shimmer
  { id: 'gold-glitter',      name: 'Gold Glitter',      category: 'Glitter', type: 'procedural', skiaType: 'glitter', primary: '#D4AF37', secondary: '#FFF8DC', enabled: true },
  { id: 'silver-glitter',    name: 'Silver Glitter',    category: 'Glitter', type: 'procedural', skiaType: 'glitter', primary: '#C0C0C0', secondary: '#F5F5F5', enabled: true },
  { id: 'rose-gold-glitter', name: 'Rose Gold Glitter', category: 'Glitter', type: 'procedural', skiaType: 'glitter', primary: '#B76E79', secondary: '#FFE4E8', enabled: true },
  { id: 'pink-glitter',      name: 'Pink Glitter',      category: 'Glitter', type: 'procedural', skiaType: 'glitter', primary: '#FF69B4', secondary: '#FFF0F5', enabled: true },
  { id: 'red-glitter',       name: 'Red Glitter',       category: 'Glitter', type: 'procedural', skiaType: 'glitter', primary: '#CC0000', secondary: '#2A0000', enabled: true },
  { id: 'blue-glitter',      name: 'Blue Glitter',      category: 'Glitter', type: 'procedural', skiaType: 'glitter', primary: '#1E90FF', secondary: '#001433', enabled: true },
  { id: 'black-glitter',     name: 'Black Glitter',     category: 'Glitter', type: 'procedural', skiaType: 'glitter', primary: '#888888', secondary: '#1A1A1A', enabled: true },
  { id: 'rainbow-glitter',   name: 'Rainbow Glitter',   category: 'Glitter', type: 'procedural', skiaType: 'confetti', primary: '#FF6B6B', secondary: '#FFFFFF', enabled: true },

  // FLORAL — procedural flower patterns
  { id: 'rose-petals',      name: 'Rose Petals',      category: 'Floral', type: 'procedural', skiaType: 'floral', primary: '#FF6B8A', secondary: '#FFF0F3', enabled: true },
  { id: 'small-flowers',    name: 'Small Flowers',    category: 'Floral', type: 'procedural', skiaType: 'floral', primary: '#FF9FB5', secondary: '#FFF5F7', enabled: true },
  { id: 'cherry-blossom',   name: 'Cherry Blossom',   category: 'Floral', type: 'procedural', skiaType: 'floral', primary: '#FFB7C5', secondary: '#FFF8FA', enabled: true },
  { id: 'daisy',            name: 'Daisy',            category: 'Floral', type: 'procedural', skiaType: 'floral', primary: '#FFE066', secondary: '#FFFFFF', enabled: true },
  { id: 'wildflower',       name: 'Wildflower',       category: 'Floral', type: 'procedural', skiaType: 'floral', primary: '#7EC8A0', secondary: '#F0FFF4', enabled: true },
  { id: 'tropical-flowers', name: 'Tropical Flowers', category: 'Floral', type: 'procedural', skiaType: 'floral', primary: '#FF7043', secondary: '#E8F5E9', enabled: true },
  { id: 'elegant-floral',   name: 'Elegant Floral',   category: 'Floral', type: 'procedural', skiaType: 'floral', primary: '#9C27B0', secondary: '#F3E5F5', enabled: true },
  { id: 'vintage-floral',   name: 'Vintage Floral',   category: 'Floral', type: 'procedural', skiaType: 'floral', primary: '#C0935C', secondary: '#FDF6EC', enabled: true },

  // LUXURY — premium procedural patterns
  { id: 'white-marble',    name: 'White Marble',    category: 'Luxury', type: 'procedural', skiaType: 'waves',    primary: '#BBBBBB', secondary: '#FFFFFF', enabled: true },
  { id: 'black-marble',    name: 'Black Marble',    category: 'Luxury', type: 'procedural', skiaType: 'waves',    primary: '#555555', secondary: '#111111', enabled: true },
  { id: 'gold-marble',     name: 'Gold Marble',     category: 'Luxury', type: 'procedural', skiaType: 'waves',    primary: '#C8A850', secondary: '#2A1F00', enabled: true },
  { id: 'gold-foil',       name: 'Gold Foil',       category: 'Luxury', type: 'procedural', skiaType: 'glitter',  primary: '#FFD700', secondary: '#3D2B00', enabled: true },
  { id: 'silver-foil',     name: 'Silver Foil',     category: 'Luxury', type: 'procedural', skiaType: 'glitter',  primary: '#E8E8E8', secondary: '#2A2A2A', enabled: true },
  { id: 'rose-gold-foil',  name: 'Rose Gold Foil',  category: 'Luxury', type: 'procedural', skiaType: 'glitter',  primary: '#E8A090', secondary: '#2A1010', enabled: true },
  { id: 'luxury-damask',   name: 'Luxury Damask',   category: 'Luxury', type: 'procedural', skiaType: 'floral',   primary: '#B8960C', secondary: '#1A1400', enabled: true },
  { id: 'ornamental-gold', name: 'Ornamental Gold', category: 'Luxury', type: 'procedural', skiaType: 'hexagons', primary: '#D4AF37', secondary: '#0A0700', enabled: true },

  // CUTE — procedural cute patterns
  { id: 'pink-hearts',   name: 'Pink Hearts',   category: 'Cute', type: 'procedural', skiaType: 'hearts',  primary: '#FFC0CB', secondary: '#FFFFFF', enabled: true },
  { id: 'red-hearts',    name: 'Red Hearts',    category: 'Cute', type: 'procedural', skiaType: 'hearts',  primary: '#FF0000', secondary: '#FFFFFF', enabled: true },
  { id: 'white-hearts',  name: 'White Hearts',  category: 'Cute', type: 'procedural', skiaType: 'hearts',  primary: '#FFFFFF', secondary: '#FFC0CB', enabled: true },
  { id: 'tiny-stars',    name: 'Tiny Stars',    category: 'Cute', type: 'procedural', skiaType: 'stars',   primary: '#FFD700', secondary: '#FFFFFF', enabled: true },
  { id: 'golden-stars',  name: 'Golden Stars',  category: 'Cute', type: 'procedural', skiaType: 'stars',   primary: '#DAA520', secondary: '#000000', enabled: true },
  { id: 'cute-dots',     name: 'Cute Dots',     category: 'Cute', type: 'procedural', skiaType: 'dots',    primary: '#FF69B4', secondary: '#FFFFFF', enabled: true },
  { id: 'pink-bows',     name: 'Pink Bows',     category: 'Cute', type: 'procedural', skiaType: 'floral',  primary: '#FF85A1', secondary: '#FFEEF2', enabled: true },
  { id: 'candy-pattern', name: 'Candy Pattern', category: 'Cute', type: 'procedural', skiaType: 'stripes', primary: '#FF6BB5', secondary: '#FFFFFF', enabled: true },

  // GEOMETRIC — procedural geometric
  { id: 'black-grid',       name: 'Black Grid',       category: 'Geometric', type: 'procedural', skiaType: 'grid',     primary: '#000000', secondary: '#FFFFFF', enabled: true },
  { id: 'white-grid',       name: 'White Grid',       category: 'Geometric', type: 'procedural', skiaType: 'grid',     primary: '#FFFFFF', secondary: '#000000', enabled: true },
  { id: 'gold-grid',        name: 'Gold Grid',        category: 'Geometric', type: 'procedural', skiaType: 'grid',     primary: '#D4AF37', secondary: '#000000', enabled: true },
  { id: 'argyle',           name: 'Argyle',           category: 'Geometric', type: 'procedural', skiaType: 'argyle',   primary: '#18181B', secondary: '#E5E5E5', enabled: true },
  { id: 'diamond',          name: 'Diamond',          category: 'Geometric', type: 'procedural', skiaType: 'diamond',  primary: '#2563EB', secondary: '#FFFFFF', enabled: true },
  { id: 'hexagon',          name: 'Hexagon',          category: 'Geometric', type: 'procedural', skiaType: 'hexagons', primary: '#6366F1', secondary: '#EEF2FF', enabled: true },
  { id: 'chevron',          name: 'Chevron',          category: 'Geometric', type: 'procedural', skiaType: 'chevron',  primary: '#10B981', secondary: '#FFFFFF', enabled: true },
  { id: 'diagonal-stripes', name: 'Diagonal Stripes', category: 'Geometric', type: 'procedural', skiaType: 'stripes',  primary: '#F59E0B', secondary: '#FFFFFF', enabled: true },

  // ANIMAL — procedural animal prints
  { id: 'leopard',    name: 'Leopard',    category: 'Animal', type: 'procedural', skiaType: 'leopard', primary: '#3D2000', secondary: '#D4A843', enabled: true },
  { id: 'zebra',      name: 'Zebra',      category: 'Animal', type: 'procedural', skiaType: 'stripes', primary: '#000000', secondary: '#FFFFFF', enabled: true },
  { id: 'tiger',      name: 'Tiger',      category: 'Animal', type: 'procedural', skiaType: 'stripes', primary: '#3D1C00', secondary: '#E87020', enabled: true },
  { id: 'cow',        name: 'Cow',        category: 'Animal', type: 'procedural', skiaType: 'cow',     primary: '#000000', secondary: '#FFFFFF', enabled: true },
  { id: 'snake-skin', name: 'Snake Skin', category: 'Animal', type: 'procedural', skiaType: 'scales',  primary: '#1A4020', secondary: '#6DB870', enabled: true },
  { id: 'dalmatian',  name: 'Dalmatian',  category: 'Animal', type: 'procedural', skiaType: 'dots',    primary: '#000000', secondary: '#FFFFFF', enabled: true },

  // NATURE — procedural nature patterns
  { id: 'green-leaves',    name: 'Green Leaves',    category: 'Nature', type: 'procedural', skiaType: 'floral',    primary: '#2E7D32', secondary: '#E8F5E9', enabled: true },
  { id: 'tropical-leaves', name: 'Tropical Leaves', category: 'Nature', type: 'procedural', skiaType: 'floral',    primary: '#1B5E20', secondary: '#CCEECC', enabled: true },
  { id: 'palm-leaves',     name: 'Palm Leaves',     category: 'Nature', type: 'procedural', skiaType: 'floral',    primary: '#33691E', secondary: '#DCEDC8', enabled: true },
  { id: 'forest',          name: 'Forest',          category: 'Nature', type: 'procedural', skiaType: 'triangles', primary: '#2D5A27', secondary: '#1A3A15', enabled: true },
  { id: 'ocean',           name: 'Ocean',           category: 'Nature', type: 'procedural', skiaType: 'waves',     primary: '#1565C0', secondary: '#BBDEFB', enabled: true },
  { id: 'water-waves',     name: 'Water Waves',     category: 'Nature', type: 'procedural', skiaType: 'waves',     primary: '#0277BD', secondary: '#E1F5FE', enabled: true },
  { id: 'clouds',          name: 'Clouds',          category: 'Nature', type: 'procedural', skiaType: 'dots',      primary: '#FFFFFF', secondary: '#87CEEB', enabled: true },
  { id: 'sand',            name: 'Sand',            category: 'Nature', type: 'procedural', skiaType: 'dots',      primary: '#C8AD7F', secondary: '#F5DEB3', enabled: true },

  // PARTY — procedural celebration patterns
  { id: 'colorful-confetti', name: 'Colorful Confetti', category: 'Party', type: 'procedural', skiaType: 'confetti', primary: '#FF6B6B', secondary: '#FFFFFF', enabled: true },
  { id: 'gold-confetti',     name: 'Gold Confetti',     category: 'Party', type: 'procedural', skiaType: 'confetti', primary: '#FFD700', secondary: '#1A1000', enabled: true },
  { id: 'silver-confetti',   name: 'Silver Confetti',   category: 'Party', type: 'procedural', skiaType: 'confetti', primary: '#C0C0C0', secondary: '#F5F5F5', enabled: true },
  { id: 'balloons',          name: 'Balloons',          category: 'Party', type: 'procedural', skiaType: 'dots',     primary: '#FF69B4', secondary: '#87CEEB', enabled: true },
  { id: 'party-stars',       name: 'Party Stars',       category: 'Party', type: 'procedural', skiaType: 'stars',    primary: '#FFD700', secondary: '#FF69B4', enabled: true },
  { id: 'fireworks',         name: 'Fireworks',         category: 'Party', type: 'procedural', skiaType: 'glitter',  primary: '#FF4500', secondary: '#000033', enabled: true },
  { id: 'party-streamers',   name: 'Party Streamers',   category: 'Party', type: 'procedural', skiaType: 'stripes',  primary: '#FF69B4', secondary: '#FFD700', enabled: true },
  { id: 'birthday-pattern',  name: 'Birthday Pattern',  category: 'Party', type: 'procedural', skiaType: 'confetti', primary: '#9C27B0', secondary: '#FFF9C4', enabled: true },

  // SEASONAL — procedural seasonal
  { id: 'christmas',  name: 'Christmas',  category: 'Seasonal', type: 'procedural', skiaType: 'floral',   primary: '#CC0000',  secondary: '#006400', enabled: true },
  { id: 'snowflakes', name: 'Snowflakes', category: 'Seasonal', type: 'procedural', skiaType: 'stars',    primary: '#FFFFFF',  secondary: '#4A90D9', enabled: true },
  { id: 'halloween',  name: 'Halloween',  category: 'Seasonal', type: 'procedural', skiaType: 'dots',     primary: '#FF6600',  secondary: '#1A0033', enabled: true },
  { id: 'pumpkin',    name: 'Pumpkin',    category: 'Seasonal', type: 'procedural', skiaType: 'dots',     primary: '#FF7700',  secondary: '#2D1B00', enabled: true },
  { id: 'valentine',  name: 'Valentine',  category: 'Seasonal', type: 'procedural', skiaType: 'hearts',   primary: '#FF1744',  secondary: '#FCE4EC', enabled: true },
  { id: 'easter',     name: 'Easter',     category: 'Seasonal', type: 'procedural', skiaType: 'dots',     primary: '#FFD700',  secondary: '#E1F5FE', enabled: true },
  { id: 'new-year',   name: 'New Year',   category: 'Seasonal', type: 'procedural', skiaType: 'glitter',  primary: '#FFD700',  secondary: '#000033', enabled: true },
  { id: 'birthday',   name: 'Birthday',   category: 'Seasonal', type: 'procedural', skiaType: 'confetti', primary: '#E91E63',  secondary: '#FFFDE7', enabled: true },

  // FABRIC — procedural fabric textures
  { id: 'denim',   name: 'Denim',   category: 'Fabric', type: 'procedural', skiaType: 'vstripes', primary: '#1A3A6B', secondary: '#2753A0', enabled: true },
  { id: 'tweed',   name: 'Tweed',   category: 'Fabric', type: 'procedural', skiaType: 'checker',  primary: '#78716C', secondary: '#D4D0CB', enabled: true },
  { id: 'knit',    name: 'Knit',    category: 'Fabric', type: 'procedural', skiaType: 'quilt',    primary: '#F8F8FF', secondary: '#D0D0D0', enabled: true },
  { id: 'linen',   name: 'Linen',   category: 'Fabric', type: 'procedural', skiaType: 'grid',     primary: '#BDB3A8', secondary: '#F5EDD8', enabled: true },
  { id: 'canvas',  name: 'Canvas',  category: 'Fabric', type: 'procedural', skiaType: 'grid',     primary: '#78716C', secondary: '#C8BEB0', enabled: true },
  { id: 'leather', name: 'Leather', category: 'Fabric', type: 'procedural', skiaType: 'quilt',    primary: '#3E2010', secondary: '#6B3820', enabled: true },

  // VINTAGE — procedural vintage aesthetics
  { id: 'vintage-paper',    name: 'Vintage Paper',  category: 'Vintage', type: 'procedural', skiaType: 'dots',     primary: '#C8AD7F', secondary: '#F5EDD8', enabled: true },
  { id: 'newspaper',        name: 'Newspaper',      category: 'Vintage', type: 'procedural', skiaType: 'vstripes', primary: '#888888', secondary: '#F5F5DC', enabled: true },
  { id: 'retro-ornament',   name: 'Retro Ornament', category: 'Vintage', type: 'procedural', skiaType: 'floral',   primary: '#8B4513', secondary: '#FDF5E6', enabled: true },
  { id: 'vintage-floral-2', name: 'Vintage Floral', category: 'Vintage', type: 'procedural', skiaType: 'floral',   primary: '#A0522D', secondary: '#FFF8DC', enabled: true },
  { id: 'old-paper',        name: 'Old Paper',      category: 'Vintage', type: 'procedural', skiaType: 'dots',     primary: '#B8A88A', secondary: '#EDE0C4', enabled: true },
  { id: 'classic-ornament', name: 'Classic Ornament',category: 'Vintage', type: 'procedural', skiaType: 'hexagons', primary: '#8B0000', secondary: '#FDF5E6', enabled: true },

  // PREMIUM — cosmic/premium procedural
  { id: 'galaxy',        name: 'Galaxy',        category: 'Premium', type: 'procedural', skiaType: 'glitter',  primary: '#9B59B6', secondary: '#060020', enabled: true },
  { id: 'aurora',        name: 'Aurora',        category: 'Premium', type: 'procedural', skiaType: 'waves',    primary: '#00E5FF', secondary: '#001A0F', enabled: true },
  { id: 'cosmic',        name: 'Cosmic',        category: 'Premium', type: 'procedural', skiaType: 'glitter',  primary: '#7C4DFF', secondary: '#0D001A', enabled: true },
  { id: 'nebula',        name: 'Nebula',        category: 'Premium', type: 'procedural', skiaType: 'dots',     primary: '#FF80AB', secondary: '#1A0030', enabled: true },
  { id: 'luxury-waves',  name: 'Luxury Waves',  category: 'Premium', type: 'procedural', skiaType: 'waves',    primary: '#D4AF37', secondary: '#1A0F00', enabled: true },
  { id: 'abstract-silk', name: 'Abstract Silk', category: 'Premium', type: 'procedural', skiaType: 'waves',    primary: '#E91E63', secondary: '#311B92', enabled: true },
];

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
