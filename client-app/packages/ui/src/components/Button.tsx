import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { fontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { fonts, radii, shadows, spacing } from '../utils/theme';
import { useAppTheme } from '../context/ThemeContext';
import { Icon, IconName } from './Icon';

/**
 * Buttons, matched to Electron's `.button` / `.button--primary` / `.button--secondary`:
 * 52pt tall, 17pt radius, 850-weight label, a lift on hover (an 0.985 squeeze on
 * press here), and the pink 135° gradient flattened to the mid-tone because RN
 * has no gradients without another dependency.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'night';

export interface ButtonProps {
  label?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  loadingLabel?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
  /** accessibility + test id */
  testID?: string;
  accessibilityLabel?: string;
  children?: React.ReactNode;
}

const HEIGHT = { sm: 40, md: 52, lg: 60 };
const PADDING = { sm: 14, md: 22, lg: 28 };
const LABEL_SIZE = { sm: 12, md: 14, lg: 16 };

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  loadingLabel,
  style,
  fullWidth,
  testID,
  accessibilityLabel,
  children,
}) => {
  const { theme } = useAppTheme();
  const p = theme.palette;
  const press = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const skin: Record<ButtonVariant, { bg: string; border: string; text: string; shadow: object }> = {
    primary: { bg: p.pink, border: p.pink, text: p.white, shadow: shadows.lifted },
    secondary: { bg: p.surface, border: p.line, text: p.ink, shadow: shadows.soft },
    ghost: { bg: 'transparent', border: 'transparent', text: p.pinkDeep, shadow: {} },
    danger: { bg: p.red, border: p.red, text: p.white, shadow: {} },
    success: { bg: p.green, border: p.green, text: p.white, shadow: {} },
    night: { bg: 'rgba(255,255,255,0.10)', border: 'rgba(255,255,255,0.22)', text: p.white, shadow: {} },
  };
  const s = skin[variant];

  const animate = (to: number) =>
    Animated.spring(press, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale: press }] }, fullWidth ? styles.full : null, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPressIn={() => animate(0.985)}
        onPressOut={() => animate(1)}
        onPress={onPress}
        style={[
          styles.base,
          {
            minHeight: verticalScale(HEIGHT[size]),
            paddingHorizontal: scale(PADDING[size]),
            backgroundColor: s.bg,
            borderColor: s.border,
            opacity: isDisabled ? 0.42 : 1,
          },
          variant !== 'ghost' && !isDisabled ? s.shadow : null,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={s.text} />
        ) : (
          <>
            {icon ? <Icon name={icon} size={scale(20)} color={s.text} /> : null}
            {children ?? (
              <Text
                style={{
                  fontFamily: fonts.bodyHeavy,
                  fontSize: fontSize(LABEL_SIZE[size]),
                  color: s.text,
                  letterSpacing: 0.1,
                }}
                numberOfLines={1}
              >
                {loading ? loadingLabel ?? label : label}
              </Text>
            )}
            {iconRight ? <Icon name={iconRight} size={scale(20)} color={s.text} /> : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};

/** Electron's `NextButton`: primary label + trailing arrow. */
export const NextButton: React.FC<Omit<ButtonProps, 'iconRight' | 'variant'> & { label?: string }> = ({
  label = 'Next',
  ...rest
}) => <Button {...rest} label={label} variant="primary" iconRight="arrow-right" />;

/** Electron's `BackButton`: secondary label + leading arrow. */
export const BackButton: React.FC<Omit<ButtonProps, 'icon' | 'variant'> & { label?: string }> = ({
  label = 'Back',
  ...rest
}) => <Button {...rest} label={label} variant="secondary" icon="arrow-left" />;

/* ── pills ─────────────────────────────────────────────────────────────── */

export type PillTone = 'neutral' | 'pink' | 'success' | 'danger' | 'violet' | 'amber';

export const Pill: React.FC<{ label: string; tone?: PillTone; icon?: IconName; style?: ViewStyle }> = ({
  label,
  tone = 'neutral',
  icon,
  style,
}) => {
  const { theme } = useAppTheme();
  const p = theme.palette;
  const tones: Record<PillTone, { bg: string; fg: string }> = {
    neutral: { bg: p.surfaceMuted, fg: p.muted },
    pink: { bg: p.pinkSoft, fg: p.pinkDeep },
    success: { bg: p.greenSoft, fg: p.green },
    danger: { bg: p.redSoft, fg: p.red },
    violet: { bg: p.violetSoft, fg: p.violet },
    amber: { bg: p.amberSoft, fg: p.amber },
  };
  const t = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, style]}>
      {icon ? <Icon name={icon} size={fontSize(13)} color={t.fg} /> : null}
      <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: fontSize(11), color: t.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

/* ── surfaces ──────────────────────────────────────────────────────────── */

export const Card: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
  /** `hero` matches Electron's big 28–29pt cards, `panel` its 18–25pt tools */
  tone?: 'plain' | 'soft' | 'tinted';
  elevation?: 'none' | 'soft' | 'card';
}> = ({ children, style, tone = 'plain', elevation = 'soft' }) => {
  const { theme } = useAppTheme();
  const p = theme.palette;
  const bg = tone === 'plain' ? p.surface : tone === 'soft' ? p.surfaceSoft : p.surfaceMuted;
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderColor: p.line,
          borderWidth: 1,
          borderRadius: moderateScale(radii.card),
          padding: scale(spacing.lg),
        },
        elevation === 'soft' ? shadows.soft : elevation === 'card' ? shadows.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
};

/* ── small type helpers ────────────────────────────────────────────────── */

export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string; style?: object }> = ({
  children,
  color,
  style,
}) => {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[
        {
          fontFamily: fonts.bodyBlack,
          fontSize: fontSize(11),
          letterSpacing: fontSize(11) * 0.16,
          textTransform: 'uppercase',
          color: color ?? theme.palette.pinkDeep,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

export const Title: React.FC<{ children: React.ReactNode; size?: number; color?: string; center?: boolean; style?: object }> = ({
  children,
  size = 34,
  color,
  center,
  style,
}) => {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[
        {
          fontFamily: fonts.display,
          fontSize: fontSize(size),
          lineHeight: Math.round(fontSize(size) * 1.08),
          letterSpacing: -fontSize(size) * 0.02,
          color: color ?? theme.palette.ink,
          textAlign: center ? 'center' : 'left',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

export const Subtitle: React.FC<{ children: React.ReactNode; size?: number; color?: string; center?: boolean; style?: object }> = ({
  children,
  size = 14,
  color,
  center,
  style,
}) => {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[
        {
          fontFamily: fonts.body,
          fontSize: fontSize(size),
          lineHeight: Math.round(fontSize(size) * 1.5),
          color: color ?? theme.palette.muted,
          textAlign: center ? 'center' : 'left',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
  },
  full: { alignSelf: 'stretch' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(7),
    borderRadius: radii.pill,
  },
});
