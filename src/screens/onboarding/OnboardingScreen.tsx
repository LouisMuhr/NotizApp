import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tokens } from '../../theme/theme';
import { Fonts } from '../../theme/typography';

const { width: W } = Dimensions.get('window');

export const ONBOARDING_KEY = '@notizapp_onboarding_done';

interface Props {
  onDone: () => void;
}

// ─── Shared sub-components ───────────────────────────────────

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 18 : 6,
            height: 6,
            borderRadius: 999,
            backgroundColor: i === active ? Tokens.amberDeep : Tokens.inkFaint,
            opacity: i === active ? 1 : 0.35,
          }}
        />
      ))}
    </View>
  );
}

function SkipRow({
  label,
  onSkip,
  light = false,
}: {
  label: string;
  onSkip: () => void;
  light?: boolean;
}) {
  return (
    <View style={styles.skipRow}>
      <Text style={[styles.pageLabel, light && { color: Tokens.paper, opacity: 0.55 }]}>
        {label}
      </Text>
      <TouchableOpacity onPress={onSkip}>
        <Text style={[styles.skipText, light && { color: Tokens.paper }]}>Überspringen</Text>
      </TouchableOpacity>
    </View>
  );
}

function NextButton({
  label,
  onPress,
  bgColor = Tokens.ink,
  fgColor = Tokens.paper,
}: {
  label: string;
  onPress: () => void;
  bgColor?: string;
  fgColor?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.nextBtn, { backgroundColor: bgColor }]}
    >
      <Text style={[styles.nextBtnText, { color: fgColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Screen 0: Welcome ──────────────────────────────────────

function Welcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: Tokens.amberDeep }]}>
      {/* Logo row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 24 }}>
        <Text style={styles.welcomeLogo}>Notiz</Text>
        <View style={styles.welcomeDot} />
        <Text style={styles.welcomeVersion}>v 2.4</Text>
      </View>

      {/* Hero typography + SVG thread */}
      <View style={{ flex: 1, marginTop: 40, paddingHorizontal: 18, position: 'relative' }}>
        {[
          { txt: 'Schreib', italic: false, align: 'flex-start', dim: false },
          { txt: 'frei.', italic: true, align: 'flex-end', dim: false },
          { txt: 'Verbinde', italic: false, align: 'flex-start', dim: true },
          { txt: 'später.', italic: true, align: 'flex-end', dim: true },
        ].map((row, i) => (
          <Text
            key={i}
            style={[
              styles.welcomeHero,
              row.italic && { fontFamily: Fonts.serifItalic },
              { alignSelf: row.align as any, opacity: row.dim ? 0.55 : 1 },
            ]}
          >
            {row.txt}
          </Text>
        ))}

        {/* Dashed thread curve */}
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
      </View>

      {/* CTA buttons */}
      <View style={{ padding: 24, gap: 8 }}>
        <TouchableOpacity
          onPress={onNext}
          activeOpacity={0.85}
          style={styles.welcomePrimaryBtn}
        >
          <Text style={styles.welcomePrimaryBtnText}>Konto erstellen →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={{ height: 44, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.welcomeSecondaryBtnText}>Ich habe schon ein Konto</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Screen 1: Wert 1 — Schreiben ───────────────────────────

function Value1({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: 'oklch(0.95 0.045 75)' }]}>
      <View style={{ flex: 1, paddingHorizontal: 26, paddingTop: 20, paddingBottom: 28 }}>
        <SkipRow label="I / III" onSkip={onSkip} />

        {/* Magazin-Headline */}
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
                styles.v1Headline,
                { color: row.color, marginLeft: row.indent },
                row.italic && { fontFamily: Fonts.serifItalic },
              ]}
            >
              {row.txt}
            </Text>
          ))}
        </View>

        {/* Notiz-Karten-Stapel */}
        <View style={{ marginTop: 26, marginHorizontal: -4 }}>
          {/* Hauptkarte */}
          <View style={styles.noteCard}>
            <Text style={styles.noteCardDate}>Dienstag · 12. Mai</Text>
            <Text style={styles.noteCardTitle}>Toskana — die ersten Gedanken</Text>
            <Text style={styles.noteCardBody} numberOfLines={2}>
              Florenz früh am Morgen, dann Pienza. Vielleicht den ganzen Mai dort bleiben.
            </Text>
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 12 }}>
              <View style={styles.tag}><Text style={styles.tagText}>Reise</Text></View>
              <View style={styles.tag}><Text style={styles.tagText}>Italien</Text></View>
            </View>
          </View>
          {/* Karte dahinter */}
          <View style={styles.noteCardBehind}>
            <Text style={styles.noteCardBehindText}>Sauerteig — Hydration zu hoch…</Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {/* Kapitel-Caption */}
        <View style={{ paddingTop: 14 }}>
          <Text style={styles.kapitel}>Kapitel 01 — Schreiben</Text>
          <Text style={styles.caption}>Text, Stimme oder Liste — die Notiz passt sich an, nicht du.</Text>
        </View>

        {/* Footer */}
        <View style={styles.footerRow}>
          <Dots count={3} active={0} />
          <NextButton label="weiter →" onPress={onNext} />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Screen 2: Wert 2 — Threads ─────────────────────────────

function Value2({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: 'oklch(0.95 0.045 75)' }]}>
      <View style={{ flex: 1, paddingHorizontal: 26, paddingTop: 20, paddingBottom: 28 }}>
        <SkipRow label="II / III" onSkip={onSkip} />

        {/* Thread-Visualisierung: Karten + Faden */}
        <View style={{ marginTop: 28, height: 220, position: 'relative' }}>
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

          {[
            { left: 14, top: 16, t: 'Florenz, Caffè Gilli', tag: 'Reise', rot: '-2deg' },
            { left: 188, top: 96, t: 'Pienza vs. Montalcino', tag: 'Italien', rot: '1.5deg' },
            { left: 36, top: 174, t: 'Caffè-Notizen', tag: 'Kaffee', rot: '-1deg' },
          ].map((n, i) => (
            <View
              key={i}
              style={[
                styles.threadCard,
                { position: 'absolute', left: n.left, top: n.top, transform: [{ rotate: n.rot }] },
              ]}
            >
              <Text style={styles.threadCardText}>{n.t}</Text>
              <View style={[styles.tag, { marginTop: 6 }]}>
                <Text style={styles.tagText}>{n.tag}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Amber-Pill */}
        <View style={styles.amberPill}>
          <Text style={styles.amberPillText}>✦</Text>
          <Text style={styles.amberPillLabel}>Toskana — Mai-Trip</Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* Text-Block */}
        <View style={{ paddingBottom: 25 }}>
          <Text style={styles.kapitel}>Kapitel 02 — Verbinden</Text>
          <Text style={styles.v2Headline}>
            Die KI webt deine Notizen{'\n'}
            <Text style={{ fontFamily: Fonts.serifItalic }}>zu Threads.</Text>
          </Text>
          <Text style={styles.v2Body}>
            Was du an verschiedenen Tagen geschrieben hast, findet zueinander — als Faden, den du jederzeit wieder lesen kannst.
          </Text>
        </View>

        <View style={styles.footerRow}>
          <Dots count={3} active={1} />
          <NextButton label="weiter →" onPress={onNext} />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Screen 3: Wert 3 — Privacy ─────────────────────────────

function Value3({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: 'oklch(0.95 0.045 75)' }]}>
      <View style={{ flex: 1, paddingHorizontal: 26, paddingTop: 20, paddingBottom: 28 }}>
        <SkipRow label="III / III" onSkip={onSkip} />

        <View style={{ marginTop: 40 }}>
          <Text style={styles.v3Eyebrow}>— Eine Sache noch.</Text>
          <Text style={styles.v3Headline}>
            Was du{'\n'}schreibst,{'\n'}
            <Text style={[{ fontFamily: Fonts.serifItalic, color: Tokens.amberDeep }]}>
              liest niemand
            </Text>
            {'\n'}außer dir.
          </Text>
        </View>

        <View style={{ marginTop: 32, gap: 0 }}>
          {[
            ['01', 'Ende-zu-Ende verschlüsselt'],
            ['02', 'KI-Verarbeitung nur, wenn du es anstößt'],
            ['03', 'Export zu Markdown — jederzeit'],
          ].map(([n, txt]) => (
            <View key={n} style={styles.v3ListItem}>
              <Text style={styles.v3ListNum}>{n}</Text>
              <Text style={styles.v3ListText}>{txt}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.footerRow}>
          <Dots count={3} active={2} />
          <NextButton label="loslegen →" onPress={onDone} />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Root component ─────────────────────────────────────────

export default function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState<'welcome' | 'v1' | 'v2' | 'v3'>('welcome');

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onDone();
  }

  if (step === 'welcome') {
    return <Welcome onNext={() => setStep('v1')} onSkip={finish} />;
  }
  if (step === 'v1') {
    return <Value1 onNext={() => setStep('v2')} onSkip={finish} />;
  }
  if (step === 'v2') {
    return <Value2 onNext={() => setStep('v3')} onSkip={finish} />;
  }
  return <Value3 onDone={finish} onSkip={finish} />;
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  // Welcome
  welcomeLogo: {
    fontFamily: Fonts.serifItalic,
    fontSize: 22,
    color: Tokens.paper,
    letterSpacing: -0.44,
  },
  welcomeDot: {
    width: 4, height: 4, borderRadius: 999,
    backgroundColor: Tokens.paper, opacity: 0.6,
  },
  welcomeVersion: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Tokens.paper,
    opacity: 0.7,
    letterSpacing: 0.88,
  },
  welcomeHero: {
    fontFamily: Fonts.serif,
    fontSize: 96,
    lineHeight: 96 * 0.88,
    color: Tokens.paper,
    letterSpacing: -3.84,
    marginTop: 4,
  },
  welcomePrimaryBtn: {
    height: 56,
    backgroundColor: Tokens.paper,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomePrimaryBtnText: {
    fontFamily: Fonts.serifItalic,
    fontSize: 19,
    color: Tokens.amberDeep,
    letterSpacing: -0.19,
  },
  welcomeSecondaryBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '500',
    color: Tokens.paper,
    opacity: 0.85,
    letterSpacing: 0.52,
  },

  // Skip row (shared)
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Tokens.inkFaint,
    letterSpacing: 1.32,
  },
  skipText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '500',
    color: Tokens.inkDim,
  },

  // Wert 1 headline
  v1Headline: {
    fontFamily: Fonts.serif,
    fontSize: 64,
    lineHeight: 64 * 0.88,
    letterSpacing: -2.56,
    marginTop: 4,
  },

  // Note card
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
  noteCardDate: {
    fontFamily: Fonts.sans,
    fontSize: 10.5,
    color: Tokens.inkFaint,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 8,
  },
  noteCardTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 26.4,
    color: Tokens.ink,
    letterSpacing: -0.24,
    marginBottom: 10,
  },
  noteCardBody: {
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

  // Tag
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Tokens.amberSoft,
    borderRadius: 999,
  },
  tagText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: Tokens.amberDeep,
    letterSpacing: 0.1,
  },

  // Kapitel caption
  kapitel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Tokens.amberDeep,
    letterSpacing: 1.68,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 6,
  },
  caption: {
    fontFamily: Fonts.serifItalic,
    fontSize: 15,
    lineHeight: 21,
    color: Tokens.inkDim,
  },

  // Footer row
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  nextBtn: {
    height: 46,
    paddingHorizontal: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtnText: {
    fontFamily: Fonts.serifItalic,
    fontSize: 16,
    letterSpacing: -0.16,
  },

  // Thread cards (Wert 2)
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

  // Amber pill
  amberPill: {
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
  amberPillText: {
    fontSize: 14,
    color: Tokens.amberDeep,
  },
  amberPillLabel: {
    fontFamily: Fonts.serifItalic,
    fontSize: 15,
    color: Tokens.amberDeep,
  },

  // Wert 2 text
  v2Headline: {
    fontFamily: Fonts.serif,
    fontSize: 34,
    lineHeight: 35.7,
    color: Tokens.ink,
    letterSpacing: -1.36,
    marginTop: 0,
  },
  v2Body: {
    fontFamily: Fonts.sans,
    fontSize: 14.5,
    lineHeight: 22.475,
    color: Tokens.inkDim,
    marginTop: 12,
  },

  // Wert 3
  v3Eyebrow: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Tokens.amberDeep,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 14,
  },
  v3Headline: {
    fontFamily: Fonts.serif,
    fontSize: 58,
    lineHeight: 58 * 0.92,
    color: Tokens.ink,
    letterSpacing: -2.32,
  },
  v3ListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderTopWidth: 0.5,
    borderTopColor: Tokens.rule,
    paddingTop: 12,
    marginTop: 12,
  },
  v3ListNum: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Tokens.amberDeep,
    letterSpacing: 0.88,
    minWidth: 22,
    fontWeight: '500',
  },
  v3ListText: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 23.4,
    color: Tokens.ink,
    flex: 1,
  },
});
