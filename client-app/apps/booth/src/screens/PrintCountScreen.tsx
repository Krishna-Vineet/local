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
  const isLandscape = width > height;

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

  if (!template) {
    navigation.replace('Templates');
    return null;
  }

  const unitPrice = getTemplatePrice(template, event?.layoutPrices);
  const total = session.prints * unitPrice;
  const choices = [1, 2, 4, 6, 8, 10].filter((item) => item <= maxPrints);

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
    <ScreenContainer>
      <LayoutContainer>
        <View style={styles.header}>
          <Text style={styles.title}>Almost ready</Text>
          <Text style={styles.subtitle}>
            Choose how many copies you want. Every copy uses the selected event price.
          </Text>
        </View>

        <View style={[styles.mainLayout, isLandscape ? styles.rowLayout : styles.colLayout]}>
          {/* Options Panel */}
          <View style={styles.optionsPanel}>
            <Text style={styles.kicker}>NUMBER OF PRINTS</Text>
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
            {event?.digitalCopy && (
              <View style={styles.digitalOption}>
                <View style={styles.digitalInfo}>
                  <Text style={styles.digitalTitle}>Add digital copy?</Text>
                  <Text style={styles.digitalSub}>Show a phone download QR after printing.</Text>
                </View>
                <View style={styles.yesNoGroup}>
                  <TouchableOpacity
                    style={[styles.yesNoBtn, session.digitalCopy && styles.yesNoBtnActive]}
                    onPress={() => handleToggleDigital(true)}
                  >
                    <Text style={[styles.yesNoText, session.digitalCopy && styles.yesNoTextActive]}>
                      Yes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.yesNoBtn, !session.digitalCopy && styles.yesNoBtnActive]}
                    onPress={() => handleToggleDigital(false)}
                  >
                    <Text style={[styles.yesNoText, !session.digitalCopy && styles.yesNoTextActive]}>
                      No
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Order Preview Card */}
          <View style={styles.orderCard}>
            <View style={styles.previewCanvasWrap}>
              <TemplateCanvas
                template={template}
                style={{ width: scale(170), height: verticalScale(230) }}
              />
            </View>

            <View style={styles.orderMeta}>
              <Text style={styles.orderTemplateName}>{template.name}</Text>
              <Text style={styles.orderTemplateLabel}>{template.layout.label}</Text>

              <View style={styles.mathRow}>
                <Text style={styles.mathLeft}>
                  {session.prints} × {unitPrice === 0 ? 'Free' : `₹${unitPrice}`}
                </Text>
                <Text style={styles.mathRight}>
                  {total === 0 ? 'Free' : `₹${total}`}
                </Text>
              </View>

              <Text style={styles.discountNote}>
                Final discount, if any, is calculated securely on the next screen.
              </Text>
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
  header: {
    alignItems: 'center',
    paddingTop: verticalScale(14),
    marginBottom: verticalScale(16),
  },
  title: {
    color: '#ffffff',
    fontSize: fontSize(24),
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: fontSize(13),
    textAlign: 'center',
  },
  mainLayout: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  colLayout: {
    flexDirection: 'column',
    justifyContent: 'space-evenly',
  },
  optionsPanel: {
    backgroundColor: '#121217',
    borderRadius: moderateScale(22),
    borderWidth: 1.5,
    borderColor: '#22222a',
    padding: scale(24),
    width: scale(320),
    margin: scale(10),
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
    backgroundColor: '#18181f',
    borderWidth: 1.5,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#a78bfa',
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
    paddingTop: verticalScale(16),
    borderTopWidth: 1,
    borderTopColor: '#22222a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  digitalInfo: {
    flex: 1,
    paddingRight: 10,
  },
  digitalTitle: {
    color: '#ffffff',
    fontSize: fontSize(14),
    fontWeight: '700',
  },
  digitalSub: {
    color: '#71717a',
    fontSize: fontSize(11),
    marginTop: 2,
  },
  yesNoGroup: {
    flexDirection: 'row',
    backgroundColor: '#18181f',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272a',
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
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  yesNoTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  orderCard: {
    backgroundColor: '#121217',
    borderRadius: moderateScale(22),
    borderWidth: 1.5,
    borderColor: '#22222a',
    padding: scale(20),
    width: scale(280),
    alignItems: 'center',
    margin: scale(10),
  },
  previewCanvasWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(12),
  },
  orderMeta: {
    width: '100%',
  },
  orderTemplateName: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '800',
  },
  orderTemplateLabel: {
    color: '#a1a1aa',
    fontSize: fontSize(11),
    marginBottom: verticalScale(10),
  },
  mathRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  mathLeft: {
    color: '#a1a1aa',
    fontSize: fontSize(14),
  },
  mathRight: {
    color: '#ffffff',
    fontSize: fontSize(18),
    fontWeight: '900',
  },
  discountNote: {
    color: '#71717a',
    fontSize: fontSize(10),
    marginTop: verticalScale(8),
    lineHeight: 14,
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
    backgroundColor: '#1c1c24',
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
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '700',
  },
});
