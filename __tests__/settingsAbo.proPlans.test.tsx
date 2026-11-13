/**
 * Preismodell Free + Pro: Die Abo-Seite verspricht nur, was der Code kann.
 * Pro enthaelt das Bookmarklet; Free nennt Sync (laeuft fuer jedes bestaetigte
 * Konto); nicht umgesetzte Versprechen (Prioritaet, Support, schnellere
 * Synthese) tauchen nirgends auf.
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

test('Free-User sieht das Bookmarklet in der Pro-Karte', () => {
  useNotes.mockReturnValue({ tier: 'free', nextAllowedAt: null });
  render(<SettingsAboScreen />);
  expect(screen.getByText(BOOKMARKLET)).toBeTruthy();
  expect(screen.getByText('Sync zwischen Geräten (mit Konto)')).toBeTruthy();
});

test('Pro-User sieht das Bookmarklet unter den enthaltenen Leistungen', () => {
  useNotes.mockReturnValue({ tier: 'pro', nextAllowedAt: null });
  render(<SettingsAboScreen />);
  expect(screen.getByText(BOOKMARKLET)).toBeTruthy();
});

test.each(['free', 'basic', 'pro'])('%s: keine nicht umgesetzten Versprechen', (tier) => {
  useNotes.mockReturnValue({ tier, nextAllowedAt: null });
  render(<SettingsAboScreen />);
  for (const fake of [/Priorit/, /Premium-Support/, /Schnellere Synthese/, /Web-Visualisierung/, /Geräte-Synchronisation/]) {
    expect(screen.queryByText(fake)).toBeNull();
  }
});

test('Kein Feature-Eintrag bleibt als roher i18n-Key uebrig', () => {
  useNotes.mockReturnValue({ tier: 'free', nextAllowedAt: null });
  render(<SettingsAboScreen />);
  expect(screen.queryByText(/settingsAbo\./)).toBeNull();
});
