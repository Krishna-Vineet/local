import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Card,
  Eyebrow,
  Icon,
  TemplatePreview,
  fonts,
  fontSize,
  moderateScale,
  scale,
  shadows,
  useAppTheme,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { AppShell } from '../components/AppShell';
import { InactivityToast } from '../components/InactivityToast';
import { useBooth } from '../context/BoothProvider';
import { goBackOr } from '../utils/navigation';
import { getTemplatePrice } from '../utils/pricing';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

/**
 * Copies + digital copy — Electron's `PrintCountScreen`
 * (`.print-details-grid`, `.print-option-panel`, `.count-options`,
 * `.digital-choice`, `.order-preview-card`).
 *
 * Left: a numeric chooser and a Yes/No for the download QR. Right: the chosen
 * template rendered through `TemplateCanvas` with the price arithmetic beside
 * it, so the guest sees exactly what ₹N buys before paying.
 *
 * (There is deliberately no local discount logic here — the backend applies
 * coupons on the payment screen, and the copy says so.)
 */

type Props = NativeStackScreenProps<RootStackParamList, 'Prints'>;

export const PrintCountScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const p = theme.palette;
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
  // `.order-preview-card > .template-frame { height: min(34vh, 300px) }`
  const previewHeight = Math.min(Math.round(height * 0.34), scale(300));
  // `.count-options button { width: clamp(58px, 5vw, 78px); aspect-ratio: 1 }`
  const countSize = Math.min(scale(78), Math.max(scale(58), width * 0.05));
  const isFocused = useIsFocused();

  const event = snapshot?.event;
  const maxPrints = snapshot?.settings?.maximumPrints ?? 10;
  const template = session.template;
  const digitalAllowed = Boolean(event?.digitalCopy);

  useEffect(() => {
    setIdleTimerEnabled(true);
    resetIdleTimer();
    return () => setIdleTimerEnabled(false);
  }, [setIdleTimerEnabled, resetIdleTimer]);

  useEffect(() => {
    if (secondsLeft === 0 && isFocused) resetGuestSession(navigation);
  }, [secondsLeft, isFocused, navigation, resetGuestSession]);

  // Selecting "back" from the payment screen with no template would dead-end.
  useEffect(() => {
    if (!template) navigation.replace('Templates');
  }, [template, navigation]);

  if (!template) return null;

  const unitPrice = getTemplatePrice(template, event, snapshot?.settings);
  const total = session.prints * unitPrice;
  const choices = [1, 2, 4, 6, 8, 10].filter((item) => item <= maxPrints);

  const selectCount = (count: number) => {
    SoundManager.play('select');
    resetIdleTimer();
    updateSession({ prints: count });
  };

  const setDigital = (value: boolean) => {
    SoundManager.play('select');
    updateSession({ digitalCopy: value });
  };

  const next = () => {
    SoundManager.play('click');
    navigation.navigate('Payment');
  };

  const back = () => {
    SoundManager.play('click');
    goBackOr(navigation, 'Templates');
  };

  return (
    <AppShell
      step="prints"
      title="Almost ready"
      subtitle="Choose how many copies you want. Every copy uses the selected event price."
      secondsLeft={secondsLeft}
      testID="prints-screen"
    >
      <View style={styles.body}>
      <View style={[styles.grid, isLandscape ? styles.gridRow : styles.gridCol]}>
        <Card style={{ ...styles.panel, ...(isLandscape ? styles.panelLandscape : styles.panelPortrait) }} elevation="soft">
          <Eyebrow color={p.pinkDeep}>Number of prints</Eyebrow>
          <View style={styles.counts}>
            {choices.map((value) => {
              const active = session.prints === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => selectCount(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.count,
                    {
                      width: countSize,
                      height: countSize,
                      borderRadius: countSize / 2,
                      borderColor: active ? p.pink : p.line,
                      backgroundColor: active ? p.pink : p.surface,
                    },
                    active ? styles.countActive : null,
                  ]}
                >
                  <Text style={[styles.countText, { color: active ? '#ffffff' : p.ink }]}>{value}</Text>
                </Pressable>
              );
            })}
          </View>

          {digitalAllowed ? (
            <View style={[styles.digital, { backgroundColor: '#f5eff8' }]}>
              <View style={[styles.digitalIcon, { backgroundColor: p.violetSoft }]}>
                <Icon name="copy" size={fontSize(18)} color={p.violet} />
              </View>
              <View style={styles.digitalCopy}>
                <Text style={[styles.digitalTitle, { color: p.ink }]}>Add digital copies?</Text>
                <Text style={[styles.digitalBody, { color: p.muted }]}>Show a download QR after printing.</Text>
              </View>
              <View style={styles.yesNo}>
                <Pressable
                  onPress={() => setDigital(true)}
                  style={[
                    styles.ynBtn,
                    {
                      borderColor: session.digitalCopy ? 'transparent' : p.line,
                      backgroundColor: session.digitalCopy ? p.green : p.surface,
                    },
                  ]}
                >
                  <Text style={[styles.ynText, { color: session.digitalCopy ? '#ffffff' : p.muted }]}>Yes</Text>
                </Pressable>
                <Pressable
                  onPress={() => setDigital(false)}
                  style={[
                    styles.ynBtn,
                    {
                      borderColor: !session.digitalCopy ? 'transparent' : p.line,
                      backgroundColor: !session.digitalCopy ? p.muted : p.surface,
                    },
                  ]}
                >
                  <Text style={[styles.ynText, { color: !session.digitalCopy ? '#ffffff' : p.muted }]}>No</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </Card>

        <Card style={styles.previewCard} elevation="card">
          <View style={[styles.previewStage, { height: previewHeight }]}>
            <TemplatePreview
              template={template}
              maxHeight={previewHeight}
              maxWidth={scale(260)}
              radius={moderateScale(8)}
            />
          </View>
          <View style={styles.previewCopy}>
            <Text numberOfLines={1} style={[styles.previewName, { color: p.ink }]}>
              {template.name}
            </Text>
            <Text numberOfLines={1} style={[styles.previewMeta, { color: p.faint }]}>
              {template.layout.label}
            </Text>
          </View>
          <View style={[styles.math, { borderTopColor: p.line }]}>
            <Text style={[styles.mathLine, { color: p.muted }]}>
              {session.prints} × {unitPrice === 0 ? 'Free' : `₹${unitPrice}`}
            </Text>
            <Text style={[styles.mathTotal, { color: p.pinkDeep }]}>
              {total === 0 ? 'Free' : `₹${total}`}
            </Text>
          </View>
          <Text style={[styles.mathNote, { color: p.faint }]}>
            Final discount, if any, is calculated securely on the next screen.
          </Text>
        </Card>
      </View>

      </View>

      <View style={styles.actions}>
        <Button label="Back" variant="secondary" icon="arrow-left" onPress={back} />
        <Button
          label="Continue to payment"
          iconRight="arrow-right"
          onPress={next}
          style={styles.nextBtn}
          testID="prints-next"
        />
      </View>

      <InactivityToast secondsLeft={secondsLeft} onStayActive={resetIdleTimer} />
    </AppShell>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', width: '100%' },
  grid: { width: '100%', maxWidth: scale(1060), alignSelf: 'center', gap: scale(20) },
  gridRow: { flexDirection: 'row', alignItems: 'stretch' },
  gridCol: { flexDirection: 'column' },

  // A bounded basis keeps the options card sized to its content without
  // allowing it to steal the full row; the preview owns the remaining width.
  panel: { flexGrow: 0, flexShrink: 0, padding: scale(34), borderRadius: moderateScale(27), gap: verticalScale(12) },
  panelLandscape: { flexBasis: '61%' as const, alignSelf: 'center' },
  panelPortrait: { alignSelf: 'stretch' },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(11), marginTop: verticalScale(6) },
  count: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  countActive: {
    shadowColor: '#e0428f',
    shadowOpacity: 0.25,
    shadowRadius: scale(12),
    shadowOffset: { width: 0, height: verticalScale(6) },
    elevation: 5,
    transform: [{ scale: 1.04 }],
  },
  countText: { fontFamily: fonts.display, fontSize: fontSize(24), letterSpacing: -0.4 },

  digital: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    padding: scale(15),
    borderRadius: moderateScale(18),
    marginTop: verticalScale(6),
  },
  digitalIcon: { width: scale(38), height: scale(38), borderRadius: moderateScale(12), alignItems: 'center', justifyContent: 'center' },
  digitalCopy: { flex: 1 },
  digitalTitle: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(13) },
  digitalBody: { fontFamily: fonts.body, fontSize: fontSize(11), marginTop: verticalScale(2) },
  yesNo: { flexDirection: 'row', gap: scale(6) },
  ynBtn: {
    minWidth: scale(46),
    height: verticalScale(34),
    paddingHorizontal: scale(10),
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ynText: { fontFamily: fonts.bodyBlack, fontSize: fontSize(11) },

  previewCard: {
    flex: 0.75,
    padding: scale(15),
    borderRadius: moderateScale(25),
    alignItems: 'center',
    gap: verticalScale(8),
    overflow: 'hidden',
  },
  // Fixed-height stage: a flex-1 stage let the print grow past the card and
  // overlap the page heading on a short tablet.
  previewStage: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  previewCopy: { alignItems: 'center', marginTop: verticalScale(6) },
  previewName: { fontFamily: fonts.display, fontSize: fontSize(17), letterSpacing: -0.2 },
  previewMeta: { fontFamily: fonts.bodyBold, fontSize: fontSize(10.5), marginTop: verticalScale(2) },
  math: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    borderTopWidth: 1,
    paddingTop: verticalScale(9),
    marginTop: verticalScale(4),
  },
  mathLine: { fontFamily: fonts.bodyBold, fontSize: fontSize(12) },
  mathTotal: { fontFamily: fonts.display, fontSize: fontSize(22) },
  mathNote: { fontFamily: fonts.body, fontSize: fontSize(9.5), textAlign: 'center' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(12),
    width: '100%',
    maxWidth: scale(1060),
    alignSelf: 'center',
    marginTop: verticalScale(16),
  },
  nextBtn: { flex: 1, maxWidth: scale(340) },
});

export default PrintCountScreen;
