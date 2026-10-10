import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontSize, scale, verticalScale } from '../../../../packages/ui/src/index';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  secondsLeft?: number;
  step?: string;
  showTimer?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  secondsLeft,
  step,
  showTimer = true,
}) => {
  const isWarning = secondsLeft !== undefined && secondsLeft <= 20;
  const isUrgent = secondsLeft !== undefined && secondsLeft <= 10;
  const shouldRenderTimer = showTimer && secondsLeft !== undefined && secondsLeft > 0;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {/* Left Column: Fixed Width matching Right Column for perfect symmetry */}
        <View style={styles.leftCol}>
          {step ? (
            <View style={styles.stepPill}>
              <Text style={styles.stepPillText}>{step}</Text>
            </View>
          ) : (
            <View style={{ width: 84 }} />
          )}
        </View>

        {/* Center Column: Perfectly centered Title & Subtitle */}
        <View style={styles.centerCol}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right Column: Fixed Width Timer Pill */}
        <View style={styles.rightCol}>
          {shouldRenderTimer ? (
            <View
              style={[
                styles.timerPill,
                isWarning && styles.timerPillWarn,
                isUrgent && styles.timerPillUrgent,
              ]}
            >
              <Text
                style={[
                  styles.timerText,
                  isWarning && styles.timerTextWarn,
                  isUrgent && styles.timerTextUrgent,
                ]}
              >
                ⏳ {secondsLeft}s
              </Text>
            </View>
          ) : (
            <View style={{ width: 84 }} />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(6),
    paddingBottom: verticalScale(12),
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  leftCol: {
    width: 84,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(8),
  },
  rightCol: {
    width: 84,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  stepPill: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  stepPillText: {
    color: '#a78bfa',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    color: '#ffffff',
    fontSize: fontSize(24),
    fontWeight: '900',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: fontSize(13),
    marginTop: 2,
    textAlign: 'center',
  },
  timerPill: {
    width: 78,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181f',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#27272a',
    paddingVertical: 5,
  },
  timerPillWarn: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  timerPillUrgent: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  timerText: {
    color: '#a1a1aa',
    fontSize: fontSize(12),
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  timerTextWarn: {
    color: '#fbbf24',
  },
  timerTextUrgent: {
    color: '#f87171',
  },
});
