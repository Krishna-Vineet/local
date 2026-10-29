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

const clampGap = scale(26);

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
      <View style={styles.body}>
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
                  borderColor: active ? p.pink : 'transparent',
                  backgroundColor: 'rgba(255,255,255,0.82)',
                },
                active ? styles.cardActive : null,
              ]}
            >
              <View style={styles.paperStage}>
                <View
                  style={[
                    styles.paper,
                    portrait ? styles.paperPortrait : styles.paperLandscape,
                    portrait ? styles.paperTiltLeft : styles.paperTiltRight,
                  ]}
                >
                  <View style={[styles.paperSlots, portrait ? styles.paperSlotsCol : styles.paperSlotsRow]}>
                    {Array.from({ length: option.slots }).map((_, i) => (
                      <View key={i} style={styles.paperSlot} />
                    ))}
                  </View>
                  <Text style={styles.paperBrand}>HAPPYPIX</Text>
                </View>
              </View>

              <View style={styles.cardCopy}>
                <Text style={[styles.cardTitle, { color: p.ink }]}>{option.title}</Text>
                <Text style={[styles.cardBlurb, { color: p.muted }]}>{option.blurb}</Text>
              </View>

              <View
                pointerEvents="none"
                style={[
                  styles.check,
                  {
                    borderColor: active ? p.pink : '#dcd0e2',
                    backgroundColor: active ? p.pink : p.white,
                  },
                ]}
              >
                {active ? <Icon name="check" size={scale(17)} color="#ffffff" strokeWidth={2.6} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

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

      <InactivityToast secondsLeft={secondsLeft} onStayActive={resetIdleTimer} />
    </AppShell>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', width: '100%' },
  // `.orientation-grid { width: min(100%,1050px); grid-template-columns: 1fr 1fr }`
  grid: { width: '100%', maxWidth: scale(1050), alignSelf: 'center', gap: scale(30) },
  gridRow: { flexDirection: 'row', alignItems: 'stretch' },
  gridCol: { flexDirection: 'column' },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(27),
    minHeight: verticalScale(300),
    // `.orientation-card`: padding clamp(20px, 3vw, 42px), grid 1fr 1.05fr
    paddingHorizontal: scale(34),
    paddingVertical: verticalScale(26),
    borderRadius: moderateScale(28),
    borderWidth: 2,
    ...shadows.soft,
  },
  cardActive: {
    shadowColor: '#d83687',
    shadowOpacity: 0.16,
    shadowRadius: scale(26),
    shadowOffset: { width: 0, height: verticalScale(12) },
    elevation: 6,
  },

  /* Electron `.paper-shape`: 6px white mount, mauve mat, 11px padding, ±3°. */
  paperStage: { width: scale(210), height: scale(200), alignItems: 'center', justifyContent: 'center' },
  paper: {
    padding: scale(11),
    borderWidth: scale(6),
    borderColor: '#ffffff',
    backgroundColor: '#e7dbe9',
    justifyContent: 'space-between',
  },
  paperTiltLeft: { transform: [{ rotate: '-3deg' }] },
  paperTiltRight: { transform: [{ rotate: '3deg' }] },
  // `--portrait { width:130; height:200; rows 1fr 1fr 22px }`
  paperPortrait: { width: scale(130), height: scale(200) },
  // `--landscape { width:210; height:140; cols 1fr 1fr; rows 1fr 18px }`
  paperLandscape: { width: scale(210), height: scale(140) },
  paperSlots: { flex: 1, gap: scale(7) },
  paperSlotsCol: { flexDirection: 'column' },
  paperSlotsRow: { flexDirection: 'row' },
  // `.paper-shape span { background: linear-gradient(145deg,#6b3e76,#e77ca9) }`
  paperSlot: { flex: 1, borderRadius: moderateScale(3), backgroundColor: '#a9738f' },
  paperBrand: {
    fontFamily: fonts.bodyBlack,
    fontSize: fontSize(7),
    letterSpacing: 1.05,
    color: '#8a718f',
    textAlign: 'center',
    marginTop: verticalScale(6),
  },
  cardCopy: { flex: 1 },
  cardTitle: { fontFamily: fonts.display, fontSize: fontSize(24), letterSpacing: -0.4 },
  cardBlurb: { fontFamily: fonts.body, fontSize: fontSize(12.5), lineHeight: fontSize(18), marginTop: verticalScale(4) },
  // `.select-check { position:absolute; top:18; right:18; width:35; height:35; border:2px }`
  check: {
    position: 'absolute',
    top: verticalScale(16),
    right: scale(16),
    width: scale(35),
    height: scale(35),
    borderRadius: scale(18),
    borderWidth: 2,
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
