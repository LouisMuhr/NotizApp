import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotes } from '../context/NotesContext';
import { AccountState, resolveAccountState } from '../sync/accountState';
import { Tokens } from '../theme/theme';
import { Fonts } from '../theme/typography';
import { useLanguage } from '../context/LanguageContext';

/** Zeitpunkt des ersten Starts — Grundlage fuer die Alters-Schwelle. */
const FIRST_SEEN_KEY = '@notizapp_first_seen';
/** Merker: Hinweis im Haupt-Screen wurde weggeklickt. */
const DISMISSED_KEY = '@notizapp_unsecured_dismissed';

/** Ab dieser Zahl Notizen gibt es genug zu verlieren, um zu warnen. */
const NOTE_THRESHOLD = 10;
/** Alternativ: so lange wird die App schon benutzt. */
const AGE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  onPress: () => void;
}

/**
 * Dezenter Hinweis im Haupt-Screen, dass die Notizen nur lokal liegen.
 *
 * Bewusst NICHT ab der ersten Sekunde: `local` ist der legitime Normalzustand
 * dieser App, und ein Dauerbanner fuer den Default-Zustand wuerde nach drei
 * Tagen niemand mehr sehen. Der Hinweis erscheint erst, wenn es etwas zu
 * verlieren gibt (genug Notizen oder genug Nutzungsdauer), und laesst sich
 * wegklicken.
 *
 * `pending-confirmation` ist dagegen ein echter Zwischenzustand mit
 * Handlungsbedarf: dort erscheint der Hinweis sofort und ohne Schwelle.
 *
 * Dauerhaft und ungefiltert steht die Warnung weiterhin im Konto-Screen.
 */
export default function UnsecuredBanner({ onPress }: Props) {
  const { notes, archivedNotes } = useNotes();
  const { t } = useLanguage();
  const [state, setState] = useState<AccountState>('loading');
  const [dismissed, setDismissed] = useState(true);
  const [oldEnough, setOldEnough] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snapshot = await resolveAccountState();
      if (cancelled) return;
      setState(snapshot.state);

      const wasDismissed = await AsyncStorage.getItem(DISMISSED_KEY);
      if (cancelled) return;
      setDismissed(wasDismissed === '1');

      // Ersten Start festhalten, falls noch nicht geschehen.
      const firstSeen = await AsyncStorage.getItem(FIRST_SEEN_KEY);
      const now = Date.now();
      if (!firstSeen) {
        await AsyncStorage.setItem(FIRST_SEEN_KEY, String(now)).catch(() => {});
        return;
      }
      if (cancelled) return;
      setOldEnough(now - Number(firstSeen) >= AGE_THRESHOLD_MS);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleDismiss = async () => {
    setDismissed(true);
    await AsyncStorage.setItem(DISMISSED_KEY, '1').catch(() => {});
  };

  if (state === 'loading' || state === 'secured') return null;

  // Ausstehende Bestaetigung: immer zeigen, nicht wegklickbar.
  const isPending = state === 'pending-confirmation';
  if (!isPending) {
    if (dismissed) return null;
    const enoughNotes = notes.length + archivedNotes.length >= NOTE_THRESHOLD;
    if (!enoughNotes && !oldEnough) return null;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.82 }]}
      accessibilityRole="button"
      accessibilityLabel={t('unsecuredBanner.accessibilityLabel')}
    >
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons
          name={isPending ? 'email-alert-outline' : 'shield-alert-outline'}
          size={15}
          color={Tokens.amberDeep}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.text} numberOfLines={1}>
          {isPending ? t('unsecuredBanner.pendingTitle') : t('unsecuredBanner.localTitle')}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {isPending ? t('unsecuredBanner.pendingSub') : t('unsecuredBanner.localSub')}
        </Text>
      </View>
      {isPending ? (
        <MaterialCommunityIcons name="chevron-right" size={16} color={Tokens.amberDeep} />
      ) : (
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('unsecuredBanner.dismissLabel')}
        >
          <MaterialCommunityIcons name="close" size={16} color={Tokens.amberDeep} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: Tokens.amberSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Tokens.amber + '55',
    gap: 8,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Tokens.amber + '28',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontFamily: Fonts.sansSemibold,
    color: Tokens.amberDeep,
  },
  sub: {
    fontSize: 11,
    fontFamily: Fonts.sans,
    color: Tokens.amber,
    marginTop: 1,
  },
});
