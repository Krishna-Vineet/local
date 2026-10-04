// ─────────────────────────────────────────────────────────────────
//  PtpCameraProvider — STUB
//
//  STATUS: Android USB Host API integration pending.
//  Generic PTP/MTP fallback for any DSLR that doesn't have
//  a first-party SDK (Nikon, Pentax, Sigma, etc.)
//
//  Android: Use USB Host API + PTP packet parsing
//  iOS: Not possible over generic USB in the same way.
//       iOS should prefer WiFi camera APIs instead.
// ─────────────────────────────────────────────────────────────────

import type {
  CameraProvider,
  CameraStatus,
  CapturedPhoto,
  FilterType,
} from '@happypix/types';

export class PtpCameraProvider implements CameraProvider {
  readonly type = 'ptp' as const;

  async connect(): Promise<void> {
    // TODO: Android USB Host API
    // UsbManager.requestPermission(device, pendingIntent);
    // UsbDeviceConnection.controlTransfer(PTP_OPEN_SESSION);
    throw new Error('PtpCameraProvider: Android USB Host integration pending');
  }

  async disconnect(): Promise<void> {
    // TODO: UsbDeviceConnection.close();
  }

  async startPreview(): Promise<void> {
    // TODO: PTP LiveView — camera-specific, not standard PTP
  }

  async stopPreview(): Promise<void> {}

  async capture(): Promise<CapturedPhoto> {
    // TODO: Send PTP InitiateCapture operation (0x100E)
    throw new Error('PtpCameraProvider: Not implemented');
  }

  async applyFilter(_filter: FilterType): Promise<void> {
    // PTP has no standard filter command — apply in post-processing
  }

  async getBattery(): Promise<number> {
    // TODO: PTP GetDevicePropValue(BatteryLevel = 0x5001)
    return 0;
  }

  async getStatus(): Promise<CameraStatus> {
    return {
      connected: false,
      type: 'ptp',
      error: 'PTP provider not yet implemented',
    };
  }
}
