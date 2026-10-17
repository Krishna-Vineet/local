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

interface TemplateCanvasProps {
  template: BoothTemplate;
  photos?: CapturedPhoto[];
  customization?: Customization;
  interactiveSlot?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  containerWidth?: number;
  renderStickers?: boolean;
}

const defaultCustomization: Customization = {
  ornament: 'none',
  filter: 'original',
  logo: null,
  title: '',
  subtitle: '',
  stickers: [],
};

const getFilterOverlay = (filter: FilterId): ViewStyle | null => {
  switch (filter) {
    case 'bw':
      return { backgroundColor: 'rgba(25, 25, 30, 0.55)' };
    case 'warm':
      return { backgroundColor: 'rgba(245, 158, 11, 0.22)' };
    case 'cool':
      return { backgroundColor: 'rgba(14, 165, 233, 0.20)' };
    case 'vintage':
      return { backgroundColor: 'rgba(180, 115, 50, 0.30)' };
    case 'soft':
      return { backgroundColor: 'rgba(244, 114, 182, 0.22)' };
    case 'party':
      return { backgroundColor: 'rgba(236, 72, 153, 0.26)' };
    default:
      return null;
  }
};

export const TemplateCanvas: React.FC<TemplateCanvasProps> = ({
  template,
  photos = [],
  customization = defaultCustomization,
  interactiveSlot,
  style,
  containerWidth,
  renderStickers = true,
}) => {
  const { layout, design } = template;
  const canvas = layout?.canvas || { width: 1000, height: 1500 };
  const aspect = canvas.width && canvas.height
    ? canvas.width / canvas.height
    : (layout?.orientation === 'landscape' ? 3 / 2 : 2 / 3);

  const title = customization.title || design.title;
  const subtitle = customization.subtitle || design.subtitle;
  const ornament: OrnamentId = customization.ornament === 'none' ? design.ornament : customization.ornament;
  const activeFilter: FilterId = customization.filter || 'original';

  // Background and theme resolution (supports AI templates, designer, and custom)
  const bgUrl =
    design.background?.url ||
    (typeof design.background === 'string' ? design.background : null) ||
    (design as any).bg?.url ||
    ((template as any).assets?.find((a: any) => a.role === 'background' || a.type === 'background')?.url) ||
    null;
  const isImageBg = !!bgUrl;
  const palette = (design as any).palette || {};
  const paletteBg = palette.background;
  const bgType = isImageBg ? 'image' : design.background?.type || (paletteBg ? 'solid' : 'solid');
  const bgColors = design.background?.colors || (paletteBg ? [paletteBg] : ['#ffffff']);
  const primaryBg = isImageBg ? 'transparent' : (bgColors[0] || paletteBg || '#ffffff');
  const secondaryBg = bgColors[1] || primaryBg;

  const accent = design.accent || palette.accent || palette.primary || '#8b5cf6';
  const textColor = design.textColor || palette.text || '#ffffff';

  const slotBorderRadius =
    design.slotShape === 'rounded' ? 12 : design.slotShape === 'pill' ? 999 : 4;

  const renderDesignerFlourish = () => {
    switch (template.componentId) {
      case 'RoyalWedding':
        return (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Text style={[styles.cornerFlourish, styles.flourishTL, { color: design.accent }]}>❦</Text>
            <Text style={[styles.cornerFlourish, styles.flourishTR, { color: design.accent }]}>❦</Text>
            <View style={[styles.flourishBorder, { borderColor: design.accent + '40' }]} />
          </View>
        );
      case 'ClassicWhite':
        return (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.flourishBorder, { borderColor: design.accent || '#e4e4e7' }]} />
          </View>
        );
      case 'BlushBloom':
        return (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Text style={[styles.cornerFlourish, styles.flourishTL, { color: design.accent }]}>✿</Text>
            <Text style={[styles.cornerFlourish, styles.flourishBR, { color: design.accent }]}>✿</Text>
          </View>
        );
      case 'MidnightReel':
        return (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Text style={[styles.starField, { color: design.accent }]}>✦ · ✧ · ✦ · ✧</Text>
          </View>
        );
      case 'PartyPop':
        return (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Text style={[styles.partyRibbon, { color: design.accent }]}>● ▲ ◆ ● ▲ ◆</Text>
          </View>
        );
      default:
        return null;
    }
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
    const decs = ((design as any).decorations || []) as Array<any>;
    return decs
      .filter((d) => !!d.url && (d.overlay === true) === overlayFilter)
      .map((d, i) => {
        let left: any = d.x !== undefined ? (d.x <= 1 ? `${d.x * 100}%` : d.x) : 0;
        let top: any = d.y !== undefined ? (d.y <= 1 ? `${d.y * 100}%` : d.y) : 0;
        let width: any = d.width !== undefined ? (d.width <= 1 ? `${d.width * 100}%` : d.width) : '100%';
        let height: any = d.height !== undefined ? (d.height <= 1 ? `${d.height * 100}%` : d.height) : '100%';
        let right: any = undefined;
        let bottom: any = undefined;

        if (d.position === 'top-right') {
          top = 0; right = 0; left = undefined; width = '30%'; height = '30%';
        } else if (d.position === 'bottom-left') {
          bottom = 0; left = 0; top = undefined; width = '30%'; height = '30%';
        }

        return (
          <Image
            key={`dec-${overlayFilter ? 'over' : 'under'}-${i}`}
            source={{ uri: d.url }}
            resizeMode="contain"
            style={{
              position: 'absolute',
              left,
              top,
              right,
              bottom,
              width,
              height,
              zIndex: overlayFilter ? 25 : 5,
            }}
          />
        );
      });
  };

  const canvasContent = (
    <View style={[styles.innerFrame, { backgroundColor: primaryBg }]}>
      {/* Secondary background layer if gradient */}
      {bgType === 'gradient' && bgColors.length > 1 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: secondaryBg, opacity: 0.45 },
          ]}
        />
      )}

      {/* Under-slot Decorations */}
      {renderDecorations(false)}

      {/* Designer flourished borders */}
      {renderDesignerFlourish()}

      {/* Subtle Ornament symbol */}
      {renderOrnament()}

      {/* Photo Slots */}
      {((layout?.photoSlots && layout.photoSlots.length > 0) ? layout.photoSlots : ((template as any).slots || [])).map((slot: any, index: number) => {
        const photo = photos[index];
        const isRelative = Number(slot.width) <= 1.0 && Number(slot.height) <= 1.0 && Number(slot.x) <= 1.0 && Number(slot.y) <= 1.0;
        const leftPercent = isRelative ? `${Number(slot.x) * 100}%` : `${(Number(slot.x) / (canvas.width || 1200)) * 100}%`;
        const topPercent = isRelative ? `${Number(slot.y) * 100}%` : `${(Number(slot.y) / (canvas.height || 1800)) * 100}%`;
        const widthPercent = isRelative ? `${Number(slot.width) * 100}%` : `${(Number(slot.width) / (canvas.width || 1200)) * 100}%`;
        const heightPercent = isRelative ? `${Number(slot.height) * 100}%` : `${(Number(slot.height) / (canvas.height || 1800)) * 100}%`;

        const photoSource = photo?.uri
          ? { uri: photo.uri }
          : photo?.dataUrl
          ? { uri: photo.dataUrl }
          : null;

        const slotContent = (
          <View
            style={[
              styles.slot,
              {
                borderRadius: slotBorderRadius,
                borderColor: (design as any).photoTreatment?.border
                  ? (palette.primary || accent)
                  : accent + '50',
                borderWidth: (design as any).photoTreatment?.border
                  ? (design as any).photoTreatment.borderWidth || 3
                  : 1.5,
                overflow: 'hidden',
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
                <Text style={[styles.emptySlotNumber, { color: textColor + '80' }]}>
                  {index + 1}
                </Text>
                <Text style={[styles.emptySlotLabel, { color: textColor + '60' }]}>
                  PHOTO
                </Text>
              </View>
            )}
          </View>
        );

        if (interactiveSlot && photoSource) {
          return (
            <TouchableOpacity
              key={slot.id || index}
              activeOpacity={0.8}
              onPress={() => interactiveSlot(index)}
              style={[
                styles.slotPositioner,
                {
                  left: leftPercent as any,
                  top: topPercent as any,
                  width: widthPercent as any,
                  height: heightPercent as any,
                },
              ]}
            >
              {slotContent}
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
              },
            ]}
          >
            {slotContent}
          </View>
        );
      })}

      {/* Overlay Decorations */}
      {renderDecorations(true)}

      {/* Footer Branding & Text */}
      <View style={styles.footer}>
        {customization.logo ? (
          <Image
            source={{ uri: customization.logo }}
            style={styles.footerLogo}
            resizeMode="contain"
          />
        ) : null}
        <View style={styles.footerTextContainer}>
          {title ? (
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
              { left: `${st.x}%` as any, top: `${st.y}%` as any },
            ]}
          >
            <Text style={[styles.stickerText, st.size ? { fontSize: st.size } : null]}>
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
        { aspectRatio: aspect },
        containerWidth ? { width: containerWidth } : null,
        style,
      ]}
    >
      {isImageBg && bgUrl ? (
        <ImageBackground
          source={{ uri: bgUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          {canvasContent}
        </ImageBackground>
      ) : (
        canvasContent
      )}
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
  slot: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  emptySlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotNumber: {
    fontSize: 22,
    fontWeight: '800',
  },
  emptySlotLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
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
