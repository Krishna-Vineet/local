import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Orientation } from '@happypix/types';
import {
  ScreenContainer,
  LayoutContainer,
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

type Props = NativeStackScreenProps<RootStackParamList, 'Orientation'>;

const V_SAMPLE_1 = 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&q=80';
const V_SAMPLE_2 = 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&q=80';
const H_SAMPLE_1 = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80';
const H_SAMPLE_2 = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80';

export const LayoutSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const {
    snapshot,
    session,
    updateSession,
    setIdleTimerEnabled,
    secondsLeft,
    resetIdleTimer,
    resetGuestSession,
  } = useBooth();

  const selected = session.orientation;
  const orgName = snapshot?.settings?.organizationName || snapshot?.organization?.name || 'HappyPix';

  const { width, height } = useWindowDimensions();
  const isLandscape = width > 700;

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

  const selectOrientation = (orientation: Orientation) => {
    SoundManager.play('click');
    updateSession({ orientation, template: null });
  };

  const handleNext = () => {
    if (!selected) return;
    SoundManager.play('click');
    navigation.navigate('Templates');
  };

  const handleBack = () => {
    SoundManager.play('click');
    navigation.goBack();
  };

  return (
    <ScreenContainer style={{ backgroundColor: '#050508' }}>
      <LayoutContainer>
        {/* Prominent Header with Countdown Timer */}
        <ScreenHeader
          title="Choose Your Orientation"
          subtitle="Select vertical strips or widescreen landscape for your final print"
          secondsLeft={secondsLeft}
          step="STEP 1 OF 5"
        />

        {/* Interactive Orientation Selection Cards */}
        <View style={[styles.grid, isLandscape ? styles.gridRow : styles.gridCol]}>
          {/* Vertical / Portrait Option */}
          <TouchableOpacity
            style={[
              styles.card,
              selected === 'portrait' && styles.cardSelected,
            ]}
            onPress={() => selectOrientation('portrait')}
            activeOpacity={0.88}
          >
            <View style={styles.paperWrap}>
              <View style={[styles.paperShape, styles.paperPortrait]}>
                {/* 2 Vibrant Mini Photo Slots */}
                <Image source={{ uri: V_SAMPLE_1 }} style={styles.vMiniPhoto} />
                <Image source={{ uri: V_SAMPLE_2 }} style={styles.vMiniPhoto} />

                {/* Branded Footer */}
                <View style={styles.paperBrandContainer}>
                  <Text style={styles.paperBrandHappy}>HAPPYPIX</Text>
                  <Text style={styles.paperBrandOrg} numberOfLines={1}>
                    {orgName.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Vertical</Text>
              <Text style={styles.cardDesc}>
                Portraits, classic 3-cut photo strips & reels
              </Text>
            </View>

            {selected === 'portrait' && (
              <View style={styles.checkBadge}>
                <Text style={styles.checkText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Horizontal / Landscape Option */}
          <TouchableOpacity
            style={[
              styles.card,
              selected === 'landscape' && styles.cardSelected,
            ]}
            onPress={() => selectOrientation('landscape')}
            activeOpacity={0.88}
          >
            <View style={styles.paperWrap}>
              <View style={[styles.paperShape, styles.paperLandscape]}>
                {/* 2 Side-by-side Mini Photo Slots */}
                <View style={styles.hSlotRow}>
                  <Image source={{ uri: H_SAMPLE_1 }} style={styles.hMiniPhoto} />
                  <Image source={{ uri: H_SAMPLE_2 }} style={styles.hMiniPhoto} />
                </View>

                {/* Branded Footer */}
                <View style={styles.paperBrandContainer}>
                  <Text style={styles.paperBrandHappy}>HAPPYPIX</Text>
                  <Text style={styles.paperBrandOrg} numberOfLines={1}>
                    {orgName.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Horizontal</Text>
              <Text style={styles.cardDesc}>
                Wide moments, group poses & postcard grids
              </Text>
            </View>

            {selected === 'landscape' && (
              <View style={styles.checkBadge}>
                <Text style={styles.checkText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer Actions */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.8}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextBtn, !selected && styles.nextBtnDisabled]}
            disabled={!selected}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>See Templates →</Text>
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
  grid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scale(36),
  },
  gridCol: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: scale(16),
  },
  card: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(24),
    borderWidth: 2,
    borderColor: '#242434',
    paddingVertical: verticalScale(24),
    paddingHorizontal: scale(28),
    width: scale(320),
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  cardSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  paperWrap: {
    height: verticalScale(160),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  paperShape: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paperPortrait: {
    width: scale(85),
    height: verticalScale(145),
  },
  paperLandscape: {
    width: scale(145),
    height: verticalScale(95),
  },
  vMiniPhoto: {
    width: '100%',
    height: '40%',
    borderRadius: 5,
    backgroundColor: '#18181b',
  },
  hSlotRow: {
    flexDirection: 'row',
    width: '100%',
    height: '68%',
    gap: 4,
  },
  hMiniPhoto: {
    flex: 1,
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#18181b',
  },
  paperBrandContainer: {
    alignItems: 'center',
    width: '100%',
    paddingTop: 3,
  },
  paperBrandHappy: {
    fontSize: fontSize(7),
    fontWeight: '900',
    color: '#8b5cf6',
    letterSpacing: 1.5,
  },
  paperBrandOrg: {
    fontSize: fontSize(6),
    fontWeight: '700',
    color: '#3f3f46',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  cardContent: {
    alignItems: 'center',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: fontSize(22),
    fontWeight: '900',
    marginBottom: 4,
  },
  cardDesc: {
    color: '#a1a1aa',
    fontSize: fontSize(13),
    textAlign: 'center',
    lineHeight: 17,
  },
  checkBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  checkText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(16),
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
    paddingHorizontal: scale(32),
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
    letterSpacing: 0.3,
  },
});
