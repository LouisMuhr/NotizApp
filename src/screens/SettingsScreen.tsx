import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';


type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function NavRow({
  icon,
  iconBg,
  label,
  sublabel,
  onPress,
  showDivider = true,
}: {
  icon: IconName;
  iconBg: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  showDivider?: boolean;
}) {
  const theme = useTheme();
  return (
    <>
      <TouchableOpacity activeOpacity={0.6} onPress={onPress} style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={icon} size={19} color="#fff" />
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
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.colors.onSurfaceVariant}
        />
      </TouchableOpacity>
      {showDivider && (
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
      )}
    </>
  );
}

function InfoRow({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: IconName;
  iconBg: string;
  label: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={19} color="#fff" />
      </View>
      <Text style={{ color: theme.colors.onSurface, fontSize: 15, fontWeight: '500', flex: 1 }}>
        {label}
      </Text>
      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 14 }}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const colors = {
    purple: '#7B6EF6',
    teal: '#3ECFB4',
    orange: '#FFB347',
    blue: '#4A90D9',
    gray: '#6B7280',
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* ── Allgemein ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Allgemein
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <NavRow
          icon="palette-outline"
          iconBg={colors.purple}
          label="Darstellung"
          sublabel="Vibration & Feedback"
          onPress={() => navigation.navigate('SettingsDarstellung')}
          showDivider={false}
        />
      </View>

      {/* ── Inhalte ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Inhalte
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <NavRow
          icon="tag-outline"
          iconBg={colors.teal}
          label="Kategorien"
          sublabel="Kategorien verwalten"
          onPress={() => navigation.navigate('SettingsKategorien')}
          showDivider={false}
        />
      </View>

      {/* ── System ── */}
      {Platform.OS === 'android' && (
        <>
          <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
            System
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <NavRow
              icon="bell-outline"
              iconBg={colors.orange}
              label="Benachrichtigungen"
              sublabel="Alarme & Akkuoptimierung"
              onPress={() => navigation.navigate('SettingsBenachrichtigungen')}
              showDivider={false}
            />
          </View>
        </>
      )}

      {/* ── Verbindung ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Verbindung
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <NavRow
          icon="cloud-sync-outline"
          iconBg={colors.blue}
          label="Synchronisation"
          sublabel="Claude-Bridge & Device-ID"
          onPress={() => navigation.navigate('SettingsSynchronisation')}
          showDivider={false}
        />
      </View>

      {/* ── Info ── */}
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Info
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <InfoRow
          icon="application-outline"
          iconBg={colors.gray}
          label="Version"
          value="1.0.0"
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
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  divider: { height: 1, marginLeft: 62, opacity: 0.35 },
});
