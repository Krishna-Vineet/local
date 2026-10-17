import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { fontSize, scale, verticalScale } from '../../../../packages/ui/src/index';

export interface InactivityToastProps {
  visible?: boolean;
  secondsLeft?: number;
  onStayActive?: () => void;
}

export const InactivityToast: React.FC<InactivityToastProps> = ({
  visible = true,
  secondsLeft,
  onStayActive,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.toastContainer}>
      <TouchableOpacity
        style={styles.toast}
        onPress={onStayActive}
        activeOpacity={0.9}
      >
        <Text style={styles.toastText}>
          ⏳ {secondsLeft !== undefined ? `${secondsLeft}s left` : 'Session ending soon'} • Tap anywhere to keep going
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: verticalScale(30),
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
  },
  toast: {
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(22),
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
    maxWidth: '90%',
  },
  toastText: {
    color: '#ffffff',
    fontSize: fontSize(13),
    fontWeight: '800',
    textAlign: 'center',
  },
});
