import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Radii, Shadows } from '../theme/gradients';
import { Tokens } from '../theme/theme';

interface Props {
  colors?: readonly [string, string];
  style?: StyleProp<ViewStyle>;
  radius?: number;
  glow?: boolean;
  children?: React.ReactNode;
}

export default function GradientCard({
  style,
  radius = Radii.md,
  children,
}: Props) {
  return (
    <View
      style={[
        styles.card,
        Shadows.softWarm,
        { borderRadius: radius },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Tokens.paperDeep,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.paperEdge,
    borderTopColor: 'rgba(255, 255, 255, 0.65)',
    overflow: 'hidden',
  },
});
