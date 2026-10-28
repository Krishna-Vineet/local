import React from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLogo } from './AppLogo';
import {
  Icon,
  fonts,
  fontSize,
  moderateScale,
  radii,
  scale,
  shadows,
  useAppTheme,
  verticalScale,
} from '../../../../packages/ui/src/index';

/**
 * AppShell — the React Native port of Electron's `ScreenShell`
 * (`electron/src/ui/components/ScreenShell.tsx` + the `.screen-shell`,
 * `.booth-header`, `.flow-progress`, `.screen-heading` rules in App.css).
 *
 * Every booth screen sits inside this shell so the chrome — brand, organisation
 * badge, flow progress, connection state, timer, centred heading — is identical
 * on both clients and only the middle changes per step.
 *
 * Differences from the web version, all deliberate:
 *  · no backdrop blur (RN has no cheap equivalent; a translucent surface reads
 *    the same at kiosk distance);
 *  · the radial-gradient background is three soft tinted circles;
 *  · safe-area insets are applied here once so no screen has to think about
 *    the iPad home indicator or an Android status bar.
 */

export type FlowStep = 'start' | 'templates' | 'prints' | 'payment' | 'camera' | 'photos' | 'customize';

const FLOW: FlowStep[] = ['templates', 'prints', 'payment', 'camera', 'photos', 'customize'];

export interface AppShellProps {
  children: React.ReactNode;
  /** current step, or undefined to hide the progress rail (waiting/login) */
  step?: FlowStep;
  title?: string;
  subtitle?: string;
  secondsLeft?: number;
  online?: boolean;
  orgName?: string;
  orgLogoUrl?: string | null;
  /** hides the flow rail but keeps the header (waiting, success) */
  hideProgress?: boolean;
  /** dark chrome — camera screen and anything over live video */
  night?: boolean;
  /** removes the content padding when a screen owns the full canvas */
  bleed?: boolean;
  contentStyle?: object;
  testID?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  step,
  title,
  subtitle,
  secondsLeft,
  online = true,
  orgName,
  orgLogoUrl,
  hideProgress,
  night,
  bleed,
  contentStyle,
  testID,
}) => {
  const { theme } = useAppTheme();
  const p = theme.palette;
  const insets = useSafeAreaInsets();
  const index = step ? FLOW.indexOf(step) : -1;
  const showProgress = !hideProgress && index >= 0;

  const surface = night ? p.night : p.background;
  const ink = night ? p.nightText : p.ink;

  return (
    <View
      testID={testID}
      style={[styles.shell, { backgroundColor: surface, paddingTop: insets.top }]}
    >
      {/* ambient tint — the RN stand-in for Electron's radial-gradient */}
      {!night ? (
        <>
          <View pointerEvents="none" style={[styles.ambient, styles.ambientA, { backgroundColor: p.pink }]} />
          <View pointerEvents="none" style={[styles.ambient, styles.ambientB, { backgroundColor: p.violet }]} />
        </>
      ) : null}

      <View
        style={[
          styles.header,
          {
            backgroundColor: night ? 'rgba(15,10,21,0.92)' : 'rgba(255,255,255,0.68)',
            borderBottomColor: night ? 'rgba(255,255,255,0.08)' : 'rgba(88,56,105,0.08)',
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.brandRow}>
            <AppLogo width={scale(38)} height={scale(36)} forceDark={night} />
            <Text style={[styles.wordmark, { color: ink }]}>HappyPix</Text>
          </View>
          {orgName ? (
            <>
              <View style={[styles.divider, { backgroundColor: night ? 'rgba(255,255,255,0.14)' : 'rgba(88,56,105,0.14)' }]} />
              <View style={styles.orgRow}>
                {orgLogoUrl ? (
                  <View style={[styles.orgLogo, { borderColor: p.line, backgroundColor: p.white }]}>
                    <OrgLogo url={orgLogoUrl} />
                  </View>
                ) : null}
                <Text
                  numberOfLines={1}
                  style={[styles.orgName, { color: ink }]}
                >
                  {orgName}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {showProgress ? (
          <View style={styles.progress} accessibilityLabel={`Step ${index + 1} of ${FLOW.length}`}>
            {FLOW.map((item, i) => (
              <View
                key={item}
                style={[
                  styles.progressDot,
                  { backgroundColor: i <= index ? p.pink : night ? '#362c3e' : '#e8dfec' },
                ]}
              />
            ))}
          </View>
        ) : (
          <View style={styles.progressSpacer} />
        )}

        <View style={styles.headerStatus}>
          <View style={[styles.statusPill, { backgroundColor: online ? p.greenSoft : p.redSoft }]}>
            <Icon name={online ? 'wifi' : 'wifi-off'} size={fontSize(13)} color={online ? p.green : p.red} />
            <Text style={[styles.statusText, { color: online ? p.green : p.red }]}>
              {online ? 'Connected' : 'Offline'}
            </Text>
          </View>
          {secondsLeft !== undefined ? (
            <View
              style={[
                styles.statusPill,
                { backgroundColor: secondsLeft <= 10 ? p.red : p.redSoft },
              ]}
            >
              <Icon name="clock" size={fontSize(13)} color={secondsLeft <= 10 ? p.white : p.red} />
              <Text style={[styles.statusText, { color: secondsLeft <= 10 ? p.white : p.red }]}>
                {secondsLeft}s
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {title ? (
        <View style={styles.heading}>
          <Text style={[styles.title, { color: ink }]} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: night ? p.nightMuted : p.muted }]}>{subtitle}</Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.content,
          bleed ? styles.contentBleed : null,
          { paddingBottom: Math.max(insets.bottom, verticalScale(14)) },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

/** Org logo: remote image, rendered small and rounded like Electron's `.org-brand-logo`. */
const OrgLogo: React.FC<{ url: string }> = ({ url }) => (
  <Image source={{ uri: url }} style={styles.orgLogoImage} resizeMode="contain" />
);

const styles = StyleSheet.create({
  shell: { flex: 1 },
  ambient: { position: 'absolute', width: scale(520), height: scale(520), borderRadius: scale(260), opacity: 0.05 },
  ambientA: { top: -scale(200), left: -scale(160) },
  ambientB: { bottom: -scale(240), right: -scale(180) },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(14),
    paddingHorizontal: scale(Platform.OS === 'ios' ? 26 : 20),
    paddingVertical: verticalScale(10),
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: scale(12), flexShrink: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  wordmark: { fontFamily: fonts.displayBold, fontSize: fontSize(17), letterSpacing: -0.4 },
  divider: { width: 1, height: verticalScale(26) },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), flexShrink: 1 },
  orgLogo: { width: scale(20), height: scale(20), borderRadius: moderateScale(6), borderWidth: 1, padding: scale(2) },
  orgLogoImage: { width: '100%', height: '100%' },
  orgName: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(13), maxWidth: scale(240) },

  progress: { flexDirection: 'row', alignItems: 'center', gap: scale(7) },
  progressDot: { width: scale(26), height: moderateScale(5), borderRadius: radii.pill },
  progressSpacer: { width: scale(26) },

  headerStatus: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(11),
    height: verticalScale(30),
    borderRadius: radii.pill,
  },
  statusText: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(11) },

  heading: {
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(4),
    paddingHorizontal: scale(40),
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize(32),
    lineHeight: Math.round(fontSize(32) * 1.06),
    letterSpacing: -fontSize(32) * 0.02,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize(13),
    lineHeight: Math.round(fontSize(13) * 1.5),
    textAlign: 'center',
    marginTop: verticalScale(6),
  },

  content: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: scale(30),
    paddingTop: verticalScale(14),
  },
  contentBleed: { paddingHorizontal: 0, paddingTop: 0 },
});

export default AppShell;
