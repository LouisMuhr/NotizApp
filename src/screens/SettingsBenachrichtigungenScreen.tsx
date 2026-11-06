import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme, Text, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { withAlpha } from '../utils/categoryColors';
import { loadReengagementEnabled, saveReengagementEnabled } from '../utils/reengagementScheduler';
import { useRefreshReengagement } from '../components/ReengagementBootstrap';
import {
  openExactAlarmSettings,
  openBatteryOptimizationSettings,
} from '../utils/notifications';
import { useLanguage } from '../context/LanguageContext';
import SettingsActionRow from '../components/SettingsActionRow';

export default function SettingsBenachrichtigungenScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const refreshReengagement = useRefreshReengagement();
  // null = noch nicht geladen (Schalter bleibt solange gesperrt)
  const [reengagementOn, setReengagementOn] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    loadReengagementEnabled().then((v) => { if (alive) setReengagementOn(v); });
    return () => { alive = false; };
  }, []);

  async function toggleReengagement(next: boolean) {
    setReengagementOn(next);
    try {
      // Aus = alle Rückkehr-Benachrichtigungen stornieren (saveReengagementEnabled), an = sofort planen.
      await saveReengagementEnabled(next);
      if (next) await refreshReengagement();
    } catch (e) {
      console.warn('[reengagement] toggle failed', e);
    }
  }

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
        {t('settingsBenachrichtigungen.reengagementSection')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: withAlpha(theme.colors.primary, 0.12) }]}>
            <MaterialCommunityIcons name="bell-ring-outline" size={18} color={theme.colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={{ color: theme.colors.onSurface, fontSize: 15, fontWeight: '500' }}>
              {t('settingsBenachrichtigungen.reengagementLabel')}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 1 }}>
              {t('settingsBenachrichtigungen.reengagementSublabel')}
            </Text>
          </View>
          <Switch
            testID="reengagement-switch"
            value={reengagementOn ?? false}
            disabled={reengagementOn === null}
            onValueChange={toggleReengagement}
            color={theme.colors.primary}
          />
        </View>
      </View>

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
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
});
