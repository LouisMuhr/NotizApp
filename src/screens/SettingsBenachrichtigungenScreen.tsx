import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  openExactAlarmSettings,
  openBatteryOptimizationSettings,
  scheduleTestNotification,
  scheduleTestRecurring,
  getScheduledReminders,
  ScheduledReminderInfo,
} from '../utils/notifications';
import { ReminderRecurrence } from '../models/Note';
import { withAlpha } from '../utils/categoryColors';
import { useLanguage } from '../context/LanguageContext';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const RECURRENCE_TESTS: { recurrence: ReminderRecurrence; icon: IconName; key: string }[] = [
  { recurrence: 'once', icon: 'numeric-1-circle-outline', key: 'testOnce' },
  { recurrence: 'daily', icon: 'calendar-today', key: 'testDaily' },
  { recurrence: 'weekly', icon: 'calendar-week', key: 'testWeekly' },
  { recurrence: 'monthly', icon: 'calendar-month-outline', key: 'testMonthly' },
];

function ActionRow({
  icon,
  label,
  sublabel,
  onPress,
  showDivider = true,
}: {
  icon: IconName;
  label: string;
  sublabel?: string;
  onPress: () => void;
  showDivider?: boolean;
}) {
  const theme = useTheme();
  return (
    <>
      <TouchableOpacity activeOpacity={0.6} onPress={onPress} style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: withAlpha(theme.colors.primary, 0.12) }]}>
          <MaterialCommunityIcons name={icon} size={18} color={theme.colors.primary} />
        </View>
        <View style={styles.rowText}>
          <Text style={{ color: theme.colors.onSurface, fontSize: 15, fontWeight: '500' }}>
            {label}
          </Text>
          {sublabel ? (
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 1 }}>
              {sublabel}
            </Text>
          ) : null}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
      </TouchableOpacity>
      {showDivider && (
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
      )}
    </>
  );
}

export default function SettingsBenachrichtigungenScreen() {
  const theme = useTheme();
  const { t, locale } = useLanguage();
  const [scheduled, setScheduled] = useState<ScheduledReminderInfo[]>([]);

  const loadScheduled = useCallback(() => {
    getScheduledReminders().then(setScheduled).catch(() => setScheduled([]));
  }, []);

  useFocusEffect(loadScheduled);

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
        <ActionRow
          icon="bell-cog-outline"
          label={t('settingsBenachrichtigungen.allowExactAlarms')}
          sublabel={t('settingsBenachrichtigungen.opensSettings')}
          onPress={() => openExactAlarmSettings()}
        />
        <ActionRow
          icon="battery-off-outline"
          label={t('settingsBenachrichtigungen.disableBatteryOpt')}
          sublabel={t('settingsBenachrichtigungen.opensSettings')}
          showDivider={false}
          onPress={() => openBatteryOptimizationSettings()}
        />
      </View>

      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsBenachrichtigungen.testSection')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <ActionRow
          icon="bell-ring-outline"
          label={t('settingsBenachrichtigungen.sendTestNotification')}
          sublabel={t('settingsBenachrichtigungen.triggersIn5Sec')}
          showDivider={false}
          onPress={() => scheduleTestNotification()}
        />
      </View>

      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsBenachrichtigungen.testRecurrenceSection')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {RECURRENCE_TESTS.map(({ recurrence, icon, key }, i) => (
          <ActionRow
            key={recurrence}
            icon={icon}
            label={t(`settingsBenachrichtigungen.${key}`)}
            showDivider={i < RECURRENCE_TESTS.length - 1}
            onPress={async () => {
              const now = new Date(Date.now() + 10_000);
              await scheduleTestRecurring(recurrence, now.getDay() + 1, now.getDate(), 10);
              loadScheduled();
            }}
          />
        ))}
      </View>
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsBenachrichtigungen.testRecurrenceHint')}
      </Text>

      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsBenachrichtigungen.scheduledSection')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {scheduled.length === 0 ? (
          <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant, margin: 16 }]}>
            {t('settingsBenachrichtigungen.noneScheduled')}
          </Text>
        ) : (
          scheduled.map((s) => (
            <View key={s.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={{ color: theme.colors.onSurface, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>
                  {s.title}
                </Text>
                <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 1 }}>
                  {s.nextAt
                    ? t('settingsBenachrichtigungen.nextAt', {
                        date: s.nextAt.toLocaleString(locale === 'en' ? 'en-US' : 'de-DE', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }),
                      })
                    : t('settingsBenachrichtigungen.nextUnknown')}
                </Text>
              </View>
            </View>
          ))
        )}
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
        <ActionRow
          icon="refresh"
          label={t('settingsBenachrichtigungen.refresh')}
          showDivider={false}
          onPress={loadScheduled}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  divider: { height: 1, marginLeft: 60, opacity: 0.35 },
});
