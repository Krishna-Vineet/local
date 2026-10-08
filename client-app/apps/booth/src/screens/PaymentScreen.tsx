import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CheckoutQuote, PaymentOrder } from '@happypix/types';
import {
  ScreenContainer,
  LayoutContainer,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { useBooth } from '../context/BoothProvider';
import { ScreenHeader } from '../components/ScreenHeader';
import SoundManager from '../utils/SoundManager';
import { InactivityToast } from '../components/InactivityToast';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;
type Phase = 'quoting' | 'summary' | 'creating' | 'waiting' | 'paid' | 'error';

export const PaymentScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const {
    requestQuote,
    createPayment,
    paymentStatus,
    completeFree,
    updateSession,
    setIdleTimerEnabled,
    secondsLeft,
    resetIdleTimer,
    resetGuestSession,
  } = useBooth();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > 700;

  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [coupon, setCoupon] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentOrder | null>(null);
  const [phase, setPhase] = useState<Phase>('quoting');
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    setIdleTimerEnabled(true);
    resetIdleTimer();

    let active = true;
    requestQuote()
      .then((q) => {
        if (!active) return;
        setQuote(q);
        setPhase('summary');
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err.message || 'Could not calculate quote.');
        setPhase('error');
      });

    return () => {
      active = false;
      stopPolling();
      setIdleTimerEnabled(false);
    };
  }, []);

  useEffect(() => {
    if (secondsLeft === 0 && phase !== 'waiting' && phase !== 'paid') {
      resetGuestSession(navigation);
    }
  }, [secondsLeft, phase]);

  const loadQuote = useCallback(
    async (code?: string) => {
      setPhase('quoting');
      setCouponError(null);
      setError(null);
      try {
        const next = await requestQuote(code);
        setQuote(next);
        setPayment(null);
        setPhase('summary');
      } catch (reason: any) {
        const message = reason.message || 'Could not calculate this order.';
        if (code) {
          setCouponError(message);
          setPhase('summary');
        } else {
          setError(message);
          setPhase('error');
        }
      }
    },
    [requestQuote]
  );

  const applyCoupon = () => {
    if (coupon.trim()) {
      SoundManager.play('click');
      void loadQuote(coupon.trim());
    }
  };

  const removeCoupon = () => {
    SoundManager.play('click');
    setCoupon('');
    void loadQuote();
  };

  const beginPayment = async () => {
    if (!quote) return;
    setError(null);
    setPhase('creating');
    SoundManager.play('click');

    try {
      if (quote.finalAmount === 0) {
        await completeFree(quote);
        SoundManager.play('success');
        setPhase('paid');
        updateSession({ quote, payment: null });
        setTimeout(() => {
          navigation.navigate('Camera');
        }, 800);
        return;
      }

      const order = await createPayment(quote);
      setPayment(order);
      setPhase('waiting');

      pollingRef.current = setInterval(async () => {
        try {
          const status = await paymentStatus(order.paymentId);
          if (status === 'paid') {
            stopPolling();
            setPayment({ ...order, status });
            setPhase('paid');
            SoundManager.play('success');
            updateSession({ quote, payment: { ...order, status } });
            setTimeout(() => {
              navigation.navigate('Camera');
            }, 1000);
          } else if (status === 'failed') {
            stopPolling();
            setPhase('error');
            setError('Payment was not completed. Please try again.');
          }
        } catch {
          // Ignore network blip, continue polling
        }
      }, 1600);
    } catch (reason: any) {
      setError(reason.message || 'Could not start payment.');
      setPhase('error');
    }
  };

  const cancelPayment = () => {
    SoundManager.play('click');
    stopPolling();
    setPayment(null);
    setPhase('summary');
  };

  const handleBack = () => {
    SoundManager.play('click');
    stopPolling();
    navigation.goBack();
  };

  return (
    <ScreenContainer style={{ backgroundColor: '#050508' }}>
      <LayoutContainer>
        {/* Prominent Header with Countdown Timer */}
        <ScreenHeader
          title="Payment & Order Review"
          subtitle="All prices and discounts are verified securely before shooting begins"
          onBack={handleBack}
          secondsLeft={secondsLeft}
          step="STEP 4 OF 5"
        />

        {phase === 'quoting' || phase === 'creating' ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={styles.stateTitle}>
              {phase === 'quoting' ? 'Verifying event price…' : 'Generating UPI QR code…'}
            </Text>
            <Text style={styles.stateSub}>Please wait a moment…</Text>
          </View>
        ) : phase === 'waiting' && quote && payment ? (
          <View style={[styles.mainLayout, isLandscape ? styles.rowLayout : styles.colLayout]}>
            {/* QR Panel */}
            <View style={styles.qrCard}>
              <Text style={styles.kicker}>SCAN WITH ANY UPI APP</Text>
              <Text style={styles.qrAmount}>₹{quote.finalAmount}</Text>
              <View style={styles.qrFrame}>
                <QRCode
                  value={payment.qrPayload}
                  size={scale(190)}
                  backgroundColor="#ffffff"
                  color="#000000"
                />
              </View>
              <Text style={styles.upiAppsText}>GPay • PhonePe • Paytm • BHIM</Text>
            </View>

            {/* Status & Cancel Card */}
            <View style={styles.statusCard}>
              <View style={styles.pulseContainer}>
                <ActivityIndicator size="small" color="#8b5cf6" />
                <Text style={styles.statusWaitText}>Waiting for payment…</Text>
              </View>
              <Text style={styles.statusDesc}>
                This screen will advance automatically as soon as your UPI app approves the payment.
              </Text>

              <View style={styles.infoTable}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Payment Ref</Text>
                  <Text style={styles.infoValue}>{payment.paymentId}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Settlement</Text>
                  <Text style={styles.infoValue}>
                    {quote.settlement === 'wallet' ? 'HappyPix Wallet' : 'Direct UPI'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Final Amount</Text>
                  <Text style={styles.infoValue}>₹{quote.finalAmount}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.cancelQrBtn}
                onPress={cancelPayment}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelQrText}>Cancel this QR</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : phase === 'paid' ? (
          <View style={styles.centerState}>
            <View style={styles.bigCheck}>
              <Text style={styles.checkIcon}>✓</Text>
            </View>
            <Text style={styles.stateTitle}>
              {quote?.finalAmount === 0 ? 'Free Session Approved!' : 'Payment Verified!'}
            </Text>
            <Text style={styles.stateSub}>Opening camera for your photo booth session…</Text>
          </View>
        ) : (
          <View style={[styles.mainLayout, isLandscape ? styles.rowLayout : styles.colLayout]}>
            {/* Order Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.kicker}>ORDER BREAKDOWN</Text>
              {quote && (
                <>
                  <View style={styles.summaryLine}>
                    <Text style={styles.summaryLabel}>
                      {quote.prints} print{quote.prints === 1 ? '' : 's'} × ₹{quote.unitPrice}
                    </Text>
                    <Text style={styles.summaryVal}>₹{quote.gross}</Text>
                  </View>

                  {quote.discount > 0 && (
                    <View style={styles.summaryLine}>
                      <Text style={[styles.summaryLabel, { color: '#4ade80' }]}>
                        Discount • {quote.couponCode}
                      </Text>
                      <Text style={[styles.summaryVal, { color: '#4ade80' }]}>
                        − ₹{quote.discount}
                      </Text>
                    </View>
                  )}

                  <View style={styles.summaryTotalRow}>
                    <Text style={styles.totalLabel}>Total Payable</Text>
                    <Text style={styles.totalValue}>₹{quote.finalAmount}</Text>
                  </View>

                  {quote.couponCode && (
                    <View style={styles.couponBadge}>
                      <Text style={styles.couponBadgeText}>
                        ✓ {quote.couponMessage || quote.couponCode}
                      </Text>
                      <TouchableOpacity onPress={removeCoupon}>
                        <Text style={styles.removeCouponText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Coupon / Voucher Card */}
            <View style={styles.couponCard}>
              <Text style={styles.kicker}>PROMO / COUPON</Text>
              <Text style={styles.couponTitle}>Have a coupon code?</Text>
              <Text style={styles.couponSub}>
                Enter code to apply event or organizer discounts.
              </Text>

              {!quote?.couponCode && (
                <View style={styles.couponForm}>
                  <TextInput
                    style={styles.couponInput}
                    value={coupon}
                    onChangeText={(val) => setCoupon(val.toUpperCase())}
                    placeholder="ENTER CODE (e.g. PIX20)"
                    placeholderTextColor="#52525b"
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[styles.applyBtn, !coupon.trim() && styles.applyBtnDisabled]}
                    onPress={applyCoupon}
                    disabled={!coupon.trim()}
                  >
                    <Text style={styles.applyBtnText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              )}

              {couponError && (
                <View style={styles.couponErrorBox}>
                  <Text style={styles.couponErrorText}>{couponError}</Text>
                </View>
              )}

              {error && (
                <View style={styles.couponErrorBox}>
                  <Text style={styles.couponErrorText}>{error}</Text>
                </View>
              )}

              <View style={styles.trustFooter}>
                <Text style={styles.trustText}>
                  🛡 Payment is held securely until photos are printed.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer Actions */}
        {(phase === 'summary' || phase === 'error') && (
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextBtn, !quote && styles.nextBtnDisabled]}
              disabled={!quote}
              onPress={beginPayment}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>
                {quote?.finalAmount === 0 ? 'Register Free Order →' : 'Generate UPI QR Code →'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {secondsLeft <= 25 && phase === 'summary' && (
          <InactivityToast secondsLeft={secondsLeft} onStayActive={resetIdleTimer} />
        )}
      </LayoutContainer>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  mainLayout: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    gap: scale(20),
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  colLayout: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(24),
  },
  stateTitle: {
    color: '#ffffff',
    fontSize: fontSize(22),
    fontWeight: '800',
    marginTop: verticalScale(16),
  },
  stateSub: {
    color: '#a1a1aa',
    fontSize: fontSize(13),
    marginTop: 6,
  },
  bigCheck: {
    width: moderateScale(72),
    height: moderateScale(72),
    borderRadius: moderateScale(36),
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  checkIcon: {
    color: '#ffffff',
    fontSize: fontSize(36),
    fontWeight: '900',
  },
  qrCard: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#222232',
    padding: scale(24),
    width: scale(320),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  kicker: {
    color: '#8b5cf6',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: verticalScale(8),
  },
  qrAmount: {
    color: '#ffffff',
    fontSize: fontSize(30),
    fontWeight: '900',
    marginBottom: verticalScale(14),
  },
  qrFrame: {
    backgroundColor: '#ffffff',
    padding: scale(14),
    borderRadius: 16,
    marginBottom: verticalScale(14),
  },
  upiAppsText: {
    color: '#a1a1aa',
    fontSize: fontSize(11),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusCard: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#222232',
    padding: scale(26),
    width: scale(330),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  pulseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  statusWaitText: {
    color: '#ffffff',
    fontSize: fontSize(17),
    fontWeight: '800',
    marginLeft: 10,
  },
  statusDesc: {
    color: '#a1a1aa',
    fontSize: fontSize(12),
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: verticalScale(16),
  },
  infoTable: {
    width: '100%',
    backgroundColor: '#161622',
    borderRadius: 12,
    padding: scale(14),
    marginBottom: verticalScale(18),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    color: '#71717a',
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  infoValue: {
    color: '#e4e4e7',
    fontSize: fontSize(12),
    fontWeight: '800',
  },
  cancelQrBtn: {
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(22),
    borderRadius: 10,
    backgroundColor: '#1c1c28',
    borderWidth: 1,
    borderColor: '#2b2b3a',
  },
  cancelQrText: {
    color: '#f87171',
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#222232',
    padding: scale(26),
    width: scale(330),
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(8),
  },
  summaryLabel: {
    color: '#d4d4d8',
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  summaryVal: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '800',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: verticalScale(14),
    marginTop: verticalScale(10),
    borderTopWidth: 1,
    borderTopColor: '#222232',
  },
  totalLabel: {
    color: '#ffffff',
    fontSize: fontSize(17),
    fontWeight: '800',
  },
  totalValue: {
    color: '#8b5cf6',
    fontSize: fontSize(26),
    fontWeight: '900',
  },
  couponBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    padding: 10,
    marginTop: verticalScale(14),
  },
  couponBadgeText: {
    color: '#4ade80',
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  removeCouponText: {
    color: '#f87171',
    fontSize: fontSize(11),
    fontWeight: '800',
  },
  couponCard: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#222232',
    padding: scale(26),
    width: scale(330),
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  couponTitle: {
    color: '#ffffff',
    fontSize: fontSize(16),
    fontWeight: '800',
    marginBottom: 4,
  },
  couponSub: {
    color: '#a1a1aa',
    fontSize: fontSize(12),
    marginBottom: verticalScale(14),
    lineHeight: 16,
  },
  couponForm: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  couponInput: {
    flex: 1,
    backgroundColor: '#171722',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#28283a',
    color: '#ffffff',
    fontSize: fontSize(13),
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(12),
    marginRight: scale(8),
  },
  applyBtn: {
    backgroundColor: '#8b5cf6',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(16),
    borderRadius: 12,
  },
  applyBtnDisabled: {
    opacity: 0.35,
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: fontSize(13),
    fontWeight: '800',
  },
  couponErrorBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  couponErrorText: {
    color: '#f87171',
    fontSize: fontSize(11),
  },
  trustFooter: {
    marginTop: verticalScale(20),
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: '#1f1f2c',
  },
  trustText: {
    color: '#71717a',
    fontSize: fontSize(11),
    textAlign: 'center',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
  },
  backBtn: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(22),
    borderRadius: moderateScale(12),
    backgroundColor: '#171720',
    borderWidth: 1,
    borderColor: '#262634',
  },
  backBtnText: {
    color: '#d4d4d8',
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  nextBtn: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(28),
    borderRadius: moderateScale(12),
    backgroundColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  nextBtnDisabled: {
    opacity: 0.35,
    shadowOpacity: 0,
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '800',
  },
});
