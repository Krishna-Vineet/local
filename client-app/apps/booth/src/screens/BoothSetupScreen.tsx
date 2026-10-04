// BoothSetupScreen — orientation + frame count selection

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBooth } from '../context/BoothProvider';
import { UploadAPI, DeviceAPI, SettingsAPI } from '../../../../packages/api/src/index';
import type { RootStackParamList } from '../../App';

import { AppLogo } from '../components/AppLogo';

type Props = NativeStackScreenProps<RootStackParamList, 'BoothSetup'>;

export const BoothSetupScreen: React.FC<Props> = ({ navigation }) => {
  const { state, send } = useBooth();
  const event = state.context.activeEvent;

  const logoUrl = event?.branding?.logoUrl;
  const logoProxyUrl = logoUrl ? UploadAPI.proxyLogo(logoUrl) : null;
  const primaryColor = event?.branding?.primaryColor || '#7C3AED';

  // Welcomescreen auto-refresh to fetch event updates
  useEffect(() => {
    const timeout = state.context.globalSettings?.boothTimeout || 30;
    const interval = setInterval(async () => {
      try {
        const res = await DeviceAPI.getCurrentEvent();
        if (res.event) {
          let settings = { printPrice: 100, taxRate: 0, boothTimeout: 30 };
          try {
            settings = await SettingsAPI.getPublic(res.event._id);
          } catch (e) {
            console.warn('Failed to load settings:', e);
          }
          send({ type: 'EVENT_LOADED', event: res.event, settings, isAdminAssigned: state.context.isAdminAssigned });
        }
      } catch (e) {
        console.error('Failed to sync event on welcome screen:', e);
      }
    }, timeout * 1000);

    return () => clearInterval(interval);
  }, [state.context.globalSettings?.boothTimeout, state.context.isAdminAssigned]);

  return (
    <View style={styles.container}>
      {logoProxyUrl ? (
        <Image source={{ uri: logoProxyUrl }} style={styles.logo} resizeMode="contain" />
      ) : (
        <View style={styles.logoContainer}>
          <AppLogo width={160} height={140} forceDark />
        </View>
      )}
      {!logoProxyUrl && <Text style={styles.welcome}>Welcome!</Text>}
      <Text style={styles.event}>{event?.name ?? (logoProxyUrl ? 'Happypix Booth' : '')}</Text>
      <Text style={styles.location}>{event?.location}</Text>

      <TouchableOpacity
        style={[styles.startBtn, { backgroundColor: primaryColor, shadowColor: primaryColor }]}
        onPress={() => {
          send({ type: 'START_SESSION' });
          navigation.replace('SlotSelection');
        }}
      >
        <Text style={styles.startText}>TAP TO START</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  logo: { width: 180, height: 80, marginBottom: 12 },
  logoContainer: { marginBottom: 12 },
  welcome: { fontSize: 16, color: '#71717a', fontWeight: '600', marginBottom: 4 },
  event: { fontSize: 32, fontWeight: '900', color: '#09090b', textAlign: 'center' },
  location: { fontSize: 14, color: '#71717a', marginTop: 4, marginBottom: 32 },
  startBtn: {
    paddingVertical: 18, paddingHorizontal: 48,
    borderRadius: 100,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  startText: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 4 },
});
