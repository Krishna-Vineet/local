import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Dimensions, ScrollView
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthAPI, setAuthToken } from '../../../../packages/api/src/index';
import type { RootStackParamList } from '../../App';

import { AppLogo } from '../components/AppLogo';
import { useBooth } from '../context/BoothProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { state } = useBooth();

  // Extract human-readable error from API error format if present
  let displayError = state.context.error;
  if (displayError && displayError.includes('failed [')) {
    try {
      const jsonPart = displayError.substring(displayError.indexOf('{'));
      const parsed = JSON.parse(jsonPart);
      if (parsed.error) displayError = parsed.error;
    } catch (e) {
      // Keep original if parsing fails
    }
  }

  // Auto-login if token exists
  useEffect(() => {
    const checkToken = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('hp_auth_token');
        if (savedToken) {
          setAuthToken(savedToken);
          navigation.replace('ClientEvents');
        }
      } catch (e) {
        console.warn('Failed to retrieve token:', e);
      }
    };
    checkToken();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthAPI.login(email.trim(), password);
      // Save token to AsyncStorage
      await AsyncStorage.setItem('hp_auth_token', res.token);
      await AsyncStorage.setItem('hp_auth_user', JSON.stringify(res.user));
      // Update global API wrapper configuration
      setAuthToken(res.token);

      navigation.replace('ClientEvents');
    } catch (err: any) {
      console.error('Login error:', err);
      Alert.alert('Login Failed', 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.scrollContainer}>
        <View style={styles.formCard}>
          <View style={styles.logoContainer}>
            <AppLogo width={140} height={120} forceDark />
          </View>
          <Text style={styles.badge}>CLIENT ACCESS</Text>
          <Text style={styles.subTitle}>Log in to configure this photo booth device</Text>

          {displayError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          )}

          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="name@happypix.com"
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

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>Verify Credentials →</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
    padding: 24,
  },
  formCard: {
    backgroundColor: '#121217',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#22222a',
    paddingVertical: 20,
    paddingHorizontal: 32,
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
    marginBottom: 12,
  },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8b5cf6',
    letterSpacing: 2,
    marginBottom: 4,
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 13,
    color: '#71717a',
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a1a1aa',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#18181f',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#27272a',
    color: '#ffffff',
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
