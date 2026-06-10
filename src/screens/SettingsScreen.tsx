import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tokens } from '../theme/theme';
import { Type, Fonts } from '../theme/typography';
import { useNotes } from '../context/NotesContext';
import { getSupabase } from '../sync/supabaseClient';
import { ONBOARDING_KEY } from './onboarding/shared';
import { useLanguage } from '../context/LanguageContext';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: APP_VERSION } = require('../../package.json') as { version: string };

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function NavRow({
  icon,
  iconBg,
  label,
  sublabel,
  onPress,
  showDivider = true,
}: {
  icon: IconName;
  iconBg: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  showDivider?: boolean;
}) {
  const theme = useTheme();
  return (
    <>
      <TouchableOpacity activeOpacity={0.6} onPress={onPress} style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={icon} size={19} color={Tokens.paper} />
        </View>
        <View style={styles.rowText}>
          <Text style={{ color: theme.colors.onSurface, fontSize: 15, fontFamily: Fonts.sansMedium }}>
            {label}
          </Text>
          {sublabel ? (
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 1 }}>
              {sublabel}
            </Text>
          ) : null}
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.colors.onSurfaceVariant}
        />
      </TouchableOpacity>
      {showDivider && (
        <View style={[styles.divider, { backgroundColor: Tokens.rule }]} />
      )}
    </>
  );
}

function InfoRow({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: IconName;
  iconBg: string;
  label: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={19} color={Tokens.paper} />
      </View>
      <Text style={{ color: theme.colors.onSurface, fontSize: 15, fontFamily: Fonts.sansMedium, flex: 1 }}>
        {label}
      </Text>
      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 14 }}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { tier } = useNotes();
  const { t } = useLanguage();
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user && !user.is_anonymous);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsSignedIn(!!session?.user && !session.user.is_anonymous);
    });
    return () => subscription.unsubscribe();
  }, []);

  // [DEV-HELPER] Onboarding zurücksetzen — nur in __DEV__ sichtbar. Vor Release entfernen.
  const resetOnboarding = async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    Alert.alert(
      t('settings.resetOnboardingAlertTitle'),
      t('settings.resetOnboardingAlertBody')
    );
  };

  const tierLabel = tier === 'pro' ? t('settings.tierPro') : tier === 'basic' ? t('settings.tierBasic') : t('settings.tierFree');
  const kontoSublabel = isSignedIn ? t('settings.accountSubSignedIn') : t('settings.accountSubSignedOut');

  const colors = {
    amber: Tokens.amberDeep,
    amberMid: Tokens.amber,
    ink: Tokens.ink,
    inkDim: Tokens.inkDim,
    inkFaint: Tokens.inkFaint,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      {/* ── Allgemein ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settings.sectionGeneral')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <NavRow
          icon="palette-outline"
          iconBg={colors.amber}
          label={t('settings.appearance')}
          sublabel={t('settings.appearanceSub')}
          onPress={() => navigation.navigate('SettingsDarstellung')}
          showDivider={false}
        />
      </View>

      {/* ── Konto ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settings.sectionAccount')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <NavRow
          icon="account-circle-outline"
          iconBg={colors.amberMid}
          label={t('settings.accountSecurity')}
          sublabel={kontoSublabel}
          onPress={() => navigation.navigate('SettingsKonto')}
        />
        <NavRow
          icon="crown-outline"
          iconBg={colors.amber}
          label={t('settings.subscription')}
          sublabel={tierLabel}
          onPress={() => navigation.navigate('SettingsAbo')}
          showDivider={false}
        />
      </View>

      {/* ── Inhalte ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settings.sectionContent')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <NavRow
          icon="tag-outline"
          iconBg={colors.amberMid}
          label={t('settings.categories')}
          sublabel={t('settings.categoriesSub')}
          onPress={() => navigation.navigate('SettingsKategorien')}
          showDivider={false}
        />
      </View>

      {/* ── System ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settings.sectionSystem')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {Platform.OS === 'android' && (
          <NavRow
            icon="bell-outline"
            iconBg={colors.ink}
            label={t('settings.notifications')}
            sublabel={t('settings.notificationsSub')}
            onPress={() => navigation.navigate('SettingsBenachrichtigungen')}
          />
        )}
        <NavRow
          icon="cloud-sync-outline"
          iconBg={colors.inkDim}
          label={t('settings.sync')}
          sublabel={t('settings.syncSub')}
          onPress={() => navigation.navigate('SettingsSynchronisation')}
        />
        <NavRow
          icon="bookmark-plus-outline"
          iconBg={colors.amberMid}
          label={t('settings.bookmarklet')}
          sublabel={t('settings.bookmarkletSub')}
          onPress={() => navigation.navigate('SettingsBookmarklet')}
        />
        <NavRow
          icon="graph-outline"
          iconBg={colors.ink}
          label={t('settings.webApp')}
          sublabel={t('settings.webAppSub')}
          onPress={() => navigation.navigate('SettingsWebApp')}
          showDivider={false}
        />
      </View>

      {/* ── Datenschutz ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settings.sectionPrivacy')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <NavRow
          icon="shield-account-outline"
          iconBg={colors.ink}
          label={t('settings.privacy')}
          sublabel={t('settings.privacySub')}
          onPress={() => navigation.navigate('SettingsDatenschutz')}
          showDivider={false}
        />
      </View>

      {/* ── Entwicklung [DEV-HELPER] — nur in __DEV__, vor Release entfernen ── */}
      {__DEV__ && (
        <>
          <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
            {t('settings.sectionDev')}
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <NavRow
              icon="restart"
              iconBg={colors.inkFaint}
              label={t('settings.resetOnboarding')}
              sublabel={t('settings.resetOnboardingSub')}
              onPress={resetOnboarding}
              showDivider={false}
            />
          </View>
        </>
      )}

      {/* ── Version ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settings.sectionVersion')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <InfoRow
          icon="application-outline"
          iconBg={colors.inkFaint}
          label={t('settings.version')}
          value={APP_VERSION}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100, gap: 6 },
  header: {
    paddingBottom: 8,
    paddingTop: 4,
  },
  headerTitle: {
    ...Type.h1,
    color: Tokens.ink,
  },
  sectionHeader: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.paperEdge,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
});
