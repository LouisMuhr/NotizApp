import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import {
  openExactAlarmSettings,
  openBatteryOptimizationSettings,
} from '../utils/notifications';
import { useLanguage } from '../context/LanguageContext';
import SettingsActionRow from '../components/SettingsActionRow';

export default function SettingsBenachrichtigungenScreen() {
  const theme = useTheme();
  const { t } = useLanguage();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        <Text style={{ color: theme.colors.onSurface, fontWeight: '600' }}>{t('settingsBenachrichtigungen.hintExactAlarms')}</Text>
        {' & '}
        <Text style={{ color: theme.colors.onSurface, fontWeight: '600' }}>{t('settingsBenachrichtigungen.hintBatteryOpt')}</Text>
        {'. '}
        {t('settingsBenachrichtigungen.hintXiaomi')}
      </Text>

      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsBenachrichtigungen.permissionsSection')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <SettingsActionRow
          icon="bell-cog-outline"
          label={t('settingsBenachrichtigungen.allowExactAlarms')}
          sublabel={t('settingsBenachrichtigungen.opensSettings')}
          onPress={() => openExactAlarmSettings()}
        />
        <SettingsActionRow
          icon="battery-off-outline"
          label={t('settingsBenachrichtigungen.disableBatteryOpt')}
          sublabel={t('settingsBenachrichtigungen.opensSettings')}
          showDivider={false}
          onPress={() => openBatteryOptimizationSettings()}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100, gap: 6 },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    marginHorizontal: 4,
    marginBottom: 6,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 10,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: { borderRadius: 20, overflow: 'hidden' },
});
