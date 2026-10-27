/**
 * Darstellung: Der KI-Schalter lebt nur noch im Voice-Sheet, die Sprachauswahl ist eine
 * Liste mit Flaggen (System / Deutsch / English).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

const mockSetPreference = jest.fn();

jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return {
    useLanguage: () => ({ t, locale: 'de', preference: 'de', setPreference: mockSetPreference }),
  };
});
jest.mock('../src/utils/haptics', () => ({
  isHapticsEnabled: () => true,
  setHapticsEnabled: jest.fn(),
  light: jest.fn(),
}));

const SettingsDarstellungScreen = require('../src/screens/SettingsDarstellungScreen').default;

beforeEach(() => mockSetPreference.mockClear());

test('kein KI-Schalter mehr unter Darstellung', () => {
  render(<SettingsDarstellungScreen />);
  expect(screen.queryByText('KI-Strukturierung für Sprachnotizen')).toBeNull();
});

test('Sprachen stehen untereinander, Deutsch/English mit Flagge, aktive ist markiert', () => {
  render(<SettingsDarstellungScreen />);
  expect(screen.getByText('🇩🇪')).toBeTruthy();
  expect(screen.getByText('🇬🇧')).toBeTruthy();
  expect(screen.getByLabelText('Deutsch').props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText('English').props.accessibilityState.selected).toBe(false);
});

test('Tippen auf eine Sprache setzt die Praeferenz', () => {
  render(<SettingsDarstellungScreen />);
  fireEvent.press(screen.getByLabelText('English'));
  expect(mockSetPreference).toHaveBeenCalledWith('en');
});
