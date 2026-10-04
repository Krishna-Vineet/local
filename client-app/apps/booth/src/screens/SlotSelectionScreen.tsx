import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  Image,
  FlatList,
} from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEFAULT_ARCHITECTURE_TEMPLATES } from '../constants/DefaultTemplates';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import {
  ScreenContainer,
  LayoutContainer,
  useAppTheme,
  fontSize,
  scale,
  moderateScale,
  verticalScale,
} from '../../../../packages/ui/src/index';

import { useBooth } from '../context/BoothProvider';
import SoundManager from '../utils/SoundManager';
import { getTemplatePrice } from '../utils/pricing';
import { EventAPI } from '../../../../packages/api/src/index';

import type { RootStackParamList } from '../../App';
import { InactivityToast } from '../components/InactivityToast';

type Props = NativeStackScreenProps<RootStackParamList, 'SlotSelection'>;

/* ============================================================
   DEMO PHOTOS
============================================================ */
const PREVIEW_IMAGES = [
  { uri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=90' },
  { uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=90' },
  { uri: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=90' },
  { uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=90' },
  { uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=90' },
  { uri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=90' },
];

/* ============================================================
   TIMER
============================================================ */
const TimerPill = ({ timeLeft }: { timeLeft: number }) => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.timerPill, { backgroundColor: theme.colors.error + '20', marginRight: scale(10) }]}>
      <Text style={[styles.timerText, { color: theme.colors.error }]}>{timeLeft}s</Text>
    </View>
  );
};

/* ============================================================
   PHOTO / FILM
============================================================ */
const FilmPhoto = ({ index, width, height }: { index: number; width: number; height: number }) => (
  <View style={[styles.filmPhoto, { width, height }]}>
    <Image source={PREVIEW_IMAGES[index % PREVIEW_IMAGES.length]} style={styles.filmImage} resizeMode="cover" />
    <View style={styles.filmImageOverlay} />
  </View>
);

const Film = ({ template, copyIndex, filmWidth }: { template: any; copyIndex: number; filmWidth: number }) => {
  const isLandscapeTemplate = template.orientation === 'landscape' || template.orientation === 'horizontal';
  const canvasWidth = template.canvas?.width || (isLandscapeTemplate ? 1800 : 1200);
  const canvasHeight = template.canvas?.height || (isLandscapeTemplate ? 1200 : 1800);
  const filmHeight = filmWidth * (canvasHeight / canvasWidth);
  const slots = template.photoSlots || template.slots || [];

  return (
    <View
      style={[
        styles.film,
        {
          width: filmWidth,
          height: filmHeight,
          backgroundColor: template.background?.color || '#FFFFFF',
          overflow: 'hidden',
        },
      ]}
    >
      {slots.map((slot: any, i: number) => {
        const left = (slot.x / canvasWidth) * filmWidth;
        const top = (slot.y / canvasHeight) * filmHeight;
        const w = (slot.width / canvasWidth) * filmWidth;
        const h = (slot.height / canvasHeight) * filmHeight;
        return (
          <View key={i} style={{ position: 'absolute', left, top, width: w, height: h }}>
            <FilmPhoto index={copyIndex * (slots.length || 1) + i} width={w} height={h} />
          </View>
        );
      })}
    </View>
  );
};

/* ============================================================
   FILM OPTION — Horizontal Strip Item
============================================================ */
const FilmOption = ({
  option,
  isSelected,
  onSelect,
  scrollX,
  index,
  itemWidth,
  maxFilmHeight,
  event,
}: {
  option: any;
  isSelected: boolean;
  onSelect: () => void;
  scrollX: Animated.Value;
  index: number;
  itemWidth: number;
  maxFilmHeight: number;
  event: any;
}) => {
  const { theme } = useAppTheme();

  // Constraints so it never breaks top/bottom boundaries
  const isLandscapeTemplate = option.template.orientation === 'landscape' || option.template.orientation === 'horizontal';
  const canvasW = option.template.canvas?.width || (isLandscapeTemplate ? 1800 : 1200);
  const canvasH = option.template.canvas?.height || (isLandscapeTemplate ? 1200 : 1800);
  const aspectRatio = canvasW / canvasH;

  const maxWidth = itemWidth - scale(20);
  const maxHeightWidth = maxFilmHeight * aspectRatio;
  const dynamicFilmWidth = Math.max(40, Math.min(maxWidth, maxHeightWidth));

  // Animations driven strictly by FlatList scroll position
  const inputRange = [(index - 1) * itemWidth, index * itemWidth, (index + 1) * itemWidth];

  const scaleAnim = scrollX.interpolate({
    inputRange,
    outputRange: [0.8, 1, 0.8], // Scaled down to 80% on sides, 100% in center
    extrapolate: 'clamp',
  });

  const opacityAnim = scrollX.interpolate({
    inputRange,
    outputRange: [0.4, 1, 0.4], // Faded out slightly on sides
    extrapolate: 'clamp',
  });

  const borderOpacityAnim = scrollX.interpolate({
    inputRange: [(index - 0.5) * itemWidth, index * itemWidth, (index + 0.5) * itemWidth],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={{
        width: itemWidth,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: opacityAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={onSelect} style={[styles.optionWrapper, { width: itemWidth }]}>
        <View style={[styles.filmsWrapper, { height: maxFilmHeight + scale(40) }]}>
          <View
            style={{
              position: 'relative',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <View style={[styles.filmShadowBoundary, { borderRadius: scale(8) }]}>
              <Film template={option.template} copyIndex={0} filmWidth={dynamicFilmWidth} />
            </View>
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderColor: theme.colors.primary,
                  borderWidth: scale(3.5),
                  borderRadius: scale(8),
                  opacity: borderOpacityAnim,
                },
              ]}
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: scale(6),
            marginTop: isSelected ? scale(12) : scale(8),
          }}
        >
          <Text
            style={[
              styles.optionLabel,
              {
                fontSize: scale(14),
                color: isSelected ? theme.colors.primary : theme.colors.text,
                fontWeight: isSelected ? '900' : '700',
                marginTop: 0,
              },
            ]}
          >
            {option.label}
          </Text>
          {getTemplatePrice(option.template, event) > 0 && (
            <View
              style={{
                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSecondary,
                paddingHorizontal: scale(6),
                paddingVertical: scale(2),
                borderRadius: scale(4),
              }}
            >
              <Text
                style={{
                  fontSize: scale(10),
                  fontWeight: '800',
                  color: isSelected ? '#fff' : theme.colors.textSecondary,
                }}
              >
                ₹{getTemplatePrice(option.template, event)}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.optionSubLabel,
            {
              fontSize: scale(11),
              color: isSelected ? theme.colors.textSecondary : theme.colors.textSecondary + '80',
              marginTop: scale(2),
            },
          ]}
        >
          {option.subLabel}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ============================================================
   SCREEN
============================================================ */
export const SlotSelectionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useAppTheme();
  const { state, send } = useBooth();
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;
  const [layoutPreference, setLayoutPreference] = useState<'vertical' | 'horizontal'>(
    route.params?.layout || 'vertical'
  );
  const event = state.context.activeEvent;
  const initialTime = event?.boothTimeout || 30;
  const [timeLeft, setTimeLeft] = useState(initialTime);

  const expiredRef = useRef(false);
  const startedAtRef = useRef(Date.now());
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const resetTimer = useCallback(() => {
    startedAtRef.current = Date.now();
    setTimeLeft(initialTime);
  }, [initialTime]);

  const handleTimeout = useCallback(() => {
    navigation.replace('Start');
  }, [navigation]);

  useEffect(() => {
    const id = setInterval(() => {
      const remaining = initialTime - Math.floor((Date.now() - startedAtRef.current) / 1000);
      setTimeLeft(Math.max(0, remaining));

      if (remaining <= 0) {
        clearInterval(id);
        if (!expiredRef.current) {
          expiredRef.current = true;
          handleTimeout();
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [handleTimeout, initialTime]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [carouselMeasuredWidth, setCarouselMeasuredWidth] = useState(width - scale(isLandscape ? 64 : 32));

  const AVAILABLE_OPTIONS = useMemo(() => {
    // Only use default architecture templates for the layout selection screen.
    // The visual template designs (assignedTemplateIds) belong only in the CustomizeScreen.
    const sourceTemplates = [...DEFAULT_ARCHITECTURE_TEMPLATES];

    const mappedOptions = sourceTemplates.map((t: any, idx: number) => ({
      id: t._id || `template_${idx}`,
      label: t.name?.split(' ')[0] || 'TEMPLATE',
      subLabel: `${t.photoSlots?.length || 1} PHOTO${(t.photoSlots?.length || 1) > 1 ? 'S' : ''}`,
      frames: t.photoSlots?.length || 1,
      orientation: t.orientation === 'landscape' ? 'horizontal' : 'vertical',
      template: t,
    }));
    
    const enabledLayouts = event?.enabledLayouts || [];
    if (enabledLayouts.length > 0) {
      return mappedOptions.filter(o => enabledLayouts.includes(o.id));
    }

    return mappedOptions;
  }, [event?.enabledLayouts]);

  const displayOptions = useMemo(() => {
    return [...AVAILABLE_OPTIONS].sort((a, b) => {
      if (a.orientation === layoutPreference && b.orientation !== layoutPreference) return -1;
      if (a.orientation !== layoutPreference && b.orientation === layoutPreference) return 1;
      return 0;
    });
  }, [AVAILABLE_OPTIONS, layoutPreference]);

  // Strip Layout Math calculations
  // Center item 60% in portrait, 35% in landscape
  const ITEM_WIDTH = carouselMeasuredWidth * (isLandscape ? 0.35 : 0.6);
  // This side spacing perfectly centers the first and last items in the FlatList
  const SIDE_SPACING = (carouselMeasuredWidth - ITEM_WIDTH) / 2;
  // Controls strict bounds so nothing bleeds off screen
  const MAX_FILM_HEIGHT = isLandscape ? height * 0.45 : height * 0.40;

  // Track the center item visually
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setSelectedIndex(viewableItems[0].index);
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // Selected Data derived strictly from the current visual center
  const selectedSlot = displayOptions[selectedIndex]?.id || null;

  useEffect(() => {
    setSelectedIndex(0);
    if (displayOptions.length > 0) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [layoutPreference, displayOptions.length]);

  const scrollToIndex = useCallback(
    (direction: 'left' | 'right') => {
      let targetIndex = direction === 'left' ? selectedIndex - 1 : selectedIndex + 1;
      if (targetIndex >= 0 && targetIndex < displayOptions.length) {
        SoundManager.play('click');
        flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true });
      }
    },
    [selectedIndex, displayOptions.length]
  );

  const handleItemPress = (index: number) => {
    if (index !== selectedIndex) {
      SoundManager.play('click');
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  };

  useEffect(() => {
    SoundManager.init();
  }, []);

  const handleNext = () => {
    if (!selectedSlot) return;
    SoundManager.haptic(20);
    SoundManager.play('click');
    const selectedOption = displayOptions.find((o: any) => o.id === selectedSlot);
    if (selectedOption) {
      const template = {
        ...selectedOption.template,
        id: selectedOption.id,
        name: selectedOption.label,
        paperSize: '4x6',
        orientation: selectedOption.orientation === 'vertical' ? 'portrait' : 'landscape',
        frames: selectedOption.frames,
        dpi: 300,
        slots: selectedOption.template.photoSlots || selectedOption.template.slots || [],
      };
      send({ type: 'TEMPLATE_SELECTED', template: template as any });

      const isPrintEnabled = !event?.selectedScreens || event.selectedScreens.includes('print');
      const isPaymentEnabled = !event?.selectedScreens || event.selectedScreens.includes('payment');

      if (!isPrintEnabled) {
        const nextParams = {
          orientation: selectedOption.orientation as 'vertical' | 'horizontal',
          templateId: selectedOption.id,
          prints: 0,
          includeQR: true,
          unitPrice: getTemplatePrice(selectedOption.template, event),
          packageType: 'digital-only',
        };

        if (isPaymentEnabled && nextParams.unitPrice > 0) {
          navigation.replace('Payment' as any, nextParams);
        } else {
          navigation.replace('Capture' as any, nextParams);
        }
      } else {
        navigation.replace('PrintCount', {
          orientation: selectedOption.orientation as 'vertical' | 'horizontal',
          templateId: selectedOption.id,
        });
      }
    }
  };

  const getItemLayout = (_: any, index: number) => ({
    length: ITEM_WIDTH,
    offset: ITEM_WIDTH * index,
    index,
  });

  return (
    <ScreenContainer>
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          resetTimer();
          return false;
        }}
      >
        <LayoutContainer
          scrollable={false}
          contentContainerStyle={Object.assign(
            {},
            styles.layout,
            isLandscape ? styles.layoutLandscape : styles.layoutPortrait
          )}
        >
          {/* HEADER */}
          {isLandscape ? (
            <View style={styles.topHeaderContainer}>
              <View style={[styles.layoutToggleContainer, { borderColor: theme.colors.surfaceSecondary }]}>
                <TouchableOpacity
                  onPress={() => { setLayoutPreference('vertical'); SoundManager.play('click'); }}
                  style={[styles.layoutToggleBtn, layoutPreference === 'vertical' && { backgroundColor: theme.colors.primary }]}
                >
                  <Text style={[styles.layoutToggleText, { color: layoutPreference === 'vertical' ? '#000' : theme.colors.text }]}>
                    Vertical
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setLayoutPreference('horizontal'); SoundManager.play('click'); }}
                  style={[styles.layoutToggleBtn, layoutPreference === 'horizontal' && { backgroundColor: theme.colors.primary }]}
                >
                  <Text style={[styles.layoutToggleText, { color: layoutPreference === 'horizontal' ? '#000' : theme.colors.text }]}>
                    Horizontal
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.titleContainer}>
                <Svg width={scale(32)} height={scale(24)} viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: verticalScale(4) }}>
                  <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <Circle cx="12" cy="13" r="4" />
                </Svg>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  CHOOSE YOUR <Text style={{ color: theme.colors.primary }}>TEMPLATE</Text>
                </Text>
                <Text style={[styles.subTitle, { color: theme.colors.textSecondary }]}>
                  Select a layout for your photos
                </Text>
              </View>

              <View style={styles.headerRightContainer}>
                <TimerPill timeLeft={timeLeft} />
                <View style={[styles.photoCountPill, { borderColor: theme.colors.surfaceSecondary }]}>
                  <Svg width={scale(16)} height={scale(16)} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: scale(6) }}>
                    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <Circle cx="8.5" cy="8.5" r="1.5" />
                    <Path d="M21 15l-5-5L5 21" />
                  </Svg>
                  <Text style={[styles.photoCountText, { color: theme.colors.text }]}>
                    {displayOptions.find((o: any) => o.id === selectedSlot)?.frames || 0} Photos
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.topHeaderPortraitContainer}>
              <View style={[styles.titleContainer, { marginTop: verticalScale(16) }]}>
                <Svg width={scale(28)} height={scale(20)} viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: verticalScale(4) }}>
                  <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <Circle cx="12" cy="13" r="4" />
                </Svg>
                <Text style={[styles.title, { color: theme.colors.text, fontSize: fontSize(18) }]}>
                  CHOOSE YOUR <Text style={{ color: theme.colors.primary }}>TEMPLATE</Text>
                </Text>
                <Text style={[styles.subTitle, { color: theme.colors.textSecondary, fontSize: fontSize(12) }]}>
                  Select a layout for your photos
                </Text>
              </View>

              <View style={styles.topHeaderPortraitRow}>
                <View style={[styles.layoutToggleContainer, { borderColor: theme.colors.surfaceSecondary }]}>
                  <TouchableOpacity
                    onPress={() => { setLayoutPreference('vertical'); SoundManager.play('click'); }}
                    style={[styles.layoutToggleBtn, layoutPreference === 'vertical' && { backgroundColor: theme.colors.primary }]}
                  >
                    <Text style={[styles.layoutToggleText, { color: layoutPreference === 'vertical' ? '#000' : theme.colors.text }]}>Vertical</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setLayoutPreference('horizontal'); SoundManager.play('click'); }}
                    style={[styles.layoutToggleBtn, layoutPreference === 'horizontal' && { backgroundColor: theme.colors.primary }]}
                  >
                    <Text style={[styles.layoutToggleText, { color: layoutPreference === 'horizontal' ? '#000' : theme.colors.text }]}>Horizontal</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.headerRightContainer}>
                  <TimerPill timeLeft={timeLeft} />
                  <View style={[styles.photoCountPill, { borderColor: theme.colors.surfaceSecondary }]}>
                    <Svg width={scale(16)} height={scale(16)} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: scale(6) }}>
                      <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <Circle cx="8.5" cy="8.5" r="1.5" />
                      <Path d="M21 15l-5-5L5 21" />
                    </Svg>
                    <Text style={[styles.photoCountText, { color: theme.colors.text }]}>
                      {displayOptions.find((o: any) => o.id === selectedSlot)?.frames || 0} Photos
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* NEW HORIZONTAL STRIP CAROUSEL */}
          <View
            onLayout={(e) => {
              const { width: w } = e.nativeEvent.layout;
              if (w > 0 && Math.abs(w - carouselMeasuredWidth) > 1) {
                setCarouselMeasuredWidth(w);
              }
            }}
            style={{
              flex: 1,
              width: '100%',
              justifyContent: 'center',
              position: 'relative',
              borderWidth: 1,
              borderColor: theme.colors.surfaceSecondary + '40',
              borderRadius: scale(16),
              marginVertical: verticalScale(isLandscape ? 16 : 8),
              backgroundColor: theme.colors.surface + '20',
              overflow: 'hidden',
            }}
          >
            {displayOptions.length > 0 ? (
              <Animated.FlatList
                ref={flatListRef as any}
                data={displayOptions}
                keyExtractor={(item: any) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={ITEM_WIDTH}
                snapToAlignment="center"
                decelerationRate="fast"
                getItemLayout={getItemLayout}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
                scrollEventThrottle={16}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                contentContainerStyle={{
                  paddingHorizontal: SIDE_SPACING,
                  alignItems: 'center',
                }}
                renderItem={({ item, index }) => (
                  <FilmOption
                    option={item}
                    isSelected={selectedIndex === index}
                    onSelect={() => handleItemPress(index)}
                    scrollX={scrollX}
                    index={index}
                    itemWidth={ITEM_WIDTH}
                    maxFilmHeight={MAX_FILM_HEIGHT}
                    event={event}
                  />
                )}
              />
            ) : (
              <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginTop: scale(40) }}>
                No templates configured for this layout. Please contact organizer.
              </Text>
            )}

            {/* FLOATING NAVIGATION ARROWS */}
            {selectedIndex > 0 && (
              <TouchableOpacity
                style={[styles.arrowLeft, { left: scale(isLandscape ? 16 : 8) }]}
                onPress={() => scrollToIndex('left')}
                activeOpacity={0.7}
              >
                <View style={[styles.arrowCircle, { borderColor: theme.colors.primary, width: scale(isLandscape ? 46 : 40), height: scale(isLandscape ? 46 : 40), borderRadius: scale(isLandscape ? 23 : 20) }]}>
                  <Text style={[styles.arrowText, { color: theme.colors.primary, fontSize: scale(isLandscape ? 24 : 20) }]}>←</Text>
                </View>
              </TouchableOpacity>
            )}

            {selectedIndex < displayOptions.length - 1 && (
              <TouchableOpacity
                style={[styles.arrowRight, { right: scale(isLandscape ? 16 : 8) }]}
                onPress={() => scrollToIndex('right')}
                activeOpacity={0.7}
              >
                <View style={[styles.arrowCircle, { borderColor: theme.colors.primary, width: scale(isLandscape ? 46 : 40), height: scale(isLandscape ? 46 : 40), borderRadius: scale(isLandscape ? 23 : 20) }]}>
                  <Text style={[styles.arrowText, { color: theme.colors.primary, fontSize: scale(isLandscape ? 24 : 20) }]}>→</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* DOT INDICATORS */}
            <View style={styles.dotsContainer}>
              {displayOptions.map((opt: any, idx: number) => (
                <View
                  key={opt.id}
                  style={[
                    styles.dot,
                    selectedIndex === idx
                      ? [styles.activeDot, { backgroundColor: theme.colors.primary }]
                      : { backgroundColor: theme.colors.surfaceSecondary },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <View style={styles.footerSideLeft}>
              <TouchableOpacity
                style={[styles.backBtn, { backgroundColor: theme.colors.surfaceSecondary }]}
                onPress={() => navigation.replace('Start')}
              >
                <Text style={[styles.backBtnText, { color: theme.colors.text }]}>BACK</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerSideRight}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleNext}
                disabled={!selectedSlot}
                style={[
                  styles.nextBtn,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: selectedSlot ? 1 : 0,
                  },
                ]}
              >
                <Text style={styles.nextText}>NEXT</Text>
                <Text style={styles.nextArrow}>→</Text>
              </TouchableOpacity>
            </View>
          </View>

          <InactivityToast visible={timeLeft <= 10} />
        </LayoutContainer>
      </View>
    </ScreenContainer>
  );
};

/* ============================================================
   STYLES
============================================================ */
const styles = StyleSheet.create({
  layout: { flex: 1, justifyContent: 'space-between', paddingHorizontal: scale(32) },
  layoutLandscape: { paddingTop: verticalScale(16), paddingBottom: verticalScale(16) },
  layoutPortrait: { paddingTop: verticalScale(24), paddingBottom: verticalScale(24), paddingHorizontal: scale(16) },

  topHeaderContainer: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: verticalScale(10) },
  topHeaderPortraitContainer: { width: '100%', paddingTop: verticalScale(10) },
  topHeaderPortraitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  layoutToggleContainer: { flexDirection: 'row', borderWidth: 1, borderRadius: moderateScale(25), overflow: 'hidden', padding: scale(2) },
  layoutToggleBtn: { paddingVertical: verticalScale(8), paddingHorizontal: scale(16), borderRadius: moderateScale(25) },
  layoutToggleText: { fontSize: fontSize(14), fontWeight: '700' },

  titleContainer: { alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  title: { textAlign: 'center', fontSize: fontSize(20), fontWeight: '900', letterSpacing: 3, textTransform: 'uppercase' },
  subTitle: { textAlign: 'center', fontSize: fontSize(14), marginTop: verticalScale(4) },

  headerRightContainer: { flexDirection: 'row', alignItems: 'center' },
  photoCountPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingVertical: verticalScale(8), paddingHorizontal: scale(16), borderRadius: moderateScale(20) },
  photoCountText: { fontSize: fontSize(14), fontWeight: '700' },
  timerPill: { paddingVertical: verticalScale(8), paddingHorizontal: scale(16), borderRadius: moderateScale(20) },
  timerText: { fontSize: fontSize(14), fontWeight: '900' },

  optionWrapper: { alignItems: 'center', justifyContent: 'flex-end' },
  filmsWrapper: { justifyContent: 'center', alignItems: 'center' },
  filmShadowBoundary: { backgroundColor: '#FFFFFF', padding: scale(6), shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },

  arrowLeft: { position: 'absolute', top: '50%', marginTop: -scale(23), zIndex: 10 },
  arrowRight: { position: 'absolute', top: '50%', marginTop: -scale(23), zIndex: 10 },
  arrowCircle: { backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5, borderWidth: scale(1.5) },
  arrowText: { fontSize: scale(24), fontWeight: 'bold', marginBottom: scale(6) },

  dotsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', position: 'absolute', bottom: verticalScale(16), width: '100%', zIndex: 5 },
  dot: { width: scale(6), height: scale(6), borderRadius: scale(3), marginHorizontal: scale(4) },
  activeDot: { width: scale(20) },

  film: { backgroundColor: '#F7F7F7', borderWidth: scale(1), borderColor: '#CFCFCF', overflow: 'hidden' },
  filmPhoto: { overflow: 'hidden', backgroundColor: '#181818', borderWidth: scale(1), borderColor: '#BDBDBD' },
  filmImage: { width: '100%', height: '100%' },
  filmImageOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.035)' },

  optionLabel: { fontSize: fontSize(18), fontWeight: '900', letterSpacing: 1.5, textAlign: 'center', textTransform: 'uppercase' },
  optionSubLabel: { fontSize: fontSize(12), fontWeight: '700', letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase' },

  footer: { width: '100%', minHeight: verticalScale(58), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerSideLeft: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' },
  footerSideRight: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  backBtn: { paddingVertical: verticalScale(12), paddingHorizontal: scale(32), borderRadius: moderateScale(20) },
  backBtnText: { fontSize: fontSize(14), fontWeight: '900', letterSpacing: 1 },
  nextBtn: { minWidth: scale(130), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: verticalScale(10), paddingHorizontal: scale(28), borderRadius: moderateScale(24), shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  nextText: { color: '#FFFFFF', fontSize: fontSize(14), fontWeight: '900', letterSpacing: 1.5 },
  nextArrow: { color: '#FFFFFF', fontSize: fontSize(14), fontWeight: '700', marginLeft: scale(8), marginTop: verticalScale(-2) },
});