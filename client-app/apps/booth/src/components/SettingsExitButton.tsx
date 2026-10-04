import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { useBooth } from '../context/BoothProvider';
import { useAppTheme } from '../../../../packages/ui/src/index';

// Cog Settings Icon
const GearIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill={color}>
    <Path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
  </Svg>
);

export const SettingsExitButton = () => {
  const { theme, mode } = useAppTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState('');
  const { state, send } = useBooth();
  const navigation = useNavigation<any>();

  const activeEvent = state.context.activeEvent;
  // Don't render anything if no active event is loaded yet
  if (!activeEvent) return null;

  const handleVerify = async () => {
    const activePasskey = activeEvent.passkey;
    if (!activePasskey) {
      Alert.alert('Error', 'No passkey found for this event. Please contact your administrator.');
      return;
    }

    if (passkeyInput.trim() === activePasskey.trim()) {
      setModalVisible(false);
      setPasskeyInput('');
      
      // Clear the saved current event so the app returns to ClientEvents on next reload
      await AsyncStorage.removeItem('@happypix_current_event');
      
      // Reset navigation stack to ClientEvents
      navigation.reset({
        index: 0,
        routes: [{ name: 'ClientEvents' }],
      });
    } else {
      Alert.alert('Access Denied', 'Incorrect passkey. Please try again.');
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={[styles.floatingButton, { backgroundColor: theme.colors.surfaceSecondary }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <GearIcon color={theme.colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>⚙️ Exit Event Session</Text>
            <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>Enter event passkey to exit and select a different event.</Text>

            <TextInput
              style={[
                styles.passkeyTextInput,
                {
                  backgroundColor: theme.colors.surfaceSecondary,
                  color: theme.colors.text,
                  borderColor: theme.colors.border
                }
              ]}
              value={passkeyInput}
              onChangeText={setPasskeyInput}
              placeholder="Event Passkey..."
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                style={[styles.cancelModalBtn, { backgroundColor: theme.colors.surfaceSecondary }]}
                onPress={() => { setModalVisible(false); setPasskeyInput(''); }}
              >
                <Text style={[styles.cancelModalBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.confirmModalBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleVerify}
              >
                <Text style={styles.confirmModalBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    left: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 440,
    elevation: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  passkeyTextInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1.5,
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 2,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelModalBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelModalBtnText: {
    fontWeight: '700',
    fontSize: 15,
  },
  confirmModalBtn: {
    flex: 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmModalBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
});
