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
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import type { CapturedPhoto } from '@happypix/types';
import { cameraManager } from '../../../../packages/camera-core/src/index';
import {
  FlashOverlay,
  Icon,
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
  const { session, updateSession, setIdleTimerEnabled, secondsLeft, resetIdleTimer } = useBooth();
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
    // Keep the safety countdown visible in the header, but do not expire an
    // unattended camera sequence while the booth is automatically capturing.
    resetIdleTimer();
    setIdleTimerEnabled(false);
    return () => setIdleTimerEnabled(false);
  }, [resetIdleTimer, setIdleTimerEnabled]);

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
  // Fit every square into a single vertical film column without making the
  // camera screen itself scroll. Reserve room for the app header, HUD, rebates,
  // reel label and padding; long sessions simply get smaller frames.
  const reelCellSize = Math.max(scale(30), Math.min(scale(170), (height - verticalScale(300)) / totalShots));
  const reelRows: number[][] = Array.from({ length: totalShots }, (_, i) => [i]);

  /** `.film-cell:before/:after` — a strip of sprocket holes. */
  const Sprocket = ({ at }: { at: 'top' | 'bottom' }) => (
    <View style={[styles.sprocket, at === 'top' ? styles.sprocketTop : styles.sprocketBottom]}>
      {Array.from({ length: 9 }).map((_, i) => (
        <View key={i} style={styles.sprocketHole} />
      ))}
    </View>
  );

  return (
    <AppShell night step="camera" secondsLeft={secondsLeft} bleed stretch testID="camera-screen">
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
        <View style={styles.workspace}>
          <View style={styles.filmReel}>
            <Text style={styles.filmLabel}>YOUR SHOTS</Text>
            <View style={styles.filmTrack}>
              {reelRows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.filmRow}>
                  {row.map((i) => {
                    const photo = photos[i];
                    const isCurrent = i === photos.length && running;
                    return (
                      <View
                        key={i}
                        style={[styles.filmCell, { width: reelCellSize, height: reelCellSize }, isCurrent && styles.filmCellCurrent]}
                      >
                        <Sprocket at="top" />
                        {photo ? (
                          <Image source={{ uri: photo.uri }} resizeMode="cover" style={styles.filmImage} />
                        ) : (
                          <Icon name="camera" size={scale(18)} color="#6f6376" strokeWidth={1.6} />
                        )}
                        <Sprocket at="bottom" />
                        <Text style={styles.filmNum}>{String(i + 1).padStart(2, '0')}</Text>
                      </View>
                    );
                  })}
                </View>
              ))}
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
                  <View style={styles.fallbackBadge}>
                    <Icon name="camera" size={scale(34)} color="#c3a9cf" strokeWidth={1.7} />
                  </View>
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
                <View style={styles.shutterDock} pointerEvents="box-none">
                  <TouchableOpacity style={styles.shutterButton} onPress={startCapture} activeOpacity={0.86}>
                    <View style={styles.shutterDisc}>
                      <Icon name="camera" size={scale(26)} color="#ffffff" strokeWidth={2} />
                    </View>
                    <View style={styles.shutterCopy}>
                      <Text style={styles.shutterTitle}>Start shooting</Text>
                      <Text style={styles.shutterSub}>{totalShots} photos · includes extra choices</Text>
                    </View>
                  </TouchableOpacity>
                </View>
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

  /* `.film-reel` */
  filmReel: {
    width: Math.max(128, Math.min(scale(190), 200)),
    paddingVertical: verticalScale(19),
    paddingHorizontal: scale(12),
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#17131b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filmLabel: {
    marginBottom: verticalScale(11),
    textAlign: 'center',
    fontFamily: fonts.bodyBlack,
    fontSize: fontSize(9),
    letterSpacing: 1.3,
    color: '#c98443',
  },
  filmTrack: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'space-around' },
  filmRow: { width: '100%', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  filmCell: {
    // Electron's thumbnails are square; keep each shot in its own column.
    aspectRatio: 1,
    borderRadius: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#211b26',
    borderWidth: 1,
    borderColor: '#3c3342',
  },
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

  /*
   * `.shutter-button` — Electron centres an absolutely-positioned pill on the
   * bottom of the frame. Two things went wrong when this was first ported: the
   * fixed 183 px text columns plus a 58 px disc overran the 280 px pill, so the
   * text wrapped under the disc; and at 0.78 alpha over a bright live feed the
   * pill turned into a muddy blob. Now the pill is sized by its content
   * (`alignSelf: center` inside a full-width dock), the copy is one column, and
   * the background is dark enough to hold white text on any frame.
   */
  shutterDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '8%',
    alignItems: 'center',
  },
  shutterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: scale(12),
    paddingVertical: verticalScale(11),
    paddingLeft: scale(11),
    paddingRight: scale(24),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    backgroundColor: 'rgba(14,9,19,0.90)',
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: scale(28),
    shadowOffset: { width: 0, height: verticalScale(12) },
    elevation: 10,
  },
  shutterDisc: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#ee4c96',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ee4c96',
    shadowOpacity: 0.55,
    shadowRadius: scale(14),
    elevation: 6,
  },
  shutterCopy: { justifyContent: 'center' },
  shutterTitle: {
    fontFamily: fonts.bodyBlack,
    fontSize: fontSize(14),
    letterSpacing: 0.2,
    color: '#ffffff',
  },
  shutterSub: {
    marginTop: verticalScale(2),
    fontFamily: fonts.body,
    fontSize: fontSize(10),
    color: '#bfb0c6',
  },
  fallbackBadge: {
    width: scale(74),
    height: scale(74),
    borderRadius: scale(37),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(195,169,207,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(195,169,207,0.22)',
    marginBottom: verticalScale(4),
  },
}));
