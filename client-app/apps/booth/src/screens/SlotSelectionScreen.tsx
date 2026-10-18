import { goBackOr } from '../utils/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import type { BoothTemplate } from '@happypix/types';
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
import { getTemplatePrice } from '../utils/pricing';
import { InactivityToast } from '../components/InactivityToast';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Templates'>;

export const SlotSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppTheme();
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

  const event = snapshot?.event;
  const orientation = session.orientation || 'portrait';

  // Available templates matching orientation
  const available = useMemo(() => {
    if (!event?.templates || !Array.isArray(event.templates)) return [];
    const norm = (o?: string) => {
      const s = String(o || '').toLowerCase();
      if (s === 'h' || s === 'landscape' || s === 'horizontal') return 'landscape';
      return 'portrait';
    };
    const targetOrient = norm(orientation);
    return event.templates.filter((item) => {
      if (!item || item.active === false) return false;
      const itemOrient = norm(item.layout?.orientation);
      return itemOrient === targetOrient;
    });
  }, [event?.templates, orientation]);

  const sizes = useMemo(() => {
    return [...new Set(available.map((item) => item.layout.printSize))];
  }, [available]);

  const counts = useMemo(() => {
    return [...new Set(available.map((item) => item.layout.slots))].sort((a, b) => a - b);
  }, [available]);

  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [selectedCount, setSelectedCount] = useState<number | 'all'>('all');

  const filtered = useMemo(() => {
    return available.filter(
      (item) =>
        (selectedSize === 'all' || item.layout.printSize === selectedSize) &&
        (selectedCount === 'all' || item.layout.slots === selectedCount)
    );
  }, [available, selectedSize, selectedCount]);

  useEffect(() => {
    setIdleTimerEnabled(true);
    resetIdleTimer();
    return () => setIdleTimerEnabled(false);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0 && isFocused) {
      resetGuestSession(navigation);
    }
  }, [secondsLeft, isFocused]);

  const handleSelectTemplate = (template: BoothTemplate) => {
    SoundManager.play('click');
    updateSession({ template });
  };

  const handleNext = () => {
    if (!session.template) return;
    SoundManager.play('click');
    navigation.navigate('Prints');
  };

  const handleBack = () => {
    SoundManager.play('click');
    goBackOr(navigation, 'Start');
  };

  return (
    <ScreenContainer style={{ backgroundColor: '#050508' }}>
      <LayoutContainer>
        {/* Prominent Header with Countdown Timer */}
        <ScreenHeader
          title="Pick Your Favourite Look"
          subtitle="Filter by print size and number of photos, then choose one design"
          secondsLeft={secondsLeft}
          step="STEP 2 OF 5"
        />

        {/* Filter Chips Bar */}
        <View style={[styles.filterBar, !isLandscape && styles.filterBarPortrait]}>
          {/* Print Size Filters */}
          <ScrollView
            horizontal={!isLandscape}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterGroup}
          >
            <Text style={styles.filterGroupLabel}>SIZE</Text>
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedSize === 'all' && styles.filterChipActive,
              ]}
              onPress={() => setSelectedSize('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedSize === 'all' && styles.filterChipTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {sizes.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.filterChip,
                  selectedSize === s && styles.filterChipActive,
                ]}
                onPress={() => setSelectedSize(s)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedSize === s && styles.filterChipTextActive,
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Slot Count Filters */}
          <ScrollView
            horizontal={!isLandscape}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterGroup}
          >
            <Text style={styles.filterGroupLabel}>SHOTS</Text>
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedCount === 'all' && styles.filterChipActive,
              ]}
              onPress={() => setSelectedCount('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCount === 'all' && styles.filterChipTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {counts.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.filterChip,
                  selectedCount === c && styles.filterChipActive,
                ]}
                onPress={() => setSelectedCount(c)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedCount === c && styles.filterChipTextActive,
                  ]}
                >
                  {c} {c === 1 ? 'Shot' : 'Shots'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Templates View: Horizontal Carousel in Landscape, 2-Column Grid in Portrait */}
        <ScrollView
          horizontal={isLandscape}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={isLandscape ? styles.carouselContainer : styles.portraitScrollContainer}
        >
          <View style={isLandscape ? styles.landscapeRow : styles.portraitGrid}>
            {filtered.map((item) => {
              const isSelected = session.template?.id === item.id;
              const price = getTemplatePrice(item, event, snapshot?.settings);
              const isPortrait =
                (item.layout?.orientation || 'portrait').toLowerCase() !== 'landscape' &&
                (item.layout?.orientation || 'portrait').toLowerCase() !== 'h';
              const rawCw = item.layout?.canvas?.width;
              const rawCh = item.layout?.canvas?.height;
              const aspect = rawCw && rawCh ? rawCw / rawCh : isPortrait ? 2 / 3 : 3 / 2;

              let canvasWidth: number;
              let canvasHeight: number;
              let cardWidth: number;

              if (isLandscape) {
                const maxH = Math.min(verticalScale(270), Math.max(160, height * 0.45));
                const maxW = scale(260);
                canvasWidth = Math.min(maxW, Math.round(maxH * aspect));
                canvasHeight = Math.round(canvasWidth / aspect);
                cardWidth = Math.max(canvasWidth + scale(16), scale(170));
              } else {
                const availW = Math.max(280, width - 48);
                cardWidth = Math.min(260, Math.floor((availW - 16) / 2));
                const maxCanvasW = cardWidth - 14;
                const maxCanvasH = Math.min(Math.round(height * 0.32), 260);
                canvasWidth = Math.min(maxCanvasW, Math.round(maxCanvasH * aspect));
                canvasHeight = Math.round(canvasWidth / aspect);
              }

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.templateItem,
                    !isLandscape && styles.templateItemPortrait,
                    { width: cardWidth },
                  ]}
                  onPress={() => handleSelectTemplate(item)}
                  activeOpacity={0.9}
                >
                  {/* Raw Print Template Canvas with radiant glowing selection ring */}
                  <View
                    style={[
                      styles.canvasGlowWrap,
                      isSelected && styles.canvasGlowWrapSelected,
                    ]}
                  >
                    <TemplateCanvas
                      template={item}
                      style={{
                        width: canvasWidth,
                        height: canvasHeight,
                        borderRadius: 12,
                        overflow: 'hidden',
                      }}
                    />

                    {/* Floating Checkmark Badge */}
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>✓</Text>
                      </View>
                    )}
                  </View>

                  {/* Bottom Floating Size & Price Pill */}
                  <View style={[styles.floatingPill, isSelected && styles.floatingPillSelected]}>
                    <View style={{ flex: 1, paddingRight: 6 }}>
                      <Text numberOfLines={1} style={styles.floatingTitle}>
                        {item.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.floatingSize}>
                        {item.layout.printSize} • {item.layout.slots} {item.layout.slots === 1 ? 'shot' : 'shots'}
                      </Text>
                    </View>

                    <View style={[styles.floatingPriceBadge, price === 0 && styles.floatingPriceFree]}>
                      <Text style={[styles.floatingPriceText, price === 0 && styles.floatingPriceTextFree]}>
                        {price === 0 ? 'FREE' : `₹${price}`}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {filtered.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No templates found</Text>
              <Text style={styles.emptySub}>Try selecting another size or photo count.</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.8}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.nextBtn,
              !session.template && styles.nextBtnDisabled,
            ]}
            disabled={!session.template}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Choose This Template →</Text>
          </TouchableOpacity>
        </View>

        {secondsLeft <= 25 && (
          <InactivityToast secondsLeft={secondsLeft} onStayActive={resetIdleTimer} />
        )}
      </LayoutContainer>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: verticalScale(10),
  },
  filterBarPortrait: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%',
    gap: 4,
    marginBottom: 8,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: scale(6),
    marginVertical: 3,
  },
  filterGroupLabel: {
    color: '#71717a',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 1.5,
    marginRight: 8,
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#13131c',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#242432',
  },
  filterChipActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#a78bfa',
  },
  filterChipText: {
    color: '#a1a1aa',
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  carouselContainer: {
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
  },
  portraitScrollContainer: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    alignItems: 'center',
  },
  landscapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
  },
  portraitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    width: '100%',
  },
  templateItem: {
    alignItems: 'center',
    marginHorizontal: scale(6),
  },
  templateItemPortrait: {
    marginHorizontal: 0,
    marginBottom: 8,
    backgroundColor: 'rgba(18, 18, 27, 0.55)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#1f1f2e',
  },
  canvasGlowWrap: {
    padding: 3,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  canvasGlowWrapSelected: {
    borderColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.8,
    shadowRadius: 18,
    elevation: 10,
  },
  selectedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: verticalScale(10),
    backgroundColor: '#12121b',
    borderWidth: 1.5,
    borderColor: '#222230',
    borderRadius: 14,
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(12),
  },
  floatingPillSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  floatingTitle: {
    color: '#ffffff',
    fontSize: fontSize(13),
    fontWeight: '800',
  },
  floatingSize: {
    color: '#a1a1aa',
    fontSize: fontSize(10),
    marginTop: 2,
  },
  floatingPriceBadge: {
    backgroundColor: 'rgba(236, 72, 153, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.4)',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  floatingPriceFree: {
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  floatingPriceText: {
    color: '#f472b6',
    fontSize: fontSize(12),
    fontWeight: '900',
  },
  floatingPriceTextFree: {
    color: '#4ade80',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: fontSize(16),
    fontWeight: '800',
  },
  emptySub: {
    color: '#71717a',
    fontSize: fontSize(12),
    marginTop: 4,
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
  nextBtn: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(28),
    borderRadius: moderateScale(12),
    backgroundColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  nextBtnDisabled: {
    opacity: 0.35,
    shadowOpacity: 0,
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '800',
  },
});
