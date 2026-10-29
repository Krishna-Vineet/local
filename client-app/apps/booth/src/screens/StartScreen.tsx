import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Icon,
  fonts,
  fontSize,
  scale,
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
 * The layout, the three insets and the rotations are Electron's. What sits
 * inside the frames is not: on the desktop those blocks are flat CSS shapes, and
 * on the tablet they read as three empty boxes on a screen whose whole job is to
 * sell a photograph. They now hold this event's own recent shots
 * (`event.samplePhotos`), and a designed gradient panel with the brand heart when
 * the event has none yet.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'Start'>;

/**
 * A polaroid on the attract screen.
 *
 * Electron draws these as three flat CSS blocks, and on a desktop browser with a
 * real event behind it that reads fine. On the tablet they read as *empty boxes*,
 * which is the one thing a photo booth must never look like. The snapshot already
 * carries `event.samplePhotos` (the backend's `recentSamplePhotos`, up to three
 * recent shots of this very event), so the frame now holds a real photograph.
 * With no photos yet — a brand-new event — it falls back to a designed gradient
 * panel with the brand heart, never to a blank rectangle. Image failures fall
 * back the same way, so a dead S3 URL cannot leave a white hole on the screen.
 */
const Polaroid: React.FC<{
  uri?: string;
  style: object;
  rotate: string;
  gradient: [string, string];
  gradientId: string;
  caption: string;
  seal?: React.ReactNode;
}> = ({ uri, style, rotate, gradient, gradientId, caption, seal }) => {
  const [broken, setBroken] = useState(false);
  const showPhoto = Boolean(uri) && !broken;

  return (
    <View style={[styles.polaroid, style, { transform: [{ rotate }] }]}>
      <View style={styles.polaroidWindow}>
        {showPhoto ? (
          <Image
            source={{ uri: uri as string }}
            style={styles.polaroidImage}
            resizeMode="cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <>
            <Svg width="100%" height="100%" viewBox="0 0 100 120" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor={gradient[0]} />
                  <Stop offset="100%" stopColor={gradient[1]} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100" height="120" fill={`url(#${gradientId})`} />
              <Rect x="0" y="0" width="100" height="120" fill="rgba(255,255,255,0.10)" />
            </Svg>
            <View style={styles.polaroidGlyph} pointerEvents="none">
              <Icon name="heart" size={scale(30)} color="rgba(255,255,255,0.82)" strokeWidth={1.6} />
            </View>
          </>
        )}
      </View>
      <View style={styles.polaroidCaption}>
        <Text style={styles.polaroidCaptionText} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      {seal}
    </View>
  );
};

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

  // Up to three photographs of this very event, straight from the snapshot.
  const shots = (event?.samplePhotos ?? [])
    .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    .slice(0, 3);
  const captions = [
    event?.location || 'On-site studio',
    orgName,
    event?.clientName || 'HappyPix',
  ];

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
        {/* Electron `.start-art`: three rotated prints at the same insets and
            angles, now holding this event's own photographs. Widths are the CSS
            `min(39vw, 570px)`. */}
        <Animated.View
          style={[styles.art, isLandscape ? null : styles.artPortrait, { transform: [{ translateY: lift }] }]}
          pointerEvents="none"
        >
          <Polaroid
            uri={shots[0]}
            style={styles.photoOne}
            rotate={tiltA}
            gradient={['#f6a9c4', '#e2708f']}
            gradientId="start-p1"
            caption={captions[0]}
          />
          <Polaroid
            uri={shots[1]}
            style={styles.photoTwo}
            rotate={tiltB}
            gradient={['#c7b3f0', '#8f7bd8']}
            gradientId="start-p2"
            caption={captions[1]}
          />
          <Polaroid
            uri={shots[2]}
            style={styles.photoThree}
            rotate="-1deg"
            gradient={['#ffd3ae', '#e79a6d']}
            gradientId="start-p3"
            caption={captions[2]}
            seal={
              <View style={[styles.seal, { backgroundColor: p.pink, shadowColor: p.pink }]}>
                <Icon name="heart" size={scale(38)} color="#ffffff" strokeWidth={2} />
              </View>
            }
          />
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
  // A polaroid: white card, photo window, caption strip. The three CSS insets
  // below are Electron's, unchanged — only what sits *inside* the frame is new.
  polaroid: {
    position: 'absolute',
    padding: scale(6),
    paddingBottom: 0,
    borderRadius: scale(4),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(88,56,105,0.07)',
    shadowColor: '#3a1a33',
    shadowOpacity: 0.22,
    shadowRadius: scale(18),
    shadowOffset: { width: 0, height: verticalScale(10) },
    elevation: 6,
  },
  polaroidWindow: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: scale(2),
    backgroundColor: '#f3e8f1',
  },
  polaroidImage: { width: '100%', height: '100%' },
  polaroidGlyph: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  polaroidCaption: {
    height: verticalScale(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  polaroidCaptionText: {
    fontFamily: fonts.bodyBlack,
    fontSize: fontSize(7),
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#b09aae',
  },
  // inset: 3% 30% 29% 3% — rotate(-7deg)
  photoOne: {
    left: '3%',
    right: '30%',
    top: '3%',
    bottom: '29%',
  },
  // inset: 23% 1% 7% 36% — rotate(7deg)
  photoTwo: {
    left: '36%',
    right: '1%',
    top: '23%',
    bottom: '7%',
  },
  // inset: 35% 24% 2% 17% — rotate(-1deg)
  photoThree: {
    left: '17%',
    right: '24%',
    top: '35%',
    bottom: '2%',
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
