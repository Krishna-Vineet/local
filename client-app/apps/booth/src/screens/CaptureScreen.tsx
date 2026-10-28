import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import type { CapturedPhoto } from '@happypix/types';
import { cameraManager } from '../../../../packages/camera-core/src/index';
import {
  FlashOverlay,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { AppShell } from '../components/AppShell';
import { useBooth } from '../context/BoothProvider';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CanonLiveView: React.FC<{ isFocused: boolean; onReady: () => void }> = ({ isFocused, onReady }) => {
  const liveUrl = cameraManager.getLiveViewUrl();
  const [frameTick, setFrameTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    cameraManager.startPreview().then(() => {
      if (mounted) onReady();
    }).catch(() => {});

    const interval = setInterval(() => {
      if (mounted && isFocused) {
        setFrameTick((t) => (t + 1) % 10000);
      }
    }, 120);

    return () => {
      mounted = false;
      clearInterval(interval);
      cameraManager.stopPreview().catch(() => {});
    };
  }, [isFocused]);

  if (!liveUrl) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
        <ActivityIndicator size="large" color="#ee4c96" />
        <Text style={{ color: '#fa7cb6', marginTop: 12, fontSize: 16 }}>Connecting to Canon DSLR Liveview...</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: `${liveUrl}?t=${frameTick}` }}
      style={{ width: '100%', height: '100%' }}
      resizeMode="cover"
    />
  );
};

export const CaptureScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const { session, updateSession, setIdleTimerEnabled } = useBooth();
  const template = session.template;

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isFocused = useIsFocused(); // CRITICAL: Only keep camera hardware active when screen is focused!

  const cameraRef = useRef<Camera>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const frontDevice = useCameraDevice('front', {
    physicalDevices: ['ultra-wide-angle-camera', 'wide-angle-camera'],
  });
  const backDevice = useCameraDevice('back', {
    physicalDevices: ['ultra-wide-angle-camera', 'wide-angle-camera'],
  });
  const device = frontDevice || backDevice;
  const initialZoom = device?.minZoom ?? 1;

  const [cameraReady, setCameraReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);

  const slots = template?.layout?.slots ?? 1;
  const totalShots = Math.max(3, Math.min(10, slots * 2));

  useEffect(() => {
    // Explicitly disable idle timer on camera screen
    setIdleTimerEnabled(false);
    return () => setIdleTimerEnabled(false);
  }, []);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  const activeCameraType = cameraManager.getActiveType();

  const captureFrame = async (index: number): Promise<CapturedPhoto> => {
    if (activeCameraType === 'canon') {
      try {
        const canonPhoto = await cameraManager.capture();
        return {
          id: `photo-${Date.now()}-${index}`,
          uri: canonPhoto.uri,
          dataUrl: canonPhoto.dataUrl || canonPhoto.uri,
          width: canonPhoto.width,
          height: canonPhoto.height,
          capturedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        console.warn('Canon capture error, checking tablet camera fallback:', err);
      }
    }

    if (cameraRef.current && device && isFocused) {
      const file = await cameraRef.current.takePhoto({
        enableShutterSound: false,
      });
      const uri = file.path.startsWith('file://') ? file.path : `file://${file.path}`;
      return {
        id: `photo-${Date.now()}-${index}`,
        uri,
        dataUrl: uri,
        width: file.width,
        height: file.height,
        capturedAt: new Date().toISOString(),
      };
    }
    throw new Error('Camera hardware is unavailable or not ready.');
  };

  const startCapture = async () => {
    if (running) return;
    setRunning(true);
    setPhotos([]);
    const captured: CapturedPhoto[] = [];

    try {
      for (let shot = 0; shot < totalShots; shot += 1) {
        // 3, 2, 1 Countdown with Beeps
        for (let val = 3; val >= 1; val -= 1) {
          setCountdown(val);
          SoundManager.play('beep');
          await wait(750);
        }

        // Shutter & Flash
        setCountdown(0);
        setFlash(true);
        SoundManager.play('shutter');
        SoundManager.haptic(30);

        const photo = await captureFrame(shot);
        captured.push(photo);
        setPhotos([...captured]);

        await wait(350);
        setFlash(false);
        setCountdown(null);
        await wait(600);
      }

      await wait(600);
      updateSession({
        photos: captured,
        selectedPhotos: captured.slice(0, slots),
      });
      navigation.navigate('Photos');
    } catch (err: any) {
      setFlash(false);
      setCountdown(null);
      setRunning(false);
      Alert.alert('Camera Error', err?.message || 'Unable to capture from camera hardware.');
    }
  };

  const currentShot = Math.min(photos.length + 1, totalShots);

  return (
    <AppShell night step="camera" bleed testID="camera-screen">
      <View style={styles.container}>
        {/* Full-Screen Viewfinder — Covers 100% of frame in both Portrait and Landscape */}
        <View style={styles.viewfinderContainer}>
          {activeCameraType === 'canon' ? (
            <CanonLiveView isFocused={isFocused} onReady={() => setCameraReady(true)} />
          ) : hasPermission && device && isFocused ? (
            <Camera
              key={isLandscape ? 'cam-landscape' : 'cam-portrait'}
              ref={cameraRef}
              style={styles.cameraFullFrame}
              device={device}
              zoom={initialZoom}
              enableZoomGesture={true}
              resizeMode="cover"
              androidPreviewViewType="texture-view"
              isActive={isFocused}
              photo={true}
              onInitialized={() => setCameraReady(true)}
            />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <View style={styles.placeholderIconWrap}>
                <Svg width={48} height={48} viewBox="0 0 24 24">
                  <Path
                    fill="#ee4c96"
                    d="M12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm8-7.5h-3.17L15 4.17C14.65 3.82 14.17 3.63 13.68 3.63h-3.36c-.49 0-.97.19-1.32.54L7.17 6H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 13H4V8h3.83l1.83-2h4.68l1.83 2H20v11z"
                  />
                </Svg>
              </View>
              <Text style={styles.placeholderTitle}>Full Widescreen Viewfinder</Text>
              <Text style={styles.placeholderSub}>
                {device ? 'HD Camera active and ready' : 'Simulator HD Feed Active'}
              </Text>
            </View>
          )}

          {/* Viewfinder Grid / Reticle Lines */}
          <View style={[styles.reticle, styles.reticleTL]} pointerEvents="none" />
          <View style={[styles.reticle, styles.reticleTR]} pointerEvents="none" />
          <View style={[styles.reticle, styles.reticleBL]} pointerEvents="none" />
          <View style={[styles.reticle, styles.reticleBR]} pointerEvents="none" />

          {/* Top Floating Status Pill */}
          <View style={styles.topStatusPill}>
            <View style={[styles.statusDot, !device && styles.statusDotSim]} />
            <Text style={styles.statusText}>
              {device ? 'FULL WIDE CAMERA VIEW' : 'SIMULATOR MODE'}
            </Text>
            <Text style={styles.statusDivider}>•</Text>
            <Text style={styles.statusCounter}>
              SHOT {currentShot} OF {totalShots}
            </Text>
          </View>

          {/* Large Countdown Overlay */}
          {countdown !== null && (
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownNumber}>
                {countdown > 0 ? countdown : 'SMILE!'}
              </Text>
            </View>
          )}

          {/* Shutter Button when idle */}
          {!running && (
            <TouchableOpacity
              style={[styles.shutterBtn, !isLandscape && { bottom: verticalScale(96) }]}
              onPress={startCapture}
              activeOpacity={0.85}
            >
              <View style={styles.cameraIconBadge}>
                <Svg width={22} height={22} viewBox="0 0 24 24">
                  <Path
                    fill="#ffffff"
                    d="M12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm8-7.5h-3.17L15 4.17C14.65 3.82 14.17 3.63 13.68 3.63h-3.36c-.49 0-.97.19-1.32.54L7.17 6H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 13H4V8h3.83l1.83-2h4.68l1.83 2H20v11z"
                  />
                </Svg>
              </View>
              <View style={styles.shutterTextGroup}>
                <Text style={styles.shutterTitle}>TAKE PHOTOS</Text>
                <Text style={styles.shutterSub}>
                  {totalShots} rapid shots • Pick your favorites
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Floating Film Strip Overlay (Docked right in landscape so 100% of vertical screen height is given to the camera) */}
          <View style={isLandscape ? styles.sideFilmRail : styles.floatingBottomFilmRail}>
            <View style={isLandscape ? styles.filmThumbsCol : styles.filmThumbsRow}>
              {Array.from({ length: totalShots }).map((_, i) => {
                const photo = photos[i];
                const isCurrent = i === photos.length && running;

                return (
                  <View
                    key={i}
                    style={[
                      styles.thumbCell,
                      isCurrent && styles.thumbCellActive,
                      photo && styles.thumbCellFilled,
                    ]}
                  >
                    <Text style={styles.thumbNum}>
                      {String(i + 1).padStart(2, '0')}
                    </Text>
                    {photo ? (
                      <Image source={{ uri: photo.uri }} resizeMode="cover" style={styles.thumbImage} />
                    ) : (
                      <View style={styles.thumbEmpty} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Full-screen Flash Overlay */}
        <FlashOverlay visible={flash} />
      </View>
    </AppShell>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  topFilmRail: {
    backgroundColor: '#0a0a0e',
    paddingVertical: verticalScale(4),
    paddingHorizontal: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a24',
  },
  rebateMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rebateAmber: {
    color: '#d58b22',
    fontSize: fontSize(9),
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dxBarcode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  barLine: {
    height: 10,
    backgroundColor: '#d58b22',
  },
  sprocketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  sprocketHole: {
    width: scale(14),
    height: scale(9),
    borderRadius: 2.5,
    backgroundColor: '#1f1f2e',
  },
  viewfinderContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#09090f',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraFullFrame: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  cameraPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  placeholderTitle: {
    color: '#ffffff',
    fontSize: fontSize(20),
    fontWeight: '900',
  },
  placeholderSub: {
    color: '#9b8da4',
    fontSize: fontSize(13),
    marginTop: 4,
  },
  reticle: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  reticleTL: { top: 20, left: 20, borderTopWidth: 2.5, borderLeftWidth: 2.5 },
  reticleTR: { top: 20, right: 20, borderTopWidth: 2.5, borderRightWidth: 2.5 },
  reticleBL: { bottom: 20, left: 20, borderBottomWidth: 2.5, borderLeftWidth: 2.5 },
  reticleBR: { bottom: 20, right: 20, borderBottomWidth: 2.5, borderRightWidth: 2.5 },
  topStatusPill: {
    position: 'absolute',
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  statusDotSim: {
    backgroundColor: '#d58b22',
  },
  statusText: {
    color: '#ffffff',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusDivider: {
    color: '#9b8da4',
    marginHorizontal: 8,
  },
  statusCounter: {
    color: '#fa7cb6',
    fontSize: fontSize(11),
    fontWeight: '900',
  },
  countdownBadge: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: verticalScale(20),
    paddingHorizontal: scale(44),
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#ee4c96',
    shadowColor: '#ee4c96',
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 10,
  },
  countdownNumber: {
    color: '#ffffff',
    fontSize: fontSize(64),
    fontWeight: '900',
    letterSpacing: 2,
  },
  shutterBtn: {
    position: 'absolute',
    bottom: verticalScale(24),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ee4c96',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(32),
    borderRadius: 36,
    borderWidth: 2.5,
    borderColor: '#ffffff',
    shadowColor: '#ee4c96',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 8,
  },
  cameraIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
  },
  shutterTextGroup: {
    alignItems: 'flex-start',
  },
  shutterTitle: {
    color: '#ffffff',
    fontSize: fontSize(16),
    fontWeight: '900',
    letterSpacing: 1,
  },
  shutterSub: {
    color: '#281637',
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  bottomFilmRail: {
    backgroundColor: '#0a0a0e',
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(16),
    borderTopWidth: 1,
    borderTopColor: '#1a1a24',
  },
  floatingBottomFilmRail: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(10, 10, 14, 0.72)',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  sideFilmRail: {
    position: 'absolute',
    right: 12,
    top: 52,
    bottom: 16,
    backgroundColor: 'rgba(10, 10, 14, 0.72)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
  },
  filmThumbsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(4),
  },
  filmThumbsCol: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  thumbCell: {
    width: scale(64),
    height: scale(50),
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#222232',
    backgroundColor: '#12121c',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumbCellActive: {
    borderColor: '#ee4c96',
    shadowColor: '#ee4c96',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 4,
  },
  thumbCellFilled: {
    borderColor: '#3f3f50',
  },
  thumbNum: {
    fontSize: fontSize(7),
    fontWeight: '800',
    color: '#9b8da4',
  },
  thumbImage: {
    width: '100%',
    height: '75%',
    borderRadius: 4,
  },
  thumbEmpty: {
    width: '100%',
    height: '75%',
    borderRadius: 4,
    backgroundColor: '#1a1a26',
  },
});
