/**
 * Onboarding: (1) Sprache folgt dem System — Deutsch nur bei deutschem System, sonst Englisch;
 * keine fest eingebauten deutschen Texte mehr. (2) Auf Android steht die Einrichtung
 * (exakte Alarme, Akku, Hersteller-Schritte) im Onboarding statt versteckt in den Einstellungen.
 */
import React from 'react';
import { Platform } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

let mockLanguageCode: string | null = 'de';
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: mockLanguageCode }],
}));
const mockDevice: { manufacturer: string | null; brand: string | null } = { manufacturer: 'Xiaomi', brand: 'Redmi' };
jest.mock('expo-device', () => ({
  isDevice: true,
  get manufacturer() { return mockDevice.manufacturer; },
  get brand() { return mockDevice.brand; },
}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockOpenExact = jest.fn();
const mockOpenApp = jest.fn();
jest.mock('../src/utils/notifications', () => ({
  openExactAlarmSettings: () => mockOpenExact(),
  openBatteryOptimizationSettings: jest.fn(),
  openAppSettings: () => mockOpenApp(),
}));
let mockLocale: 'de' | 'en' = 'de';
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  return {
    useLanguage: () => {
      setI18nLocale(mockLocale);
      return { t, locale: mockLocale, preference: 'system', setPreference: jest.fn() };
    },
  };
});

import { detectDeviceLocale } from '../src/i18n';
const Onboarding = require('../src/screens/onboarding').default;
const originalOS = Platform.OS;
function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}
afterEach(() => {
  setOS(originalOS);
  mockOpenExact.mockClear();
  mockOpenApp.mockClear();
});

describe('detectDeviceLocale', () => {
  test.each([
    ['de', 'de'],
    ['en', 'en'],
    ['fr', 'en'],
    ['es', 'en'],
    [null, 'en'],
  ])('System %s → %s', (code, expected) => {
    mockLanguageCode = code;
    expect(detectDeviceLocale()).toBe(expected);
  });
});

test('Englisch: keine deutschen Überschriften oder Beispielnotizen im Onboarding', () => {
  mockLocale = 'en';
  setOS('ios');
  render(<Onboarding onDone={jest.fn()} />);
  for (const de of ['Eine', 'Anfang.', 'Toskana — die ersten Gedanken', 'Reise', 'Die KI webt deine Notizen',
    'liest niemand', 'Schreib', 'später.', 'Caffè-Notizen']) {
    expect(screen.queryByText(de)).toBeNull();
  }
  expect(screen.getByText('beginning.')).toBeTruthy();
  expect(screen.getByText('Tuscany — first thoughts')).toBeTruthy();
  expect(screen.getByText('freely.')).toBeTruthy();
});

test('Deutsch: Überschriften kommen weiter auf Deutsch', () => {
  mockLocale = 'de';
  setOS('ios');
  render(<Onboarding onDone={jest.fn()} />);
  expect(screen.getByText('Anfang.')).toBeTruthy();
  expect(screen.getByText('Schreib')).toBeTruthy();
});

test('Android (Xiaomi): Einrichtung im Onboarding mit Hersteller-Schritten und Knöpfen', () => {
  mockLocale = 'de';
  setOS('android');
  render(<Onboarding onDone={jest.fn()} />);
  expect(screen.getByTestId('onboarding-setup')).toBeTruthy();
  expect(screen.getByTestId('onboarding-vendor-steps')).toBeTruthy();
  expect(screen.getByText('„Autostart“ einschalten')).toBeTruthy();
  fireEvent.press(screen.getByText('Genaue Alarme erlauben'));
  expect(mockOpenExact).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('App-Einstellungen von Velm öffnen'));
  expect(mockOpenApp).toHaveBeenCalledTimes(1);
});

test('Android (Pixel): Einrichtung ohne Hersteller-Schritte', () => {
  mockLocale = 'de';
  setOS('android');
  mockDevice.manufacturer = 'Google';
  mockDevice.brand = 'google';
  render(<Onboarding onDone={jest.fn()} />);
  expect(screen.getByTestId('onboarding-setup')).toBeTruthy();
  expect(screen.queryByTestId('onboarding-vendor-steps')).toBeNull();
});

test('iOS: keine Einrichtungs-Seite', () => {
  mockLocale = 'de';
  setOS('ios');
  render(<Onboarding onDone={jest.fn()} />);
  expect(screen.queryByTestId('onboarding-setup')).toBeNull();
});
