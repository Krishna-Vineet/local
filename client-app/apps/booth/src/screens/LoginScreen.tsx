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
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [locationLabel, setLocationLabel] = useState('Main Kiosk');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
          await printerManager.connect(devices[0]).catch(() => {});
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

  const statusChips: { label: string; value: string; ok: boolean }[] = [
    { label: 'Camera', value: cameraName, ok: cameraStatus === 'ok' },
    { label: 'Printer', value: printerName, ok: printerStatus === 'ok' },
    { label: 'Network', value: networkStatus === 'ok' ? 'Online' : 'Offline', ok: networkStatus === 'ok' },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View pointerEvents="none" style={[styles.glow, styles.glowTop]} />
      <View pointerEvents="none" style={[styles.glow, styles.glowCenter]} />
      <View pointerEvents="none" style={[styles.glow, styles.glowBottom]} />

      <ScrollView
        contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isLandscape}
      >
        <View style={[styles.contentLayout, isLandscape && styles.contentLayoutLandscape]}>
          <View
            style={[
              styles.card,
              isLandscape ? styles.cardLandscape : { width: Math.min(width * 0.92, 540) },
            ]}
          >
            {/* Top System Tag */}
            <View style={[styles.topBadgeRow, isLandscape && { marginBottom: verticalScale(8) }]}>
              <View style={styles.topBadge}>
                <View style={styles.topBadgeDot} />
                <Text style={styles.topBadgeText}>KIOSK TERMINAL PAIRING</Text>
              </View>
            </View>

            <View style={[styles.brandRow, isLandscape && { marginBottom: verticalScale(8) }]}>
              <AppLogo width={isLandscape ? 144 : 168} height={isLandscape ? 42 : 52} forceDark />
            </View>

            <Text style={[styles.title, isLandscape && { fontSize: fontSize(21) }]}>Pair This Booth</Text>
            <Text style={[styles.subtitle, isLandscape && styles.subtitleLandscape]}>
              Authenticate with your organisation administrator credentials. Once linked, this kiosk retains
              its identity until manually removed from the CRM.
            </Text>

            {error ? (
              <View style={[styles.errorBox, isLandscape && { padding: scale(9), marginBottom: verticalScale(10) }]}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={isLandscape ? styles.inputsGridLandscape : undefined}>
              <View style={[styles.inputGroup, isLandscape && styles.inputGroupHalfLandscape]}>
                <Text style={styles.fieldLabel}>ADMINISTRATOR EMAIL</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, isLandscape && styles.inputLandscape]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="admin@organisation.com"
                    placeholderTextColor="#52525b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, isLandscape && styles.inputGroupHalfLandscape]}>
                <Text style={styles.fieldLabel}>PASSWORD</Text>
                <View style={[styles.inputWrapper, styles.passwordWrapper]}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, isLandscape && styles.inputLandscape]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••••••"
                    placeholderTextColor="#52525b"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.showToggle}
                    onPress={() => setShowPassword((value) => !value)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Text style={styles.showToggleText}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={[styles.inputGroup, isLandscape && { marginBottom: verticalScale(10) }]}>
              <Text style={styles.fieldLabel}>BOOTH LOCATION / NAME</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, isLandscape && styles.inputLandscape]}
                  value={locationLabel}
                  onChangeText={setLocationLabel}
                  placeholder="e.g. Main Lobby, Ballroom Hall A"
                  placeholderTextColor="#52525b"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, isLandscape && styles.submitBtnLandscape, loading && styles.submitBtnBusy]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.submitBtnText}>INITIALIZING HARDWARE LINK…</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.submitBtnText}>PAIR & CONNECT BOOTH</Text>
                  <Text style={styles.btnArrow}>→</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* System Diagnostics Dock (side panel in landscape, bottom dock in portrait) */}
          <View style={[styles.diagnosticsDock, isLandscape && styles.diagnosticsDockLandscape]}>
            <Text style={[styles.dockTitle, isLandscape && styles.dockTitleLandscape]}>HARDWARE READINESS</Text>
            <View style={[styles.chipRow, isLandscape && styles.chipColumnLandscape]}>
              {statusChips.map((chip) => (
                <View
                  key={chip.label}
                  style={[
                    styles.chip,
                    isLandscape && styles.chipLandscape,
                    chip.ok ? styles.chipOk : styles.chipWarn,
                  ]}
                >
                  <View style={[styles.chipBeacon, chip.ok ? styles.beaconOk : styles.beaconWarn]}>
                    <View style={[styles.chipDot, chip.ok ? styles.dotOk : styles.dotWarn]} />
                  </View>
                  <View style={styles.chipTextCol}>
                    <Text style={styles.chipLabel}>{chip.label}</Text>
                    <Text style={styles.chipValue} numberOfLines={1}>{chip.value}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={[styles.footer, isLandscape && styles.footerLandscape]}>
              HappyPix Engine · Device {Math.round(width)}×{Math.round(height)} · Kiosk Protected
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07060e' },
  glow: { position: 'absolute', borderRadius: 999 },
  glowTop: { top: -140, left: -100, width: 440, height: 440, backgroundColor: '#ec4899', opacity: 0.16 },
  glowCenter: { top: '35%', right: -120, width: 380, height: 380, backgroundColor: '#6366f1', opacity: 0.12 },
  glowBottom: { bottom: -160, left: -80, width: 480, height: 480, backgroundColor: '#8b5cf6', opacity: 0.14 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(28),
    paddingHorizontal: scale(16),
  },
  scrollLandscape: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(24),
  },
  contentLayout: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentLayoutLandscape: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: scale(20),
    maxWidth: 980,
  },
  card: {
    padding: scale(30),
    borderRadius: 28,
    backgroundColor: 'rgba(18, 16, 28, 0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(236, 72, 153, 0.25)',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
  },
  cardLandscape: {
    flex: 1.35,
    maxWidth: 560,
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(22),
    justifyContent: 'center',
  },
  topBadgeRow: { alignItems: 'center', marginBottom: verticalScale(12) },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.28)',
  },
  topBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ec4899' },
  topBadgeText: { color: '#f472b6', fontSize: fontSize(10), fontWeight: '800', letterSpacing: 1.5 },
  brandRow: { alignItems: 'center', marginBottom: verticalScale(14) },
  title: { color: '#ffffff', fontSize: fontSize(25), fontWeight: '800', textAlign: 'center', letterSpacing: 0.4 },
  subtitle: {
    color: '#94a3b8',
    fontSize: fontSize(13),
    lineHeight: fontSize(19),
    textAlign: 'center',
    marginTop: verticalScale(6),
    marginBottom: verticalScale(20),
  },
  subtitleLandscape: {
    fontSize: fontSize(11.5),
    lineHeight: fontSize(16),
    marginTop: verticalScale(4),
    marginBottom: verticalScale(12),
  },
  inputsGridLandscape: {
    flexDirection: 'row',
    gap: scale(12),
  },
  inputGroupHalfLandscape: {
    flex: 1,
    marginBottom: verticalScale(10),
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.38)',
    borderWidth: 1,
    borderRadius: 14,
    padding: scale(12),
    marginBottom: verticalScale(14),
  },
  errorIcon: { fontSize: 16 },
  errorText: { color: '#fca5a5', fontSize: fontSize(12.5), flex: 1, fontWeight: '500' },
  inputGroup: { marginBottom: verticalScale(14) },
  fieldLabel: { color: '#cbd5e1', fontSize: fontSize(11), fontWeight: '700', letterSpacing: 1, marginBottom: verticalScale(6) },
  inputWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
  },
  input: {
    color: '#ffffff',
    fontSize: fontSize(15),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
  },
  inputLandscape: {
    fontSize: fontSize(13.5),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(9),
  },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, paddingRight: scale(68) },
  showToggle: { position: 'absolute', right: scale(8), paddingHorizontal: scale(10), paddingVertical: verticalScale(6) },
  showToggleText: { color: '#f472b6', fontSize: fontSize(11), fontWeight: '800', letterSpacing: 1 },
  submitBtn: {
    marginTop: verticalScale(14),
    backgroundColor: '#ec4899',
    borderRadius: 15,
    paddingVertical: verticalScale(15),
    alignItems: 'center',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  submitBtnLandscape: {
    marginTop: verticalScale(6),
    paddingVertical: verticalScale(11),
  },
  submitBtnBusy: { opacity: 0.75 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnText: { color: '#ffffff', fontSize: fontSize(14.5), fontWeight: '800', letterSpacing: 0.8 },
  btnArrow: { color: '#ffffff', fontSize: fontSize(16), fontWeight: '900' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  demoPill: { marginTop: verticalScale(14), paddingVertical: 4, alignItems: 'center' },
  demoHint: { color: '#64748b', fontSize: fontSize(11.5), textAlign: 'center' },
  demoHighlight: { color: '#ec4899', fontWeight: '700' },
  diagnosticsDock: {
    marginTop: verticalScale(22),
    maxWidth: 560,
    width: '100%',
    alignItems: 'center',
  },
  diagnosticsDockLandscape: {
    marginTop: 0,
    flex: 0.85,
    maxWidth: 340,
    padding: scale(20),
    borderRadius: 28,
    backgroundColor: 'rgba(18, 16, 28, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  dockTitle: {
    color: '#64748b',
    fontSize: fontSize(10.5),
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: verticalScale(10),
  },
  dockTitleLandscape: {
    textAlign: 'left',
    color: '#94a3b8',
    marginBottom: verticalScale(12),
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: scale(10) },
  chipColumnLandscape: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    gap: verticalScale(10),
    flex: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    borderRadius: 14,
    paddingVertical: verticalScale(9),
    paddingHorizontal: scale(14),
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    minWidth: scale(150),
  },
  chipLandscape: {
    width: '100%',
    paddingVertical: verticalScale(11),
  },
  chipOk: { borderColor: 'rgba(34, 197, 94, 0.30)', backgroundColor: 'rgba(34, 197, 94, 0.06)' },
  chipWarn: { borderColor: 'rgba(245, 158, 11, 0.30)', backgroundColor: 'rgba(245, 158, 11, 0.06)' },
  chipBeacon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beaconOk: { backgroundColor: 'rgba(34, 197, 94, 0.2)' },
  beaconWarn: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  chipDot: { width: 7, height: 7, borderRadius: 3.5 },
  dotOk: { backgroundColor: '#22c55e' },
  dotWarn: { backgroundColor: '#f59e0b' },
  chipTextCol: { flexShrink: 1 },
  chipLabel: { color: '#f1f5f9', fontSize: fontSize(11), fontWeight: '700' },
  chipValue: { color: '#94a3b8', fontSize: fontSize(11), flexShrink: 1 },
  footer: { color: '#475569', fontSize: fontSize(11), marginTop: verticalScale(22), textAlign: 'center' },
  footerLandscape: { marginTop: verticalScale(12), textAlign: 'left', fontSize: fontSize(10) },
});
