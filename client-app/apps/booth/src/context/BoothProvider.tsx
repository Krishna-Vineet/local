// ─────────────────────────────────────────────────────────────────
//  BoothProvider — XState machine + device heartbeat
//  Replaces the web BoothContext with XState-driven state.
// ─────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useSelector } from '@xstate/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Actor, createActor } from 'xstate';

import { boothMachine } from '../../../../packages/state-machine/src/index';
import type { BoothContext, BoothEvent } from '../../../../packages/state-machine/src/index';
import { DeviceAPI, EventAPI, configureApi, SettingsAPI } from '../../../../packages/api/src/index';

import { renderEngine, SkiaRenderAdapter } from '../../../../packages/printer-core/src/index';
import Config from 'react-native-config';

// Initialize the Skia rendering adapter for React Native
renderEngine.setAdapter(new SkiaRenderAdapter());

// Configure API Client
const API_URL = process.env.EXPO_PUBLIC_API_URL || Config.BOOTH_API_URL || Config.EXPO_PUBLIC_API_URL || 'https://happypixbackend.vercel.app';
const DEVICE_TOKEN = Config.BOOTH_DEVICE_TOKEN || '';
configureApi(API_URL, DEVICE_TOKEN);

// ── Actor (singleton) ─────────────────────────────────────────────
const boothActor = createActor(boothMachine);
boothActor.start();

// ── Context ────────────────────────────────────────────────────────
interface BoothContextValue {
  state: ReturnType<typeof boothActor.getSnapshot>;
  send: (event: BoothEvent) => void;
}

const BoothContext = createContext<BoothContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────
export const BoothProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const state = useSelector(boothActor, s => s);
  const send = boothActor.send;
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Initial boot: load saved event or fetch admin-assigned ────────
  useEffect(() => {
    const boot = async () => {
      try {
        // Priority 1: Admin-assigned event via device token
        try {
          const res = await DeviceAPI.getCurrentEvent();
          if (res.event) {
            let settings = { printPrice: 100, taxRate: 0, boothTimeout: 30 };
            try {
              settings = await SettingsAPI.getPublic(res.event._id);
            } catch (e) {
              console.warn('Failed to load settings:', e);
            }
            send({ type: 'EVENT_LOADED', event: res.event, settings, isAdminAssigned: true });
            return;
          }
        } catch {}

        // Priority 2: Saved passkey from AsyncStorage
        const saved = await AsyncStorage.getItem('hp_event_auth');
        if (saved) {
          const { eventId, passkey } = JSON.parse(saved);
          try {
            const event = await EventAPI.join({ eventId, passkey });
            let settings = { printPrice: 100, taxRate: 0, boothTimeout: 30 };
            try {
              settings = await SettingsAPI.getPublic(event._id);
            } catch (e) {
              console.warn('Failed to load settings:', e);
            }
            send({ type: 'EVENT_LOADED', event, settings, isAdminAssigned: false });
            return;
          } catch {
            await AsyncStorage.removeItem('hp_event_auth');
          }
        }

        // No event — go to JoinEvent screen
        send({ type: 'DEVICES_READY' });
      } catch (err: any) {
        send({ type: 'EVENT_SYNC_FAILED', error: err.message });
      }
    };

    boot();
  }, []);

  // ── Heartbeat: ping every 30s to detect admin event changes ───────
  // Also refreshes event data every 2 mins to pick up pricing changes from CRM
  const lastEventRefreshRef = useRef<number>(0);
  useEffect(() => {
    const DEVICE_TOKEN = Config.BOOTH_DEVICE_TOKEN ?? '';
    if (!DEVICE_TOKEN) return;

    const ping = async () => {
      try {
        const currentEventId = state.context.activeEvent?._id ?? null;
        const pong = await DeviceAPI.ping({ eventId: currentEventId });

        const assignedId = pong.currentEventId;
        if (assignedId && assignedId !== currentEventId) {
          // Admin changed to a different event
          const res = await DeviceAPI.getCurrentEvent();
          if (res.event) {
            send({ type: 'ADMIN_EVENT_CHANGED', event: res.event });
            lastEventRefreshRef.current = Date.now();
          }
        } else if (!assignedId && state.context.isAdminAssigned) {
          send({ type: 'ADMIN_EVENT_CLEARED' });
        } else if (assignedId && assignedId === currentEventId) {
          // Same event — refresh every 2 minutes to pick up pricing/config changes
          const now = Date.now();
          if (now - lastEventRefreshRef.current > 2 * 60 * 1000) {
            const res = await DeviceAPI.getCurrentEvent();
            if (res.event) {
              send({ type: 'ADMIN_EVENT_CHANGED', event: res.event });
              lastEventRefreshRef.current = now;
            }
          }
        }
      } catch {}
    };

    heartbeatRef.current = setInterval(ping, 30000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [state.context.activeEvent?._id, state.context.isAdminAssigned]);

  return (
    <BoothContext.Provider value={{ state, send }}>
      {children}
    </BoothContext.Provider>
  );
};

// ── Hook ───────────────────────────────────────────────────────────
export const useBooth = (): BoothContextValue => {
  const ctx = useContext(BoothContext);
  if (!ctx) throw new Error('useBooth must be used within BoothProvider');
  return ctx;
};

export type { BoothContext, BoothEvent };
