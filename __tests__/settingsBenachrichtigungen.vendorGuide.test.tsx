/**
 * Benachrichtigungen: Auf Geräten mit Hersteller-Hintergrundsperre (Xiaomi & Co.) zeigt der Screen
 * eine passende Schritt-Anleitung samt Knopf zu den App-Einstellungen. Hintergrund: Auf Xiaomi löste der
 * Alarm pünktlich aus, MIUI startete Velm aber nicht ("proc frequent died") — die Benachrichtigung fehlte.
 */
import React from 'react';
import { Platform } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { getBackgroundVendor } from '../src/utils/deviceVendor';

const mockDevice: { manufacturer: string | null; brand: string | null } = { manufacturer: null, brand: null };
jest.mock('expo-device', () => ({
  isDevice: true,
  get manufacturer() { return mockDevice.manufacturer; },
  get brand() { return mockDevice.brand; },
}));

const mockOpenAppSettings = jest.fn();
jest.mock('../src/utils/notifications', () => ({
  openExactAlarmSettings: jest.fn(),
  openBatteryOptimizationSettings: jest.fn(),
  openAppSettings: () => mockOpenAppSettings(),
}));
jest.mock('../src/utils/reengagementScheduler', () => ({
  loadReengagementEnabled: jest.fn(() => Promise.resolve(true)),
  saveReengagementEnabled: jest.fn(() => Promise.resolve()),
}));
jest.mock('../src/components/ReengagementBootstrap', () => ({
  useRefreshReengagement: () => jest.fn(),
}));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de', preference: 'de', setPreference: jest.fn() }) };
});

const Screen = require('../src/screens/SettingsBenachrichtigungenScreen').default;
const originalOS = Platform.OS;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

afterEach(() => {
  setOS(originalOS);
  mockOpenAppSettings.mockClear();
});

describe('getBackgroundVendor', () => {
  test.each([
    ['Xiaomi', 'Redmi', 'xiaomi'],
    ['Xiaomi', 'POCO', 'xiaomi'],
    ['HUAWEI', 'HUAWEI', 'huawei'],
    ['HONOR', 'HONOR', 'huawei'],
    ['OnePlus', 'OnePlus', 'oppo'],
    ['realme', 'realme', 'oppo'],
    ['OPPO', 'OPPO', 'oppo'],
    ['vivo', 'iQOO', 'vivo'],
    ['samsung', 'samsung', 'samsung'],
    ['Google', 'google', 'other'],
    [null, null, 'other'],
  ])('%s / %s → %s', (manufacturer, brand, expected) => {
    expect(getBackgroundVendor(manufacturer, brand)).toBe(expected);
  });
});

test('Xiaomi unter Android: Anleitung mit Autostart und Knopf zu den App-Einstellungen', async () => {
  setOS('android');
  mockDevice.manufacturer = 'Xiaomi';
  mockDevice.brand = 'Redmi';
  render(<Screen />);
  expect(await screen.findByTestId('vendor-guide')).toBeTruthy();
  expect(screen.getByText('Für dein Gerät (Xiaomi, Redmi, POCO)')).toBeTruthy();
  expect(screen.getByText('„Autostart“ einschalten')).toBeTruthy();
  expect(screen.getByText('„Akkusparmodus“ → „Keine Einschränkungen“')).toBeTruthy();
  fireEvent.press(screen.getByText('App-Einstellungen von Velm öffnen'));
  expect(mockOpenAppSettings).toHaveBeenCalledTimes(1);
});

test('reines Android (Pixel): keine Hersteller-Anleitung', async () => {
  setOS('android');
  mockDevice.manufacturer = 'Google';
  mockDevice.brand = 'google';
  render(<Screen />);
  await screen.findByText('Genaue Alarme erlauben');
  expect(screen.queryByTestId('vendor-guide')).toBeNull();
});

test('iOS: keine Hersteller-Anleitung, auch wenn ein Name passen würde', async () => {
  setOS('ios');
  mockDevice.manufacturer = 'Xiaomi';
  mockDevice.brand = 'Xiaomi';
  render(<Screen />);
  await screen.findByText('Genaue Alarme erlauben');
  expect(screen.queryByTestId('vendor-guide')).toBeNull();
});

test('jede Hersteller-Anleitung gibt es auf Deutsch und Englisch', () => {
  const de = require('../src/i18n/locales/de').default.settingsBenachrichtigungen;
  const en = require('../src/i18n/locales/en').default.settingsBenachrichtigungen;
  for (const v of ['xiaomi', 'huawei', 'oppo', 'vivo', 'samsung']) {
    expect(de.vendorSteps[v].split('\n').length).toBeGreaterThanOrEqual(2);
    expect(en.vendorSteps[v].split('\n').length).toBe(de.vendorSteps[v].split('\n').length);
    expect(en.vendorName[v]).toBeTruthy();
  }
});
