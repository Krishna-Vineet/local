// ─────────────────────────────────────────────────────────────────
//  KioskModule — TypeScript bridge
//  Calls the native Android KioskModule (Kotlin) via NativeModules.
//  On iOS (when implemented), same interface via Swift.
// ─────────────────────────────────────────────────────────────────

import { NativeModules, Platform } from 'react-native';

interface NativeKioskModule {
  startKiosk(): Promise<void>;
  stopKiosk(): Promise<void>;
  isKioskEnabled(): Promise<boolean>;
  setImmersiveMode(enabled: boolean): Promise<void>;
  keepScreenOn(enabled: boolean): Promise<void>;
}

const { KioskModule: NativeKiosk } = NativeModules as {
  KioskModule: NativeKioskModule;
};

if (!NativeKiosk) {
  console.warn(
    'KioskModule: Native module not found. Make sure KioskPackage is registered in MainApplication.',
  );
}

export const KioskModule = {
  /**
   * Enter Android Lock Task Mode (kiosk lockdown).
   * Requires the device to be a DPC-admin device or Device Owner.
   * On Samsung devices with Knox, this also hides the navigation bar.
   */
  async startKiosk(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.warn('KioskModule.startKiosk: Android only in V1');
      return;
    }
    return NativeKiosk?.startKiosk();
  },

  /** Exit Lock Task Mode — only works if app is the device owner */
  async stopKiosk(): Promise<void> {
    if (Platform.OS !== 'android') return;
    return NativeKiosk?.stopKiosk();
  },

  /** Returns true if Lock Task Mode is currently active */
  async isKioskEnabled(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    return NativeKiosk?.isKioskEnabled() ?? Promise.resolve(false);
  },

  /** Set full-screen immersive mode (hides status + nav bar) */
  async setImmersiveMode(enabled: boolean): Promise<void> {
    if (Platform.OS !== 'android') return;
    return NativeKiosk?.setImmersiveMode(enabled);
  },

  /** Keep screen always on (prevents sleep during booth session) */
  async keepScreenOn(enabled: boolean): Promise<void> {
    return NativeKiosk?.keepScreenOn(enabled);
  },
};

export type { NativeKioskModule };
