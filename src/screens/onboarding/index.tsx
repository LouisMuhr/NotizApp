import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, View, ViewToken } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_KEY } from './shared';
import SlideValue1 from './SlideValue1';
import SlideValue2 from './SlideValue2';
import SlideValue3 from './SlideValue3';
import SlideWelcome from './SlideWelcome';

export { ONBOARDING_KEY };

const { width: W } = Dimensions.get('window');

interface Props {
  onDone: () => void;
  onSignup?: () => void;
  onLogin?: () => void;
}

type SlideKey = 'v1' | 'v2' | 'v3' | 'welcome';

const SLIDE_ORDER: SlideKey[] = ['v1', 'v2', 'v3', 'welcome'];

export default function OnboardingScreen({ onDone, onSignup, onLogin }: Props) {
  const flatListRef = useRef<FlatList<SlideKey>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  );

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onDone();
  }

  function goToNext() {
    const next = activeIndex + 1;
    if (next < SLIDE_ORDER.length) {
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      finish();
    }
  }

  function renderSlide({ item }: { item: SlideKey }) {
    switch (item) {
      case 'v1':
        return (
          <View style={{ width: W, flex: 1 }}>
            <SlideValue1 onNext={goToNext} onSkip={finish} />
          </View>
        );
      case 'v2':
        return (
          <View style={{ width: W, flex: 1 }}>
            <SlideValue2 onNext={goToNext} onSkip={finish} />
          </View>
        );
      case 'v3':
        return (
          <View style={{ width: W, flex: 1 }}>
            <SlideValue3 onNext={goToNext} onSkip={finish} />
          </View>
        );
      case 'welcome':
        return (
          <View style={{ width: W, flex: 1 }}>
            <SlideWelcome
              onSignup={onSignup ?? finish}
              onLogin={onLogin ?? finish}
            />
          </View>
        );
    }
  }

  return (
    <FlatList
      ref={flatListRef}
      data={SLIDE_ORDER}
      keyExtractor={(item) => item}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      bounces={false}
      onViewableItemsChanged={onViewableItemsChanged.current}
      viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      renderItem={renderSlide}
      getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
      style={{ flex: 1 }}
    />
  );
}
