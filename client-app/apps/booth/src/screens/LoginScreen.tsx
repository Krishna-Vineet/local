import React, { useState } from 'react';
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isDemoMode } from '@happypix/api';
import { useBooth } from '../context/BoothProvider';
import { AppLogo } from '../components/AppLogo';
import {
  fontSize,
  moderateScale,
  scale,
  verticalScale,
} from '../../../../packages/ui/src/index';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login, bootError } = useBooth();
  const demo = isDemoMode();

  const [email, setEmail] = useState(demo ? 'booth@happypix.in' : '');
  const [password, setPassword] = useState(demo ? 'demo123' : '');
  const [locationLabel, setLocationLabel] = useState('Main Reception Booth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(bootError);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { isLive } = await login({
        email: email.trim(),
        password,
        locationLabel: locationLabel.trim() || 'Tablet Booth',
      });

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
        <View style={styles.formCard}>
          <View style={styles.logoContainer}>
            <AppLogo width={140} height={120} forceDark />
          </View>
          <Text style={styles.badge}>BOOTH PAIRING</Text>
          <Text style={styles.subTitle}>
            Connect this tablet securely to your HappyPix organization
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>EMAIL ADDRESS</Text>
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

          <Text style={styles.label}>PASSWORD</Text>
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

          <Text style={styles.label}>BOOTH LOCATION LABEL</Text>
          <TextInput
            style={styles.input}
            value={locationLabel}
            onChangeText={setLocationLabel}
            placeholder="Main reception, Hall A, Stage…"
            placeholderTextColor="#52525b"
            autoCapitalize="words"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>Pair Booth Device →</Text>
            )}
          </TouchableOpacity>

          {demo && (
            <View style={styles.demoNote}>
              <Text style={styles.demoTitle}>Demo Build Active</Text>
              <Text style={styles.demoText}>booth@happypix.in  •  demo123</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(24),
  },
  formCard: {
    backgroundColor: '#121217',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#22222a',
    paddingVertical: verticalScale(28),
    paddingHorizontal: scale(32),
    width: '100%',
    maxWidth: 440,
    elevation: 8,
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  badge: {
    fontSize: fontSize(10),
    fontWeight: '800',
    color: '#8b5cf6',
    letterSpacing: 2,
    marginBottom: 4,
    textAlign: 'center',
  },
  subTitle: {
    fontSize: fontSize(13),
    color: '#71717a',
    lineHeight: 18,
    marginBottom: verticalScale(20),
    textAlign: 'center',
  },
  label: {
    fontSize: fontSize(10),
    fontWeight: '700',
    color: '#a1a1aa',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: fontSize(12),
    textAlign: 'center',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#18181f',
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: '#27272a',
    color: '#ffffff',
    padding: scale(14),
    fontSize: fontSize(15),
    marginBottom: verticalScale(16),
  },
  submitBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(16),
    alignItems: 'center',
    marginTop: verticalScale(8),
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  demoNote: {
    marginTop: verticalScale(18),
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    alignItems: 'center',
  },
  demoTitle: {
    color: '#a78bfa',
    fontSize: fontSize(11),
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  demoText: {
    color: '#e4e4e7',
    fontSize: fontSize(12),
  },
});
