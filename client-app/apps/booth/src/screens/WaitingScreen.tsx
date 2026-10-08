import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenContainer,
  GlassCard,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { useBooth } from '../context/BoothProvider';
import { AppLogo } from '../components/AppLogo';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Waiting'>;

const WAITING_MESSAGES = [
  'Polishing the pixels while we wait…',
  'A great photo is only one event away.',
  'Camera-ready. Confetti-ready. Guest-ready.',
];

export const WaitingScreen: React.FC<Props> = ({ navigation }) => {
  const { theme, mode } = useAppTheme();
  const { snapshot, refreshEvent, logout } = useBooth();
  const [refreshing, setRefreshing] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % WAITING_MESSAGES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Periodic auto-check
  useEffect(() => {
    const timer = setInterval(() => {
      void refreshEvent();
    }, 20000);
    return () => clearInterval(timer);
  }, [refreshEvent]);

  // When an event becomes live, auto-navigate to Start
  useEffect(() => {
    if (snapshot?.event?.status === 'live') {
      navigation.replace('Start');
    }
  }, [snapshot?.event?.status, navigation]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshEvent();
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        {/* Top subtle bar */}
        <View style={styles.topBar}>
          <Text style={[styles.orgName, { color: theme.colors.primary }]}>
            {snapshot?.organization?.name?.toUpperCase() || 'HAPPYPIX BOOTH'}
          </Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Unpair</Text>
          </TouchableOpacity>
        </View>

        {/* Center Card */}
        <View style={styles.centerContainer}>
          <GlassCard style={styles.card}>
            <View style={styles.logoWrapper}>
              <AppLogo width={160} height={130} forceDark />
            </View>

            <View style={styles.statusPill}>
              <View style={styles.dot} />
              <Text style={styles.statusText}>
                {snapshot?.device?.name || 'Kiosk Connected'}
              </Text>
            </View>

            <Text style={styles.title}>No Live Event Right Now</Text>
            <Text style={styles.subtitle}>{WAITING_MESSAGES[messageIndex]}</Text>

            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleRefresh}
              disabled={refreshing}
              activeOpacity={0.85}
            >
              {refreshing ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.refreshButtonText}>Check for Event ↻</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.deviceNote}>
              This booth checks automatically every 20 seconds.
            </Text>
          </GlassCard>
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: scale(16),
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(12),
    paddingTop: verticalScale(8),
  },
  orgName: {
    fontSize: fontSize(11),
    fontWeight: '800',
    letterSpacing: 2,
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  logoutText: {
    color: '#a1a1aa',
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    paddingVertical: verticalScale(32),
    paddingHorizontal: scale(28),
  },
  logoWrapper: {
    marginBottom: verticalScale(16),
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    marginBottom: verticalScale(16),
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 7,
  },
  statusText: {
    color: '#4ade80',
    fontSize: fontSize(11),
    fontWeight: '700',
  },
  title: {
    color: '#ffffff',
    fontSize: fontSize(22),
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: verticalScale(8),
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: fontSize(13),
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: verticalScale(24),
  },
  refreshButton: {
    width: '100%',
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(12),
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: fontSize(14),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  deviceNote: {
    color: '#71717a',
    fontSize: fontSize(11),
    textAlign: 'center',
  },
});
