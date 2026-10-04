import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenContainer,
  LayoutContainer,
  GlassCard,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { useBooth } from '../context/BoothProvider';
import { UploadAPI } from '../../../../packages/api/src/index';
import { renderEngine, printerManager } from '../../../../packages/printer-core/src/index';
import SoundManager from '../utils/SoundManager';
import { InactivityToast } from '../components/InactivityToast';

import { AppLogo } from '../components/AppLogo';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderSuccess'>;

export const OrderSuccessScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useAppTheme();
  const { state, send } = useBooth();
  const [countdown, setCountdown] = useState(60);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const rawSharing = (state?.context as any)?.activeEvent?.sharingConfig;
  const userIncludeQR = (route?.params as any)?.includeQR !== false;
  const sharingConfig = useMemo(() => ({
    enabled: userIncludeQR && (rawSharing?.enabled ?? true),
    qr: { enabled: rawSharing?.qr?.enabled ?? true },
    whatsapp: { enabled: rawSharing?.whatsapp?.enabled ?? true },
    email: { enabled: rawSharing?.email?.enabled ?? true },
    sms: { enabled: rawSharing?.sms?.enabled ?? true },
    expirationDays: rawSharing?.expirationDays ?? 7,
    nativeShare: { enabled: rawSharing?.nativeShare?.enabled ?? true },
    copyLink: { enabled: rawSharing?.copyLink?.enabled ?? true },
  }), [rawSharing, userIncludeQR]);

  const [contactInput, setContactInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'whatsapp' | 'email' | 'sms'>('qr');
  
  const [isRetryingPrint, setIsRetryingPrint] = useState(false);
  const [isRetryingShare, setIsRetryingShare] = useState(false);

  const [printErrorState, setPrintErrorState] = useState<string | null>((route?.params as any)?.printError || null);
  const [isPrinted, setIsPrinted] = useState<boolean>((route?.params as any)?.printed !== false);
  const [localShareToken, setLocalShareToken] = useState<string | null>((route?.params as any)?.shareToken || null);

  /* ==========================================================
     MEMOIZED DOWNLOAD URL
  ========================================================== */
  const resolvedDownloadUrl = useMemo(() => {
    const params = route?.params || {};
    const { qrUrl, url, downloadUrl: paramDownloadUrl } = params as any;

    const apiUrl = (state?.context as any)?.settings?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'https://happypix.vercel.app';
    const baseUrl = apiUrl.replace(/\/api\/?$/, ''); // Strip trailing /api if present

    if (localShareToken && localShareToken.trim().length > 0) {
      return `${baseUrl}/share/${localShareToken.trim()}`;
    }

    const directUrl = qrUrl || paramDownloadUrl || url || (state?.context as any)?.qrUrl || (state?.context as any)?.downloadUrl;
    if (directUrl && typeof directUrl === 'string' && directUrl.trim().length > 0) {
      return directUrl.trim();
    }

    return null;
  }, [localShareToken, state?.context, route?.params]); 

  const qrSize = isLandscape
    ? Math.max(120, Math.min(height * 0.28, 200))
    : Math.max(140, Math.min(width * 0.40, 200));

  useEffect(() => {
    try {
      if (!printErrorState) {
        SoundManager.play('success');
        SoundManager.haptic([20, 100, 20]);
      }
    } catch (e) {
      console.error('[OrderSuccessScreen] Error:', e);
    }

    const timer = setInterval(() => {
      setCountdown(c => (c <= 1 ? 0 : c - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [printErrorState]);

  useEffect(() => {
    if (countdown === 0) {
      handleReset();
    }
  }, [countdown]);

  useEffect(() => {
    if (sharingConfig?.qr?.enabled) {
      setActiveTab('qr');
    } else if (sharingConfig?.whatsapp?.enabled) {
      setActiveTab('whatsapp');
    } else if (sharingConfig?.email?.enabled) {
      setActiveTab('email');
    } else if (sharingConfig?.sms?.enabled) {
      setActiveTab('sms');
    }
  }, [sharingConfig]);

  const handleReset = () => {
    try { send({ type: 'RESET' }); } catch (e) { console.error('[OrderSuccessScreen] Reset error:', e); }
    navigation.replace('Start');
  };

  /* ==========================================================
     HANDLERS
  ========================================================== */
  const handleSend = async (method: string) => {
    if (!contactInput.trim()) {
      Alert.alert('Error', 'Please enter a valid destination.');
      return;
    }
    if (!localShareToken) {
      Alert.alert('Error', 'No share token available.');
      return;
    }

    setSending(true);
    setCountdown(60);
    
    try {
      const apiUrl = (state?.context as any)?.settings?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';
      const cleanApiUrl = apiUrl.replace(/\/+$/, '');
      const baseUrl = cleanApiUrl.endsWith('/api') ? cleanApiUrl : `${cleanApiUrl}/api`;
      const res = await fetch(`${baseUrl}/share/deliver/${localShareToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, destination: contactInput.trim() })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        Alert.alert('Success', 'Sent successfully! 🎉');
        setContactInput('');
      } else {
        Alert.alert('Notice', data.error || 'Failed to send.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Network error while sending.');
    } finally {
      setSending(false);
    }
  };

  const handleRetryPrint = async () => {
    const printPayload = (route?.params as any)?.printPayload;
    if (!printPayload) {
      Alert.alert('Error', 'Print data is missing. Please restart session.');
      return;
    }
    
    setIsRetryingPrint(true);
    setCountdown(60); 
    try {
      const composedResult = await renderEngine.compose(printPayload);
      await printerManager.print(composedResult);
      setIsPrinted(true);
      setPrintErrorState(null);
      try {
        SoundManager.play('success');
        SoundManager.haptic([20, 100, 20]);
      } catch (e) {
        console.error('[OrderSuccessScreen] Action error:', e);
      }
    } catch (err: any) {
      console.warn('[OrderSuccess] Retry print failed:', err);
      Alert.alert('Print Failed', 'The printer is still offline or disconnected.');
    } finally {
      setIsRetryingPrint(false);
    }
  };

  const handleRetryShare = async () => {
    const eventId = (route?.params as any)?.eventId;
    if (!eventId) {
      Alert.alert('Error', 'Event ID is missing.');
      return;
    }
    
    setIsRetryingShare(true);
    setCountdown(60);
    try {
      const tokenRes = await UploadAPI.generateShareToken(eventId);
      setLocalShareToken(tokenRes.token);
    } catch (err: any) {
      console.warn('[OrderSuccess] Retry share failed:', err);
      Alert.alert('Network Error', 'Still unable to connect to the server.');
    } finally {
      setIsRetryingShare(false);
    }
  };

  return (
    <ScreenContainer>
      <LayoutContainer
        contentContainerStyle={[
          styles.layout,
          isLandscape ? styles.layoutLandscape : styles.layoutPortrait,
        ] as any}
      >
        {/* HEADER */}
        <View style={styles.header}>
                    <AppLogo width={60} height={45} />

          <View style={styles.headerSide} />
          <View style={[styles.timerPill, { backgroundColor: theme.colors.primary + '20' }]}>
            <Text style={[styles.timerText, { color: theme.colors.primary }]}>
              RESETS IN {countdown}S
            </Text>
          </View>
        </View>

        {/* MAIN ROW */}
        <View style={[styles.mainRow, { flexDirection: isLandscape ? 'row' : 'column' }]}>
          
          {/* LEFT PANEL: PRINT STATUS */}
          <View style={styles.statusCol}>
            {printErrorState ? (
              <>
                <View style={[styles.successRing, { borderColor: theme.colors.error }]}>
                  <Text style={[styles.successIcon, { color: theme.colors.error }]}>✕</Text>
                </View>
                <Text style={[styles.title, { color: theme.colors.text, fontSize: fontSize(28) }]}>
                  PRINTING FAILED
                </Text>
                <Text style={[styles.subTitle, { color: theme.colors.textSecondary, marginBottom: verticalScale(20) }]}>
                  {printErrorState}
                </Text>
                
                {(route?.params as any)?.printPayload && (
                  <TouchableOpacity 
                    style={[styles.retryBtn, { backgroundColor: theme.colors.error }]} 
                    onPress={handleRetryPrint}
                    disabled={isRetryingPrint}
                  >
                    {isRetryingPrint ? <ActivityIndicator color="#fff" /> : <Text style={styles.retryBtnText}>RETRY PRINT</Text>}
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <View style={[styles.successRing, { borderColor: theme.colors.success }]}>
                  <Text style={[styles.successIcon, { color: theme.colors.success }]}>✓</Text>
                </View>
                <Text style={[styles.title, { color: theme.colors.text }]}>SUCCESS!</Text>
                <Text style={[styles.subTitle, { color: theme.colors.textSecondary }]}>
                  {isPrinted ? 'YOUR PHOTOS ARE PRINTING NOW' : 'YOUR DIGITAL PHOTOS ARE READY'}
                </Text>
              </>
            )}
          </View>

          {/* RIGHT PANEL: SHARING OPTIONS */}
          {sharingConfig?.enabled && (
            <View style={styles.shareCol}>
              {localShareToken ? (
                <GlassCard style={styles.qrCard}>
                  {/* TABS */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(8), marginBottom: verticalScale(15), justifyContent: 'center' }}>
                    {sharingConfig?.qr?.enabled && (
                      <TouchableOpacity onPress={() => setActiveTab('qr')} style={[styles.tabBtn, { borderColor: theme.colors.border }, activeTab === 'qr' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
                        <Text style={[styles.tabText, { color: activeTab === 'qr' ? '#fff' : theme.colors.textSecondary }]}>QR Code</Text>
                      </TouchableOpacity>
                    )}
                    {sharingConfig?.whatsapp?.enabled && (
                      <TouchableOpacity onPress={() => setActiveTab('whatsapp')} style={[styles.tabBtn, { borderColor: theme.colors.border }, activeTab === 'whatsapp' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
                        <Text style={[styles.tabText, { color: activeTab === 'whatsapp' ? '#fff' : theme.colors.textSecondary }]}>WhatsApp</Text>
                      </TouchableOpacity>
                    )}
                    {sharingConfig?.email?.enabled && (
                      <TouchableOpacity onPress={() => setActiveTab('email')} style={[styles.tabBtn, { borderColor: theme.colors.border }, activeTab === 'email' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
                        <Text style={[styles.tabText, { color: activeTab === 'email' ? '#fff' : theme.colors.textSecondary }]}>Email</Text>
                      </TouchableOpacity>
                    )}
                    {sharingConfig?.sms?.enabled && (
                      <TouchableOpacity onPress={() => setActiveTab('sms')} style={[styles.tabBtn, { borderColor: theme.colors.border }, activeTab === 'sms' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
                        <Text style={[styles.tabText, { color: activeTab === 'sms' ? '#fff' : theme.colors.textSecondary }]}>SMS</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* TAB CONTENT */}
                  {resolvedDownloadUrl ? (
                    activeTab === 'qr' ? (
                      <View style={{ alignItems: 'center' }}>
                        <Text style={[styles.qrLabel, { color: theme.colors.textSecondary }]}>
                          SCAN FOR DIGITAL COPIES
                        </Text>
                        <View style={styles.qrBox}>
                          <QRCode
                            value={resolvedDownloadUrl}
                            size={qrSize}
                            backgroundColor="#fff"
                            color="#000"
                          />
                        </View>
                        <Text style={[styles.qrHint, { color: theme.colors.primary }]}>
                          AVAILABLE FOR {sharingConfig?.expirationDays || 7} DAYS
                        </Text>
                      </View>
                    ) : activeTab === 'whatsapp' || activeTab === 'email' || activeTab === 'sms' ? (
                      <View style={{ width: qrSize, alignItems: 'center', justifyContent: 'center', minHeight: qrSize }}>
                        <Text style={[styles.qrLabel, { color: theme.colors.textSecondary, marginBottom: verticalScale(15) }]}>
                          SEND VIA {activeTab.toUpperCase()}
                        </Text>
                        <TextInput
                          style={[styles.inputField, { borderColor: theme.colors.border, color: theme.colors.text }]}
                          placeholder={activeTab === 'email' ? 'Enter Email Address' : 'Enter Phone Number'}
                          placeholderTextColor={theme.colors.textSecondary}
                          value={contactInput}
                          onChangeText={setContactInput}
                          keyboardType={activeTab === 'email' ? 'email-address' : 'phone-pad'}
                          onFocus={() => setCountdown(60)} 
                        />
                        <TouchableOpacity
                          style={[styles.sendBtn, { backgroundColor: theme.colors.primary }]}
                          onPress={() => handleSend(activeTab.toUpperCase())}
                          disabled={sending}
                        >
                          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>SEND</Text>}
                        </TouchableOpacity>
                      </View>
                    ) : null
                  ) : null}
                </GlassCard>
              ) : (
                <GlassCard style={styles.qrCard}>
                  <Text style={[styles.qrLabel, { color: theme.colors.textSecondary }]}>
                    DIGITAL SHARING OFFLINE
                  </Text>
                  <Text style={[styles.offlineText, { color: theme.colors.textSecondary }]}>
                    Could not connect to the cloud. Please check network.
                  </Text>
                  <TouchableOpacity 
                    style={[styles.retryBtn, { backgroundColor: theme.colors.primary, marginTop: verticalScale(20) }]} 
                    onPress={handleRetryShare}
                    disabled={isRetryingShare}
                  >
                    {isRetryingShare ? <ActivityIndicator color="#fff" /> : <Text style={styles.retryBtnText}>RETRY SHARING</Text>}
                  </TouchableOpacity>
                </GlassCard>
              )}
            </View>
          )}

        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.homeBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleReset}
          >
            <Text style={styles.homeBtnText}>START NEW SESSION</Text>
          </TouchableOpacity>
        </View>
        {/* INACTIVITY WARNING */}
        <InactivityToast visible={countdown <= 10} />

      </LayoutContainer>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  layout: {
    flex: 1,
    justifyContent: 'space-between',
    width: '100%',
  },
  layoutLandscape: {
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(20),
    paddingHorizontal: scale(40),
  },
  layoutPortrait: {
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(24),
    paddingLeft: scale(28),
    paddingRight: scale(28),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    minHeight: verticalScale(44),
  },
  headerSide: { flex: 1 },
  timerPill: {
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(20),
    borderRadius: moderateScale(20),
  },
  timerText: {
    fontSize: fontSize(12),
    fontWeight: '900',
    letterSpacing: 1,
  },
  mainRow: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(30),
  },
  statusCol: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareCol: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  successRing: {
    width: scale(70),
    height: scale(70),
    borderRadius: scale(35),
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  successIcon: {
    fontSize: fontSize(36),
    fontWeight: '900',
  },
  title: {
    fontSize: fontSize(42),
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  subTitle: {
    fontSize: fontSize(12),
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: verticalScale(10),
    textAlign: 'center',
  },
  qrCard: {
    padding: moderateScale(24),
    alignItems: 'center',
    width: '100%',
    maxWidth: scale(320),
  },
  qrLabel: {
    fontSize: fontSize(10),
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: verticalScale(14),
    textAlign: 'center',
  },
  qrBox: {
    padding: scale(10),
    backgroundColor: '#fff',
    borderRadius: scale(12),
  },
  qrHint: {
    fontSize: fontSize(9),
    fontWeight: '900',
    marginTop: verticalScale(14),
    letterSpacing: 1,
    textAlign: 'center',
  },
  offlineText: {
    fontSize: fontSize(13),
    marginTop: verticalScale(10),
    fontStyle: 'italic',
    textAlign: 'center',
  },
  tabBtn: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(15),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  tabText: {
    fontSize: fontSize(11),
    fontWeight: 'bold',
    color: '#fff',
  },
  inputField: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    fontSize: fontSize(12),
    marginBottom: verticalScale(12),
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sendBtn: {
    width: '100%',
    paddingVertical: verticalScale(12),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: fontSize(12),
  },
  retryBtn: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(24),
    borderRadius: moderateScale(15),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: fontSize(11),
    letterSpacing: 1,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: verticalScale(8),
  },
  homeBtn: {
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(50),
    borderRadius: moderateScale(20),
    elevation: 8,
  },
  homeBtnText: {
    fontSize: fontSize(14),
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
});