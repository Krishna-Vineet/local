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

  const event = snapshot?.event;
  const orientation = session.orientation || 'portrait';

  // Available templates matching orientation
  const available = useMemo(() => {
    if (!event?.templates) return [];
    return event.templates.filter(
      (item) => item.active && item.layout.orientation === orientation
    );
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
    if (secondsLeft === 0) {
      resetGuestSession(navigation);
    }
  }, [secondsLeft]);

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
    navigation.goBack();
  };

  return (
    <ScreenContainer style={{ backgroundColor: '#050508' }}>
      <LayoutContainer>
        {/* Prominent Header with Countdown Timer */}
        <ScreenHeader
          title="Pick Your Favourite Look"
          subtitle="Filter by print size and number of photos, then choose one design"
          onBack={handleBack}
          secondsLeft={secondsLeft}
          step="STEP 2 OF 5"
        />

        {/* Filter Chips Bar */}
        <View style={styles.filterBar}>
          {/* Print Size Filters */}
          <View style={styles.filterGroup}>
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
          </View>

          {/* Slot Count Filters */}
          <View style={styles.filterGroup}>
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
          </View>
        </View>

        {/* Templates Carousel (Direct Template View Without Enclosing Card Box) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
        >
          {filtered.map((item) => {
            const isSelected = session.template?.id === item.id;
            const price = getTemplatePrice(item, event?.layoutPrices);
            const isPortrait = item.layout.orientation === 'portrait';
            const canvasWidth = isPortrait ? scale(180) : scale(250);
            const canvasHeight = isPortrait ? verticalScale(260) : verticalScale(175);

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.templateItem,
                  { width: canvasWidth + scale(16) },
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
    marginBottom: verticalScale(14),
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: scale(10),
    marginVertical: 4,
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
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(10),
    gap: scale(16),
  },
  templateItem: {
    alignItems: 'center',
    marginHorizontal: scale(8),
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
