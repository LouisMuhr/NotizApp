// QuickCaptureFAB — Globaler Floating-Action-Button für Brainstorm-Capture.
//
//   Tap        → Voice-Modus (Mikrofon öffnet sich)
//   Long-Press → Text-Modus  (TextInput öffnet sich)

import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Gradients, Radii, Shadows } from '../theme/gradients';
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
      <View style={[styles.wrap, Shadows.glow(Gradients.secondary[0])]}>
        <Animated.View style={{ transform: [{ scale: fabScale }] }}>
          <Pressable
            onPress={openVoice}
            onLongPress={openText}
            onPressIn={pressIn}
            onPressOut={pressOut}
            delayLongPress={400}
            style={styles.pressable}
          >
            <LinearGradient
              colors={Gradients.secondary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            >
              <MaterialCommunityIcons name="microphone" size={26} color="#FFFFFF" />
            </LinearGradient>
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
  pressable: {
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  gradient: {
    width: 54,
    height: 54,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
