// QuickCaptureFAB — Globaler Floating-Action-Button für Brainstorm-Capture.
//
//   Tap        → Voice-Modus (Mikrofon öffnet sich)
//   Long-Press → Text-Modus  (TextInput öffnet sich)

import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radii, Shadows } from '../theme/gradients';
import { Tokens } from '../theme/theme';
import * as haptics from '../utils/haptics';
import VoiceCaptureSheet from './VoiceCaptureSheet';

export default function QuickCaptureFAB() {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [initialMode, setInitialMode] = useState<'voice' | 'text'>('voice');

  const fabScale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(fabScale, {
      toValue: 0.88,
      friction: 5,
      tension: 220,
      useNativeDriver: true,
    }).start();

  const pressOut = () =>
    Animated.spring(fabScale, {
      toValue: 1,
      friction: 4,
      tension: 220,
      useNativeDriver: true,
    }).start();

  const openVoice = () => {
    haptics.medium();
    setInitialMode('voice');
    setSheetVisible(true);
  };

  const openText = () => {
    haptics.light();
    setInitialMode('text');
    setSheetVisible(true);
  };

  return (
    <>
      <View style={[styles.wrap, Shadows.softWarm]}>
        <Animated.View style={{ transform: [{ scale: fabScale }] }}>
          <Pressable
            onPress={openVoice}
            onLongPress={openText}
            onPressIn={pressIn}
            onPressOut={pressOut}
            delayLongPress={400}
            style={[styles.fab, { backgroundColor: Tokens.ink }]}
          >
            <MaterialCommunityIcons name="pencil-outline" size={24} color={Tokens.paper} />
          </Pressable>
        </Animated.View>
      </View>

      <VoiceCaptureSheet
        visible={sheetVisible}
        initialMode={initialMode}
        onClose={() => setSheetVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 20,
    bottom: 165,
    borderRadius: Radii.md,
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
