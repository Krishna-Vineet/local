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
    <ScreenContainer>
      <LayoutContainer>
        <View style={styles.header}>
          <Text style={styles.title}>Pick your favourite look</Text>
          <Text style={styles.subtitle}>
            Filter by print size and number of photos, then select a design.
          </Text>
        </View>

        {/* Filter Bar */}
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
            <Text style={styles.filterGroupLabel}>PHOTOS</Text>
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

        {/* Templates Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
        >
          {filtered.map((item) => {
            const isSelected = session.template?.id === item.id;
            const price = getTemplatePrice(item, event?.layoutPrices);

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.templateCard,
                  isSelected && styles.templateCardSelected,
                ]}
                onPress={() => handleSelectTemplate(item)}
                activeOpacity={0.88}
              >
                <View style={styles.canvasWrapper}>
                  <TemplateCanvas
                    template={item}
                    style={{ width: scale(190), height: verticalScale(260) }}
                  />
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>✓ Selected</Text>
                    </View>
                  )}
                </View>

                <View style={styles.templateMeta}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text numberOfLines={1} style={styles.templateName}>
                      {item.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.templateCategory}>
                      {item.layout.label}
                    </Text>
                  </View>
                  <View style={styles.pricePill}>
                    <Text style={styles.priceText}>
                      {price === 0 ? 'Free' : `₹${price}`}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {filtered.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No templates in this combination</Text>
              <Text style={styles.emptySub}>Try selecting another size or photo count.</Text>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
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
  header: {
    alignItems: 'center',
    paddingTop: verticalScale(12),
    marginBottom: verticalScale(12),
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
    marginHorizontal: scale(8),
    marginVertical: 4,
  },
  filterGroupLabel: {
    color: '#71717a',
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 1.5,
    marginRight: 6,
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#18181f',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#27272a',
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
    fontWeight: '700',
  },
  carouselContainer: {
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
  },
  templateCard: {
    backgroundColor: '#121217',
    borderRadius: moderateScale(20),
    borderWidth: 2,
    borderColor: '#27272a',
    padding: scale(14),
    marginHorizontal: scale(10),
    alignItems: 'center',
    width: scale(220),
  },
  templateCardSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  canvasWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(10),
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#8b5cf6',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: fontSize(10),
    fontWeight: '800',
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 4,
  },
  templateName: {
    color: '#ffffff',
    fontSize: fontSize(14),
    fontWeight: '800',
  },
  templateCategory: {
    color: '#a1a1aa',
    fontSize: fontSize(11),
    marginTop: 2,
  },
  pricePill: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.4)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  priceText: {
    color: '#f472b6',
    fontSize: fontSize(12),
    fontWeight: '800',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: fontSize(16),
    fontWeight: '700',
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
    backgroundColor: '#1c1c24',
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
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: fontSize(15),
    fontWeight: '700',
  },
});
