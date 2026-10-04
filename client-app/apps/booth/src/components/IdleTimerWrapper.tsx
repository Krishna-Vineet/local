import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, useWindowDimensions } from 'react-native';
import { useBooth } from '../context/BoothProvider';

interface IdleTimerWrapperProps {
  children: React.ReactNode;
  navigationRef: any;
}

export const IdleTimerWrapper: React.FC<IdleTimerWrapperProps> = ({ children, navigationRef }) => {
  const { state, send } = useBooth();
  const timeoutSeconds = state.context.globalSettings?.boothTimeout || 30;

  const [secondsLeft, setSecondsLeft] = useState(timeoutSeconds);
  const [showModal, setShowModal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine if timer should run based on the active screen
  const getActiveRoute = () => {
    try {
      return navigationRef.current?.getCurrentRoute()?.name;
    } catch {
      return null;
    }
  };

  const resetTimer = () => {
    setSecondsLeft(timeoutSeconds);
    setShowModal(false);
  };

  useEffect(() => {
    // Reset timer when transition occurs
    resetTimer();
  }, [state.value]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const currentRoute = getActiveRoute();
      // Only run timer on user-interactive screens, exclude Boot and JoinEvent
      const isTimerActive = currentRoute && ['Boot', 'JoinEvent'].indexOf(currentRoute) === -1;

      if (!isTimerActive) {
        resetTimer();
        return;
      }

      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Perform reset action
          send({ type: 'RESET' });
          try {
            navigationRef.current?.navigate('BoothSetup');
          } catch {}
          return timeoutSeconds;
        }

        const nextSeconds = prev - 1;
        if (nextSeconds <= 10) {
          setShowModal(true);
        } else {
          setShowModal(false);
        }
        return nextSeconds;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.value, timeoutSeconds]);

  // Touch interception wrapper
  const handleTouch = () => {
    resetTimer();
  };

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        handleTouch();
        return false; // Do not consume/block the event so buttons/inputs still work
      }}
    >
      {children}

      {/* Inactivity Dialog Alert Modal overlay */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.warningCard}>
            <Text style={styles.warningIcon}>⚠</Text>
            <Text style={styles.warningCountdown}>{secondsLeft}</Text>
            
            <Text style={styles.warningTitleEn}>Are you still there?</Text>
            <Text style={styles.warningSubEn}>Your session will reset shortly.</Text>
            
            <Text style={styles.warningTitleHi}>क्या आप यहाँ हैं?</Text>
            <Text style={styles.warningSubHi}>सत्र समाप्त होने वाला है।</Text>

            <TouchableOpacity style={styles.activeBtn} onPress={resetTimer}>
              <Text style={styles.activeBtnText}>Keep Session Active / जारी रखें</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  warningCard: {
    backgroundColor: '#18181b',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    borderWidth: 2,
    borderColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  warningIcon: {
    fontSize: 48,
    color: '#f59e0b',
    marginBottom: 8,
  },
  warningCountdown: {
    fontSize: 72,
    fontWeight: '900',
    color: '#ef4444',
    marginBottom: 16,
  },
  warningTitleEn: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  warningSubEn: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  warningTitleHi: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  warningSubHi: {
    fontSize: 12,
    color: '#a1a1aa',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  activeBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  activeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
