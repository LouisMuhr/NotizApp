import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { openExactAlarmSettings, openBatteryOptimizationSettings, scheduleTestNotification } from '../utils/notifications';
import { withAlpha } from '../utils/categoryColors';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        Damit Erinnerungen pünktlich ankommen, müssen{' '}
        <Text style={{ color: theme.colors.onSurface, fontWeight: '600' }}>Genaue Alarme</Text>{' '}
        erlaubt und die{' '}
        <Text style={{ color: theme.colors.onSurface, fontWeight: '600' }}>Akkuoptimierung</Text>{' '}
        deaktiviert sein. Auf Xiaomi/MIUI zusätzlich Autostart aktivieren.
      </Text>

      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Berechtigungen
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <ActionRow
          icon="bell-cog-outline"
          label="Genaue Alarme erlauben"
          sublabel="Öffnet die Systemeinstellungen"
          onPress={() => openExactAlarmSettings()}
        />
        <ActionRow
          icon="battery-off-outline"
          label="Akkuoptimierung deaktivieren"
          sublabel="Öffnet die Systemeinstellungen"
          showDivider={false}
          onPress={() => openBatteryOptimizationSettings()}
        />
      </View>

      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Test
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <ActionRow
          icon="bell-ring-outline"
          label="Test-Benachrichtigung senden"
          sublabel="Wird in 5 Sekunden ausgelöst"
          showDivider={false}
          onPress={() => scheduleTestNotification()}
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
