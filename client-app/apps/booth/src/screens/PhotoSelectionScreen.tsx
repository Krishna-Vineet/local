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
  const slots = template?.layout.slots ?? 1;
  const photos = session.photos || [];

  const [selected, setSelected] = useState<CapturedPhoto[]>(() => {
    if (session.selectedPhotos && session.selectedPhotos.length > 0) {
      return session.selectedPhotos.slice(0, slots);
    }
    return photos.slice(0, slots);
  });

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

  const togglePhoto = (photo: CapturedPhoto) => {
    SoundManager.play('click');
    const existingIndex = selected.findIndex((item) => item.id === photo.id);

    if (existingIndex >= 0) {
      setSelected(selected.filter((item) => item.id !== photo.id));
      return;
    }

    if (selected.length < slots) {
      setSelected([...selected, photo]);
    } else {
      // Rotate out oldest
      setSelected([...selected.slice(1), photo]);
    }
  };

  const clearSlot = (index: number) => {
    SoundManager.play('click');
    setSelected(selected.filter((_, idx) => idx !== index));
  };

  const handleNext = () => {
    if (selected.length !== slots) return;
    SoundManager.play('click');
    updateSession({ selectedPhotos: selected });
    navigation.navigate('Customize');
  };

  const handleRetake = () => {
    SoundManager.play('click');
    navigation.goBack();
  };

  return (
    <ScreenContainer>
      <LayoutContainer>
        <View style={styles.header}>
          <Text style={styles.title}>Choose your best shots</Text>
          <Text style={styles.subtitle}>
            Pick {slots} photo{slots === 1 ? '' : 's'} for {template.name}. Tap a filled frame to swap.
          </Text>
        </View>

        <View style={[styles.mainLayout, isLandscape ? styles.rowLayout : styles.colLayout]}>
          {/* Negative Gallery Strip */}
          <View style={[styles.galleryPanel, isLandscape ? styles.galleryVertical : styles.galleryHorizontal]}>
            <View style={styles.stripHeader}>
              <Text style={styles.stripLabel}>KODAK PORTRA</Text>
              <Text style={styles.stripCount}>{photos.length} SHOTS</Text>
            </View>

            <ScrollView
              horizontal={!isLandscape}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.galleryScroll}
            >
              {photos.map((photo, i) => {
                const selectedIndex = selected.findIndex((item) => item.id === photo.id);
                const isSelected = selectedIndex >= 0;

                return (
                  <TouchableOpacity
                    key={photo.id || i}
                    style={[styles.negativeItem, isSelected && styles.negativeItemSelected]}
                    onPress={() => togglePhoto(photo)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.expNum}>
                      {String(i + 1).padStart(2, '0')}
                    </Text>
                    <Image source={{ uri: photo.uri }} style={styles.negativeImg} />
                    {isSelected && (
                      <View style={styles.badgeIndex}>
                        <Text style={styles.badgeIndexText}>{selectedIndex + 1}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Live Preview Canvas Stage */}
          <View style={styles.previewStage}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewKicker}>LIVE PREVIEW</Text>
              <Text style={styles.previewCounter}>
                {selected.length} of {slots} selected
              </Text>
            </View>

            <View style={styles.canvasContainer}>
              <TemplateCanvas
                template={template}
                photos={selected}
                interactiveSlot={clearSlot}
                style={{ width: scale(230), height: verticalScale(310) }}
              />
            </View>
            <Text style={styles.tapClearHint}>💡 Tap a photo slot in the frame to remove it.</Text>
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
              selected.length !== slots && styles.nextBtnDisabled,
            ]}
            disabled={selected.length !== slots}
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
  header: {
    alignItems: 'center',
    paddingTop: verticalScale(14),
    marginBottom: verticalScale(14),
  },
  title: {
    color: '#ffffff',
    fontSize: fontSize(24),
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: fontSize(13),
    textAlign: 'center',
  },
  mainLayout: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  colLayout: {
    flexDirection: 'column',
    justifyContent: 'space-evenly',
  },
  galleryPanel: {
    backgroundColor: '#09090c',
    borderRadius: moderateScale(20),
    borderWidth: 1.5,
    borderColor: '#22222a',
    padding: scale(12),
    margin: scale(8),
  },
  galleryVertical: {
    width: scale(140),
    height: '100%',
  },
  galleryHorizontal: {
    width: '100%',
    height: verticalScale(120),
  },
  stripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  stripLabel: {
    color: '#71717a',
    fontSize: fontSize(9),
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  stripCount: {
    color: '#8b5cf6',
    fontSize: fontSize(9),
    fontWeight: '800',
  },
  galleryScroll: {
    alignItems: 'center',
  },
  negativeItem: {
    position: 'relative',
    margin: scale(5),
    padding: 3,
    backgroundColor: '#18181f',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#27272a',
    alignItems: 'center',
  },
  negativeItemSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  expNum: {
    color: '#71717a',
    fontSize: fontSize(8),
    fontWeight: '700',
    marginBottom: 2,
  },
  negativeImg: {
    width: scale(90),
    height: scale(65),
    borderRadius: 5,
  },
  badgeIndex: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  badgeIndexText: {
    color: '#ffffff',
    fontSize: fontSize(11),
    fontWeight: '900',
  },
  previewStage: {
    backgroundColor: '#121217',
    borderRadius: moderateScale(22),
    borderWidth: 1.5,
    borderColor: '#22222a',
    padding: scale(16),
    alignItems: 'center',
    margin: scale(8),
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 6,
    marginBottom: verticalScale(10),
  },
  previewKicker: {
    color: '#8b5cf6',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 2,
  },
  previewCounter: {
    color: '#ffffff',
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  canvasContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapClearHint: {
    color: '#71717a',
    fontSize: fontSize(11),
    marginTop: verticalScale(10),
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
    backgroundColor: '#1c1c24',
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
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '700',
  },
});
