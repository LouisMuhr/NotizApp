/**
 * Im "Mein Abo"-Screen muss unter Basic stehen, dass das Bookmarklet ab diesem
 * Plan verfuegbar ist — sowohl in der Upgrade-Karte (Free-User) als auch in den
 * enthaltenen Leistungen (Basic-User).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../src/context/NotesContext', () => ({ useNotes: jest.fn() }));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('../src/sync/supabaseClient', () => ({ getSupabase: () => null }));

const { useNotes } = require('../src/context/NotesContext') as { useNotes: jest.Mock };
const SettingsAboScreen = require('../src/screens/SettingsAboScreen').default;

const BOOKMARKLET = 'Bookmarklet — Webseiten als Notiz speichern';

test('Free-User sieht das Bookmarklet in der Basic-Upgrade-Karte', () => {
  useNotes.mockReturnValue({ tier: 'free', nextAllowedAt: null });
  render(<SettingsAboScreen />);
  expect(screen.getByText(BOOKMARKLET)).toBeTruthy();
});

test('Basic-User sieht das Bookmarklet unter den enthaltenen Leistungen', () => {
  useNotes.mockReturnValue({ tier: 'basic', nextAllowedAt: null });
  render(<SettingsAboScreen />);
  expect(screen.getByText(BOOKMARKLET)).toBeTruthy();
});

test('Kein Feature-Eintrag bleibt als roher i18n-Key uebrig', () => {
  useNotes.mockReturnValue({ tier: 'free', nextAllowedAt: null });
  render(<SettingsAboScreen />);
  expect(screen.queryByText(/settingsAbo\.plans/)).toBeNull();
});
