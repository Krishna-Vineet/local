import React from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  ViewStyle,
  ScrollView,
} from 'react-native';
import { INTERACTION_ZONE_MAX_WIDTH, scale } from '../utils/responsive';

interface LayoutContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /**
   * FIX: previously this was only forwarded to ScrollView when
   * `scrollable` was true. On non-scrolling kiosk screens it was silently
   * dropped (React Native warns: "contentContainerStyle is not a valid prop"
   * and View ignores it) — so the screens' `flex: 1` layout + padding never
   * applied. It is now applied in both modes.
   */
  contentContainerStyle?: ViewStyle;
  maxWidth?: number;
  scrollable?: boolean;
}

/**
 * A wrapper component that centers content on wide screens and applies
 * an interaction zone constraint.
 */
export const LayoutContainer: React.FC<LayoutContainerProps> = ({
  children,
  style,
  contentContainerStyle,
  maxWidth = INTERACTION_ZONE_MAX_WIDTH,
  scrollable = false,
}) => {
  const { width } = useWindowDimensions();

  // Only apply center constraint if screen is wider than max width
  const isWide = width > maxWidth;

  if (scrollable) {
    return (
      <View style={[styles.outerContainer, style]}>
        <ScrollView
          style={[
            styles.innerContainer,
            isWide && { maxWidth, width: '100%' },
          ]}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.outerContainer, style]}>
      <View
        style={[
          styles.innerContainer,
          isWide && { maxWidth, width: '100%' },
          // Applied to the View itself so non-scroll screens can pass
          // layout (flex, justifyContent) and padding through this prop.
          contentContainerStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: scale(24),
  },
  scrollContent: {
    flexGrow: 1,
  },
});
