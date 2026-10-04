import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface CountdownRingProps {
  value: number;
  total: number;
  size?: number;
  color?: string;
}

export const CountdownRing: React.FC<CountdownRingProps> = ({
  value,
  total,
  size = 120,
  color = '#7C3AED',
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.15, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [value]);

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Text style={[styles.num, { fontSize: size * 0.44, color }]}>{value}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  ring: {
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  num: { fontWeight: '900' },
});
