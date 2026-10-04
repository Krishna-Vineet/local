import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  ScreenContainer,
  safeImageSource,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
} from '../../../../packages/ui/src/index';

import SoundManager from '../utils/SoundManager';
import { InactivityToast } from '../components/InactivityToast';

import type { RootStackParamList } from '../../App';
import type { CapturedPhoto } from '../../../../packages/types/src/index';
import { useBooth } from '../context/BoothProvider';
import { DEFAULT_ARCHITECTURE_TEMPLATES } from '../constants/DefaultTemplates';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoSelection'>;

const SELECTION_TIMEOUT = 60;

const playClick = () => {
  try {
    SoundManager.play('click');
  } catch (err) {
    console.warn('[PhotoSelection] Sound failed:', err);
  }
};

const normalizePhoto = (img: any): CapturedPhoto | null => {
  if (!img) return null;
  try {
    const source = safeImageSource(img);
    const uri = source?.uri;
    if (typeof uri !== 'string' || uri.trim().length === 0) {
      const raw =
        typeof img === 'string'
          ? img
          : typeof img?.uri === 'string'
          ? img.uri
          : typeof img?.path === 'string'
          ? img.path
          : null;
      if (!raw || !String(raw).trim()) return null;
      const cleaned = String(raw).trim();
      const withScheme =
        cleaned.startsWith('file://') ||
        cleaned.startsWith('content://') ||
        cleaned.startsWith('http://') ||
        cleaned.startsWith('https://') ||
        cleaned.startsWith('data:')
          ? cleaned
          : `file://${cleaned}`;
      return { ...(typeof img === 'object' ? img : {}), uri: withScheme } as CapturedPhoto;
    }
    return { ...(typeof img === 'object' ? img : {}), uri } as CapturedPhoto;
  } catch {
    return null;
  }
};

const getPhotoUri = (img: any): string | null => {
  const n = normalizePhoto(img);
  return n?.uri ?? null;
};

const SafePhotoImage = ({
  photo,
  style,
  resizeMode = 'cover',
}: {
  photo: any;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}) => {
  const uri = getPhotoUri(photo);
  if (!uri) {
    return (
      <View style={[style, styles.brokenCard]}>
        <Text style={styles.brokenCardText}>NO DATA</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => console.warn('[PhotoSelection] Image failed to load:', uri)}
    />
  );
};

// Mini DX Barcode graphic in warm amber
const MiniDxBarcode = () => (
  <View style={styles.dxBarcode}>
    <View style={[styles.dxBar, { width: 1.5, height: 7 }]} />
    <View style={[styles.dxBar, { width: 3, height: 7 }]} />
    <View style={[styles.dxBar, { width: 1, height: 7 }]} />
    <View style={[styles.dxBar, { width: 2, height: 7 }]} />
    <View style={[styles.dxBar, { width: 3.5, height: 7 }]} />
  </View>
);

/* ============================================================
   FRAGMENTED FILM STRIP COMPONENT (HORIZONTAL SCROLLING REEL)
============================================================ */

interface FragmentedFilmStripProps {
  stripIndex: number;
  items: { photo: CapturedPhoto; globalIndex: number }[];
  photoWidth: number;
  photoHeight: number;
  filmColor: string;
  holeColor: string;
  selectedImagesState: (CapturedPhoto | null)[];
  selectedThumb: CapturedPhoto | null;
  onSelectPhoto: (img: CapturedPhoto) => void;
}

const FragmentedFilmStrip: React.FC<FragmentedFilmStripProps> = ({
  stripIndex,
  items,
  photoWidth,
  photoHeight,
  filmColor,
  holeColor,
  selectedImagesState,
  selectedThumb,
  onSelectPhoto,
}) => {
  const sprocketHoles = Array.from({ length: Math.max(10, items.length * 4) });

  const firstExposureNum = items[0]?.globalIndex + 1;
  const lastExposureNum = items[items.length - 1]?.globalIndex + 1;

  return (
    <View style={[styles.fragmentedStripOuter, { backgroundColor: filmColor }]}>
      {/* Top Rebate Rail: Markings + Sprockets */}
      <View style={styles.stripRebateRailTop}>
        <View style={styles.stripRebateHeader}>
          <Text style={styles.stripRebateAmberText}>KODAK PORTRA 400</Text>
          <MiniDxBarcode />
          <Text style={styles.stripRebateAmberText}>SAFETY FILM</Text>
          <Text style={styles.stripRebateAmberText}>STRIP {stripIndex + 1}</Text>
        </View>
        <View style={styles.sprocketHoleRow}>
          {sprocketHoles.map((_, i) => (
            <View
              key={`top-hole-${i}`}
              style={[styles.sprocketHoleH, { backgroundColor: holeColor }]}
            />
          ))}
        </View>
      </View>

      {/* Photos Track: Row of frames with inter-frame dividers */}
      <View style={styles.stripFramesTrack}>
        {items.map(({ photo, globalIndex }) => {
          const uri = getPhotoUri(photo);
          const isSelectedInFrame = selectedImagesState.some(
            (slot) => slot && getPhotoUri(slot) === uri
          );
          const isCurrentThumb = !!selectedThumb && getPhotoUri(selectedThumb) === uri;

          const frameNumberStr = globalIndex + 1 < 10 ? `0${globalIndex + 1}` : `${globalIndex + 1}`;

          return (
            <View key={`frame-${globalIndex}`} style={styles.frameWithDivider}>
              {/* Individual Frame Container */}
              <View style={[styles.frameItemContainer, { width: photoWidth }]}>
                {/* Frame Number Stamp */}
                <View style={styles.frameStampHeader}>
                  <Text style={styles.frameNumberStamp}>▷ {frameNumberStr}</Text>
                  <Text style={styles.frameExposureLabel}>{globalIndex + 1}A</Text>
                </View>

                {/* Photo Box Matching Template Slot Orientation */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onSelectPhoto(photo)}
                  style={[
                    styles.photoBox,
                    {
                      width: photoWidth,
                      height: photoHeight,
                      borderColor: isSelectedInFrame
                        ? '#F59E0B'
                        : isCurrentThumb
                        ? '#8b5cf6'
                        : 'rgba(255,255,255,0.12)',
                      borderWidth: isSelectedInFrame || isCurrentThumb ? 2.5 : 1,
                    },
                  ]}
                >
                  <SafePhotoImage photo={photo} style={styles.full} />

                  {/* Selected Indicator Badge (Tick) */}
                  {isSelectedInFrame && (
                    <View style={styles.selectedTickBadge}>
                      <Text style={styles.selectedTickText}>✓</Text>
                    </View>
                  )}

                  {/* Active Selection Ring */}
                  {isCurrentThumb && !isSelectedInFrame && (
                    <View style={styles.activeThumbOverlay}>
                      <Text style={styles.activeThumbText}>ACTIVE</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Inter-frame dividing gap bar */}
              <View style={styles.interFrameGap} />
            </View>
          );
        })}
      </View>

      {/* Bottom Rebate Rail: Sprockets + Markings */}
      <View style={styles.stripRebateRailBottom}>
        <View style={styles.sprocketHoleRow}>
          {sprocketHoles.map((_, i) => (
            <View
              key={`bot-hole-${i}`}
              style={[styles.sprocketHoleH, { backgroundColor: holeColor }]}
            />
          ))}
        </View>
        <View style={styles.stripRebateFooter}>
          <Text style={styles.stripRebateAmberText}>
            EXP {firstExposureNum}–{lastExposureNum}
          </Text>
          <Text style={styles.stripRebateAmberText}>35MM FILM</Text>
          <Text style={styles.stripRebateAmberText}>ISO 400 / 27°</Text>
        </View>
      </View>
    </View>
  );
};

/* ============================================================
   SCREEN COMPONENT
============================================================ */

export const PhotoSelectionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme, mode } = useAppTheme();
  const { state, send } = useBooth();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { params } = route as any;

  // Film colors matching camera screen
  const filmColor = (theme.colors as any).film || (mode === 'dark' ? '#18181A' : '#1c1c1f');
  const holeColor = (theme.colors as any).hole || (mode === 'dark' ? '#52525b' : '#000000');

  const rawImages: CapturedPhoto[] = useMemo(() => {
    const list = Array.isArray(params?.images) ? params.images : [];
    return list.map(normalizePhoto).filter((p: any): p is CapturedPhoto => !!p && !!p.uri);
  }, [params?.images]);

  const fallbackTemplate = useMemo(() => {
    const id = params?.templateId;
    if (id) {
      const found = DEFAULT_ARCHITECTURE_TEMPLATES.find((t) => t._id === id);
      if (found) return { ...found, id: found._id, frames: found.photoSlots?.length || 1, slots: found.photoSlots };
    }
    return {
      id: 'cut-4',
      name: '4 Slot Strip',
      frames: 4,
      orientation: 'portrait',
      canvas: { width: 1200, height: 1800 },
      slots: [
        { x: 40, y: 40, width: 1120, height: 395 },
        { x: 40, y: 455, width: 1120, height: 395 },
        { x: 40, y: 870, width: 1120, height: 395 },
        { x: 40, y: 1285, width: 1120, height: 395 },
      ],
    };
  }, [params?.templateId]);

  const activeTemplate = state?.context?.selectedTemplate?.slots
    ? state.context.selectedTemplate
    : fallbackTemplate;

  const frameCount = Math.max(1, Number(activeTemplate?.frames) || 4);

  const [selectedImagesState, setSelectedImagesState] = useState<(CapturedPhoto | null)[]>(() =>
    Array.from({ length: frameCount }, () => null)
  );

  const [selectedThumb, setSelectedThumb] = useState<CapturedPhoto | null>(null);
  const [timeLeft, setTimeLeft] = useState(SELECTION_TIMEOUT);
  const expiredRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  // Layout container size for mathematical containment
  const [previewContainerSize, setPreviewContainerSize] = useState<{ width: number; height: number } | null>(null);

  const resetTimer = useCallback(() => {
    startedAtRef.current = Date.now();
    setTimeLeft(SELECTION_TIMEOUT);
  }, []);

  useEffect(() => {
    setSelectedImagesState((prev) => {
      if (prev.length === frameCount) return prev;
      return Array.from({ length: frameCount }, (_, i) => prev[i] ?? null);
    });
  }, [frameCount]);

  useEffect(() => {
    const id = setInterval(() => {
      const remaining = SELECTION_TIMEOUT - Math.floor((Date.now() - startedAtRef.current) / 1000);
      setTimeLeft(Math.max(0, remaining));
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        navigation.replace('Start');
      }
    }, 250);
    return () => clearInterval(id);
  }, [navigation]);

  /* ------------------------------------------------------------
     SLOT ASPECT RATIO (REPLICATE TEMPLATE ORIENTATION IN FILMS)
  ------------------------------------------------------------ */
  const slotAspectRatio = useMemo(() => {
    const slots = activeTemplate?.slots || (activeTemplate as any)?.photoSlots;
    const firstSlot = slots?.[0];
    if (firstSlot && firstSlot.width && firstSlot.height) {
      return firstSlot.width / firstSlot.height;
    }
    return 4 / 3;
  }, [activeTemplate]);

  /* ------------------------------------------------------------
     UX: PREVENT DUPLICATES & DESELECT ON CLICK
  ------------------------------------------------------------ */
  const selectThumbnail = useCallback(
    (img: CapturedPhoto) => {
      const normalized = normalizePhoto(img);
      if (!normalized) return;
      playClick();

      const imgUri = getPhotoUri(normalized);

      // Check if this photo is ALREADY placed inside one of the frame slots
      const existingSlotIndex = selectedImagesState.findIndex(
        (slot) => slot && getPhotoUri(slot) === imgUri
      );

      if (existingSlotIndex !== -1) {
        // Photo is already selected in the frame: DESELECT and REMOVE from frame!
        setSelectedImagesState((prev) => {
          const next = [...prev];
          next[existingSlotIndex] = null;
          return next;
        });
        setSelectedThumb(null);
        return;
      }

      // Photo is NOT yet in the frame: Find first empty slot to place it
      const firstEmptyIndex = selectedImagesState.findIndex((slot) => slot === null);
      if (firstEmptyIndex !== -1) {
        setSelectedImagesState((prev) => {
          const next = [...prev];
          next[firstEmptyIndex] = normalized;
          return next;
        });
        setSelectedThumb(null);
      } else {
        // If all slots are full, set as active thumb so user can tap a slot to swap
        setSelectedThumb((prev) =>
          prev && getPhotoUri(prev) === imgUri ? null : normalized
        );
      }
    },
    [selectedImagesState]
  );

  const handleSlotPress = useCallback(
    (index: number) => {
      if (index < 0 || index >= frameCount) return;
      playClick();

      if (selectedThumb) {
        const thumbUri = getPhotoUri(selectedThumb);
        setSelectedImagesState((prev) => {
          const next = [...prev];
          // Remove from old slot if it was already somewhere in the frame
          const existingIdx = next.findIndex((slot) => slot && getPhotoUri(slot) === thumbUri);
          if (existingIdx !== -1) {
            next[existingIdx] = null;
          }
          next[index] = selectedThumb;
          return next;
        });
        setSelectedThumb(null);
      } else {
        // Tapping a filled slot clears it
        setSelectedImagesState((prev) => {
          if (!prev[index]) return prev;
          const next = [...prev];
          next[index] = null;
          return next;
        });
      }
    },
    [frameCount, selectedThumb]
  );

  const handleNext = () => {
    if (selectedImagesState.includes(null)) {
      Alert.alert('Incomplete', 'Please fill all photo slots before proceeding.');
      return;
    }
    playClick();
    const payload = selectedImagesState.filter((p): p is CapturedPhoto => !!p);
    send({ type: 'PREVIEW_CONFIRMED', selectedImages: payload });
    navigation.replace('Customize' as any, { ...params, selectedImages: payload });
  };

  /* ------------------------------------------------------------
     2-FILM STRIP DIVISION (HALF & HALF, HORIZONTAL SCROLL)
  ------------------------------------------------------------ */
  const filmStrips = useMemo(() => {
    const total = rawImages.length;
    if (total === 0) return [];

    // If 4 or fewer images, 1 film strip fits nicely on screen
    if (total <= 4) {
      return [
        {
          stripIndex: 0,
          items: rawImages.map((photo, idx) => ({ photo, globalIndex: idx })),
        },
      ];
    }

    // Divide into exactly 2 films, half & half
    const half = Math.ceil(total / 2);
    const strip1Items = rawImages.slice(0, half).map((photo, idx) => ({
      photo,
      globalIndex: idx,
    }));
    const strip2Items = rawImages.slice(half).map((photo, idx) => ({
      photo,
      globalIndex: half + idx,
    }));

    return [
      { stripIndex: 0, items: strip1Items },
      { stripIndex: 1, items: strip2Items },
    ];
  }, [rawImages]);

  // Card dimensions matching template slot orientation and fitting vertically without scroll
  const cardDimensions = useMemo(() => {
    const numStrips = filmStrips.length;
    const isMultiStrip = numStrips > 1;

    let photoH = isLandscape
      ? isMultiStrip ? verticalScale(105) : verticalScale(160)
      : isMultiStrip ? verticalScale(90) : verticalScale(135);

    let photoW = Math.round(photoH * slotAspectRatio);

    // Bounds safety
    const minW = scale(70);
    const maxW = scale(170);
    if (photoW < minW) {
      photoW = minW;
      photoH = Math.round(photoW / slotAspectRatio);
    } else if (photoW > maxW) {
      photoW = maxW;
      photoH = Math.round(photoW / slotAspectRatio);
    }

    return { photoWidth: photoW, photoHeight: photoH };
  }, [isLandscape, filmStrips.length, slotAspectRatio]);

  /* ------------------------------------------------------------
     MATHEMATICAL ASPECT-RATIO FRAME CONTAINMENT
  ------------------------------------------------------------ */
  const canvasWidth = (activeTemplate as any).canvas?.width || 1200;
  const canvasHeight = (activeTemplate as any).canvas?.height || 1800;

  const { previewWidth, previewHeight } = useMemo(() => {
    let availW = isLandscape ? width * 0.38 : width * 0.85;
    let availH = isLandscape ? height * 0.68 : height * 0.42;

    if (previewContainerSize && previewContainerSize.width > 50 && previewContainerSize.height > 50) {
      availW = previewContainerSize.width * 0.92;
      availH = previewContainerSize.height * 0.90;
    }

    const scaleFactor = Math.min(availW / canvasWidth, availH / canvasHeight);
    const pW = Math.max(120, Math.round(canvasWidth * scaleFactor));
    const pH = Math.max(160, Math.round(canvasHeight * scaleFactor));

    return { previewWidth: pW, previewHeight: pH };
  }, [previewContainerSize, canvasWidth, canvasHeight, width, height, isLandscape]);

  /* ------------------------------------------------------------
     RENDER TEMPLATE SLOT
  ------------------------------------------------------------ */
  const renderSlot = (idx: number) => {
    const slot = activeTemplate.slots?.[idx] || (activeTemplate as any).photoSlots?.[idx];
    if (!slot) return null;

    const slotW = (slot.width / canvasWidth) * previewWidth;
    const slotH = (slot.height / canvasHeight) * previewHeight;
    const left = (slot.x / canvasWidth) * previewWidth;
    const top = (slot.y / canvasHeight) * previewHeight;

    const img = selectedImagesState[idx];
    const canPlace = !!selectedThumb;
    const filled = !!img;

    return (
      <TouchableOpacity
        key={idx}
        activeOpacity={0.85}
        onPress={() => handleSlotPress(idx)}
        style={[
          styles.filmPhoto,
          { position: 'absolute', width: slotW, height: slotH, left, top },
          canPlace && { borderColor: theme.colors.primary, borderWidth: 2.5 },
          filled && { backgroundColor: '#000' },
        ]}
      >
        {filled ? (
          <SafePhotoImage photo={img} style={styles.full} />
        ) : (
          <View style={styles.emptySlot}>
            <Text
              style={[
                styles.plus,
                { color: canPlace ? theme.colors.primary : '#888', fontSize: fontSize(slotW * 0.22) },
              ]}
            >
              +
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const selectedCount = selectedImagesState.filter(Boolean).length;

  return (
    <ScreenContainer style={styles.container}>
      <View
        style={styles.mainWrapper}
        onStartShouldSetResponderCapture={() => {
          resetTimer();
          return false;
        }}
      >
        {/* ====================================================== */}
        {/* HEADER: Clean Non-Overlapping Layout */}
        {/* ====================================================== */}
        <View style={styles.header}>
          <View style={styles.headerTitles}>
            <Text style={[styles.title, { color: theme.colors.text }]}>SELECT YOUR BEST SHOTS</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              {selectedCount} of {frameCount} slots filled • Tap a photo to add or remove
            </Text>
          </View>
          <View
            style={[
              styles.timerPill,
              { backgroundColor: timeLeft <= 10 ? theme.colors.error : theme.colors.error + '25' },
            ]}
          >
            <Text style={[styles.timerText, { color: timeLeft <= 10 ? '#fff' : theme.colors.error }]}>
              ⏱ {timeLeft}s
            </Text>
          </View>
        </View>

        {/* ====================================================== */}
        {/* WORKSPACE */}
        {/* ====================================================== */}
        <View style={[styles.workspace, isLandscape ? styles.workspaceRow : styles.workspaceCol]}>
          {/* --- LEFT / TOP: 2 HORIZONTAL FILM STRIPS (NO VERTICAL SCROLL) --- */}
          <View style={[styles.galleryColumn, isLandscape ? styles.galleryColumnLandscape : styles.galleryColumnPortrait]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.subTitle, { color: theme.colors.textSecondary }]}>
                AVAILABLE REEL STRIPS ({rawImages.length} EXPOSURES)
              </Text>
            </View>

            {/* Horizontal ScrollView (Zero Vertical Scrolling) */}
            <ScrollView
              horizontal
              style={styles.stripsHorizontalScrollView}
              contentContainerStyle={styles.stripsHorizontalContent}
              showsHorizontalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.twoStripsStack}>
                {filmStrips.map(({ stripIndex, items }) => (
                  <FragmentedFilmStrip
                    key={`strip-${stripIndex}`}
                    stripIndex={stripIndex}
                    items={items}
                    photoWidth={cardDimensions.photoWidth}
                    photoHeight={cardDimensions.photoHeight}
                    filmColor={filmColor}
                    holeColor={holeColor}
                    selectedImagesState={selectedImagesState}
                    selectedThumb={selectedThumb}
                    onSelectPhoto={selectThumbnail}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          {/* --- RIGHT / BOTTOM: PREVIEW FRAME WITH ASPECT CONTAINMENT --- */}
          <View
            style={[styles.previewColumn, isLandscape ? styles.previewColumnLandscape : styles.previewColumnPortrait]}
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              setPreviewContainerSize({ width: w, height: h });
            }}
          >
            <View style={styles.previewCenterWrap}>
              {/* Photostrip Canvas Frame */}
              <View
                style={[
                  styles.previewFrameBox,
                  {
                    width: previewWidth,
                    height: previewHeight,
                    backgroundColor: (activeTemplate as any).background?.color || '#FFFFFF',
                  },
                ]}
              >
                {Array.from({ length: frameCount }).map((_, i) => renderSlot(i))}

                {(activeTemplate as any).overlayUrl && (
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Image
                      source={{ uri: (activeTemplate as any).overlayUrl }}
                      style={styles.full}
                      resizeMode="stretch"
                    />
                  </View>
                )}

                {/* Mathematical Footer Branding */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: previewHeight * 0.15,
                    paddingHorizontal: previewWidth * 0.05,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1, alignItems: 'flex-start' }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    {(state?.context?.activeEvent as any)?.tagline ? (
                      <Text
                        style={{
                          fontStyle: 'italic',
                          fontWeight: 'bold',
                          fontSize: previewHeight * 0.035,
                          color: '#222222',
                        }}
                        numberOfLines={1}
                      >
                        {(state.context.activeEvent as any).tagline}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '900', fontSize: previewHeight * 0.028, color: '#444444' }}>
                      HAPPY PIX
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.templateNameLabel, { color: theme.colors.textSecondary }]}>
                {activeTemplate.name}
              </Text>
            </View>
          </View>
        </View>

        {/* ====================================================== */}
        {/* FOOTER ACTIONS */}
        {/* ====================================================== */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: theme.colors.surfaceSecondary }]}
            onPress={() => navigation.replace('Start')}
          >
            <Text style={[styles.btnText, { color: theme.colors.text }]}>RESET</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.nextBtn,
              {
                backgroundColor: selectedImagesState.includes(null)
                  ? theme.colors.surfaceSecondary
                  : theme.colors.primary,
              },
            ]}
            onPress={handleNext}
          >
            <Text
              style={[
                styles.btnTextWhite,
                {
                  color: selectedImagesState.includes(null)
                    ? theme.colors.textSecondary
                    : '#fff',
                },
              ]}
            >
              NEXT STEP →
            </Text>
          </TouchableOpacity>
        </View>

        <InactivityToast visible={timeLeft <= 10} />
      </View>
    </ScreenContainer>
  );
};

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: {
    flex: 1,
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    justifyContent: 'space-between',
  },

  // Header: Clean Flex Row (No Overlaps)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(4),
    paddingHorizontal: scale(4),
    minHeight: verticalScale(46),
  },
  headerTitles: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize(20),
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: fontSize(11),
    fontWeight: '600',
    marginTop: verticalScale(2),
  },
  timerPill: {
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(14),
    borderRadius: moderateScale(20),
    marginLeft: scale(10),
  },
  timerText: {
    fontSize: fontSize(13),
    fontWeight: '900',
  },

  // Workspace Setup
  workspace: {
    flex: 1,
    width: '100%',
    marginVertical: verticalScale(10),
    gap: scale(16),
  },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  workspaceCol: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },

  // Gallery Area
  galleryColumn: {
    justifyContent: 'center',
  },
  galleryColumnLandscape: {
    flex: 1.15,
    height: '100%',
  },
  galleryColumnPortrait: {
    flex: 1,
    maxHeight: '52%',
  },
  sectionHeader: {
    marginBottom: verticalScale(6),
    paddingHorizontal: scale(4),
  },
  subTitle: {
    fontSize: fontSize(11),
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Horizontal Scroll & 2-Strip Stack
  stripsHorizontalScrollView: {
    flex: 1,
  },
  stripsHorizontalContent: {
    paddingVertical: verticalScale(2),
    paddingHorizontal: scale(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  twoStripsStack: {
    flexDirection: 'column',
    gap: verticalScale(12),
    justifyContent: 'center',
  },

  // Fragmented Film Strip UI
  fragmentedStripOuter: {
    borderRadius: moderateScale(10),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    paddingVertical: verticalScale(4),
  },
  stripRebateRailTop: {
    paddingHorizontal: scale(8),
    paddingTop: verticalScale(2),
  },
  stripRebateRailBottom: {
    paddingHorizontal: scale(8),
    paddingBottom: verticalScale(2),
  },
  stripRebateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(4),
    marginBottom: verticalScale(2),
  },
  stripRebateFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(4),
    marginTop: verticalScale(2),
  },
  stripRebateAmberText: {
    color: '#F59E0B',
    fontSize: fontSize(8),
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sprocketHoleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(2),
  },
  sprocketHoleH: {
    width: scale(9),
    height: verticalScale(6),
    borderRadius: moderateScale(2),
    borderWidth: 0.8,
    borderColor: 'rgba(0, 0, 0, 0.45)',
  },
  dxBarcode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
  },
  dxBar: {
    backgroundColor: '#F59E0B',
    borderRadius: 0.5,
  },

  // Frames Track Inside Strip
  stripFramesTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
  },
  frameWithDivider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frameItemContainer: {
    alignItems: 'center',
  },
  frameStampHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scale(4),
    marginBottom: verticalScale(2),
  },
  frameNumberStamp: {
    fontSize: fontSize(8),
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1,
  },
  frameExposureLabel: {
    fontSize: fontSize(7.5),
    fontWeight: '800',
    color: 'rgba(245, 158, 11, 0.6)',
  },
  photoBox: {
    borderRadius: moderateScale(5),
    overflow: 'hidden',
    backgroundColor: '#1c1c1f',
    position: 'relative',
  },
  interFrameGap: {
    width: scale(6),
    height: '80%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    marginHorizontal: scale(2),
    borderRadius: 1,
  },

  // Selection Badges
  selectedTickBadge: {
    position: 'absolute',
    top: scale(4),
    right: scale(4),
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  selectedTickText: {
    color: '#000',
    fontSize: fontSize(12),
    fontWeight: '900',
  },
  activeThumbOverlay: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: 'rgba(139, 92, 246, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeThumbText: {
    color: '#fff',
    fontSize: fontSize(9),
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Preview Area
  previewColumn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewColumnLandscape: {
    flex: 0.85,
    height: '100%',
  },
  previewColumnPortrait: {
    flex: 1,
    width: '100%',
  },
  previewCenterWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFrameBox: {
    borderRadius: moderateScale(6),
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    position: 'relative',
  },
  filmPhoto: {
    overflow: 'hidden',
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
  },
  emptySlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1c',
  },
  plus: {
    fontWeight: '300',
  },
  templateNameLabel: {
    marginTop: verticalScale(6),
    fontSize: fontSize(11),
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Footer Actions
  footer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: verticalScale(6),
  },
  backBtn: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(28),
    borderRadius: moderateScale(20),
  },
  nextBtn: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(28),
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: fontSize(13),
    fontWeight: '900',
    letterSpacing: 1,
  },
  btnTextWhite: {
    fontSize: fontSize(13),
    fontWeight: '900',
    letterSpacing: 1,
  },
  full: {
    width: '100%',
    height: '100%',
  },
  brokenCard: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brokenCardText: {
    color: '#444',
    fontSize: fontSize(9),
    fontWeight: '900',
  },
});