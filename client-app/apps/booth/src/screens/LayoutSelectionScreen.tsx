import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
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
import SoundManager from '../utils/SoundManager';
import { InactivityToast } from '../components/InactivityToast';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Orientation'>;

export const LayoutSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const { session, updateSession, setIdleTimerEnabled, secondsLeft, resetIdleTimer, resetGuestSession } = useBooth();
  const selected = session.orientation;

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

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
    <ScreenContainer>
      <LayoutContainer>
        <View style={styles.header}>
          <Text style={styles.title}>How should your print look?</Text>
          <Text style={styles.subtitle}>Choose the direction that fits your moment best.</Text>
        </View>

        <View style={[styles.grid, isLandscape ? styles.gridRow : styles.gridCol]}>
          {/* Vertical / Portrait Option */}
          <TouchableOpacity
            style={[
              styles.card,
              selected === 'portrait' && styles.cardSelected,
            ]}
            onPress={() => selectOrientation('portrait')}
            activeOpacity={0.85}
          >
            <View style={styles.paperWrap}>
              <View style={[styles.paperShape, styles.paperPortrait]}>
                <View style={styles.slotPlaceholder} />
                <View style={styles.slotPlaceholder} />
                <Text style={styles.paperBrand}>HAPPYPIX</Text>
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Vertical</Text>
              <Text style={styles.cardDesc}>Portraits, reels & classic photo strips</Text>
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
            activeOpacity={0.85}
          >
            <View style={styles.paperWrap}>
              <View style={[styles.paperShape, styles.paperLandscape]}>
                <View style={styles.slotRow}>
                  <View style={[styles.slotPlaceholder, { flex: 1, marginHorizontal: 2 }]} />
                  <View style={[styles.slotPlaceholder, { flex: 1, marginHorizontal: 2 }]} />
                </View>
                <Text style={styles.paperBrand}>HAPPYPIX</Text>
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Horizontal</Text>
              <Text style={styles.cardDesc}>Wide moments, group poses & photo grids</Text>
            </View>

            {selected === 'landscape' && (
              <View style={styles.checkBadge}>
                <Text style={styles.checkText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
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
  header: {
    alignItems: 'center',
    paddingTop: verticalScale(16),
    marginBottom: verticalScale(24),
  },
  title: {
    color: '#ffffff',
    fontSize: fontSize(26),
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: fontSize(14),
    textAlign: 'center',
  },
  grid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  gridCol: {
    flexDirection: 'column',
    justifyContent: 'space-evenly',
  },
  card: {
    backgroundColor: '#121217',
    borderRadius: moderateScale(22),
    borderWidth: 2,
    borderColor: '#27272a',
    padding: scale(24),
    width: scale(300),
    alignItems: 'center',
    margin: scale(12),
    position: 'relative',
  },
  cardSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  paperWrap: {
    height: verticalScale(140),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  paperShape: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paperPortrait: {
    width: scale(75),
    height: verticalScale(115),
  },
  paperLandscape: {
    width: scale(115),
    height: verticalScale(75),
  },
  slotPlaceholder: {
    width: '100%',
    height: '35%',
    backgroundColor: '#27272a',
    borderRadius: 4,
  },
  slotRow: {
    flexDirection: 'row',
    width: '100%',
    height: '60%',
  },
  paperBrand: {
    fontSize: 7,
    fontWeight: '800',
    color: '#71717a',
    letterSpacing: 1.5,
  },
  cardContent: {
    alignItems: 'center',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: fontSize(20),
    fontWeight: '800',
    marginBottom: 4,
  },
  cardDesc: {
    color: '#a1a1aa',
    fontSize: fontSize(12),
    textAlign: 'center',
    lineHeight: 16,
  },
  checkBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(20),
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
    paddingHorizontal: scale(32),
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
