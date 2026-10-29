import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Icon,
  fonts,
  fontSize,
  moderateScale,
  radii,
  scale,
  useAppTheme,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { useBooth } from '../context/BoothProvider';
import { AppLogo } from '../components/AppLogo';
import type { RootStackParamList } from '../../App';

/**
 * Standby — Electron's `StandbyScreen` (`ConnectionScreens.tsx`): a dark splash
 * with the brand mark, a slow orbit, the "Booth Standing By" headline and a
 * translucent hardware card. It is the one screen that deliberately stays dark
 * in a light product, because a kiosk idling in a dim venue reads better that way.
 *
 * Behaviour is unchanged from the previous tablet screen: it re-checks the event
 * every 20 s and jumps straight into the flow the moment an event goes live.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'Waiting'>;

const WAITING_LINES = [
  'Polishing the pixels while we wait…',
  'A great photo is only one event away.',
  'Camera-ready. Confetti-ready. Guest-ready.',
];

export const WaitingScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const p = theme.palette;
  const insets = useSafeAreaInsets();
  const { snapshot, refreshEvent, logout } = useBooth();
  const [refreshing, setRefreshing] = useState(false);
  const [line, setLine] = useState(0);

  const spin = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rotate = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotate.start();
    return () => rotate.stop();
  }, [spin]);

  useEffect(() => {
    const tick = setInterval(() => setLine((n) => (n + 1) % WAITING_LINES.length), 4500);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const poll = setInterval(() => void refreshEvent(), 20000);
    return () => clearInterval(poll);
  }, [refreshEvent]);

  useEffect(() => {
    if (snapshot?.event?.status === 'live') navigation.replace('Start');
  }, [snapshot?.event?.status, navigation]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshEvent();
    } finally {
      setRefreshing(false);
    }
  };

  const orbit = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const hardware = [
    { label: 'Camera system', value: 'Ready', tone: p.green },
    { label: 'Photo printer', value: 'Online', tone: p.green },
    { label: 'Cloud network', value: refreshing ? 'Checking…' : 'Connected', tone: refreshing ? p.amber : p.green },
  ];

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: p.night, paddingBottom: Math.max(insets.bottom, verticalScale(20)) },
      ]}
    >
      {/* ambient glow — Electron's `.ambient` blobs */}
      <View pointerEvents="none" style={[styles.glow, styles.glowA, { backgroundColor: p.pink }]} />
      <View pointerEvents="none" style={[styles.glow, styles.glowB, { backgroundColor: p.violet }]} />

      <View style={styles.brand}>
        <AppLogo width={scale(120)} height={scale(104)} forceDark />
      </View>

      <Animated.View style={[styles.orbit, { transform: [{ rotate: orbit }] }]} pointerEvents="none">
        <View style={[styles.orbitRing, { borderColor: 'rgba(255,255,255,0.10)' }]} />
        <View style={[styles.orbitDot, { backgroundColor: p.pink }]} />
        <View style={[styles.orbitDotSmall, { backgroundColor: p.violet }]} />
      </Animated.View>

      <Text style={styles.eyebrow}>ENTERPRISE PHOTO KIOSK</Text>
      <Text style={styles.title}>Booth Standing By</Text>
      <Text style={styles.body}>
        {snapshot?.event?.name
          ? `“${snapshot.event.name}” is not live yet. ${WAITING_LINES[line]}`
          : `Hardware calibrated. Connecting securely to the HappyPix Cloud Network… ${WAITING_LINES[line]}`}
      </Text>

      <View style={styles.hardware}>
        {hardware.map((row) => (
          <View key={row.label} style={styles.hardwareRow}>
            <Text style={styles.hardwareLabel}>{row.label}</Text>
            <Text style={[styles.hardwareValue, { color: row.tone }]}>● {row.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={refresh}
          disabled={refreshing}
          style={[styles.primary, { backgroundColor: p.pink }, refreshing ? styles.disabled : null]}
          accessibilityRole="button"
        >
          {refreshing ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <Icon name="refresh" size={fontSize(18)} color="#ffffff" />
              <Text style={styles.primaryText}>Reconnect booth</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={() => logout()}
          style={styles.secondary}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Pair a different booth</Text>
        </Pressable>
      </View>

      <Text style={styles.footnote}>
        {snapshot?.device?.name ? `${snapshot.device.name} · ` : ''}checks automatically every 20 seconds
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(24) },
  glow: { position: 'absolute', width: scale(520), height: scale(520), borderRadius: scale(260), opacity: 0.16 },
  glowA: { top: -scale(220), left: -scale(140) },
  glowB: { bottom: -scale(260), right: -scale(160) },

  brand: { marginBottom: verticalScale(10) },
  orbit: {
    width: scale(84),
    height: scale(84),
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: verticalScale(14),
  },
  orbitRing: { position: 'absolute', width: '100%', height: '100%', borderRadius: scale(42), borderWidth: 1.5 },
  orbitDot: { position: 'absolute', top: 0, width: scale(10), height: scale(10), borderRadius: scale(5) },
  orbitDotSmall: { position: 'absolute', bottom: scale(6), width: scale(4), height: scale(4), borderRadius: scale(2), opacity: 0.8 },

  eyebrow: { fontFamily: fonts.bodyBlack, fontSize: fontSize(11), letterSpacing: 1.9, color: '#ff6aa8' },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize(38),
    lineHeight: Math.round(fontSize(38) * 1.05),
    letterSpacing: -0.8,
    color: '#ffffff',
    marginTop: verticalScale(10),
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize(13.5),
    lineHeight: fontSize(20),
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    maxWidth: scale(520),
    marginTop: verticalScale(10),
  },

  hardware: {
    width: '100%',
    maxWidth: scale(400),
    gap: verticalScale(11),
    marginTop: verticalScale(24),
    marginBottom: verticalScale(22),
    padding: scale(16),
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  hardwareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hardwareLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSize(12.5), color: 'rgba(255,255,255,0.9)' },
  hardwareValue: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(12) },

  actions: { flexDirection: 'row', alignItems: 'center', gap: scale(12), flexWrap: 'wrap', justifyContent: 'center' },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(9),
    height: verticalScale(52),
    paddingHorizontal: scale(24),
    borderRadius: radii.lg,
  },
  primaryText: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(14), color: '#ffffff' },
  disabled: { opacity: 0.7 },
  secondary: {
    height: verticalScale(52),
    paddingHorizontal: scale(20),
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontFamily: fonts.bodyMedium, fontSize: fontSize(13), color: 'rgba(255,255,255,0.86)' },

  footnote: { fontFamily: fonts.body, fontSize: fontSize(10), color: 'rgba(255,255,255,0.4)', marginTop: verticalScale(16) },
});

export default WaitingScreen;
