import React, { useRef } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { fontSize, moderateScale, scale } from '../utils/responsive';
import { useAppTheme } from '../context/ThemeContext';

interface BoothButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const BoothButton: React.FC<BoothButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const { theme } = useAppTheme();

  const SIZES = {
    sm: { paddingV: moderateScale(8), paddingH: scale(16), fontSize: fontSize(12), borderRadius: moderateScale(8) },
    md: { paddingV: moderateScale(12), paddingH: scale(24), fontSize: fontSize(14), borderRadius: moderateScale(12) },
    lg: { paddingV: moderateScale(16), paddingH: scale(32), fontSize: fontSize(16), borderRadius: moderateScale(16) },
    xl: { paddingV: moderateScale(20), paddingH: scale(40), fontSize: fontSize(18), borderRadius: moderateScale(20) },
  };

  const COLORS = {
    primary: { bg: theme.colors.primary, text: '#ffffff', border: theme.colors.primary },
    secondary: { bg: theme.colors.surfaceSecondary, text: theme.colors.text, border: theme.colors.border },
    danger: { bg: theme.colors.error, text: '#ffffff', border: theme.colors.error },
    ghost: { bg: 'transparent', text: theme.colors.primary, border: theme.colors.primary },
    success: { bg: theme.colors.success, text: '#ffffff', border: theme.colors.success },
  };

  const colors = COLORS[variant];
  const sizes = SIZES[size];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();

    // Trigger micro-interaction haptic vibration
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        Vibration.vibrate(15);
      } else if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
        navigator.vibrate(15);
      }
    } catch (e) {
      console.error('[BoothButton] Error:', e);
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: colors.bg,
            paddingVertical: sizes.paddingV,
            paddingHorizontal: sizes.paddingH,
            borderRadius: sizes.borderRadius,
            opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
            borderWidth: variant === 'ghost' ? 2 : 1,
            borderColor: colors.border,
          },
          styles.shadow,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} size="small" />
        ) : (
          <>
            {icon}
            <Text
              style={[
                styles.text,
                {
                  color: colors.text,
                  fontSize: sizes.fontSize,
                  marginLeft: icon ? 8 : 0,
                },
                textStyle,
              ]}
            >
              {label}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
