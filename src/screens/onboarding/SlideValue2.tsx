import React from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { Tokens } from '../../theme/theme';
import { Fonts } from '../../theme/typography';
import { Dots, NextButton, SkipRow } from './components';
import { CREAM, shared } from './shared';

interface Props {
  onNext: () => void;
  onSkip: () => void;
  scrollX: Animated.Value;
  index: number;
  slideWidth: number;
}

const NODES = [
  { left: 14, top: 16, t: 'Florenz, Caffè Gilli', tag: 'Reise', rot: '-2deg' },
  { left: 188, top: 96, t: 'Pienza vs. Montalcino', tag: 'Italien', rot: '1.5deg' },
  { left: 36, top: 174, t: 'Caffè-Notizen', tag: 'Kaffee', rot: '-1deg' },
];

export default function SlideValue2({ onNext, onSkip, scrollX, index, slideWidth }: Props) {
  const translateX = scrollX.interpolate({
    inputRange: [(index - 1) * slideWidth, index * slideWidth, (index + 1) * slideWidth],
    outputRange: [-slideWidth * 0.25, 0, slideWidth * 0.25],
    extrapolate: 'clamp',
  });

  const opacity = scrollX.interpolate({
    inputRange: [(index - 0.5) * slideWidth, index * slideWidth, (index + 0.5) * slideWidth],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={[shared.screen, { backgroundColor: 'transparent' }]}>
      <Animated.View style={[styles.inner, { transform: [{ translateX }], opacity }]}>
        <SkipRow label="II / III" onSkip={onSkip} />

        <View style={styles.graphArea}>
          <Svg width="100%" height={220} style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Path
              d="M 60 50 Q 200 80 270 130 T 110 200"
              stroke={Tokens.amberDeep}
              strokeWidth={1.5}
              fill="none"
              strokeDasharray="3,4"
              strokeLinecap="round"
              opacity={0.7}
            />
            <Circle cx={60} cy={50} r={3} fill={Tokens.amberDeep} />
            <Circle cx={270} cy={130} r={3} fill={Tokens.amberDeep} />
            <Circle cx={110} cy={200} r={3} fill={Tokens.amberDeep} />
          </Svg>

          {NODES.map((n, i) => (
            <View
              key={i}
              style={[
                styles.threadCard,
                { position: 'absolute', left: n.left, top: n.top, transform: [{ rotate: n.rot }] },
              ]}
            >
              <Text style={styles.threadCardText}>{n.t}</Text>
              <View style={[shared.tag, { marginTop: 6 }]}>
                <Text style={shared.tagText}>{n.tag}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.pill}>
          <Text style={styles.pillIcon}>✦</Text>
          <Text style={styles.pillLabel}>Toskana — Mai-Trip</Text>
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ paddingBottom: 25 }}>
          <Text style={shared.kapitel}>Kapitel 02 — Verbinden</Text>
          <Text style={styles.headline}>
            Die KI webt deine Notizen{'\n'}
            <Text style={{ fontFamily: Fonts.serifItalic }}>zu Threads.</Text>
          </Text>
          <Text style={styles.body}>
            Was du an verschiedenen Tagen geschrieben hast, findet zueinander — als Faden, den du jederzeit wieder lesen kannst.
          </Text>
        </View>

        <View style={shared.footerRow}>
          <Dots count={3} active={1} />
          <NextButton label="weiter →" onPress={onNext} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 20,
    paddingBottom: 28,
  },
  graphArea: {
    marginTop: 28,
    height: 220,
    position: 'relative',
  },
  threadCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Tokens.paper,
    borderWidth: 0.5,
    borderColor: Tokens.paperEdge,
    borderRadius: 10,
    shadowColor: Tokens.warmShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    maxWidth: 160,
  },
  threadCardText: {
    fontFamily: Fonts.serif,
    fontSize: 14,
    lineHeight: 15.4,
    color: Tokens.ink,
  },
  pill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Tokens.amberSoft,
    borderWidth: 0.5,
    borderColor: Tokens.amber,
    borderRadius: 999,
    marginTop: 6,
  },
  pillIcon: {
    fontSize: 14,
    color: Tokens.amberDeep,
  },
  pillLabel: {
    fontFamily: Fonts.serifItalic,
    fontSize: 15,
    color: Tokens.amberDeep,
  },
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 34,
    lineHeight: 35.7,
    color: Tokens.ink,
    letterSpacing: -1.36,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 14.5,
    lineHeight: 22.5,
    color: Tokens.inkDim,
    marginTop: 12,
  },
});
