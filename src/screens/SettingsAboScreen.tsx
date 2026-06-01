import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotes } from '../context/NotesContext';
import { subscriptionService, Tier } from '../sync/subscriptionService';
import { Tokens } from '../theme/theme';
import { Fonts } from '../theme/typography';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ---------------------------------------------------------------------------
// Tier metadata
// ---------------------------------------------------------------------------

const TIER_META: Record<Tier, { label: string; icon: IconName; runsLabel: string; color: string }> = {
  free: {
    label: 'Free-Plan',
    icon: 'star-outline',
    runsLabel: '1× pro Woche',
    color: Tokens.inkFaint,
  },
  basic: {
    label: 'Basic-Plan',
    icon: 'star-half-full',
    runsLabel: '1× pro Tag',
    color: Tokens.amber,
  },
  pro: {
    label: 'Pro-Plan',
    icon: 'star',
    runsLabel: 'Unbegrenzt (max. 10× / Tag)',
    color: Tokens.amberDeep,
  },
};

function formatGermanDate(date: Date): string {
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SettingsAboScreen() {
  const theme = useTheme();
  const { tier, nextAllowedAt } = useNotes();
  const meta = TIER_META[tier] ?? TIER_META.free;

  const nextRunText: string = (() => {
    if (!nextAllowedAt || nextAllowedAt <= new Date()) return 'Jetzt verfügbar';
    return formatGermanDate(nextAllowedAt);
  })();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* Current tier badge */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Dein Tarif
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.tierRow}>
          <View style={[styles.tierIconWrap, { backgroundColor: meta.color + '20' }]}>
            <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
          </View>
          <View style={styles.tierText}>
            <Text style={[styles.tierLabel, { color: theme.colors.onSurface }]}>{meta.label}</Text>
            <Text style={[styles.tierSublabel, { color: theme.colors.onSurfaceVariant }]}>
              KI-Synthese: {meta.runsLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Next run info */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        KI-Synthese
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={18}
            color={theme.colors.onSurfaceVariant}
            style={{ marginRight: 10 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.colors.onSurface }]}>
              Nächster Lauf
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.onSurfaceVariant }]}>
              {nextRunText}
            </Text>
          </View>
        </View>
      </View>

      {/* Upgrade section — only shown if not already on Pro */}
      {tier !== 'pro' && (
        <>
          <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
            Upgrade
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            {tier === 'free' && (
              <>
                <UpgradeButton
                  targetTier="basic"
                  label="Basic — täglich synthetisieren"
                  sublabel="1× pro Tag KI-Synthese"
                  icon="star-half-full"
                  color={Tokens.amber}
                  showDivider
                />
                <UpgradeButton
                  targetTier="pro"
                  label="Pro — unbegrenzt"
                  sublabel="Bis zu 10× täglich"
                  icon="star"
                  color={Tokens.amberDeep}
                  showDivider={false}
                />
              </>
            )}
            {tier === 'basic' && (
              <UpgradeButton
                targetTier="pro"
                label="Pro — unbegrenzt"
                sublabel="Bis zu 10× täglich"
                icon="star"
                color={Tokens.amberDeep}
                showDivider={false}
              />
            )}
          </View>
        </>
      )}

      {/* Restore purchases placeholder */}
      <Pressable
        style={styles.restoreBtn}
        onPress={() => subscriptionService.openUpgradeFlow('basic')}
      >
        <Text style={[styles.restoreText, { color: theme.colors.onSurfaceVariant }]}>
          Käufe wiederherstellen
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// UpgradeButton sub-component
// ---------------------------------------------------------------------------

function UpgradeButton({
  targetTier,
  label,
  sublabel,
  icon,
  color,
  showDivider,
}: {
  targetTier: 'basic' | 'pro';
  label: string;
  sublabel: string;
  icon: IconName;
  color: string;
  showDivider: boolean;
}) {
  const theme = useTheme();

  return (
    <>
      <Pressable
        onPress={() => subscriptionService.openUpgradeFlow(targetTier)}
        style={({ pressed }) => [styles.upgradeRow, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.upgradeIconWrap, { backgroundColor: color + '20' }]}>
          <MaterialCommunityIcons name={icon} size={18} color={color} />
        </View>
        <View style={styles.upgradeText}>
          <Text style={[styles.upgradeLabel, { color: theme.colors.onSurface }]}>{label}</Text>
          <Text style={[styles.upgradeSublabel, { color: theme.colors.onSurfaceVariant }]}>{sublabel}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
      </Pressable>
      {showDivider && (
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100, gap: 6 },

  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 10,
    marginBottom: 4,
    marginLeft: 4,
    fontFamily: Fonts.sansSemibold,
  },

  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },

  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  tierIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierText: { flex: 1 },
  tierLabel: {
    fontSize: 16,
    fontFamily: Fonts.sansSemibold,
  },
  tierSublabel: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: Fonts.sans,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoLabel: {
    fontSize: 15,
    fontFamily: Fonts.sansSemibold,
  },
  infoValue: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: Fonts.sans,
  },

  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  upgradeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeText: { flex: 1 },
  upgradeLabel: {
    fontSize: 15,
    fontFamily: Fonts.sansSemibold,
  },
  upgradeSublabel: {
    fontSize: 12,
    marginTop: 1,
    fontFamily: Fonts.sans,
  },

  divider: { height: 1, marginLeft: 62, opacity: 0.35 },

  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  restoreText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    textDecorationLine: 'underline',
  },
});
