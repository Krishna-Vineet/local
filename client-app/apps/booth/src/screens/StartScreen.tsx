import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  Modal,
  TextInput,
  Alert,
  Image,
} from 'react-native';
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

const PREVIEW_CARDS = [
  'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80', // wedding romance
  'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&q=80', // joyful laughter
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80', // stylish portrait
];

export const StartScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const { snapshot, setSession, logout, refreshEvent } = useBooth();
  const event = snapshot?.event;
  const orgName = snapshot?.settings?.organizationName || snapshot?.organization?.name || 'HappyPix';

  const { width, height } = useWindowDimensions();
  const isLandscape = width > 700;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  // Secret admin unlock state
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');

  useEffect(() => {
    // Pulse animation for start bar
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
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

  const handleLogoTap = () => {
    const next = logoTapCount + 1;
    if (next >= 5) {
      setLogoTapCount(0);
      setShowAdminModal(true);
    } else {
      setLogoTapCount(next);
      setTimeout(() => setLogoTapCount(0), 3000);
    }
  };

  const handleAdminAction = async (action: 'refresh' | 'unpair') => {
    if (adminPin !== '1234' && adminPin !== 'admin') {
      Alert.alert('Invalid PIN', 'Please enter PIN (1234) for operator options.');
      return;
    }

    setShowAdminModal(false);
    setAdminPin('');

    if (action === 'refresh') {
      await refreshEvent();
      Alert.alert('Refreshed', 'Event data refreshed from server.');
    } else if (action === 'unpair') {
      await logout();
      navigation.replace('Login');
    }
  };

  return (
    <ScreenContainer style={{ backgroundColor: '#050508' }}>
      <TouchableOpacity
        style={styles.touchArea}
        activeOpacity={1}
        onPress={handleStart}
      >
        {/* Background ambient neon orbs */}
        <Animated.View style={[styles.ambientOrbLeft, { opacity: glowAnim }]} pointerEvents="none" />
        <Animated.View style={[styles.ambientOrbRight, { opacity: glowAnim }]} pointerEvents="none" />

        {/* Top Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLogoTap} activeOpacity={0.85} style={styles.logoBtn}>
            <AppLogo width={160} height={42} forceDark />
          </TouchableOpacity>

          <View style={styles.headerRight}>
            <View style={styles.orgBadge}>
              <Text style={styles.orgBadgeText}>{orgName.toUpperCase()}</Text>
            </View>
            <TouchableOpacity
              style={styles.gearBtn}
              onPress={() => setShowAdminModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.gearIcon}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Hero Section */}
        <View style={[styles.heroBody, isLandscape ? styles.heroRow : styles.heroCol]}>
          {/* Left / Center: Layered Floating Polaroids */}
          <Animated.View
            style={[
              styles.cardsStage,
              { transform: [{ translateY: floatAnim }] },
            ]}
          >
            {/* Card Left */}
            <View style={[styles.cardFrame, styles.cardLeft]}>
              <Image source={{ uri: PREVIEW_CARDS[0] }} style={styles.cardPhoto} />
              <View style={styles.cardFooter}>
                <Text style={styles.cardBrandText}>HAPPYPIX LIVE</Text>
              </View>
            </View>

            {/* Card Right */}
            <View style={[styles.cardFrame, styles.cardRight]}>
              <Image source={{ uri: PREVIEW_CARDS[1] }} style={styles.cardPhoto} />
              <View style={styles.cardFooter}>
                <Text style={styles.cardBrandText}>{orgName.toUpperCase()}</Text>
              </View>
            </View>

            {/* Card Center (Hero) */}
            <View style={[styles.cardFrame, styles.cardCenter]}>
              <Image source={{ uri: PREVIEW_CARDS[2] }} style={styles.cardPhoto} />
              <View style={styles.cardFooter}>
                <Text style={styles.cardBrandText}>STUDIO EDITION</Text>
              </View>
              <View style={styles.cardGlossOverlay} />
            </View>

            {/* Glowing Heart Stamp */}
            <View style={styles.heartStamp}>
              <Text style={styles.heartStampText}>♥</Text>
            </View>
          </Animated.View>

          {/* Right / Center: Event Details & Branding */}
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
                “Strike a pose, make a memory, take it home.”
              </Text>
            )}
          </View>
        </View>

        {/* Bottom Glowing Animated Start Bar */}
        <View style={styles.ctaWrapper}>
          <Animated.View style={[styles.startPill, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.startPillGlow} />
            <Text style={styles.startPillText}>TOUCH ANYWHERE TO START</Text>
            <View style={styles.startArrowCircle}>
              <Text style={styles.startArrowText}>→</Text>
            </View>
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Secret Admin / Operator Modal */}
      <Modal visible={showAdminModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Booth Operator Menu</Text>
            <Text style={styles.modalSub}>Enter PIN (1234) for operator options</Text>

            <TextInput
              style={styles.modalInput}
              value={adminPin}
              onChangeText={setAdminPin}
              placeholder="PIN"
              placeholderTextColor="#71717a"
              secureTextEntry
              keyboardType="number-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#3b82f6' }]}
                onPress={() => handleAdminAction('refresh')}
              >
                <Text style={styles.modalBtnText}>Sync Event</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#ef4444' }]}
                onPress={() => handleAdminAction('unpair')}
              >
                <Text style={styles.modalBtnText}>Unpair Booth</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setShowAdminModal(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    top: '15%',
    left: '5%',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#8b5cf6',
    opacity: 0.15,
    filter: 'blur(60px)',
  },
  ambientOrbRight: {
    position: 'absolute',
    bottom: '15%',
    right: '5%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#ec4899',
    opacity: 0.12,
    filter: 'blur(60px)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingTop: verticalScale(4),
  },
  logoBtn: {
    padding: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  orgBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  orgBadgeText: {
    color: '#e4e4e7',
    fontSize: fontSize(11),
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  gearBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: {
    color: '#a1a1aa',
    fontSize: 16,
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
    flex: 1,
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
    width: moderateScale(46),
    height: moderateScale(46),
    borderRadius: moderateScale(23),
    borderColor: '#ff0000',
    border: 2,
    backgroundColor: '#ff0000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
    shadowColor: '#ec4899',
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 8,
  },
  heartStampText: {
    backgroundColor: '#ff0000',
    color: '#ffffff',
    fontSize: fontSize(22),
    fontWeight: '900',
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
    backgroundColor: '#8b5cf6',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(36),
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  startPillGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 36,
    backgroundColor: '#8b5cf6',
    opacity: 0.3,
  },
  startPillText: {
    fontSize: fontSize(16),
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
    marginRight: scale(14),
  },
  startArrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startArrowText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#7c3aed',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  modalCard: {
    backgroundColor: '#18181b',
    borderRadius: moderateScale(20),
    borderWidth: 1.5,
    borderColor: '#27272a',
    padding: scale(28),
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: fontSize(18),
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    color: '#a1a1aa',
    fontSize: fontSize(12),
    marginBottom: verticalScale(16),
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#09090b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3f3f46',
    color: '#ffffff',
    fontSize: fontSize(16),
    textAlign: 'center',
    padding: scale(12),
    marginBottom: verticalScale(16),
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: verticalScale(12),
  },
  modalBtn: {
    flex: 1,
    paddingVertical: verticalScale(12),
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: scale(4),
  },
  modalBtnText: {
    color: '#ffffff',
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  modalCloseBtn: {
    paddingVertical: 8,
  },
  modalCloseText: {
    color: '#a1a1aa',
    fontSize: fontSize(12),
  },
});
