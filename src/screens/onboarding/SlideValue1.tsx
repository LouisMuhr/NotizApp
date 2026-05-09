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

export default function SlideValue1({ onNext, onSkip }: Props) {
  return (
    <SafeAreaView style={[shared.screen, { backgroundColor: CREAM }]}>
      <View style={styles.inner}>
        <SkipRow label="I / III" onSkip={onSkip} />

        <View style={{ marginTop: 28 }}>
          {[
            { txt: 'Eine', italic: false, color: Tokens.ink, indent: 0 },
            { txt: 'Notiz', italic: true, color: Tokens.amberDeep, indent: 60 },
            { txt: 'ist ein', italic: false, color: Tokens.ink, indent: 0 },
            { txt: 'Anfang.', italic: true, color: Tokens.ink, indent: 0 },
          ].map((row, i) => (
            <Text
              key={i}
              style={[
                styles.headline,
                { color: row.color, marginLeft: row.indent },
                row.italic && { fontFamily: Fonts.serifItalic },
              ]}
            >
              {row.txt}
            </Text>
          ))}
        </View>

        <View style={{ marginTop: 26, marginHorizontal: -4 }}>
          <View style={styles.noteCard}>
            <Text style={styles.noteDate}>Dienstag · 12. Mai</Text>
            <Text style={styles.noteTitle}>Toskana — die ersten Gedanken</Text>
            <Text style={styles.noteBody} numberOfLines={2}>
              Florenz früh am Morgen, dann Pienza. Vielleicht den ganzen Mai dort bleiben.
            </Text>
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 12 }}>
              <View style={shared.tag}><Text style={shared.tagText}>Reise</Text></View>
              <View style={shared.tag}><Text style={shared.tagText}>Italien</Text></View>
            </View>
          </View>
          <View style={styles.noteCardBehind}>
            <Text style={styles.noteCardBehindText}>Sauerteig — Hydration zu hoch…</Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ paddingTop: 14 }}>
          <Text style={shared.kapitel}>Kapitel 01 — Schreiben</Text>
          <Text style={styles.caption}>Text, Stimme oder Liste — die Notiz passt sich an, nicht du.</Text>
        </View>

        <View style={shared.footerRow}>
          <Dots count={3} active={0} />
          <NextButton label="weiter →" onPress={onNext} />
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
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 64,
    lineHeight: 64 * 0.88,
    letterSpacing: -2.56,
    marginTop: 4,
  },
  noteCard: {
    padding: 20,
    backgroundColor: Tokens.paperDeep,
    borderWidth: 0.5,
    borderColor: Tokens.paperEdge,
    borderRadius: 18,
    shadowColor: Tokens.warmShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    transform: [{ rotate: '-1.2deg' }],
  },
  noteDate: {
    fontFamily: Fonts.sans,
    fontSize: 10.5,
    color: Tokens.inkFaint,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 8,
  },
  noteTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 26.4,
    color: Tokens.ink,
    letterSpacing: -0.24,
    marginBottom: 10,
  },
  noteBody: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 20.15,
    color: Tokens.inkDim,
  },
  noteCardBehind: {
    marginTop: -12,
    marginHorizontal: 26,
    padding: 12,
    backgroundColor: Tokens.paper,
    borderWidth: 0.5,
    borderColor: Tokens.paperEdge,
    borderRadius: 14,
    opacity: 0.55,
    transform: [{ rotate: '0.8deg' }],
    height: 36,
    overflow: 'hidden',
  },
  noteCardBehindText: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    color: Tokens.inkDim,
  },
  caption: {
    fontFamily: Fonts.serifItalic,
    fontSize: 15,
    lineHeight: 21,
    color: Tokens.inkDim,
  },
});
