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

export const StartScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const { snapshot, setSession, logout, refreshEvent } = useBooth();
  const event = snapshot?.event;

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const arrowFade = useRef(new Animated.Value(0.3)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  // Secret admin unlock state
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');

  useEffect(() => {
    // Pulse animation for touch prompt
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowFade, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(arrowFade, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    // Heart beat animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(heartScale, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(heartScale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    Animated.spring(logoScale, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
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
      Alert.alert('Invalid PIN', 'Please enter the correct booth PIN.');
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
    <ScreenContainer>
      <TouchableOpacity
        style={styles.touchArea}
        activeOpacity={1}
        onPress={handleStart}
      >
        {/* Background ambient lighting */}
        <View style={styles.ambientGlow} pointerEvents="none" />

        {/* Top Header / Logos */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLogoTap} activeOpacity={0.9}>
            <AppLogo width={150} height={40} forceDark />
          </TouchableOpacity>
        </View>

        {/* Main Event Showcase */}
        <View style={[styles.mainContent, isLandscape ? styles.mainContentLandscape : styles.mainContentPortrait]}>
          {/* Polaroid Cards Art */}
          <View style={styles.photoArtContainer}>
            <View style={[styles.polaroid, styles.polaroidLeft]}>
              <View style={styles.polaroidInner} />
            </View>
            <View style={[styles.polaroid, styles.polaroidRight]}>
              <View style={styles.polaroidInner} />
            </View>
            <View style={[styles.polaroid, styles.polaroidCenter]}>
              <View style={styles.polaroidInner} />
            </View>
            <Animated.View style={[styles.heartBadge, { transform: [{ scale: heartScale }] }]}>
              <Text style={styles.heartText}>♥</Text>
            </Animated.View>
          </View>

          {/* Event Details */}
          <View style={styles.eventDetails}>
            <Text style={styles.eyebrow}>WELCOME TO</Text>
            <Text style={styles.eventName}>{event?.name || 'HappyPix Photo Booth'}</Text>

            <View style={styles.metaRow}>
              {event?.clientName ? (
                <Text style={styles.clientName}>{event.clientName}</Text>
              ) : null}
              {event?.clientName && event?.location ? <Text style={styles.metaDot}>•</Text> : null}
              {event?.location ? (
                <Text style={styles.eventLocation}>{event.location}</Text>
              ) : null}
            </View>

            {event?.branding?.tagline ? (
              <Text style={styles.tagline}>“{event.branding.tagline}”</Text>
            ) : null}
          </View>
        </View>

        {/* Bottom Call to Action */}
        <Animated.View style={[styles.ctaContainer, { opacity: arrowFade }]}>
          <Text style={styles.ctaText}>Touch anywhere to begin</Text>
          <Text style={styles.ctaArrow}>→</Text>
        </Animated.View>
      </TouchableOpacity>

      {/* Secret Admin Modal */}
      <Modal visible={showAdminModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Booth Management</Text>
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
    padding: scale(20),
  },
  ambientGlow: {
    position: 'absolute',
    top: '20%',
    left: '25%',
    width: '50%',
    height: '40%',
    borderRadius: 999,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: verticalScale(6),
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContentLandscape: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  mainContentPortrait: {
    flexDirection: 'column',
  },
  photoArtContainer: {
    width: scale(240),
    height: verticalScale(200),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: verticalScale(20),
  },
  polaroid: {
    position: 'absolute',
    width: scale(110),
    height: verticalScale(140),
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 6,
    paddingBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  polaroidLeft: {
    left: scale(20),
    top: verticalScale(20),
    transform: [{ rotate: '-12deg' }],
  },
  polaroidRight: {
    right: scale(20),
    top: verticalScale(20),
    transform: [{ rotate: '14deg' }],
  },
  polaroidCenter: {
    top: verticalScale(10),
    transform: [{ rotate: '1deg' }],
  },
  polaroidInner: {
    flex: 1,
    backgroundColor: '#18181b',
    borderRadius: 4,
  },
  heartBadge: {
    position: 'absolute',
    bottom: verticalScale(10),
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#ec4899',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  heartText: {
    color: '#ffffff',
    fontSize: fontSize(20),
    fontWeight: '900',
  },
  eventDetails: {
    alignItems: 'center',
    maxWidth: scale(520),
    paddingHorizontal: scale(16),
  },
  eyebrow: {
    fontSize: fontSize(11),
    fontWeight: '800',
    color: '#a78bfa',
    letterSpacing: 3,
    marginBottom: verticalScale(6),
  },
  eventName: {
    fontSize: fontSize(32),
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: fontSize(38),
    marginBottom: verticalScale(8),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  clientName: {
    fontSize: fontSize(14),
    fontWeight: '700',
    color: '#e4e4e7',
  },
  metaDot: {
    color: '#71717a',
    marginHorizontal: scale(8),
  },
  eventLocation: {
    fontSize: fontSize(14),
    fontWeight: '500',
    color: '#a1a1aa',
  },
  tagline: {
    fontSize: fontSize(13),
    fontStyle: 'italic',
    color: '#d4d4d8',
    textAlign: 'center',
    lineHeight: 18,
  },
  ctaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(18),
  },
  ctaText: {
    fontSize: fontSize(17),
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1,
    marginRight: scale(10),
  },
  ctaArrow: {
    fontSize: fontSize(22),
    fontWeight: '900',
    color: '#8b5cf6',
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
