import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Radii, Shadows } from '../theme/gradients';

interface Props {
  colors: readonly [string, string];
  style?: StyleProp<ViewStyle>;
  radius?: number;
  glow?: boolean;
  children?: React.ReactNode;
}

/**
 * Lightweight gradient surface used as a background for cards, buttons,
 * and accent surfaces. Centralizes the rounded/shadow look so individual
 * screens stay tidy.
 */
export default function GradientCard({
  colors,
  style,
  radius = Radii.md,
  glow = false,
  children,
}: Props) {
  return (
    <View
      style={[
        styles.shadow,
        glow ? Shadows.glow(colors[0]) : Shadows.soft,
        { borderRadius: radius },
        style,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { borderRadius: radius }]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    backgroundColor: 'transparent',
  },
  gradient: {
    overflow: 'hidden',
  },
});
