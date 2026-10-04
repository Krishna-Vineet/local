import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontSize, scale, verticalScale } from '../../../../packages/ui/src/index';

interface InactivityToastProps {
  visible: boolean;
}

export const InactivityToast: React.FC<InactivityToastProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <View style={styles.toastContainer} pointerEvents="none">
      <View style={styles.toast}>
        <Text style={styles.toastText}>
          10 seconds remaining, move to next screen or session will reset
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: verticalScale(40),
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
  },
  toast: {
    backgroundColor: '#ef4444',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(24),
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    maxWidth: '90%',
  },
  toastText: {
    color: '#ffffff',
    fontSize: fontSize(14),
    fontWeight: '800',
    textAlign: 'center',
  },
});
