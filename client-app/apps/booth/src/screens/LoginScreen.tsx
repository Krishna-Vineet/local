import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { cameraManager } from '../../../../packages/camera-core/src/index';
import { printerManager } from '../../../../packages/printer-core/src/index';
import {
  Button,
  Card,
  Eyebrow,
  Icon,
  Pill,
  fonts,
  fontSize,
  moderateScale,
  scale,
  useAppTheme,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { AppLogo } from '../components/AppLogo';
import { useBooth } from '../context/BoothProvider';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

/**
 * Pairing screen, rebuilt to Electron's login (`ConnectionScreens.tsx` +
 * `.login-screen` / `.login-story` / `.login-panel`):
 *
 *   ┌────────────────────────────┬──────────────────────────┐
 *   │  dark story panel          │  form card               │
 *   │  brand + headline + film   │  email / password / loc  │
 *   │                            │  hardware telemetry      │
 *   └────────────────────────────┴──────────────────────────┘
 *
 * The telemetry block did not exist on the desktop kiosk; it was carried over
 * from this app because an operator standing at a dead booth needs to know
 * whether the camera and printer were found *before* typing a password. The
 * Electron side now has the same panel (see electron/src/ui/screens/
 * ConnectionScreens.tsx) — keep the two in step.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
type CheckStatus = 'checking' | 'ok' | 'warn';

interface Telemetry {
  camera: { status: CheckStatus; value: string };
  printer: { status: CheckStatus; value: string };
  network: { status: CheckStatus; value: string };
}

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const p = theme.palette;
  const { login, bootError } = useBooth();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [locationLabel, setLocationLabel] = useState('Main reception');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(bootError);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    camera: { status: 'checking', value: 'Checking camera…' },
    printer: { status: 'checking', value: 'Checking printer…' },
    network: { status: 'ok', value: 'Online' },
  });

  useEffect(() => {
    let mounted = true;

    const probe = async () => {
      try {
        const type = await cameraManager.autoSelect();
        if (!mounted) return;
        setTelemetry((prev) => ({
          ...prev,
          camera: { status: 'ok', value: type ? `${type.toUpperCase()} camera` : 'Tablet camera' },
        }));
      } catch {
        if (!mounted) return;
        setTelemetry((prev) => ({ ...prev, camera: { status: 'warn', value: 'No camera found' } }));
      }

      try {
        const devices = await printerManager.discover();
        if (!mounted) return;
        if (devices.length) {
          await printerManager.connect(devices[0]).catch(() => undefined);
          setTelemetry((prev) => ({
            ...prev,
            printer: { status: 'ok', value: devices[0].name || 'Dye-sub printer' },
          }));
        } else {
          setTelemetry((prev) => ({ ...prev, printer: { status: 'warn', value: 'No printer found' } }));
        }
      } catch {
        if (!mounted) return;
        setTelemetry((prev) => ({ ...prev, printer: { status: 'warn', value: 'Printer unreachable' } }));
      }
    };

    void probe();
    return () => {
      mounted = false;
    };
  }, []);

  const onPair = async () => {
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
      navigation.replace(isLive ? 'Start' : 'Waiting');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check the credentials.');
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(
    () => [
      { key: 'camera', icon: 'camera' as const, label: 'Camera', ...telemetry.camera },
      { key: 'printer', icon: 'printer' as const, label: 'Photo printer', ...telemetry.printer },
      { key: 'network', icon: 'wifi' as const, label: 'Cloud network', ...telemetry.network },
    ],
    [telemetry]
  );

  const tone = (status: CheckStatus) =>
    status === 'ok' ? { color: p.green, bg: p.greenSoft } : status === 'warn' ? { color: p.amber, bg: p.amberSoft } : { color: p.muted, bg: p.surfaceMuted };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // No top inset: the window is edge-to-edge (see `useEdgeToEdge` in
      // App.tsx), so a top pad here only re-introduced the strip above the UI.
      style={[styles.root, { backgroundColor: p.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, isLandscape ? styles.scrollLandscape : null]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.split, isLandscape ? styles.splitLandscape : null]}>
          {isLandscape ? (
            <View style={[styles.story, { backgroundColor: p.night }]}>
              <View pointerEvents="none" style={[styles.storyGlow, { backgroundColor: p.pink }]} />
              <View pointerEvents="none" style={[styles.storyGlowB, { backgroundColor: p.violet }]} />
              <View style={styles.storyBrand}>
                <AppLogo width={scale(120)} height={scale(112)} forceDark />
              </View>
              <View style={styles.storyCopy}>
                <Text style={[styles.storyEyebrow, { color: '#f4a4ca' }]}>THE HAPPYPIX EXPERIENCE</Text>
                <Text style={styles.storyTitle}>
                  Little moments.{'\n'}
                  <Text style={{ color: '#fa7cb6' }}>Beautifully kept.</Text>
                </Text>
                <Text style={styles.storyBody}>
                  Pair this kiosk securely, then let every guest make something worth taking home.
                </Text>
              </View>
              <View style={styles.filmStrip} pointerEvents="none">
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={styles.filmCell} />
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.panel}>
            <View style={styles.form}>
              <View style={styles.mark}>
                <Icon name="sparkles" size={fontSize(18)} color={p.pinkDeep} />
                <Text style={[styles.markText, { color: p.pinkDeep }]}>BOOTH PAIRING</Text>
              </View>
              <Text style={[styles.title, { color: p.ink }]}>Connect this booth</Text>
              <Text style={[styles.sub, { color: p.muted }]}>
                Use an active organisation account. A fresh installation ID is paired securely and kept until
                you remove it in the CRM.
              </Text>

              {error ? (
                <View style={[styles.error, { borderColor: '#f4cbd2', backgroundColor: p.redSoft }]}>
                  <Icon name="info" size={fontSize(16)} color="#a9364a" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={[styles.label, { color: '#655570' }]}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="admin@organisation.com"
                placeholderTextColor={p.faint}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { borderColor: p.line, backgroundColor: p.surfaceSoft, color: p.ink }]}
                accessibilityLabel="Email address"
              />

              <Text style={[styles.label, { color: '#655570' }]}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••••"
                  placeholderTextColor={p.faint}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { borderColor: p.line, backgroundColor: p.surfaceSoft, color: p.ink },
                  ]}
                  accessibilityLabel="Password"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.showToggle}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={[styles.showToggleText, { color: p.violet }]}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
                </Pressable>
              </View>

              <Text style={[styles.label, { color: '#655570' }]}>Booth location</Text>
              <TextInput
                value={locationLabel}
                onChangeText={setLocationLabel}
                placeholder="Main reception, Hall A…"
                placeholderTextColor={p.faint}
                autoCapitalize="words"
                style={[styles.input, { borderColor: p.line, backgroundColor: p.surfaceSoft, color: p.ink }]}
                accessibilityLabel="Booth location"
              />

              <Button
                label={loading ? 'Pairing booth…' : 'Pair & continue'}
                iconRight="arrow-right"
                loading={loading}
                onPress={onPair}
                fullWidth
                style={{ marginTop: verticalScale(14) }}
                testID="login-pair"
              />
            </View>

            {/* hardware readiness — the same information the iPad/Android build shows */}
            <Card style={styles.telemetry} tone="soft" elevation="soft">
              <View style={styles.telemetryHead}>
                <Eyebrow color={p.pinkDeep}>Hardware readiness</Eyebrow>
                <Pill
                  label={
                    rows.every((r) => r.status === 'ok')
                      ? 'All ready'
                      : rows.some((r) => r.status === 'checking')
                      ? 'Checking'
                      : 'Needs a look'
                  }
                  tone={rows.every((r) => r.status === 'ok') ? 'success' : 'amber'}
                />
              </View>
              {rows.map((row) => {
                const t = tone(row.status as CheckStatus);
                return (
                  <View key={row.key} style={styles.telemetryRow}>
                    <View style={[styles.telemetryIcon, { backgroundColor: t.bg }]}>
                      <Icon name={row.icon} size={fontSize(15)} color={t.color} />
                    </View>
                    <Text style={[styles.telemetryLabel, { color: p.ink }]}>{row.label}</Text>
                    <Text style={[styles.telemetryValue, { color: t.color }]} numberOfLines={1}>
                      {row.value}
                    </Text>
                  </View>
                );
              })}
              <Text style={[styles.telemetryFoot, { color: p.faint }]}>
                HappyPix Engine · {Math.round(width)}×{Math.round(height)} pts ·{' '}
                {Platform.OS === 'ios' ? 'iPadOS' : 'Android'}
              </Text>
            </Card>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, padding: scale(20) },
  scrollLandscape: { padding: 0 },
  split: { flex: 1, justifyContent: 'center' },
  splitLandscape: { flexDirection: 'row' },

  story: {
    flex: 1.06,
    overflow: 'hidden',
    padding: scale(44),
    justifyContent: 'space-between',
    minHeight: verticalScale(560),
  },
  storyGlow: { position: 'absolute', width: scale(420), height: scale(420), borderRadius: scale(210), opacity: 0.22, top: -scale(120), left: -scale(80) },
  storyGlowB: { position: 'absolute', width: scale(320), height: scale(320), borderRadius: scale(160), opacity: 0.18, bottom: -scale(90), right: -scale(60) },
  storyBrand: { marginTop: verticalScale(8) },
  storyCopy: { maxWidth: scale(460) },
  storyEyebrow: { fontFamily: fonts.bodyBlack, fontSize: fontSize(11), letterSpacing: 2 },
  storyTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize(46),
    lineHeight: Math.round(fontSize(46) * 0.98),
    color: '#ffffff',
    letterSpacing: -1.4,
    marginTop: verticalScale(14),
  },
  storyBody: {
    fontFamily: fonts.body,
    fontSize: fontSize(15),
    lineHeight: fontSize(22),
    color: '#cdbed4',
    marginTop: verticalScale(14),
  },
  filmStrip: {
    flexDirection: 'row',
    gap: scale(10),
    height: verticalScale(110),
    marginTop: verticalScale(20),
    transform: [{ rotate: '-6deg' }],
  },
  filmCell: {
    flex: 1,
    borderRadius: moderateScale(3),
    backgroundColor: '#8b3c67',
    opacity: 0.6,
  },

  panel: { flex: 1, padding: scale(28), justifyContent: 'center', gap: verticalScale(14) },
  form: { width: '100%', maxWidth: scale(470), alignSelf: 'center' },
  mark: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  markText: { fontFamily: fonts.bodyBlack, fontSize: fontSize(11), letterSpacing: 1.8 },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize(36),
    lineHeight: Math.round(fontSize(36) * 1.05),
    letterSpacing: -0.8,
    marginTop: verticalScale(10),
  },
  sub: { fontFamily: fonts.body, fontSize: fontSize(13), lineHeight: fontSize(19), marginTop: verticalScale(6), marginBottom: verticalScale(6) },

  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(8),
    borderWidth: 1,
    borderRadius: moderateScale(11),
    padding: scale(10),
    marginBottom: verticalScale(6),
  },
  errorText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: fontSize(12), color: '#a9364a' },

  label: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(12), marginTop: verticalScale(10), marginBottom: verticalScale(6) },
  input: {
    height: verticalScale(52),
    borderWidth: 1,
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(15),
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize(14),
  },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: scale(78) },
  showToggle: { position: 'absolute', right: scale(12), paddingVertical: verticalScale(6) },
  showToggleText: { fontFamily: fonts.bodyBlack, fontSize: fontSize(10), letterSpacing: 1 },

  telemetry: {
    width: '100%',
    maxWidth: scale(470),
    alignSelf: 'center',
    padding: scale(16),
    borderRadius: moderateScale(18),
    gap: verticalScale(9),
  },
  telemetryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  telemetryRow: { flexDirection: 'row', alignItems: 'center', gap: scale(9) },
  telemetryIcon: {
    width: scale(30),
    height: scale(30),
    borderRadius: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  telemetryLabel: { flex: 1, fontFamily: fonts.bodyBold, fontSize: fontSize(12) },
  telemetryValue: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(11), maxWidth: '46%' },
  telemetryFoot: { fontFamily: fonts.body, fontSize: fontSize(9), marginTop: verticalScale(2) },
});

export default LoginScreen;
