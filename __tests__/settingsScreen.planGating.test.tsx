/**
 * Abo-Gating in den Settings: Bookmarklet und Web App sind immer sichtbar,
 * zeigen aber im nicht freigeschalteten Abo nur, ab welchem Plan sie nutzbar
 * sind — und fuehren dann zum Abo-Screen statt in die gesperrte Funktion.
 * Bookmarklet ab Basic (bridge/api/bookmarklet-token.ts), Web App ab Pro.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

const mockNavigate = jest.fn();

jest.mock('../src/context/NotesContext', () => ({ useNotes: jest.fn() }));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../src/sync/supabaseClient', () => ({ getSupabase: () => null }));

const { useNotes } = require('../src/context/NotesContext') as { useNotes: jest.Mock };
const SettingsScreen = require('../src/screens/SettingsScreen').default;

beforeEach(() => mockNavigate.mockClear());

test('Free: beide Zeilen nennen das noetige Abo und fuehren zum Abo-Screen', () => {
  useNotes.mockReturnValue({ tier: 'free' });
  render(<SettingsScreen />);

  expect(screen.getByText('Erst ab Basic-Plan verfügbar')).toBeTruthy();
  expect(screen.getByText('Erst ab Pro-Plan verfügbar')).toBeTruthy();
  expect(screen.queryByText('Webseiten als Notiz speichern')).toBeNull();

  fireEvent.press(screen.getByText('Bookmarklet'));
  expect(mockNavigate).toHaveBeenCalledWith('SettingsAbo');
});

test('Basic: Bookmarklet ist normal nutzbar, Web App bleibt auf Pro gesperrt', () => {
  useNotes.mockReturnValue({ tier: 'basic' });
  render(<SettingsScreen />);

  expect(screen.getByText('Webseiten als Notiz speichern')).toBeTruthy();
  expect(screen.queryByText('Erst ab Basic-Plan verfügbar')).toBeNull();
  expect(screen.getByText('Erst ab Pro-Plan verfügbar')).toBeTruthy();

  fireEvent.press(screen.getByText('Bookmarklet'));
  expect(mockNavigate).toHaveBeenCalledWith('SettingsBookmarklet');
});

test('Pro: beide Funktionen sind freigeschaltet', () => {
  useNotes.mockReturnValue({ tier: 'pro' });
  render(<SettingsScreen />);

  expect(screen.getByText('Webseiten als Notiz speichern')).toBeTruthy();
  expect(screen.getByText('Notizen im Browser als Graph')).toBeTruthy();

  fireEvent.press(screen.getByText('Web App'));
  expect(mockNavigate).toHaveBeenCalledWith('SettingsWebApp');
});
