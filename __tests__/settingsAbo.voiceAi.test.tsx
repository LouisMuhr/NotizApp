/**
 * KI-Sprachnotizen stehen im "Mein Abo"-Screen als Pro-Leistung: in der
 * Pro-Upgrade-Karte (Free/Basic) und unter den enthaltenen Leistungen (Pro).
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

const VOICE_AI = 'KI-Sprachnotizen: Titel, Checkliste, Kategorie & Erinnerung';

test.each(['free', 'basic', 'pro'])('%s sieht KI-Sprachnotizen als Pro-Leistung', (tier) => {
  useNotes.mockReturnValue({ tier, nextAllowedAt: null });
  render(<SettingsAboScreen />);
  expect(screen.getByText(VOICE_AI)).toBeTruthy();
});
