import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotes } from '../context/NotesContext';
import { Tokens } from '../theme/theme';
import { Fonts } from '../theme/typography';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  onPress: () => void;
}

export default function ProBanner({ onPress }: Props) {
  const { tier } = useNotes();
  const { t } = useLanguage();

  const UPGRADE_HINTS = [
    { tier: 'free' as const, text: t('proBanner.freeHint1'), sub: t('proBanner.freeHint2') },
    { tier: 'basic' as const, text: t('proBanner.basicHint1'), sub: t('proBanner.basicHint2') },
  ];

  const hint = UPGRADE_HINTS.find((h) => h.tier === tier);
  if (!hint) return null; // pro users see nothing

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.82 }]}
      accessibilityRole="button"
      accessibilityLabel={t('proBanner.accessibilityLabel')}
    >
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="crown-outline" size={15} color={Tokens.amberDeep} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.text} numberOfLines={1}>{hint.text}</Text>
        <Text style={styles.sub} numberOfLines={1}>{hint.sub}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={16} color={Tokens.amberDeep} />
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
