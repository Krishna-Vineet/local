import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
  Image,
  FlatList,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { cameraManager, PhoneCameraProvider } from '../../../../packages/camera-core/src/index';
import {
  ScreenContainer,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
  FlashOverlay,
} from '../../../../packages/ui/src/index';
import { useBooth } from '../context/BoothProvider';
import { UploadAPI } from '../../../../packages/api/src/index';
import { uploadQueue } from '../utils/UploadQueue';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Capture'>;
type Phase = 'ready' | 'shooting' | 'done';

const TICK_MS = 1000;
const MAX_CAPTURE_ATTEMPTS = 2;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const safeSound = (name: 'beep' | 'shutter' | 'click') => {
  try {
    SoundManager.play(name);
  } catch (err) {
    console.warn('[Capture] Sound failed:', err);
  }
};

const safeHaptic = (pattern: number | number[] = 15) => {
  try {
    SoundManager.haptic(pattern);
  } catch (err) {
    console.warn('[Capture] Haptic failed:', err);
  }
};

const getPhotoUri = (photo: any) => {
  if (!photo) return null;
  const path = photo.path || photo.uri;
  return path && (path.startsWith('file://') ? path : `file://${path}`);
};

/* ============================================================
 * SPROCKET HOLE COMPONENTS
 * ============================================================ */

// Vertical column of rounded rectangular sprocket holes (KS-1870 standard style)
const SprocketColumn = ({
  holeColor,
  count = 5,
  spacing = 10,
}: {
  holeColor: string;
  count?: number;
  spacing?: number;
}) => (
  <View style={[styles.sprocketColumnContainer, { gap: verticalScale(spacing) }]}>
    {Array.from({ length: count }).map((_, i) => (
      <View
        key={`sc-${i}`}
        style={[
          styles.sprocketHoleVertical,
          { backgroundColor: holeColor },
        ]}
      />
    ))}
  </View>
);

// Horizontal row of rounded rectangular sprocket holes
const SprocketRow = ({
  holeColor,
  count = 5,
  spacing = 10,
}: {
  holeColor: string;
  count?: number;
  spacing?: number;
}) => (
  <View style={[styles.sprocketRowContainer, { gap: scale(spacing) }]}>
    {Array.from({ length: count }).map((_, i) => (
      <View
        key={`sr-${i}`}
        style={[
          styles.sprocketHoleHorizontal,
          { backgroundColor: holeColor },
        ]}
      />
    ))}
  </View>
);

// Mini DX Barcode graphic in authentic amber
const DxBarcode = () => (
  <View style={styles.barcodeContainer}>
    <View style={[styles.barcodeBar, { width: 1.5, height: 8 }]} />
    <View style={[styles.barcodeBar, { width: 3, height: 8 }]} />
    <View style={[styles.barcodeBar, { width: 1, height: 8 }]} />
    <View style={[styles.barcodeBar, { width: 2, height: 8 }]} />
    <View style={[styles.barcodeBar, { width: 4, height: 8 }]} />
    <View style={[styles.barcodeBar, { width: 1.5, height: 8 }]} />
    <View style={[styles.barcodeBar, { width: 2.5, height: 8 }]} />
  </View>
);

/* ============================================================
 * AUTHENTIC 35MM CAMERA FILM FRAME
 * ============================================================ */

interface CameraFilmFrameProps {
  children: React.ReactNode;
  isLandscape: boolean;
  filmColor: string;
  holeColor: string;
  currentShot: number;
  totalShots: number;
}

const CameraFilmFrame: React.FC<CameraFilmFrameProps> = ({
  children,
  isLandscape,
  filmColor,
  holeColor,
  currentShot,
  totalShots,
}) => {
  const isVerticalSprockets = !isLandscape; // Portrait has sprockets on left/right edges
  const sprocketHoleCount = isLandscape ? 14 : 16;

  return (
    <View
      style={[
        styles.cameraFrameOuter,
        isVerticalSprockets ? styles.cameraFrameRow : styles.cameraFrameCol,
        { backgroundColor: filmColor },
      ]}
    >
      {/* --- EDGE 1: Sprocket Rail (Left in Portrait, Top in Landscape) --- */}
      <View
        style={[
          styles.cameraSprocketRail,
          isVerticalSprockets
            ? styles.cameraSprocketRailVertical
            : styles.cameraSprocketRailHorizontal,
        ]}
      >
        {Array.from({ length: sprocketHoleCount }).map((_, i) => (
          <View
            key={`rail1-${i}`}
            style={[
              isVerticalSprockets
                ? styles.sprocketHoleVertical
                : styles.sprocketHoleHorizontal,
              { backgroundColor: holeColor },
            ]}
          />
        ))}
      </View>

      {/* --- CENTER VIEWPORT CONTAINER --- */}
      <View style={styles.cameraCenterArea}>
        {/* Top Rebate Header: Never clips, horizontal, responsive */}
        <View style={styles.cameraRebateHeader}>
          <View style={styles.rebateHeaderLeft}>
            <Text style={styles.rebateAmberText}>KODAK PORTRA 400</Text>
          </View>
          <View style={styles.rebateHeaderCenter}>
            <DxBarcode />
          </View>
          <View style={styles.rebateHeaderRight}>
            <Text style={styles.rebateAmberText}>ISO 400 / 27°</Text>
          </View>
        </View>

        {/* Viewport Frame with 35mm Reticles */}
        <View style={styles.cameraViewportContainer}>
          {children}

          {/* Authentic Viewfinder Framing Reticles */}
          <View style={styles.viewfinderCornerTL} pointerEvents="none" />
          <View style={styles.viewfinderCornerTR} pointerEvents="none" />
          <View style={styles.viewfinderCornerBL} pointerEvents="none" />
          <View style={styles.viewfinderCornerBR} pointerEvents="none" />

          {/* Center Focus Reticle */}
          <View style={styles.viewfinderCenterReticle} pointerEvents="none">
            <View style={styles.reticleCrossH} />
            <View style={styles.reticleCrossV} />
          </View>
        </View>

        {/* Bottom Rebate Footer: Never clips, horizontal, responsive */}
        <View style={styles.cameraRebateFooter}>
          <View style={styles.rebateFooterLeft}>
            <Text style={styles.rebateAmberText}>▷ {currentShot}A</Text>
          </View>
          <View style={styles.rebateFooterCenter}>
            <Text style={[styles.rebateAmberText, styles.safetyFilmText]}>
              KODAK SAFETY FILM
            </Text>
          </View>
          <View style={styles.rebateFooterRight}>
            <Text style={styles.rebateAmberText}>
              EXP {currentShot}/{totalShots}
            </Text>
          </View>
        </View>
      </View>

      {/* --- EDGE 2: Sprocket Rail (Right in Portrait, Bottom in Landscape) --- */}
      <View
        style={[
          styles.cameraSprocketRail,
          isVerticalSprockets
            ? styles.cameraSprocketRailVertical
            : styles.cameraSprocketRailHorizontal,
        ]}
      >
        {Array.from({ length: sprocketHoleCount }).map((_, i) => (
          <View
            key={`rail2-${i}`}
            style={[
              isVerticalSprockets
                ? styles.sprocketHoleVertical
                : styles.sprocketHoleHorizontal,
              { backgroundColor: holeColor },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

/* ============================================================
 * CAPTURE SCREEN COMPONENT
 * ============================================================ */

export const CaptureScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme, mode } = useAppTheme();
  const { state } = useBooth();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const params = (route as any).params ?? {};

  const { hasPermission, requestPermission } = useCameraPermission();

  const backDevice = useCameraDevice('back');
  const frontDevice = useCameraDevice('front');
  const device = backDevice ?? frontDevice;

  const cameraRef = useRef<Camera>(null);
  const galleryListRef = useRef<FlatList>(null);
  const capturedPhotosRef = useRef<any[]>([]);
  const runningRef = useRef(false);

  const templateFrames = Math.max(1, state?.context?.frames || 4);
  let totalShots = templateFrames * 2;
  if (totalShots < 3) totalShots = 3;
  if (totalShots > 10) totalShots = 10;

  const [phase, setPhase] = useState<Phase>('ready');
  const [countdown, setCountdown] = useState(0);
  const [currentShot, setCurrentShot] = useState(0);
  const [shotsTaken, setShotsTaken] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [flashVisible, setFlashVisible] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  // Animations
  const hudAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Theme film colors
  const filmFrameBg = (theme.colors as any).film || (mode === 'dark' ? '#18181A' : '#cecece');
  const sprocketHoleBg = (theme.colors as any).hole || (mode === 'dark' ? '#52525b' : '#18181A');

  /* ------------------------------------------------------------
   * DYNAMIC 3-FRAME FILM STRIP SIZING
   * ------------------------------------------------------------ */
  const { cellWidth, cellHeight, stripWidth, stripHeight, cellGap } = useMemo(() => {
    const gap = scale(8);
    const stripPadding = scale(8);

    if (isLandscape) {
      // Landscape: Vertical film strip on the left side
      // 3 cells must fit exactly down the content height
      const topHudApproxHeight = verticalScale(75);
      const contentPadding = scale(24);
      const availableContentHeight = Math.max(300, height - topHudApproxHeight - contentPadding);
      const availableStripInnerHeight = availableContentHeight - stripPadding * 2;
      const cHeight = Math.floor((availableStripInnerHeight - 2 * gap) / 3);
      // Photo aspect ratio 3:4 inside cell
      const photoBoxH = Math.max(40, cHeight - verticalScale(14));
      const photoBoxW = Math.round(photoBoxH * (3 / 4));
      const sprocketRailW = scale(18);
      const sWidth = photoBoxW + sprocketRailW * 2 + scale(12);

      return {
        cellWidth: photoBoxW,
        cellHeight: cHeight,
        stripWidth: sWidth,
        stripHeight: '100%' as any,
        cellGap: gap,
      };
    } else {
      // Portrait: Horizontal film strip across the bottom
      // 3 cells must fit exactly across the content width
      const contentPadding = scale(24);
      const availableStripInnerWidth = Math.max(300, width - contentPadding - stripPadding * 2);
      const cWidth = Math.floor((availableStripInnerWidth - 2 * gap) / 3);
      // Photo aspect ratio 3:4 inside cell
      const photoBoxW = Math.max(40, cWidth - scale(10));
      const photoBoxH = Math.round(photoBoxW * (4 / 3));
      const sprocketRailH = verticalScale(18);
      const sHeight = photoBoxH + sprocketRailH * 2 + verticalScale(16);

      return {
        cellWidth: cWidth,
        cellHeight: photoBoxH,
        stripWidth: '100%' as any,
        stripHeight: sHeight,
        cellGap: gap,
      };
    }
  }, [width, height, isLandscape]);

  const snapInterval = isLandscape ? cellHeight + cellGap : cellWidth + cellGap;

  // Gallery items for the session: length of totalShots
  const sessionGalleryData = useMemo(() => {
    return Array.from({ length: totalShots }).map((_, index) => {
      const photo = capturedPhotosRef.current[index] || null;
      const isCaptured = index < shotsTaken;
      const isExposing = index === shotsTaken && isRunning;
      return {
        index,
        frameNum: index + 1,
        photo,
        isCaptured,
        isExposing,
      };
    });
  }, [totalShots, shotsTaken, isRunning]);

  // Smoothly scroll the film strip by exactly 1 block ahead after the 3rd shot
  useEffect(() => {
    if (shotsTaken >= 3 && galleryListRef.current) {
      const timer = setTimeout(() => {
        try {
          const maxScrollIndex = Math.max(0, totalShots - 3);
          const targetIndex = Math.min(maxScrollIndex, Math.max(0, shotsTaken - 2));
          galleryListRef.current?.scrollToOffset({
            offset: targetIndex * snapInterval,
            animated: true,
          });
        } catch {
          // Fallback if list not ready
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [shotsTaken, totalShots, snapInterval]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
    StatusBar.setHidden(true);

    try {
      const provider = cameraManager['allProviders']?.get('phone') as PhoneCameraProvider | undefined;
      if (provider) {
        provider.setCameraRef(cameraRef);
        setCameraReady(true);
      }
    } catch (err) {
      console.warn('[Capture] Phone provider setup failed:', err);
    }

    Animated.timing(hudAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    return () => {
      StatusBar.setHidden(false);
      try {
        const provider = cameraManager['allProviders']?.get('phone') as PhoneCameraProvider | undefined;
        if (provider) provider.setCameraRef(null as any);
      } catch (err) {
        console.warn('[Capture] Failed to clear camera ref:', err);
      }
    };
  }, [hasPermission]);

  const runCountdown = useCallback(async () => {
    for (let i = 3; i >= 1; i -= 1) {
      setCountdown(i);
      safeSound('beep');
      await sleep(TICK_MS);
    }
    setCountdown(0);
  }, []);

  const captureOne = useCallback(async (): Promise<boolean> => {
    if (!cameraRef.current || !cameraReady) return false;
    try {
      const photo = await cameraRef.current.takePhoto({ enableShutterSound: false });
      if (!photo) return false;
      
      const uri = getPhotoUri(photo);
      if (uri) {
        const eventId = state?.context?.activeEvent?._id;
        uploadQueue.addTask(uri, eventId, false);
      }

      capturedPhotosRef.current.push(photo);
      return true;
    } catch (err) {
      console.error('[Capture] Capture failed:', err);
      return false;
    }
  }, [cameraReady, state?.context?.activeEvent?._id]);

  const startSession = useCallback(async () => {
    if (runningRef.current || !cameraReady) return;

    runningRef.current = true;
    setIsRunning(true);
    capturedPhotosRef.current = [];
    setShotsTaken(0);
    setCurrentShot(0);
    galleryListRef.current?.scrollToOffset({ offset: 0, animated: false });

    try {
      for (let shot = 1; shot <= totalShots; shot += 1) {
        setPhase('shooting');
        setCurrentShot(shot);

        let captured = false;
        for (let attempt = 1; attempt <= MAX_CAPTURE_ATTEMPTS && !captured; attempt += 1) {
          await runCountdown();
          setFlashVisible(true);
          safeSound('shutter');
          safeHaptic([10, 50, 10]);
          captured = await captureOne();
          setTimeout(() => setFlashVisible(false), 250);
          if (!captured && attempt < MAX_CAPTURE_ATTEMPTS) await sleep(600);
        }

        if (captured) setShotsTaken((s) => Math.min(totalShots, s + 1));
      }

      setPhase('done');
      await sleep(900);

      try {
        const isPreviewEnabled =
          !state.context.activeEvent?.selectedScreens ||
          state.context.activeEvent.selectedScreens.includes('preview');
        if (isPreviewEnabled) {
          navigation.replace('PhotoSelection' as any, {
            ...params,
            images: capturedPhotosRef.current.slice(0, totalShots),
          });
        } else {
          const selectedImages = capturedPhotosRef.current.slice(0, templateFrames);
          navigation.replace('Customize' as any, {
            ...params,
            images: capturedPhotosRef.current.slice(0, totalShots),
            selectedImages,
          });
        }
      } catch (err) {
        console.error('[Capture] Navigation failed:', err);
      }
    } finally {
      runningRef.current = false;
      setIsRunning(false);
    }
  }, [totalShots, runCountdown, captureOne, navigation, params, cameraReady]);

  if (!hasPermission || !device) {
    return (
      <ScreenContainer style={styles.center}>
        <Text style={{ color: theme.colors.error, fontSize: fontSize(18), fontWeight: '900' }}>
          {hasPermission ? 'CAMERA UNAVAILABLE' : 'REQUESTING CAMERA ACCESS…'}
        </Text>
      </ScreenContainer>
    );
  }

  const statusLabel = phase === 'ready' ? 'Ready' : phase === 'shooting' ? 'Shooting' : 'Done';
  const displayCurrentShot = Math.min(currentShot > 0 ? currentShot : 1, totalShots);

  /* ------------------------------------------------------------
   * RENDER REEL FRAME CELL (Always fits 3 on screen)
   * ------------------------------------------------------------ */
  const renderGalleryCell = ({ item }: { item: any }) => {
    const isVertical = isLandscape; // Landscape = vertical reel; Portrait = horizontal reel

    return (
      <View
        style={[
          styles.cellOuter,
          isVertical
            ? { height: cellHeight, width: '100%', flexDirection: 'row' }
            : { width: cellWidth, height: '100%', flexDirection: 'column' },
        ]}
      >
        {/* Sprocket Edge 1 */}
        {isVertical ? (
          <SprocketColumn holeColor={sprocketHoleBg} count={4} spacing={8} />
        ) : (
          <SprocketRow holeColor={sprocketHoleBg} count={4} spacing={8} />
        )}

        {/* Photo Container */}
        <View style={styles.cellFrameWrapper}>
          {/* Frame Number Stamp */}
          <View style={styles.cellFrameHeader}>
            <Text style={styles.cellFrameStampText}>▷ {item.frameNum < 10 ? `0${item.frameNum}` : item.frameNum}</Text>
            {item.isCaptured && <Text style={styles.cellFrameStampText}>✓</Text>}
          </View>

          {/* Photo or Unexposed Negative Box */}
          <View
            style={[
              styles.cellPhotoBox,
              item.isExposing && styles.cellPhotoBoxExposing,
            ]}
          >
            {item.photo ? (
              <Image
                source={{ uri: getPhotoUri(item.photo) }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.unexposedPlaceholder}>
                <Text style={styles.placeholderFrameNumber}>
                  {item.frameNum < 10 ? `0${item.frameNum}` : item.frameNum}
                </Text>
                <Text style={styles.placeholderLabel}>
                  {item.isExposing ? 'EXPOSING…' : 'READY'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Sprocket Edge 2 */}
        {isVertical ? (
          <SprocketColumn holeColor={sprocketHoleBg} count={4} spacing={8} />
        ) : (
          <SprocketRow holeColor={sprocketHoleBg} count={4} spacing={8} />
        )}
      </View>
    );
  };

  return (
    <ScreenContainer style={styles.container}>
      <FlashOverlay visible={flashVisible} />

      {/* ====================================================== */}
      {/* TOP HUD */}
      {/* ====================================================== */}
      <Animated.View style={[styles.topHud, { opacity: hudAnim }]}>
        <View
          style={[
            styles.hudPillContainer,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <View style={styles.hudSection}>
            <Text style={[styles.hudTextSecondary, { color: theme.colors.textSecondary }]}>
              CAPTURING
            </Text>
            <Text style={[styles.hudTextPrimary, { color: theme.colors.text }]}>
              {displayCurrentShot} of {totalShots}
            </Text>
          </View>
          <View style={[styles.hudDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.hudSection}>
            <Text style={[styles.hudTextSecondary, { color: theme.colors.textSecondary }]}>
              STATUS
            </Text>
            <Text style={[styles.hudTextPrimary, { color: theme.colors.text }]}>
              {statusLabel}
            </Text>
          </View>

          {/* Progress Bar Underneath Pill */}
          <View style={styles.hudProgressBarContainer}>
            <View
              style={[
                styles.hudProgressBarFill,
                {
                  width: `${(shotsTaken / totalShots) * 100}%`,
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
          </View>
        </View>
      </Animated.View>

      {/* ====================================================== */}
      {/* MAIN WORKSPACE: REEL FILM & CAMERA */}
      {/* ====================================================== */}
      <View style={[styles.contentArea, isLandscape ? styles.layoutRow : styles.layoutColumn]}>
        {/* --- 3-FRAME CONTINUOUS FILM REEL STRIP --- */}
        <View
          style={[
            styles.galleryStripContainer,
            {
              width: stripWidth,
              height: stripHeight,
              backgroundColor: filmFrameBg,
            },
          ]}
        >
          <FlatList
            ref={galleryListRef}
            data={sessionGalleryData}
            keyExtractor={(item) => `frame-${item.index}`}
            renderItem={renderGalleryCell}
            horizontal={!isLandscape}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            snapToInterval={snapInterval}
            decelerationRate="fast"
            snapToAlignment="start"
            getItemLayout={(_, index) => ({
              length: snapInterval,
              offset: snapInterval * index,
              index,
            })}
            contentContainerStyle={
              isLandscape ? styles.galleryContentVertical : styles.galleryContentHorizontal
            }
            ItemSeparatorComponent={() => <View style={{ width: cellGap, height: cellGap }} />}
            bounces={false}
          />
        </View>

        {/* --- MAIN CAMERA VIEWPORT WITH 35MM REBATE --- */}
        <View style={styles.cameraFlexContainer}>
          <CameraFilmFrame
            isLandscape={isLandscape}
            filmColor={filmFrameBg}
            holeColor={sprocketHoleBg}
            currentShot={displayCurrentShot}
            totalShots={totalShots}
          >
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={true}
              photo={true}
              onInitialized={() => setCameraReady(true)}
            />

            {/* Glowing Shutter Start Button Overlay */}
            {phase === 'ready' && (
              <View style={styles.overlayCenter}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    disabled={isRunning || !cameraReady}
                    style={[styles.startButton, { backgroundColor: theme.colors.primary }]}
                    onPress={startSession}
                  >
                    <View style={styles.startButtonInnerRing}>
                      <Text style={styles.startButtonText}>START SHOOTING</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}

            {/* Giant Cinematic Countdown Overlay */}
            {phase !== 'ready' && countdown > 0 && (
              <View style={styles.overlayCenter} pointerEvents="none">
                <Text style={styles.countdownGiant}>{countdown}</Text>
              </View>
            )}
          </CameraFilmFrame>
        </View>
      </View>
    </ScreenContainer>
  );
};

/* ============================================================
 * STYLES
 * ============================================================ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Main workspace setup
  contentArea: {
    flex: 1,
    width: '100%',
    height: '100%',
    padding: scale(12),
    paddingTop: 0,
    gap: scale(12),
  },
  layoutRow: { flexDirection: 'row', alignItems: 'stretch' },
  layoutColumn: { flexDirection: 'column-reverse', alignItems: 'stretch' },

  // Top HUD
  topHud: {
    alignItems: 'center',
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(10),
    zIndex: 10,
  },
  hudPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: moderateScale(25),
    overflow: 'hidden',
  },
  hudSection: {
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(22),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(120),
  },
  hudDivider: { width: 1, height: '70%' },
  hudTextSecondary: {
    fontSize: fontSize(9),
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: verticalScale(2),
    fontWeight: '700',
  },
  hudTextPrimary: { fontSize: fontSize(15), fontWeight: '800', letterSpacing: 0.5 },
  hudProgressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  hudProgressBarFill: { height: '100%' },

  // Continuous Film Reel Gallery Strip
  galleryStripContainer: {
    borderRadius: moderateScale(10),
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  galleryContentVertical: {
    paddingVertical: scale(8),
    paddingHorizontal: scale(4),
  },
  galleryContentHorizontal: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
  },

  cellOuter: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cellFrameWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    padding: scale(3),
    justifyContent: 'center',
  },
  cellFrameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scale(4),
    marginBottom: verticalScale(2),
  },
  cellFrameStampText: {
    fontSize: fontSize(8),
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1,
  },
  cellPhotoBox: {
    flex: 1,
    borderRadius: moderateScale(4),
    overflow: 'hidden',
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cellPhotoBoxExposing: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  unexposedPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141416',
  },
  placeholderFrameNumber: {
    fontSize: fontSize(20),
    fontWeight: '900',
    color: 'rgba(245, 158, 11, 0.25)',
    letterSpacing: 1,
  },
  placeholderLabel: {
    fontSize: fontSize(7),
    fontWeight: '800',
    color: 'rgba(245, 158, 11, 0.5)',
    letterSpacing: 1.5,
    marginTop: verticalScale(2),
    textTransform: 'uppercase',
  },

  // Sprockets: rounded rectangular perforations (KS-1870 look)
  sprocketColumnContainer: {
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: scale(4),
    paddingVertical: verticalScale(2),
  },
  sprocketRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: verticalScale(3),
    paddingHorizontal: scale(2),
  },
  sprocketHoleVertical: {
    width: scale(7),
    height: verticalScale(11),
    borderRadius: moderateScale(2.5),
    borderWidth: 0.8,
    borderColor: 'rgba(0, 0, 0, 0.45)',
  },
  sprocketHoleHorizontal: {
    width: scale(11),
    height: verticalScale(7),
    borderRadius: moderateScale(2.5),
    borderWidth: 0.8,
    borderColor: 'rgba(0, 0, 0, 0.45)',
  },

  // Barcode Graphic
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
  },
  barcodeBar: {
    backgroundColor: '#F59E0B',
    borderRadius: 0.5,
  },

  // Camera Film Frame
  cameraFlexContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraFrameOuter: {
    width: '100%',
    height: '100%',
    borderRadius: moderateScale(10),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  cameraFrameRow: { flexDirection: 'row' },
  cameraFrameCol: { flexDirection: 'column' },

  cameraSprocketRail: {
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  cameraSprocketRailVertical: {
    width: scale(22),
    height: '100%',
    paddingVertical: verticalScale(8),
  },
  cameraSprocketRailHorizontal: {
    height: verticalScale(22),
    width: '100%',
    flexDirection: 'row',
    paddingHorizontal: scale(8),
  },

  cameraCenterArea: {
    flex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
    padding: scale(4),
  },
  cameraRebateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
  },
  cameraRebateFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
  },
  rebateHeaderLeft: { flex: 1 },
  rebateHeaderCenter: { alignItems: 'center' },
  rebateHeaderRight: { flex: 1, alignItems: 'flex-end' },
  rebateFooterLeft: { flex: 1 },
  rebateFooterCenter: { alignItems: 'center' },
  rebateFooterRight: { flex: 1, alignItems: 'flex-end' },

  rebateAmberText: {
    color: '#F59E0B',
    fontSize: fontSize(8.5),
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  safetyFilmText: {
    letterSpacing: 2,
    fontWeight: '900',
  },

  cameraViewportContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: moderateScale(6),
    overflow: 'hidden',
    position: 'relative',
  },

  // Viewfinder Corner Brackets
  viewfinderCornerTL: {
    position: 'absolute',
    top: scale(12),
    left: scale(12),
    width: scale(18),
    height: scale(18),
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderTopLeftRadius: 3,
    zIndex: 4,
  },
  viewfinderCornerTR: {
    position: 'absolute',
    top: scale(12),
    right: scale(12),
    width: scale(18),
    height: scale(18),
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderTopRightRadius: 3,
    zIndex: 4,
  },
  viewfinderCornerBL: {
    position: 'absolute',
    bottom: scale(12),
    left: scale(12),
    width: scale(18),
    height: scale(18),
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderBottomLeftRadius: 3,
    zIndex: 4,
  },
  viewfinderCornerBR: {
    position: 'absolute',
    bottom: scale(12),
    right: scale(12),
    width: scale(18),
    height: scale(18),
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderBottomRightRadius: 3,
    zIndex: 4,
  },
  viewfinderCenterReticle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: scale(20),
    height: scale(20),
    marginLeft: -scale(10),
    marginTop: -scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  reticleCrossH: {
    position: 'absolute',
    width: scale(16),
    height: 1.5,
    backgroundColor: 'rgba(245, 158, 11, 0.4)',
  },
  reticleCrossV: {
    position: 'absolute',
    height: scale(16),
    width: 1.5,
    backgroundColor: 'rgba(245, 158, 11, 0.4)',
  },

  // Overlays
  overlayCenter: {
    ...(StyleSheet.absoluteFill as any),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  countdownGiant: {
    fontSize: fontSize(160),
    fontWeight: '900',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 24,
    letterSpacing: -6,
  },

  startButton: {
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(40),
    borderRadius: moderateScale(60),
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  startButtonInnerRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#FFF',
    fontSize: fontSize(18),
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});