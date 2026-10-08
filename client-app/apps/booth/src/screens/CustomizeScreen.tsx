import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Customization, FilterId, OrnamentId } from '@happypix/types';
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
import SoundManager from '../utils/SoundManager';
import { InactivityToast } from '../components/InactivityToast';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Customize'>;
type TabId = 'ornaments' | 'filters' | 'stickers' | 'logos' | 'text';

const ORNAMENTS: { id: OrnamentId; label: string; symbol: string }[] = [
  { id: 'none', label: 'Clean', symbol: '○' },
  { id: 'bubbles', label: 'Bubbles', symbol: '◌' },
  { id: 'hearts', label: 'Hearts', symbol: '♡' },
  { id: 'stars', label: 'Stars', symbol: '✦' },
  { id: 'confetti', label: 'Confetti', symbol: '⌁' },
];

const EMOJIS = ['❤️', '✨', '🎉', '📸', '👑', '🦋', '🌸', '🥳'];

const getFilterColor = (f: FilterId) => {
  switch (f) {
    case 'warm': return '#f97316';
    case 'cool': return '#38bdf8';
    case 'bw': return '#4b5563';
    case 'vintage': return '#d97706';
    case 'soft': return '#f472b6';
    case 'party': return '#ec4899';
    default: return '#a1a1aa';
  }
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
  const isLandscape = width > height;

  const event = snapshot?.event;
  const template = session.template;
  const photos = session.selectedPhotos || [];
  const customization = session.customization;

  const [activeTab, setActiveTab] = useState<TabId>('ornaments');
  const [printing, setPrinting] = useState(false);

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

  if (!template) {
    navigation.replace('Templates');
    return null;
  }

  const update = (patch: Partial<Customization>) => {
    SoundManager.play('click');
    updateSession({
      customization: { ...customization, ...patch },
    });
  };

  const addSticker = (emoji: string) => {
    SoundManager.play('click');
    const newSticker = {
      id: `st-${Date.now()}-${customization.stickers.length}`,
      emoji,
      x: 40 + (customization.stickers.length % 5) * 6,
      y: 40 + (customization.stickers.length % 5) * 6,
    };
    update({ stickers: [...customization.stickers, newSticker] });
  };

  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    SoundManager.play('click');

    try {
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

  const availableFilters: FilterId[] = event?.filters?.length
    ? event.filters
    : ['original', 'warm', 'cool', 'bw', 'vintage', 'soft', 'party'];

  const availableLogos = event?.branding?.logos || [];

  return (
    <ScreenContainer>
      <LayoutContainer>
        <View style={styles.header}>
          <Text style={styles.title}>Make it yours</Text>
          <Text style={styles.subtitle}>
            A few thoughtful touches without hiding the design you chose.
          </Text>
        </View>

        <View style={[styles.mainLayout, isLandscape ? styles.rowLayout : styles.colLayout]}>
          {/* Live Preview Stage */}
          <View style={styles.previewStage}>
            <View style={styles.previewCanvasWrap}>
              <TemplateCanvas
                template={template}
                photos={photos}
                customization={customization}
                style={{ width: scale(220), height: verticalScale(300) }}
              />
            </View>
            <Text style={styles.previewHint}>✨ Your final print preview</Text>
          </View>

          {/* Tools Panel */}
          <View style={styles.toolsPanel}>
            {/* Tool Tabs */}
            <View style={styles.tabBar}>
              {(
                [
                  ['ornaments', 'Pattern'],
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

            {/* Tool Content Area */}
            <View style={styles.toolBody}>
              {/* ORNAMENTS */}
              {activeTab === 'ornaments' && (
                <View>
                  <Text style={styles.kicker}>LIGHT BACKGROUND ORNAMENTS</Text>
                  <View style={styles.optionGrid}>
                    {ORNAMENTS.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.optionCard,
                          customization.ornament === item.id && styles.optionCardActive,
                        ]}
                        onPress={() => update({ ornament: item.id })}
                      >
                        <Text style={styles.optionSymbol}>{item.symbol}</Text>
                        <Text style={styles.optionLabel}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* FILTERS */}
              {activeTab === 'filters' && (
                <View>
                  <Text style={styles.kicker}>EVENT PHOTO FILTERS</Text>
                  <View style={styles.optionGrid}>
                    {availableFilters.map((f) => (
                      <TouchableOpacity
                        key={f}
                        style={[
                          styles.filterCard,
                          customization.filter === f && styles.filterCardActive,
                        ]}
                        onPress={() => update({ filter: f })}
                      >
                        <View style={[styles.filterColorPreview, { backgroundColor: getFilterColor(f) }]} />
                        <Text style={styles.optionLabel}>
                          {f === 'bw' ? 'B&W' : f.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* STICKERS */}
              {activeTab === 'stickers' && (
                <View>
                  <Text style={styles.kicker}>A LITTLE EXTRA JOY</Text>
                  <View style={styles.emojiGrid}>
                    {EMOJIS.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={styles.emojiCard}
                        onPress={() => addSticker(emoji)}
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
                      <Text style={styles.clearStickersText}>Clear all stickers</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* LOGOS */}
              {activeTab === 'logos' && (
                <View>
                  <Text style={styles.kicker}>EVENT LOGOS</Text>
                  <View style={styles.optionGrid}>
                    <TouchableOpacity
                      style={[
                        styles.logoCard,
                        !customization.logo && styles.logoCardActive,
                      ]}
                      onPress={() => update({ logo: null })}
                    >
                      <Text style={styles.optionLabel}>No Logo</Text>
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
                  <Text style={styles.kicker}>CUSTOM PRINT TEXT</Text>
                  <View style={styles.textFields}>
                    <Text style={styles.inputLabel}>MAIN TITLE</Text>
                    <TextInput
                      style={styles.textInput}
                      value={customization.title}
                      onChangeText={(val) => updateSession({ customization: { ...customization, title: val } })}
                      placeholder={template.design.title || 'Event Title'}
                      placeholderTextColor="#52525b"
                      maxLength={40}
                    />

                    <Text style={styles.inputLabel}>SUBTITLE</Text>
                    <TextInput
                      style={styles.textInput}
                      value={customization.subtitle}
                      onChangeText={(val) => updateSession({ customization: { ...customization, subtitle: val } })}
                      placeholder={template.design.subtitle || 'Subtitle or Tagline'}
                      placeholderTextColor="#52525b"
                      maxLength={60}
                    />

                    <TouchableOpacity
                      style={styles.resetTextBtn}
                      onPress={() => update({ title: '', subtitle: '' })}
                    >
                      <Text style={styles.resetTextText}>Reset to Template Text</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
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
  header: {
    alignItems: 'center',
    paddingTop: verticalScale(14),
    marginBottom: verticalScale(14),
  },
  title: {
    color: '#ffffff',
    fontSize: fontSize(24),
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: fontSize(13),
    textAlign: 'center',
  },
  mainLayout: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  colLayout: {
    flexDirection: 'column',
    justifyContent: 'space-evenly',
  },
  previewStage: {
    backgroundColor: '#121217',
    borderRadius: moderateScale(22),
    borderWidth: 1.5,
    borderColor: '#22222a',
    padding: scale(16),
    alignItems: 'center',
    margin: scale(8),
  },
  previewCanvasWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHint: {
    color: '#a1a1aa',
    fontSize: fontSize(11),
    marginTop: verticalScale(10),
  },
  toolsPanel: {
    backgroundColor: '#121217',
    borderRadius: moderateScale(22),
    borderWidth: 1.5,
    borderColor: '#22222a',
    padding: scale(18),
    width: scale(360),
    margin: scale(8),
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#09090b',
    borderRadius: 12,
    padding: 3,
    marginBottom: verticalScale(16),
  },
  tabBtn: {
    flex: 1,
    paddingVertical: verticalScale(8),
    borderRadius: 9,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#8b5cf6',
  },
  tabBtnText: {
    color: '#71717a',
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  toolBody: {
    minHeight: verticalScale(180),
  },
  kicker: {
    color: '#8b5cf6',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: verticalScale(12),
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  optionCard: {
    backgroundColor: '#18181f',
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: '#27272a',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
    alignItems: 'center',
    minWidth: scale(80),
  },
  optionCardActive: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  optionSymbol: {
    color: '#ffffff',
    fontSize: fontSize(20),
    marginBottom: 4,
  },
  optionLabel: {
    color: '#d4d4d8',
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  filterCard: {
    backgroundColor: '#18181f',
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: '#27272a',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(14),
    alignItems: 'center',
  },
  filterCardActive: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  filterColorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 4,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
    marginBottom: verticalScale(14),
  },
  emojiCard: {
    width: scale(50),
    height: scale(50),
    borderRadius: moderateScale(12),
    backgroundColor: '#18181f',
    borderWidth: 1,
    borderColor: '#27272a',
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
    backgroundColor: '#18181f',
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: '#27272a',
    padding: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(80),
    height: scale(60),
  },
  logoCardActive: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  logoImg: {
    width: scale(60),
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
    backgroundColor: '#18181f',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272a',
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
    backgroundColor: '#1c1c24',
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
  },
  printBtnDisabled: {
    opacity: 0.5,
  },
  printBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  printingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
