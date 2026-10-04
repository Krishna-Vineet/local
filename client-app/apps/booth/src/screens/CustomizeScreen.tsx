import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  ScrollView,
  PanResponder,
  Animated,
  ImageBackground,
  Modal,
} from 'react-native';

// Helper for HSV to HEX
function hsvToHex(h: number, s: number, v: number) {
  s /= 100;
  v /= 100;
  const f = (n: number, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`;
}

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Canvas,
  Image as SkiaImage,
  useImage,
  ColorMatrix,
  Group,
  Skia,
  Rect,
  Circle,
  LinearGradient,
  SweepGradient,
  Line,
  vec,
} from '@shopify/react-native-skia';

import {
  ScreenContainer,
  LayoutContainer,
  GlassCard,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
} from '../../../../packages/ui/src/index';

import { useBooth } from '../context/BoothProvider';
import { UploadAPI, PaymentAPI } from '../../../../packages/api/src/index';
import {
  renderEngine,
  printerManager,
} from '../../../../packages/printer-core/src/index';

import {
  PATTERN_CATEGORIES,
  PATTERNS,
  BoothPattern,
} from '../../../../packages/ui/src/index';

import SoundManager from '../utils/SoundManager';
import { InactivityToast } from '../components/InactivityToast';

import { getTemplatePrice } from '../utils/pricing';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Customize'>;

const TIMEOUT = 60;

/* ============================================================
   COLORS
   ============================================================ */

type FrameColor = {
  hex: string;
  name: string;
  bgColor?: string;
};

// Clean curated solid color swatches only — zero web fetching
const FRAME_COLORS: FrameColor[] = [
  { hex: 'universal',  name: 'CUSTOM'       },
  { hex: '#FFFFFF',    name: 'WHITE'        },
  { hex: '#18181B',    name: 'DARK'         },
  { hex: '#FFC0CB',    name: 'PINK'         },
  { hex: '#FF1744',    name: 'RED'          },
  { hex: '#FF9E0B',    name: 'AMBER'        },
  { hex: '#86EFAC',    name: 'MINT'         },
  { hex: '#93C5FD',    name: 'SKY'          },
  { hex: '#C4B5FD',    name: 'LAVENDER'     },
];

const CURATED_PATTERNS = [
  { id: 'none',             name: 'SOLID',    label: 'Solid Color' },
  { id: 'gold-glitter',     name: 'GLITTER',  label: 'Gold Glitter',  skiaType: 'glitter',  primary: '#D4AF37', secondary: '#FFF8DC' },
  { id: 'pink-hearts',      name: 'HEARTS',   label: 'Hearts',        skiaType: 'hearts',   primary: '#FF69B4', secondary: '#FFF0F5' },
  { id: 'white-marble',     name: 'MARBLE',   label: 'White Marble',  skiaType: 'waves',    primary: '#AAAAAA', secondary: '#FFFFFF' },
  { id: 'colorful-confetti',name: 'PARTY',    label: 'Confetti',      skiaType: 'confetti', primary: '#FF6B6B', secondary: '#FFFFFF' },
  { id: 'tiny-stars',       name: 'STARS',    label: 'Stars',         skiaType: 'stars',    primary: '#FFD700', secondary: '#1A1A1A' },
] as const;

const PHOTO_SHAPES = [
  { id: 'rectangle', icon: '🚫' }, // None/Default
  { id: 'rounded', icon: '▢' },
  { id: 'circle', icon: '◯' },
  { id: 'heart', icon: '🤍' },
];

const STICKERS = [
  // ROW 1
  { id: 's_bunny', url: 'https://cdn-icons-png.flaticon.com/512/2150/2150381.png' },
  { id: 's_clover', url: 'https://cdn-icons-png.flaticon.com/512/1253/1253818.png' },
  { id: 's_lips', url: 'https://cdn-icons-png.flaticon.com/512/2908/2908118.png' },
  { id: 's_heart_pnk', url: 'https://cdn-icons-png.flaticon.com/512/837/837889.png' },
  { id: 's_bow', url: 'https://cdn-icons-png.flaticon.com/512/837/837886.png' },
  { id: 's_sparkle1', url: 'https://cdn-icons-png.flaticon.com/512/2908/2908126.png' },
  { id: 's_heart_out', url: 'https://cdn-icons-png.flaticon.com/512/837/837895.png' },
  { id: 's_seal', url: 'https://cdn-icons-png.flaticon.com/512/2150/2150422.png' },
  { id: 's_stars', url: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png' },
  { id: 's_ribbon', url: 'https://cdn-icons-png.flaticon.com/512/837/837892.png' },

  // ROW 2
  { id: 's_stitches', url: 'https://cdn-icons-png.flaticon.com/512/2908/2908112.png' },
  { id: 's_star_blk', url: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png' },
  { id: 's_chick', url: 'https://cdn-icons-png.flaticon.com/512/2150/2150420.png' },
  { id: 's_bear', url: 'https://cdn-icons-png.flaticon.com/512/2150/2150410.png' },
  { id: 's_heart_3d', url: 'https://cdn-icons-png.flaticon.com/512/837/837882.png' },
  { id: 's_cat_yawn', url: 'https://cdn-icons-png.flaticon.com/512/2150/2150390.png' },
  { id: 's_cat_cute', url: 'https://cdn-icons-png.flaticon.com/512/2150/2150392.png' },
  { id: 's_dog', url: 'https://cdn-icons-png.flaticon.com/512/2150/2150400.png' },
  { id: 's_flower', url: 'https://cdn-icons-png.flaticon.com/512/2908/2908104.png' },
  { id: 's_anime', url: 'https://cdn-icons-png.flaticon.com/512/2150/2150430.png' },

  // ROW 3
  { id: 's_hbday', url: 'https://cdn-icons-png.flaticon.com/512/837/837892.png' },
  { id: 's_bouquet', url: 'https://cdn-icons-png.flaticon.com/512/2908/2908104.png' },
  { id: 's_strawberry', url: 'https://cdn-icons-png.flaticon.com/512/2908/2908100.png' },
  { id: 's_peach', url: 'https://cdn-icons-png.flaticon.com/512/2908/2908110.png' },
  { id: 's_bunny2', url: 'https://cdn-icons-png.flaticon.com/512/2150/2150381.png' },
  { id: 's_hibiscus', url: 'https://cdn-icons-png.flaticon.com/512/2908/2908105.png' },
  { id: 's_fish', url: 'https://cdn-icons-png.flaticon.com/512/2150/2150440.png' },
  { id: 's_money', url: 'https://cdn-icons-png.flaticon.com/512/2908/2908126.png' },
  { id: 's_iloveme', url: 'https://cdn-icons-png.flaticon.com/512/837/837895.png' },
  { id: 's_matcha', url: 'https://cdn-icons-png.flaticon.com/512/2908/2908112.png' },

  // ROW 4
  { id: 's_cool', url: 'https://cdn-icons-png.flaticon.com/512/837/837892.png' },
  { id: 's_mushroom', url: 'https://cdn-icons-png.flaticon.com/512/2908/2908100.png' },
  { id: 's_sims_pnk', url: 'https://cdn-icons-png.flaticon.com/512/837/837882.png' },
  { id: 's_sims_grn', url: 'https://cdn-icons-png.flaticon.com/512/1253/1253818.png' },
  { id: 's_gingerbread', url: 'https://cdn-icons-png.flaticon.com/512/2150/2150410.png' },
  { id: 's_stocking', url: 'https://cdn-icons-png.flaticon.com/512/837/837882.png' },
  { id: 's_grinch', url: 'https://cdn-icons-png.flaticon.com/512/2150/2150390.png' },

  // ROW 5: EMOJIS (Keyboard Stickers)
  { id: 'e_heart', emoji: '❤️' },
  { id: 'e_sparkles', emoji: '✨' },
  { id: 'e_fire', emoji: '🔥' },
  { id: 'e_star', emoji: '⭐' },
  { id: 'e_crown', emoji: '👑' },
  { id: 'e_butterfly', emoji: '🦋' },
  { id: 'e_sunflower', emoji: '🌻' },
  { id: 'e_party', emoji: '🎉' },
  { id: 'e_camera', emoji: '📸' },
  { id: 'e_100', emoji: '💯' },
  { id: 'e_cool', emoji: '😎' },
  { id: 'e_laugh', emoji: '😂' },
  { id: 'e_love', emoji: '😍' },
  { id: 'e_cat', emoji: '😻' },
  { id: 'e_dog', emoji: '🐶' },
  { id: 'e_bear', emoji: '🧸' },
];

const DraggableSticker = ({ sticker, onUpdate, onRemove }: any) => {
  const pan = useRef(new Animated.ValueXY({ x: sticker.x, y: sticker.y })).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  useEffect(() => {
    const id = pan.addListener((value) => {
      onUpdate(sticker.id, value.x, value.y);
    });
    return () => pan.removeListener(id);
  }, [pan, sticker.id, onUpdate]);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{ position: 'absolute', transform: [{ translateX: pan.x }, { translateY: pan.y }], width: sticker.width, height: sticker.height, zIndex: 10 }}
    >
      <TouchableOpacity onPress={() => onRemove(sticker.id)} style={{ position: 'absolute', top: -5, right: -5, zIndex: 11, backgroundColor: 'red', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{color: 'white', fontSize: 10, fontWeight: 'bold'}}>X</Text>
      </TouchableOpacity>
      {sticker.emoji ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: sticker.height * 0.75, textAlign: 'center' }}>{sticker.emoji}</Text>
        </View>
      ) : (
        <Image source={{ uri: sticker.url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      )}
    </Animated.View>
  );
};

const TileableProceduralPattern = ({ type, p, s, width, height }: { type: any, p: string, s: string, width: number, height: number }) => {
  const tileSize = Math.max(20, Math.min(40, width / 2));
  const cols = Math.ceil(width / tileSize);
  const rows = Math.ceil(height / tileSize);

  const cells: { x: number; y: number; i: number }[] = [];
  let cellId = 0;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      cells.push({ x: c * tileSize, y: r * tileSize, i: cellId++ });
    }
  }

  // Pseudo-random offset for organic patterns using cell index
  const rand = (i: number, range: number) => ((i * 1664525 + 1013904223) & 0x7fffffff) % range;

  return (
    <Canvas style={{ width, height, position: 'absolute', top: 0, left: 0, zIndex: -1 }}>
      <Rect x={0} y={0} width={width} height={height} color={s} />
      {cells.map((cell) => {
        const cx = cell.x + tileSize / 2;
        const cy = cell.y + tileSize / 2;
        const r = cell.i;

        // --- classic patterns ---
        if (type === 'dots') return <Circle key={r} cx={cx} cy={cy} r={tileSize / 5} color={p} />;
        if (type === 'grid') return <Rect key={r} x={cell.x} y={cell.y} width={tileSize} height={tileSize} color={p} style="stroke" strokeWidth={1} />;
        if (type === 'stripes') return <Line key={r} p1={vec(cell.x, cell.y)} p2={vec(cell.x + tileSize, cell.y + tileSize)} color={p} strokeWidth={tileSize / 3} />;
        if (type === 'vstripes') return <Rect key={r} x={cell.x} y={cell.y} width={tileSize * 0.5} height={tileSize} color={p} />;
        if (type === 'checker') return (r + Math.floor(cell.y / tileSize)) % 2 === 0 ? <Rect key={r} x={cell.x} y={cell.y} width={tileSize} height={tileSize} color={p} /> : null;
        if (type === 'hearts') return (
          <Group key={r}>
            <Rect x={cell.x + tileSize * 0.3} y={cell.y + tileSize * 0.3} width={tileSize * 0.4} height={tileSize * 0.4} color={p} />
            <Circle cx={cell.x + tileSize * 0.5} cy={cell.y + tileSize * 0.3} r={tileSize * 0.2} color={p} />
            <Circle cx={cell.x + tileSize * 0.3} cy={cell.y + tileSize * 0.5} r={tileSize * 0.2} color={p} />
          </Group>
        );
        if (type === 'stars' || type === 'diamond') return (
          <Rect key={r} x={cell.x + tileSize * 0.3} y={cell.y + tileSize * 0.3}
            width={tileSize * 0.4} height={tileSize * 0.4} color={p}
            origin={vec(cx, cy)} transform={[{ rotate: Math.PI / 4 }]} />
        );
        if (type === 'argyle') return (
          <Group key={r}>
            <Rect x={cx - tileSize * 0.35} y={cy - tileSize * 0.35} width={tileSize * 0.7} height={tileSize * 0.7}
              color={p} origin={vec(cx, cy)} transform={[{ rotate: Math.PI / 4 }]} />
          </Group>
        );
        if (type === 'chevron') return (
          <Group key={r}>
            <Line p1={vec(cell.x, cell.y + tileSize / 2)} p2={vec(cx, cell.y)} color={p} strokeWidth={2} />
            <Line p1={vec(cx, cell.y)} p2={vec(cell.x + tileSize, cell.y + tileSize / 2)} color={p} strokeWidth={2} />
          </Group>
        );

        // --- new pattern types ---
        if (type === 'glitter') {
          const size = tileSize * 0.12 + (rand(r, 6) * tileSize * 0.04);
          const ox = (rand(r * 3, tileSize) - tileSize / 2) * 0.8;
          const oy = (rand(r * 7 + 1, tileSize) - tileSize / 2) * 0.8;
          return <Circle key={r} cx={cx + ox} cy={cy + oy} r={size} color={p} opacity={0.55 + (rand(r, 5) * 0.09)} />;
        }
        if (type === 'confetti') {
          const w2 = tileSize * 0.25; const h2 = tileSize * 0.12;
          const confettiColors = [p, '#FF6B6B', '#FFD700', '#4FC3F7', '#A5D6A7', '#CE93D8'];
          return (
            <Rect key={r} x={cx - w2 / 2} y={cy - h2 / 2} width={w2} height={h2}
              color={confettiColors[rand(r, confettiColors.length)]}
              origin={vec(cx, cy)} transform={[{ rotate: (rand(r * 5, 314) / 100) - 1.57 }]} />
          );
        }
        if (type === 'waves') {
          const amp = tileSize * 0.3;
          const freq = (2 * Math.PI) / (tileSize * 2);
          const y1 = cell.y + tileSize / 2 + Math.sin(cell.x * freq) * amp;
          const y2 = cell.y + tileSize / 2 + Math.sin((cell.x + tileSize) * freq) * amp;
          return <Line key={r} p1={vec(cell.x, y1)} p2={vec(cell.x + tileSize, y2)} color={p} strokeWidth={tileSize * 0.18} />;
        }
        if (type === 'floral') {
          return (
            <Group key={r}>
              {[0, 1, 2, 3, 4].map((petal) => {
                const angle = (petal / 5) * Math.PI * 2;
                const pr = tileSize * 0.22;
                return (
                  <Circle key={petal}
                    cx={cx + Math.cos(angle) * pr}
                    cy={cy + Math.sin(angle) * pr}
                    r={tileSize * 0.16}
                    color={p}
                    opacity={0.85}
                  />
                );
              })}
              <Circle cx={cx} cy={cy} r={tileSize * 0.1} color={s} />
            </Group>
          );
        }
        if (type === 'triangles') {
          return (
            <Group key={r}>
              <Line p1={vec(cx, cell.y + tileSize * 0.1)} p2={vec(cell.x + tileSize * 0.1, cell.y + tileSize * 0.9)} color={p} strokeWidth={2} />
              <Line p1={vec(cell.x + tileSize * 0.1, cell.y + tileSize * 0.9)} p2={vec(cell.x + tileSize * 0.9, cell.y + tileSize * 0.9)} color={p} strokeWidth={2} />
              <Line p1={vec(cell.x + tileSize * 0.9, cell.y + tileSize * 0.9)} p2={vec(cx, cell.y + tileSize * 0.1)} color={p} strokeWidth={2} />
            </Group>
          );
        }
        if (type === 'hexagons') {
          const hr = tileSize * 0.42;
          const points = Array.from({ length: 6 }).map((_, k) => {
            const a = (Math.PI / 3) * k - Math.PI / 6;
            return vec(cx + hr * Math.cos(a), cy + hr * Math.sin(a));
          });
          return (
            <Group key={r}>
              {points.map((pt, k) => (
                <Line key={k} p1={pt} p2={points[(k + 1) % 6]} color={p} strokeWidth={1.5} />
              ))}
            </Group>
          );
        }
        if (type === 'quilt') {
          return (
            <Group key={r}>
              <Rect x={cell.x} y={cell.y} width={tileSize} height={tileSize} color={p} style="stroke" strokeWidth={1} />
              <Line p1={vec(cell.x, cell.y)} p2={vec(cell.x + tileSize, cell.y + tileSize)} color={p} strokeWidth={0.5} />
              <Line p1={vec(cell.x + tileSize, cell.y)} p2={vec(cell.x, cell.y + tileSize)} color={p} strokeWidth={0.5} />
            </Group>
          );
        }
        if (type === 'scales') {
          return (
            <Group key={r}>
              <Circle cx={cx} cy={cell.y + tileSize * 0.75} r={tileSize * 0.5} color={p} style="stroke" strokeWidth={1.5} />
            </Group>
          );
        }
        if (type === 'cow') {
          if (rand(r, 3) === 0) {
            const blobW = tileSize * (0.4 + rand(r, 4) * 0.1);
            const blobH = tileSize * (0.3 + rand(r * 2, 3) * 0.1);
            return <Rect key={r} x={cx - blobW / 2} y={cy - blobH / 2} width={blobW} height={blobH} color={p} />;
          }
          return null;
        }
        if (type === 'leopard') {
          return (
            <Group key={r}>
              <Circle cx={cx} cy={cy} r={tileSize * 0.18} color={p} />
              <Circle cx={cx + tileSize * 0.2} cy={cy - tileSize * 0.15} r={tileSize * 0.1} color={p} opacity={0.7} />
              <Circle cx={cx - tileSize * 0.2} cy={cy + tileSize * 0.15} r={tileSize * 0.1} color={p} opacity={0.7} />
            </Group>
          );
        }

        return null;
      })}
    </Canvas>
  );
};

/* ============================================================
   FALLBACK PREVIEW IMAGES
   ============================================================ */

const PREVIEW_IMAGES = [
  { uri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=700&q=90' },
  { uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=700&q=90' },
  { uri: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=700&q=90' },
  { uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&q=90' },
  { uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&q=90' },
  { uri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=700&q=90' },
];

/* ============================================================
   SAFE IMAGE SOURCE
   ============================================================ */

const getImageSource = (image: any, fallbackIndex = 0) => {
  if (!image) return PREVIEW_IMAGES[fallbackIndex % PREVIEW_IMAGES.length];
  if (typeof image === 'string') {
    return image.trim().length > 0 ? { uri: image } : PREVIEW_IMAGES[fallbackIndex % PREVIEW_IMAGES.length];
  }
  if (typeof image === 'object') {
    if (typeof image.uri === 'string' && image.uri.trim().length > 0) return { uri: image.uri };
    if (typeof image.path === 'string' && image.path.trim().length > 0) {
      return { uri: image.path.startsWith('file://') ? image.path : `file://${image.path}` };
    }
  }
  return PREVIEW_IMAGES[fallbackIndex % PREVIEW_IMAGES.length];
};

/* ============================================================
   SOUND
   ============================================================ */

const safeHaptic = (pattern: number | number[] = 10) => {
  try {
    SoundManager.haptic(pattern);
  } catch (err) {
    console.warn('[Customize] Haptic failed:', err);
  }
};

/* ============================================================
   QR COMPONENT
   ============================================================ */

const FakeQR = ({ size }: { size: number }) => {
  return (
    <View style={[styles.qr, { width: size, height: size, padding: Math.max(1, size * 0.08) }]}>
      {Array.from({ length: 25 }).map((_, i) => (
        <View key={i} style={[styles.qrDot, { opacity: (i * 7) % 4 === 0 ? 1 : 0.45 }]} />
      ))}
    </View>
  );
};

/* ============================================================
   FILTERED PREVIEW COMPONENT
   ============================================================ */

const FilteredPreview = ({
  uri,
  filter,
  width,
  height,
  shape = 'rectangle',
}: {
  uri: string;
  filter: string;
  width: number;
  height: number;
  shape?: string;
}) => {
  const skiaImage = useImage(uri);

  const matrix = useMemo(() => {
    switch (filter) {
      case 'b&w':
      case 'blackwhite':
        return [
          0.21, 0.72, 0.07, 0, 0.05,
          0.21, 0.72, 0.07, 0, 0.05,
          0.21, 0.72, 0.07, 0, 0.05,
          0,    0,    0,    1, 0
        ];
      case 'vintage':
        return [
          0.6,  0.4,  0.2,  0, 0.1,
          0.3,  0.6,  0.1,  0, 0.05,
          0.2,  0.2,  0.5,  0, 0,
          0,    0,    0,    1, 0
        ];
      case 'warm':
        return [
          1.1, 0,   0,   0, 0.05,
          0,   1.0, 0,   0, 0,
          0,   0,   0.8, 0, 0,
          0,   0,   0,   1, 0
        ];
      case 'cool':
        return [
          0.9, 0,   0,   0, 0,
          0,   0.9, 0,   0, 0.05,
          0,   0,   1.2, 0, 0.1,
          0,   0,   0,   1, 0
        ];
      case 'vivid':
        return [
          1.2, -0.1, -0.1, 0, 0,
          -0.1, 1.2, -0.1, 0, 0,
          -0.1, -0.1, 1.2, 0, 0,
          0,    0,    0,   1, 0
        ];
      default:
        return null;
    }
  }, [filter]);

  const clipPath = useMemo(() => {
    if (shape === 'rectangle') return undefined;
    const path = Skia.Path.Make();
    if (shape === 'circle') {
      const radius = Math.min(width, height) / 2;
      path.addCircle(width / 2, height / 2, radius);
    } else if (shape === 'rounded') {
      const radius = Math.min(width, height) * 0.1;
      path.addRRect(Skia.RRectXY(Skia.XYWHRect(0, 0, width, height), radius, radius));
    } else if (shape === 'heart') {
      path.moveTo(width * 0.5, height * 0.3);
      path.cubicTo(width * 0.5, height * 0.25, width * 0.4, height * 0.1, width * 0.25, height * 0.1);
      path.cubicTo(0, height * 0.1, 0, height * 0.45, 0, height * 0.45);
      path.cubicTo(0, height * 0.65, width * 0.25, height * 0.8, width * 0.5, height * 0.95);
      path.cubicTo(width * 0.75, height * 0.8, width, height * 0.65, width, height * 0.45);
      path.cubicTo(width, height * 0.45, width, height * 0.1, width * 0.75, height * 0.1);
      path.cubicTo(width * 0.6, height * 0.1, width * 0.5, height * 0.25, width * 0.5, height * 0.3);
      path.close();
    }
    return path;
  }, [shape, width, height]);

  if (!skiaImage) {
    return (
      <View style={{ width, height, backgroundColor: '#0a0a0c', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#444" />
      </View>
    );
  }

  const renderImage = () => (
    <SkiaImage image={skiaImage} x={0} y={0} width={width} height={height} fit="cover">
      {matrix && <ColorMatrix matrix={matrix} />}
    </SkiaImage>
  );

  return (
    <Canvas style={{ width, height }}>
      {clipPath ? (
        <Group clip={clipPath}>
          {renderImage()}
        </Group>
      ) : renderImage()}
    </Canvas>
  );
};

/* ============================================================
   CUSTOMIZE SCREEN
   ============================================================ */

export const CustomizeScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useAppTheme();
  const { state, send } = useBooth();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const shortestSide = Math.min(width, height);

  const { params } = route as any;
  const selectedImages = Array.isArray(params?.selectedImages) ? params.selectedImages : [];

  type TabType = 'templates' | 'frames' | 'filters' | 'shapes' | 'stickers';
  const [activeTab, setActiveTab] = useState<TabType>('frames');
  const [photoFilter, setPhotoFilter] = useState<'none' | 'b&w' | 'vintage' | 'warm' | 'cool' | 'vivid'>('none');
  const [frameColor, setFrameColor] = useState('#FFFFFF');
  const [framePatternUrl, setFramePatternUrl] = useState('');
  const [framePatternId, setFramePatternId] = useState('');
  const [selectedPatternCategory, setSelectedPatternCategory] = useState('All');
  const [photoShape, setPhotoShape] = useState('rectangle');
  const [activeStickers, setActiveStickers] = useState<any[]>([]);
  const [overrideBackground, setOverrideBackground] = useState(false);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [customHue, setCustomHue] = useState(0);
  const [customSat, setCustomSat] = useState(100);
  const [customVal, setCustomVal] = useState(100);

  // Derive active background color properly (supports custom picked colors)
  const actualBgColor = frameColor.startsWith('#') ? frameColor : (FRAME_COLORS.find(c => c.hex === frameColor)?.bgColor || '#FFFFFF');
  const [selectedLogo, setSelectedLogo] = useState('');
  const [timeLeft, setTimeLeft] = useState(TIMEOUT);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const expiredRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  const resetTimer = useCallback(() => {
    startedAtRef.current = Date.now();
    setTimeLeft(TIMEOUT);
  }, []);

  const template = state?.context?.selectedTemplate || { id: 'classic', frames: 4, type: 'classic', overlayUrl: undefined };

  const isWidespread = template.id === 'cut-6-h' || template.id === 'widespread' || template.frames === 6;
  const optionType = isWidespread ? 'widespread' : template.frames === 1 ? 'single' : template.frames === 2 ? 'duo' : 'classic';

  const previewImages = selectedImages.length > 0 ? selectedImages : PREVIEW_IMAGES;

  const screenPadding = Math.max(12, Math.min(shortestSide * 0.03, 28));
  const sectionGap = Math.max(12, Math.min(shortestSide * 0.025, 22));

  const eventLogos = useMemo(() => {
    const logos = state?.context?.activeEvent?.logos;
    return Array.isArray(logos) ? logos.filter((logo: any) => typeof logo === 'string' && logo.trim().length > 0) : [];
  }, [state?.context?.activeEvent?.logos]);

  const isFilterEnabled = !state?.context?.activeEvent?.selectedScreens || state.context.activeEvent.selectedScreens.includes('filter');
  const allowedFilters = state?.context?.activeEvent?.allowedFilters || ['none'];

  const legacyTemplates = state?.context?.activeEvent?.allowedTemplates || [];
  
  // Transform new templates (assignedTemplateIds) to match the expected format
  const newTemplates = (state?.context?.activeEvent?.assignedTemplateIds || []).map((t: any, idx: number) => ({
    id: t._id || `temp-${idx}`,
    label: t.name || `TEMPLATE ${idx + 1}`,
    description: t.description || '',
    frames: t.photoSlots?.length || 1,
    orientation: t.orientation === 'landscape' ? 'horizontal' : t.orientation === 'strip' ? 'vertical' : 'vertical',
    overlayUrl: t.background?.assetId 
      ? `https://${process.env.EXPO_PUBLIC_AWS_S3_BUCKET || 'happypix-bucket'}.s3.${process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1'}.amazonaws.com/${t.background.assetId}` 
      : '',
    photoSlots: t.photoSlots || [],
    canvas: t.canvas || { width: 1200, height: 1800 },
    price: null,
    isDefault: false
  }));

  const allowedTemplates = [...legacyTemplates, ...newTemplates];

  /* ==========================================================
     NAVIGATE TO SUCCESS (Dynamic Fallback to Prevent Crashes)
  ========================================================== */

  const navigateToSuccess = (qrUrl: string, printed: boolean) => {
    const navParams = { qrUrl, printed };
    try {
      navigation.replace('OrderSuccess' as any, {
        qrUrl,
        printed,
        shareToken: (navParams as any).shareToken // ensure shareToken is passed down
      });
    } catch (err) {
        navigation.replace('Start' as any);
    }
  };

  /* ==========================================================
     TIMER
  ========================================================== */

  useEffect(() => {
    if (!isFilterEnabled) {
      handleFinish();
    }
  }, [isFilterEnabled]);

  useEffect(() => {
    const id = setInterval(() => {
      const remaining = TIMEOUT - Math.floor((Date.now() - startedAtRef.current) / 1000);
      setTimeLeft(Math.max(0, remaining));

      if (remaining <= 0) {
        clearInterval(id);
        if (!expiredRef.current) {
          expiredRef.current = true;
          try {
            navigation.replace('Start');
          } catch (err) {
            console.error('[CustomizeScreen] Error fetching logos:', err);
          }
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [navigation]);

  /* ==========================================================
     LOGO PROXY
  ========================================================== */

  const getLogoSource = (logo: string) => {
    try {
      const proxied = UploadAPI.proxyLogo(logo);
      return typeof proxied === 'string' && proxied.trim().length > 0 ? { uri: proxied } : null;
    } catch {
      return null;
    }
  };
  const selectedLogoSource = selectedLogo ? getLogoSource(selectedLogo) : null;

  /* ==========================================================
     FILM DIMENSIONS (SlotSelection Matching)
  ========================================================== */

  const calculateFilmGeometry = () => {
    // Generous proportions for both orientations without vertical screen scrolling
    const previewMaxWidth = isLandscape ? width * 0.34 : width * 0.72;
    const previewMaxHeight = isLandscape ? height * 0.68 : height * 0.38;

    let defaultW = 1200;
    let defaultH = 1800;
    if ((template as any).orientation === 'landscape' || (template as any).orientation === 'horizontal') {
      defaultW = 1800;
      defaultH = 1200;
    }
    const canvasW = (template as any).canvas?.width || defaultW;
    const canvasH = (template as any).canvas?.height || defaultH;
    const aspect = canvasH / canvasW;

    let fw = previewMaxWidth;
    let fh = fw * aspect;

    if (fh > previewMaxHeight) {
      fh = previewMaxHeight;
      fw = fh / aspect;
    }

    return { filmWidth: fw, filmHeight: fh, canvasWidth: canvasW, canvasHeight: canvasH };
  };

  const { filmWidth, filmHeight, canvasWidth, canvasHeight } = calculateFilmGeometry();
  const timerUrgent = timeLeft <= 10;
  const isDarkFrame = frameColor === '#000000' || frameColor === '#18181B';

  /* ==========================================================
     FINISH & PRINT PIPELINE
  ========================================================== */

    const handleFinish = async () => {
      if (loading) return;

      try {
        SoundManager.haptic([10, 50, 10]);
        SoundManager.play('click');
      } catch (err) {
        console.warn('[Customize] Sound/Haptic failed:', err);
      }

      setLoading(true);
      setLoadingMessage('DEVELOPING YOUR MEMORIES...');
      
      const printPayload = {
        images: previewImages,
        frameColor: actualBgColor,
        framePatternId,
        framePatternUrl: template?.overlayUrl || framePatternUrl, // Use AI template background if available
        photoShape,
        stickers: activeStickers,
        filter: photoFilter,
        logo: selectedLogo,
        template: state?.context?.selectedTemplate,
      };

      let uploadResult: any = null;
      let printSuccess = true;

      try {
        const eventId = state?.context?.activeEvent?._id;
        
        const includeQR = (route.params as any)?.includeQR;
        const sharingEnabled = state?.context?.activeEvent?.sharingConfig?.enabled !== false;
        const shouldGenerateShareToken = includeQR !== false && sharingEnabled;

        // 1. Generate Share Token & URL First
        let qrUrl = '';
        let shareToken = '';
        try {
          if (eventId && shouldGenerateShareToken) {
            const tokenRes = await UploadAPI.generateShareToken(eventId);
            qrUrl = tokenRes.shareUrl;
            shareToken = tokenRes.token;
          }
        } catch (tokenErr) {
          console.warn('[Customize] Token generation failed:', tokenErr);
        }

        // 2. Compose & Print
        let composedResult: any = null;
        const isPrintEnabled = !state?.context?.activeEvent?.selectedScreens || state.context.activeEvent.selectedScreens.includes('print');
        try {
          composedResult = await renderEngine.compose({
            ...printPayload,
            qr: qrUrl,
          } as any);
          if (isPrintEnabled) {
            await printerManager.print(composedResult);
          }
        } catch (printErr) {
          console.warn('[Customize] Print failed / printer offline:', printErr);
          printSuccess = false;
        }

        setLoading(false);
        setLoadingMessage('');

        // 3. Background Upload Composite Image & Link to Token
        if (composedResult?.bitmap && eventId) {
          // Generate a single session ID so all photos from this session go to the same S3 folder
          const uploadSessionId = `session-${Date.now()}`;
          
          // Fire and forget upload (don't block navigation)
          const uploadPromises = [
            UploadAPI.uploadPhoto(composedResult.bitmap, eventId, true, uploadSessionId)
          ];
          
          if (previewImages && previewImages.length > 0) {
            previewImages.forEach((img: any) => {
              let fileUri = img?.uri || img?.path;
              if (fileUri) {
                if (!fileUri.startsWith('file://') && !fileUri.startsWith('data:')) {
                  fileUri = `file://${fileUri}`;
                }
                uploadPromises.push(UploadAPI.uploadPhoto(fileUri, eventId, false, uploadSessionId));
              }
            });
          }
          
          Promise.allSettled(uploadPromises)
            .then(results => {
              const compositeRes = results[0];
              const compositeUrl = compositeRes.status === 'fulfilled' ? compositeRes.value.url : undefined;
              
              const photoUrls: string[] = [];
              for (let i = 1; i < results.length; i++) {
                const res = results[i];
                if (res.status === 'fulfilled' && res.value.url) {
                  photoUrls.push(res.value.url);
                }
              }
              
              console.log('\n======================================================');
              console.log('📸 [UPLOAD STATUS TO S3] 📸');
              if (compositeUrl) {
                console.log('✅ Final Template (Composite) Uploaded to S3!');
                console.log('🔗 URL:', compositeUrl);
              } else {
                console.log('❌ Final Template (Composite) FAILED to upload!');
              }
              
              console.log(`✅ Successfully uploaded ${photoUrls.length} Raw Photos to S3!`);
              photoUrls.forEach((url, idx) => console.log(`   - Photo ${idx + 1}: ${url}`));
              console.log('======================================================\n');
              
              if (shareToken) {
                console.log(`[Customize] Updating token...`);
                return UploadAPI.updateShareToken(shareToken, { compositeUrl, photoUrls })
                  .then(() => console.log('[Customize] Share token fully updated with all S3 URLs!'));
              }
              return Promise.resolve();
            })
            .catch(bgErr => console.warn('[Customize] Background upload failed:', bgErr));
        }

        const navParams = {
          ...route.params,
          qrUrl,
          downloadUrl: qrUrl,
          shareToken,
          printed: isPrintEnabled ? printSuccess : false,
          printError: (isPrintEnabled && !printSuccess) ? 'The printer is currently offline or disconnected.' : null,
          printPayload: isPrintEnabled && !printSuccess ? printPayload : null,
          eventId: eventId || null
        };

        // 4. Redirect to OrderSuccess
        navigation.replace('OrderSuccess' as any, navParams);
      } catch (error) {
        console.error('[Customize] Finish flow error:', error);
        setLoading(false);
        setLoadingMessage('');
        
        // Show alert for critical structural errors that prevent even navigating
        Alert.alert(
          'Error',
          'Something went wrong processing your request. Please try again.'
        );
      }
    };

  /* ==========================================================
     STRIP PREVIEW
  ========================================================== */

  const renderStripPreview = () => {
    const renderPhotos = () => {
      const slots = (template as any).slots || (template as any).photoSlots || [];
      return slots.map((slot: any, idx: number) => {
        const leftPercent = slot.x / canvasWidth;
        const topPercent = slot.y / canvasHeight;
        const widthPercent = slot.width / canvasWidth;
        const heightPercent = slot.height / canvasHeight;

        const sl = leftPercent * filmWidth;
        const st = topPercent * filmHeight;
        const sw = widthPercent * filmWidth;
        const sh = heightPercent * filmHeight;

        const source = previewImages[idx] ? getImageSource(previewImages[idx], idx) : null;
        const uri = source?.uri || '';

        return (
          <View key={idx} style={[styles.filmPhoto, { position: 'absolute', left: sl, top: st, width: sw, height: sh }]}>
            {uri ? (
              <FilteredPreview uri={uri} filter={photoFilter} width={sw} height={sh} shape={photoShape} />
            ) : (
              <View style={{ width: sw, height: sh, backgroundColor: 'rgba(226, 232, 240, 0.8)', borderWidth: 2, borderColor: '#94a3b8', borderStyle: 'dashed' }} />
            )}
          </View>
        );
      });
    };

    const actualBgColor = FRAME_COLORS.find(c => c.hex === frameColor)?.bgColor || (frameColor.startsWith('pat_') ? '#FFFFFF' : frameColor);
    const selectedPattern = (CURATED_PATTERNS as any).find((p: any) => p.id === framePatternId) || PATTERNS.find(p => p.id === framePatternId);
    
    // Template overlay URL (from CRM design) — rendered as absolute Image BEHIND photos
    const templateOverlayUrl = (template as any)?.overlayUrl || '';
    // User-selected pattern/colour background URL
    const activeBackgroundUrl = !templateOverlayUrl ? framePatternUrl : '';
    const useImageBg = !!activeBackgroundUrl && !selectedPattern;
    const PreviewContainer = (useImageBg ? ImageBackground : View) as React.ElementType;
    const containerProps = useImageBg 
      ? { source: { uri: activeBackgroundUrl }, style: [styles.film, { width: filmWidth, height: filmHeight, backgroundColor: actualBgColor }], imageStyle: { resizeMode: 'cover' } } 
      : { style: [styles.film, { width: filmWidth, height: filmHeight, backgroundColor: actualBgColor, overflow: 'hidden' }] };

    return (
      <PreviewContainer {...containerProps as any}>
        {selectedPattern && selectedPattern.id !== 'none' && (
          <View style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            {selectedPattern.type === 'procedural' || (selectedPattern as any).skiaType ? (
              <TileableProceduralPattern type={(selectedPattern as any).skiaType} p={(selectedPattern as any).primary || '#000'} s={(selectedPattern as any).secondary || actualBgColor} width={filmWidth} height={filmHeight} />
            ) : selectedPattern.asset ? (
              <Image source={selectedPattern.asset} style={{ width: '100%', height: '100%' }} resizeMode="repeat" />
            ) : (
              <View style={{ flex: 1, backgroundColor: actualBgColor, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center', opacity: 0.5 }}>{(selectedPattern as any).placeholderName || (selectedPattern as any).name}</Text>
              </View>
            )}
          </View>
        )}

        {/* CRM TEMPLATE OVERLAY — rendered AS A GLOBAL BACKGROUND BEHIND photos */}
        {!!templateOverlayUrl && !overrideBackground && (
          <Image
            source={{ uri: templateOverlayUrl }}
            style={{ position: 'absolute', top: 0, left: 0, width: filmWidth, height: filmHeight }}
            resizeMode="stretch"
          />
        )}

        {/* PHOTO GRID / STACK (ABSOLUTE PLACEMENT) — renders ON TOP of the global background */}
        <View style={StyleSheet.absoluteFill}>
          {renderPhotos()}
        </View>

        {/* STICKERS OVERLAY */}
        {activeStickers.map(sticker => (
          <DraggableSticker
            key={sticker.id}
            sticker={sticker}
            onUpdate={(id: string, x: number, y: number) => {
              setActiveStickers(prev => prev.map(s => s.id === id ? { ...s, x, y } : s));
            }}
            onRemove={(id: string) => {
              setActiveStickers(prev => prev.filter(s => s.id !== id));
            }}
          />
        ))}

        {/* MATHEMATICAL FOOTER PREVIEW (15% of Height) */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: filmHeight * 0.15, paddingHorizontal: filmWidth * 0.05, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Event Logo (Left) */}
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            {selectedLogoSource && (
              <Image 
                source={selectedLogoSource} 
                style={{ width: filmWidth * 0.3, height: filmHeight * 0.15 * 0.6 }} 
                resizeMode="contain" 
              />
            )}
          </View>

          {/* Tagline (Center) */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            {(state?.context?.activeEvent as any)?.tagline ? (
              <Text style={{ fontStyle: 'italic', fontWeight: 'bold', fontSize: filmHeight * 0.035, color: isDarkFrame ? '#FFFFFF' : '#222222' }} numberOfLines={1}>
                {(state.context.activeEvent as any).tagline}
              </Text>
            ) : null}
          </View>

          {/* Company Brand (Right) */}
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ fontWeight: '900', fontSize: filmHeight * 0.028, color: isDarkFrame ? '#FFFFFF' : '#444444' }}>
              HAPPY PIX
            </Text>
          </View>

        </View>
      </PreviewContainer>
    );
  };

  /* ==========================================================
     TEMPLATES LIST (Integrated inside customization tabs)
  ========================================================== */

  const renderTemplates = () => {
    if (allowedTemplates.length === 0) {
      return (
        <View style={styles.emptyDesigns}>
          <Text style={[styles.emptyDesignText, { color: theme.colors.textSecondary }]}>NO TEMPLATES AVAILABLE</Text>
        </View>
      );
    }
    return (
      <View style={styles.templatesContainer}>
        {allowedTemplates.map((tmpl: any, index: number) => {
          const active = state?.context?.selectedTemplate?.id === tmpl.id;
          const thumbUrl = tmpl.overlayUrl || '';
          const tmplPrice = getTemplatePrice(tmpl, state?.context?.activeEvent);

          return (
            <TouchableOpacity
              key={`${tmpl.id}-${index}`}
              activeOpacity={0.8}
              onPress={() => {
                safeHaptic(10);
                send({ type: 'TEMPLATE_SELECTED', template: tmpl });
                setOverrideBackground(false);
              }}
              style={[
                styles.templateCardItem,
                { backgroundColor: theme.colors.surfaceSecondary },
                active && { borderColor: theme.colors.primary, borderWidth: 2.5 },
              ]}
            >
              {thumbUrl ? (
                <View style={[styles.templateThumbImg, { overflow: 'hidden' }]}>
                  <Image source={{ uri: thumbUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  {(tmpl.photoSlots || tmpl.slots || []).map((s: any, i: number) => (
                    <View key={i} style={{
                      position: 'absolute',
                      left: `${(s.x / (tmpl.canvas?.width || 1200)) * 100}%`,
                      top: `${(s.y / (tmpl.canvas?.height || 1800)) * 100}%`,
                      width: `${(s.width / (tmpl.canvas?.width || 1200)) * 100}%`,
                      height: `${(s.height / (tmpl.canvas?.height || 1800)) * 100}%`,
                      backgroundColor: 'rgba(226, 232, 240, 0.7)',
                      borderWidth: 0.5,
                      borderColor: '#94a3b8',
                      borderStyle: 'dashed'
                    }} />
                  ))}
                </View>
              ) : (
                <View style={[styles.templateThumbImg, { backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: fontSize(22) }}>🖼️</Text>
                </View>
              )}
              <View style={styles.templateInfoWrap}>
                <Text
                  style={[styles.templateItemText, { color: active ? theme.colors.primary : theme.colors.text }]}
                  numberOfLines={1}
                >
                  {tmpl.label}
                </Text>
                {tmplPrice > 0 && (
                  <View style={[styles.templatePriceBadge, active && { backgroundColor: theme.colors.primary }]}>
                    <Text style={[styles.templatePriceText, active && { color: '#fff' }]}>₹{tmplPrice}</Text>
                  </View>
                )}
              </View>

              {active && (
                <View style={[styles.logoCheck, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.logoCheckText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  /* ==========================================================
     CONTROLS
  ========================================================== */

  const renderCustomizationPanel = () => {
    const tabs: { id: TabType; label: string }[] = [
      ...(allowedTemplates.length > 0 ? [{ id: 'templates' as const, label: 'TEMPLATES'}] : []),
      { id: 'frames' as const, label: 'FRAMES' },
      { id: 'filters' as const, label: 'FILTERS' },
      { id: 'shapes' as const, label: 'SHAPES' },
      { id: 'stickers' as const, label: 'STICKERS' },
    ];

    return (
      <View style={styles.panelInner}>
        {/* TABS HEADER */}
        <View style={styles.tabContainer}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.8}
                onPress={() => {
                  safeHaptic(10);
                  setActiveTab(tab.id);
                }}
                style={[
                  styles.tabButton,
                  active && { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    { color: active ? '#FFF' : theme.colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TAB CONTENT (SCROLLABLE INSIDE PANEL IF NEEDED) */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.panelScrollContent}
        >
          {/* TEMPLATES TAB */}
          {activeTab === 'templates' && (
            <View style={styles.controlSection}>
              <Text style={[styles.controlLabel, { color: theme.colors.textSecondary }]}>SELECT PHOTOSTRIP TEMPLATE</Text>
              {renderTemplates()}
            </View>
          )}

          {/* FRAMES TAB */}
          {activeTab === 'frames' && (
            <View style={styles.controlSection}>
              {/* COLORS */}
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.controlLabel, { color: theme.colors.textSecondary }]}>SOLID COLORS</Text>
              </View>
              <View style={styles.colorGrid}>
                {FRAME_COLORS.map((color) => {
                  const active = frameColor === color.hex && !framePatternId;

                  if (color.hex === 'universal') {
                    return (
                      <TouchableOpacity
                        key="universal"
                        activeOpacity={0.8}
                        onPress={() => {
                          safeHaptic(10);
                          setColorPickerVisible(true);
                        }}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: '#FFF', overflow: 'hidden' },
                          active && { borderColor: theme.colors.primary, borderWidth: 3 },
                        ]}
                      >
                        <Canvas style={{ width: '100%', height: '100%' }}>
                          <Circle cx={scale(18)} cy={scale(18)} r={scale(18)}>
                            <SweepGradient
                              c={vec(scale(18), scale(18))}
                              colors={['#ff0000', '#ff00ff', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']}
                            />
                          </Circle>
                        </Canvas>
                      </TouchableOpacity>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={color.hex}
                      activeOpacity={0.8}
                      onPress={() => {
                        safeHaptic(10);
                        setFrameColor(color.hex);
                        setFramePatternId('');
                        setFramePatternUrl('');
                        setOverrideBackground(true);
                      }}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color.hex },
                        active && { borderColor: theme.colors.primary, borderWidth: 3 },
                      ]}
                    />
                  );
                })}
              </View>

              {/* CURATED PATTERNS */}
              <View style={[styles.sectionHeaderRow, { marginTop: verticalScale(14) }]}>
                <Text style={[styles.controlLabel, { color: theme.colors.textSecondary }]}>CURATED PATTERNS</Text>
                {framePatternId ? (
                  <TouchableOpacity
                    onPress={() => {
                      safeHaptic(10);
                      setFramePatternId('');
                      setFramePatternUrl('');
                      setOverrideBackground(true);
                    }}
                    style={styles.clearBadge}
                  >
                    <Text style={[styles.clearBadgeText, { color: theme.colors.primary }]}>RESET TO SOLID</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.curatedPatternGrid}>
                {CURATED_PATTERNS.map((p) => {
                  const isNone = p.id === 'none';
                  const active = isNone ? !framePatternId : framePatternId === p.id;

                  return (
                    <TouchableOpacity
                      key={p.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        safeHaptic(10);
                        if (isNone) {
                          setFramePatternId('');
                          setFramePatternUrl('');
                        } else {
                          setFramePatternId(p.id);
                          setFramePatternUrl('');
                        }
                        setOverrideBackground(true);
                      }}
                      style={[
                        styles.patternCard,
                        { backgroundColor: theme.colors.surfaceSecondary },
                        active && { borderColor: theme.colors.primary, borderWidth: 2.5 },
                      ]}
                    >
                      <View style={styles.patternIconContainer}>
                        {isNone ? (
                          <View style={[styles.patternCirclePreview, { backgroundColor: actualBgColor, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ fontSize: fontSize(13), color: isDarkFrame ? '#FFF' : '#333' }}>⊘</Text>
                          </View>
                        ) : (
                          <View style={[styles.patternCirclePreview, { backgroundColor: p.secondary || '#FFF', overflow: 'hidden' }]}>
                            <TileableProceduralPattern
                              type={(p as any).skiaType}
                              p={(p as any).primary || '#000'}
                              s={(p as any).secondary || '#FFF'}
                              width={scale(36)}
                              height={scale(36)}
                            />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.patternLabelText,
                          { color: active ? theme.colors.primary : theme.colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* FILTERS TAB */}
          {activeTab === 'filters' && (
            <View style={styles.controlSection}>
              <Text style={[styles.controlLabel, { color: theme.colors.textSecondary }]}>PHOTO FILTER PRESETS</Text>
              <View style={styles.filterGrid}>
                {([
                  { id: 'none',    label: 'ORIGINAL', emoji: '○', desc: 'True color' },
                  { id: 'b&w',     label: 'B & W',    emoji: '◑', desc: 'Monochrome' },
                  { id: 'vintage', label: 'VINTAGE',  emoji: '◈', desc: 'Retro film' },
                  { id: 'warm',    label: 'WARM',     emoji: '◉', desc: 'Golden glow' },
                  { id: 'cool',    label: 'COOL',     emoji: '◎', desc: 'Ocean tone' },
                  { id: 'vivid',   label: 'VIVID',    emoji: '◍', desc: 'High pop' },
                ] as const).map(f => {
                  const active = photoFilter === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      activeOpacity={0.8}
                      onPress={() => { safeHaptic(10); setPhotoFilter(f.id); }}
                      style={[
                        styles.filterCard,
                        { backgroundColor: active ? theme.colors.primary : theme.colors.surfaceSecondary },
                      ]}
                    >
                      <Text style={{ fontSize: fontSize(18), color: active ? '#FFF' : theme.colors.text }}>{f.emoji}</Text>
                      <Text style={[styles.filterCardLabel, { color: active ? '#FFF' : theme.colors.text }]}>{f.label}</Text>
                      <Text style={[styles.filterCardDesc, { color: active ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary }]}>{f.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* SHAPES TAB */}
          {activeTab === 'shapes' && (
            <View style={styles.controlSection}>
              <Text style={[styles.controlLabel, { color: theme.colors.textSecondary }]}>FRAME CUTOUT SHAPE</Text>
              <View style={styles.shapesGrid}>
                {PHOTO_SHAPES.map(shape => {
                  const active = photoShape === shape.id;
                  const labelMap: Record<string, string> = {
                    rectangle: 'CLASSIC RECT',
                    rounded: 'ROUNDED',
                    circle: 'CIRCULAR',
                    heart: 'HEART BEAT',
                  };
                  return (
                    <TouchableOpacity
                      key={shape.id}
                      activeOpacity={0.8}
                      onPress={() => { safeHaptic(10); setPhotoShape(shape.id); }}
                      style={[
                        styles.shapeCard,
                        { backgroundColor: active ? theme.colors.primary : theme.colors.surfaceSecondary },
                      ]}
                    >
                      <Text style={{ fontSize: fontSize(22), color: active ? '#FFFFFF' : theme.colors.text }}>{shape.icon}</Text>
                      <Text style={[styles.shapeCardText, { color: active ? '#FFFFFF' : theme.colors.text }]}>
                        {labelMap[shape.id] || shape.id.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* STICKERS TAB */}
          {activeTab === 'stickers' && (
            <View style={styles.controlSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.controlLabel, { color: theme.colors.textSecondary }]}>STICKERS & EMOJIS</Text>
                {activeStickers.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      safeHaptic(10);
                      setActiveStickers([]);
                    }}
                    style={styles.clearBadge}
                  >
                    <Text style={[styles.clearBadgeText, { color: theme.colors.error }]}>CLEAR ALL ({activeStickers.length})</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.controlSubNote, { color: theme.colors.textSecondary }]}>Tap sticker to add • Drag on strip to position</Text>
              <View style={styles.stickerGrid}>
                {STICKERS.map((sticker) => (
                  <TouchableOpacity
                    key={sticker.id}
                    activeOpacity={0.8}
                    onPress={() => {
                      safeHaptic(10);
                      setActiveStickers(prev => [
                        ...prev,
                        { id: `${sticker.id}_${Date.now()}`, url: sticker.url, emoji: sticker.emoji, x: filmWidth / 2 - 30, y: filmHeight / 2 - 30, width: 60, height: 60 }
                      ]);
                    }}
                    style={[styles.stickerItem, { backgroundColor: theme.colors.surfaceSecondary }]}
                  >
                    {sticker.emoji ? (
                      <Text style={{ fontSize: fontSize(20) }}>{sticker.emoji}</Text>
                    ) : (
                      <Image source={{ uri: sticker.url }} style={{ width: '75%', height: '75%' }} resizeMode="contain" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* CUSTOM COLOR PICKER MODAL */}
        <Modal visible={colorPickerVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, width: 250, justifyContent: 'space-between' }}>
                <Text style={styles.modalTitle}>Choose a Color</Text>
                <View style={[styles.colorPreview, { backgroundColor: hsvToHex(customHue, customSat, customVal), width: 40, height: 40, borderRadius: 20, marginBottom: 0, marginTop: -20 }]} />
              </View>
              
              {/* 2D SV Color Picker */}
              <View 
                style={{ width: 250, height: 250, borderRadius: 10, marginBottom: 20, overflow: 'hidden', position: 'relative' }}
                {...PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onPanResponderGrant: (evt) => {
                    setCustomSat(Math.max(0, Math.min(100, (evt.nativeEvent.locationX / 250) * 100)));
                    setCustomVal(Math.max(0, Math.min(100, 100 - (evt.nativeEvent.locationY / 250) * 100)));
                  },
                  onPanResponderMove: (evt) => {
                    setCustomSat(Math.max(0, Math.min(100, (evt.nativeEvent.locationX / 250) * 100)));
                    setCustomVal(Math.max(0, Math.min(100, 100 - (evt.nativeEvent.locationY / 250) * 100)));
                  }
                }).panHandlers}
              >
                <Canvas style={{ width: 250, height: 250 }}>
                  <Rect key="base-hue" x={0} y={0} width={250} height={250} color={`hsl(${customHue}, 100%, 50%)`} />
                  <Rect key="sat-layer" x={0} y={0} width={250} height={250}>
                    <LinearGradient start={vec(0,0)} end={vec(250,0)} colors={['#ffffff', 'transparent']} />
                  </Rect>
                  <Rect key="val-layer" x={0} y={0} width={250} height={250}>
                    <LinearGradient start={vec(0,0)} end={vec(0,250)} colors={['transparent', '#000000']} />
                  </Rect>
                </Canvas>
                <View style={{ position: 'absolute', left: (customSat / 100) * 250 - 10, top: ((100 - customVal) / 100) * 250 - 10, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3, elevation: 5 }} />
              </View>
              
              {/* Hue Slider */}
              <View 
                style={styles.sliderContainer}
                {...PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onPanResponderGrant: (evt) => {
                    setCustomHue(Math.max(0, Math.min(360, (evt.nativeEvent.locationX / 250) * 360)));
                  },
                  onPanResponderMove: (evt) => {
                    setCustomHue(Math.max(0, Math.min(360, (evt.nativeEvent.locationX / 250) * 360)));
                  }
                }).panHandlers}
              >
                <Canvas style={{ width: 250, height: 40, borderRadius: 20 }}>
                  <Rect x={0} y={0} width={250} height={40}>
                    <LinearGradient
                      start={vec(0, 0)} end={vec(250, 0)}
                      colors={['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#00ff00', '#ffff00', '#ff0000']}
                    />
                  </Rect>
                </Canvas>
                <View style={[styles.sliderThumb, { left: (customHue / 360) * 250 - 15 }]} />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: '#ddd' }]} 
                  onPress={() => setColorPickerVisible(false)}
                >
                  <Text style={[styles.modalButtonText, { color: '#333' }]}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalButton} 
                  onPress={() => {
                    const chosenHex = hsvToHex(customHue, customSat, customVal);
                    setFrameColor(chosenHex);
                    setFramePatternUrl('');
                    setColorPickerVisible(false);
                  }}
                >
                  <Text style={styles.modalButtonText}>APPLY COLOR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  if (!isFilterEnabled) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.text, marginTop: 16, fontSize: 18, fontWeight: '800' }}>
            PROCESSING YOUR PHOTOS...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          resetTimer();
          return false;
        }}
      >
        <LayoutContainer
          contentContainerStyle={[
            styles.layout,
            { paddingHorizontal: screenPadding, paddingTop: screenPadding * 0.8, paddingBottom: screenPadding * 0.8 },
          ] as any}
        >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <View style={[styles.headerDot, { backgroundColor: theme.colors.primary }]} />
            <Text style={[styles.headerCaption, { color: theme.colors.textSecondary }]}>CUSTOMIZE</Text>
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>PERSONALIZE YOUR STRIP</Text>
          <View style={[styles.timerPill, { backgroundColor: timerUrgent ? theme.colors.error : theme.colors.error + '25' }]}>
            <Text style={[styles.timerText, { color: timerUrgent ? '#ffffff' : theme.colors.error }]}>⏱ {timeLeft}s</Text>
          </View>
        </View>

        {/* WORKSPACE: 2 COLUMNS IN LANDSCAPE, TOP-BOTTOM IN PORTRAIT */}
        <View style={[styles.workspace, isLandscape ? styles.workspaceLandscape : styles.workspacePortrait, { gap: sectionGap }]}>
          {isLandscape ? (
            <>
              {/* LEFT: CUSTOMIZATION CONTROLS */}
              <View style={styles.controlsColumnLandscape}>
                <GlassCard style={styles.controlCard}>
                  {renderCustomizationPanel()}
                </GlassCard>
              </View>

              {/* RIGHT: LIVE PREVIEW STAGE */}
              <View style={styles.previewColumnLandscape}>
                <View style={styles.previewHeaderWrap}>
                  <Text style={[styles.previewCaption, { color: theme.colors.textSecondary }]}>LIVE PREVIEW</Text>
                </View>
                <View style={styles.previewStage}>
                  {renderStripPreview()}
                </View>
              </View>
            </>
          ) : (
            <>
              {/* TOP: LIVE PREVIEW STAGE (PORTRAIT) */}
              <View style={styles.previewColumnPortrait}>
                <View style={styles.previewHeaderWrap}>
                  <Text style={[styles.previewCaption, { color: theme.colors.textSecondary }]}>LIVE PREVIEW</Text>
                </View>
                <View style={styles.previewStagePortrait}>
                  {renderStripPreview()}
                </View>
              </View>

              {/* BOTTOM: CUSTOMIZATION CONTROLS (PORTRAIT) */}
              <View style={styles.controlsColumnPortrait}>
                <GlassCard style={styles.controlCardPortrait}>
                  {renderCustomizationPanel()}
                </GlassCard>
              </View>
            </>
          )}
        </View>

        {/* FOOTER ACTIONS */}
        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.backButton, { backgroundColor: theme.colors.surfaceSecondary }]}
            onPress={() => {
              try { navigation.replace('PhotoSelection', params); } catch (err) { console.error('[CustomizeScreen] Navigation replace error:', err); }
            }}
          >
            <Text style={[styles.backButtonText, { color: theme.colors.text }]}>← BACK</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={loading}
            style={[styles.printButton, { backgroundColor: theme.colors.primary, opacity: loading ? 0.6 : 1 }]}
            onPress={handleFinish}
          >
            <Text style={styles.printButtonText}>PRINT NOW</Text>
            <Text style={styles.printArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* INACTIVITY WARNING */}
        <InactivityToast visible={timeLeft <= 10} />

        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: 'rgba(0,0,0,0.78)' }]}>
            <View style={[styles.loadingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.text }]}>{loadingMessage}</Text>
              <Text style={[styles.loadingSubText, { color: theme.colors.textSecondary }]}>PLEASE WAIT</Text>
            </View>
          </View>
        )}
      </LayoutContainer>
      </View>
    </ScreenContainer>
  );
};

/* ==============================================================
   STYLES
   ============================================================== */

const styles = StyleSheet.create({
  layout: { flex: 1, justifyContent: 'space-between' },
  header: {
    width: '100%',
    minHeight: verticalScale(38),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(4),
  },
  headerSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  headerDot: { width: scale(8), height: scale(8), borderRadius: scale(4) },
  headerCaption: { fontSize: fontSize(10), fontWeight: '900', letterSpacing: 1.5 },
  title: { fontSize: fontSize(18), fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  timerPill: {
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(14),
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: { fontSize: fontSize(12), fontWeight: '900' },

  // Workspace Setup
  workspace: { flex: 1, minHeight: 0, width: '100%', marginVertical: verticalScale(8) },
  workspaceLandscape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  workspacePortrait: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },

  // Landscape Columns
  controlsColumnLandscape: { flex: 1.15, height: '100%', minWidth: 0 },
  previewColumnLandscape: { flex: 1.0, height: '100%', minWidth: 0, alignItems: 'center', justifyContent: 'center' },

  // Portrait Columns
  previewColumnPortrait: { flex: 0.95, width: '100%', minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  controlsColumnPortrait: { flex: 1.05, width: '100%', minHeight: 0 },

  // Control Cards (GlassCard)
  controlCard: {
    flex: 1,
    width: '100%',
    height: '100%',
    padding: moderateScale(14),
    borderRadius: moderateScale(16),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  controlCardPortrait: {
    flex: 1,
    width: '100%',
    padding: moderateScale(12),
    borderRadius: moderateScale(16),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  panelInner: { flex: 1 },
  panelScrollContent: { paddingVertical: verticalScale(4), gap: verticalScale(12) },

  // Tabs Header
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: moderateScale(22),
    padding: scale(3),
    marginBottom: verticalScale(8),
    gap: scale(3),
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(4),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(18),
  },
  tabButtonText: { fontSize: fontSize(9), fontWeight: '900', letterSpacing: 0.8 },

  // Section Headers
  controlSection: { width: '100%' },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(8),
    paddingHorizontal: scale(2),
  },
  controlLabel: {
    fontSize: fontSize(10),
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  controlSubNote: {
    fontSize: fontSize(9),
    fontWeight: '600',
    marginBottom: verticalScale(8),
    paddingHorizontal: scale(2),
  },
  clearBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  clearBadgeText: { fontSize: fontSize(8), fontWeight: '800', letterSpacing: 0.5 },

  // Swatches: Colors
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    paddingHorizontal: scale(2),
  },
  colorCircle: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Curated patterns grid (3 columns, very clean card format)
  curatedPatternGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    paddingHorizontal: scale(2),
  },
  patternCard: {
    width: '31%',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(6),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: verticalScale(4),
  },
  patternIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    overflow: 'hidden',
  },
  patternCirclePreview: {
    width: '100%',
    height: '100%',
    borderRadius: scale(18),
  },
  patternLabelText: {
    fontSize: fontSize(8),
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  // Templates inside Customization Panel
  templatesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
    paddingHorizontal: scale(2),
  },
  templateCardItem: {
    width: '48%',
    padding: moderateScale(10),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    position: 'relative',
  },
  templateThumbImg: {
    width: '100%',
    height: verticalScale(80),
    borderRadius: moderateScale(8),
    marginBottom: verticalScale(6),
  },
  templateInfoWrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  templateItemText: {
    fontSize: fontSize(10),
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    flex: 1,
  },
  templatePriceBadge: {
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(4),
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginLeft: scale(4),
  },
  templatePriceText: { fontSize: fontSize(9), fontWeight: '900' },
  logoCheck: {
    position: 'absolute',
    top: scale(6),
    right: scale(6),
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  logoCheckText: { color: '#FFF', fontSize: fontSize(10), fontWeight: '900' },
  emptyDesigns: { alignItems: 'center', justifyContent: 'center', paddingVertical: verticalScale(20) },
  emptyDesignText: { fontSize: fontSize(10), fontWeight: '900', letterSpacing: 1.5 },

  // Filters Grid
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    paddingHorizontal: scale(2),
  },
  filterCard: {
    width: '31%',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(6),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    gap: verticalScale(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterCardLabel: {
    fontSize: fontSize(9),
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: verticalScale(2),
  },
  filterCardDesc: {
    fontSize: fontSize(7),
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Shapes Grid
  shapesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
    paddingHorizontal: scale(2),
  },
  shapeCard: {
    width: '48%',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(10),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    gap: verticalScale(6),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  shapeCardText: {
    fontSize: fontSize(10),
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Stickers Grid
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    paddingHorizontal: scale(2),
  },
  stickerItem: {
    width: scale(46),
    height: scale(46),
    borderRadius: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // Color picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: scale(280), backgroundColor: '#1C1C1F', borderRadius: moderateScale(20), padding: scale(20), alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  modalTitle: { fontSize: fontSize(16), fontWeight: 'bold', color: '#FFF' },
  colorPreview: { width: scale(36), height: scale(36), borderRadius: scale(18) },
  sliderContainer: { width: 250, height: 36, borderRadius: 18, position: 'relative', marginBottom: 20 },
  sliderThumb: { position: 'absolute', top: -4, width: 26, height: 44, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#DDD' },
  modalButton: { backgroundColor: '#8B5CF6', paddingVertical: verticalScale(10), paddingHorizontal: scale(20), borderRadius: moderateScale(20) },
  modalButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: fontSize(12), letterSpacing: 1 },

  // Live preview stage
  previewHeaderWrap: { marginBottom: verticalScale(4), alignItems: 'center' },
  previewCaption: { fontSize: fontSize(9), fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  previewStage: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  previewStagePortrait: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },

  // Film styling
  film: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: moderateScale(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  filmPhoto: { overflow: 'hidden', backgroundColor: 'transparent' },

  // QR
  qr: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#FFFFFF' },
  qrDot: { width: '20%', height: '20%', backgroundColor: '#111111' },

  // Footer Actions
  footer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: verticalScale(6),
  },
  backButton: {
    minWidth: scale(110),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(26),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { fontSize: fontSize(12), fontWeight: '900', letterSpacing: 1 },
  printButton: {
    minWidth: scale(160),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(28),
    borderRadius: moderateScale(16),
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  printButtonText: { color: '#FFFFFF', fontSize: fontSize(13), fontWeight: '900', letterSpacing: 1 },
  printArrow: { color: '#FFFFFF', fontSize: fontSize(13), fontWeight: '900', marginLeft: scale(8) },

  loadingOverlay: { ...(StyleSheet.absoluteFill as any), zIndex: 9999, alignItems: 'center', justifyContent: 'center' },
  loadingCard: { minWidth: scale(260), paddingVertical: verticalScale(26), paddingHorizontal: scale(30), borderRadius: moderateScale(20), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: verticalScale(14), fontSize: fontSize(14), fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  loadingSubText: { marginTop: verticalScale(4), fontSize: fontSize(8), fontWeight: '800', letterSpacing: 2 },
});