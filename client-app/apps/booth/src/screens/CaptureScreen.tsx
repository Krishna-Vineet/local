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
  fonts,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
  withKioskFonts,
  resolveSlotCount,
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

  // Same slot count the selection screen and the print use.
  const slots = resolveSlotCount(template as any);
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
  const total = Math.max(1, totalShots);
  // `countdown-flash` font: clamp(90px, 16vw, 230px)
  const countdownSize = Math.max(90, Math.min(230, width * 0.16));
  const reelItems = Array.from({ length: totalShots });

  /** `.film-cell:before/:after` — a strip of sprocket holes. */
  const Sprocket = ({ at }: { at: 'top' | 'bottom' }) => (
    <View style={[styles.sprocket, at === 'top' ? styles.sprocketTop : styles.sprocketBottom]}>
      {Array.from({ length: 9 }).map((_, i) => (
        <View key={i} style={styles.sprocketHole} />
      ))}
    </View>
  );

  return (
    <AppShell night step="camera" bleed stretch testID="camera-screen">
      <View style={[styles.container, { paddingHorizontal: Math.max(14, Math.min(32, width * 0.022)) }]}>
        {/* `.camera-hud` — hardware state left, capture progress right */}
        <View style={styles.hud}>
          <View style={styles.hudLeft}>
            <View style={[styles.hardwareDot, !device && styles.hardwareDotWarning]} />
            <View>
              <Text style={styles.hudName}>{device ? 'Canon EOS · Live view' : 'Capture simulator'}</Text>
              <Text style={styles.hudSmall}>
                {device ? 'Live preview · ready' : 'Fallback simulator active'}
              </Text>
            </View>
          </View>
          <View style={styles.captureProgress}>
            <View style={styles.captureProgressRow}>
              <Text style={styles.captureLabel}>CAPTURE</Text>
              <Text style={styles.captureValue}>
                {photos.length} / {totalShots}
              </Text>
            </View>
            <View style={styles.captureTrack}>
              <View style={[styles.captureFill, { width: `${(photos.length / total) * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* `.camera-workspace` — film reel column (landscape) / strip (portrait) + viewfinder */}
        <View style={[styles.workspace, !isLandscape && styles.workspaceStacked]}>
          <View style={[styles.filmReel, !isLandscape && styles.filmReelStacked]}>
            <Text style={styles.filmLabel}>YOUR SHOTS</Text>
            <View style={[styles.filmTrack, !isLandscape && styles.filmTrackStacked]}>
              {reelItems.map((_, i) => {
                const photo = photos[i];
                const isCurrent = i === photos.length && running;
                return (
                  <View
                    key={i}
                    style={[
                      styles.filmCell,
                      !isLandscape && styles.filmCellStacked,
                      isCurrent && styles.filmCellCurrent,
                    ]}
                  >
                    <Sprocket at="top" />
                    {photo ? (
                      <Image source={{ uri: photo.uri }} resizeMode="cover" style={styles.filmImage} />
                    ) : (
                      <Svg width={20} height={20} viewBox="0 0 24 24">
                        <Path
                          fill="#6f6376"
                          d="M12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm8-5h-3.17L15 5.17C14.65 4.82 14.17 4.63 13.68 4.63h-3.36c-.49 0-.97.19-1.32.54L7.17 7H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"
                        />
                      </Svg>
                    )}
                    <Sprocket at="bottom" />
                    <Text style={styles.filmNum}>{String(i + 1).padStart(2, '0')}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.viewfinder}>
            {/* `.viewfinder-rebate` — the film edge markings around the live feed */}
            <View style={styles.rebate}>
              <Text style={styles.rebateText}>KODAK PORTRA 400</Text>
              <Text style={[styles.rebateText, styles.rebateBrand]}>HAPPYPIX LIVE</Text>
              <Text style={styles.rebateText}>ISO AUTO</Text>
            </View>

            <View style={styles.videoWrap}>
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
                <View style={styles.cameraFallback}>
                  <Svg width={52} height={52} viewBox="0 0 24 24">
                    <Path
                      fill="#8e7e94"
                      d="M12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm8-5h-3.17L15 5.17C14.65 4.82 14.17 4.63 13.68 4.63h-3.36c-.49 0-.97.19-1.32.54L7.17 7H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"
                    />
                  </Svg>
                  <Text style={styles.fallbackTitle}>
                    {hasPermission ? 'Camera warming up' : 'Camera permission needed'}
                  </Text>
                  <Text style={styles.fallbackSmall}>
                    {hasPermission ? 'The live preview appears in a moment' : 'Allow camera access and restart'}
                  </Text>
                </View>
              )}

              {/* `.focus-corner` brackets */}
              <View style={[styles.corner, styles.cornerTL]} pointerEvents="none" />
              <View style={[styles.corner, styles.cornerTR]} pointerEvents="none" />
              <View style={[styles.corner, styles.cornerBL]} pointerEvents="none" />
              <View style={[styles.corner, styles.cornerBR]} pointerEvents="none" />

              {/* `.countdown-flash` — full-frame wash, digit centred */}
              {countdown !== null ? (
                <View style={[styles.countdownOverlay, countdown === 0 && styles.countdownFlash]}>
                  <Text style={[styles.countdownNumber, { fontSize: countdownSize, lineHeight: countdownSize * 1.12 }]}>
                    {countdown > 0 ? countdown : ''}
                  </Text>
                </View>
              ) : null}

              {/* `.shutter-button` — glass pill, white ringed shutter disc */}
              {!running ? (
                <TouchableOpacity style={styles.shutterButton} onPress={startCapture} activeOpacity={0.85}>
                  <View style={styles.shutterDisc}>
                    <Svg width={27} height={27} viewBox="0 0 24 24">
                      <Path
                        fill="#ffffff"
                        d="M12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm8-5h-3.17L15 5.17C14.65 4.82 14.17 4.63 13.68 4.63h-3.36c-.49 0-.97.19-1.32.54L7.17 7H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"
                      />
                    </Svg>
                  </View>
                  <Text style={styles.shutterTitle}>Start shooting</Text>
                  <Text style={styles.shutterSub}>{totalShots} photos · includes extra choices</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.rebate}>
              <Text style={styles.rebateText}>
                EXP {currentShot}/{totalShots}
              </Text>
              <Text style={styles.rebateText}>LOOK HERE &amp; SMILE</Text>
              <Text style={styles.rebateText}>SAFETY FILM</Text>
            </View>
          </View>
        </View>

        <FlashOverlay visible={flash} />
      </View>
    </AppShell>
  );
};

const styles = StyleSheet.create(withKioskFonts({
  container: {
    flex: 1,
    backgroundColor: '#140f17',
  },

  /* ── hud ───────────────────────────────────────────────────────────── */
  hud: {
    height: verticalScale(55),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(20),
  },
  hudLeft: { flexDirection: 'row', alignItems: 'center', gap: scale(10), flexShrink: 1 },
  hardwareDot: {
    width: scale(9),
    height: scale(9),
    borderRadius: scale(4.5),
    backgroundColor: '#39d89f',
    shadowColor: '#39d89f',
    shadowOpacity: 0.9,
    shadowRadius: scale(13),
  },
  hardwareDotWarning: { backgroundColor: '#f0b34c', shadowColor: '#f0b34c' },
  hudName: { fontFamily: fonts.bodyBlack, fontSize: fontSize(11), color: '#f4edf6' },
  hudSmall: { fontFamily: fonts.body, fontSize: fontSize(9), color: '#9b8da4' },
  captureProgress: { width: scale(220), flexShrink: 0 },
  captureProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  captureLabel: {
    fontFamily: fonts.bodyBlack,
    fontSize: fontSize(9),
    letterSpacing: 1.6,
    color: '#9b8da4',
  },
  captureValue: { fontFamily: fonts.bodyBlack, fontSize: fontSize(12), color: '#f4edf6' },
  captureTrack: {
    height: 4,
    marginTop: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#352a3c',
  },
  captureFill: { height: '100%', borderRadius: 999, backgroundColor: '#ee4c96' },

  /* ── workspace ─────────────────────────────────────────────────────── */
  workspace: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    gap: Math.max(15, Math.min(30, scale(24))),
  },
  workspaceStacked: { flexDirection: 'column' },

  /* `.film-reel` */
  filmReel: {
    width: Math.max(145, Math.min(scale(190), 200)),
    paddingVertical: verticalScale(19),
    paddingHorizontal: scale(12),
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#17131b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filmReelStacked: { width: '100%', height: verticalScale(118), paddingVertical: verticalScale(10) },
  filmLabel: {
    marginBottom: verticalScale(11),
    textAlign: 'center',
    fontFamily: fonts.bodyBlack,
    fontSize: fontSize(9),
    letterSpacing: 1.3,
    color: '#c98443',
  },
  filmTrack: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: scale(9) },
  filmTrackStacked: { flexWrap: 'nowrap', flexDirection: 'row' },
  filmCell: {
    width: '46%',
    minHeight: verticalScale(72),
    borderRadius: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#211b26',
    borderWidth: 1,
    borderColor: '#3c3342',
  },
  filmCellStacked: { width: undefined, flex: 1, minHeight: 0 },
  filmCellCurrent: {
    borderColor: '#ee4c96',
    shadowColor: '#ee4c96',
    shadowOpacity: 0.34,
    shadowRadius: 15,
  },
  filmImage: { width: '100%', height: '100%' },
  filmNum: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    fontFamily: fonts.bodyBlack,
    fontSize: fontSize(7),
    color: '#e8a25e',
  },
  sprocket: {
    position: 'absolute',
    left: 2,
    right: 2,
    height: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    opacity: 0.55,
  },
  sprocketTop: { top: 2 },
  sprocketBottom: { bottom: 2 },
  sprocketHole: { width: 5, height: 4, backgroundColor: '#756878' },

  /* `.viewfinder` */
  viewfinder: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#181319',
  },
  rebate: {
    height: verticalScale(28),
    paddingHorizontal: scale(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rebateText: {
    fontFamily: fonts.bodyBlack,
    fontSize: fontSize(8),
    letterSpacing: 0.8,
    color: '#d49350',
  },
  rebateBrand: { color: '#ee8ab8' },
  videoWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#050506',
  },
  cameraFullFrame: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  cameraFallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    backgroundColor: '#0b0810',
  },
  fallbackTitle: { fontFamily: fonts.bodyBlack, fontSize: fontSize(13), color: '#ddd1e2' },
  fallbackSmall: { fontFamily: fonts.body, fontSize: fontSize(10), color: '#7d6e83' },

  corner: { position: 'absolute', width: scale(48), height: scale(48), borderColor: 'rgba(255,255,255,0.72)' },
  cornerTL: { left: scale(24), top: scale(24), borderLeftWidth: 2, borderTopWidth: 2 },
  cornerTR: { right: scale(24), top: scale(24), borderRightWidth: 2, borderTopWidth: 2 },
  cornerBL: { left: scale(24), bottom: scale(24), borderLeftWidth: 2, borderBottomWidth: 2 },
  cornerBR: { right: scale(24), bottom: scale(24), borderRightWidth: 2, borderBottomWidth: 2 },

  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  countdownFlash: { backgroundColor: '#ffffff' },
  countdownNumber: {
    fontFamily: fonts.display,
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 35,
  },

  shutterButton: {
    position: 'absolute',
    left: '50%',
    bottom: '8%',
    marginLeft: -scale(140),
    width: scale(280),
    paddingVertical: verticalScale(13),
    paddingLeft: scale(13),
    paddingRight: scale(24),
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: scale(12),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(15,10,20,0.78)',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 15 },
  },
  shutterDisc: {
    width: scale(58),
    height: scale(58),
    borderRadius: scale(29),
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: '#ee4c96',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterTitle: {
    width: scale(183),
    fontFamily: fonts.bodyBlack,
    fontSize: fontSize(14),
    color: '#ffffff',
  },
  shutterSub: {
    width: scale(183),
    fontFamily: fonts.body,
    fontSize: fontSize(9),
    color: '#bbaec0',
  },
}));
