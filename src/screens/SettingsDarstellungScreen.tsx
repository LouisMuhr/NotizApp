import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme, Text, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isHapticsEnabled, setHapticsEnabled, light as hapticLight } from '../utils/haptics';
import { withAlpha } from '../utils/categoryColors';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function SettingRow({
  icon,
  label,
  sublabel,
  trailing,
  showDivider = true,
}: {
  icon: IconName;
  label: string;
  sublabel?: string;
  trailing?: React.ReactNode;
  showDivider?: boolean;
}) {
  const theme = useTheme();
  return (
    <>
      <View style={styles.row}>
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
        {trailing}
      </View>
      {showDivider && (
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
      )}
    </>
  );
}

export default function SettingsDarstellungScreen() {
  const theme = useTheme();
  const [hapticsOn, setHapticsOn] = useState(isHapticsEnabled());

  const toggleHaptics = async (value: boolean) => {
    setHapticsOn(value);
    await setHapticsEnabled(value);
    if (value) hapticLight();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Feedback
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <SettingRow
          icon="vibrate"
          label="Vibration"
          sublabel="Haptisches Feedback bei Aktionen"
          showDivider={false}
          trailing={
            <Switch value={hapticsOn} onValueChange={toggleHaptics} color={theme.colors.primary} />
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100, gap: 6 },
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
