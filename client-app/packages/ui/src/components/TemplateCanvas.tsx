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
import { buildPrintSpec, logoRect, resolveDesign, type PrintSpec } from '../utils/printSpec';

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


/**
 * A footer logo, placed with the composite's own `contain` maths.
 *
 * `resizeMode="contain"` centres the image inside its box, while the print
 * left-aligns it in the logo cell — so the logo appeared to shift between the
 * preview and the paper. Measuring the image lets both use `logoRect`, which is
 * the single source for that box.
 */
const FooterLogo: React.FC<{ url: string; spec: PrintSpec; cssWidth: number; cssHeight: number }> = ({
  url,
  spec,
  cssWidth,
  cssHeight,
}) => {
  const [aspect, setAspect] = React.useState<number | null>(null);

  React.useEffect(() => {
    let alive = true;
    Image.getSize(
      url,
      (w, h) => {
        if (alive && w > 0 && h > 0) setAspect(w / h);
      },
      () => {
        /* keep the cell-sized fallback */
      }
    );
    return () => {
      alive = false;
    };
  }, [url]);

  const area = spec.footer.logoArea;
  const box = aspect ? logoRect(spec, aspect) : area;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: box.x * cssWidth,
        top: box.y * cssHeight,
        width: box.width * cssWidth,
        height: box.height * cssHeight,
        zIndex: 20,
      }}
    >
      <Image source={{ uri: url }} style={styles.footerLogoImage} resizeMode="contain" />
    </View>
  );
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
  // Preset defaults + the template's own design, merged in one place that the
  // print shares (see `resolveDesign`) — the two used to merge separately and
  // disagree about a designer template's background.
  const design: any = resolveDesign(template);

  const canvas = layout?.canvas || { width: 1000, height: 1500 };
  const aspect = canvas.width && canvas.height
    ? canvas.width / canvas.height
    : (layout?.orientation === 'landscape' ? 3 / 2 : 2 / 3);

  const title = customization.title || design.title;
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
  const bgColors = bgObj?.colors || (paletteBg ? [paletteBg] : (design.background?.colors || ['#1e1b2e']));
  const fallbackBgColor = bgColors[0] || paletteBg || '#1e1b2e';
  const secondaryBg = bgColors[1] || fallbackBgColor;

  const accent = design.accent || palette.accent || palette.primary || '#8b5cf6';
  const textColor = design.textColor || palette.text || '#ffffff';

  // One description of the print for this exact customisation. The footer,
  // stickers and gradient below are drawn from it, and so is the 300 dpi
  // composite — that is what keeps the two from drifting apart.
  const spec = buildPrintSpec({ template, customization });

  // The canvas is laid out by aspect ratio, so a measured width gives us the
  // height (and therefore every pixel position the spec asks for in fractions).
  const cssWidth = containerWidth || 300;
  const cssHeight = cssWidth / aspect;

  const shapeKey = String(design.slotShape || 'square').toLowerCase();
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
      {!isImageBg && spec.background.kind === 'gradient' && (
        <>
          {/* The composite paints these two bands at the same heights and alphas
              (see `RenderEngine.drawSpec`), so a gradient template resolves the
              same way on paper. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '65%',
              backgroundColor: spec.background.secondary,
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
              backgroundColor: spec.background.secondary,
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

      {/* Top Title Band — geometry from the spec, so the composite prints the
          guest's title at the same size in the same place (RoyalWedding,
          FestiveMaroon, LegacyGuestbook). */}
      {spec.titleBand ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: spec.titleBand.box.y * cssHeight,
            left: spec.titleBand.box.x * cssWidth,
            width: spec.titleBand.box.width * cssWidth,
            alignItems: 'center',
            zIndex: 9,
          }}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.footerTitle,
              {
                color: spec.titleBand.color,
                fontSize: spec.titleBand.fontSize * cssWidth,
                lineHeight: spec.titleBand.fontSize * cssWidth * 1.2,
              },
            ]}
          >
            {spec.titleBand.text}
          </Text>
          <View
            style={{
              width: spec.titleBand.ruleWidth * cssWidth,
              height: Math.max(1, 0.0035 * cssWidth),
              backgroundColor: spec.titleBand.accent,
              marginTop: 2,
              opacity: 0.85,
            }}
          />
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

      {/* Footer — logos left, title/subtitle right, every coordinate from the
          shared spec (Electron's `.template-footer`: 4 % margins, 11 % band).
          The composite draws these same numbers, so the logo cannot move
          between the preview and the print. */}
      {spec.footer.logos.map((url, index) => (
        <FooterLogo
          key={`footer-logo-${index}`}
          url={url}
          spec={spec}
          cssWidth={cssWidth}
          cssHeight={cssHeight}
        />
      ))}

      {[spec.footer.title, spec.footer.subtitle].map((line, index) => {
        if (!line) return null;
        const fontSizePx = line.fontSize * cssWidth;
        const lineHeightPx = fontSizePx * 1.2;
        return (
          <Text
            key={`footer-line-${index}`}
            pointerEvents="none"
            numberOfLines={1}
            style={[
              index === 0 ? styles.footerTitle : styles.footerSubtitle,
              {
                position: 'absolute',
                right: (1 - spec.footer.textRight) * cssWidth,
                top: line.centreY * cssHeight - lineHeightPx / 2,
                width: spec.footer.maxTextWidth * cssWidth,
                color: spec.footer.color,
                fontSize: fontSizePx,
                lineHeight: lineHeightPx,
                textAlign: 'right',
                opacity: index === 0 ? 1 : 0.72,
                zIndex: 20,
              },
            ]}
          >
            {line.text}
          </Text>
        );
      })}

      {/* Placed Stickers — the spec's centre + em size, the same pair the
          composite paints, so a sticker sits at the same spot on both. */}
      {renderStickers &&
        spec.stickers.map((st) => {
          const size = Math.max(10, st.size * cssWidth);
          return (
            <View
              key={st.id}
              pointerEvents="none"
              style={[
                styles.stickerWrapper,
                {
                  left: st.cx * cssWidth,
                  top: st.cy * cssHeight,
                  zIndex: 30,
                },
              ]}
            >
              <Text style={[styles.stickerText, { fontSize: size, marginLeft: -size * 0.5, marginTop: -size * 0.5 }]}>
                {st.emoji}
              </Text>
            </View>
          );
        })}
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
  footerLogoImage: {
    width: '100%',
    height: '100%',
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
