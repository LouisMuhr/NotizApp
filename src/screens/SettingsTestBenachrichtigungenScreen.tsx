import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  scheduleTestNotification,
  scheduleTestRecurring,
  getScheduledReminders,
  ScheduledReminderInfo,
} from '../utils/notifications';
import { ReminderRecurrence } from '../models/Note';
import { useLanguage } from '../context/LanguageContext';
import { useIsAdmin } from '../sync/adminAccess';
import SettingsActionRow from '../components/SettingsActionRow';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const RECURRENCE_TESTS: { recurrence: ReminderRecurrence; icon: IconName; key: string }[] = [
  { recurrence: 'once', icon: 'numeric-1-circle-outline', key: 'testOnce' },
  { recurrence: 'daily', icon: 'calendar-today', key: 'testDaily' },
  { recurrence: 'weekly', icon: 'calendar-week', key: 'testWeekly' },
  { recurrence: 'monthly', icon: 'calendar-month-outline', key: 'testMonthly' },
];

/** Admin-Werkzeug: Test-Benachrichtigungen und Einsicht in die vom OS eingeplanten Erinnerungen. */
export default function SettingsTestBenachrichtigungenScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { t, locale } = useLanguage();
  const isAdmin = useIsAdmin();
  const [scheduled, setScheduled] = useState<ScheduledReminderInfo[]>([]);

  const loadScheduled = useCallback(() => {
    getScheduledReminders().then(setScheduled).catch(() => setScheduled([]));
  }, []);

  useFocusEffect(loadScheduled);

  // Erreichbar nur über die Admin-Zeile; meldet sich der Admin ab, geht es zurück.
  useEffect(() => {
    if (isAdmin === false && navigation.canGoBack()) navigation.goBack();
  }, [isAdmin, navigation]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsTestBenachrichtigungen.testSection')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <SettingsActionRow
          icon="bell-ring-outline"
          label={t('settingsTestBenachrichtigungen.sendTestNotification')}
          sublabel={t('settingsTestBenachrichtigungen.triggersIn5Sec')}
          showDivider={false}
          onPress={() => scheduleTestNotification()}
        />
      </View>

      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsTestBenachrichtigungen.testRecurrenceSection')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {RECURRENCE_TESTS.map(({ recurrence, icon, key }, i) => (
          <SettingsActionRow
            key={recurrence}
            icon={icon}
            label={t(`settingsTestBenachrichtigungen.${key}`)}
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
        {t('settingsTestBenachrichtigungen.testRecurrenceHint')}
      </Text>

      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsTestBenachrichtigungen.scheduledSection')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {scheduled.length === 0 ? (
          <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant, margin: 16 }]}>
            {t('settingsTestBenachrichtigungen.noneScheduled')}
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
                    ? t('settingsTestBenachrichtigungen.nextAt', {
                        date: s.nextAt.toLocaleString(locale === 'en' ? 'en-US' : 'de-DE', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }),
                      })
                    : t('settingsTestBenachrichtigungen.nextUnknown')}
                </Text>
              </View>
            </View>
          ))
        )}
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
        <SettingsActionRow
          icon="refresh"
          label={t('settingsTestBenachrichtigungen.refresh')}
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
  rowText: { flex: 1 },
  divider: { height: 1, marginLeft: 60, opacity: 0.35 },
});
