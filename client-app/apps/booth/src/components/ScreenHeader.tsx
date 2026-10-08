import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { fontSize, scale, verticalScale } from '../../../../packages/ui/src/index';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  secondsLeft?: number;
  step?: string;
  rightAction?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  secondsLeft,
  step,
  rightAction,
}) => {
  const isWarning = secondsLeft !== undefined && secondsLeft <= 20;
  const isUrgent = secondsLeft !== undefined && secondsLeft <= 10;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {/* Left: Back button or Step Pill */}
        <View style={styles.leftCol}>
          {onBack ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
          ) : step ? (
            <View style={styles.stepPill}>
              <Text style={styles.stepPillText}>{step}</Text>
            </View>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Center: Title & Subtitle */}
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

        {/* Right: Timer Pill or custom action */}
        <View style={styles.rightCol}>
          {rightAction ? (
            rightAction
          ) : secondsLeft !== undefined && secondsLeft > 0 ? (
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
            <View style={{ width: 40 }} />
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
  },
  leftCol: {
    minWidth: 50,
    alignItems: 'flex-start',
  },
  centerCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: scale(12),
  },
  rightCol: {
    minWidth: 50,
    alignItems: 'flex-end',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#18181f',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  stepPill: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  stepPillText: {
    color: '#a78bfa',
    fontSize: fontSize(11),
    fontWeight: '800',
    letterSpacing: 1,
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
    marginTop: 3,
    textAlign: 'center',
  },
  timerPill: {
    backgroundColor: '#18181f',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#27272a',
    paddingVertical: 5,
    paddingHorizontal: 12,
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
  },
  timerTextWarn: {
    color: '#fbbf24',
  },
  timerTextUrgent: {
    color: '#f87171',
  },
});
