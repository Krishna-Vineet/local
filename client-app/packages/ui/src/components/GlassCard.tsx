import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { moderateScale } from '../utils/responsive';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style }) => {
  const { theme, mode } = useAppTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: theme.colors.glass,
          borderColor: theme.colors.border,
          shadowColor: mode === 'dark' ? '#000' : '#d4d4d8',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    padding: moderateScale(20),
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
