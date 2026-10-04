import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Modal
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventAPI, SettingsAPI, setAuthToken } from '../../../../packages/api/src/index';
import type { ActiveEvent } from '../../../../packages/types/src/index';
import { useBooth } from '../context/BoothProvider';
import type { RootStackParamList } from '../../App';

import { AppLogo } from '../components/AppLogo';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientEvents'>;

export const ClientEventsScreen: React.FC<Props> = ({ navigation }) => {
  const { send } = useBooth();
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<ActiveEvent[]>([]);
  const [search, setSearch] = useState('');
  const [fetching, setFetching] = useState(true);

  // Passkey Modal State
  const [selectedEvent, setSelectedEvent] = useState<ActiveEvent | null>(null);
  const [passkey, setPasskey] = useState('');
  const [joining, setJoining] = useState(false);

  const loadEvents = async () => {
    setFetching(true);
    try {
      const res = await EventAPI.listClientEvents();
      // Keep only active/live/upcoming events or all client events as they prefer
      setEvents(res.events || []);
      setFilteredEvents(res.events || []);
    } catch (err) {
      console.error('Fetch client events failed:', err);
      Alert.alert('Connection Error', 'Could not load events. Please check server status.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Search logic
  useEffect(() => {
    if (!search.trim()) {
      setFilteredEvents(events);
    } else {
      const query = search.toLowerCase();
      const filtered = events.filter(
        e =>
          e.name.toLowerCase().includes(query) ||
          ((e as any).clientName && (e as any).clientName.toLowerCase().includes(query)) ||
          (e.location && e.location.toLowerCase().includes(query))
      );
      setFilteredEvents(filtered);
    }
  }, [search, events]);

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of HappyPix CRM?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('hp_auth_token');
          await AsyncStorage.removeItem('hp_auth_user');
          setAuthToken('');
          navigation.replace('Login');
        },
      },
    ]);
  };

  const handleJoin = async () => {
    if (!selectedEvent || !passkey) return;
    setJoining(true);

    try {
      const event = await EventAPI.join({ eventId: selectedEvent._id, passkey });
      await AsyncStorage.setItem(
        'hp_event_auth',
        JSON.stringify({ eventId: selectedEvent._id, passkey }),
      );

      // Fetch public settings for this event
      let settings = { printPrice: 100, taxRate: 0, boothTimeout: 30 };
      try {
        settings = await SettingsAPI.getPublic(event._id);
      } catch (e) {
        console.warn('Failed to load settings on join:', e);
      }

      send({ type: 'EVENT_LOADED', event, settings, isAdminAssigned: false });
      setSelectedEvent(null);
      setPasskey('');

      // Navigate to Start screen
      navigation.replace('Start');
    } catch (err) {
      Alert.alert('Wrong Passkey', 'Please verify the event passkey and try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AppLogo width={50} height={40} forceDark />
          <View>
            <Text style={styles.badge}>DASHBOARD</Text>
            <Text style={styles.title}>Client Events</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search event name, client, or location..."
        placeholderTextColor="#71717a"
        value={search}
        onChangeText={setSearch}
      />

      {/* Events List */}
      {fetching ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Fetching events list...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={e => e._id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.eventCard}
              onPress={() => setSelectedEvent(item)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.eventName}>{item.name}</Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: item.status === 'live' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(113, 113, 122, 0.1)' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: item.status === 'live' ? '#22c55e' : '#a1a1aa' }
                  ]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.eventMeta}>Client: {(item as any).clientName || 'N/A'}</Text>
              <Text style={styles.eventMeta}>📍 {item.location || 'No Location Specified'}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No events found</Text>
            </View>
          }
        />
      )}

      {/* Passkey Entry Modal */}
      {selectedEvent !== null && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalBadge}>SECURITY LOCK</Text>
            <Text style={styles.modalTitle}>Enter Event Passkey</Text>
            <Text style={styles.modalSub}>{selectedEvent?.name}</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter event passkey"
              placeholderTextColor="#52525b"
              value={passkey}
              onChangeText={setPasskey}
              secureTextEntry
              keyboardType="default"
              maxLength={10}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setSelectedEvent(null); setPasskey(''); }}
                disabled={joining}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.joinBtn, joining && { opacity: 0.7 }]}
                onPress={handleJoin}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.joinBtnText}>Join Booth →</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    padding: 24,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8b5cf6',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 13,
  },
  searchInput: {
    backgroundColor: '#121217',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#22222a',
    color: '#ffffff',
    padding: 16,
    fontSize: 15,
    marginBottom: 20,
  },
  listContainer: {
    paddingBottom: 24,
  },
  eventCard: {
    backgroundColor: '#121217',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#22222a',
    padding: 18,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  eventMeta: {
    color: '#a1a1aa',
    fontSize: 13,
    marginTop: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#71717a',
    marginTop: 12,
    fontSize: 14,
  },
  emptyText: {
    color: '#71717a',
    fontSize: 15,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
  },
  modalCard: {
    backgroundColor: '#121217',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#22222a',
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f59e0b',
    letterSpacing: 2,
    marginBottom: 6,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    color: '#a1a1aa',
    fontSize: 14,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#18181f',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#27272a',
    color: '#ffffff',
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 3,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1a1a24',
    borderWidth: 1.5,
    borderColor: '#27272a',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#a1a1aa',
    fontWeight: '700',
    fontSize: 15,
  },
  joinBtn: {
    flex: 2.5,
    backgroundColor: '#8b5cf6',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  joinBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
