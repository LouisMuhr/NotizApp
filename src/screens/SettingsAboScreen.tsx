import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotes } from '../context/NotesContext';
import { subscriptionService, Tier } from '../sync/subscriptionService';
import { Tokens } from '../theme/theme';
import { Fonts } from '../theme/typography';
import { useLanguage } from '../context/LanguageContext';
import type { AppLocale } from '../i18n';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

interface PlanFeature {
  icon: IconName;
  text: string;
}

interface PlanMeta {
  label: string;
  icon: IconName;
  color: string;
  price: string;
  priceDetail: string;
  features: PlanFeature[];
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function getPlans(t: Translate): Record<Tier, PlanMeta> {
  return {
    free: {
      label: t('settingsAbo.plans.free.label'),
      icon: 'star-outline',
      color: Tokens.inkFaint,
      price: t('settingsAbo.plans.free.price'),
      priceDetail: t('settingsAbo.plans.free.priceDetail'),
      features: [
        { icon: 'notebook-outline', text: t('settingsAbo.plans.free.features.0') },
        { icon: 'tag-outline', text: t('settingsAbo.plans.free.features.1') },
        { icon: 'bell-outline', text: t('settingsAbo.plans.free.features.2') },
        { icon: 'brain', text: t('settingsAbo.plans.free.features.3') },
      ],
    },
    basic: {
      label: t('settingsAbo.plans.basic.label'),
      icon: 'star-half-full',
      color: Tokens.amber,
      price: t('settingsAbo.plans.basic.price'),
      priceDetail: t('settingsAbo.plans.basic.priceDetail'),
      features: [
        { icon: 'check-circle-outline', text: t('settingsAbo.plans.basic.features.0') },
        { icon: 'brain', text: t('settingsAbo.plans.basic.features.1') },
        { icon: 'cloud-sync-outline', text: t('settingsAbo.plans.basic.features.2') },
        { icon: 'lightning-bolt-outline', text: t('settingsAbo.plans.basic.features.3') },
      ],
    },
    pro: {
      label: t('settingsAbo.plans.pro.label'),
      icon: 'star',
      color: Tokens.amberDeep,
      price: t('settingsAbo.plans.pro.price'),
      priceDetail: t('settingsAbo.plans.pro.priceDetail'),
      features: [
        { icon: 'check-circle-outline', text: t('settingsAbo.plans.pro.features.0') },
        { icon: 'brain', text: t('settingsAbo.plans.pro.features.1') },
        { icon: 'priority-high', text: t('settingsAbo.plans.pro.features.2') },
        { icon: 'graph-outline', text: t('settingsAbo.plans.pro.features.3') },
        { icon: 'headset', text: t('settingsAbo.plans.pro.features.4') },
      ],
    },
  };
}

function formatLocalizedDate(date: Date, locale: AppLocale): string {
  const intlLocale = locale === 'en' ? 'en-US' : 'de-DE';
  return date.toLocaleDateString(intlLocale, { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SettingsAboScreen() {
  const theme = useTheme();
  const { tier, nextAllowedAt } = useNotes();
  const { t, locale } = useLanguage();
  const PLANS = getPlans(t);
  const currentPlan = PLANS[tier] ?? PLANS.free;

  const nextRunText: string = (() => {
    if (!nextAllowedAt || nextAllowedAt <= new Date()) return t('settingsAbo.nextRunAvailable');
    return formatLocalizedDate(nextAllowedAt, locale);
  })();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* Active plan hero */}
      <View style={[styles.heroBadge, { backgroundColor: currentPlan.color + '18', borderColor: currentPlan.color + '40' }]}>
        <View style={[styles.heroIconWrap, { backgroundColor: currentPlan.color + '28' }]}>
          <MaterialCommunityIcons name={currentPlan.icon} size={28} color={currentPlan.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroLabel, { color: currentPlan.color }]}>{currentPlan.label}</Text>
          <Text style={[styles.heroSub, { color: theme.colors.onSurfaceVariant }]}>{t('settingsAbo.currentPlan')}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.heroPrice, { color: theme.colors.onSurface }]}>{currentPlan.price}</Text>
          <Text style={[styles.heroPriceSub, { color: theme.colors.onSurfaceVariant }]}>{currentPlan.priceDetail}</Text>
        </View>
      </View>

      {/* Current plan features */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsAbo.enthaltenLeistungen')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {currentPlan.features.map((f, i) => (
          <React.Fragment key={f.text}>
            <View style={styles.featureRow}>
              <View style={[styles.featureIconWrap, { backgroundColor: currentPlan.color + '18' }]}>
                <MaterialCommunityIcons name={f.icon} size={15} color={currentPlan.color} />
              </View>
              <Text style={[styles.featureText, { color: theme.colors.onSurface }]}>{f.text}</Text>
            </View>
            {i < currentPlan.features.length - 1 && (
              <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Next AI run */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsAbo.aiSynthesis')}
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
            <Text style={[styles.infoLabel, { color: theme.colors.onSurface }]}>{t('settingsAbo.nextRun')}</Text>
            <Text style={[styles.infoValue, { color: theme.colors.onSurfaceVariant }]}>{nextRunText}</Text>
          </View>
        </View>
      </View>

      {/* Upgrade plans */}
      {tier !== 'pro' && (
        <>
          <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
            {t('settingsAbo.upgrade')}
          </Text>
          {(tier === 'free' ? (['basic', 'pro'] as const) : (['pro'] as const)).map((targetTier) => (
            <UpgradePlanCard key={targetTier} targetTier={targetTier} />
          ))}
        </>
      )}

      {/* Restore */}
      <Pressable
        style={styles.restoreBtn}
        onPress={() => subscriptionService.openUpgradeFlow('basic')}
      >
        <Text style={[styles.restoreText, { color: theme.colors.onSurfaceVariant }]}>
          {t('settingsAbo.restorePurchases')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// UpgradePlanCard
// ---------------------------------------------------------------------------

function UpgradePlanCard({ targetTier }: { targetTier: 'basic' | 'pro' }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const plan = getPlans(t)[targetTier];

  return (
    <Pressable
      onPress={() => subscriptionService.openUpgradeFlow(targetTier)}
      style={({ pressed }) => [
        styles.upgradePlanCard,
        { backgroundColor: theme.colors.surface, borderColor: plan.color + '50' },
        pressed && { opacity: 0.75 },
      ]}
    >
      {/* Header row */}
      <View style={styles.upgradePlanHeader}>
        <View style={[styles.upgradePlanIconWrap, { backgroundColor: plan.color + '22' }]}>
          <MaterialCommunityIcons name={plan.icon} size={20} color={plan.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.upgradePlanLabel, { color: theme.colors.onSurface }]}>{plan.label}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.upgradePlanPrice, { color: plan.color }]}>{plan.price}</Text>
          <Text style={[styles.upgradePlanPriceSub, { color: theme.colors.onSurfaceVariant }]}>{plan.priceDetail}</Text>
        </View>
      </View>

      {/* Features list */}
      <View style={styles.upgradePlanFeatures}>
        {plan.features.map((f) => (
          <View key={f.text} style={styles.upgradePlanFeatureRow}>
            <MaterialCommunityIcons name="check" size={13} color={plan.color} style={{ marginRight: 6, marginTop: 1 }} />
            <Text style={[styles.upgradePlanFeatureText, { color: theme.colors.onSurfaceVariant }]}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View style={[styles.upgradeCTA, { backgroundColor: plan.color }]}>
        <Text style={styles.upgradeCTAText}>{t('settingsAbo.upgradeCta', { plan: plan.label })}</Text>
        <MaterialCommunityIcons name="arrow-right" size={15} color={Tokens.paper} />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100, gap: 6 },

  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: 20,
    fontFamily: Fonts.sansSemibold,
  },
  heroSub: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  heroPrice: {
    fontSize: 17,
    fontFamily: Fonts.sansSemibold,
  },
  heroPriceSub: {
    fontSize: 11,
    fontFamily: Fonts.sans,
    marginTop: 1,
  },

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

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
  },
  featureIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 14,
    fontFamily: Fonts.sans,
    flex: 1,
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

  divider: { height: 1, marginLeft: 56, opacity: 0.35 },

  upgradePlanCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  upgradePlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  upgradePlanIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradePlanLabel: {
    fontSize: 16,
    fontFamily: Fonts.sansSemibold,
  },
  upgradePlanPrice: {
    fontSize: 16,
    fontFamily: Fonts.sansSemibold,
  },
  upgradePlanPriceSub: {
    fontSize: 11,
    fontFamily: Fonts.sans,
    marginTop: 1,
  },
  upgradePlanFeatures: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 6,
  },
  upgradePlanFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  upgradePlanFeatureText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    flex: 1,
  },
  upgradeCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  upgradeCTAText: {
    fontSize: 14,
    fontFamily: Fonts.sansSemibold,
    color: Tokens.paper,
  },

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
