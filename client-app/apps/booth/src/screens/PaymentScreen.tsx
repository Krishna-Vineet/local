import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PaymentAPI, CouponAPI } from '../../../../packages/api/src/index';
import { useBooth } from '../context/BoothProvider';
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
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

export const PaymentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { state, send } = useBooth();
  const { theme } = useAppTheme();
  const { params } = route as any;

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const { prints, includeQR } = params;
  const { activeEvent } = state.context;

  const [loading, setLoading] = useState(false);
  const [qrGenerated, setQrGenerated] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isImageUrl, setIsImageUrl] = useState<boolean>(true);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Coupon State
  const [couponInput, setCouponInput] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    value: number;
    discountType: 'percentage' | 'fixed';
  } | null>(null);

  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const activePaymentId = useRef<string | null>(null);
  const isInitializing = useRef(false);

  const getBasePrice = () => {
    if (typeof params?.unitPrice === 'number' && params.unitPrice >= 0) {
      return params.unitPrice;
    }
    const activeTemplate = state.context.selectedTemplate;
    const templateId = params?.templateId || activeTemplate?.id;
    let specificPrice: number | null | undefined = undefined;
    switch (templateId) {
      case 'cut-1': specificPrice = activeEvent?.gridPrices?.cut1; break;
      case 'cut-2': specificPrice = activeEvent?.gridPrices?.cut2; break;
      case 'cut-4': specificPrice = activeEvent?.gridPrices?.cut4; break;
      case 'cut-6': specificPrice = activeEvent?.gridPrices?.cut6Vertical; break;
      case 'cut-6-h': specificPrice = activeEvent?.gridPrices?.cut6Horizontal; break;
    }
    if (specificPrice != null) return specificPrice;
    if (state.context.globalSettings?.printPrice != null) return state.context.globalSettings.printPrice;
    return 100;
  };

  const baseTotal = prints * getBasePrice();

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discountType === 'percentage') {
      return (baseTotal * appliedCoupon.value) / 100;
    }
    return appliedCoupon.value;
  }, [baseTotal, appliedCoupon]);

  const finalTotal = Math.max(0, baseTotal - discountAmount);

  const qrSize = isLandscape
    ? Math.max(180, Math.min(height * 0.42, 320))
    : Math.max(180, Math.min(width * 0.62, 320));

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const proceedToCapture = (paymentToken: string = '', amountPaidOverride?: number) => {
    navigation.replace('Capture' as any, {
      ...params,
      paymentToken,
      amountPaid: amountPaidOverride !== undefined ? amountPaidOverride : finalTotal,
    });
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const startPolling = (paymentId: string) => {
    activePaymentId.current = paymentId;
    stopPolling();
    pollingInterval.current = setInterval(async () => {
      try {
        const res = await PaymentAPI.checkStatus(paymentId);
        if (res.status === 'paid') {
          stopPolling();
          setPaymentSuccess(true);
          send({ type: 'PAYMENT_SUCCESS', token: '' });
          setTimeout(() => proceedToCapture(''), 1500);
        } else if (res.status === 'failed') {
          stopPolling();
          setPaymentFailed(true);
        }
      } catch (err) {
        console.log('Polling error', err);
      }
    }, 3000);
  };

  const validateCoupon = async () => {
    if (!couponInput.trim() || !activeEvent?._id) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const res = await CouponAPI.validate(couponInput.trim(), activeEvent._id);
      if (res.valid && res.coupon) {
        setAppliedCoupon({
          code: res.coupon.code,
          value: res.coupon.value,
          discountType: res.coupon.discountType,
        });
        setCouponInput('');
      } else {
        setCouponError(res.error || 'Invalid coupon code');
      }
    } catch (err: any) {
      setCouponError(err.message || 'Failed to validate coupon');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  const initializePayment = async () => {
    if (!activeEvent || isInitializing.current) return;
    isInitializing.current = true;
    
    setQrGenerated(true);
    setLoading(true);
    setPaymentFailed(false);
    setQrUrl(null);

    try {
      if (finalTotal === 0) {
        const res = await PaymentAPI.freeComplete({
          eventId: activeEvent._id,
          printCount: prints,
          digitalCopy: includeQR,
          amount: 0,
          couponCode: appliedCoupon?.code,
          discountApplied: discountAmount,
        });
        send({ type: 'PAYMENT_FREE' });
        proceedToCapture(res.qrToken ?? '');
        return;
      }

      const orderRes = await PaymentAPI.createOrder({
        eventId: activeEvent._id,
        printCount: prints,
        digitalCopy: includeQR,
        amount: finalTotal,
        couponCode: appliedCoupon?.code,
      });

      if (orderRes.paymentLinkUrl && orderRes.paymentId) {
        setQrUrl(orderRes.paymentLinkUrl);
        setIsImageUrl(orderRes.isImageUrl !== false);
        setLoading(false);
        startPolling(orderRes.paymentId);
      } else {
        throw new Error('Payment Link could not be generated.');
      }
    } catch (err: any) {
      Alert.alert('Payment Error', err.message ?? 'Could not initialize payment.');
      setLoading(false);
      setPaymentFailed(true);
      setQrGenerated(false); // Reset so they can try again if they want
    } finally {
      isInitializing.current = false;
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, width: '100%' }}
      >
        <LayoutContainer scrollable={false} contentContainerStyle={styles.layout}>
          
          {!qrGenerated && !paymentSuccess && !paymentFailed ? (
            /* ---------------- ORDER SUMMARY & COUPON ---------------- */
            <View style={styles.center}>
              <Text style={[styles.scanTitle, { color: theme.colors.text, marginBottom: verticalScale(16) }]}>
                Order Summary
              </Text>

              <GlassCard style={Object.assign({}, styles.summaryCard, { borderColor: theme.colors.surfaceSecondary }) as any}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Prints ({prints})</Text>
                  <Text style={[styles.summaryValue, { color: theme.colors.text }]}>₹{baseTotal}</Text>
                </View>

                {appliedCoupon && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.success }]}>
                      Discount ({appliedCoupon.code})
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.summaryValue, { color: theme.colors.success }]}>
                        -₹{discountAmount.toFixed(2)}
                      </Text>
                      <TouchableOpacity onPress={removeCoupon} style={{ marginLeft: 10 }}>
                        <Text style={{ color: theme.colors.error, fontSize: fontSize(14) }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={[styles.summaryDivider, { backgroundColor: theme.colors.surfaceSecondary }]} />
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryTotalLabel, { color: theme.colors.text }]}>Final Total</Text>
                  <Text style={[styles.summaryTotalValue, { color: theme.colors.primary }]}>
                    ₹{finalTotal.toFixed(2)}
                  </Text>
                </View>
              </GlassCard>

              {/* Coupon Input */}
              {!appliedCoupon && (
                <View style={styles.couponContainer}>
                  <TextInput
                    style={[styles.couponInput, { 
                      borderColor: couponError ? theme.colors.error : theme.colors.border,
                      color: theme.colors.text,
                      backgroundColor: theme.colors.surface
                    }]}
                    placeholder="Enter Coupon Code"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={couponInput}
                    onChangeText={setCouponInput}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[styles.applyBtn, { backgroundColor: theme.colors.surfaceSecondary }]}
                    onPress={validateCoupon}
                    disabled={validatingCoupon || !couponInput.trim()}
                  >
                    {validatingCoupon ? (
                      <ActivityIndicator color={theme.colors.text} size="small" />
                    ) : (
                      <Text style={[styles.applyBtnText, { color: theme.colors.text }]}>Apply</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              {couponError && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{couponError}</Text>
              )}

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.colors.surfaceSecondary, marginRight: scale(16) }]}
                  onPress={() => {
                    const isPrintEnabled = !activeEvent?.selectedScreens || activeEvent.selectedScreens.includes('print');
                    if (isPrintEnabled) {
                      navigation.replace('PrintCount', params);
                    } else {
                      navigation.replace('SlotSelection', { layout: params.orientation });
                    }
                  }}
                >
                  <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={initializePayment}
                >
                  <Text style={styles.actionBtnText}>
                    {finalTotal === 0 ? 'START SESSION' : 'GENERATE QR TO PAY'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : loading ? (
            /* ---------------- LOADING ---------------- */
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                {finalTotal === 0 ? 'Starting Session...' : 'Generating secure QR Code...'}
              </Text>
            </View>
          ) : paymentSuccess ? (
            /* ---------------- SUCCESS ---------------- */
            <View style={styles.center}>
              <View style={[styles.successCircle, { backgroundColor: theme.colors.success }]}>
                <Text style={styles.successIcon}>✓</Text>
              </View>
              <Text style={[styles.successText, { color: theme.colors.text }]}>
                Payment Successful!
              </Text>
              <Text style={[styles.successSub, { color: theme.colors.textSecondary }]}>
                Get ready for your photo session...
              </Text>
            </View>
          ) : paymentFailed ? (
            /* ---------------- FAILED ---------------- */
            <View style={styles.center}>
              <Text style={[styles.failedText, { color: theme.colors.text }]}>
                Payment was cancelled or failed.
              </Text>
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
                onPress={initializePayment}
              >
                <Text style={styles.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setQrGenerated(false)}
              >
                <Text style={[styles.backBtnText, { color: theme.colors.error }]}>Go Back</Text>
              </TouchableOpacity>
            </View>
          ) : qrUrl ? (
            /* ---------------- QR ---------------- */
            <View style={styles.center}>
              <Text style={[styles.scanTitle, { color: theme.colors.text }]}>Scan to Pay</Text>
              <Text style={[styles.amountText, { color: theme.colors.success }]}>₹{finalTotal.toFixed(2)}</Text>
              <GlassCard style={styles.qrCard}>
                <View style={styles.qrContainer}>
                  {isImageUrl ? (
                    <Image
                      source={{ uri: qrUrl }}
                      style={{ width: qrSize, height: qrSize, resizeMode: 'contain' }}
                    />
                  ) : (
                    <QRCode value={qrUrl} size={qrSize} backgroundColor="#ffffff" color="#000000" />
                  )}
                </View>
              </GlassCard>
              <Text style={[styles.scanSubtitle, { color: theme.colors.textSecondary }]}>
                Scan with GPay, PhonePe, Paytm, or any UPI app
              </Text>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  stopPolling();
                  setQrGenerated(false);
                }}
              >
                <Text style={[styles.cancelBtnText, { color: theme.colors.error }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.devBypassBtn, { backgroundColor: theme.colors.surfaceSecondary }]}
                onPress={() => {
                  stopPolling();
                  send({ type: 'PAYMENT_SUCCESS', token: '' });
                  proceedToCapture('DEV_BYPASS', 0);
                }}
              >
                <Text style={[styles.devBypassText, { color: theme.colors.text }]}>DEV: Bypass</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </LayoutContainer>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  layout: { flex: 1, width: '100%', paddingVertical: verticalScale(24), paddingHorizontal: scale(28) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: scale(24) },
  loadingText: { marginTop: verticalScale(20), fontSize: fontSize(18), fontWeight: '600' },
  scanTitle: { fontSize: fontSize(32), fontWeight: '800', marginBottom: verticalScale(8) },
  amountText: { fontSize: fontSize(48), fontWeight: '900', marginBottom: verticalScale(24) },
  qrCard: { alignItems: 'center', justifyContent: 'center', padding: moderateScale(16) },
  qrContainer: { backgroundColor: '#ffffff', padding: scale(16), borderRadius: moderateScale(20), elevation: 10, shadowColor: '#000000', shadowOpacity: 0.3, shadowRadius: 20 },
  scanSubtitle: { marginTop: verticalScale(24), fontSize: fontSize(16), fontWeight: '600', textAlign: 'center', maxWidth: scale(520), lineHeight: fontSize(22) },
  successCircle: { width: scale(100), height: scale(100), borderRadius: scale(50), justifyContent: 'center', alignItems: 'center', marginBottom: verticalScale(24) },
  successIcon: { color: '#ffffff', fontSize: fontSize(48), fontWeight: '900' },
  successText: { fontSize: fontSize(28), fontWeight: '800', marginBottom: verticalScale(8), textAlign: 'center' },
  successSub: { fontSize: fontSize(16), textAlign: 'center' },
  failedText: { fontSize: fontSize(20), fontWeight: '600', marginBottom: verticalScale(28), textAlign: 'center' },
  retryBtn: { paddingVertical: verticalScale(16), paddingHorizontal: scale(40), borderRadius: moderateScale(14), marginBottom: verticalScale(16) },
  retryBtnText: { color: '#ffffff', fontSize: fontSize(18), fontWeight: '700' },
  backBtn: { paddingVertical: verticalScale(12), paddingHorizontal: scale(24) },
  backBtnText: { fontSize: fontSize(18), fontWeight: '600' },
  cancelBtn: { marginTop: verticalScale(28), paddingVertical: verticalScale(12), paddingHorizontal: scale(24) },
  cancelBtnText: { fontSize: fontSize(18), fontWeight: '600' },
  devBypassBtn: { position: 'absolute', top: 0, right: 0, paddingVertical: verticalScale(8), paddingHorizontal: scale(16), borderRadius: moderateScale(8) },
  devBypassText: { fontSize: fontSize(14), fontWeight: 'bold' },

  summaryCard: {
    width: '100%',
    maxWidth: scale(400),
    padding: moderateScale(24),
    marginBottom: verticalScale(24),
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  summaryLabel: { fontSize: fontSize(16), fontWeight: '600' },
  summaryValue: { fontSize: fontSize(16), fontWeight: '700' },
  summaryDivider: { height: 1, width: '100%', marginVertical: verticalScale(12) },
  summaryTotalLabel: { fontSize: fontSize(20), fontWeight: '800' },
  summaryTotalValue: { fontSize: fontSize(24), fontWeight: '900' },
  
  couponContainer: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: scale(400),
    marginBottom: verticalScale(8),
  },
  couponInput: {
    flex: 1,
    height: verticalScale(48),
    borderWidth: 1,
    borderTopLeftRadius: moderateScale(12),
    borderBottomLeftRadius: moderateScale(12),
    paddingHorizontal: scale(16),
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  applyBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    borderTopRightRadius: moderateScale(12),
    borderBottomRightRadius: moderateScale(12),
  },
  applyBtnText: {
    fontSize: fontSize(14),
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: fontSize(12),
    fontWeight: '600',
    marginBottom: verticalScale(16),
  },
  
  actionRow: {
    flexDirection: 'row',
    marginTop: verticalScale(24),
  },
  actionBtn: {
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(32),
    borderRadius: moderateScale(16),
    minWidth: scale(140),
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: fontSize(16),
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
