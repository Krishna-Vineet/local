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
  getScreenDimensions,
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
   * Seconds left on the idle timer, shown in Electron's header timer pill
   * (`.timer-pill`, red on `--red-soft`, solid red under 10s). It is always
   * visible, exactly like the desktop kiosk — the thing that must stay
   * threshold-gated is the *toast*, not the clock.
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
  secondsLeft,
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
      style={[styles.shell, { backgroundColor: surface }]}
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
          {/* Electron shows the logomark only (the asset already carries the
              HAPPYPIX wordmark), then a hairline divider, then the org. A second
              "HappyPix" text node here duplicated the brand and pushed the org
              name far right of where Electron puts it. */}
          <AppLogo width={scale(42)} height={scale(34)} forceDark={night} />
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
              <ProgressBar key={item} done={i <= index} night={Boolean(night)} />
            ))}
          </View>
        ) : (
          <View style={styles.progressSpacer} />
        )}

        <View style={styles.headerStatus}>
          <View style={[styles.statusPill, { backgroundColor: isOnline ? p.greenSoft : p.redSoft }]}>
            <Icon name={isOnline ? 'wifi' : 'wifi-off'} size={scale(16)} color={isOnline ? p.green : p.red} />
            <Text style={[styles.statusText, { color: isOnline ? p.green : p.red }]}>
              {isOnline ? 'Connected' : 'Offline'}
            </Text>
          </View>
          {secondsLeft !== undefined ? (
            <View
              style={[
                styles.timerPill,
                { backgroundColor: urgent ? p.red : p.redSoft },
              ]}
            >
              <Icon name="clock" size={scale(16)} color={urgent ? p.white : p.red} />
              <Text style={[styles.statusText, { color: urgent ? p.white : p.red, fontVariant: ['tabular-nums'] }]}>
                {Math.max(0, secondsLeft)}s
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

/**
 * One rung of the flow rail — Electron's `.flow-progress span` (5px tall,
 * `clamp(18px, 2.6vw, 42px)` wide, `linear-gradient(90deg, --pink, #a968d9)`
 * when done). A flat pink bar lost the gradient that makes the rail read as a
 * progress meter rather than six dots.
 */
const ProgressBar: React.FC<{ done: boolean; night: boolean }> = ({ done, night }) => {
  const dims = getScreenDimensions();
  const width = Math.min(42, Math.max(18, Math.round(dims.width * 0.026)));
  return (
    <Svg width={width} height={5}>
      <Defs>
        <LinearGradient id="flow-done" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#ee4c96" />
          <Stop offset="100%" stopColor="#a968d9" />
        </LinearGradient>
      </Defs>
      <Rect
        width={width}
        height={5}
        rx={2.5}
        fill={done ? 'url(#flow-done)' : night ? '#362c3e' : '#e8dfec'}
      />
    </Svg>
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
    // Electron `.booth-header`: flex, nowrap, 10px clamp(14px,2.2vw,32px),
    // gap 14. `headerLeft` grows, the rail never shrinks, status sits right —
    // that is what keeps the rail centred for any org-name length.
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
    paddingHorizontal: scale(Platform.OS === 'ios' ? 24 : 20),
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: scale(12), flex: 1, minWidth: 0 },
  divider: { width: 1, height: verticalScale(28), flexShrink: 0 },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), flexShrink: 1, minWidth: 0 },
  orgLogo: { width: scale(15), height: scale(15), borderRadius: moderateScale(6), borderWidth: 1, padding: scale(1) },
  orgLogoImage: { width: '100%', height: '100%' },
  orgName: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(13), letterSpacing: -0.1, flexShrink: 1 },

  progress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(8) },
  progressSpacer: { width: scale(28) },

  headerStatus: { flexDirection: 'row', alignItems: 'center', gap: scale(9), flexShrink: 0 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(7),
    paddingHorizontal: scale(12),
    height: verticalScale(34),
    borderRadius: radii.pill,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(7),
    paddingHorizontal: scale(12),
    minWidth: scale(69),
    height: verticalScale(34),
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
