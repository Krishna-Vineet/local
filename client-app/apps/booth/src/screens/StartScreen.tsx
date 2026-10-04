import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Platform, Modal, ScrollView, StatusBar
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path, G, Defs, ClipPath, Rect } from 'react-native-svg';

import { useBooth } from '../context/BoothProvider';
import { DeviceAPI, SettingsAPI } from '../../../../packages/api/src/index';
import { SettingsExitButton } from '../components/SettingsExitButton';
import {
  ScreenContainer,
  LayoutContainer,
  ThemeToggle,
  GlassCard,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale
} from '../../../../packages/ui/src/index';
import { AppLogo } from '../components/AppLogo';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Start'>;

export const StartScreen: React.FC<Props> = ({ navigation }) => {
  const { theme, mode } = useAppTheme();
  const { state, send } = useBooth();
  const event = state.context.activeEvent;

  const [showCoupons, setShowCoupons] = React.useState(false);
  const arrowFade = useRef(new Animated.Value(0.3)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const arrowMove = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    StatusBar.setHidden(true);

    Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(arrowFade, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(arrowFade, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(arrowMove, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(arrowMove, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    return () => StatusBar.setHidden(false);
  }, []);

  const handleStart = () => {
    SoundManager.haptic(25);
    SoundManager.play('click');
    send({ type: 'START_SESSION' });
    
    // Check if layout selection is enabled for this event
    const hasLayoutSelection = !event?.selectedScreens || event.selectedScreens.includes('layoutSelection' as any);
    if (hasLayoutSelection) {
      navigation.replace('LayoutSelection' as any);
    } else {
      navigation.replace('SlotSelection' as any);
    }
  };

  const LogoComponent = () => (
    <Animated.View style={{ transform: [{ scale: logoScale }] }}>
      <AppLogo width={scale(360)} height={scale(335)} />
    </Animated.View>
  );

  return (
    <ScreenContainer style={styles.screen}>
      <LayoutContainer contentContainerStyle={styles.layout} scrollable>

        {/* Top Header */}
        <View style={styles.header}>
          <SettingsExitButton />
          <ThemeToggle />
        </View>

        {/* Center Content */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleStart}
          style={styles.center}
        >
          <LogoComponent />
          <View style={styles.textContainer}>
            {/* <Text style={[styles.mainTitle, { color: theme.colors.text }]}>
              HAPPY<Text style={{ color: theme.colors.primary }}>PIX</Text>
            </Text> */}
            <Text style={[styles.subTitle, { color: theme.colors.textSecondary }]}>
              PREMIUM PHOTO BOOTH EXPERIENCE
            </Text>
          </View>
        </TouchableOpacity>

        {/* Bottom Interaction Area */}
        <View style={styles.footer}>
          <Animated.View style={[styles.promptContainer, { opacity: arrowFade }]}>
            <Animated.Text
              style={[
                styles.chevron,
                {
                  color: '#C084FC',
                  transform: [{ translateX: arrowMove.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }]
                }
              ]}
            >
              ≫≫≫
            </Animated.Text>

            <Text style={[styles.promptText, { color: theme.colors.text }]}>
              Start by touching the screen
            </Text>

            <Animated.Text
              style={[
                styles.chevron,
                {
                  color: '#F472B6',
                  transform: [{ translateX: arrowMove.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }]
                }
              ]}
            >
              ≪≪≪
            </Animated.Text>
          </Animated.View>
        </View>

        {/* Modals removed for coupon redesign */}

      </LayoutContainer>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  screen: {
    padding: 0,
  },
  layout: {
    justifyContent: 'space-between',
    paddingVertical: verticalScale(50),
    paddingHorizontal: scale(40),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    gap: scale(16),
  },
  couponBtn: {
    paddingVertical: moderateScale(10),
    paddingHorizontal: scale(20),
    borderRadius: moderateScale(20),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  couponBtnText: {
    fontSize: fontSize(12),
    fontWeight: '900',
    letterSpacing: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: verticalScale(20),
  },
  mainTitle: {
    fontSize: fontSize(48),
    fontWeight: '900',
    letterSpacing: 8,
  },
  subTitle: {
    fontSize: fontSize(16),
    fontWeight: '700',
    letterSpacing: 4,
    marginTop: verticalScale(10),
  },
  footer: {
    alignItems: 'center',
    paddingBottom: verticalScale(30),
  },
  promptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  promptText: {
    fontSize: fontSize(20),
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  chevron: {
    fontSize: fontSize(22),
    fontWeight: '900',
    textShadowColor: 'rgba(192, 132, 252, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(24),
  },
  modalCard: {
    width: '100%',
    maxWidth: scale(400),
  },
  modalTitle: {
    fontSize: fontSize(24),
    fontWeight: '900',
    marginBottom: verticalScale(8),
  },
  modalSub: {
    fontSize: fontSize(14),
    marginBottom: verticalScale(24),
  },
  couponList: {
    maxHeight: verticalScale(200),
  },
  couponItem: {
    padding: moderateScale(16),
    borderRadius: moderateScale(16),
    marginBottom: verticalScale(12),
  },
  couponCode: {
    fontSize: fontSize(18),
    fontWeight: '900',
    marginBottom: verticalScale(4),
  },
  couponDesc: {
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  closeBtn: {
    marginTop: verticalScale(20),
    paddingVertical: moderateScale(16),
    borderRadius: moderateScale(16),
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: fontSize(16),
    fontWeight: '900',
    letterSpacing: 1,
  },
});
