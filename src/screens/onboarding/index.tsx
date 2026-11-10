import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  View,
  ViewToken,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_KEY } from './shared';
import SlideValue1 from './SlideValue1';
import SlideValue2 from './SlideValue2';
import SlideValue3 from './SlideValue3';
import SlideWelcome from './SlideWelcome';
import SlideSetup from './SlideSetup';
import { currentBackgroundVendor } from '../../utils/deviceVendor';

export { ONBOARDING_KEY };

const { width: W } = Dimensions.get('window');

// Hintergrundfarben pro Slide — interpoliert während des Wischens
const CREAM_BG = '#F0E9D6'; // oklch(0.95 0.045 75) als Hex
const BG_BY_SLIDE: Record<SlideKey, string> = {
  v1: CREAM_BG,
  v2: CREAM_BG,
  v3: CREAM_BG,
  setup: CREAM_BG,
  welcome: '#9C5F1F', // AmberDeep
};

type SlideKey = 'v1' | 'v2' | 'v3' | 'setup' | 'welcome';
// Einrichtung nur auf Android: dort entscheiden exakte Alarme/Akku/Autostart, ob Erinnerungen ankommen.
function buildSlides(): SlideKey[] {
  return Platform.OS === 'android' ? ['v1', 'v2', 'v3', 'setup', 'welcome'] : ['v1', 'v2', 'v3', 'welcome'];
}

interface Props {
  onDone: () => void;
  onSignup?: () => void;
  onLogin?: () => void;
}

export default function OnboardingScreen({ onDone, onSignup, onLogin }: Props) {
  const SLIDES = useMemo(buildSlides, []);
  const vendor = useMemo(currentBackgroundVendor, []);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<Animated.FlatList<SlideKey>>(null);
  const activeIndexRef = useRef(0);

  // Hintergrundfarbe interpoliert zwischen den Slides
  const backgroundColor = scrollX.interpolate({
    inputRange: SLIDES.map((_, i) => i * W),
    outputRange: SLIDES.map((k) => BG_BY_SLIDE[k]),
    extrapolate: 'clamp',
  });

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        const newIndex = viewableItems[0].index;
        if (newIndex !== activeIndexRef.current) {
          activeIndexRef.current = newIndex;
          // Haptisches Feedback beim Page-Change
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    }
  );

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onDone();
  }

  function goToNext() {
    const next = activeIndexRef.current + 1;
    if (next < SLIDES.length) {
      (flatListRef.current as any)?.scrollToIndex({ index: next, animated: true });
    } else {
      finish();
    }
  }

  // "Überspringen" springt über die Erklär-Slides, aber nie über die Einrichtung.
  function goToLast() {
    const setup = SLIDES.indexOf('setup');
    const target = setup >= 0 ? setup : SLIDES.length - 1;
    (flatListRef.current as any)?.scrollToIndex({ index: target, animated: true });
  }

  function renderSlide({ item, index }: { item: SlideKey; index: number }) {
    const parallaxProps = { scrollX, index, slideWidth: W };

    const slide = (() => {
      switch (item) {
        case 'v1':
          return <SlideValue1 onNext={goToNext} onSkip={goToLast} {...parallaxProps} />;
        case 'v2':
          return <SlideValue2 onNext={goToNext} onSkip={goToLast} {...parallaxProps} />;
        case 'v3':
          return <SlideValue3 onNext={goToNext} onSkip={goToLast} {...parallaxProps} />;
        case 'setup':
          return <SlideSetup vendor={vendor} onNext={goToNext} {...parallaxProps} />;
        case 'welcome':
          return (
            <SlideWelcome
              onSignup={onSignup ?? finish}
              onLogin={onLogin ?? finish}
              {...parallaxProps}
            />
          );
      }
    })();

    return <View style={{ width: W, flex: 1 }}>{slide}</View>;
  }

  return (
    <Animated.View style={{ flex: 1, backgroundColor }}>
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={renderSlide}
        getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}
