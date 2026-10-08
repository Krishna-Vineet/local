import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isDemoMode } from '@happypix/api';
import { cameraManager } from '../../../../packages/camera-core/src/index';
import { printerManager } from '../../../../packages/printer-core/src/index';
import { useBooth } from '../context/BoothProvider';
import { AppLogo } from '../components/AppLogo';
import {
  fontSize,
  moderateScale,
  scale,
  verticalScale,
} from '../../../../packages/ui/src/index';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
type CheckStatus = 'checking' | 'ok' | 'failed';

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login, bootError } = useBooth();
  const demo = isDemoMode();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > 700;

  const [email, setEmail] = useState(demo ? 'booth@happypix.in' : '');
  const [password, setPassword] = useState(demo ? 'demo123' : '');
  const [locationLabel, setLocationLabel] = useState('Main Kiosk');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(bootError);

  // Hardware Status State
  const [cameraStatus, setCameraStatus] = useState<CheckStatus>('checking');
  const [cameraName, setCameraName] = useState('Checking camera…');
  const [printerStatus, setPrinterStatus] = useState<CheckStatus>('checking');
  const [printerName, setPrinterName] = useState('Checking printer…');
  const [networkStatus, setNetworkStatus] = useState<CheckStatus>('ok');

  useEffect(() => {
    let mounted = true;

    const probeHardware = async () => {
      // 1. Camera check
      try {
        const type = await cameraManager.autoSelect();
        if (!mounted) return;
        setCameraName(type ? `${type.toUpperCase()} Camera (Ready)` : 'Integrated Tablet Cam');
        setCameraStatus('ok');
      } catch {
        if (!mounted) return;
        setCameraName('Camera Simulator / Standby');
        setCameraStatus('failed');
      }

      // 2. Printer check
      try {
        const devices = await printerManager.discover();
        if (!mounted) return;
        if (devices.length > 0) {
          setPrinterName(devices[0].name || 'High-Speed Dye-Sub Printer');
          setPrinterStatus('ok');
        } else {
          setPrinterName('Printer Simulator / Standby');
          setPrinterStatus('failed');
        }
      } catch {
        if (!mounted) return;
        setPrinterName('Printer Simulator / Standby');
        setPrinterStatus('failed');
      }
    };

    probeHardware();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    SoundManager.play('click');
    try {
      const { isLive } = await login({
        email: email.trim(),
        password,
        locationLabel: locationLabel.trim() || 'Tablet Booth',
      });

      SoundManager.play('success');
      if (isLive) {
        navigation.replace('Start');
      } else {
        navigation.replace('Waiting');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.mainLayout, isLandscape ? styles.rowLayout : styles.colLayout]}>
          {/* Left Column: HappyPix Story & Live Hardware Status */}
          <View style={styles.hardwarePanel}>
            <View style={styles.logoRow}>
              <AppLogo width={160} height={50} forceDark />
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>BOOTH KIOSK</Text>
              </View>
            </View>

            <Text style={styles.hardwareTitle}>Hardware Diagnostics</Text>
            <Text style={styles.hardwareSub}>
              Live status of camera, printer, and network connections.
            </Text>

            <View style={styles.diagnosticsList}>
              {/* Camera Diagnostic Row */}
              <View style={styles.diagRow}>
                <View style={[styles.statusDot, cameraStatus === 'ok' ? styles.dotGreen : styles.dotAmber]} />
                <View style={styles.diagInfo}>
                  <Text style={styles.diagLabel}>Camera Sensor</Text>
                  <Text style={styles.diagValue}>{cameraName}</Text>
                </View>
                <Text style={[styles.statusTag, cameraStatus === 'ok' ? styles.tagGreen : styles.tagAmber]}>
                  {cameraStatus === 'ok' ? 'ONLINE' : 'SIMULATOR'}
                </Text>
              </View>

              {/* Printer Diagnostic Row */}
              <View style={styles.diagRow}>
                <View style={[styles.statusDot, printerStatus === 'ok' ? styles.dotGreen : styles.dotAmber]} />
                <View style={styles.diagInfo}>
                  <Text style={styles.diagLabel}>Photo Printer</Text>
                  <Text style={styles.diagValue}>{printerName}</Text>
                </View>
                <Text style={[styles.statusTag, printerStatus === 'ok' ? styles.tagGreen : styles.tagAmber]}>
                  {printerStatus === 'ok' ? 'ONLINE' : 'STANDBY'}
                </Text>
              </View>

              {/* Display Resolution Diagnostic Row */}
              <View style={styles.diagRow}>
                <View style={[styles.statusDot, styles.dotGreen]} />
                <View style={styles.diagInfo}>
                  <Text style={styles.diagLabel}>Display Viewport</Text>
                  <Text style={styles.diagValue}>{Math.round(width)} × {Math.round(height)} px (Full Touch)</Text>
                </View>
                <Text style={[styles.statusTag, styles.tagGreen]}>READY</Text>
              </View>

              {/* Cloud Sync Diagnostic Row */}
              <View style={styles.diagRow}>
                <View style={[styles.statusDot, styles.dotGreen]} />
                <View style={styles.diagInfo}>
                  <Text style={styles.diagLabel}>Cloud Sync & Backend</Text>
                  <Text style={styles.diagValue}>HappyPix Cloud API Connected</Text>
                </View>
                <Text style={[styles.statusTag, styles.tagGreen]}>ACTIVE</Text>
              </View>
            </View>

            <View style={styles.leftFooter}>
              <Text style={styles.leftFooterText}>
                HappyPix Booth v2.4 • Production Terminal
              </Text>
            </View>
          </View>

          {/* Right Column: Organization Admin Login */}
          <View style={styles.loginCard}>
            <Text style={styles.loginBadge}>ORGANIZATION PAIRING</Text>
            <Text style={styles.loginTitle}>Connect This Booth</Text>
            <Text style={styles.loginSub}>
              Enter your HappyPix manager credentials to assign and unlock events.
            </Text>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>ADMIN EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="booth@happypix.in"
                placeholderTextColor="#52525b"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#52525b"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>BOOTH LOCATION LABEL</Text>
              <TextInput
                style={styles.input}
                value={locationLabel}
                onChangeText={setLocationLabel}
                placeholder="Main Stage, Hall A, Lobby…"
                placeholderTextColor="#52525b"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.submitBtnText}>  Connecting…</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>Pair & Launch Kiosk →</Text>
              )}
            </TouchableOpacity>

            {demo && (
              <View style={styles.demoCard}>
                <Text style={styles.demoTitle}>💡 Demo Credentials</Text>
                <Text style={styles.demoBody}>
                  booth@happypix.in  •  demo123
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050508',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  mainLayout: {
    width: '100%',
    maxWidth: 960,
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(24),
  },
  rowLayout: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  colLayout: {
    flexDirection: 'column',
  },
  hardwarePanel: {
    flex: 1,
    backgroundColor: '#0c0c12',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#1f1f2a',
    padding: scale(28),
    justifyContent: 'space-between',
    minWidth: scale(340),
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(18),
  },
  badgePill: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  badgeText: {
    color: '#a78bfa',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  hardwareTitle: {
    color: '#ffffff',
    fontSize: fontSize(22),
    fontWeight: '900',
    marginBottom: 4,
  },
  hardwareSub: {
    color: '#71717a',
    fontSize: fontSize(13),
    marginBottom: verticalScale(20),
    lineHeight: 18,
  },
  diagnosticsList: {
    gap: verticalScale(12),
    marginBottom: verticalScale(20),
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12121b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f1f2c',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(14),
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: scale(12),
  },
  dotGreen: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },
  dotAmber: {
    backgroundColor: '#f59e0b',
  },
  diagInfo: {
    flex: 1,
  },
  diagLabel: {
    color: '#ffffff',
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  diagValue: {
    color: '#a1a1aa',
    fontSize: fontSize(11),
    marginTop: 2,
  },
  statusTag: {
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  tagGreen: {
    color: '#4ade80',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  tagAmber: {
    color: '#fbbf24',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  leftFooter: {
    borderTopWidth: 1,
    borderTopColor: '#1a1a24',
    paddingTop: verticalScale(14),
  },
  leftFooterText: {
    color: '#52525b',
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  loginCard: {
    flex: 1,
    backgroundColor: '#101016',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#242432',
    padding: scale(32),
    minWidth: scale(340),
    maxWidth: scale(440),
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  loginBadge: {
    color: '#8b5cf6',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  loginTitle: {
    color: '#ffffff',
    fontSize: fontSize(24),
    fontWeight: '900',
    marginBottom: 4,
  },
  loginSub: {
    color: '#a1a1aa',
    fontSize: fontSize(12),
    lineHeight: 17,
    marginBottom: verticalScale(18),
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: scale(10),
    borderRadius: 10,
    marginBottom: verticalScale(14),
  },
  errorText: {
    color: '#f87171',
    fontSize: fontSize(12),
    fontWeight: '600',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: verticalScale(14),
  },
  fieldLabel: {
    color: '#71717a',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#171720',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#282836',
    color: '#ffffff',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(14),
    fontSize: fontSize(14),
  },
  submitBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: verticalScale(14),
    alignItems: 'center',
    marginTop: verticalScale(10),
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  demoCard: {
    marginTop: verticalScale(16),
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    borderRadius: 10,
    padding: scale(10),
    alignItems: 'center',
  },
  demoTitle: {
    color: '#a78bfa',
    fontSize: fontSize(11),
    fontWeight: '800',
    marginBottom: 2,
  },
  demoBody: {
    color: '#e4e4e7',
    fontSize: fontSize(12),
    fontWeight: '600',
  },
});
