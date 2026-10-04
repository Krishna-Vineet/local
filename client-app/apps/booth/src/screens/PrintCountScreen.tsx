import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenContainer,
  LayoutContainer,
  GlassCard,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale
} from '../../../../packages/ui/src/index';
import { useBooth } from '../context/BoothProvider';
import SoundManager from '../utils/SoundManager';
import { getTemplatePrice } from '../utils/pricing';
import { InactivityToast } from '../components/InactivityToast';

import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PrintCount'>;

export const PrintCountScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useAppTheme();
  const { state } = useBooth();
  const { params } = route as any;

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const activeEvent = state.context.activeEvent;
  const activeTemplate = state.context.selectedTemplate;
  const isDigitalEnabled = activeEvent?.sharingConfig?.enabled !== false;

  const [prints, setPrints] = useState(1);
  const [includeQR, setIncludeQR] = useState(isDigitalEnabled);
  const [timeLeft, setTimeLeft] = useState(30);

  const templateId = params?.templateId || activeTemplate?.id;

  /* =========================================================
     UNIT PRICE — same rules as SlotSelection + Payment
  ========================================================= */
  const getUnitPrice = () => {
    if (!activeTemplate || !activeEvent) return 100;
    return getTemplatePrice(activeTemplate, activeEvent);
  };

  const unitPrice = getUnitPrice();
  const total = prints * unitPrice;

  // Check if payment should be processed
  const isPaymentScreenEnabled = !activeEvent?.selectedScreens || activeEvent.selectedScreens.includes('payment');
  const requiresPayment = isPaymentScreenEnabled && total > 0;

  useEffect(() => {
    if (timeLeft <= 0) {
      navigation.replace('Start');
      return;
    }
    const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, navigation]);

  const handleNext = () => {
    SoundManager.play('click');
    const nextParams = {
      ...params,
      templateId,
      prints,
      includeQR,
      unitPrice,
      packageType: includeQR ? 'print-digital' : 'print-only',
    };

    if (requiresPayment) {
      navigation.replace('Payment' as any, nextParams);
    } else {
      // Bypass payment directly to Capture
      navigation.replace('Capture' as any, nextParams);
    }
  };

  return (
    <ScreenContainer>
      <LayoutContainer
        contentContainerStyle={Object.assign(
          {},
          styles.layout,
          isLandscape ? styles.layoutLandscape : styles.layoutPortrait
        )}
      >
        {/* ================= HEADER ================= */}
        <View style={styles.header}>
          <View style={styles.headerSide} />

          <Text style={[styles.title, { color: theme.colors.text }]}>
            FINAL DETAILS
          </Text>

          <View
            style={[
              styles.timerPill,
              { backgroundColor: theme.colors.error + '18' },
            ]}
          >
            <Text style={[styles.timerText, { color: theme.colors.error }]}>
              {timeLeft}s
            </Text>
          </View>
        </View>

        {/* ================= CONTENT ================= */}
        <View style={styles.content}>
          {/* PRINT COUNT */}
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.textSecondary },
              ]}
            >
              HOW MANY PRINTS?
            </Text>

            <View style={styles.optionsRow}>
              {[1, 2, 4, 6, 8, 10].map(num => {
                const selected = prints === num;

                return (
                  <TouchableOpacity
                    key={num}
                    activeOpacity={0.82}
                    style={[
                      styles.countPill,
                      {
                        backgroundColor: selected
                          ? theme.colors.primary
                          : theme.colors.surfaceSecondary,
                      },
                      selected && styles.activePill,
                    ]}
                    onPress={() => {
                      SoundManager.haptic(10);
                      setPrints(num);
                    }}
                  >
                    <Text
                      style={[
                        styles.countText,
                        { color: selected ? '#FFFFFF' : theme.colors.text },
                      ]}
                    >
                      {num}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* DIGITAL ADD-ON */}
          <View style={styles.section}>
            <GlassCard style={styles.addonCard}>
              <View style={styles.addonInfo}>
                <Text style={[styles.addonTitle, { color: theme.colors.text }]}>
                  DIGITAL COPIES
                </Text>

                <Text
                  style={[
                    styles.addonSub,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Select Yes to include a QR Code link to download image files to your phone. (Valid for 24 hours)
                </Text>
              </View>

              <View style={styles.toggleRow}>

                <View style={styles.toggleRow}>
                  {/* YES */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.toggleBtn,
                      {
                        backgroundColor: includeQR
                          ? theme.colors.primary
                          : theme.colors.surfaceSecondary,
                      },
                    ]}
                    onPress={() => setIncludeQR(true)}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        { color: includeQR ? '#FFFFFF' : theme.colors.text },
                      ]}
                    >
                      YES
                    </Text>
                  </TouchableOpacity>

                  {/* NO */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.toggleBtn,
                      {
                        backgroundColor: !includeQR
                          ? theme.colors.error
                          : theme.colors.surfaceSecondary,
                      },
                    ]}
                    onPress={() => setIncludeQR(false)}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        { color: !includeQR ? '#FFFFFF' : theme.colors.text },
                      ]}
                    >
                      NO
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          </View>
          

          {/* TOTAL */}
          {requiresPayment && (
            <View
              style={[
                styles.totalBox,
                { backgroundColor: theme.colors.surfaceSecondary },
              ]}
            >
              <Text
                style={[
                  styles.totalLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {prints} × ₹{unitPrice}
              </Text>

              <Text style={[styles.totalValue, { color: theme.colors.success }]}>
                ₹{total}
              </Text>
            </View>
          )}
        </View>

        {/* ================= FOOTER ================= */}
        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.82}
            style={[
              styles.backBtn,
              { backgroundColor: theme.colors.surfaceSecondary },
            ]}
            onPress={() => navigation.replace('SlotSelection', params || {})}
          >
            <Text style={[styles.btnText, { color: theme.colors.text }]}>
              BACK
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            style={[styles.nextBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleNext}
          >
            <Text style={styles.btnTextWhite}>
              {requiresPayment ? 'PROCEED TO PAY →' : 'START CAPTURE →'}
            </Text>
          </TouchableOpacity>
        </View>
        {/* INACTIVITY WARNING */}
        <InactivityToast visible={timeLeft <= 10} />

      </LayoutContainer>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  /* =========================================================
     SCREEN
  ========================================================= */

  layout: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
  },

  /*
   * Landscape: keep the airy feel with clearly defined gutters.
   */
  layoutLandscape: {
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(24),
    paddingHorizontal: scale(40),
  },

  /*
   * Portrait: guaranteed padding on EVERY side so nothing hugs
   * the edges of the screen (previous version only padded
   * top/bottom here, and the bottom padding was duplicated).
   */
  layoutPortrait: {
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(24),
    paddingLeft: scale(28),
    paddingRight: scale(28),
  },

  /* =========================================================
     HEADER
  ========================================================= */

  header: {
    width: '100%',
    minHeight: verticalScale(52),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },

  headerSide: {
    width: scale(70),
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 2,
  },

  title: {
    position: 'absolute',
    left: scale(90),
    right: scale(90),
    textAlign: 'center',
    fontSize: fontSize(24),
    fontWeight: '900',
    letterSpacing: 2,
  },

  timerPill: {
    minWidth: scale(62),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(7),
    paddingHorizontal: scale(14),
    borderRadius: moderateScale(20),
    zIndex: 2,
  },

  timerText: {
    fontSize: fontSize(14),
    fontWeight: '900',
  },

  /* =========================================================
     CONTENT
  ========================================================= */

  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(12),
  },

  section: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: {
    fontSize: fontSize(12),
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: verticalScale(16),
    textAlign: 'center',
  },

  /* =========================================================
     PRINT COUNT
  ========================================================= */

  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(12),
    marginBottom: verticalScale(28),
    width: '100%',
    flexWrap: 'wrap',
  },

  countPill: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },

  activePill: {
    transform: [{ scale: 1.06 }],
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },

  countText: {
    fontSize: fontSize(23),
    fontWeight: '900',
  },

  /* =========================================================
     DIGITAL ADD-ON
  ========================================================= */

  addonCard: {
    width: '100%',
    maxWidth: scale(650),
    minHeight: verticalScale(90),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: moderateScale(20),
    paddingHorizontal: moderateScale(24),
  },

  addonInfo: {
    flex: 1,
    paddingRight: scale(20),
  },

  addonTitle: {
    fontSize: fontSize(16),
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  addonSub: {
    fontSize: fontSize(11),
    marginTop: verticalScale(5),
    lineHeight: fontSize(16),
    maxWidth: scale(420),
  },

  toggleRow: {
    flexDirection: 'row',
    gap: scale(8),
    alignItems: 'center',
  },

  toggleBtn: {
    minWidth: scale(68),
    minHeight: verticalScale(44),
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(18),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },

  toggleText: {
    fontSize: fontSize(13),
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* =========================================================
     TOTAL
  ========================================================= */

  totalBox: {
    marginTop: verticalScale(24),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(36),
    borderRadius: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },

  totalLabel: {
    fontSize: fontSize(9),
    fontWeight: '800',
    letterSpacing: 2,
  },

  totalValue: {
    fontSize: fontSize(32),
    fontWeight: '900',
    marginTop: verticalScale(2),
  },

  /* =========================================================
     FOOTER
  ========================================================= */

  footer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: verticalScale(12),
  },

  backBtn: {
    minHeight: verticalScale(48),
    paddingVertical: verticalScale(13),
    paddingHorizontal: scale(34),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },

  nextBtn: {
    minHeight: verticalScale(48),
    paddingVertical: verticalScale(13),
    paddingHorizontal: scale(34),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  btnText: {
    fontSize: fontSize(14),
    fontWeight: '900',
    letterSpacing: 1,
  },

  btnTextWhite: {
    fontSize: fontSize(14),
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
