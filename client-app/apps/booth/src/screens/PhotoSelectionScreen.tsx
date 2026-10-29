import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CapturedPhoto } from '@happypix/types';
import {
  Button,
  Icon,
  TemplatePreview,
  Eyebrow,
  fonts,
  fontSize,
  moderateScale,
  radii,
  scale,
  shadows,
  useAppTheme,
  verticalScale,
  resolveSlotCount,
} from '../../../../packages/ui/src/index';
import { AppShell } from '../components/AppShell';
import { InactivityToast } from '../components/InactivityToast';
import { useBooth } from '../context/BoothProvider';
import { goBackOr } from '../utils/navigation';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

/**
 * Photo selection — a direct port of Electron's `PhotoSelectionScreen`
 * (`electron/src/ui/screens/PhotoSelectionScreen.tsx` + `.negative-gallery`,
 * `.negative-track`, `.selection-preview`, `.slot-dots`).
 *
 * Behaviour, matching the desktop kiosk exactly:
 *  · slots start **empty** — nothing is pre-filled, the guest places each shot;
 *  · tapping a photo drops it into the active slot and advances to the next
 *    empty slot (wrapping to the first empty one at the end);
 *  · tapping a photo that is already placed swaps it with the active slot, and
 *    tapping the one already in the active slot clears that slot;
 *  · tapping a slot in the preview makes it active, or clears it if it is
 *    already active and filled.
 *
 * The old tablet screen auto-filled the first N shots, which made the "choose
 * your best photos" step meaningless.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'Photos'>;

const samePhoto = (a: CapturedPhoto | null, b: CapturedPhoto) =>
  Boolean(a) && (a!.id === b.id || a!.uri === b.uri);

export const PhotoSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const p = theme.palette;
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
  const slotsCount = resolveSlotCount(template as any);
  const photos = session.photos || [];

  // Empty start. Only a return trip keeps whatever was already chosen.
  const [selectedSlots, setSelectedSlots] = useState<(CapturedPhoto | null)[]>(() => {
    const initial: (CapturedPhoto | null)[] = Array.from({ length: slotsCount }, () => null);
    (session.selectedPhotos || []).forEach((photo, idx) => {
      if (idx < slotsCount) initial[idx] = photo;
    });
    return initial;
  });
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  /*
   * The strip used to be a 168 × 126 box with a fixed height, so four
   * photographs floated in a mostly-empty dark rectangle and each thumb was
   * smaller than a postage stamp. Now the *images* decide the strip: the frame
   * is one photo aspect (4:3, what the camera writes), sized from the room the
   * gallery actually has, and the gallery is only as tall as that frame.
   */
  const [galleryWidth, setGalleryWidth] = useState(0);
  const PHOTO_ASPECT = 4 / 3;
  const railH = verticalScale(22);
  const stripPad = verticalScale(9);
  const stripGap = scale(11);
  // Cap the frame so at least ~2.2 of them share the column, and never taller
  // than the screen wants to give this section.
  const maxFrameHeight = isLandscape ? height * 0.4 : height * 0.28;
  const widthLimitedFrame =
    galleryWidth > 0 ? ((galleryWidth - stripPad * 2 - stripGap * 2) / 2.2) / PHOTO_ASPECT : maxFrameHeight;
  const frameHeight = Math.max(84, Math.min(maxFrameHeight, widthLimitedFrame));
  const frameWidth = Math.round(frameHeight * PHOTO_ASPECT);
  const stripHeight = Math.round(frameHeight + stripPad * 2);

  useEffect(() => {
    setIdleTimerEnabled(true);
    resetIdleTimer();
    return () => setIdleTimerEnabled(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (secondsLeft === 0 && isFocused) resetGuestSession(navigation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, isFocused]);

  useEffect(() => {
    if (!template) navigation.replace('Templates');
  }, [template, navigation]);

  const filledCount = selectedSlots.filter(Boolean).length;
  const isComplete = filledCount === slotsCount;

  const handlePhotoTap = (photo: CapturedPhoto) => {
    if (transitioning) return;
    SoundManager.play('select');
    resetIdleTimer();

    const next = [...selectedSlots];
    const existing = next.findIndex((item) => samePhoto(item, photo));

    if (existing >= 0) {
      if (existing === activeSlotIndex) {
        next[activeSlotIndex] = null;
        setSelectedSlots(next);
        return;
      }
      const previous = next[activeSlotIndex];
      next[activeSlotIndex] = photo;
      next[existing] = previous ?? null;
      setSelectedSlots(next);
      const nextEmpty = next.findIndex((slot) => slot === null);
      if (nextEmpty >= 0) setActiveSlotIndex(nextEmpty);
      return;
    }

    next[activeSlotIndex] = photo;
    setSelectedSlots(next);
    const after = next.findIndex((slot, idx) => idx > activeSlotIndex && slot === null);
    if (after >= 0) {
      setActiveSlotIndex(after);
    } else {
      const anyEmpty = next.findIndex((slot) => slot === null);
      if (anyEmpty >= 0) setActiveSlotIndex(anyEmpty);
    }
  };

  const handleSlotTap = (index: number) => {
    if (transitioning) return;
    SoundManager.play('select');
    resetIdleTimer();
    if (activeSlotIndex === index && selectedSlots[index]) {
      const next = [...selectedSlots];
      next[index] = null;
      setSelectedSlots(next);
    } else {
      setActiveSlotIndex(index);
    }
  };

  const handleNext = () => {
    if (!isComplete || transitioning) return;
    setTransitioning(true);
    SoundManager.play('success');
    updateSession({ selectedPhotos: selectedSlots.filter(Boolean) as CapturedPhoto[] });
    navigation.navigate('Customize');
  };

  const handleRetake = () => {
    SoundManager.play('click');
    goBackOr(navigation, 'Camera');
  };

  const hint = useMemo(() => {
    if (!filledCount) return 'Tap any photo to fill the first empty slot.';
    if (filledCount < slotsCount) return `Filling in order — next into slot ${activeSlotIndex + 1}.`;
    return 'Full — tap a photo, then a slot, to swap. Tap a filled slot to clear it.';
  }, [filledCount, slotsCount, activeSlotIndex]);

  if (!template) return null;

  return (
    <AppShell
      step="photos"
      title="Choose your best shots"
      subtitle={`Pick ${slotsCount} photo${slotsCount === 1 ? '' : 's'} for ${template.name}.`}
      secondsLeft={secondsLeft}
      stretch
      testID="photos-screen"
    >
      <View style={[styles.layout, isLandscape ? styles.layoutRow : styles.layoutCol]}>
        {/* ── the negative strip ─────────────────────────────────────────── */}
        <View
          style={[styles.gallery, isLandscape ? null : styles.galleryStacked]}
          onLayout={(event) => {
            const w = event.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - galleryWidth) > 0.5) setGalleryWidth(w);
          }}
        >
          <View style={[styles.rail, { height: railH }]}>
            <Text style={styles.railText}>YOUR MOMENTS</Text>
            <Text style={styles.railText}>{photos.length} EXPOSURES</Text>
            <Text style={styles.railText}>HAPPYPIX</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ height: stripHeight }}
            contentContainerStyle={[
              styles.track,
              { paddingVertical: stripPad, gap: stripGap },
            ]}
          >
            {photos.map((photo, index) => {
              const assigned = selectedSlots.findIndex((item) => samePhoto(item, photo));
              return (
                <Pressable
                  key={photo.id || photo.uri || index}
                  onPress={() => handlePhotoTap(photo)}
                  style={[
                    styles.frame,
                    { width: frameWidth, height: frameHeight },
                    assigned >= 0 ? { borderColor: p.pink } : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Photo ${index + 1}${assigned >= 0 ? `, in slot ${assigned + 1}` : ''}`}
                >
                  <Text style={styles.frameNumber}>{String(index + 1).padStart(2, '0')}</Text>
                  <Image source={{ uri: photo.uri }} resizeMode="cover" style={styles.frameImage} />
                  {assigned >= 0 ? (
                    <View style={[styles.slotBadge, { backgroundColor: p.pink }]}>
                      <Text style={styles.slotBadgeText}>{assigned + 1}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.rail, styles.railBottom, { height: railH }]}>
            <Text style={styles.railText}>TAP TO SELECT</Text>
            <Text style={styles.railText}>35MM</Text>
          </View>
        </View>

        {/* ── live preview ───────────────────────────────────────────────── */}
        <View style={styles.preview}>
          <View style={styles.previewHead}>
            <View style={styles.previewHeadLeft}>
              <Eyebrow color={p.pinkDeep}>Live preview</Eyebrow>
              <Text style={[styles.previewTitle, { color: p.ink }]}>
                {filledCount} of {slotsCount} selected · slot {activeSlotIndex + 1}
              </Text>
              <Text style={[styles.previewHint, { color: p.muted }]}>{hint}</Text>
            </View>
            <View style={styles.dots}>
              {Array.from({ length: slotsCount }).map((_, index) => {
                const filled = Boolean(selectedSlots[index]);
                const active = index === activeSlotIndex;
                return (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: filled ? p.pink : active ? p.violet : '#ddd2e1',
                        transform: [{ scale: active ? 1.25 : 1 }],
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>

          <TemplatePreview
            template={template}
            photos={selectedSlots as CapturedPhoto[]}
            interactiveSlot={handleSlotTap}
            activeSlotIndex={activeSlotIndex}
            maxHeight={height * (isLandscape ? 0.5 : 0.36)}
            maxWidth={isLandscape ? width * 0.36 : width * 0.62}
            radius={moderateScale(10)}
          />

          <View style={styles.previewFoot}>
            <Icon name="info" size={fontSize(13)} color={p.faint} />
            <Text style={[styles.previewFootText, { color: p.faint }]}>
              Tap a filled frame to clear it — or pick a photo, then a slot, to swap.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="Retake photos" variant="secondary" icon="arrow-left" onPress={handleRetake} />
        <Button
          label={transitioning ? 'Opening customisation…' : 'Customize my print'}
          iconRight="arrow-right"
          onPress={handleNext}
          disabled={!isComplete}
          loading={transitioning}
          style={styles.nextBtn}
          testID="photos-next"
        />
      </View>

      <InactivityToast secondsLeft={secondsLeft} onStayActive={resetIdleTimer} />
    </AppShell>
  );
};

const styles = StyleSheet.create({
  layout: { flex: 1, minHeight: 0, gap: scale(20) },
  layoutRow: { flexDirection: 'row', alignItems: 'center' },
  layoutCol: { flexDirection: 'column', justifyContent: 'center' },

  /* Electron's `.negative-gallery`: a dark film strip with printed rails. */
  gallery: {
    flex: 1.35,
    minWidth: 0,
    // Height is content-driven (`stripHeight`); `alignSelf` keeps the dark
    // film strip hugging its frames instead of stretching into a big empty box.
    alignSelf: 'center',
    borderRadius: moderateScale(10),
    backgroundColor: '#17131a',
    overflow: 'hidden',
    ...shadows.card,
  },
  // Portrait: the strip sits above the preview and must not flex vertically.
  galleryStacked: { flexGrow: 0, flexShrink: 0, width: '100%' },
  rail: {
    height: verticalScale(22),
    paddingHorizontal: scale(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  railBottom: { justifyContent: 'space-between' },
  railText: {
    fontFamily: fonts.bodyBlack,
    fontSize: fontSize(7),
    letterSpacing: 1.1,
    color: '#d89d60',
  },
  track: { paddingHorizontal: scale(11), alignItems: 'center' },
  frame: {
    borderRadius: moderateScale(3),
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#27202b',
    overflow: 'hidden',
  },
  frameImage: { width: '100%', height: '100%' },
  frameNumber: {
    position: 'absolute',
    zIndex: 2,
    left: scale(7),
    top: verticalScale(5),
    fontFamily: fonts.bodyBlack,
    fontSize: fontSize(8),
    color: '#ffc07c',
  },
  slotBadge: {
    position: 'absolute',
    zIndex: 3,
    right: scale(7),
    top: verticalScale(6),
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotBadgeText: { fontFamily: fonts.bodyBlack, fontSize: fontSize(12), color: '#ffffff' },

  preview: { flex: 1, minWidth: 0, minHeight: 0, alignItems: 'stretch' },
  previewHead: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: scale(10),
    marginBottom: verticalScale(10),
  },
  previewHeadLeft: { flex: 1 },
  previewTitle: { fontFamily: fonts.display, fontSize: fontSize(16), marginTop: verticalScale(3) },
  previewHint: { fontFamily: fonts.body, fontSize: fontSize(10.5), marginTop: verticalScale(2) },
  dots: { flexDirection: 'row', gap: scale(5), paddingBottom: verticalScale(4) },
  dot: { width: scale(8), height: scale(8), borderRadius: scale(4) },
  previewFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginTop: verticalScale(8),
    paddingHorizontal: scale(4),
  },
  previewFootText: { fontFamily: fonts.body, fontSize: fontSize(9.5), flex: 1 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(12),
    marginTop: verticalScale(12),
  },
  nextBtn: { flex: 1, maxWidth: scale(340) },
});

export default PhotoSelectionScreen;
