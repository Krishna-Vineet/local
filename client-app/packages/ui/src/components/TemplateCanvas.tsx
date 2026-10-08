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

interface TemplateCanvasProps {
  template: BoothTemplate;
  photos?: CapturedPhoto[];
  customization?: Customization;
  interactiveSlot?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  containerWidth?: number;
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
      return { backgroundColor: 'rgba(30, 30, 30, 0.45)' };
    case 'warm':
      return { backgroundColor: 'rgba(255, 140, 0, 0.18)' };
    case 'cool':
      return { backgroundColor: 'rgba(0, 150, 255, 0.16)' };
    case 'vintage':
      return { backgroundColor: 'rgba(180, 120, 60, 0.22)' };
    case 'soft':
      return { backgroundColor: 'rgba(255, 200, 220, 0.18)' };
    case 'party':
      return { backgroundColor: 'rgba(220, 40, 160, 0.18)' };
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
}) => {
  const { layout, design } = template;
  const canvas = layout.canvas || { width: 1000, height: 1500 };
  const aspect = canvas.width / canvas.height;

  const title = customization.title || design.title;
  const subtitle = customization.subtitle || design.subtitle;
  const ornament: OrnamentId = customization.ornament === 'none' ? design.ornament : customization.ornament;
  const activeFilter: FilterId = customization.filter || 'original';
  const filterOverlayStyle = getFilterOverlay(activeFilter);

  // Background resolution
  const bgType = design.background?.type || 'solid';
  const bgColors = design.background?.colors || ['#ffffff'];
  const bgUrl = design.background?.url;
  const primaryBg = bgColors[0] || '#ffffff';
  const secondaryBg = bgColors[1] || primaryBg;

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
    let symbol = '';
    if (ornament === 'hearts') symbol = '♡  ♥  ♡';
    else if (ornament === 'stars') symbol = '✦  ✧  ✦';
    else if (ornament === 'bubbles') symbol = '◌  ○  ◌';
    else if (ornament === 'confetti') symbol = '⌁  ★  ⌁';

    return (
      <View pointerEvents="none" style={styles.ornamentBanner}>
        <Text style={[styles.ornamentSymbol, { color: design.accent + '70' }]}>{symbol}</Text>
      </View>
    );
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

      {/* Designer flourished borders */}
      {renderDesignerFlourish()}

      {/* Subtle Ornament symbol */}
      {renderOrnament()}

      {/* Photo Slots */}
      {layout.photoSlots.map((slot, index) => {
        const photo = photos[index];
        const leftPercent = `${(slot.x / canvas.width) * 100}%`;
        const topPercent = `${(slot.y / canvas.height) * 100}%`;
        const widthPercent = `${(slot.width / canvas.width) * 100}%`;
        const heightPercent = `${(slot.height / canvas.height) * 100}%`;

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
                borderColor: design.accent + '50',
                overflow: 'hidden',
              },
            ]}
          >
            {photoSource ? (
              <>
                <Image
                  source={photoSource}
                  style={styles.slotImage}
                  resizeMode="cover"
                />
                {filterOverlayStyle && (
                  <View style={[StyleSheet.absoluteFill, filterOverlayStyle]} pointerEvents="none" />
                )}
                {interactiveSlot && (
                  <View style={styles.clearBadge}>
                    <Text style={styles.clearBadgeText}>✕</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptySlot}>
                <Text style={[styles.emptySlotNumber, { color: design.textColor + '80' }]}>
                  {index + 1}
                </Text>
                <Text style={[styles.emptySlotLabel, { color: design.textColor + '60' }]}>
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
              style={[styles.footerTitle, { color: design.textColor }]}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[styles.footerSubtitle, { color: design.textColor + 'B3' }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Placed Stickers */}
      {customization.stickers.map((st) => (
        <View
          key={st.id}
          pointerEvents="none"
          style={[
            styles.stickerWrapper,
            { left: `${st.x}%` as any, top: `${st.y}%` as any },
          ]}
        >
          <Text style={styles.stickerText}>{st.emoji}</Text>
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
      {bgType === 'image' && bgUrl ? (
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
  flourishTL: { top: 8, left: 10 },
  flourishTR: { top: 8, right: 10 },
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
