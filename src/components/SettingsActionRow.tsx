import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { withAlpha } from '../utils/categoryColors';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Tippbare Zeile für Unterscreens der Einstellungen (Icon, Label, optional Sublabel, Chevron). */
export default function SettingsActionRow({
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

const styles = StyleSheet.create({
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
