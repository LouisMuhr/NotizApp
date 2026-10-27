import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, Text, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Tokens } from '../theme/theme';
import { Type, Fonts } from '../theme/typography';
import { useLanguage } from '../context/LanguageContext';

const WEBAPP_URL = process.env.EXPO_PUBLIC_WEBAPP_URL ?? 'https://velm-webapp.vercel.app';

export default function SettingsBookmarkletScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const [snack, setSnack] = useState('');

  const copyLink = async () => {
    await Clipboard.setStringAsync(`${WEBAPP_URL}/bookmarklet`);
    setSnack(t('settingsBookmarklet.linkCopied'));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: Tokens.paperEdge }]}>
        <MaterialCommunityIcons name="bookmark-plus-outline" size={36} color={Tokens.amberDeep} />
        <Text style={[styles.heroTitle, { color: theme.colors.onSurface }]}>
          {t('settingsBookmarklet.heroTitle')}
        </Text>
        <Text style={[styles.heroSub, { color: theme.colors.onSurfaceVariant }]}>
          {t('settingsBookmarklet.heroBody')}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: Tokens.paperEdge }]}>
        <View style={styles.stepWrap}>
          <View style={[styles.stepBadge, { backgroundColor: Tokens.amberDeep }]}>
            <MaterialCommunityIcons name="laptop" size={14} color={Tokens.paper} />
          </View>
          <View style={styles.stepBody}>
            <Text style={[styles.stepTitle, { color: theme.colors.onSurface }]}>
              {t('settingsBookmarklet.step1Title')}
            </Text>
            <Text style={[styles.stepDesc, { color: theme.colors.onSurfaceVariant }]}>
              {t('settingsBookmarklet.step1Body')}
            </Text>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={copyLink}
              style={[styles.linkBtn, { borderColor: Tokens.amberDeep }]}
            >
              <MaterialCommunityIcons name="content-copy" size={16} color={Tokens.amberDeep} />
              <Text style={[styles.linkBtnText, { color: Tokens.amberDeep }]}>
                {t('settingsBookmarklet.copyLink')}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.urlHint, { color: theme.colors.onSurfaceVariant }]}>
              {WEBAPP_URL}/bookmarklet
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: Tokens.paperEdge }]} />

        <View style={styles.stepWrap}>
          <View style={[styles.stepBadge, { backgroundColor: Tokens.amberDeep }]}>
            <MaterialCommunityIcons name="hand-pointing-up" size={14} color={Tokens.paper} />
          </View>
          <View style={styles.stepBody}>
            <Text style={[styles.stepTitle, { color: theme.colors.onSurface }]}>
              {t('settingsBookmarklet.step2Title')}
            </Text>
            <Text style={[styles.stepDesc, { color: theme.colors.onSurfaceVariant }]}>
              {t('settingsBookmarklet.step2Body')}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsBookmarklet.howSection')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: Tokens.paperEdge }]}>
        {[
          { icon: 'cursor-text' as const, text: t('settingsBookmarklet.how1') },
          { icon: 'bookmark-outline' as const, text: t('settingsBookmarklet.how2') },
          { icon: 'card-text-outline' as const, text: t('settingsBookmarklet.how3') },
          { icon: 'check-circle-outline' as const, text: t('settingsBookmarklet.how4') },
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

      <View style={[styles.tip, { backgroundColor: Tokens.amberDeep + '18', borderColor: Tokens.amberDeep + '40' }]}>
        <MaterialCommunityIcons name="lightbulb-outline" size={16} color={Tokens.amberDeep} style={{ marginTop: 1 }} />
        <Text style={[styles.tipText, { color: theme.colors.onSurface }]}>
          {t('settingsBookmarklet.tip')}
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
    fontFamily: 'monospace',
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
