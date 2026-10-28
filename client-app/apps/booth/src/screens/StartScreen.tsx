import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Icon,
  fonts,
  fontSize,
  moderateScale,
  radii,
  scale,
  shadows,
  useAppTheme,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { AppShell } from '../components/AppShell';
import { useBooth, freshSession } from '../context/BoothProvider';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

/**
 * Idle attract screen — Electron's `StartScreen` (`.start-screen`,
 * `.start-touch`, `.start-art`, `.touch-prompt`).
 *
 * The whole surface is one big touch target: a guest should never have to find
 * a button. The three polaroids fan out behind a heart seal, then the event
 * name and copy of "Touch anywhere to begin" sit underneath.
 *
 * The old tablet version was a neon-dark hero with SVG glow orbs and stock
 * photos. Those are gone: Electron is the reference, and its art is drawn with
 * CSS shapes, which is why this file has no image assets left.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'Start'>;

const ART_TINTS = ['#f7c9dd', '#dcd0f6', '#fde3c9'];

export const StartScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const p = theme.palette;
  const { snapshot, setSession, secondsLeft, resetIdleTimer } = useBooth();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const float = useRef(new Animated.Value(0)).current;
  const [pressed, setPressed] = useState(false);

  const event = snapshot?.event;
  const orgName =
    snapshot?.settings?.organizationName || snapshot?.organization?.name || 'HappyPix';

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const handleStart = () => {
    SoundManager.play('click');
    resetIdleTimer();
    setSession(freshSession());
    navigation.navigate('Orientation');
  };

  const lift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const tiltA = float.interpolate({ inputRange: [0, 1], outputRange: ['-11deg', '-8deg'] });
  const tiltB = float.interpolate({ inputRange: [0, 1], outputRange: ['9deg', '12deg'] });

  return (
    <AppShell step="start" bleed testID="start-screen">
      <Pressable
        style={styles.touch}
        onPress={handleStart}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={`Start a photo session for ${event?.name || 'this event'}`}
      >
        <View style={[styles.body, isLandscape ? styles.bodyRow : styles.bodyCol]}>
          {/* fan of prints */}
          <Animated.View style={[styles.art, { transform: [{ translateY: lift }] }]} pointerEvents="none">
            <Animated.View
              style={[
                styles.frame,
                styles.frameLeft,
                { backgroundColor: ART_TINTS[0], transform: [{ rotate: tiltA }] },
              ]}
            >
              <View style={[styles.frameInner, { backgroundColor: '#fff' }]} />
            </Animated.View>
            <Animated.View
              style={[
                styles.frame,
                styles.frameRight,
                { backgroundColor: ART_TINTS[1], transform: [{ rotate: tiltB }] },
              ]}
            >
              <View style={[styles.frameInner, { backgroundColor: '#fff' }]} />
            </Animated.View>
            <View style={[styles.frame, styles.frameCenter, { backgroundColor: ART_TINTS[2] }]}>
              <View style={[styles.frameInner, { backgroundColor: '#fff' }]} />
              <View style={[styles.seal, { backgroundColor: p.pink, shadowColor: p.pink }]}>
                <Icon name="heart" size={scale(34)} color="#ffffff" strokeWidth={2} />
              </View>
            </View>
          </Animated.View>

          {/* event copy */}
          <View style={[styles.copy, isLandscape ? styles.copyLeft : styles.copyCenter]}>
            <Text style={[styles.eyebrow, { color: p.pinkDeep }]}>WELCOME TO</Text>
            <Text
              style={[styles.eventName, { color: p.ink }, isLandscape ? styles.textLeft : null]}
              numberOfLines={2}
            >
              {event?.name || 'The HappyPix Experience'}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
                {orgName}
              </Text>
              <View style={[styles.metaDot, { backgroundColor: p.faint }]} />
              <Text style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
                {event?.location || 'On-site studio'}
              </Text>
            </View>
            {event?.branding?.tagline ? (
              <Text style={[styles.quote, { color: p.violet }]}>“{event.branding.tagline}”</Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.prompt, { backgroundColor: pressed ? p.pinkDeep : p.pink }]}>
          <Text style={styles.promptText}>Touch anywhere to begin</Text>
          <Icon name="arrow-right" size={fontSize(20)} color="#ffffff" />
        </View>

        {secondsLeft !== undefined && secondsLeft > 0 ? (
          <Text style={[styles.idle, { color: p.faint }]}>
            Screen returns to this welcome in {secondsLeft}s
          </Text>
        ) : null}
      </Pressable>
    </AppShell>
  );
};

const styles = StyleSheet.create({
  touch: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(20) },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: scale(1120) },
  bodyRow: { flexDirection: 'row', gap: scale(48) },
  bodyCol: { flexDirection: 'column', gap: verticalScale(28) },

  art: { width: scale(300), height: scale(286), alignItems: 'center', justifyContent: 'center' },
  frame: {
    position: 'absolute',
    width: scale(150),
    height: scale(200),
    borderRadius: moderateScale(14),
    padding: scale(9),
    ...shadows.soft,
  },
  frameInner: { flex: 1, borderRadius: moderateScale(9) },
  frameLeft: { left: scale(6), top: scale(48) },
  frameRight: { right: scale(6), top: scale(36) },
  frameCenter: { width: scale(168), height: scale(222), padding: scale(10), ...shadows.card },
  seal: {
    position: 'absolute',
    right: -scale(16),
    bottom: -scale(14),
    width: scale(70),
    height: scale(70),
    borderRadius: scale(35),
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.32,
    shadowRadius: scale(18),
    shadowOffset: { width: 0, height: verticalScale(10) },
    elevation: 8,
  },

  copy: { maxWidth: scale(560) },
  copyLeft: { alignItems: 'flex-start' },
  copyCenter: { alignItems: 'center' },
  eyebrow: { fontFamily: fonts.bodyBlack, fontSize: fontSize(11), letterSpacing: 1.9 },
  textLeft: { textAlign: 'left' },
  eventName: {
    fontFamily: fonts.display,
    fontSize: fontSize(52),
    lineHeight: Math.round(fontSize(52) * 1.02),
    letterSpacing: -1.4,
    marginTop: verticalScale(10),
    textAlign: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: scale(9), marginTop: verticalScale(12) },
  meta: { fontFamily: fonts.bodyBold, fontSize: fontSize(13) },
  metaDot: { width: scale(4), height: scale(4), borderRadius: scale(2) },
  quote: {
    fontFamily: fonts.displayLight,
    fontSize: fontSize(17),
    lineHeight: Math.round(fontSize(17) * 1.45),
    marginTop: verticalScale(14),
    textAlign: 'center',
  },

  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    height: verticalScale(56),
    paddingHorizontal: scale(28),
    borderRadius: radii.pill,
    marginTop: verticalScale(18),
    marginBottom: verticalScale(6),
    shadowColor: '#d83585',
    shadowOpacity: 0.28,
    shadowRadius: scale(18),
    shadowOffset: { width: 0, height: verticalScale(10) },
    elevation: 6,
  },
  promptText: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(16), color: '#ffffff', letterSpacing: 0.2 },
  idle: { fontFamily: fonts.body, fontSize: fontSize(10), marginBottom: verticalScale(14) },
});

export default StartScreen;
