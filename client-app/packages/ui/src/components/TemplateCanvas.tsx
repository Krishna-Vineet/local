import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  ImageBackground,
  StyleProp,
} from 'react-native';
import type { BoothTemplate, CapturedPhoto, Customization, OrnamentId, FilterId } from '@happypix/types';
import { FilteredImage } from './FilteredImage';
import { resolvePhotoSlots, slotFractions } from '../utils/photoSlots';

interface TemplateCanvasProps {
  template: BoothTemplate;
  photos?: CapturedPhoto[];
  customization?: Customization;
  interactiveSlot?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  containerWidth?: number;
  renderStickers?: boolean;
  /** slot the guest is currently filling; drawn with a pink ring */
  activeSlotIndex?: number;
}

const defaultCustomization: Customization = {
  ornament: 'none',
  filter: 'original',
  logo: null,
  title: '',
  subtitle: '',
  stickers: [],
};

/**
 * Last-resort tint when the Skia colour matrix has not loaded yet.
 *
 * Deliberately neutral and weak: a heavy wash over a colour photo is not a
 * filter, and a dark one made "B&W" read as a dimmed picture rather than a
 * grayscale one. The real conversion happens in `FilteredImage`; this only
 * hints at the change for the frame or two before it is ready.
 */
const getFilterOverlay = (filter: FilterId): ViewStyle | null => {
  switch (filter) {
    case 'bw':
      return { backgroundColor: 'rgba(255, 255, 255, 0.06)' };
    case 'warm':
      return { backgroundColor: 'rgba(245, 158, 11, 0.10)' };
    case 'cool':
      return { backgroundColor: 'rgba(14, 165, 233, 0.10)' };
    case 'vintage':
      return { backgroundColor: 'rgba(180, 115, 50, 0.12)' };
    case 'soft':
      return { backgroundColor: 'rgba(255, 255, 255, 0.10)' };
    case 'party':
      return { backgroundColor: 'rgba(236, 72, 153, 0.10)' };
    default:
      return null;
  }
};

const DESIGNER_PRESETS: Record<string, any> = {
  ClassicPostcard: {
    background: { type: 'solid', colors: ['#FFFFFF'] },
    accent: '#2A2338',
    textColor: '#191424',
    ornament: 'frame',
    slotShape: 'rect',
    title: 'HAPPYPIX',
  },
  MinimalMono: {
    background: { type: 'solid', colors: ['#FAFAF8'] },
    accent: '#191424',
    textColor: '#403952',
    ornament: 'none',
    slotShape: 'rect',
    title: 'UNTITLED',
  },
  PanoramaStory: {
    background: { type: 'gradient', colors: ['#241E33', '#14101F'] },
    accent: '#A99BE8',
    textColor: '#FFFFFF',
    ornament: 'none',
    slotShape: 'round',
    title: 'PANORAMA',
  },
  RoyalWedding: {
    background: { type: 'gradient', colors: ['#5F4CAA', '#3A3170'] },
    accent: '#D9B44A',
    textColor: '#F3D9A4',
    ornament: 'flourish',
    slotShape: 'arch',
    titleBand: true,
    title: 'Royal Wedding',
  },
  VintageBookmark: {
    background: { type: 'solid', colors: ['#F5EEDC'] },
    accent: '#6B5B3E',
    textColor: '#4C3F26',
    ornament: 'dots',
    slotShape: 'rect',
    title: 'A Keepsake',
  },
  GalaGold: {
    background: { type: 'solid', colors: ['#191420'] },
    accent: '#D9B44A',
    textColor: '#F3D9A4',
    ornament: 'frame',
    slotShape: 'rect',
    title: 'Gala Night',
    subtitle: 'Presented with joy',
  },
  FestiveMaroon: {
    background: { type: 'solid', colors: ['#6E1F2A'] },
    accent: '#D9B44A',
    textColor: '#FFE9D6',
    ornament: 'stripes',
    slotShape: 'round',
    titleBand: true,
    title: 'Festive Wishes',
  },
  LegacyGuestbook: {
    background: { type: 'gradient', colors: ['#1E3E70', '#12264A'] },
    accent: '#D9B44A',
    textColor: '#F3D9A4',
    ornament: 'frame',
    slotShape: 'round',
    titleBand: true,
    title: 'The Guest Book',
  },
  NeonParty: {
    background: { type: 'gradient', colors: ['#EA097F', '#5F4CAA'] },
    accent: '#FF7AC1',
    textColor: '#FFFFFF',
    ornament: 'glow',
    slotShape: 'round',
    title: 'NEON NIGHT',
  },
  SunsetStrip: {
    background: { type: 'gradient', colors: ['#F7B733', '#EA097F'] },
    accent: '#FFFFFF',
    textColor: '#FFFFFF',
    ornament: 'dots',
    slotShape: 'round',
    title: 'SUNSET',
  },
  FilmStrip: {
    background: { type: 'solid', colors: ['#141414'] },
    accent: '#FFB000',
    textColor: '#FFB000',
    ornament: 'sprockets',
    slotShape: 'rect',
    title: 'HAPPYPIX FILM',
    subtitle: 'FRAME 04 · 2026',
  },
  CollectorReel: {
    background: { type: 'gradient', colors: ['#DFF2F2', '#B7DFDF'] },
    accent: '#0E7490',
    textColor: '#0B5D73',
    ornament: 'frame',
    slotShape: 'round',
    title: 'COLLECTOR 2026',
  },
  KidsSplash: {
    background: { type: 'gradient', colors: ['#DDEBFF', '#FFE9F2'] },
    accent: '#2A6FBE',
    textColor: '#2A6FBE',
    ornament: 'dots',
    slotShape: 'round',
    title: 'Splash Time!',
  },
  CorporateGrid: {
    background: { type: 'solid', colors: ['#FFFFFF'] },
    accent: '#3871C1',
    textColor: '#403952',
    ornament: 'headerBand',
    slotShape: 'round',
    titleBand: true,
    title: 'Team Offsite 2026',
    subtitle: 'HappyPix · captured & printed on site',
  },
};

export const TemplateCanvas: React.FC<TemplateCanvasProps> = ({
  template,
  photos = [],
  customization = defaultCustomization,
  interactiveSlot,
  style,
  containerWidth,
  renderStickers = true,
  activeSlotIndex,
}) => {
  const { layout } = template;
  const preset = (template.componentId && DESIGNER_PRESETS[template.componentId]) || null;
  const rawDesign: any = template.design || {};
  const isUnstyledWhiteFallback =
    preset &&
    rawDesign.background?.type === 'solid' &&
    rawDesign.background?.colors?.[0]?.toLowerCase() === '#ffffff' &&
    rawDesign.accent === '#ff4f9a' &&
    template.componentId !== 'ClassicPostcard';

  const design: any = isUnstyledWhiteFallback
    ? { ...rawDesign, ...preset }
    : { ...preset, ...rawDesign };

  const canvas = layout?.canvas || { width: 1000, height: 1500 };
  const aspect = canvas.width && canvas.height
    ? canvas.width / canvas.height
    : (layout?.orientation === 'landscape' ? 3 / 2 : 2 / 3);

  const title = customization.title || design.title;
  const subtitle = customization.subtitle || design.subtitle || design.tagline;
  const ornament: OrnamentId = (customization.ornament === 'none' || !customization.ornament)
    ? (design.ornament || 'none')
    : customization.ornament;
  const activeFilter: FilterId = customization.filter || 'original';

  // Background and theme resolution (supports AI templates, designer, and custom)
  const templateAssets = Array.isArray((template as any).assets) ? (template as any).assets : [];
  const bgAssetId = design.background?.assetId || design.bg?.assetId;
  const matchedBgAsset =
    (bgAssetId && templateAssets.find((a: any) => a.assetId === bgAssetId)) ||
    templateAssets.find((a: any) => a.role === 'background' || a.type === 'background');

  const bgUrl =
    design.background?.url ||
    (typeof design.background === 'string' && (design.background.startsWith('http') || design.background.startsWith('data:') || design.background.startsWith('/'))
      ? design.background
      : null) ||
    design.bg?.url ||
    matchedBgAsset?.url ||
    null;
  const isImageBg = !!bgUrl;
  const palette = design.palette || {};
  const paletteBg = palette.background || design.theme?.background;
  const bgObj = design.background?.colors ? design.background : (design.bg?.colors ? design.bg : null);
  const bgType = isImageBg ? 'image' : (bgObj?.type || (paletteBg ? 'solid' : 'solid'));
  const bgColors = bgObj?.colors || (paletteBg ? [paletteBg] : (preset?.background?.colors || ['#1e1b2e']));
  const fallbackBgColor = bgColors[0] || paletteBg || '#1e1b2e';
  const secondaryBg = bgColors[1] || fallbackBgColor;

  const accent = design.accent || palette.accent || palette.primary || preset?.accent || '#8b5cf6';
  const textColor = design.textColor || palette.text || preset?.textColor || '#ffffff';
  const hasTitleBand = Boolean(design.titleBand || preset?.titleBand);

  const shapeKey = String(design.slotShape || preset?.slotShape || 'square').toLowerCase();
  const isArchSlot = shapeKey === 'arch';
  const slotBorderRadius =
    shapeKey === 'rounded' || shapeKey === 'round' ? 10 : shapeKey === 'pill' ? 999 : 4;

  const renderDesignerFlourish = () => {
    const cid = template.componentId;
    if (cid === 'RoyalWedding' || (ornament as string) === 'flourish') {
      return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 8 }]}>
          <View style={[styles.flourishBorder, { borderColor: accent + '99', borderWidth: 1.5 }]} />
          <Text style={[styles.cornerFlourish, styles.flourishTL, { color: accent }]}>❦</Text>
          <Text style={[styles.cornerFlourish, styles.flourishTR, { color: accent }]}>❦</Text>
        </View>
      );
    }
    if (cid === 'FilmStrip' || (ornament as string) === 'sprockets') {
      return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 8 }]}>
          <View style={{ position: 'absolute', left: 3, top: 8, bottom: 8, width: 5, justifyContent: 'space-around' }}>
            {Array.from({ length: 12 }).map((_, idx) => (
              <View key={`sp-l-${idx}`} style={{ width: 4, height: 6, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.65)' }} />
            ))}
          </View>
          <View style={{ position: 'absolute', right: 3, top: 8, bottom: 8, width: 5, justifyContent: 'space-around' }}>
            {Array.from({ length: 12 }).map((_, idx) => (
              <View key={`sp-r-${idx}`} style={{ width: 4, height: 6, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.65)' }} />
            ))}
          </View>
        </View>
      );
    }
    if (cid === 'CorporateGrid' || (ornament as string) === 'headerBand') {
      return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 8 }]}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '11%', backgroundColor: accent, justifyContent: 'center', paddingHorizontal: 10 }}>
            <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>
              {title || template.name}
            </Text>
          </View>
          <View style={{ position: 'absolute', top: '11%', left: 0, right: 0, height: 2, backgroundColor: '#EA097F' }} />
        </View>
      );
    }
    if (
      cid === 'ClassicPostcard' ||
      cid === 'ClassicWhite' ||
      cid === 'GalaGold' ||
      cid === 'LegacyGuestbook' ||
      cid === 'FestiveMaroon' ||
      cid === 'VintageBookmark' ||
      cid === 'CollectorReel' ||
      (ornament as string) === 'frame'
    ) {
      return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 8 }]}>
          <View style={[styles.flourishBorder, { borderColor: accent + 'AA', borderWidth: 1.5 }]} />
        </View>
      );
    }
    return null;
  };

  const renderOrnament = () => {
    if (ornament === 'none') return null;
    const accent = design.accent || '#8b5cf6';

    if (ornament === 'hearts') {
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Text style={[styles.cornerMotif, styles.flourishTL, { color: accent }]}>♥ ♡</Text>
          <Text style={[styles.cornerMotif, styles.flourishTR, { color: accent }]}>♡ ♥</Text>
          <Text style={[styles.cornerMotif, styles.flourishBL, { color: accent }]}>♡ ♥</Text>
          <Text style={[styles.cornerMotif, styles.flourishBR, { color: accent }]}>♥ ♡</Text>
          <View style={styles.ornamentBanner}>
            <Text style={[styles.ornamentSymbol, { color: accent }]}>♡  ♥  ♡  ♥  ♡</Text>
          </View>
        </View>
      );
    }

    if (ornament === 'stars') {
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Text style={[styles.cornerMotif, styles.flourishTL, { color: accent }]}>✦ ✧</Text>
          <Text style={[styles.cornerMotif, styles.flourishTR, { color: accent }]}>✧ ✦</Text>
          <Text style={[styles.cornerMotif, styles.flourishBL, { color: accent }]}>✧ ✦</Text>
          <Text style={[styles.cornerMotif, styles.flourishBR, { color: accent }]}>✦ ✧</Text>
          <View style={styles.ornamentBanner}>
            <Text style={[styles.ornamentSymbol, { color: accent }]}>✦  ✧  ⋆  ✧  ✦</Text>
          </View>
        </View>
      );
    }

    if (ornament === 'bubbles') {
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Text style={[styles.cornerMotif, styles.flourishTL, { color: accent }]}>◌ ○</Text>
          <Text style={[styles.cornerMotif, styles.flourishTR, { color: accent }]}>○ ◌</Text>
          <Text style={[styles.cornerMotif, styles.flourishBL, { color: accent }]}>○ ◌</Text>
          <Text style={[styles.cornerMotif, styles.flourishBR, { color: accent }]}>◌ ○</Text>
          <View style={styles.ornamentBanner}>
            <Text style={[styles.ornamentSymbol, { color: accent }]}>◌  ○  ◯  ○  ◌</Text>
          </View>
        </View>
      );
    }

    if (ornament === 'confetti') {
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Text style={[styles.cornerMotif, styles.flourishTL, { color: accent }]}>▲ ● ★</Text>
          <Text style={[styles.cornerMotif, styles.flourishTR, { color: accent }]}>★ ● ▲</Text>
          <Text style={[styles.cornerMotif, styles.flourishBL, { color: accent }]}>◆ ⌁ ★</Text>
          <Text style={[styles.cornerMotif, styles.flourishBR, { color: accent }]}>★ ⌁ ◆</Text>
          <View style={styles.ornamentBanner}>
            <Text style={[styles.ornamentSymbol, { color: accent }]}>⌁  ★  ◆  ★  ⌁</Text>
          </View>
        </View>
      );
    }

    return null;
  };

  const renderDecorations = (overlayFilter: boolean) => {
    const rawDecs = Array.isArray(design.decorations) ? [...design.decorations] : [];
    for (const asset of templateAssets) {
      if (!asset || asset.role === 'background' || asset.type === 'background') continue;
      if (asset.role === 'overlay' || asset.role === 'frame' || asset.type === 'overlay') {
        const exists = rawDecs.some((d: any) => (d.assetId && d.assetId === asset.assetId) || (d.url && d.url === asset.url));
        if (!exists && asset.url) {
          rawDecs.push({
            assetId: asset.assetId,
            url: asset.url,
            type: 'decoration',
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            overlay: true,
          });
        }
      }
    }

    return rawDecs
      .map((d) => {
        if (!d) return null;
        let url = d.url;
        if (!url && d.assetId && templateAssets.length > 0) {
          const matched = templateAssets.find((a: any) => a.assetId === d.assetId);
          if (matched?.url) url = matched.url;
        }
        return url ? { ...d, url } : null;
      })
      .filter((d): d is any => {
        if (!d || !d.url) return false;
        const isOverlay = d.overlay !== false && d.position !== 'background';
        return isOverlay === overlayFilter;
      })
      .map((d, i) => {
        const hasX = d.x !== undefined && d.x !== null && !Number.isNaN(Number(d.x));
        const hasY = d.y !== undefined && d.y !== null && !Number.isNaN(Number(d.y));
        const hasW = d.width !== undefined && d.width !== null && Number(d.width) > 0;
        const hasH = d.height !== undefined && d.height !== null && Number(d.height) > 0;

        const isRelX = !hasX || Math.abs(Number(d.x)) <= 4;
        const isRelY = !hasY || Math.abs(Number(d.y)) <= 4;
        const isRelW = !hasW || Number(d.width) <= 4;
        const isRelH = !hasH || Number(d.height) <= 4;

        let left: any = hasX ? (isRelX ? `${Number(d.x) * 100}%` : `${(Number(d.x) / (canvas.width || 1200)) * 100}%`) : 0;
        let top: any = hasY ? (isRelY ? `${Number(d.y) * 100}%` : `${(Number(d.y) / (canvas.height || 1800)) * 100}%`) : 0;
        let width: any = hasW ? (isRelW ? `${Number(d.width) * 100}%` : `${(Number(d.width) / (canvas.width || 1200)) * 100}%`) : '100%';
        let height: any = hasH ? (isRelH ? `${Number(d.height) * 100}%` : `${(Number(d.height) / (canvas.height || 1800)) * 100}%`) : '100%';
        let right: any = undefined;
        let bottom: any = undefined;

        if (d.position === 'top-right') {
          top = 0; right = 0; left = undefined; width = '30%'; height = '30%';
        } else if (d.position === 'bottom-left') {
          bottom = 0; left = 0; top = undefined; width = '30%'; height = '30%';
        }

        const isFullFrame =
          (!hasW || (isRelW && Number(d.width) >= 0.95 && Number(d.width) <= 1.05)) &&
          (!hasH || (isRelH && Number(d.height) >= 0.95 && Number(d.height) <= 1.05)) &&
          (!hasX || Math.abs(Number(d.x)) <= 0.05) &&
          (!hasY || Math.abs(Number(d.y)) <= 0.05);

        return (
          <View
            key={`dec-${overlayFilter ? 'over' : 'under'}-${i}`}
            pointerEvents="none"
            style={
              isFullFrame
                ? [StyleSheet.absoluteFill, { zIndex: overlayFilter ? 25 : 5 }]
                : {
                    position: 'absolute',
                    left,
                    top,
                    right,
                    bottom,
                    width,
                    height,
                    zIndex: overlayFilter ? 25 : 5,
                  }
            }
          >
            <Image
              source={{ uri: d.url }}
              resizeMode={isFullFrame ? 'stretch' : 'contain'}
              style={{ width: '100%', height: '100%' }}
            />
          </View>
        );
      });
  };

  // One resolver for every consumer (preview, selection screens, print) — see
  // utils/photoSlots. Index i of `photos` always belongs to slot i.
  const rawPhotoSlots = resolvePhotoSlots(template as any);

  const canvasContent = (
    <View style={[styles.innerFrame, { backgroundColor: fallbackBgColor }]}>
      {/* Secondary background layer if gradient */}
      {!isImageBg && bgType === 'gradient' && bgColors.length > 1 && (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '65%',
              backgroundColor: secondaryBg,
              opacity: 0.65,
              zIndex: 1,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '38%',
              backgroundColor: secondaryBg,
              opacity: 0.9,
              zIndex: 1,
            }}
          />
        </>
      )}

      {/* Background Image Layer */}
      {isImageBg && bgUrl ? (
        <Image
          source={{ uri: bgUrl }}
          style={[StyleSheet.absoluteFill, { zIndex: 2 }]}
          resizeMode="cover"
        />
      ) : null}

      {/* Top Title Band when template specifies titleBand (e.g., RoyalWedding, FestiveMaroon, LegacyGuestbook) */}
      {hasTitleBand && template.componentId !== 'CorporateGrid' && title ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: '3.2%',
            left: '6%',
            right: '6%',
            alignItems: 'center',
            zIndex: 9,
          }}
        >
          <Text numberOfLines={1} style={[styles.footerTitle, { color: textColor, fontSize: 12 }]}>
            {title}
          </Text>
          <View style={{ width: '36%', height: 1.5, backgroundColor: accent, marginTop: 2, opacity: 0.85 }} />
        </View>
      ) : null}

      {/* Under-slot Decorations */}
      {renderDecorations(false)}

      {/* Designer flourished borders */}
      {renderDesignerFlourish()}

      {/* Subtle Ornament symbol */}
      {renderOrnament()}

      {/* Photo Slots */}
      {rawPhotoSlots.map((slot: any, index: number) => {
        const photo = photos[index];
        const { x: rx, y: ry, width: rw, height: rh } = slotFractions(slot, canvas);

        const leftPercent = `${rx * 100}%`;
        const topPercent = `${ry * 100}%`;
        const widthPercent = `${rw * 100}%`;
        const heightPercent = `${rh * 100}%`;

        const photoSource = photo?.uri
          ? { uri: photo.uri }
          : photo?.dataUrl
          ? { uri: photo.dataUrl }
          : null;

        const hasExplicitBorder = Boolean(design.photoTreatment?.border);

        const slotContent = (
          <View
            style={[
              styles.slot,
              {
                borderRadius: slotBorderRadius,
                ...(isArchSlot
                  ? {
                      borderTopLeftRadius: 999,
                      borderTopRightRadius: 999,
                      borderBottomLeftRadius: 6,
                      borderBottomRightRadius: 6,
                    }
                  : {}),
                // Electron `.template-slot`: a 2px white ring over a 14% white
                // wash, with a soft drop shadow. Tinting the ring with the
                // template accent turned every empty slot into an orange or
                // mustard rectangle floating on the design — the thing that made
                // the tablet previews look nothing like the desktop.
                borderColor: hasExplicitBorder
                  ? (palette.primary || accent)
                  : 'rgba(255,255,255,0.78)',
                borderWidth: hasExplicitBorder
                  ? design.photoTreatment.borderWidth || 2
                  : photoSource
                  ? 0
                  : 2,
                backgroundColor: photoSource ? 'transparent' : 'rgba(255,255,255,0.14)',
                overflow: 'hidden',
                ...(photoSource ? null : styles.emptySlotShadow),
              },
            ]}
          >
            {photoSource ? (
              <>
                <FilteredImage
                  uri={photoSource.uri}
                  filter={activeFilter}
                  style={styles.slotImage}
                />
                {interactiveSlot && (
                  <View style={styles.clearBadge}>
                    <Text style={styles.clearBadgeText}>✕</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptySlot}>
                {/* Electron: `b { font: 650 8cqw }`, `small { 3cqw .15em }` */}
                <Text
                  style={[
                    styles.emptySlotNumber,
                    { color: 'rgba(255,255,255,0.85)', fontSize: Math.max(9, (containerWidth || 300) * 0.08) },
                  ]}
                >
                  {index + 1}
                </Text>
                <Text
                  style={[
                    styles.emptySlotLabel,
                    { color: 'rgba(255,255,255,0.7)', fontSize: Math.max(5, (containerWidth || 300) * 0.03) },
                  ]}
                >
                  PHOTO
                </Text>
              </View>
            )}
          </View>
        );

        if (interactiveSlot) {
          return (
            <TouchableOpacity
              key={slot.id || index}
              activeOpacity={0.85}
              onPress={() => interactiveSlot(index)}
              style={[
                styles.slotPositioner,
                {
                  left: leftPercent as any,
                  top: topPercent as any,
                  width: widthPercent as any,
                  height: heightPercent as any,
                  zIndex: 15,
                },
              ]}
            >
              {slotContent}
              {activeSlotIndex === index ? (
                <View pointerEvents="none" style={[styles.activeRing, { borderRadius: slotBorderRadius }]} />
              ) : null}
            </TouchableOpacity>
          );
        }

        return (
          <View
            key={slot.id || index}
            style={[
              styles.slotPositioner,
              {
                left: leftPercent as any,
                top: topPercent as any,
                width: widthPercent as any,
                height: heightPercent as any,
                zIndex: 15,
              },
            ]}
          >
            {slotContent}
            {activeSlotIndex === index ? (
              <View pointerEvents="none" style={[styles.activeRing, { borderRadius: slotBorderRadius }]} />
            ) : null}
          </View>
        );
      })}

      {/* Overlay Decorations */}
      {renderDecorations(true)}

      {/* Footer Branding & Text */}
      <View style={[styles.footer, { zIndex: 20 }]} pointerEvents="none">
        {customization.logo ? (
          <Image
            source={{ uri: customization.logo }}
            style={styles.footerLogo}
            resizeMode="contain"
          />
        ) : null}
        <View style={styles.footerTextContainer}>
          {!hasTitleBand && title ? (
            <Text
              numberOfLines={1}
              style={[styles.footerTitle, { color: textColor }]}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[styles.footerSubtitle, { color: textColor + 'B3' }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Placed Stickers */}
      {renderStickers &&
        customization.stickers.map((st) => (
          <View
            key={st.id}
            pointerEvents="none"
            style={[
              styles.stickerWrapper,
              { left: `${st.x}%` as any, top: `${st.y}%` as any, zIndex: 30 },
            ]}
          >
            {/* Electron `.placed-sticker`: font-size `scale * 8cqw`, where cqw is
                1% of the print width, and the glyph is centred on (x, y). */}
            <Text
              style={[
                styles.stickerText,
                {
                  fontSize: Math.max(10, (containerWidth || 300) * 0.08 * (st.scale ?? 1)),
                  marginLeft: -((containerWidth || 300) * 0.04 * (st.scale ?? 1)),
                  marginTop: -((containerWidth || 300) * 0.04 * (st.scale ?? 1)),
                },
              ]}
            >
              {st.emoji}
            </Text>
          </View>
        ))}
    </View>
  );

  return (
    <View
      style={[
        styles.outerContainer,
        { aspectRatio: aspect, backgroundColor: fallbackBgColor },
        containerWidth ? { width: containerWidth } : null,
        style,
      ]}
    >
      {canvasContent}
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  innerFrame: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  slotPositioner: {
    position: 'absolute',
  },
  activeRing: {
    position: 'absolute',
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    borderWidth: 2.5,
    borderColor: '#ee4c96',
    zIndex: 16,
  },
  slot: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.13,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  slotImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  emptySlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotNumber: {
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  emptySlotLabel: {
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  clearBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '13%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  footerLogo: {
    height: '70%',
    width: 50,
    marginRight: 8,
  },
  footerTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footerSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  cornerFlourish: {
    position: 'absolute',
    fontSize: 20,
    opacity: 0.6,
  },
  cornerMotif: {
    position: 'absolute',
    fontSize: 14,
    opacity: 0.75,
    fontWeight: '800',
  },
  flourishTL: { top: 8, left: 10 },
  flourishTR: { top: 8, right: 10 },
  flourishBL: { bottom: 10, left: 10 },
  flourishBR: { bottom: 10, right: 10 },
  flourishBorder: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderWidth: 1,
    borderRadius: 8,
    opacity: 0.35,
  },
  starField: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    fontSize: 10,
    letterSpacing: 4,
    opacity: 0.45,
  },
  partyRibbon: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    fontSize: 9,
    letterSpacing: 3,
    opacity: 0.45,
  },
  ornamentBanner: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  ornamentSymbol: {
    fontSize: 11,
    letterSpacing: 6,
    fontWeight: '600',
  },
  stickerWrapper: {
    position: 'absolute',
    zIndex: 10,
  },
  stickerText: {
    fontSize: 26,
  },
});
