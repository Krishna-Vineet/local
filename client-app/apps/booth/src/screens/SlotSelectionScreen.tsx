import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BoothTemplate } from '@happypix/types';
import {
  Button,
  Icon,
  Pill,
  TemplatePreview,
  fonts,
  fontSize,
  moderateScale,
  scale,
  shadows,
  useAppTheme,
  verticalScale,
} from '../../../../packages/ui/src/index';
import { AppShell } from '../components/AppShell';
import { InactivityToast } from '../components/InactivityToast';
import { useBooth } from '../context/BoothProvider';
import { goBackOr } from '../utils/navigation';
import { getTemplatePrice } from '../utils/pricing';
import SoundManager from '../utils/SoundManager';
import type { RootStackParamList } from '../../App';

/**
 * Template picker — Electron's `TemplateScreen` (`.template-filters`,
 * `.template-carousel`, `.template-card`).
 *
 * Filters are two rows of pills (print size, number of photos) rather than
 * the old chip bar, and each card carries the live `TemplateCanvas` preview
 * with the price in a pink pill, exactly as the desktop kiosk does.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'Templates'>;

const norm = (value?: string) => {
  const v = String(value || '').toLowerCase();
  return v === 'h' || v === 'landscape' || v === 'horizontal' ? 'landscape' : 'portrait';
};

export const SlotSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const p = theme.palette;
  const {
    snapshot,
    session,
    updateSession,
    setIdleTimerEnabled,
    secondsLeft,
    resetIdleTimer,
    resetGuestSession,
  } = useBooth();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isFocused = useIsFocused();
  const orientation = session.orientation || 'portrait';

  const available = useMemo(() => {
    const templates = snapshot?.event?.templates;
    if (!Array.isArray(templates)) return [];
    return templates.filter(
      (item) => item && item.active !== false && norm(item.layout?.orientation) === norm(orientation)
    );
  }, [snapshot?.event?.templates, orientation]);

  const sizes = useMemo(() => [...new Set(available.map((item) => item.layout.printSize))], [available]);
  const counts = useMemo(
    () => [...new Set(available.map((item) => item.layout.slots))].sort((a, b) => a - b),
    [available]
  );

  const [size, setSize] = useState<string>('all');
  const [count, setCount] = useState<number | 'all'>('all');

  const filtered = useMemo(
    () =>
      available.filter(
        (item) =>
          (size === 'all' || item.layout.printSize === size) &&
          (count === 'all' || item.layout.slots === count)
      ),
    [available, size, count]
  );

  useEffect(() => {
    setIdleTimerEnabled(true);
    resetIdleTimer();
    return () => setIdleTimerEnabled(false);
  }, [setIdleTimerEnabled, resetIdleTimer]);

  useEffect(() => {
    if (secondsLeft === 0 && isFocused) resetGuestSession(navigation);
  }, [secondsLeft, isFocused, navigation, resetGuestSession]);

  const select = (template: BoothTemplate) => {
    SoundManager.play('select');
    resetIdleTimer();
    updateSession({ template });
  };

  const next = () => {
    if (!session.template) return;
    SoundManager.play('click');
    navigation.navigate('Prints');
  };

  const back = () => {
    SoundManager.play('click');
    goBackOr(navigation, 'Orientation');
  };

  // `.template-card { flex: 0 0 clamp(260px, 23vw, 345px) }` — fixed card,
  // carousel scrolls sideways instead of the page trying to fit everything.
  const cardWidth = Math.min(scale(345), Math.max(scale(260), width * 0.23));
  const previewHeight = Math.min(Math.round(height * 0.41), scale(420));

  const filters: { key: string; label: string; active: boolean; onPress: () => void }[] = [
    { key: 'size-all', label: 'All sizes', active: size === 'all', onPress: () => setSize('all') },
    ...sizes.map((value) => ({
      key: `size-${value}`,
      label: value,
      active: size === value,
      onPress: () => setSize(value),
    })),
  ];
  const countFilters: { key: string; label: string; active: boolean; onPress: () => void }[] = [
    { key: 'count-all', label: 'All', active: count === 'all', onPress: () => setCount('all') },
    ...counts.map((value) => ({
      key: `count-${value}`,
      label: String(value),
      active: count === value,
      onPress: () => setCount(value),
    })),
  ];

  return (
    <AppShell
      step="templates"
      title="Pick your favourite look"
      subtitle="Filter by final print size and number of photos, then choose one design."
      secondsLeft={secondsLeft}
      testID="template-screen"
      stretch
    >
      {/* `.template-filters`: one centred row of two labelled chip groups. */}
      <View style={styles.filterBar}>
        {[
          { label: 'PRINT SIZE', items: filters },
          { label: 'PHOTOS', items: countFilters },
        ].map((group) => (
          <View key={group.label} style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: p.faint }]}>{group.label}</Text>
            {group.items.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  SoundManager.play('click');
                  item.onPress();
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: item.active ? p.pink : p.line,
                    backgroundColor: item.active ? p.pink : p.surface,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: item.active ? '#ffffff' : p.muted }]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {/* `.template-carousel`: the only thing on this screen that scrolls, and
          it scrolls horizontally — Electron's strip behaviour. */}
      <ScrollView
        horizontal
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
        showsHorizontalScrollIndicator={false}
      >
        {filtered.map((item) => {
          const selected = session.template?.id === item.id;
          const price = getTemplatePrice(item, snapshot);
          return (
            <Pressable
              key={item.id}
              onPress={() => select(item)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.card,
                {
                  width: cardWidth,
                  borderColor: selected ? p.pink : 'transparent',
                  backgroundColor: p.surface,
                },
              ]}
            >
              <View style={[styles.preview, { backgroundColor: '#efe8f2' }]}>
                <TemplatePreview template={item} maxHeight={previewHeight} maxWidth={cardWidth * 0.94} />
                {selected ? (
                  <View style={[styles.selectedBadge, { backgroundColor: p.pink }]}>
                    <Icon name="check" size={scale(12)} color="#ffffff" strokeWidth={3} />
                    <Text style={styles.selectedText}>Selected</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.cardCopy}>
                <View style={styles.cardCopyLeft}>
                  <Text numberOfLines={1} style={[styles.cardName, { color: p.ink }]}>
                    {item.name}
                  </Text>
                  <Text numberOfLines={1} style={[styles.cardMeta, { color: p.muted }]}>
                    {item.layout.label} · {item.category}
                  </Text>
                </View>
                <Pill label={price === 0 ? 'Free' : `₹${price}`} tone="pink" />
              </View>
            </Pressable>
          );
        })}

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="image" size={fontSize(34)} color={p.faint} />
            <Text style={[styles.emptyTitle, { color: p.ink }]}>No templates in this combination</Text>
            <Text style={[styles.emptyBody, { color: p.muted }]}>Try another print size or photo count.</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <Button label="Back" variant="secondary" icon="arrow-left" onPress={back} />
        <Button
          label="Choose this template"
          iconRight="arrow-right"
          onPress={next}
          disabled={!session.template}
          style={styles.nextBtn}
          testID="template-next"
        />
      </View>

      <InactivityToast secondsLeft={secondsLeft} onStayActive={resetIdleTimer} />
    </AppShell>
  );
};

const styles = StyleSheet.create({
  // `.template-filters { display:flex; justify-content:center; gap: clamp(16px,4vw,55px) }`
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(28),
    flexShrink: 0,
  },
  filterGroup: { flexDirection: 'row', alignItems: 'center', gap: scale(7) },
  filterLabel: { fontFamily: fonts.bodyBlack, fontSize: fontSize(10), letterSpacing: 1.1, marginRight: scale(5) },
  // `.template-filters button { min-height:34px; padding:6px 13px; font-size:11px }`
  chip: {
    minHeight: verticalScale(34),
    paddingHorizontal: scale(13),
    paddingVertical: verticalScale(5),
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(11) },

  // `.template-carousel { flex:1; min-height:0; align-items:stretch; gap:20px }`
  carousel: { flex: 1, minHeight: 0, marginTop: verticalScale(14), width: '100%' },
  carouselContent: { gap: scale(20), paddingHorizontal: scale(4), paddingBottom: verticalScale(10), alignItems: 'stretch' },

  // `.template-card { padding:11px; border:2px; border-radius:24px; background:#fff }`
  card: { padding: scale(11), borderRadius: moderateScale(24), borderWidth: 2, ...shadows.soft },
  // `.template-card-preview { flex:1; min-height:180px; border-radius:17px; background:#efe8f2 }`
  preview: {
    flex: 1,
    minHeight: verticalScale(180),
    borderRadius: moderateScale(17),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `.selected-badge { left:50%; bottom:12px; translateX(-50%) }`
  selectedBadge: {
    position: 'absolute',
    left: '50%',
    bottom: verticalScale(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(11),
    paddingVertical: verticalScale(7),
    borderRadius: 999,
    transform: [{ translateX: -scale(42) }],
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: scale(10),
    shadowOffset: { width: 0, height: verticalScale(4) },
    elevation: 4,
  },
  selectedText: { fontFamily: fonts.bodyBlack, fontSize: fontSize(10), color: '#ffffff' },

  cardCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(10),
    paddingTop: verticalScale(12),
    paddingHorizontal: scale(5),
    paddingBottom: verticalScale(3),
  },
  cardCopyLeft: { flex: 1, minWidth: 0 },
  cardName: { fontFamily: fonts.display, fontSize: fontSize(18) },
  cardMeta: { fontFamily: fonts.body, fontSize: fontSize(10), marginTop: verticalScale(3) },

  empty: { width: scale(420), alignItems: 'center', justifyContent: 'center', gap: verticalScale(8) },
  emptyTitle: { fontFamily: fonts.display, fontSize: fontSize(18) },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSize(12) },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(16),
    width: '100%',
    marginTop: verticalScale(16),
    flexShrink: 0,
  },
  nextBtn: { minWidth: scale(240) },
});

export default SlotSelectionScreen;
