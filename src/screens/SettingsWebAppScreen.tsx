import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tokens } from '../theme/theme';
import { Type, Fonts } from '../theme/typography';
import { Radii, Shadows, Insets } from '../theme/gradients';

// Platzhalter — wird ersetzt sobald die Webapp deployed ist
const WEBAPP_URL = 'https://notizapp.vercel.app';

function FeatureRow({ icon, label, description }: { icon: string; label: string; description: string }) {
  const theme = useTheme();
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIcon, { backgroundColor: Tokens.amberSoft }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={Tokens.amberDeep} />
      </View>
      <View style={styles.featureText}>
        <Text style={[styles.featureLabel, { color: theme.colors.onSurface }]}>{label}</Text>
        <Text style={[styles.featureDesc, { color: theme.colors.onSurfaceVariant }]}>{description}</Text>
      </View>
    </View>
  );
}

export default function SettingsWebAppScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: Tokens.paperDeep, borderColor: Tokens.paperEdge }]}>
        <View style={[styles.heroIcon, { backgroundColor: Tokens.ink }]}>
          <MaterialCommunityIcons name="graph-outline" size={32} color={Tokens.paper} />
        </View>
        <Text style={[styles.heroTitle, { color: Tokens.ink }]}>Velm Web</Text>
        <Text style={[styles.heroSub, { color: Tokens.inkDim }]}>
          Deine Notizen und Gedanken als interaktiver Graph — direkt im Browser.
        </Text>
        <View style={[styles.badge, { backgroundColor: Tokens.amberSoft }]}>
          <MaterialCommunityIcons name="clock-outline" size={12} color={Tokens.amberDeep} />
          <Text style={[styles.badgeText, { color: Tokens.amberDeep }]}>Demnächst verfügbar</Text>
        </View>
      </View>

      {/* Features */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: Tokens.paperEdge }]}>
        <FeatureRow
          icon="graph"
          label="Notiz-Graph"
          description="Alle Notizen und Threads als vernetztes Diagramm"
        />
        <View style={[styles.divider, { backgroundColor: Tokens.rule }]} />
        <FeatureRow
          icon="text-search"
          label="Volltextsuche"
          description="Schnelle Suche über alle Inhalte"
        />
        <View style={[styles.divider, { backgroundColor: Tokens.rule }]} />
        <FeatureRow
          icon="link-variant"
          label="Ähnliche Notizen"
          description="KI-basierte Ähnlichkeitsanalyse zwischen Notizen"
        />
        <View style={[styles.divider, { backgroundColor: Tokens.rule }]} />
        <FeatureRow
          icon="monitor"
          label="Große Ansicht"
          description="Optimiert für Desktop & Tablet"
        />
      </View>

      {/* CTA */}
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => Linking.openURL(WEBAPP_URL)}
        style={[styles.ctaBtn, { backgroundColor: Tokens.ink }, Shadows.softWarm]}
      >
        <MaterialCommunityIcons name="open-in-new" size={18} color={Tokens.paper} />
        <Text style={styles.ctaText}>Im Browser öffnen</Text>
      </TouchableOpacity>

      <Text style={[styles.urlHint, { color: Tokens.inkFaint }]}>{WEBAPP_URL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  hero: {
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 24,
  },
  heroSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  card: {
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1 },
  featureLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  featureDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radii.md,
    paddingVertical: 15,
  },
  ctaText: {
    color: Tokens.paper,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  urlHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: -6,
  },
});
