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
  // Electron `.start-art .photo-*` rotations, kept static like the CSS.
  const tiltA = '-7deg';
  const tiltB = '7deg';
  const nudge = float.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });

  return (
    <AppShell step="start" bleed testID="start-screen">
      <Pressable
        style={[styles.touch, isLandscape ? styles.touchRow : styles.touchCol]}
        onPress={handleStart}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={`Start a photo session for ${event?.name || 'this event'}`}
      >
        {/* Electron `.start-art`: three rotated gradient prints, heart seal on
            top of the middle one. Widths are the CSS `min(39vw, 570px)`. */}
        <Animated.View
          style={[styles.art, isLandscape ? null : styles.artPortrait, { transform: [{ translateY: lift }] }]}
          pointerEvents="none"
        >
          <Animated.View
            style={[styles.photo, styles.photoOne, { transform: [{ rotate: tiltA }] }]}
          />
          <Animated.View
            style={[styles.photo, styles.photoTwo, { transform: [{ rotate: tiltB }] }]}
          />
          <View style={[styles.photo, styles.photoThree, { transform: [{ rotate: '-1deg' }] }]}>
            <View style={[styles.seal, { backgroundColor: p.pink, shadowColor: p.pink }]}>
              <Icon name="heart" size={scale(38)} color="#ffffff" strokeWidth={2} />
            </View>
          </View>
        </Animated.View>

        {/* Electron `.start-event` */}
        <View style={[styles.copy, isLandscape ? styles.copyLeft : styles.copyCenter]}>
          <Text style={[styles.eyebrow, { color: p.pinkDeep }]}>WELCOME TO</Text>
          <Text
            style={[styles.eventName, { color: p.ink }, isLandscape ? styles.textLeft : styles.textCenter]}
            numberOfLines={2}
          >
            {event?.name || 'The HappyPix Experience'}
          </Text>
          <View style={[styles.metaRow, isLandscape ? null : styles.metaRowCenter]}>
            <Text style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
              {event?.clientName || orgName}
            </Text>
            <View style={[styles.metaDot, { backgroundColor: p.pink }]} />
            <Text style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
              {event?.location || 'On-site studio'}
            </Text>
          </View>
          {event?.branding?.tagline ? (
            <Text style={[styles.quote, { color: '#9a7293' }]}>“{event.branding.tagline}”</Text>
          ) : null}
        </View>

        {/* Electron `.touch-prompt`: quiet text + pink arrow disc, bottom right,
            nudging. Not a fat CTA pill — the whole screen is the button. */}
        <View
          style={[styles.prompt, isLandscape ? styles.promptRight : styles.promptCenter]}
          pointerEvents="none"
        >
          <Text style={[styles.promptText, { color: pressed ? p.pink : p.pinkDeep }]}>
            Touch anywhere to begin
          </Text>
          <Animated.View
            style={[
              styles.promptArrow,
              { backgroundColor: p.pink, transform: [{ translateX: nudge }] },
            ]}
          >
            <Icon name="arrow-right" size={scale(20)} color="#ffffff" strokeWidth={2.4} />
          </Animated.View>
        </View>
      </Pressable>
    </AppShell>
  );
};

const styles = StyleSheet.create({
  // Electron `.start-touch`: two columns (minmax(330px,.9fr) | minmax(390px,1.1fr)),
  // gap clamp(40px,6vw,100px), padding clamp(28px,4vw,70px), and a pink wash
  // bottom-left. The prompt is positioned, not stacked — nothing is vertically
  // scrolled on this screen.
  touch: { flex: 1, width: '100%', paddingHorizontal: scale(28), paddingVertical: verticalScale(18) },
  touchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(56) },
  touchCol: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: verticalScale(18) },

  // `.start-art { width: min(39vw, 570px); aspect-ratio: .92 }`
  art: { width: Math.min(scale(570), scale(412)), aspectRatio: 0.92, alignSelf: 'center' },
  artPortrait: { width: Math.min(scale(490), scale(420)) },
  photo: { position: 'absolute', borderRadius: scale(3), ...shadows.soft },
  // inset: 3% 30% 29% 3% — rotate(-7deg)
  photoOne: {
    left: '3%',
    right: '30%',
    top: '3%',
    bottom: '29%',
    backgroundColor: '#f4a3bd',
  },
  // inset: 23% 1% 7% 36% — rotate(7deg)
  photoTwo: {
    left: '36%',
    right: '1%',
    top: '23%',
    bottom: '7%',
    backgroundColor: '#ef83ab',
  },
  // inset: 35% 24% 2% 17% — rotate(-1deg)
  photoThree: {
    left: '17%',
    right: '24%',
    top: '35%',
    bottom: '2%',
    backgroundColor: '#e4a1bc',
  },
  // `.start-heart { left:47%; top:42%; width:74px; height:74px }`
  seal: {
    position: 'absolute',
    left: '47%',
    top: '42%',
    width: scale(74),
    height: scale(74),
    borderRadius: scale(37),
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.36,
    shadowRadius: scale(16),
    shadowOffset: { width: 0, height: verticalScale(12) },
    elevation: 8,
  },

  copy: { maxWidth: scale(640) },
  copyLeft: { alignItems: 'flex-start', flexShrink: 1 },
  copyCenter: { alignItems: 'center' },
  eyebrow: { fontFamily: fonts.bodyBlack, fontSize: fontSize(11), letterSpacing: 1.9, marginBottom: verticalScale(15) },
  textLeft: { textAlign: 'left' },
  textCenter: { textAlign: 'center' },
  eventName: {
    fontFamily: fonts.display,
    fontSize: fontSize(52),
    lineHeight: Math.round(fontSize(52) * 0.98),
    letterSpacing: -1.8,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: scale(12), marginTop: verticalScale(21) },
  metaRowCenter: { justifyContent: 'center' },
  meta: { fontFamily: fonts.body, fontSize: fontSize(14) },
  metaDot: { width: scale(5), height: scale(5), borderRadius: scale(3) },
  quote: {
    fontFamily: fonts.displayLight,
    fontSize: fontSize(19),
    lineHeight: Math.round(fontSize(19) * 1.4),
    marginTop: verticalScale(20),
  },

  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(18),
    position: 'absolute',
    bottom: verticalScale(26),
  },
  promptRight: { right: scale(34) },
  promptCenter: { alignSelf: 'center', left: 0, right: 0, justifyContent: 'center' },
  promptText: { fontFamily: fonts.bodyBlack, fontSize: fontSize(14), letterSpacing: 0.2 },
  promptArrow: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default StartScreen;
