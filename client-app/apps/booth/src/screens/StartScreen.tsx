import React, { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  Image,
} from 'react-native';
import Svg, { Path, Defs, RadialGradient, Stop, Circle, Rect } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenContainer,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { useBooth, freshSession } from '../context/BoothProvider';
import { AppLogo } from '../components/AppLogo';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Start'>;

/**
 * True mathematical Gaussian-like radial blur orb using SVG RadialGradient.
 * Fades smoothly from saturated center to transparent zero-opacity edge without banding.
 */
const BlurredOrb: React.FC<{
  color: string;
  size: number;
  style: StyleProp<ViewStyle>;
  opacity: Animated.Value;
  id: string;
}> = ({ color, size, style, opacity, id }) => (
  <Animated.View pointerEvents="none" style={[style, { width: size, height: size, opacity }]}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <Stop offset="30%" stopColor={color} stopOpacity="0.35" />
          <Stop offset="55%" stopColor={color} stopOpacity="0.18" />
          <Stop offset="75%" stopColor={color} stopOpacity="0.06" />
          <Stop offset="90%" stopColor={color} stopOpacity="0.015" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  </Animated.View>
);

// High-resolution curated photographic samples for celebration photo booths
const DEFAULT_SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
];

// Offline / network failure decorative artwork fallback
const FallbackArtwork: React.FC<{ index: number }> = ({ index }) => {
  const configs = [
    { from: '#4c1d95', to: '#db2777', title: 'PORTRAIT', accent: '#fde047' },
    { from: '#065f46', to: '#0284c7', title: 'CELEBRATION', accent: '#fbcfe8' },
    { from: '#7c2d12', to: '#e11d48', title: 'MEMORIES', accent: '#fef08a' },
  ];
  const c = configs[index] || configs[0];
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 300 400" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={`fb-${index}`} cx="50%" cy="40%" rx="60%" ry="60%">
            <Stop offset="0%" stopColor={c.to} />
            <Stop offset="100%" stopColor={c.from} />
          </RadialGradient>
        </Defs>
        <Rect width="300" height="400" fill={`url(#fb-${index})`} />
        <Circle cx="150" cy="140" r="54" fill={c.accent} opacity={0.85} />
        <Circle cx="150" cy="130" r="38" fill="#ffffff" opacity={0.9} />
        <Circle cx="105" cy="230" r="16" fill="#ffffff" opacity={0.35} />
        <Circle cx="195" cy="220" r="12" fill="#ffffff" opacity={0.4} />
      </Svg>
    </View>
  );
};

export const StartScreen: React.FC<Props> = ({ navigation }) => {
  const { snapshot, setSession } = useBooth();
  const event = snapshot?.event;
  const orgName = snapshot?.settings?.organizationName || snapshot?.organization?.name || 'HappyPix';

  // Three slots: prioritize event's own recent photos, then template previews, then curated samples
  const samplePhotos = (event?.samplePhotos || []).filter(Boolean);
  const templatePreviews = (event?.templates || [])
    .map((t: any) => t?.previewUrl || t?.thumbnailUrl || t?.imageUrl || t?.design?.background?.url || t?.design?.bg?.url)
    .filter(Boolean);

  const slotImages = [0, 1, 2].map((index) => {
    if (samplePhotos[index]) return samplePhotos[index];
    if (templatePreviews[index]) return templatePreviews[index];
    return DEFAULT_SAMPLE_PHOTOS[index];
  });

  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Pulse animation for start button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ])
    ).start();

    // Floating cards effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.85, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleStart = () => {
    SoundManager.play('click');
    setSession(freshSession());
    navigation.navigate('Orientation');
  };

  return (
    <ScreenContainer style={{ backgroundColor: '#050508' }}>
      <TouchableOpacity
        style={styles.touchArea}
        activeOpacity={1}
        onPress={handleStart}
      >
        {/* Background ambient smooth blurred orbs */}
        <BlurredOrb color="#8b5cf6" size={380} style={styles.ambientOrbLeft} opacity={glowAnim} id="orbLeft" />
        <BlurredOrb color="#ec4899" size={360} style={styles.ambientOrbRight} opacity={glowAnim} id="orbRight" />
        <BlurredOrb color="#06b6d4" size={280} style={styles.ambientOrbCenter} opacity={glowAnim} id="orbCenter" />

        {/* Top Header Bar */}
        <View style={styles.header}>
          <AppLogo width={160} height={42} forceDark />
          <View style={styles.orgBadge}>
            <Text style={styles.orgBadgeText}>{orgName.toUpperCase()}</Text>
          </View>
        </View>

        {/* Main Hero Section */}
        <View style={[styles.heroBody, isLandscape ? styles.heroRow : styles.heroCol]}>
          {/* Layered Floating Polaroids */}
          <Animated.View
            style={[
              styles.cardsStage,
              { transform: [{ translateY: floatAnim }] },
            ]}
          >
            {/* Card Left */}
            <View style={[styles.cardFrame, styles.cardLeft]}>
              {imageErrors[0] ? (
                <FallbackArtwork index={0} />
              ) : (
                <Image
                  source={{ uri: slotImages[0] }}
                  style={styles.cardPhoto}
                  resizeMode="cover"
                  onError={() => setImageErrors((prev) => ({ ...prev, 0: true }))}
                />
              )}
              <View style={styles.cardFooter}>
                <Text style={styles.cardBrandText}>HAPPYPIX LIVE</Text>
              </View>
            </View>

            {/* Card Right */}
            <View style={[styles.cardFrame, styles.cardRight]}>
              {imageErrors[1] ? (
                <FallbackArtwork index={1} />
              ) : (
                <Image
                  source={{ uri: slotImages[1] }}
                  style={styles.cardPhoto}
                  resizeMode="cover"
                  onError={() => setImageErrors((prev) => ({ ...prev, 1: true }))}
                />
              )}
              <View style={styles.cardFooter}>
                <Text style={styles.cardBrandText}>{orgName.toUpperCase()}</Text>
              </View>
            </View>

            {/* Card Center (Hero) */}
            <View style={[styles.cardFrame, styles.cardCenter]}>
              {imageErrors[2] ? (
                <FallbackArtwork index={2} />
              ) : (
                <Image
                  source={{ uri: slotImages[2] }}
                  style={styles.cardPhoto}
                  resizeMode="cover"
                  onError={() => setImageErrors((prev) => ({ ...prev, 2: true }))}
                />
              )}
              <View style={styles.cardFooter}>
                <Text style={styles.cardBrandText}>STUDIO EDITION</Text>
              </View>
              <View style={styles.cardGlossOverlay} />
            </View>

            {/* Pure Red Circle with White Heart SVG Icon */}
            <View style={styles.heartStamp}>
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Path
                  fill="#ffffff"
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                />
              </Svg>
            </View>
          </Animated.View>

          {/* Event Details & Branding */}
          <View style={styles.eventInfo}>
            <View style={styles.eyebrowContainer}>
              <View style={styles.eyebrowLine} />
              <Text style={styles.eyebrowText}>WELCOME TO</Text>
              <View style={styles.eyebrowLine} />
            </View>

            <Text style={styles.eventTitle} numberOfLines={2}>
              {event?.name || 'HappyPix Photo Booth'}
            </Text>

            <View style={styles.pillRow}>
              {event?.clientName ? (
                <View style={styles.clientPill}>
                  <Text style={styles.clientPillText}>{event.clientName}</Text>
                </View>
              ) : null}
              {event?.location ? (
                <View style={styles.venuePill}>
                  <Text style={styles.venuePillText}>📍 {event.location}</Text>
                </View>
              ) : null}
            </View>

            {event?.branding?.tagline ? (
              <Text style={styles.taglineText}>
                “{event.branding.tagline}”
              </Text>
            ) : (
              <Text style={styles.taglineText}>
                “Together is a beautiful place to be”
              </Text>
            )}
          </View>
        </View>

        {/* Bottom Vibe-Matched Start Button */}
        <View style={styles.ctaWrapper}>
          <Animated.View style={[styles.startPill, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.startPillGlow} />
            <View style={styles.apertureIcon}>
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path
                  fill="#ffffff"
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"
                />
              </Svg>
            </View>
            <Text style={styles.startPillText}>TOUCH TO START</Text>
            <View style={styles.arrowCircle}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </Animated.View>
        </View>
      </TouchableOpacity>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  touchArea: {
    flex: 1,
    justifyContent: 'space-between',
    padding: scale(16),
  },
  ambientOrbLeft: {
    position: 'absolute',
    top: '10%',
    left: '-5%',
  },
  ambientOrbRight: {
    position: 'absolute',
    bottom: '10%',
    right: '-5%',
  },
  ambientOrbCenter: {
    position: 'absolute',
    top: '40%',
    left: '25%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingTop: verticalScale(4),
  },
  orgBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  orgBadgeText: {
    color: '#e4e4e7',
    fontSize: fontSize(11),
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  heroCol: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  cardsStage: {
    width: scale(280),
    height: verticalScale(240),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    margin: scale(16),
  },
  cardFrame: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 8,
    paddingBottom: 26,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
  },
  cardLeft: {
    width: scale(135),
    height: verticalScale(175),
    left: scale(10),
    top: verticalScale(25),
    transform: [{ rotate: '-14deg' }],
  },
  cardRight: {
    width: scale(135),
    height: verticalScale(175),
    right: scale(10),
    top: verticalScale(25),
    transform: [{ rotate: '15deg' }],
  },
  cardCenter: {
    width: scale(150),
    height: verticalScale(195),
    top: verticalScale(10),
    transform: [{ rotate: '0deg' }],
    zIndex: 5,
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#18181b',
  },
  cardFooter: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    alignItems: 'center',
  },
  cardBrandText: {
    fontSize: fontSize(8),
    fontWeight: '900',
    color: '#3f3f46',
    letterSpacing: 1.5,
  },
  cardGlossOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    height: '40%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
  },
  heartStamp: {
    position: 'absolute',
    bottom: verticalScale(8),
    right: scale(20),
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
    shadowColor: '#dc2626',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  eventInfo: {
    alignItems: 'center',
    maxWidth: scale(520),
    paddingHorizontal: scale(20),
  },
  eyebrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginBottom: verticalScale(8),
  },
  eyebrowLine: {
    width: 28,
    height: 1.5,
    backgroundColor: '#a78bfa',
  },
  eyebrowText: {
    fontSize: fontSize(11),
    fontWeight: '800',
    color: '#a78bfa',
    letterSpacing: 3,
  },
  eventTitle: {
    fontSize: fontSize(34),
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: fontSize(40),
    marginBottom: verticalScale(12),
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: scale(8),
    marginBottom: verticalScale(14),
  },
  clientPill: {
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  clientPillText: {
    color: '#c4b5fd',
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  venuePill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  venuePillText: {
    color: '#d4d4d8',
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  taglineText: {
    fontSize: fontSize(14),
    fontStyle: 'italic',
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: scale(420),
  },
  ctaWrapper: {
    alignItems: 'center',
    paddingBottom: verticalScale(18),
  },
  startPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181028',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(28),
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: '#a855f7',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 8,
  },
  startPillGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 36,
    backgroundColor: '#8b5cf6',
    opacity: 0.15,
  },
  apertureIcon: {
    marginRight: scale(10),
  },
  startPillText: {
    fontSize: fontSize(15),
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    marginRight: scale(12),
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  arrowText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
  },
});
