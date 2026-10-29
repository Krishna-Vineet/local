// ─────────────────────────────────────────────────────────────────
//  SonyCameraProvider — STUB
//
//  STATUS: Awaiting Sony Camera Remote SDK license / NDA.
//  The interface is fully implemented so this slot-in is ready.
//  When SDK arrives:
//    1. Add Sony SDK native module (Android: Kotlin, iOS: Swift)
//    2. Replace stub implementations below with real SDK calls
//    3. No UI changes required — UI talks only to CameraManager
//
//  Sony SDK: https://support.d-imaging.sony.co.jp/app/sdk/en/
//  Supported: a7 IV, a7R V, a7C II, FX30, ZV-E1, etc.
// ─────────────────────────────────────────────────────────────────

import type {
  CameraProvider,
  CameraStatus,
  CapturedPhoto,
  FilterType,
} from '@happypix/types';

export class SonyCameraProvider implements CameraProvider {
  readonly type = 'sony' as const;

  async connect(): Promise<void> {
    // TODO: Initialize Sony Camera Remote SDK
    // SonyCameraSDK.initialize();
    // SonyCameraSDK.startRecognition(this.onCameraAdded);
    throw new Error(
      'SonyCameraProvider: SDK not yet available. Awaiting Sony developer license.',
    );
  }

  async disconnect(): Promise<void> {
    // TODO: SonyCameraSDK.release();
  }

  async startPreview(): Promise<void> {
    // TODO: liveViewSurface.start();
  }

  async stopPreview(): Promise<void> {
    // TODO: liveViewSurface.stop();
  }

  async capture(): Promise<CapturedPhoto> {
    // TODO: SonyCameraSDK.getDevice().sendCommand(new CaptureCommand());
    throw new Error('SonyCameraProvider: SDK not available');
  }

  async applyFilter(_filter: FilterType): Promise<void> {
    // Sony supports in-camera creative looks — map FilterType to Sony style
    // TODO: SonyCameraSDK.setCreativeLook(mapFilterToSonyStyle(_filter));
  }

  async getBattery(): Promise<number> {
    // TODO: SonyCameraSDK.getDevice().getBatteryLevel();
    return 0;
  }

  async getStatus(): Promise<CameraStatus> {
    return {
      connected: false,
      type: 'sony',
      error: 'Sony SDK not available — awaiting license',
    };
  }
}
