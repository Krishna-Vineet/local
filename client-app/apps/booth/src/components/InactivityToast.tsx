import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, fonts, fontSize, radii, scale, useAppTheme, verticalScale } from '../../../../packages/ui/src/index';
import SoundManager from '../utils/SoundManager';

/**
 * "Session ending soon" pill — the RN counterpart of Electron's `IdleWarning`,
 * but as a toast rather than a blocking overlay (a guest should still be able
 * to finish choosing).
 *
 * It only exists during the last stretch of the idle timer. Earlier this
 * rendered unconditionally, so every screen showed a red warning from the first
 * second, which read like an error. `secondsLeft` is now required for anything
 * to appear at all, and the default threshold matches the kiosk's own warning
 * window.
 */

export interface InactivityToastProps {
  secondsLeft?: number;
  /** seconds remaining at which the toast appears */
  threshold?: number;
  onStayActive?: () => void;
}

const WARN_AT = 20;

export const InactivityToast: React.FC<InactivityToastProps> = ({
  secondsLeft,
  threshold = WARN_AT,
  onStayActive,
}) => {
  const { theme } = useAppTheme();
  const p = theme.palette;

  if (secondsLeft === undefined || secondsLeft > threshold || secondsLeft <= 0) return null;

  const urgent = secondsLeft <= 10;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          SoundManager.play('click');
          onStayActive?.();
        }}
        accessibilityRole="button"
        accessibilityLabel="Keep this session going"
        style={[
          styles.toast,
          {
            backgroundColor: urgent ? p.red : p.ink,
            shadowColor: urgent ? p.red : p.ink,
          },
        ]}
      >
        <Icon name="clock" size={fontSize(15)} color="#ffffff" />
        <Text style={styles.text}>
          {secondsLeft}s left — tap to keep going
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: verticalScale(10),
    alignItems: 'center',
    zIndex: 40,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(9),
    paddingVertical: verticalScale(9),
    paddingHorizontal: scale(18),
    borderRadius: radii.pill,
    shadowOpacity: 0.28,
    shadowRadius: scale(14),
    shadowOffset: { width: 0, height: verticalScale(6) },
    elevation: 8,
  },
  text: {
    color: '#ffffff',
    fontFamily: fonts.bodyHeavy,
    fontSize: fontSize(12),
  },
});

export default InactivityToast;
