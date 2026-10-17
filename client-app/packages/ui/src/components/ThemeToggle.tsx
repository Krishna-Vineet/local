import React from 'react';
import { TouchableOpacity, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { moderateScale, scale, fontSize } from '../utils/responsive';
import Svg, { Path, Circle } from 'react-native-svg';

export const ThemeToggle: React.FC = () => {
  const { theme, mode, toggleTheme } = useAppTheme();

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceSecondary, borderColor: theme.colors.border }
      ]}
      activeOpacity={0.8}
    >
      <View style={styles.iconWrapper}>
        {mode === 'dark' ? (
          <Svg width={scale(20)} height={scale(20)} viewBox="0 0 24 24" fill="none" stroke={theme.colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="12" cy="12" r="5" />
            <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </Svg>
        ) : (
          <Svg width={scale(20)} height={scale(20)} viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </Svg>
        )}
      </View>
      <Text style={[styles.text, { color: theme.colors.text }]}>
        {mode === 'dark' ? 'LIGHT' : 'DARK'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(8),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(20),
    borderWidth: 1,
  },
  iconWrapper: {
    marginRight: scale(8),
  },
  text: {
    fontSize: fontSize(12),
    fontWeight: '800',
    letterSpacing: 1,
  },
});
