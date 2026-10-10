import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenContainer,
  LayoutContainer,
  TemplateCanvas,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { useBooth } from '../context/BoothProvider';
import { ScreenHeader } from '../components/ScreenHeader';
import SoundManager from '../utils/SoundManager';
import { getTemplatePrice } from '../utils/pricing';
import { InactivityToast } from '../components/InactivityToast';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Prints'>;

export const PrintCountScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const {
    snapshot,
    session,
    updateSession,
    setIdleTimerEnabled,
    secondsLeft,
    resetIdleTimer,
    resetGuestSession,
  } = useBooth();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > 700;

  const event = snapshot?.event;
  const maxPrints = snapshot?.settings?.maximumPrints ?? 10;
  const template = session.template;

  useEffect(() => {
    setIdleTimerEnabled(true);
    resetIdleTimer();
    return () => setIdleTimerEnabled(false);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) {
      resetGuestSession(navigation);
    }
  }, [secondsLeft]);

  // Safe navigation redirect outside render phase
  useEffect(() => {
    if (!template) {
      navigation.replace('Templates');
    }
  }, [template, navigation]);

  if (!template) {
    return null;
  }

  const unitPrice = getTemplatePrice(template, event?.layoutPrices);
  const total = session.prints * unitPrice;
  const choices = [1, 2, 4, 6, 8, 10].filter((item) => item <= maxPrints);
  const isPortrait = template.layout.orientation === 'portrait';
  const previewWidth = isPortrait ? scale(190) : scale(260);
  const previewHeight = isPortrait ? verticalScale(270) : verticalScale(185);

  const handleSelectCount = (count: number) => {
    SoundManager.play('click');
    updateSession({ prints: count });
  };

  const handleToggleDigital = (val: boolean) => {
    SoundManager.play('click');
    updateSession({ digitalCopy: val });
  };

  const handleNext = () => {
    SoundManager.play('click');
    navigation.navigate('Payment');
  };

  const handleBack = () => {
    SoundManager.play('click');
    navigation.goBack();
  };

  return (
    <ScreenContainer style={{ backgroundColor: '#050508' }}>
      <LayoutContainer>
        {/* Prominent Header with Countdown Timer */}
        <ScreenHeader
          title="Print Copies & Digital Pass"
          subtitle="Select copies for your friends and family. Final discount is verified next."
          secondsLeft={secondsLeft}
          step="STEP 3 OF 5"
        />

        <View style={[styles.mainLayout, isLandscape ? styles.rowLayout : styles.colLayout]}>
          {/* Options Panel */}
          <View style={styles.optionsPanel}>
            <Text style={styles.kicker}>NUMBER OF PHYSICAL PRINTS</Text>
            <View style={styles.choicesGrid}>
              {choices.map((n) => {
                const isActive = session.prints === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.countChip, isActive && styles.countChipActive]}
                    onPress={() => handleSelectCount(n)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.countChipText, isActive && styles.countChipTextActive]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Digital Copy Toggle */}
            {event?.digitalCopy !== false && (
              <View style={styles.digitalOption}>
                <View style={styles.digitalInfo}>
                  <Text style={styles.digitalTitle}>Include Digital Download QR?</Text>
                  <Text style={styles.digitalSub}>Instant phone download link on success screen.</Text>
                </View>
                <View style={styles.yesNoGroup}>
                  <TouchableOpacity
                    style={[styles.yesNoBtn, session.digitalCopy && styles.yesNoBtnActive]}
                    onPress={() => handleToggleDigital(true)}
                  >
                    <Text style={[styles.yesNoText, session.digitalCopy && styles.yesNoTextActive]}>
                      YES
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.yesNoBtn, !session.digitalCopy && styles.yesNoBtnActive]}
                    onPress={() => handleToggleDigital(false)}
                  >
                    <Text style={[styles.yesNoText, !session.digitalCopy && styles.yesNoTextActive]}>
                      NO
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Order Price Breakdown */}
            <View style={styles.orderMathBox}>
              <View style={styles.mathRow}>
                <Text style={styles.mathLabel}>
                  {session.prints} × {unitPrice === 0 ? 'Free' : `₹${unitPrice}`}
                </Text>
                <Text style={styles.mathValue}>
                  {total === 0 ? 'Free' : `₹${total}`}
                </Text>
              </View>
              <Text style={styles.mathNote}>
                Coupon code and payment options applied securely on the next step.
              </Text>
            </View>
          </View>

          {/* Template Live Preview (Properly Fitted, No Overflow) */}
          <View style={styles.previewPanel}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewBadge}>SELECTED DESIGN</Text>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {template.name}
              </Text>
              <Text style={styles.previewSub}>
                {template.layout.printSize} • {template.layout.slots} {template.layout.slots === 1 ? 'shot' : 'shots'}
              </Text>
            </View>

            <View style={styles.canvasContainer}>
              <TemplateCanvas
                template={template}
                style={{
                  width: previewWidth,
                  height: previewHeight,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              />
            </View>
          </View>
        </View>

        {/* Footer Actions */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.8}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Continue to Payment →</Text>
          </TouchableOpacity>
        </View>

        {secondsLeft <= 25 && (
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
  optionsPanel: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#222232',
    padding: scale(26),
    width: scale(340),
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
    marginBottom: verticalScale(14),
  },
  choicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
    marginBottom: verticalScale(20),
  },
  countChip: {
    width: scale(52),
    height: scale(52),
    borderRadius: moderateScale(14),
    backgroundColor: '#171722',
    borderWidth: 1.5,
    borderColor: '#28283a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#a78bfa',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  countChipText: {
    color: '#a1a1aa',
    fontSize: fontSize(18),
    fontWeight: '700',
  },
  countChipTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  digitalOption: {
    paddingVertical: verticalScale(14),
    borderTopWidth: 1,
    borderTopColor: '#1f1f2c',
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f2c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(14),
  },
  digitalInfo: {
    flex: 1,
    paddingRight: 10,
  },
  digitalTitle: {
    color: '#ffffff',
    fontSize: fontSize(13),
    fontWeight: '800',
  },
  digitalSub: {
    color: '#71717a',
    fontSize: fontSize(11),
    marginTop: 2,
  },
  yesNoGroup: {
    flexDirection: 'row',
    backgroundColor: '#171722',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#28283a',
    padding: 3,
  },
  yesNoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  yesNoBtnActive: {
    backgroundColor: '#8b5cf6',
  },
  yesNoText: {
    color: '#71717a',
    fontSize: fontSize(11),
    fontWeight: '700',
  },
  yesNoTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  orderMathBox: {
    backgroundColor: '#15151f',
    borderRadius: 14,
    padding: scale(14),
  },
  mathRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
  },
  mathLabel: {
    color: '#d4d4d8',
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  mathValue: {
    color: '#ffffff',
    fontSize: fontSize(20),
    fontWeight: '900',
  },
  mathNote: {
    color: '#71717a',
    fontSize: fontSize(11),
    lineHeight: 15,
  },
  previewPanel: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#222232',
    padding: scale(22),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  previewHeader: {
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  previewBadge: {
    color: '#8b5cf6',
    fontSize: fontSize(9),
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  previewTitle: {
    color: '#ffffff',
    fontSize: fontSize(16),
    fontWeight: '900',
  },
  previewSub: {
    color: '#a1a1aa',
    fontSize: fontSize(11),
    marginTop: 2,
  },
  canvasContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#08080c',
    borderWidth: 1,
    borderColor: '#1f1f2e',
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
  nextBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '800',
  },
});
