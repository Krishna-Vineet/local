import { goBackOr } from '../utils/navigation';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import type { CapturedPhoto } from '@happypix/types';
import {
  ScreenContainer,
  LayoutContainer,
  TemplateCanvas,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { useBooth } from '../context/BoothProvider';
import { ScreenHeader } from '../components/ScreenHeader';
import SoundManager from '../utils/SoundManager';
import { InactivityToast } from '../components/InactivityToast';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Photos'>;

export const PhotoSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const {
    session,
    updateSession,
    setIdleTimerEnabled,
    secondsLeft,
    resetIdleTimer,
    resetGuestSession,
  } = useBooth();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isFocused = useIsFocused();

  const template = session.template;
  const slotsCount = template?.layout.slots ?? 1;
  const photos = session.photos || [];

  // Slots array initialized with existing selections or first n photos
  const [selectedSlots, setSelectedSlots] = useState<(CapturedPhoto | null)[]>(() => {
    const initial: (CapturedPhoto | null)[] = Array.from({ length: slotsCount }, () => null);
    if (session.selectedPhotos && session.selectedPhotos.length > 0) {
      session.selectedPhotos.forEach((photo, idx) => {
        if (idx < slotsCount) initial[idx] = photo;
      });
    } else {
      photos.slice(0, slotsCount).forEach((p, idx) => {
        initial[idx] = p;
      });
    }
    return initial;
  });

  // Which slot index is currently targeted for filling / replacing
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);

  useEffect(() => {
    setIdleTimerEnabled(true);
    resetIdleTimer();
    return () => setIdleTimerEnabled(false);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0 && isFocused) {
      resetGuestSession(navigation);
    }
  }, [secondsLeft, isFocused]);

  // Safe navigation redirect outside render phase
  useEffect(() => {
    if (!template) {
      navigation.replace('Templates');
    }
  }, [template, navigation]);

  if (!template) {
    return null;
  }

  // Tapping a photo in the film strip
  const handlePhotoTap = (photo: CapturedPhoto) => {
    SoundManager.play('click');

    const newSlots = [...selectedSlots];
    const existingIndex = newSlots.findIndex((item) => item && item.uri === photo.uri);

    if (existingIndex >= 0) {
      // If photo is already in active slot, remove it
      if (existingIndex === activeSlotIndex) {
        newSlots[activeSlotIndex] = null;
        setSelectedSlots(newSlots);
        return;
      }
      // If photo is in another slot, swap with active slot
      const prevInActive = newSlots[activeSlotIndex];
      newSlots[activeSlotIndex] = photo;
      newSlots[existingIndex] = prevInActive;
      setSelectedSlots(newSlots);

      const nextEmpty = newSlots.findIndex((s) => s === null);
      if (nextEmpty >= 0) setActiveSlotIndex(nextEmpty);
      return;
    }

    // Place into current active slot
    newSlots[activeSlotIndex] = photo;
    setSelectedSlots(newSlots);

    // Auto-advance to the next empty slot
    const nextEmpty = newSlots.findIndex((s, idx) => idx > activeSlotIndex && s === null);
    if (nextEmpty >= 0) {
      setActiveSlotIndex(nextEmpty);
    } else {
      const anyEmpty = newSlots.findIndex((s) => s === null);
      if (anyEmpty >= 0) {
        setActiveSlotIndex(anyEmpty);
      }
    }
  };

  // Tapping a slot in the template preview
  const handleSlotTap = (index: number) => {
    SoundManager.play('click');
    if (activeSlotIndex === index && selectedSlots[index]) {
      const newSlots = [...selectedSlots];
      newSlots[index] = null;
      setSelectedSlots(newSlots);
    } else {
      setActiveSlotIndex(index);
    }
  };

  const filledCount = selectedSlots.filter(Boolean).length;
  const isComplete = filledCount === slotsCount;

  const handleNext = () => {
    if (!isComplete) return;
    SoundManager.play('click');
    updateSession({ selectedPhotos: selectedSlots.filter(Boolean) as CapturedPhoto[] });
    navigation.navigate('Customize');
  };

  const handleRetake = () => {
    SoundManager.play('click');
    goBackOr(navigation, 'Start');
  };

  const isPortraitTemplate = template.layout.orientation === 'portrait';
  const rawCw = template.layout?.canvas?.width;
  const rawCh = template.layout?.canvas?.height;
  const aspect = rawCw && rawCh ? rawCw / rawCh : isPortraitTemplate ? 2 / 3 : 3 / 2;

  const maxCanvasW = isLandscape ? scale(340) : Math.max(200, width - 84);
  const maxCanvasH = isLandscape
    ? Math.min(verticalScale(300), Math.max(180, height * 0.44))
    : Math.max(170, Math.min(340, Math.round(height * 0.34)));
  const canvasWidth = Math.min(maxCanvasW, Math.round(maxCanvasH * aspect));
  const canvasHeight = Math.round(canvasWidth / aspect);
  const portraitReelHeight = Math.min(185, Math.max(138, Math.round(height * 0.21)));
  const portraitCellHeight = Math.max(76, portraitReelHeight - 62);
  const portraitCellWidth = Math.max(104, Math.round(portraitCellHeight * 1.32));

  return (
    <ScreenContainer style={{ backgroundColor: '#050508' }}>
      <LayoutContainer>
        {/* Prominent Header with Fixed-width Timer Pill */}
        <ScreenHeader
          title="Pick Your Best Shots"
          subtitle={`Slot #${activeSlotIndex + 1} active. Tap any photo below to place it into your print.`}
          secondsLeft={secondsLeft}
          step="PHOTOS"
        />

        <View style={[styles.mainLayout, isLandscape ? styles.rowLayout : styles.colLayout]}>
          {/* Negative 35mm Film Strip Reel */}
          <View
            style={[
              styles.filmReelCard,
              isLandscape ? styles.filmReelLandscape : [styles.filmReelPortrait, { height: portraitReelHeight }],
            ]}
          >
            <View style={styles.filmReelHeader}>
              <View style={styles.filmHeaderLeft}>
                <View style={styles.amberDot} />
                <Text style={styles.filmReelTitle}>35MM FILM REEL</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.filmReelCount}>
                  {filledCount}/{slotsCount} PLACED
                </Text>
              </View>
            </View>

            {/* Sprocket Holes Rail Top */}
            <View style={styles.sprocketRail}>
              {Array.from({ length: 16 }).map((_, i) => (
                <View key={`sprock-top-${i}`} style={styles.sprocketHole} />
              ))}
            </View>

            {/* Scrollable Thumbnails Reel (2-column Grid in landscape, horizontal scroll in portrait) */}
            <ScrollView
              horizontal={!isLandscape}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1, width: '100%' }}
              contentContainerStyle={isLandscape ? styles.gridScrollContent : styles.reelScrollContent}
            >
              <View style={isLandscape ? styles.photoGrid : styles.photoRow}>
                {photos.map((photo, i) => {
                  const assignedSlotIndex = selectedSlots.findIndex(
                    (s) => s && s.uri === photo.uri
                  );
                  const isAssigned = assignedSlotIndex >= 0;
                  const frameNum = String(i + 1).padStart(2, '0');

                  return (
                    <TouchableOpacity
                      key={photo.id || i}
                      activeOpacity={0.88}
                      onPress={() => handlePhotoTap(photo)}
                      style={[
                        styles.photoCell,
                        isLandscape
                          ? styles.photoCellGrid
                          : [styles.photoCellRow, { width: portraitCellWidth, height: portraitCellHeight }],
                        isAssigned && styles.photoCellAssigned,
                      ]}
                    >
                      <View style={styles.photoCellHeader}>
                        <Text style={styles.photoCellNum}>▷ SHOT {frameNum}</Text>
                        {isAssigned && (
                          <View style={styles.slotTag}>
                            <Text style={styles.slotTagText}>SLOT #{assignedSlotIndex + 1}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.photoCellImgWrap}>
                        <Image
                          source={{ uri: photo.uri }}
                          resizeMode="cover"
                          style={styles.photoCellImg}
                        />
                      </View>

                      {isAssigned && (
                        <View style={styles.assignedOverlay}>
                          <Text style={styles.assignedCheckIcon}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Sprocket Holes Rail Bottom */}
            <View style={styles.sprocketRail}>
              {Array.from({ length: 16 }).map((_, i) => (
                <View key={`sprock-bot-${i}`} style={styles.sprocketHole} />
              ))}
            </View>
          </View>

          {/* Center Print Canvas Preview */}
          <View style={[styles.canvasStageCard, isLandscape ? styles.canvasStageLandscape : styles.canvasStagePortrait]}>
            <View style={styles.stageHeader}>
              <Text style={styles.stageBadge}>LIVE PRINT PREVIEW</Text>
              <View style={styles.activeSlotIndicator}>
                <Text style={styles.activeSlotText}>
                  Target: <Text style={styles.activeSlotHighlight}>Slot #{activeSlotIndex + 1}</Text>
                </Text>
              </View>
            </View>

            <View style={styles.canvasWrap}>
              <TemplateCanvas
                template={template}
                photos={selectedSlots as any}
                interactiveSlot={handleSlotTap}
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              />
            </View>

            <Text style={styles.tapTip}>
              💡 Tap any frame in the print to select or replace it.
            </Text>
          </View>
        </View>

        {/* Footer Actions */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleRetake}
            activeOpacity={0.8}
          >
            <Text style={styles.backBtnText}>← Retake Photos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.nextBtn,
              !isComplete && styles.nextBtnDisabled,
            ]}
            disabled={!isComplete}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Customize My Print →</Text>
          </TouchableOpacity>
        </View>

        {secondsLeft <= 25 && (
          <InactivityToast secondsLeft={secondsLeft} onStayActive={resetIdleTimer} />
        )}
      </LayoutContainer>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  mainLayout: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(14),
    gap: scale(18),
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colLayout: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: verticalScale(12),
  },
  filmReelCard: {
    backgroundColor: '#0a0a0f',
    borderRadius: moderateScale(22),
    borderWidth: 1.5,
    borderColor: '#20202e',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(14),
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  filmReelLandscape: {
    width: scale(420),
    height: verticalScale(390),
  },
  filmReelPortrait: {
    width: '100%',
  },
  filmReelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: verticalScale(6),
  },
  filmHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amberDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#d97706',
    marginRight: 6,
  },
  filmReelTitle: {
    color: '#d97706',
    fontSize: fontSize(10),
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  countBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  filmReelCount: {
    color: '#c4b5fd',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sprocketRail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(4),
  },
  sprocketHole: {
    width: scale(10),
    height: scale(6),
    borderRadius: 2,
    backgroundColor: '#1c1c2a',
  },
  gridScrollContent: {
    paddingVertical: verticalScale(6),
    paddingHorizontal: 1,
  },
  reelScrollContent: {
    alignItems: 'center',
    paddingVertical: verticalScale(6),
    gap: scale(10),
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: verticalScale(10),
    width: '100%',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  photoCell: {
    borderRadius: moderateScale(10),
    borderWidth: 1.5,
    borderColor: '#242436',
    backgroundColor: '#12121c',
    padding: scale(3),
    position: 'relative',
    overflow: 'hidden',
  },
  photoCellGrid: {
    width: '48.5%',
    height: verticalScale(125),
  },
  photoCellRow: {
    width: scale(100),
    height: verticalScale(78),
  },
  photoCellAssigned: {
    borderColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  photoCellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 3,
    paddingBottom: 2,
  },
  photoCellNum: {
    color: '#d97706',
    fontSize: fontSize(8),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  slotTag: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  slotTagText: {
    color: '#ffffff',
    fontSize: fontSize(7),
    fontWeight: '900',
  },
  photoCellImgWrap: {
    width: '100%',
    flex: 1,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1b1b26',
  },
  photoCellImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  assignedOverlay: {
    position: 'absolute',
    bottom: scale(6),
    right: scale(6),
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  assignedCheckIcon: {
    color: '#ffffff',
    fontSize: fontSize(11),
    fontWeight: '900',
  },
  canvasStageCard: {
    backgroundColor: '#0a0a0f',
    borderRadius: moderateScale(22),
    borderWidth: 1.5,
    borderColor: '#20202e',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(14),
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
  },
  canvasStageLandscape: {
    width: scale(420),
    height: verticalScale(390),
    justifyContent: 'space-between',
  },
  canvasStagePortrait: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  stageBadge: {
    color: '#8b5cf6',
    fontSize: fontSize(9),
    fontWeight: '800',
    letterSpacing: 2,
  },
  activeSlotIndicator: {
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  activeSlotText: {
    color: '#a1a1aa',
    fontSize: fontSize(9),
    fontWeight: '600',
  },
  activeSlotHighlight: {
    color: '#ffffff',
    fontWeight: '900',
  },
  canvasWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    padding: 3,
    borderRadius: 14,
    backgroundColor: '#07070b',
    borderWidth: 1,
    borderColor: '#1d1d2c',
  },
  tapTip: {
    color: '#71717a',
    fontSize: fontSize(11),
    textAlign: 'center',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
  },
  backBtn: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(22),
    borderRadius: moderateScale(12),
    backgroundColor: '#171720',
    borderWidth: 1,
    borderColor: '#262634',
  },
  backBtnText: {
    color: '#d4d4d8',
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  nextBtn: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(28),
    borderRadius: moderateScale(12),
    backgroundColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  nextBtnDisabled: {
    opacity: 0.35,
    shadowOpacity: 0,
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '800',
  },
});

