/**
 * KI-Sprachnotizen sind Pro. Der Schalter unter Darstellung ist fuer Free/Basic
 * sichtbar, nennt aber nur den noetigen Plan und fuehrt zum Abo-Screen. Solange
 * der Tier unbekannt ist (null), wird keine Sperre behauptet.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

const mockNavigate = jest.fn();

jest.mock('../src/context/NotesContext', () => ({ useNotes: jest.fn() }));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de', preference: 'de', setPreference: jest.fn() }) };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../src/utils/haptics', () => ({
  isHapticsEnabled: () => true,
  setHapticsEnabled: jest.fn(),
  light: jest.fn(),
}));

const { useNotes } = require('../src/context/NotesContext') as { useNotes: jest.Mock };
const SettingsDarstellungScreen = require('../src/screens/SettingsDarstellungScreen').default;

const LOCKED = 'Erst ab Pro-Plan verfügbar';
const SUB = 'Claude erkennt Titel, Checkliste, Kategorie und Erinnerung';

beforeEach(() => mockNavigate.mockClear());

test.each(['free', 'basic'])('%s: Zeile ist gesperrt und fuehrt zum Abo-Screen', (tier) => {
  useNotes.mockReturnValue({ tier });
  render(<SettingsDarstellungScreen />);
  expect(screen.getByText(LOCKED)).toBeTruthy();
  expect(screen.queryByText(SUB)).toBeNull();
  fireEvent.press(screen.getByText('KI-Strukturierung für Sprachnotizen'));
  expect(mockNavigate).toHaveBeenCalledWith('SettingsAbo');
});

test('Pro: Schalter statt Sperre', () => {
  useNotes.mockReturnValue({ tier: 'pro' });
  render(<SettingsDarstellungScreen />);
  expect(screen.getByText(SUB)).toBeTruthy();
  expect(screen.queryByText(LOCKED)).toBeNull();
});

test('Tier unbekannt: keine Sperre behaupten', () => {
  useNotes.mockReturnValue({ tier: null });
  render(<SettingsDarstellungScreen />);
  expect(screen.queryByText(LOCKED)).toBeNull();
});
