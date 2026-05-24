import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { useTheme, Text, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { getSupabase } from '../sync/supabaseClient';
import { Tokens } from '../theme/theme';
import { Type, Fonts } from '../theme/typography';

const BRIDGE_URL = 'https://bridge-three-coral.vercel.app';

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.stepWrap}>
      <View style={[styles.stepBadge, { backgroundColor: Tokens.amberDeep }]}>
        <Text style={styles.stepNumber}>{number}</Text>
      </View>
      <View style={styles.stepBody}>
        <Text style={[styles.stepTitle, { color: theme.colors.onSurface }]}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

function CopyBox({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View>
      <Text style={[styles.copyLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={copy}
        style={[styles.copyBox, { backgroundColor: theme.colors.background, borderColor: Tokens.paperEdge }]}
      >
        <Text
          numberOfLines={1}
          style={[styles.copyValue, { color: theme.colors.onSurface }]}
        >
          {value || '…'}
        </Text>
        <View style={[styles.copyBadge, { backgroundColor: copied ? Tokens.amberDeep : Tokens.amber }]}>
          <MaterialCommunityIcons
            name={copied ? 'check' : 'content-copy'}
            size={14}
            color={Tokens.paper}
          />
          <Text style={styles.copyBadgeText}>{copied ? 'Kopiert!' : 'Kopieren'}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function SettingsBookmarkletScreen() {
  const theme = useTheme();
  const [userId, setUserId] = useState('');
  const [snack, setSnack] = useState('');

  useEffect(() => {
    getSupabase()?.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  const openSetupPage = () => {
    Linking.openURL(`${BRIDGE_URL}/bookmarklet`);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: Tokens.paperEdge }]}>
        <MaterialCommunityIcons name="bookmark-plus-outline" size={36} color={Tokens.amberDeep} />
        <Text style={[styles.heroTitle, { color: theme.colors.onSurface }]}>
          Webseiten als Notiz speichern
        </Text>
        <Text style={[styles.heroSub, { color: theme.colors.onSurfaceVariant }]}>
          Markiere Text auf einer beliebigen Webseite und speichere ihn mit einem Klick direkt in NotizApp — von jedem Computer.
        </Text>
      </View>

      {/* Steps */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Einrichtung
      </Text>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: Tokens.paperEdge }]}>
        <Step number={1} title="Deine persönliche ID kopieren">
          <Text style={[styles.stepDesc, { color: theme.colors.onSurfaceVariant }]}>
            Diese ID gehört nur zu dir. Sie sagt dem Bookmarklet, wo deine Notizen gespeichert werden sollen.
          </Text>
          <CopyBox label="Deine Nutzer-ID" value={userId} />
        </Step>

        <View style={[styles.divider, { backgroundColor: Tokens.paperEdge }]} />

        <Step number={2} title="Einrichtungsseite öffnen">
          <Text style={[styles.stepDesc, { color: theme.colors.onSurfaceVariant }]}>
            Öffne die Einrichtungsseite auf deinem Computer im Browser. Dort gibst du deine ID ein und bekommst das Bookmarklet.
          </Text>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={openSetupPage}
            style={[styles.linkBtn, { borderColor: Tokens.amberDeep }]}
          >
            <MaterialCommunityIcons name="open-in-new" size={16} color={Tokens.amberDeep} />
            <Text style={[styles.linkBtnText, { color: Tokens.amberDeep }]}>
              Einrichtungsseite öffnen
            </Text>
          </TouchableOpacity>
          <Text style={[styles.urlHint, { color: theme.colors.onSurfaceVariant }]}>
            {BRIDGE_URL}/bookmarklet
          </Text>
        </Step>

        <View style={[styles.divider, { backgroundColor: Tokens.paperEdge }]} />

        <Step number={3} title="Bookmarklet in die Leiste ziehen">
          <Text style={[styles.stepDesc, { color: theme.colors.onSurfaceVariant }]}>
            Auf der Einrichtungsseite: Deine ID eintragen → Den gelben Button{' '}
            <Text style={{ fontFamily: Fonts.sansSemibold }}>"📝 In NotizApp speichern"</Text>{' '}
            mit der Maus in die Lesezeichen-Leiste deines Browsers ziehen. Fertig!
          </Text>
        </Step>
      </View>

      {/* How to use */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        So funktioniert es
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: Tokens.paperEdge }]}>
        {[
          { icon: 'cursor-text' as const, text: 'Text auf einer Webseite markieren' },
          { icon: 'bookmark-outline' as const, text: 'Auf das Bookmarklet in der Lesezeichen-Leiste klicken' },
          { icon: 'card-text-outline' as const, text: 'Titel, Kategorie und Erinnerung anpassen' },
          { icon: 'check-circle-outline' as const, text: 'Auf "Speichern" klicken — Notiz erscheint sofort in der App' },
        ].map((item, i, arr) => (
          <React.Fragment key={i}>
            <View style={styles.howRow}>
              <View style={[styles.howIcon, { backgroundColor: Tokens.paperDeep }]}>
                <MaterialCommunityIcons name={item.icon} size={17} color={Tokens.amberDeep} />
              </View>
              <Text style={[styles.howText, { color: theme.colors.onSurface }]}>{item.text}</Text>
            </View>
            {i < arr.length - 1 && (
              <View style={[styles.divider, { backgroundColor: Tokens.paperEdge }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Tip */}
      <View style={[styles.tip, { backgroundColor: Tokens.amberDeep + '18', borderColor: Tokens.amberDeep + '40' }]}>
        <MaterialCommunityIcons name="lightbulb-outline" size={16} color={Tokens.amberDeep} style={{ marginTop: 1 }} />
        <Text style={[styles.tipText, { color: theme.colors.onSurface }]}>
          Das Bookmarklet funktioniert auf jedem Computer — egal ob Windows, Mac oder Linux. Du brauchst nur einen modernen Browser.
        </Text>
      </View>

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={1800}>
        {snack}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100, gap: 12 },

  hero: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: {
    ...Type.h2,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: Fonts.sans,
  },

  sectionHeader: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 2,
    marginLeft: 4,
  },

  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },

  stepWrap: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumber: {
    color: Tokens.paper,
    fontSize: 13,
    fontFamily: Fonts.sansSemibold,
  },
  stepBody: { flex: 1, gap: 8 },
  stepTitle: {
    fontSize: 15,
    fontFamily: Fonts.sansSemibold,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Fonts.sans,
  },

  copyLabel: {
    fontSize: 11,
    fontFamily: Fonts.sansSemibold,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  copyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  copyValue: {
    flex: 1,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  copyBadgeText: {
    color: Tokens.paper,
    fontSize: 12,
    fontFamily: Fonts.sansSemibold,
  },

  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  linkBtnText: {
    fontSize: 14,
    fontFamily: Fonts.sansSemibold,
  },
  urlHint: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },

  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },

  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  howIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  howText: {
    fontSize: 14,
    fontFamily: Fonts.sans,
    flex: 1,
    lineHeight: 20,
  },

  tip: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    alignItems: 'flex-start',
  },
  tipText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Fonts.sans,
    flex: 1,
  },
});
