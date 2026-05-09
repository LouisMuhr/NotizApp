import React from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Tokens } from '../../theme/theme';
import { Fonts } from '../../theme/typography';
import { shared } from './shared';

const { width: W } = Dimensions.get('window');

interface Props {
  onSignup: () => void;
  onLogin: () => void;
  scrollX: Animated.Value;
  index: number;
  slideWidth: number;
}

const HERO_ROWS = [
  { txt: 'Schreib', italic: false, align: 'flex-start' as const, dim: false },
  { txt: 'frei.', italic: true, align: 'flex-end' as const, dim: false },
  { txt: 'Verbinde', italic: false, align: 'flex-start' as const, dim: true },
  { txt: 'später.', italic: true, align: 'flex-end' as const, dim: true },
];

export default function SlideWelcome({ onSignup, onLogin, scrollX, index, slideWidth }: Props) {
  // Hero-Text: stärkerer Parallax (0.35) — fühlt sich dramatischer an auf dem letzten Slide
  const heroTranslate = scrollX.interpolate({
    inputRange: [(index - 1) * slideWidth, index * slideWidth, (index + 1) * slideWidth],
    outputRange: [-slideWidth * 0.35, 0, slideWidth * 0.35],
    extrapolate: 'clamp',
  });

  // Buttons: leichter Parallax (0.15) — kommen etwas später rein
  const btnTranslate = scrollX.interpolate({
    inputRange: [(index - 1) * slideWidth, index * slideWidth, (index + 1) * slideWidth],
    outputRange: [-slideWidth * 0.15, 0, slideWidth * 0.15],
    extrapolate: 'clamp',
  });

  const opacity = scrollX.interpolate({
    inputRange: [(index - 0.6) * slideWidth, index * slideWidth],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={[shared.screen, { backgroundColor: 'transparent' }]}>
      {/* Logo — kein Parallax, bleibt stabil */}
      <Animated.View style={[styles.logoRow, { opacity }]}>
        <Text style={styles.logo}>Notiz</Text>
        <View style={styles.logoDot} />
        <Text style={styles.version}>v 2.4</Text>
      </Animated.View>

      {/* Hero type + Faden — stärkerer Parallax */}
      <Animated.View
        style={[styles.heroArea, { transform: [{ translateX: heroTranslate }], opacity }]}
      >
        {HERO_ROWS.map((row, i) => (
          <Text
            key={i}
            style={[
              styles.hero,
              row.italic && { fontFamily: Fonts.serifItalic },
              { alignSelf: row.align, opacity: row.dim ? 0.55 : 1 },
            ]}
          >
            {row.txt}
          </Text>
        ))}

        <Svg
          width={W - 36}
          height={320}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        >
          <Path
            d="M 20 60 C 240 80, 100 200, 320 220 S 60 320, 320 360"
            stroke={Tokens.paper}
            strokeWidth={1}
            fill="none"
            strokeDasharray="2,5"
            strokeLinecap="round"
            opacity={0.4}
          />
        </Svg>
      </Animated.View>

      {/* CTA — leichterer Parallax */}
      <Animated.View
        style={[styles.footer, { transform: [{ translateX: btnTranslate }], opacity }]}
      >
        <TouchableOpacity onPress={onSignup} activeOpacity={0.85} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Konto erstellen →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLogin} activeOpacity={0.7} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Ich habe schon ein Konto</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  logo: {
    fontFamily: Fonts.serifItalic,
    fontSize: 22,
    color: Tokens.paper,
    letterSpacing: -0.44,
  },
  logoDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: Tokens.paper,
    opacity: 0.6,
  },
  version: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Tokens.paper,
    opacity: 0.7,
    letterSpacing: 0.88,
  },
  heroArea: {
    flex: 1,
    marginTop: 40,
    paddingHorizontal: 18,
    position: 'relative',
  },
  hero: {
    fontFamily: Fonts.serif,
    fontSize: 96,
    lineHeight: 96 * 0.88,
    color: Tokens.paper,
    letterSpacing: -3.84,
    marginTop: 4,
  },
  footer: {
    padding: 24,
    gap: 8,
  },
  primaryBtn: {
    height: 56,
    backgroundColor: Tokens.paper,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: Fonts.serifItalic,
    fontSize: 19,
    color: Tokens.amberDeep,
    letterSpacing: -0.19,
  },
  secondaryBtn: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '500',
    color: Tokens.paper,
    opacity: 0.85,
    letterSpacing: 0.52,
  },
});
