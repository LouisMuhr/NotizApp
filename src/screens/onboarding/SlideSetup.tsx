import React from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tokens } from '../../theme/theme';
import { Fonts } from '../../theme/typography';
import { useLanguage } from '../../context/LanguageContext';
import { BackgroundVendor } from '../../utils/deviceVendor';
import {
  openExactAlarmSettings,
  openBatteryOptimizationSettings,
  openAppSettings,
} from '../../utils/notifications';
import { NextButton, SkipRow } from './components';
import { shared } from './shared';

interface Props {
  vendor: BackgroundVendor;
  onNext: () => void;
  scrollX: Animated.Value;
  index: number;
  slideWidth: number;
}

/**
 * Einrichtung (nur Android): exakte Alarme, Akkuoptimierung und — bei Herstellern mit eigener
 * Hintergrund-Sperre — die passenden Schritte. Ohne sie bleiben Erinnerungen aus (Xiaomi: der Alarm
 * löst aus, das System startet Velm aber nicht). Dieselben Inhalte stehen in Einstellungen → Benachrichtigungen.
 */
export default function SlideSetup({ vendor, onNext, scrollX, index, slideWidth }: Props) {
  const { t } = useLanguage();
  const translateX = scrollX.interpolate({
    inputRange: [(index - 1) * slideWidth, index * slideWidth, (index + 1) * slideWidth],
    outputRange: [-slideWidth * 0.25, 0, slideWidth * 0.25],
    extrapolate: 'clamp',
  });
  const opacity = scrollX.interpolate({
    inputRange: [(index - 0.5) * slideWidth, index * slideWidth, (index + 0.5) * slideWidth],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const steps = vendor === 'other'
    ? []
    : t(`settingsBenachrichtigungen.vendorSteps.${vendor}`).split('\n');

  return (
    <SafeAreaView style={[shared.screen, { backgroundColor: 'transparent' }]}>
      <Animated.View testID="onboarding-setup" style={[styles.inner, { transform: [{ translateX }], opacity }]}>
        <SkipRow label={t('onboarding.setupLabel')} onSkip={onNext} />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 28, paddingBottom: 12 }}>
          <Text style={styles.eyebrow}>{t('onboarding.setupEyebrow')}</Text>
          <Text style={styles.headline}>
            {t('onboarding.setupHeadline1')}{'\n'}
            <Text style={{ fontFamily: Fonts.serifItalic, color: Tokens.amberDeep }}>
              {t('onboarding.setupHeadline2')}
            </Text>
          </Text>
          <Text style={styles.body}>{t('onboarding.setupBody')}</Text>

          <ActionRow num="01" label={t('settingsBenachrichtigungen.allowExactAlarms')} onPress={openExactAlarmSettings} />
          <ActionRow num="02" label={t('settingsBenachrichtigungen.disableBatteryOpt')} onPress={openBatteryOptimizationSettings} />

          {steps.length > 0 ? (
            <View testID="onboarding-vendor-steps" style={{ marginTop: 22 }}>
              <Text style={styles.vendorTitle}>
                {t('onboarding.setupVendor', { vendor: t(`settingsBenachrichtigungen.vendorName.${vendor}`) })}
              </Text>
              {steps.map((step, i) => (
                <View key={i} style={styles.step}>
                  <Text style={styles.stepNum}>{i + 1}.</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
              <ActionRow num="03" label={t('settingsBenachrichtigungen.openAppSettings')} onPress={openAppSettings} />
              <Text style={styles.small}>{t('settingsBenachrichtigungen.deviceNamesVary')}</Text>
            </View>
          ) : null}

          <Text style={[styles.small, { marginTop: 18 }]}>{t('onboarding.setupLater')}</Text>
        </ScrollView>

        <View style={[shared.footerRow, { justifyContent: 'flex-end' }]}>
          <NextButton label={t('onboarding.next')} onPress={onNext} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

function ActionRow({ num, label, onPress }: { num: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={() => onPress()} activeOpacity={0.7} style={styles.action}>
      <Text style={styles.actionNum}>{num}</Text>
      <Text style={styles.actionText}>{label}</Text>
      <Text style={styles.actionArrow}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, paddingHorizontal: 26, paddingTop: 20, paddingBottom: 28 },
  eyebrow: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Tokens.amberDeep,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 14,
  },
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 48,
    lineHeight: 48 * 0.95,
    color: Tokens.ink,
    letterSpacing: -1.9,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: Tokens.inkDim,
    marginTop: 16,
    marginBottom: 10,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderTopWidth: 0.5,
    borderTopColor: Tokens.rule,
    paddingVertical: 14,
  },
  actionNum: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Tokens.amberDeep,
    letterSpacing: 0.88,
    minWidth: 22,
    fontWeight: '500',
  },
  actionText: { flex: 1, fontFamily: Fonts.serif, fontSize: 18, lineHeight: 23, color: Tokens.ink },
  actionArrow: { fontFamily: Fonts.serifItalic, fontSize: 18, color: Tokens.amberDeep },
  vendorTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: Tokens.ink,
    marginBottom: 8,
  },
  step: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  stepNum: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, color: Tokens.amberDeep, minWidth: 16 },
  stepText: { flex: 1, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, color: Tokens.inkDim },
  small: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 17, color: Tokens.inkFaint, marginTop: 6 },
});
