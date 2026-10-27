import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, Text, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isHapticsEnabled, setHapticsEnabled, light as hapticLight } from '../utils/haptics';
import { withAlpha } from '../utils/categoryColors';
import { useLanguage, LanguagePreference } from '../context/LanguageContext';

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

function LanguageOption({
  label,
  flag,
  active,
  showDivider,
  onPress,
}: {
  label: string;
  flag?: string;
  active: boolean;
  showDivider: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        style={styles.row}
      >
        <View style={[styles.rowIcon, { backgroundColor: withAlpha(theme.colors.primary, 0.12) }]}>
          {flag ? (
            <Text style={styles.flag}>{flag}</Text>
          ) : (
            <MaterialCommunityIcons name="cellphone" size={18} color={theme.colors.primary} />
          )}
        </View>
        <Text
          style={{
            flex: 1,
            color: theme.colors.onSurface,
            fontSize: 15,
            fontWeight: active ? '600' : '500',
          }}
        >
          {label}
        </Text>
        {active && <MaterialCommunityIcons name="check" size={20} color={theme.colors.primary} />}
      </TouchableOpacity>
      {showDivider && <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />}
    </>
  );
}

export default function SettingsDarstellungScreen() {
  const theme = useTheme();
  const { t, preference, setPreference } = useLanguage();
  const [hapticsOn, setHapticsOn] = useState(isHapticsEnabled());

  const toggleHaptics = async (value: boolean) => {
    setHapticsOn(value);
    await setHapticsEnabled(value);
    if (value) hapticLight();
  };

  const languageOptions: { value: LanguagePreference; label: string; flag?: string }[] = [
    { value: 'system', label: t('settingsDarstellung.languageSystem') },
    { value: 'de', label: t('settingsDarstellung.languageGerman'), flag: '🇩🇪' },
    { value: 'en', label: t('settingsDarstellung.languageEnglish'), flag: '🇬🇧' },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsDarstellung.feedback')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <SettingRow
          icon="vibrate"
          label={t('settingsDarstellung.vibration')}
          sublabel={t('settingsDarstellung.vibrationSub')}
          showDivider={false}
          trailing={
            <Switch value={hapticsOn} onValueChange={toggleHaptics} color={theme.colors.primary} />
          }
        />
      </View>

      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        {t('settingsDarstellung.language')}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {languageOptions.map((opt, i) => (
          <LanguageOption
            key={opt.value}
            label={opt.label}
            flag={opt.flag}
            active={preference === opt.value}
            showDivider={i < languageOptions.length - 1}
            onPress={() => setPreference(opt.value)}
          />
        ))}
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
  flag: { fontSize: 18 },
});
