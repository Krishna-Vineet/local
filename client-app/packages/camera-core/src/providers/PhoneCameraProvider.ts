// ─────────────────────────────────────────────────────────────────
//  PhoneCameraProvider
//  Uses react-native-vision-camera for the device's built-in camera.
//  This is the default / fallback provider and requires no SDK.
// ─────────────────────────────────────────────────────────────────

import type {
  CameraProvider,
  CameraStatus,
  CapturedPhoto,
  FilterType,
} from '@happypix/types';

// VisionCamera types — these are resolved in the RN app context
// where react-native-vision-camera is installed.
// We use `any` here to keep the package free of native deps.
type VisionCamera = any;
type CameraRef = { current: VisionCamera | null };

export class PhoneCameraProvider implements CameraProvider {
  readonly type = 'phone' as const;

  private cameraRef: CameraRef = { current: null };
  private _connected = false;
  private _filter: FilterType = 'none';

  /** Pass the ref from the VisionCamera component */
  setCameraRef(ref: CameraRef): void {
    this.cameraRef = ref;
  }

  async connect(): Promise<void> {
    // Permission check happens at the screen level (useCameraPermission)
    // Here we just mark as connected.
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this.cameraRef.current = null;
  }

  async startPreview(): Promise<void> {
    // VisionCamera handles preview rendering via the <Camera> component.
    // No explicit start needed — camera activates when component mounts.
  }

  async stopPreview(): Promise<void> {
    // Set isActive={false} on the Camera component via state.
    // The screen manages this.
  }

  async capture(): Promise<CapturedPhoto> {
    if (!this.cameraRef.current) {
      throw new Error('PhoneCameraProvider: Camera ref not set');
    }
    const photo = await this.cameraRef.current.takePhoto({
      flash: 'off',
      enableAutoRedEyeReduction: false,
    });
    return {
      uri: `file://${photo.path}`,
      width: photo.width,
      height: photo.height,
      timestamp: Date.now(),
      filter: this._filter,
    };
  }

  async applyFilter(filter: FilterType): Promise<void> {
    // Filter is applied via CSS/skia on the preview component
    this._filter = filter;
  }

  async getBattery(): Promise<number> {
    // Battery info not available via VisionCamera — return 100 as placeholder
    return 100;
  }

  async getStatus(): Promise<CameraStatus> {
    return {
      connected: this._connected,
      type: 'phone',
    };
  }
}
