import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BoothTemplate } from '@happypix/types';
import {
  Button,
  Icon,
  Pill,
  TemplateCanvas,
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

  // Card sizing: fill the row on wide screens, two-up on a portrait iPad.
  const columns = isLandscape ? 3 : 2;
  const gutter = scale(14);
  const rowWidth = Math.min(width - scale(40), scale(1120));
  const cardWidth = Math.floor((rowWidth - gutter * (columns - 1)) / columns);
  const previewHeight = Math.min(
    Math.round(height * (isLandscape ? 0.44 : 0.3)),
    Math.round(cardWidth * 1.18)
  );

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
    >
      <View style={styles.filterBar}>
        {[
          { label: 'PRINT SIZE', items: filters },
          { label: 'PHOTOS', items: countFilters },
        ].map((group) => (
          <View key={group.label} style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: p.faint }]}>{group.label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
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
                      borderColor: item.active ? 'transparent' : p.line,
                      backgroundColor: item.active ? p.pink : p.surface,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: item.active ? '#ffffff' : p.muted }]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ))}
      </View>

      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.grid, { width: rowWidth }]}>
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
                  { width: cardWidth, borderColor: selected ? '#f0a6c8' : p.line, backgroundColor: p.surface },
                  selected ? styles.cardSelected : null,
                ]}
              >
                <View style={[styles.preview, { height: previewHeight, backgroundColor: p.surfaceMuted }]}>
                  <TemplateCanvas
                    template={item}
                    style={{ width: '100%', height: '100%', borderRadius: radiiInner }}
                  />
                  {selected ? (
                    <View style={[styles.selectedBadge, { backgroundColor: p.pink }]}>
                      <Icon name="check" size={fontSize(12)} color="#ffffff" strokeWidth={2.6} />
                      <Text style={styles.selectedText}>Selected</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardCopy}>
                  <View style={styles.cardCopyLeft}>
                    <Text numberOfLines={1} style={[styles.cardName, { color: p.ink }]}>
                      {item.name}
                    </Text>
                    <Text numberOfLines={1} style={[styles.cardMeta, { color: p.faint }]}>
                      {item.layout.label} · {item.category}
                    </Text>
                  </View>
                  <Pill label={price === 0 ? 'Free' : `₹${price}`} tone="pink" />
                </View>
              </Pressable>
            );
          })}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="image" size={fontSize(38)} color={p.faint} />
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

      <InactivityToast />
    </AppShell>
  );
};

const radiiInner = moderateScale(12);

const styles = StyleSheet.create({
  filterBar: { width: '100%', maxWidth: scale(1120), alignSelf: 'center', gap: verticalScale(8) },
  filterGroup: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  filterLabel: { fontFamily: fonts.bodyBlack, fontSize: fontSize(9.5), letterSpacing: 1.3, width: scale(76) },
  chipRow: { gap: scale(8), alignItems: 'center', paddingVertical: verticalScale(2) },
  chip: {
    height: verticalScale(34),
    paddingHorizontal: scale(15),
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.bodyHeavy, fontSize: fontSize(12) },

  scroller: { flex: 1, width: '100%', marginTop: verticalScale(14) },
  scrollContent: { alignItems: 'center', paddingBottom: verticalScale(10) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(14) },
  card: { borderRadius: moderateScale(20), borderWidth: 1.5, padding: scale(9), ...shadows.soft },
  cardSelected: { borderWidth: 2, shadowColor: '#d83585', shadowOpacity: 0.16 },
  preview: { width: '100%', borderRadius: radiiInner, overflow: 'hidden', position: 'relative' },
  selectedBadge: {
    position: 'absolute',
    left: scale(8),
    top: scale(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(9),
    paddingVertical: verticalScale(4),
    borderRadius: 999,
  },
  selectedText: { fontFamily: fonts.bodyBlack, fontSize: fontSize(9.5), letterSpacing: 0.5, color: '#ffffff' },
  cardCopy: { flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingTop: verticalScale(9), paddingHorizontal: scale(3) },
  cardCopyLeft: { flex: 1 },
  cardName: { fontFamily: fonts.display, fontSize: fontSize(15), letterSpacing: -0.2 },
  cardMeta: { fontFamily: fonts.bodyBold, fontSize: fontSize(10.5), marginTop: verticalScale(2) },

  empty: { alignItems: 'center', gap: verticalScale(6), paddingVertical: verticalScale(40) },
  emptyTitle: { fontFamily: fonts.display, fontSize: fontSize(18) },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSize(12.5) },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(12),
    width: '100%',
    maxWidth: scale(1120),
    alignSelf: 'center',
    marginTop: verticalScale(12),
  },
  nextBtn: { flex: 1, maxWidth: scale(340) },
});

export default SlotSelectionScreen;
