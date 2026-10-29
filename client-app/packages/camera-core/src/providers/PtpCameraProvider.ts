// ─────────────────────────────────────────────────────────────────
//  PtpCameraProvider — Nikon & generic PTP cameras (NOT READY)
//
//  STATUS: no USB transport exists yet. The opcode tables below are
//  correct reference data (PTP 1.1 + Nikon vendor extensions), but
//  no bytes can move until an Android USB Host / desktop transport
//  sends them. A previous version faked the whole session — connect()
//  set a flag, capture() returned a photo with an EMPTY uri — which
//  produced blank "captures" in live sessions. Until the transport
//  lands, every operation FAILS LOUDLY instead.
//
//  Real paths available today:
//    Canon  → Canon CCAPI provider (HTTP/Wi-Fi, any OS)
//    Nikon  → Nikon SDK is desktop-only (Windows/macOS, application
//             process, no vendor support) → Electron host, not mobile
//  To finish this provider: Android UsbManager bulk endpoints, PTP
//  container framing (12-byte header + params), event polling, then
//  GetObject for the captured handle.
// ─────────────────────────────────────────────────────────────────

import type {
  CameraProvider,
  CameraStatus,
  CapturedPhoto,
  FilterType,
} from '@happypix/types';

/** Standard PTP 1.1 Operation Codes (reference for the transport) */
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

/** Nikon Vendor Extended PTP Operation Codes (reference) */
export const NIKON_PTP_OPCODES = {
  CheckEvent: 0x90C7,
  DeviceReady: 0x90C8,
  SetControlMode: 0x90C2,
  InitiateCaptureRecInMedia: 0x90C0,
  StartLiveView: 0x9201,
  EndLiveView: 0x9202,
  GetLiveViewImage: 0x9203,
} as const;

const NOT_READY =
  'PTP/Nikon USB camera support is not ready yet (no USB transport). Connect a Canon camera via Wi-Fi (CCAPI) instead.';

export class PtpCameraProvider implements CameraProvider {
  readonly type = 'ptp' as const;

  private activeFilter: FilterType = 'original';

  async connect(): Promise<void> {
    throw new Error(NOT_READY);
  }

  async disconnect(): Promise<void> {}

  async startPreview(): Promise<void> {
    throw new Error(NOT_READY);
  }

  async stopPreview(): Promise<void> {}

  async capture(): Promise<CapturedPhoto> {
    // Never fabricate a photo: an empty-uri capture poisons the
    // session, the print and the gallery downstream.
    throw new Error(NOT_READY);
  }

  async applyFilter(filter: FilterType): Promise<void> {
    this.activeFilter = filter;
  }

  async getBattery(): Promise<number> {
    throw new Error(NOT_READY);
  }

  async getStatus(): Promise<CameraStatus> {
    return {
      connected: false,
      type: 'ptp',
      batteryLevel: undefined,
      error: NOT_READY,
    };
  }
}
