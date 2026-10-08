import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  useWindowDimensions,
  Platform,
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
  const isLandscape = width > 700;

  const template = session.template;
  const slotsCount = template?.layout.slots ?? 1;
  const photos = session.photos || [];

  // Slots array initialized with either existing selections or nulls
  const [selectedSlots, setSelectedSlots] = useState<(CapturedPhoto | null)[]>(() => {
    const initial: (CapturedPhoto | null)[] = Array.from({ length: slotsCount }, () => null);
    if (session.selectedPhotos && session.selectedPhotos.length > 0) {
      session.selectedPhotos.forEach((photo, idx) => {
        if (idx < slotsCount) initial[idx] = photo;
      });
    } else {
      // Pre-fill first n photos
      photos.slice(0, slotsCount).forEach((p, idx) => {
        initial[idx] = p;
      });
    }
    return initial;
  });

  // Which slot index is currently active for filling / replacing
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

  if (!template) {
    navigation.replace('Templates');
    return null;
  }

  // Tapping a photo in the film strip
  const handlePhotoTap = (photo: CapturedPhoto) => {
    SoundManager.play('click');

    const newSlots = [...selectedSlots];
    const existingIndex = newSlots.findIndex((item) => item && item.uri === photo.uri);

    if (existingIndex >= 0) {
      // If photo is already assigned to the current active slot, deselect it
      if (existingIndex === activeSlotIndex) {
        newSlots[activeSlotIndex] = null;
        setSelectedSlots(newSlots);
        return;
      }
      // If photo is already in another slot, swap it into the active slot
      const prevInActive = newSlots[activeSlotIndex];
      newSlots[activeSlotIndex] = photo;
      newSlots[existingIndex] = prevInActive;
      setSelectedSlots(newSlots);
      // Advance to next empty slot if available
      const nextEmpty = newSlots.findIndex((s) => s === null);
      if (nextEmpty >= 0) setActiveSlotIndex(nextEmpty);
      return;
    }

    // Assign photo to the active slot
    newSlots[activeSlotIndex] = photo;
    setSelectedSlots(newSlots);

    // Auto-advance to the next unfilled slot
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

  // Tapping a slot in the template canvas preview
  const handleSlotTap = (index: number) => {
    SoundManager.play('click');
    if (activeSlotIndex === index && selectedSlots[index]) {
      // Clear this slot
      const newSlots = [...selectedSlots];
      newSlots[index] = null;
      setSelectedSlots(newSlots);
    } else {
      // Focus this slot for assignment
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

  const isPortrait = template.layout.orientation === 'portrait';
  const previewWidth = isPortrait ? scale(210) : scale(280);
  const previewHeight = isPortrait ? verticalScale(290) : verticalScale(200);

  const sprocketHoles = Array.from({ length: Math.max(16, photos.length * 3) });

  return (
    <ScreenContainer style={{ backgroundColor: '#050508' }}>
      <LayoutContainer>
        {/* Prominent Header with Countdown Timer */}
        <ScreenHeader
          title="Select Your Best Photos"
          subtitle={`Fill all ${slotsCount} frames for ${template.name}. Tap any photo in the reel to place it.`}
          onBack={handleRetake}
          secondsLeft={secondsLeft}
          step="STEP 5 OF 5"
        />

        <View style={[styles.mainLayout, isLandscape ? styles.rowLayout : styles.colLayout]}>
          {/* Authentic 35mm Fragmented Film Strip Reel */}
          <View style={styles.filmStripWrapper}>
            {/* Top Rebate Header */}
            <View style={styles.filmRebateRail}>
              <View style={styles.rebateMeta}>
                <Text style={styles.rebateAmber}>KODAK PORTRA 400</Text>
                <View style={styles.miniBarcode}>
                  <View style={[styles.bar, { width: 3 }]} />
                  <View style={[styles.bar, { width: 1 }]} />
                  <View style={[styles.bar, { width: 4 }]} />
                  <View style={[styles.bar, { width: 2 }]} />
                </View>
                <Text style={styles.rebateAmber}>SAFETY FILM</Text>
                <Text style={styles.rebateAmber}>35MM FILM</Text>
              </View>
              <View style={styles.sprocketRow}>
                {sprocketHoles.map((_, i) => (
                  <View key={`top-hole-${i}`} style={styles.sprocketHole} />
                ))}
              </View>
            </View>

            {/* Photos Scroll Track */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reelTrack}
            >
              {photos.map((photo, i) => {
                const assignedSlotIndex = selectedSlots.findIndex(
                  (s) => s && s.uri === photo.uri
                );
                const isAssigned = assignedSlotIndex >= 0;
                const frameNum = String(i + 1).padStart(2, '0');

                return (
                  <View key={photo.id || i} style={styles.reelFrameGroup}>
                    {/* Exposure Label Stamp */}
                    <View style={styles.stampRow}>
                      <Text style={styles.stampText}>▷ {frameNum}</Text>
                      <Text style={styles.stampSub}>{i + 1}A</Text>
                    </View>

                    {/* Negative Photo Box */}
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => handlePhotoTap(photo)}
                      style={[
                        styles.photoFrame,
                        isAssigned && styles.photoFrameAssigned,
                      ]}
                    >
                      <Image source={{ uri: photo.uri }} style={styles.photoImg} />

                      {/* Numbered Slot Badge if Selected */}
                      {isAssigned && (
                        <View style={styles.assignedBadge}>
                          <Text style={styles.assignedBadgeText}>
                            #{assignedSlotIndex + 1}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            {/* Bottom Rebate Footer */}
            <View style={styles.filmRebateRail}>
              <View style={styles.sprocketRow}>
                {sprocketHoles.map((_, i) => (
                  <View key={`bot-hole-${i}`} style={styles.sprocketHole} />
                ))}
              </View>
              <View style={styles.rebateMeta}>
                <Text style={styles.rebateAmber}>EXP 01–{photos.length}</Text>
                <Text style={styles.rebateAmber}>ISO 400 / 27°</Text>
                <Text style={styles.rebateAmber}>HAPPYPIX LIVE</Text>
              </View>
            </View>
          </View>

          {/* Live Template Canvas Preview with Interactive Slots */}
          <View style={styles.previewStage}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.previewKicker}>PRINT CANVAS</Text>
                <Text style={styles.previewTargetText}>
                  Active Slot: #{activeSlotIndex + 1}
                </Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>
                  {filledCount} / {slotsCount} FILLED
                </Text>
              </View>
            </View>

            {/* The Print Canvas */}
            <View style={styles.canvasContainer}>
              <TemplateCanvas
                template={template}
                photos={selectedSlots.filter(Boolean) as CapturedPhoto[]}
                interactiveSlot={handleSlotTap}
                style={{
                  width: previewWidth,
                  height: previewHeight,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              />
            </View>

            <Text style={styles.interactiveHint}>
              💡 Tap any frame in the print to change or clear it.
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
    paddingHorizontal: scale(16),
    gap: scale(18),
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  colLayout: {
    flexDirection: 'column',
    justifyContent: 'space-evenly',
  },
  filmStripWrapper: {
    backgroundColor: '#0a0a0f',
    borderRadius: moderateScale(20),
    borderWidth: 1.5,
    borderColor: '#222232',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(14),
    width: scale(380),
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  filmRebateRail: {
    paddingVertical: 2,
  },
  rebateMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  rebateAmber: {
    color: '#d97706',
    fontSize: fontSize(8),
    fontWeight: '900',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  miniBarcode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bar: {
    height: 8,
    backgroundColor: '#d97706',
  },
  sprocketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  sprocketHole: {
    width: scale(11),
    height: scale(7),
    borderRadius: 2,
    backgroundColor: '#1f1f2e',
  },
  reelTrack: {
    alignItems: 'center',
    paddingVertical: verticalScale(8),
    gap: scale(12),
  },
  reelFrameGroup: {
    alignItems: 'center',
  },
  stampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 3,
  },
  stampText: {
    color: '#d97706',
    fontSize: fontSize(8),
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  stampSub: {
    color: '#a1a1aa',
    fontSize: fontSize(7),
    fontWeight: '700',
  },
  photoFrame: {
    width: scale(105),
    height: verticalScale(80),
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#252538',
    backgroundColor: '#161622',
    overflow: 'hidden',
    position: 'relative',
  },
  photoFrameAssigned: {
    borderColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  assignedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#8b5cf6',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  assignedBadgeText: {
    color: '#ffffff',
    fontSize: fontSize(10),
    fontWeight: '900',
  },
  previewStage: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(22),
    borderWidth: 1.5,
    borderColor: '#222232',
    padding: scale(18),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: verticalScale(10),
  },
  previewKicker: {
    color: '#8b5cf6',
    fontSize: fontSize(9),
    fontWeight: '800',
    letterSpacing: 2,
  },
  previewTargetText: {
    color: '#ffffff',
    fontSize: fontSize(13),
    fontWeight: '800',
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusPillText: {
    color: '#c4b5fd',
    fontSize: fontSize(11),
    fontWeight: '800',
  },
  canvasContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#08080c',
    borderWidth: 1,
    borderColor: '#1f1f2e',
  },
  interactiveHint: {
    color: '#71717a',
    fontSize: fontSize(11),
    marginTop: verticalScale(10),
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
