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
      'Onboarding zurückgesetzt',
      'Beim nächsten App-Start (bzw. Reload) erscheint das Onboarding wieder.'
    );
  };

  const tierLabel = tier === 'pro' ? 'Pro-Plan' : tier === 'basic' ? 'Basic-Plan' : 'Free-Plan';
  const kontoSublabel = isSignedIn ? 'E-Mail, Passwort, Abmelden' : 'E-Mail, Passwort, Anmelden';

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
        <Text style={styles.headerTitle}>Einstellungen</Text>
      </View>

      {/* ── Allgemein ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Allgemein
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <NavRow
          icon="palette-outline"
          iconBg={colors.amber}
          label="Darstellung"
          sublabel="Vibration & Feedback"
          onPress={() => navigation.navigate('SettingsDarstellung')}
          showDivider={false}
        />
      </View>

      {/* ── Konto ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Konto
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <NavRow
          icon="account-circle-outline"
          iconBg={colors.amberMid}
          label="Konto & Sicherheit"
          sublabel={kontoSublabel}
          onPress={() => navigation.navigate('SettingsKonto')}
        />
        <NavRow
          icon="crown-outline"
          iconBg={colors.amber}
          label="Mein Abo"
          sublabel={tierLabel}
          onPress={() => navigation.navigate('SettingsAbo')}
          showDivider={false}
        />
      </View>

      {/* ── Inhalte ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Inhalte
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <NavRow
          icon="tag-outline"
          iconBg={colors.amberMid}
          label="Kategorien"
          sublabel="Kategorien verwalten"
          onPress={() => navigation.navigate('SettingsKategorien')}
          showDivider={false}
        />
      </View>

      {/* ── System ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        System
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {Platform.OS === 'android' && (
          <NavRow
            icon="bell-outline"
            iconBg={colors.ink}
            label="Benachrichtigungen"
            sublabel="Alarme & Akkuoptimierung"
            onPress={() => navigation.navigate('SettingsBenachrichtigungen')}
          />
        )}
        <NavRow
          icon="cloud-sync-outline"
          iconBg={colors.inkDim}
          label="Synchronisation"
          sublabel="Claude-Bridge & Nutzer-ID"
          onPress={() => navigation.navigate('SettingsSynchronisation')}
        />
        <NavRow
          icon="bookmark-plus-outline"
          iconBg={colors.amberMid}
          label="Bookmarklet"
          sublabel="Webseiten als Notiz speichern"
          onPress={() => navigation.navigate('SettingsBookmarklet')}
        />
        <NavRow
          icon="graph-outline"
          iconBg={colors.ink}
          label="Web App"
          sublabel="Notizen im Browser als Graph"
          onPress={() => navigation.navigate('SettingsWebApp')}
          showDivider={false}
        />
      </View>

      {/* ── Datenschutz ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Datenschutz
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <NavRow
          icon="shield-account-outline"
          iconBg={colors.ink}
          label="Datenschutz & DSGVO"
          sublabel="Export, Datenlöschung"
          onPress={() => navigation.navigate('SettingsDatenschutz')}
          showDivider={false}
        />
      </View>

      {/* ── Entwicklung [DEV-HELPER] — nur in __DEV__, vor Release entfernen ── */}
      {__DEV__ && (
        <>
          <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
            Entwicklung
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <NavRow
              icon="restart"
              iconBg={colors.inkFaint}
              label="Onboarding zurücksetzen"
              sublabel="Onboarding beim nächsten Start neu zeigen"
              onPress={resetOnboarding}
              showDivider={false}
            />
          </View>
        </>
      )}

      {/* ── Version ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Version
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <InfoRow
          icon="application-outline"
          iconBg={colors.inkFaint}
          label="Version"
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
