import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tokens } from '../../theme/theme';
import { Fonts } from '../../theme/typography';
import { Dots, NextButton, SkipRow } from './components';
import { CREAM, shared } from './shared';

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

const LIST = [
  ['01', 'Ende-zu-Ende verschlüsselt'],
  ['02', 'KI-Verarbeitung nur, wenn du es anstößt'],
  ['03', 'Export zu Markdown — jederzeit'],
] as const;

export default function SlideValue3({ onNext, onSkip }: Props) {
  return (
    <SafeAreaView style={[shared.screen, { backgroundColor: CREAM }]}>
      <View style={styles.inner}>
        <SkipRow label="III / III" onSkip={onSkip} />

        <View style={{ marginTop: 40 }}>
          <Text style={styles.eyebrow}>— Eine Sache noch.</Text>
          <Text style={styles.headline}>
            Was du{'\n'}schreibst,{'\n'}
            <Text style={{ fontFamily: Fonts.serifItalic, color: Tokens.amberDeep }}>
              liest niemand
            </Text>
            {'\n'}außer dir.
          </Text>
        </View>

        <View style={{ marginTop: 32 }}>
          {LIST.map(([n, txt]) => (
            <View key={n} style={styles.listItem}>
              <Text style={styles.listNum}>{n}</Text>
              <Text style={styles.listText}>{txt}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <View style={shared.footerRow}>
          <Dots count={3} active={2} />
          <NextButton label="loslegen →" onPress={onNext} />
        </View>
      </View>
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
  eyebrow: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Tokens.amberDeep,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 14,
  },
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 58,
    lineHeight: 58 * 0.92,
    color: Tokens.ink,
    letterSpacing: -2.32,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderTopWidth: 0.5,
    borderTopColor: Tokens.rule,
    paddingTop: 12,
    marginTop: 12,
  },
  listNum: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Tokens.amberDeep,
    letterSpacing: 0.88,
    minWidth: 22,
    fontWeight: '500',
  },
  listText: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 23.4,
    color: Tokens.ink,
    flex: 1,
  },
});
