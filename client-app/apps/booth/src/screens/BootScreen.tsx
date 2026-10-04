import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { cameraManager } from '../../../../packages/camera-core/src/index';
import { printerManager } from '../../../../packages/printer-core/src/index';
import { useBooth } from '../context/BoothProvider';
import { isLargeScreen } from '@happypix/ui';
import type { RootStackParamList } from '../../App';

import { AppLogo } from '../components/AppLogo';

type Props = NativeStackScreenProps<RootStackParamList, 'Boot'>;
type CheckStatus = 'checking' | 'ok' | 'failed';

export const BootScreen: React.FC<Props> = ({ navigation }) => {
  const { send } = useBooth();
  const [cameraStatus, setCameraStatus] = useState<CheckStatus>('checking');
  const [printerStatus, setPrinterStatus] = useState<CheckStatus>('checking');
  const [cameraType, setCameraType] = useState('');

  // Anim values for Fade & Scale
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  // Sound Player Simulator
  const playWelcomeSound = () => {
    try {
      console.log('🔊 [SoundPulse] Playing Welcome Sound: client-app/apps/booth/src/assets/sounds/startup.mp3');
    } catch (e) {
      console.warn('Could not play welcome sound:', e);
    }
  };

  useEffect(() => {
    // 1. Play startup sound immediately on mount
    playWelcomeSound();

    // 2. Start parallel animations (Fade & Scale Zoom-In)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // 3. Check Devices (Camera & Printer) in background
    const checkDevicesAndNavigate = async () => {
      const startTime = Date.now();

      // Check camera
      try {
        const type = await cameraManager.autoSelect();
        setCameraType(type.toUpperCase());
        setCameraStatus('ok');
      } catch {
        setCameraStatus('failed');
      }

      // Check printer (optional)
      try {
        const devices = await printerManager.discover();
        if (devices.length > 0) {
          await printerManager.connect(devices[0]);
          setPrinterStatus('ok');
        } else {
          setPrinterStatus('failed');
        }
      } catch {
        setPrinterStatus('failed');
      }

      // Signal state machine that device check is done
      send({ type: 'DEVICES_READY' });

      // Enforce at least 1.5s splash visibility
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 1500 - elapsedTime);

      setTimeout(() => {
        navigation.replace('Login');
      }, remainingTime);
    };

    checkDevicesAndNavigate();
  }, []);

  const StatusRow = ({ label, status }: { label: string; status: CheckStatus }) => (
    <View style={styles.row}>
      <Text style={styles.statusLabel}>{label}</Text>
      {status === 'checking' && <ActivityIndicator size="small" color="#8b5cf6" />}
      {status === 'ok' && <Text style={styles.okText}>✓ Ready</Text>}
      {status === 'failed' && <Text style={styles.warnText}>⚠ Not Found</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.brandContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <AppLogo width={180} height={160} forceDark />
        <View style={styles.divider} />
        <Text style={styles.sub}>PREMIUM PHOTO BOOTH EXPERIENCE</Text>
      </Animated.View>

      {/* System Check Card */}
      <Animated.View style={[styles.checkCard, { opacity: fadeAnim }]}>
        <Text style={styles.cardTitle}>System Diagnostics</Text>
        <StatusRow
          label={`Camera ${cameraType ? `(${cameraType})` : ''}`}
          status={cameraStatus}
        />
        <StatusRow label="Printer Connection" status={printerStatus} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  brandContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: '#8b5cf6',
    borderRadius: 2,
    marginVertical: 12,
  },
  sub: {
    fontSize: 11,
    color: '#71717a',
    letterSpacing: 3,
    fontWeight: '600',
    textAlign: 'center',
  },
  checkCard: {
    backgroundColor: '#121217',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#22222a',
    padding: 24,
    width: '100%',
    maxWidth: 380,
    marginTop: 20,
  },
  cardTitle: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1d1d24',
  },
  statusLabel: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  okText: { color: '#22c55e', fontSize: 13, fontWeight: '700' },
  warnText: { color: '#f59e0b', fontSize: 13, fontWeight: '700' },
});
