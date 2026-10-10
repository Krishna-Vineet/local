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
    if (secondsLeft === 0) {
      resetGuestSession(navigation);
    }
  }, [secondsLeft]);

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
    navigation.goBack();
  };

  const isPortraitTemplate = template.layout.orientation === 'portrait';
  // Responsive canvas sizing that fits on both orientations
  const canvasWidth = isLandscape
    ? isPortraitTemplate
      ? scale(210)
      : scale(290)
    : isPortraitTemplate
    ? scale(200)
    : scale(280);
  const canvasHeight = isLandscape
    ? isPortraitTemplate
      ? verticalScale(290)
      : verticalScale(195)
    : isPortraitTemplate
    ? verticalScale(260)
    : verticalScale(180);

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
          <View style={[styles.filmReelCard, isLandscape ? styles.filmReelLandscape : styles.filmReelPortrait]}>
            <View style={styles.filmReelHeader}>
              <View style={styles.filmHeaderLeft}>
                <View style={styles.amberDot} />
                <Text style={styles.filmReelTitle}>35MM FILM REEL</Text>
              </View>
              <Text style={styles.filmReelCount}>
                {filledCount}/{slotsCount} PLACED
              </Text>
            </View>

            {/* Sprocket Holes Rail Top */}
            <View style={styles.sprocketRail}>
              {Array.from({ length: 16 }).map((_, i) => (
                <View key={`sprock-top-${i}`} style={styles.sprocketHole} />
              ))}
            </View>

            {/* Scrollable Thumbnails Reel */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reelScrollContent}
            >
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
                      isAssigned && styles.photoCellAssigned,
                    ]}
                  >
                    <View style={styles.photoCellHeader}>
                      <Text style={styles.photoCellNum}>▷ {frameNum}</Text>
                      {isAssigned && (
                        <View style={styles.slotTag}>
                          <Text style={styles.slotTagText}>SLOT #{assignedSlotIndex + 1}</Text>
                        </View>
                      )}
                    </View>

                    <Image source={{ uri: photo.uri }} style={styles.photoCellImg} />

                    {isAssigned && (
                      <View style={styles.assignedOverlay}>
                        <Text style={styles.assignedCheckIcon}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sprocket Holes Rail Bottom */}
            <View style={styles.sprocketRail}>
              {Array.from({ length: 16 }).map((_, i) => (
                <View key={`sprock-bot-${i}`} style={styles.sprocketHole} />
              ))}
            </View>
          </View>

          {/* Center Print Canvas Preview */}
          <View style={styles.canvasStageCard}>
            <View style={styles.stageHeader}>
              <Text style={styles.stageBadge}>LIVE PRINT PREVIEW</Text>
              <Text style={styles.activeSlotIndicator}>
                Target Frame: <Text style={styles.activeSlotHighlight}>Slot #{activeSlotIndex + 1}</Text>
              </Text>
            </View>

            <View style={styles.canvasWrap}>
              <TemplateCanvas
                template={template}
                photos={selectedSlots.filter(Boolean) as CapturedPhoto[]}
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
    gap: scale(16),
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  colLayout: {
    flexDirection: 'column',
    justifyContent: 'space-evenly',
  },
  filmReelCard: {
    backgroundColor: '#0a0a0f',
    borderRadius: moderateScale(22),
    borderWidth: 1.5,
    borderColor: '#20202e',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(14),
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  filmReelLandscape: {
    width: scale(360),
    maxHeight: '100%',
  },
  filmReelPortrait: {
    width: '100%',
    maxHeight: verticalScale(170),
  },
  filmReelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 6,
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
  filmReelCount: {
    color: '#a78bfa',
    fontSize: fontSize(11),
    fontWeight: '800',
  },
  sprocketRail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  sprocketHole: {
    width: scale(10),
    height: scale(6),
    borderRadius: 2,
    backgroundColor: '#1c1c2a',
  },
  reelScrollContent: {
    alignItems: 'center',
    paddingVertical: verticalScale(6),
    gap: scale(10),
  },
  photoCell: {
    width: scale(100),
    height: verticalScale(78),
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#262638',
    backgroundColor: '#14141e',
    padding: 2,
    position: 'relative',
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
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  photoCellNum: {
    color: '#d97706',
    fontSize: fontSize(7),
    fontWeight: '900',
  },
  slotTag: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  slotTagText: {
    color: '#ffffff',
    fontSize: fontSize(6),
    fontWeight: '900',
  },
  photoCellImg: {
    width: '100%',
    height: '80%',
    borderRadius: 5,
    backgroundColor: '#1b1b26',
  },
  assignedOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignedCheckIcon: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  canvasStageCard: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(22),
    borderWidth: 1.5,
    borderColor: '#222232',
    padding: scale(16),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: verticalScale(8),
  },
  stageBadge: {
    color: '#8b5cf6',
    fontSize: fontSize(9),
    fontWeight: '800',
    letterSpacing: 2,
  },
  activeSlotIndicator: {
    color: '#a1a1aa',
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  activeSlotHighlight: {
    color: '#ffffff',
    fontWeight: '900',
  },
  canvasWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    borderRadius: 14,
    backgroundColor: '#07070b',
    borderWidth: 1,
    borderColor: '#1d1d2c',
  },
  tapTip: {
    color: '#71717a',
    fontSize: fontSize(11),
    marginTop: verticalScale(8),
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
