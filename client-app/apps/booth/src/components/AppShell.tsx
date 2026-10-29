import React from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AppLogo } from './AppLogo';
import { useOptionalBooth } from '../context/BoothProvider';
import {
  Icon,
  fonts,
  fontSize,
  moderateScale,
  radii,
  scale,
  useAppTheme,
  verticalScale,
  getScreenDimensions,
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
 *  · the radial gradient is two SVG radial fills instead of CSS, because a flat
 *    circle at low opacity still shows its edge on a large tablet screen;
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
  /**
   * Seconds left on the idle timer. Only used to decide *when* the warning
   * appears — never rendered here. The header used to show a red `120s` pill from
   * the first second of a session, which read as an error; the countdown now
   * surfaces through `InactivityToast` in the last stretch, and through nothing
   * at all before that (matching Electron, which shows no idle clock).
   */
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
  /** stretch the body instead of centring it (tables, scrolling lists) */
  stretch?: boolean;
  testID?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  step,
  title,
  subtitle,
  online,
  orgName,
  orgLogoUrl,
  hideProgress,
  night,
  bleed,
  contentStyle,
  stretch,
  testID,
}) => {
  const { theme } = useAppTheme();
  // Fall back to the paired booth so screens only pass what is truly local.
  const booth = useOptionalBooth();
  const settings = booth?.snapshot?.settings;
  const org = booth?.snapshot?.organization;
  const resolvedOrgName = orgName ?? settings?.organizationName ?? org?.name ?? undefined;
  const resolvedOrgLogo =
    orgLogoUrl !== undefined ? orgLogoUrl : settings?.branding?.logoUrl ?? org?.branding?.logoUrl ?? null;
  const isOnline = online ?? booth?.online ?? true;
  const p = theme.palette;
  const insets = useSafeAreaInsets();
  const index = step ? FLOW.indexOf(step) : -1;
  const showProgress = !hideProgress && index >= 0;
  const dims = getScreenDimensions();
  // Electron: 74px header, 62px with `@media (max-height:720px)`.
  const headerHeight = Math.min(74, Math.max(58, Math.round(dims.height * 0.11)));
  /*
   * The header starts at y = 0, always.
   *
   * Padding it by `insets.top` was a mistake even though the arithmetic looked
   * right: the window is not edge-to-edge on every device, so the inset we were
   * "protecting" was a real, visible system strip — the bar simply floated 25-ish
   * pixels below the top of the screen. A kiosk has no status bar to avoid
   * (`StatusBar hidden` + `KioskModule.setImmersiveMode`, both re-applied in
   * App.tsx), and on iPad `UIRequiresFullScreen` leaves the top inset at zero.
   * So the header owns y = 0 and the top inset is not consumed here at all; the
   * only inset that still matters is the home indicator at the bottom.
   */

  const surface = night ? p.night : p.background;
  const ink = night ? p.nightText : p.ink;

  return (
    <View
      testID={testID}
      style={[styles.shell, { backgroundColor: surface, paddingTop: insets.top }]}
    >
      {/* ambient tint — Electron's
          `radial-gradient(circle at 10% 100%, #f6e8f3, transparent 35%)` plus its
          violet neighbour, drawn as real radial fills so the edge never shows. */}
      {!night ? (
        <>
          <AmbientGlow id="shell-glow-a" color={p.pink} size={scale(760)} style={styles.ambientA} opacity={0.16} />
          <AmbientGlow id="shell-glow-b" color={p.violet} size={scale(620)} style={styles.ambientB} opacity={0.12} />
        </>
      ) : null}

      <View
        style={[
          styles.header,
          {
            // Flush with y = 0 — see the note above `headerHeight`.
            paddingTop: 0,
            height: headerHeight,
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
          {resolvedOrgName ? (
            <>
              <View style={[styles.divider, { backgroundColor: night ? 'rgba(255,255,255,0.14)' : 'rgba(88,56,105,0.14)' }]} />
              <View style={styles.orgRow}>
                {resolvedOrgLogo ? (
                  <View style={[styles.orgLogo, { borderColor: p.line, backgroundColor: p.white }]}>
                    <OrgLogo url={resolvedOrgLogo} />
                  </View>
                ) : null}
                <Text
                  numberOfLines={1}
                  style={[styles.orgName, { color: ink }]}
                >
                  {resolvedOrgName}
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
          <View style={[styles.statusPill, { backgroundColor: isOnline ? p.greenSoft : p.redSoft }]}>
            <Icon name={isOnline ? 'wifi' : 'wifi-off'} size={fontSize(13)} color={isOnline ? p.green : p.red} />
            <Text style={[styles.statusText, { color: isOnline ? p.green : p.red }]}>
              {isOnline ? 'Connected' : 'Offline'}
            </Text>
          </View>
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
          stretch ? styles.contentStretch : null,
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

/** A soft radial wash — the RN equivalent of Electron's CSS radial-gradient. */
const AmbientGlow: React.FC<{
  id: string;
  color: string;
  size: number;
  style: object;
  opacity: number;
}> = ({ id, color, size, style, opacity }) => (
  <View pointerEvents="none" style={[style, { width: size, height: size, opacity }]}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={0.9} />
          <Stop offset="55%" stopColor={color} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  </View>
);

/** Org logo: remote image, rendered small and rounded like Electron's `.org-brand-logo`. */
const OrgLogo: React.FC<{ url: string }> = ({ url }) => (
  <Image source={{ uri: url }} style={styles.orgLogoImage} resizeMode="contain" />
);

const styles = StyleSheet.create({
  shell: { flex: 1 },
  ambientA: { position: 'absolute', left: -scale(300), bottom: -scale(320) },
  ambientB: { position: 'absolute', right: -scale(240), top: -scale(280) },

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
    // Electron's `.screen-content` is a full-height flex column and every screen
    // body inside it is vertically centred (`margin: auto` on the grid). Doing the
    // same here stops the "everything floats in the top half" look on a tablet.
    justifyContent: 'center',
    paddingHorizontal: scale(30),
    paddingTop: verticalScale(10),
  },
  contentStretch: { justifyContent: 'flex-start' },
  contentBleed: { paddingHorizontal: 0, paddingTop: 0 },
});

export default AppShell;
