import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Customization, FilterId, OrnamentId, PlacedSticker } from '@happypix/types';
import {
  ScreenContainer,
  LayoutContainer,
  TemplateCanvas,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { useBooth } from '../context/BoothProvider';
import { ScreenHeader } from '../components/ScreenHeader';
import SoundManager from '../utils/SoundManager';
import { InactivityToast } from '../components/InactivityToast';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Customize'>;
type TabId = 'patterns' | 'filters' | 'stickers' | 'logos' | 'text';

const ORNAMENTS: { id: OrnamentId; label: string; symbol: string; desc: string }[] = [
  { id: 'none', label: 'Clean', symbol: '○', desc: 'No background motifs' },
  { id: 'hearts', label: 'Hearts', symbol: '♡', desc: 'Corner flourishes & floating hearts' },
  { id: 'stars', label: 'Stars', symbol: '✦', desc: 'Starlight sparkles & constellations' },
  { id: 'bubbles', label: 'Bubbles', symbol: '◌', desc: 'Translucent floating bubbles' },
  { id: 'confetti', label: 'Confetti', symbol: '⌁', desc: 'Festive ribbons & party shapes' },
];

const FRAME_COLORS = [
  { name: 'Original', hex: '' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Pure Dark', hex: '#0f0f14' },
  { name: 'Blush Pink', hex: '#ffe4e6' },
  { name: 'Lavender', hex: '#ede9fe' },
  { name: 'Mint', hex: '#dcfce7' },
  { name: 'Sky', hex: '#e0f2fe' },
];

const FILTERS: { id: FilterId; label: string; color: string; desc: string }[] = [
  { id: 'original', label: 'Natural', color: '#a1a1aa', desc: 'True natural tones' },
  { id: 'warm', label: 'Warm Sun', color: '#f59e0b', desc: 'Golden amber glow' },
  { id: 'cool', label: 'Cool Breeze', color: '#0ea5e9', desc: 'Fresh oceanic blues' },
  { id: 'bw', label: 'Classic B&W', color: '#3f3f46', desc: 'High-contrast monochrome' },
  { id: 'vintage', label: 'Vintage Film', color: '#b45309', desc: 'Warm retro sepia' },
  { id: 'soft', label: 'Soft Dream', color: '#f472b6', desc: 'Dreamy pastel glow' },
  { id: 'party', label: 'Party Pop', color: '#ec4899', desc: 'Vibrant punchy colors' },
];

const EMOJIS = ['❤️', '✨', '🎉', '📸', '👑', '🦋', '🌸', '🥳', '💍', '🥂', '🔥', '⭐'];

// ── Interactive Draggable and Resizable Sticker Component ─────────
interface StickerItemProps {
  sticker: PlacedSticker;
  canvasWidth: number;
  canvasHeight: number;
  onUpdate: (id: string, x: number, y: number, size: number) => void;
  onRemove: (id: string) => void;
}

const InteractiveSticker: React.FC<StickerItemProps> = ({
  sticker,
  canvasWidth,
  canvasHeight,
  onUpdate,
  onRemove,
}) => {
  const [size, setSize] = useState(sticker.size || 34);
  const [posX, setPosX] = useState(sticker.x); // percentage (0..100)
  const [posY, setPosY] = useState(sticker.y);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const deltaXPercent = (gestureState.dx / canvasWidth) * 100;
        const deltaYPercent = (gestureState.dy / canvasHeight) * 100;
        const newX = Math.max(0, Math.min(88, posX + deltaXPercent));
        const newY = Math.max(0, Math.min(88, posY + deltaYPercent));
        onUpdate(sticker.id, newX, newY, size);
      },
      onPanResponderRelease: (_, gestureState) => {
        const deltaXPercent = (gestureState.dx / canvasWidth) * 100;
        const deltaYPercent = (gestureState.dy / canvasHeight) * 100;
        const finalX = Math.max(0, Math.min(88, posX + deltaXPercent));
        const finalY = Math.max(0, Math.min(88, posY + deltaYPercent));
        setPosX(finalX);
        setPosY(finalY);
        onUpdate(sticker.id, finalX, finalY, size);
      },
    })
  ).current;

  const handleEnlarge = () => {
    SoundManager.play('click');
    const newSize = Math.min(64, size + 8);
    setSize(newSize);
    onUpdate(sticker.id, posX, posY, newSize);
  };

  const handleShrink = () => {
    SoundManager.play('click');
    const newSize = Math.max(20, size - 8);
    setSize(newSize);
    onUpdate(sticker.id, posX, posY, newSize);
  };

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.interactiveStickerContainer,
        {
          left: `${sticker.x}%` as any,
          top: `${sticker.y}%` as any,
        },
      ]}
    >
      <Text style={{ fontSize: size }}>{sticker.emoji}</Text>

      {/* Floating Controls for Delete & Resize */}
      <View style={styles.stickerToolbar}>
        <TouchableOpacity
          onPress={() => onRemove(sticker.id)}
          style={styles.stickerDeleteBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.stickerBtnText}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleEnlarge}
          style={styles.stickerScaleBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.stickerBtnText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleShrink}
          style={styles.stickerScaleBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.stickerBtnText}>−</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const CustomizeScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const {
    snapshot,
    session,
    updateSession,
    finishAndPrint,
    setIdleTimerEnabled,
    secondsLeft,
    resetIdleTimer,
    resetGuestSession,
  } = useBooth();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > 700;

  const event = snapshot?.event;
  const template = session.template;
  const photos = session.selectedPhotos || [];
  const customization = session.customization;

  const orgName = snapshot?.settings?.organizationName || snapshot?.organization?.name || 'HappyPix';
  const galleryEnabled = snapshot?.settings?.galleryEnabled !== false;

  const [activeTab, setActiveTab] = useState<TabId>('patterns');
  const [printing, setPrinting] = useState(false);
  const [guestConsent, setGuestConsent] = useState(
    customization.guestConsent !== undefined ? customization.guestConsent : true
  );

  useEffect(() => {
    setIdleTimerEnabled(true);
    resetIdleTimer();
    return () => setIdleTimerEnabled(false);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0 && !printing) {
      resetGuestSession(navigation);
    }
  }, [secondsLeft, printing]);

  // Safe navigation redirect outside render phase
  useEffect(() => {
    if (!template) {
      navigation.replace('Templates');
    }
  }, [template, navigation]);

  if (!template) {
    return null;
  }

  const isPortraitTemplate = template.layout.orientation === 'portrait';
  const canvasWidth = isLandscape
    ? isPortraitTemplate
      ? scale(220)
      : scale(310)
    : isPortraitTemplate
    ? scale(200)
    : scale(270);
  const canvasHeight = isLandscape
    ? isPortraitTemplate
      ? verticalScale(310)
      : verticalScale(210)
    : isPortraitTemplate
    ? verticalScale(270)
    : verticalScale(185);

  const lastStickerAddRef = useRef(0);

  const update = (patch: Partial<Customization>) => {
    SoundManager.play('click');
    updateSession({
      customization: { ...customization, ...patch },
    });
  };

  const addSticker = (emoji: string) => {
    const now = Date.now();
    if (now - lastStickerAddRef.current < 350) return; // Prevent double taps
    lastStickerAddRef.current = now;

    SoundManager.play('click');
    const newSticker: PlacedSticker = {
      id: `st-${now}-${customization.stickers.length}`,
      emoji,
      x: 35 + (customization.stickers.length % 4) * 8,
      y: 35 + (customization.stickers.length % 4) * 8,
      size: 36,
    };
    update({ stickers: [...customization.stickers, newSticker] });
  };

  const handleUpdateSticker = (id: string, x: number, y: number, size: number) => {
    const updated = customization.stickers.map((st) =>
      st.id === id ? { ...st, x, y, size } : st
    );
    updateSession({
      customization: { ...customization, stickers: updated },
    });
  };

  const handleRemoveSticker = (id: string) => {
    SoundManager.play('click');
    const filtered = customization.stickers.filter((st) => st.id !== id);
    update({ stickers: filtered });
  };

  const handleToggleConsent = () => {
    SoundManager.play('click');
    const next = !guestConsent;
    setGuestConsent(next);
    update({ guestConsent: next });
  };

  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    SoundManager.play('click');

    try {
      updateSession({
        customization: { ...customization, guestConsent },
      });
      await finishAndPrint();
      navigation.navigate('OrderSuccess');
    } catch (e) {
      navigation.navigate('OrderSuccess');
    } finally {
      setPrinting(false);
    }
  };

  const handleBack = () => {
    SoundManager.play('click');
    navigation.goBack();
  };

  const availableLogos = event?.branding?.logos || [];

  return (
    <ScreenContainer style={{ backgroundColor: '#050508' }}>
      <LayoutContainer>
        {/* Prominent Header with Countdown Timer */}
        <ScreenHeader
          title="Make It Yours"
          subtitle="Customize your final print preview before sending to the printer"
          secondsLeft={secondsLeft}
          step="CUSTOMIZE"
        />

        <View style={[styles.mainLayout, isLandscape ? styles.rowLayout : styles.colLayout]}>
          {/* Live Print Canvas — TRUE PRINT PREVIEW (NO BOX AROUND FRAME) */}
          <View style={styles.printStageWrapper}>
            <View
              style={[
                styles.printCanvasContainer,
                { width: canvasWidth, height: canvasHeight },
              ]}
            >
              <TemplateCanvas
                template={template}
                photos={photos}
                customization={customization}
                renderStickers={false}
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              />

              {/* Draggable & Resizable Stickers Overlay */}
              <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {customization.stickers.map((st) => (
                  <InteractiveSticker
                    key={st.id}
                    sticker={st}
                    canvasWidth={canvasWidth}
                    canvasHeight={canvasHeight}
                    onUpdate={handleUpdateSticker}
                    onRemove={handleRemoveSticker}
                  />
                ))}
              </View>
            </View>

            <Text style={styles.truePrintHint}>
              ✨ True print preview • Tap and drag stickers freely
            </Text>
          </View>

          {/* Tools & Customization Control Panel */}
          <View style={styles.toolsPanel}>
            {/* Tool Tabs */}
            <View style={styles.tabBar}>
              {(
                [
                  ['patterns', 'Pattern'],
                  ['filters', 'Filter'],
                  ['stickers', 'Stickers'],
                  ['logos', 'Logos'],
                  ['text', 'Text'],
                ] as const
              ).map(([id, label]) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.tabBtn, activeTab === id && styles.tabBtnActive]}
                  onPress={() => {
                    SoundManager.play('click');
                    setActiveTab(id);
                  }}
                >
                  <Text style={[styles.tabBtnText, activeTab === id && styles.tabBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tool Body Area */}
            <ScrollView
              style={styles.toolBody}
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {/* PATTERNS & ORNAMENTS */}
              {activeTab === 'patterns' && (
                <View>
                  <Text style={styles.kicker}>PRINT ORNAMENTS & PATTERNS</Text>
                  <View style={styles.optionGrid}>
                    {ORNAMENTS.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.ornamentCard,
                          customization.ornament === item.id && styles.ornamentCardActive,
                        ]}
                        onPress={() => update({ ornament: item.id })}
                      >
                        <Text style={styles.ornamentSymbol}>{item.symbol}</Text>
                        <Text style={styles.ornamentLabel}>{item.label}</Text>
                        <Text style={styles.ornamentDesc}>{item.desc}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* PHOTO FILTERS */}
              {activeTab === 'filters' && (
                <View>
                  <Text style={styles.kicker}>EVENT PHOTO FILTERS</Text>
                  <View style={styles.filterGrid}>
                    {FILTERS.map((f) => {
                      const isActive = (customization.filter || 'original') === f.id;
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={[styles.filterCard, isActive && styles.filterCardActive]}
                          onPress={() => update({ filter: f.id })}
                        >
                          <View style={[styles.filterCircle, { backgroundColor: f.color }]} />
                          <Text style={styles.filterTitle}>{f.label}</Text>
                          <Text style={styles.filterDesc}>{f.desc}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* STICKERS */}
              {activeTab === 'stickers' && (
                <View>
                  <Text style={styles.kicker}>TAP TO ADD A DRAGGABLE STICKER</Text>
                  <View style={styles.emojiGrid}>
                    {EMOJIS.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={styles.emojiCard}
                        onPress={() => addSticker(emoji)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.emojiChar}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {customization.stickers.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearStickersBtn}
                      onPress={() => update({ stickers: [] })}
                    >
                      <Text style={styles.clearStickersText}>
                        Clear all placed stickers ({customization.stickers.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* LOGOS */}
              {activeTab === 'logos' && (
                <View>
                  <Text style={styles.kicker}>BRAND LOGO FOOTER</Text>
                  <View style={styles.optionGrid}>
                    <TouchableOpacity
                      style={[
                        styles.logoCard,
                        !customization.logo && styles.logoCardActive,
                      ]}
                      onPress={() => update({ logo: null })}
                    >
                      <Text style={styles.logoNoneText}>No Extra Logo</Text>
                    </TouchableOpacity>

                    {availableLogos.map((lg, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.logoCard,
                          customization.logo === lg && styles.logoCardActive,
                        ]}
                        onPress={() => update({ logo: lg })}
                      >
                        <Image source={{ uri: lg }} style={styles.logoImg} resizeMode="contain" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* TEXT */}
              {activeTab === 'text' && (
                <View>
                  <Text style={styles.kicker}>CUSTOM PRINT TITLE & CAPTION</Text>
                  <View style={styles.textFields}>
                    <Text style={styles.inputLabel}>MAIN EVENT TITLE</Text>
                    <TextInput
                      style={styles.textInput}
                      value={customization.title}
                      onChangeText={(val) => update({ title: val })}
                      placeholder={template.design.title || 'Event Title'}
                      placeholderTextColor="#52525b"
                      maxLength={40}
                    />

                    <Text style={styles.inputLabel}>SUBTITLE / TAGLINE</Text>
                    <TextInput
                      style={styles.textInput}
                      value={customization.subtitle}
                      onChangeText={(val) => update({ subtitle: val })}
                      placeholder={template.design.subtitle || 'Subtitle or Tagline'}
                      placeholderTextColor="#52525b"
                      maxLength={60}
                    />

                    <TouchableOpacity
                      style={styles.resetTextBtn}
                      onPress={() => update({ title: '', subtitle: '' })}
                    >
                      <Text style={styles.resetTextText}>Reset to Template Defaults</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Online Gallery Guest Consent Toggle (Respecting platform gallery settings) */}
              {galleryEnabled && (
                <View style={styles.consentCard}>
                  <View style={styles.consentInfo}>
                    <Text style={styles.consentTitle}>
                      Online Event Gallery
                    </Text>
                    <Text style={styles.consentDesc}>
                      Allow {orgName} to feature your Pix in the online event gallery?
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.consentToggleBtn, guestConsent && styles.consentToggleActive]}
                    onPress={handleToggleConsent}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.consentToggleText, guestConsent && styles.consentToggleTextActive]}>
                      {guestConsent ? 'YES' : 'NO'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>

        {/* Footer Actions */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.8}
            disabled={printing}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.printBtn, printing && styles.printBtnDisabled]}
            disabled={printing}
            onPress={handlePrint}
            activeOpacity={0.85}
          >
            {printing ? (
              <View style={styles.printingRow}>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={styles.printBtnText}>  Sending to Printer…</Text>
              </View>
            ) : (
              <Text style={styles.printBtnText}>🖨 Print My Photos →</Text>
            )}
          </TouchableOpacity>
        </View>

        {secondsLeft <= 25 && !printing && (
          <InactivityToast secondsLeft={secondsLeft} onStayActive={resetIdleTimer} />
        )}
      </LayoutContainer>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  mainLayout: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    gap: scale(20),
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  colLayout: {
    flexDirection: 'column',
    justifyContent: 'space-evenly',
  },
  printStageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    margin: scale(8),
  },
  printCanvasContainer: {
    position: 'relative',
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  },
  truePrintHint: {
    color: '#a1a1aa',
    fontSize: fontSize(11),
    fontWeight: '600',
    marginTop: verticalScale(10),
  },
  interactiveStickerContainer: {
    position: 'absolute',
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerToolbar: {
    flexDirection: 'row',
    gap: 4,
    position: 'absolute',
    top: -14,
    right: -14,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 10,
    padding: 2,
  },
  stickerDeleteBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerScaleBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  toolsPanel: {
    backgroundColor: '#0f0f16',
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    borderColor: '#222232',
    padding: scale(20),
    width: scale(380),
    height: verticalScale(380),
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#07070b',
    borderRadius: 14,
    padding: 3,
    marginBottom: verticalScale(14),
  },
  tabBtn: {
    flex: 1,
    paddingVertical: verticalScale(8),
    borderRadius: 11,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#8b5cf6',
  },
  tabBtnText: {
    color: '#71717a',
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  toolBody: {
    flex: 1,
  },
  kicker: {
    color: '#8b5cf6',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: verticalScale(10),
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  ornamentCard: {
    backgroundColor: '#161622',
    borderRadius: moderateScale(14),
    borderWidth: 1.5,
    borderColor: '#262638',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(14),
    alignItems: 'center',
    width: '48%',
    marginBottom: scale(8),
  },
  ornamentCardActive: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  ornamentSymbol: {
    color: '#ffffff',
    fontSize: fontSize(22),
    marginBottom: 2,
  },
  ornamentLabel: {
    color: '#ffffff',
    fontSize: fontSize(12),
    fontWeight: '800',
  },
  ornamentDesc: {
    color: '#71717a',
    fontSize: fontSize(9),
    textAlign: 'center',
    marginTop: 2,
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  filterCard: {
    backgroundColor: '#161622',
    borderRadius: moderateScale(14),
    borderWidth: 1.5,
    borderColor: '#262638',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(12),
    alignItems: 'center',
    width: '48%',
    marginBottom: scale(8),
  },
  filterCardActive: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  filterCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginBottom: 4,
  },
  filterTitle: {
    color: '#ffffff',
    fontSize: fontSize(12),
    fontWeight: '800',
  },
  filterDesc: {
    color: '#71717a',
    fontSize: fontSize(9),
    textAlign: 'center',
    marginTop: 2,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: verticalScale(14),
  },
  emojiCard: {
    width: scale(48),
    height: scale(48),
    borderRadius: moderateScale(12),
    backgroundColor: '#161622',
    borderWidth: 1.5,
    borderColor: '#262638',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChar: {
    fontSize: fontSize(24),
  },
  clearStickersBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  clearStickersText: {
    color: '#f87171',
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  logoCard: {
    backgroundColor: '#161622',
    borderRadius: moderateScale(14),
    borderWidth: 1.5,
    borderColor: '#262638',
    padding: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    height: scale(65),
  },
  logoCardActive: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  logoNoneText: {
    color: '#a1a1aa',
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  logoImg: {
    width: scale(70),
    height: scale(40),
  },
  textFields: {
    width: '100%',
  },
  inputLabel: {
    color: '#71717a',
    fontSize: fontSize(10),
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#161622',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#262638',
    color: '#ffffff',
    padding: scale(10),
    fontSize: fontSize(13),
    marginBottom: verticalScale(12),
  },
  resetTextBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  resetTextText: {
    color: '#8b5cf6',
    fontSize: fontSize(11),
    fontWeight: '700',
  },
  consentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161622',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262638',
    padding: scale(12),
    marginTop: verticalScale(14),
  },
  consentInfo: {
    flex: 1,
    paddingRight: 10,
  },
  consentTitle: {
    color: '#ffffff',
    fontSize: fontSize(12),
    fontWeight: '800',
  },
  consentDesc: {
    color: '#71717a',
    fontSize: fontSize(10),
    marginTop: 2,
    lineHeight: 14,
  },
  consentToggleBtn: {
    backgroundColor: '#262638',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  consentToggleActive: {
    backgroundColor: '#8b5cf6',
  },
  consentToggleText: {
    color: '#a1a1aa',
    fontSize: fontSize(11),
    fontWeight: '800',
  },
  consentToggleTextActive: {
    color: '#ffffff',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
  },
  backBtn: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(22),
    borderRadius: moderateScale(12),
    backgroundColor: '#171720',
    borderWidth: 1,
    borderColor: '#262634',
  },
  backBtnText: {
    color: '#d4d4d8',
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  printBtn: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(28),
    borderRadius: moderateScale(12),
    backgroundColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  printBtnDisabled: {
    opacity: 0.5,
  },
  printBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '800',
  },
  printingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
