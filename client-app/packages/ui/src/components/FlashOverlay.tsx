import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

interface FlashOverlayProps {
  visible: boolean;
}

export const FlashOverlay: React.FC<FlashOverlayProps> = ({ visible }) => {
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.flash, { opacity: opacityAnim }]}
    />
  );
};

const styles = StyleSheet.create({
  flash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#ffffff',
    zIndex: 999,
  },
});

