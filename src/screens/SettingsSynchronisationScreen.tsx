import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme, Text, IconButton, Snackbar } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isSyncConfigured } from '../sync/supabaseClient';
import { getDeviceId, isDeviceIdFromEnv } from '../sync/deviceId';
import { withAlpha } from '../utils/categoryColors';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function InfoRow({
  icon,
  label,
  trailing,
  showDivider = true,
}: {
  icon: IconName;
  label: string;
  trailing: React.ReactNode;
  showDivider?: boolean;
}) {
  const theme = useTheme();
  return (
    <>
      <View style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: withAlpha(theme.colors.primary, 0.12) }]}>
          <MaterialCommunityIcons name={icon} size={18} color={theme.colors.primary} />
        </View>
        <Text style={{ color: theme.colors.onSurface, fontSize: 15, fontWeight: '500', flex: 1 }}>
          {label}
        </Text>
        {trailing}
      </View>
      {showDivider && (
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
      )}
    </>
  );
}

export default function SettingsSynchronisationScreen() {
  const theme = useTheme();
  const [deviceId, setDeviceId] = useState('');
  const [snack, setSnack] = useState(false);
  const syncOn = isSyncConfigured();

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  const copyDeviceId = async () => {
    if (!deviceId) return;
    await Clipboard.setStringAsync(deviceId);
    setSnack(true);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Claude-Bridge
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <InfoRow
          icon="cloud-sync-outline"
          label="Status"
          trailing={
            <Text style={{
              color: syncOn ? theme.colors.tertiary : theme.colors.onSurfaceVariant,
              fontSize: 14,
              fontWeight: '600',
            }}>
              {syncOn ? 'Verbunden' : 'Nicht konfiguriert'}
            </Text>
          }
        />
        <InfoRow
          icon="identifier"
          label="Device-ID"
          showDivider={false}
          trailing={
            <View style={styles.deviceRow}>
              <View>
                <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11, textAlign: 'right' }}>
                  {isDeviceIdFromEnv() ? '.env, fixiert' : 'lokal generiert'}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: theme.colors.onSurface, fontSize: 12, fontFamily: 'monospace' }}
                >
                  {deviceId ? deviceId.slice(0, 12) + '…' : '…'}
                </Text>
              </View>
              <IconButton
                icon="content-copy"
                size={16}
                iconColor={theme.colors.primary}
                onPress={copyDeviceId}
                style={{ margin: -4 }}
              />
            </View>
          }
        />
      </View>

      {!syncOn && (
        <Text style={[styles.configHint, { color: theme.colors.onSurfaceVariant }]}>
          Setze EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY in der .env, dann App neu starten.
        </Text>
      )}

      <Snackbar visible={snack} onDismiss={() => setSnack(false)} duration={1500}>
        Device-ID kopiert
      </Snackbar>
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
  divider: { height: 1, marginLeft: 60, opacity: 0.35 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  configHint: {
    fontSize: 11,
    lineHeight: 16,
    marginHorizontal: 4,
    marginTop: 4,
  },
});
