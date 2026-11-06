// ─────────────────────────────────────────────────────────────────
//  PtpCameraProvider — Nikon & generic PTP USB cameras (Android Native)
//
//  Uses native Android UsbManager via PtpUsbModule.
//  Connects via USB-OTG cable to Nikon DSLR / Mirrorless cameras.
// ─────────────────────────────────────────────────────────────────

import { NativeModules, Platform } from 'react-native';
import type {
  CameraProvider,
  CameraStatus,
  CapturedPhoto,
  FilterType,
} from '@happypix/types';

export const PTP_OPCODES = {
  GetDeviceInfo: 0x1001,
  OpenSession: 0x1002,
  CloseSession: 0x1003,
  GetStorageIDs: 0x1004,
  GetStorageInfo: 0x1005,
  InitiateCapture: 0x100E,
  GetDevicePropDesc: 0x1014,
  GetDevicePropValue: 0x1015,
  SetDevicePropValue: 0x1016,
} as const;

export const NIKON_PTP_OPCODES = {
  CheckEvent: 0x90C7,
  DeviceReady: 0x90C8,
  SetControlMode: 0x90C2,
  InitiateCaptureRecInMedia: 0x90C0,
  StartLiveView: 0x9201,
  EndLiveView: 0x9202,
  GetLiveViewImage: 0x9203,
} as const;

const ptpModule = (NativeModules as any)?.PtpUsbModule;

export class PtpCameraProvider implements CameraProvider {
  readonly type = 'ptp' as const;

  private _connected = false;
  private _model = 'Nikon / PTP Camera';

  async connect(): Promise<void> {
    if (Platform.OS !== 'android' || !ptpModule) {
      throw new Error('Direct USB PTP is only supported on Android devices with USB-OTG. Use Nikon Kiosk Bridge for iOS or network tethering.');
    }

    const result = await ptpModule.connect();
    if (result?.connected) {
      this._connected = true;
      this._model = result.model || 'Nikon USB Camera';
    } else {
      throw new Error('Failed to establish USB PTP connection to Nikon camera.');
    }
  }

  async disconnect(): Promise<void> {
    if (ptpModule) {
      await ptpModule.disconnect().catch(() => {});
    }
    this._connected = false;
  }

  async startPreview(): Promise<void> {
    // USB PTP preview
  }

  async stopPreview(): Promise<void> {}

  async capture(): Promise<CapturedPhoto> {
    if (!this._connected || !ptpModule) {
      throw new Error('Nikon USB camera is not connected.');
    }

    const photo = await ptpModule.capture();
    return {
      id: photo.id || `ptp-${Date.now()}`,
      uri: photo.uri,
      dataUrl: photo.dataUrl || photo.uri,
      width: photo.width || 1920,
      height: photo.height || 1080,
      capturedAt: photo.capturedAt || new Date().toISOString(),
    };
  }

  async applyFilter(_filter: FilterType): Promise<void> {}

  async getBattery(): Promise<number> {
    if (ptpModule) {
      const st = await ptpModule.getStatus().catch(() => null);
      return st?.batteryLevel ?? 85;
    }
    return 85;
  }

  async getStatus(): Promise<CameraStatus> {
    if (Platform.OS !== 'android' || !ptpModule) {
      return {
        connected: false,
        type: 'ptp',
        error: 'USB PTP requires Android USB Host mode or Nikon Kiosk Bridge',
      };
    }

    try {
      const st = await ptpModule.getStatus();
      return {
        connected: !!st?.connected,
        type: 'ptp',
        batteryLevel: st?.batteryLevel,
        error: st?.connected ? undefined : 'No USB camera detected',
      };
    } catch (e: any) {
      return {
        connected: false,
        type: 'ptp',
        error: e.message || 'PTP status error',
      };
    }
  }
}
