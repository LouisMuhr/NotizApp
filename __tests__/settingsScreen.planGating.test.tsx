/**
 * Abo-Gating in den Settings: Bookmarklet und Web App sind immer sichtbar,
 * zeigen aber im nicht freigeschalteten Abo nur, ab welchem Plan sie nutzbar
 * sind — und fuehren dann zum Abo-Screen statt in die gesperrte Funktion.
 * Beides ab Pro (Bookmarklet: bridge/api/note.ts). Basic ist eine Altlast und zaehlt wie Free.
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

  expect(screen.getAllByText('Erst ab Pro-Plan verfügbar')).toHaveLength(2);
  expect(screen.queryByText('Erst ab Basic-Plan verfügbar')).toBeNull();
  expect(screen.queryByText('Webseiten als Notiz speichern')).toBeNull();

  fireEvent.press(screen.getByText('Bookmarklet'));
  expect(mockNavigate).toHaveBeenCalledWith('SettingsAbo');
});

test('Legacy-Basic: Bookmarklet und Web App sind auf Pro gesperrt', () => {
  useNotes.mockReturnValue({ tier: 'basic' });
  render(<SettingsScreen />);

  expect(screen.getAllByText('Erst ab Pro-Plan verfügbar')).toHaveLength(2);
  fireEvent.press(screen.getByText('Bookmarklet'));
  expect(mockNavigate).toHaveBeenCalledWith('SettingsAbo');
});

test('Pro: beide Funktionen sind freigeschaltet', () => {
  useNotes.mockReturnValue({ tier: 'pro' });
  render(<SettingsScreen />);

  expect(screen.getByText('Webseiten als Notiz speichern')).toBeTruthy();
  expect(screen.getByText('Notizen im Browser als Graph')).toBeTruthy();

  fireEvent.press(screen.getByText('Web App'));
  expect(mockNavigate).toHaveBeenCalledWith('SettingsWebApp');
});
