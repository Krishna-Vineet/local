import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import type { Customization, FilterId, PlacedSticker } from '@happypix/types';
import {
  Button,
  FilteredImage,
  TemplatePreview,
  Card,
  Eyebrow,
  Icon,
  STICKER_EM_FRACTION,
  Pill,
  fonts,
  fontSize,
  moderateScale,
  radii,
  scale,
  shadows,
  useAppTheme,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { AppShell } from '../components/AppShell';
import { renderSessionComposite, useBooth } from '../context/BoothProvider';
import { InactivityToast } from '../components/InactivityToast';
import { goBackOr } from '../utils/navigation';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

/**
 * Customisation, rebuilt against the Electron screen
 * (`electron/src/ui/screens/CustomizeScreen.tsx`).
 *
 * What changed and why — this screen is the one the product is judged on:
 *  · one big preview on the left, tools in a single bordered card on the right
 *    (Electron's `.customize-layout`), instead of two floating dark panels;
 *  · the tab strip is Electron's `.custom-tools nav` — violet pill for the
 *    active tab, quiet text for the rest — not four boxes competing for
 *    attention;
 *  · filters are swatches with a live thumbnail dot and a caption underneath
 *    (`.filter-options`), so the guest sees the *look*, not a paragraph;
 *  · stickers get a size/remove list *inside the panel* (`.sticker-list`), so a
 *    mis-placed emoji is fixed without hunting for a 18pt × on a photo;
 *  · the consent question moved out of the scroll area into one full-width row
 *    with Yes/No pills, exactly like Electron and the Android build both do
 *    (`.consent-row`), because an important question should not be hidden under
 *    a scroll;
 *  · type is Fredoka for headings and Nunito for UI text, matching the desktop
 *    kiosk — the previous build used the system font, which is most of the
 *    reason the two clients felt unrelated.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'Customize'>;
type TabId = 'filters' | 'stickers' | 'logos' | 'text';

const TABS: { id: TabId; label: string }[] = [
  { id: 'filters', label: 'Filter' },
  { id: 'stickers', label: 'Stickers' },
  { id: 'logos', label: 'Logos' },
  { id: 'text', label: 'Text' },
];

const FILTERS: { id: FilterId; label: string; swatch: string }[] = [
  { id: 'original', label: 'Natural', swatch: 'linear-gradient' },
  { id: 'warm', label: 'Warm', swatch: '#f4b06a' },
  { id: 'cool', label: 'Cool', swatch: '#7fb2e5' },
  { id: 'bw', label: 'B&W', swatch: '#5b5b63' },
  { id: 'vintage', label: 'Vintage', swatch: '#a97b4f' },
  { id: 'soft', label: 'Soft', swatch: '#f0a8c1' },
  { id: 'party', label: 'Party', swatch: '#ee4c96' },
];

const EMOJIS = ['❤️', '✨', '🎉', '📸', '👑', '🦋', '🌸', '🥳', '💫', '🌈', '🫶', '🥂'];

/**
 * A sticker is positioned at `x% / y%` of the print and sized by `scale`
 * (0.5–4, default 1) — Electron's model exactly. One em is 9.6 % of the print
 * width, and that single constant lives in `utils/printSpec`, which the
 * preview, this drag layer and the 300 dpi composite all read.
 */

/* ── draggable sticker ─────────────────────────────────────────────────── */

/**
 * A sticker on the print — dot for dot Electron's `.placed-sticker`.
 *
 * Electron positions it with `left: x%; top: y%; transform: translate(-50%,-50%)`
 * and sizes it with `font-size: scale * 1.8em` (≈9.6% of the frame width at
 * 100%). Dragging is clamped to 0–100% of the frame in both axes, and there are
 * deliberately NO controls on the image: the desktop puts − / % / + / × in the
 * Stickers tab, because a toolbar attached to a drag point drifts off the print.
 */
const PlacedStickerView: React.FC<{
  sticker: PlacedSticker;
  canvasWidth: number;
  canvasHeight: number;
  onMove: (id: string, x: number, y: number) => void;
  draggable?: boolean;
}> = ({ sticker, canvasWidth, canvasHeight, onMove, draggable = true }) => {
  const origin = useRef({ x: sticker.x, y: sticker.y });
  const scaleFactor = sticker.scale ?? (sticker.size ? sticker.size / 34 : 1);
  // `font-size: scale * 1.8em` against an 8cqw base ≈ 9.6% of the frame width.
  const size = Math.max(12, canvasWidth * STICKER_EM_FRACTION * scaleFactor);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => draggable,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        draggable && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 3,
      onPanResponderGrant: () => {
        origin.current = { x: sticker.x, y: sticker.y };
      },
      onPanResponderMove: (_evt, gesture) => {
        // Electron: `Math.max(0, Math.min(100, start + dx/width*100))`
        const x = Math.max(0, Math.min(100, origin.current.x + (gesture.dx / canvasWidth) * 100));
        const y = Math.max(0, Math.min(100, origin.current.y + (gesture.dy / canvasHeight) * 100));
        origin.current = { x, y };
        onMove(sticker.id, x, y);
      },
    })
  ).current;

  return (
    <View
      {...(draggable ? responder.panHandlers : {})}
      style={[
        styles.sticker,
        {
          left: `${sticker.x}%` as unknown as number,
          top: `${sticker.y}%` as unknown as number,
          // Electron draws the glyph centred on (x, y): `translate(-50%,-50%)`.
          // The em box is square enough to use the font size for both axes.
          transform: [{ translateX: -size * 0.5 }, { translateY: -size * 0.5 }],
        },
      ]}
    >
      <Text style={{ fontSize: size }}>{sticker.emoji}</Text>
    </View>
  );
};

/* ── screen ────────────────────────────────────────────────────────────── */

export const CustomizeScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const p = theme.palette;
  const {
    snapshot,
    session,
    updateSession,
    finishAndPrint,
    setIdleTimerEnabled,
    secondsLeft,
    resetIdleTimer,
    resetGuestSession,
    online,
  } = useBooth();

  const isFocused = useIsFocused();
  const event = snapshot?.event;
  const template = session.template;
  const photos = session.selectedPhotos || [];
  const customization = session.customization;

  const allowed = event?.filters && event.filters.length > 0 ? event.filters : null;
  const filters = allowed
    ? FILTERS.filter((f) => f.id === 'original' || allowed.includes(f.id))
    : FILTERS;

  const orgName = snapshot?.settings?.organizationName || snapshot?.organization?.name || 'HappyPix';
  const galleryEnabled = snapshot?.settings?.galleryEnabled !== false;
  // Gallery consent is an explicit guest choice, not only a required-consent mode.
  const showConsent = galleryEnabled;

  const [tab, setTab] = useState<TabId>('filters');
  const [printing, setPrinting] = useState(false);
  const [printPreviewUri, setPrintPreviewUri] = useState<string | null>(null);
  const [consent, setConsentState] = useState(
    customization.guestConsent !== undefined ? customization.guestConsent : true
  );

  useEffect(() => {
    setIdleTimerEnabled(true);
    resetIdleTimer();
    return () => setIdleTimerEnabled(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (secondsLeft === 0 && !printing && isFocused) {
      resetGuestSession(navigation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, printing, isFocused]);

  // Render the preview through the exact same 300-DPI print compositor used by
  // `finishAndPrint`. The draggable stickers stay as a live RN overlay, while
  // all pixels underneath (template art, photo crop/filter, text and logo) come
  // from the print bitmap itself. This prevents two platform renderers drifting.
  useEffect(() => {
    if (!template) return;
    setPrintPreviewUri(null);
    let current = true;
    const timer = setTimeout(() => {
      const previewSession = {
        ...session,
        customization: { ...customization, stickers: [] },
      };
      renderSessionComposite(previewSession)
        .then((uri) => {
          if (current && uri) setPrintPreviewUri(uri);
        })
        .catch((error) => {
          console.warn('[CustomizeScreen] print-parity preview failed:', error);
        });
    }, 220);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [template, session, customization]);

  useEffect(() => {
    if (!template) navigation.replace('Templates');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, navigation]);

  const lastAdd = useRef(0);

  const update = (patch: Partial<Customization>, silent = false) => {
    if (!silent) SoundManager.play('click');
    resetIdleTimer();
    updateSession({ customization: { ...customization, ...patch } });
  };

  const addSticker = (emoji: string) => {
    const now = Date.now();
    if (now - lastAdd.current < 300) return;
    lastAdd.current = now;
    SoundManager.play('select');
    const placed = customization.stickers.length;
    update(
      {
        stickers: [
          ...customization.stickers,
          {
            id: `st-${now}-${placed}`,
            emoji,
            // Electron `addSticker`: base 35 + (n % 5) * 8, scale 1.
            x: 35 + (customization.stickers.length % 5) * 8,
            y: 35 + (customization.stickers.length % 5) * 8,
            scale: 1,
          } as PlacedSticker,
        ],
      },
      true
    );
  };

  const moveSticker = (id: string, x: number, y: number) =>
    updateSession({
      customization: {
        ...customization,
        stickers: customization.stickers.map((st) => (st.id === id ? { ...st, x, y } : st)),
      },
    });

  const scaleSticker = (id: string, delta: number) => {
    SoundManager.play('click');
    update(
      {
        stickers: customization.stickers.map((st) => {
          if (st.id !== id) return st;
          const current = st.scale ?? (st.size ? st.size / 34 : 1);
          // Electron: `Math.max(0.5, Math.min(4, scale + delta))`
          return { ...st, scale: Math.max(0.5, Math.min(4, current + delta)) };
        }),
      },
      true
    );
  };

  const removeSticker = (id: string) => {
    SoundManager.play('click');
    update({ stickers: customization.stickers.filter((st) => st.id !== id) }, true);
  };

  const setConsent = (next: boolean) => {
    SoundManager.play('click');
    setConsentState(next);
    update({ guestConsent: next }, true);
  };

  const onPrint = async () => {
    if (printing) return;
    setPrinting(true);
    setIdleTimerEnabled(false);
    SoundManager.play('click');
    try {
      // The final customisation goes in with the same call that renders the
      // print — a plain `updateSession` first would still be in flight.
      await finishAndPrint({
        customization: { ...customization, guestConsent: consent },
      });
      navigation.navigate('OrderSuccess');
    } catch {
      navigation.navigate('OrderSuccess');
    } finally {
      setPrinting(false);
    }
  };

  const onBack = () => {
    SoundManager.play('click');
    goBackOr(navigation, 'Start');
  };

  const orientation = template?.layout.orientation;
  const rawW = template?.layout?.canvas?.width;
  const rawH = template?.layout?.canvas?.height;
  const aspect = rawW && rawH ? rawW / rawH : orientation === 'portrait' ? 2 / 3 : 3 / 2;

  const logos = useMemo(() => event?.branding?.logos || [], [event]);

  if (!template) return null;

  return (
    <AppShell
      step="customize"
      secondsLeft={secondsLeft}
      online={online !== false}
      orgName={orgName}
      title="Make it yours"
      subtitle="A few thoughtful touches — without hiding the design you chose."
      testID="customize-screen"
    >
      <View style={styles.layout}>
        {/* preview stage */}
        <View style={styles.stage}>
          {/* The frame is measured, not guessed: the sticker layer and the print
              canvas share one coordinate space (percent of the print). */}
          <View style={styles.frame}>
            <TemplatePreview
              template={template}
              photos={photos}
              customization={customization}
              printBitmapUri={printPreviewUri}
              renderStickers={false}
              maxHeight={verticalScale(430)}
              maxWidth={scale(460)}
              radius={moderateScale(14)}
              style={styles.previewBox}
              overlay={({ width, height }) => (
                <>
                  {customization.stickers.map((st) => (
                    <PlacedStickerView
                      key={st.id}
                      sticker={st}
                      canvasWidth={width}
                      canvasHeight={height}
                      onMove={moveSticker}
                    />
                  ))}
                  {printing ? (
                    <View style={styles.preparing}>
                      <View style={styles.preparingPill}>
                        <ActivityIndicator size="small" color="#ffffff" />
                        <Text style={styles.preparingText}>Preparing your print…</Text>
                      </View>
                    </View>
                  ) : null}
                </>
              )}
            />
          </View>
          <View style={styles.hintRow}>
            <Icon name="sparkles" size={fontSize(15)} color={p.muted} />
            <Text style={[styles.hint, { color: p.muted }]}>
              Your final print preview — drag a sticker to reposition
            </Text>
          </View>
        </View>

        {/* tools */}
        <Card style={styles.tools} elevation="soft">
          <View style={[styles.tabBar, { backgroundColor: p.surfaceSoft, borderBottomColor: p.line }]}>
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    SoundManager.play('click');
                    setTab(item.id);
                    resetIdleTimer();
                  }}
                  disabled={printing}
                  style={[styles.tab, active ? { backgroundColor: p.violet } : null]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabText, { color: active ? p.white : p.muted }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView contentContainerStyle={styles.toolBody} showsVerticalScrollIndicator={false}>
            {tab === 'filters' ? (
              <>
                <Eyebrow color={p.pinkDeep}>Event photo filters</Eyebrow>
                <View style={styles.filterGrid}>
                  {filters.map((filter) => {
                    const active = (customization.filter || 'original') === filter.id;
                    return (
                      <Pressable
                        key={filter.id}
                        onPress={() => update({ filter: filter.id })}
                        style={[
                          styles.filterCard,
                          { borderColor: active ? p.pink : p.line, backgroundColor: p.surface },
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                      >
                        <View style={[styles.filterSwatch, { borderColor: active ? '#f6c9de' : p.line }]}>
                          {photos[0]?.uri ? (
                            // The guest's own shot with the real colour matrix applied —
                            // a flat coloured chip told nobody what B&W would look like.
                            <FilteredImage
                              uri={photos[0].uri}
                              filter={filter.id}
                              style={styles.filterSwatchImage}
                            />
                          ) : (
                            <View
                              style={[
                                styles.filterSwatchFallback,
                                {
                                  backgroundColor:
                                    filter.swatch === 'linear-gradient' ? p.surfaceMuted : filter.swatch,
                                },
                              ]}
                            >
                              <Icon name="image" size={fontSize(16)} color="#ffffffcc" />
                            </View>
                          )}
                        </View>
                        <Text style={[styles.filterLabel, { color: active ? p.pinkDeep : p.muted }]}>
                          {filter.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {tab === 'stickers' ? (
              <>
                <Eyebrow color={p.pinkDeep}>Tap to add · drag to move</Eyebrow>
                <Text style={[styles.toolNote, { color: p.faint }]}>
                  Resize or remove stickers using the controls below — not on the image itself.
                </Text>
                <View style={styles.emojiGrid}>
                  {EMOJIS.map((emoji) => (
                    <Pressable
                      key={emoji}
                      onPress={() => addSticker(emoji)}
                      style={[styles.emojiCard, { borderColor: p.line, backgroundColor: p.surfaceSoft }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${emoji} sticker`}
                    >
                      <Text style={{ fontSize: fontSize(24) }}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>

                {customization.stickers.length ? (
                  <View style={styles.stickerList}>
                    {customization.stickers.map((st) => (
                      <View key={st.id} style={[styles.stickerRow, { borderColor: p.line, backgroundColor: p.surfaceSoft }]}>
                        <Text style={{ fontSize: fontSize(18) }}>{st.emoji}</Text>
                        <Text style={[styles.stickerName, { color: p.muted }]} numberOfLines={1}>
                          {st.emoji} sticker
                        </Text>
                        <Pressable
                          onPress={() => scaleSticker(st.id, -0.25)}
                          style={[styles.sizeBtn, { borderColor: p.line, backgroundColor: p.surface }]}
                          accessibilityLabel="Make smaller"
                        >
                          <Text style={[styles.sizeBtnText, { color: p.violet }]}>−</Text>
                        </Pressable>
                        <Text style={[styles.sizeValue, { color: p.ink }]}>
                          {Math.round((st.scale ?? (st.size ? st.size / 34 : 1)) * 100)}%
                        </Text>
                        <Pressable
                          onPress={() => scaleSticker(st.id, 0.25)}
                          style={[styles.sizeBtn, { borderColor: p.line, backgroundColor: p.surface }]}
                          accessibilityLabel="Make larger"
                        >
                          <Text style={[styles.sizeBtnText, { color: p.violet }]}>+</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => removeSticker(st.id)}
                          style={[styles.sizeBtn, styles.deleteBtn, { borderColor: p.redSoft, backgroundColor: p.redSoft }]}
                          accessibilityLabel="Remove sticker"
                        >
                          <Text style={[styles.sizeBtnText, { color: p.red }]}>×</Text>
                        </Pressable>
                      </View>
                    ))}
                    <Pressable onPress={() => update({ stickers: [] })} style={styles.textAction}>
                      <Text style={[styles.textActionLabel, { color: p.pinkDeep }]}>Clear all stickers</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={[styles.toolNote, { color: p.faint, marginTop: verticalScale(12) }]}>
                    No stickers yet. Tap an emoji above to place it on your print. Use − / + to resize and × to remove — controls sit here, next to the list.
                  </Text>
                )}
              </>
            ) : null}

            {tab === 'logos' ? (
              <>
                <Eyebrow color={p.pinkDeep}>Event logos</Eyebrow>
                <View style={styles.logoGrid}>
                  <Pressable
                    onPress={() => update({ logo: null })}
                    style={[
                      styles.logoCard,
                      { borderColor: !customization.logo ? p.pink : p.line, backgroundColor: p.surfaceSoft },
                    ]}
                  >
                    <Text style={[styles.logoNone, { color: p.muted }]}>No logo</Text>
                  </Pressable>
                  {logos.map((logo, index) => (
                    <Pressable
                      key={`${logo}-${index}`}
                      onPress={() => update({ logo })}
                      style={[
                        styles.logoCard,
                        styles.logoImageCard,
                        {
                          borderColor: customization.logo === logo ? p.pink : p.line,
                          backgroundColor: p.surfaceSoft,
                        },
                      ]}
                    >
                      <Image source={{ uri: logo }} style={styles.logoImage} resizeMode="contain" />
                    </Pressable>
                  ))}
                </View>
                {!logos.length ? (
                  <Text style={[styles.toolNote, { color: p.faint }]}>
                    This event has no logos uploaded. The template footer will be used.
                  </Text>
                ) : null}
              </>
            ) : null}

            {tab === 'text' ? (
              <>
                <Eyebrow color={p.pinkDeep}>Custom title & caption</Eyebrow>
                <Text style={[styles.fieldLabel, { color: p.muted }]}>MAIN TEXT</Text>
                <TextInput
                  value={customization.title}
                  onChangeText={(value) => update({ title: value }, true)}
                  placeholder={template.design?.title || 'Event title'}
                  placeholderTextColor={p.faint}
                  maxLength={42}
                  style={[
                    styles.input,
                    { borderColor: p.line, backgroundColor: p.surfaceSoft, color: p.ink, fontFamily: fonts.bodyBold },
                  ]}
                />
                <Text style={[styles.fieldLabel, { color: p.muted }]}>SUBTEXT</Text>
                <TextInput
                  value={customization.subtitle}
                  onChangeText={(value) => update({ subtitle: value }, true)}
                  placeholder={template.design?.subtitle || event?.branding?.tagline || 'Subtitle or tagline'}
                  placeholderTextColor={p.faint}
                  maxLength={60}
                  style={[
                    styles.input,
                    { borderColor: p.line, backgroundColor: p.surfaceSoft, color: p.ink, fontFamily: fonts.bodyBold },
                  ]}
                />
                <Pressable onPress={() => update({ title: '', subtitle: '' })} style={styles.textAction}>
                  <Text style={[styles.textActionLabel, { color: p.pinkDeep }]}>Use template text</Text>
                </Pressable>
              </>
            ) : null}
          </ScrollView>
        </Card>
      </View>

      {showConsent ? (
        <View style={[styles.consent, { borderColor: p.line, backgroundColor: p.surface }]}>
          <View style={styles.consentCopy}>
            <Text style={[styles.consentTitle, { color: p.ink }]}>Can we feature your photos?</Text>
            <Text style={[styles.consentText, { color: p.muted }]} numberOfLines={2}>
              Allow {orgName} to showcase these images in the event gallery. You can change this anytime.
            </Text>
          </View>
          <View style={styles.consentButtons}>
            <Pressable
              onPress={() => setConsent(true)}
              style={[
                styles.consentToggle,
                { borderColor: consent ? p.green : p.line, backgroundColor: consent ? p.green : p.surface },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: consent }}
            >
              <Text style={[styles.consentToggleText, { color: consent ? p.white : p.muted }]}>Yes</Text>
            </Pressable>
            <Pressable
              onPress={() => setConsent(false)}
              style={[
                styles.consentToggle,
                { borderColor: !consent ? '#6b7280' : p.line, backgroundColor: !consent ? '#6b7280' : p.surface },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: !consent }}
            >
              <Text style={[styles.consentToggleText, { color: !consent ? p.white : p.muted }]}>No</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button label="Back" variant="secondary" icon="arrow-left" onPress={onBack} disabled={printing} />
        <View style={styles.actionsRight}>
          {customization.stickers.length ? (
            <Pill label={`${customization.stickers.length} sticker${customization.stickers.length > 1 ? 's' : ''}`} tone="violet" />
          ) : null}
          <Button
            label={printing ? 'Preparing your print…' : 'Print my photos'}
            icon={printing ? undefined : 'printer'}
            variant="primary"
            loading={printing}
            onPress={onPrint}
            disabled={printing}
            testID="customize-print"
          />
        </View>
      </View>

      {!printing ? (
        <InactivityToast secondsLeft={secondsLeft} onStayActive={resetIdleTimer} />
      ) : null}
    </AppShell>
  );
};

const styles = StyleSheet.create({
  layout: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(28),
    paddingBottom: verticalScale(8),
  },
  stage: { flex: 1.05, alignItems: 'center', justifyContent: 'center' },
  frame: { flex: 1, width: '100%', minHeight: 0, maxHeight: verticalScale(460) },
  previewBox: { flex: 1 },
  // `.transition-overlay`: dim wash + pill, so the print stays readable behind it.
  preparing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,8,22,0.55)',
  },
  preparingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(12),
    borderRadius: radii.pill,
    backgroundColor: 'rgba(33,19,43,0.92)',
    ...shadows.soft,
  },
  preparingText: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(13), color: '#ffffff' },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginTop: verticalScale(10),
  },
  hint: { fontFamily: fonts.body, fontSize: fontSize(10) },

  tools: {
    flex: 0.95,
    minWidth: 0,
    maxWidth: scale(520),
    padding: 0,
    overflow: 'hidden',
    borderRadius: moderateScale(25),
  },
  tabBar: { flexDirection: 'row', gap: scale(4), padding: scale(8), borderBottomWidth: 1 },
  tab: {
    flex: 1,
    minHeight: verticalScale(38),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(11),
  },
  tabText: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(11) },
  toolBody: { padding: scale(22), paddingBottom: verticalScale(26), minHeight: verticalScale(240) },
  toolNote: { fontFamily: fonts.body, fontSize: fontSize(10), lineHeight: fontSize(15), marginTop: verticalScale(6) },

  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(10), marginTop: verticalScale(14) },
  filterCard: {
    width: scale(84),
    padding: scale(6),
    borderWidth: 1,
    borderRadius: moderateScale(14),
  },
  filterSwatch: {
    height: verticalScale(54),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#efe8f2',
  },
  filterSwatchImage: { width: '100%', height: '100%' },
  filterSwatchFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterLabel: {
    fontFamily: fonts.bodyHeavy,
    fontSize: fontSize(9),
    textTransform: 'capitalize',
    textAlign: 'center',
    paddingTop: verticalScale(5),
  },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(9), marginTop: verticalScale(12) },
  emojiCard: {
    width: scale(56),
    height: scale(56),
    borderWidth: 1,
    borderRadius: moderateScale(15),
    alignItems: 'center',
    justifyContent: 'center',
  },

  stickerList: { marginTop: verticalScale(14), gap: verticalScale(8) },
  // `.sticker-list-row` — padding 10px 12px, radius 14, gap 8.
  stickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    borderWidth: 1,
    borderRadius: moderateScale(14),
  },
  stickerName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: fontSize(12) },
  // `.sticker-size-btn` — 34×34, radius 10.
  sizeBtn: {
    width: scale(34),
    height: verticalScale(34),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: moderateScale(10),
  },
  sizeBtnText: { fontFamily: fonts.bodyBlack, fontSize: fontSize(14) },
  deleteBtn: { borderWidth: 1 },
  // `.sticker-size-value` — min-width 44, 12px/800.
  sizeValue: {
    minWidth: scale(44),
    textAlign: 'center',
    fontFamily: fonts.bodyHeavy,
    fontSize: fontSize(12),
  },
  textAction: { paddingVertical: verticalScale(8), alignSelf: 'flex-start' },
  textActionLabel: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(12) },

  logoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(10), marginTop: verticalScale(14) },
  logoCard: {
    minWidth: scale(112),
    height: verticalScale(70),
    padding: scale(8),
    borderWidth: 2,
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImageCard: { minWidth: scale(124) },
  logoImage: { width: '100%', height: '100%' },
  logoNone: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(11) },

  fieldLabel: {
    fontFamily: fonts.bodyHeavy,
    fontSize: fontSize(10),
    letterSpacing: 0.9,
    marginTop: verticalScale(14),
    marginBottom: verticalScale(6),
  },
  input: {
    height: verticalScale(46),
    borderWidth: 1,
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(12),
    fontSize: fontSize(13),
  },

  consent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(14),
    marginTop: verticalScale(12),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(12),
    borderWidth: 1,
    borderRadius: moderateScale(18),
  },
  consentCopy: { flex: 1, minWidth: 0 },
  consentTitle: { fontFamily: fonts.display, fontSize: fontSize(14) },
  consentText: { fontFamily: fonts.body, fontSize: fontSize(11), lineHeight: fontSize(15) },
  consentButtons: { flexDirection: 'row', gap: scale(8) },
  consentToggle: {
    minWidth: scale(66),
    height: verticalScale(38),
    paddingHorizontal: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: radii.pill,
  },
  consentToggleText: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(13) },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: verticalScale(14),
  },
  actionsRight: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },

  // `.placed-sticker { position:absolute; transform: translate(-50%,-50%) }`
  // — centred on its point, no chrome of its own.
  sticker: {
    position: 'absolute',
  },
});

export default CustomizeScreen;
