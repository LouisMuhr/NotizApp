import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useTheme, Text, Portal, Dialog, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tokens } from '../theme/theme';
import { Type, Fonts } from '../theme/typography';
import { useNotes } from '../context/NotesContext';
import { getSupabase } from '../sync/supabaseClient';
import { deriveStateFromUser } from '../sync/accountState';
import { useIsAdmin } from '../sync/adminAccess';
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
  locked = false,
}: {
  icon: IconName;
  iconBg: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  showDivider?: boolean;
  /** Funktion ist im aktuellen Abo nicht freigeschaltet — Zeile bleibt sichtbar, aber gedimmt. */
  locked?: boolean;
}) {
  const theme = useTheme();
  return (
    <>
      <TouchableOpacity activeOpacity={0.6} onPress={onPress} style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: iconBg }, locked && styles.rowIconLocked]}>
          <MaterialCommunityIcons name={icon} size={19} color={Tokens.paper} />
        </View>
        <View style={styles.rowText}>
          <Text
            style={{
              color: locked ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
              fontSize: 15,
              fontFamily: Fonts.sansMedium,
            }}
          >
            {label}
          </Text>
          {sublabel ? (
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 1 }}>
              {sublabel}
            </Text>
          ) : null}
        </View>
        <MaterialCommunityIcons
          name={locked ? 'lock-outline' : 'chevron-right'}
          size={locked ? 17 : 20}
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
  const [onboardingResetShown, setOnboardingResetShown] = useState(false);
  const isAdmin = useIsAdmin();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    // "Angemeldet" heisst: bestaetigtes Konto. Eine laufende, noch
    // unbestaetigte Registrierung zaehlt nicht dazu.
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(deriveStateFromUser(user) === 'secured');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsSignedIn(deriveStateFromUser(session?.user ?? null) === 'secured');
    });
    return () => subscription.unsubscribe();
  }, []);

  // Admin-Werkzeug: Onboarding beim nächsten Start (bzw. Reload) erneut zeigen.
  const resetOnboarding = async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    setOnboardingResetShown(true);
  };

  const tierLabel =
    tier === null ? t('settings.tierLoading')
      : tier === 'pro' ? t('settings.tierPro')
      : tier === 'basic' ? t('settings.tierBasic')
      : t('settings.tierFree');
  const kontoSublabel = isSignedIn ? t('settings.accountSubSignedIn') : t('settings.accountSubSignedOut');

  // Abo-Gating: Zeilen bleiben sichtbar, zeigen aber nur, ab welchem Plan sie nutzbar sind.
  // Bei unbekanntem Tier wird NICHT gesperrt — ein Pro-Nutzer soll direkt nach
  // dem Start weder ein Schloss sehen noch faelschlich nach SettingsAbo landen.
  const bookmarkletLocked = tier !== null && tier === 'free';
  const webAppLocked = tier !== null && tier !== 'pro';

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
          icon="bookmark-plus-outline"
          iconBg={colors.amberMid}
          label={t('settings.bookmarklet')}
          sublabel={
            bookmarkletLocked
              ? t('settings.lockedFromPlan', { plan: t('settings.tierBasic') })
              : t('settings.bookmarkletSub')
          }
          locked={bookmarkletLocked}
          onPress={() =>
            navigation.navigate(bookmarkletLocked ? 'SettingsAbo' : 'SettingsBookmarklet')
          }
        />
        <NavRow
          icon="graph-outline"
          iconBg={colors.ink}
          label={t('settings.webApp')}
          sublabel={
            webAppLocked
              ? t('settings.lockedFromPlan', { plan: t('settings.tierPro') })
              : t('settings.webAppSub')
          }
          locked={webAppLocked}
          onPress={() => navigation.navigate(webAppLocked ? 'SettingsAbo' : 'SettingsWebApp')}
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

      {/* ── Admin — nur für das Admin-Konto (src/sync/adminAccess.ts) ── */}
      {isAdmin === true && (
        <>
          <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
            {t('settings.sectionAdmin')}
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <NavRow
              icon="restart"
              iconBg={colors.inkFaint}
              label={t('settings.resetOnboarding')}
              sublabel={t('settings.resetOnboardingSub')}
              onPress={resetOnboarding}
            />
            <NavRow
              icon="bell-ring-outline"
              iconBg={colors.inkFaint}
              label={t('settings.testNotifications')}
              sublabel={t('settings.testNotificationsSub')}
              onPress={() => navigation.navigate('SettingsTestBenachrichtigungen')}
              showDivider={false}
            />
          </View>
          <Portal>
            <Dialog
              visible={onboardingResetShown}
              onDismiss={() => setOnboardingResetShown(false)}
              style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
            >
              <Dialog.Title style={{ color: theme.colors.onSurface }}>
                {t('settings.resetOnboardingAlertTitle')}
              </Dialog.Title>
              <Dialog.Content>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                  {t('settings.resetOnboardingAlertBody')}
                </Text>
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setOnboardingResetShown(false)} textColor={theme.colors.primary}>
                  {t('common.ok')}
                </Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>
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
  rowIconLocked: { opacity: 0.45 },
  rowText: { flex: 1 },
  dialog: { borderRadius: 24 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
});
