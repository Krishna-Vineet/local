import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Orientation } from '@happypix/types';
import {
  Button,
  Icon,
  fonts,
  fontSize,
  moderateScale,
  scale,
  shadows,
  useAppTheme,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { AppShell } from '../components/AppShell';
import { InactivityToast } from '../components/InactivityToast';
import { useBooth } from '../context/BoothProvider';
import { goBackOr } from '../utils/navigation';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

/**
 * Orientation step — Electron's `OrientationScreen` (`.orientation-grid`,
 * `.orientation-card`, `.paper-shape`). Two big cards, each showing a paper
 * mock of the finished print; the selection is a pink outline plus a check.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'Orientation'>;

const OPTIONS: {
  value: Orientation;
  title: string;
  blurb: string;
  slots: number;
}[] = [
  { value: 'portrait', title: 'Vertical', blurb: 'Portraits, reels & classic strips', slots: 3 },
  { value: 'landscape', title: 'Horizontal', blurb: 'Wide moments, groups & grids', slots: 2 },
];

export const LayoutSelectionScreen: React.FC<Props> = ({ navigation }) => {
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
  const selected = session.orientation;

  useEffect(() => {
    setIdleTimerEnabled(true);
    resetIdleTimer();
    return () => setIdleTimerEnabled(false);
  }, [setIdleTimerEnabled, resetIdleTimer]);

  useEffect(() => {
    if (secondsLeft === 0 && isFocused) resetGuestSession(navigation);
  }, [secondsLeft, isFocused, navigation, resetGuestSession]);

  const select = (orientation: Orientation) => {
    SoundManager.play('select');
    resetIdleTimer();
    updateSession({ orientation, template: null });
  };

  const next = () => {
    if (!selected) return;
    SoundManager.play('click');
    navigation.navigate('Templates');
  };

  const back = () => {
    SoundManager.play('click');
    goBackOr(navigation, 'Start');
  };

  return (
    <AppShell
      step="templates"
      title="How should your print look?"
      subtitle="Choose the direction that fits your moment best."
      secondsLeft={secondsLeft}
      testID="orientation-screen"
    >
      <View style={[styles.grid, isLandscape ? styles.gridRow : styles.gridCol]}>
        {OPTIONS.map((option) => {
          const active = selected === option.value;
          const portrait = option.value === 'portrait';
          return (
            <Pressable
              key={option.value}
              onPress={() => select(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.card,
                {
                  borderColor: active ? '#f0a6c8' : p.line,
                  backgroundColor: active ? p.pinkSoft : p.surface,
                },
                active ? styles.cardActive : null,
              ]}
            >
              <View style={styles.paperStage}>
                <View
                  style={[
                    styles.paper,
                    portrait ? styles.paperPortrait : styles.paperLandscape,
                    { borderColor: active ? '#f3bcd5' : p.line },
                  ]}
                >
                  {Array.from({ length: option.slots }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.paperSlot,
                        { backgroundColor: active ? '#fbd7e7' : p.surfaceMuted },
                      ]}
                    />
                  ))}
                  <Text style={[styles.paperBrand, { color: active ? p.pinkDeep : p.faint }]}>
                    HAPPYPIX
                  </Text>
                </View>
              </View>

              <View style={styles.cardCopy}>
                <Text style={[styles.cardTitle, { color: p.ink }]}>{option.title}</Text>
                <Text style={[styles.cardBlurb, { color: p.muted }]}>{option.blurb}</Text>
              </View>

              <View
                style={[
                  styles.check,
                  {
                    borderColor: active ? p.pink : p.line,
                    backgroundColor: active ? p.pink : 'transparent',
                  },
                ]}
              >
                {active ? <Icon name="check" size={fontSize(15)} color="#ffffff" strokeWidth={2.4} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button label="Back" variant="secondary" icon="arrow-left" onPress={back} />
        <Button
          label="See templates"
          iconRight="arrow-right"
          onPress={next}
          disabled={!selected}
          style={styles.nextBtn}
          testID="orientation-next"
        />
      </View>

      <InactivityToast />
    </AppShell>
  );
};

const styles = StyleSheet.create({
  grid: { width: '100%', maxWidth: scale(1040), alignSelf: 'center', gap: scale(16) },
  gridRow: { flexDirection: 'row' },
  gridCol: { flexDirection: 'column' },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
    minHeight: verticalScale(180),
    padding: scale(20),
    borderRadius: scale(24),
    borderWidth: 1.5,
    ...shadows.soft,
  },
  cardActive: { borderWidth: 2 },
  paperStage: { width: scale(120), height: scale(140), alignItems: 'center', justifyContent: 'center' },
  paper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    padding: scale(8),
    borderWidth: 1,
    borderRadius: moderateScale(9),
    backgroundColor: '#ffffff',
    ...shadows.soft,
  },
  paperPortrait: { width: scale(82), height: scale(126) },
  paperLandscape: { width: scale(124), height: scale(96) },
  paperSlot: { width: '100%', flex: 1, borderRadius: moderateScale(4) },
  paperBrand: { fontFamily: fonts.bodyBlack, fontSize: fontSize(6), letterSpacing: 0.8 },
  cardCopy: { flex: 1 },
  cardTitle: { fontFamily: fonts.display, fontSize: fontSize(24), letterSpacing: -0.4 },
  cardBlurb: { fontFamily: fonts.body, fontSize: fontSize(12.5), lineHeight: fontSize(18), marginTop: verticalScale(4) },
  check: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(12),
    width: '100%',
    maxWidth: scale(1040),
    alignSelf: 'center',
    marginTop: verticalScale(18),
  },
  nextBtn: { flex: 1, maxWidth: scale(320) },
});

export default LayoutSelectionScreen;
