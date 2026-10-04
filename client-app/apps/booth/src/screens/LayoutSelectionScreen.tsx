import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
} from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

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
import type { RootStackParamList } from '../../App';
import Svg, { Rect, Path } from 'react-native-svg';
import { InactivityToast } from '../components/InactivityToast';

type Props = NativeStackScreenProps<RootStackParamList, 'LayoutSelection'>;

const TimerPill = ({
  timeLeft,
}: {
  timeLeft: number;
}) => {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.timerPill, { backgroundColor: theme.colors.error + '20', marginRight: scale(10) }]}>
      <Text style={[styles.timerText, { color: theme.colors.error }]}>{timeLeft}s</Text>
    </View>
  );
};

export const LayoutSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const { state } = useBooth();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  
  const event = state.context.activeEvent;
  const initialTime = event?.boothTimeout || 30;
  const [timeLeft, setTimeLeft] = useState(initialTime);

  const expiredRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  const handleTimeout = useCallback(() => {
    navigation.replace('Start');
  }, [navigation]);

  useEffect(() => {
    const id = setInterval(() => {
      const remaining = initialTime - Math.floor((Date.now() - startedAtRef.current) / 1000);
      setTimeLeft(Math.max(0, remaining));

      if (remaining <= 0) {
        clearInterval(id);
        if (!expiredRef.current) {
          expiredRef.current = true;
          handleTimeout();
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [handleTimeout, initialTime]);

  const [selectedLayout, setSelectedLayout] = useState<'vertical' | 'horizontal' | null>(null);

  useEffect(() => {
    SoundManager.init();
  }, []);

  const handleSelect = (layout: 'vertical' | 'horizontal') => {
    SoundManager.haptic(15);
    SoundManager.play('click');
    setSelectedLayout(layout);
  };

  const handleNext = () => {
    if (!selectedLayout) return;
    SoundManager.haptic(20);
    SoundManager.play('click');

    // Move to SlotSelection, passing the chosen layout
    navigation.replace('SlotSelection', { layout: selectedLayout });
  };

  const LayoutOption = ({ type, label, subLabel }: { type: 'vertical' | 'horizontal'; label: string; subLabel: string }) => {
    const isSelected = selectedLayout === type;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 1.05 : 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }).start();
    }, [isSelected, scaleAnim]);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => handleSelect(type)}
        style={[styles.optionContainer, isLandscape && styles.optionContainerLandscape]}
      >
        <Animated.View style={[
          styles.card,
          { backgroundColor: theme.colors.surfaceSecondary, transform: [{ scale: scaleAnim }] },
          isSelected && { borderColor: theme.colors.primary, borderWidth: 3 }
        ]}>
          <View style={styles.iconContainer}>
            {type === 'vertical' ? (
              <Svg width={scale(60)} height={scale(80)} viewBox="0 0 60 80">
                <Rect x="10" y="5" width="40" height="70" rx="4" fill={theme.colors.text} opacity={isSelected ? 1 : 0.7} />
                <Rect x="15" y="10" width="30" height="40" rx="2" fill={theme.colors.background} />
                <Rect x="15" y="55" width="30" height="15" rx="2" fill={theme.colors.background} />
              </Svg>
            ) : (
              <Svg width={scale(80)} height={scale(60)} viewBox="0 0 80 60">
                <Rect x="5" y="10" width="70" height="40" rx="4" fill={theme.colors.text} opacity={isSelected ? 1 : 0.7} />
                <Rect x="10" y="15" width="40" height="30" rx="2" fill={theme.colors.background} />
                <Rect x="55" y="15" width="15" height="30" rx="2" fill={theme.colors.background} />
              </Svg>
            )}
          </View>
          {isSelected && (
            <View style={[styles.selectedCheck, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.checkText}>✓</Text>
            </View>
          )}
        </Animated.View>
        <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{label}</Text>
        <Text style={[styles.optionSubLabel, { color: theme.colors.textSecondary }]}>{subLabel}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <LayoutContainer
        scrollable={false}
        contentContainerStyle={Object.assign(
          {},
          styles.layout,
          isLandscape ? styles.layoutLandscape : styles.layoutPortrait
        )}
      >
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>CHOOSE LAYOUT</Text>
            <View style={styles.headerRightContainer}>
              <TimerPill timeLeft={timeLeft} />
            </View>
          </View>

        {/* CONTENT */}
        <View style={[styles.contentArea, isLandscape && styles.contentAreaLandscape]}>
          <LayoutOption type="vertical" label="VERTICAL" subLabel="CLASSIC STRIPS & PORTRAITS" />
          <LayoutOption type="horizontal" label="HORIZONTAL" subLabel="WIDESCREEN & GRIDS" />
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <View style={styles.footerSideLeft}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: theme.colors.surfaceSecondary }]}
              onPress={() => navigation.replace('Start')}
            >
              <Text style={[styles.backBtnText, { color: theme.colors.text }]}>BACK</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerSideRight}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleNext}
              disabled={!selectedLayout}
              style={[
                styles.nextBtn,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: selectedLayout ? 1 : 0,
                },
              ]}
            >
              <Text style={styles.nextText}>NEXT</Text>
              <Text style={styles.nextArrow}>→</Text>
            </TouchableOpacity>
          </View>
        </View>
        <InactivityToast visible={timeLeft <= 10} />
      </LayoutContainer>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  layout: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: scale(32),
  },
  layoutLandscape: {
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(16),
  },
  layoutPortrait: {
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(24),
    paddingHorizontal: scale(16),
  },
  header: {
    minHeight: verticalScale(48),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 'scale(200)',
  },
  headerRightContainer: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: fontSize(20),
    fontWeight: '900',
    letterSpacing: 2,
  },
  timerPill: {
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(20),
  },
  timerText: {
    fontSize: fontSize(14),
    fontWeight: '900',
  },
  contentArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(30),
  },
  contentAreaLandscape: {
    gap: scale(60),
  },
  optionContainer: {
    alignItems: 'center',
  },
  optionContainerLandscape: {
    marginHorizontal: scale(10),
  },
  card: {
    width: scale(160),
    height: scale(220),
    borderRadius: moderateScale(16),
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheck: {
    position: 'absolute',
    top: scale(-10),
    right: scale(-10),
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: fontSize(16),
    fontWeight: '900',
  },
  optionLabel: {
    marginTop: verticalScale(20),
    fontSize: fontSize(20),
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  optionSubLabel: {
    marginTop: verticalScale(4),
    fontSize: fontSize(12),
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  footer: {
    minHeight: verticalScale(60),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerSideLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  footerSideRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  backBtn: {
    paddingVertical: moderateScale(14),
    paddingHorizontal: scale(24),
    borderRadius: moderateScale(25),
  },
  backBtnText: {
    fontSize: fontSize(14),
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(14),
    paddingHorizontal: scale(24),
    borderRadius: moderateScale(25),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  nextText: {
    color: '#ffffff',
    fontSize: fontSize(14),
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  nextArrow: {
    color: '#ffffff',
    fontSize: fontSize(14),
    fontWeight: '900',
    marginLeft: scale(8),
  },
});
