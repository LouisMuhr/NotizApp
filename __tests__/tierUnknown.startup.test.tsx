/**
 * Abo-Status beim Kaltstart: "noch nicht bekannt" ist ein eigener Zustand.
 *
 * Frueher startete `tier` hart auf 'free'. Weil der echte Wert erst nach zwei
 * Netzwerk-Roundtrips eintrifft, sah ein zahlender Nutzer beim Start kurz den
 * Upsell-Banner und gesperrte Features. `null` heisst jetzt "weiss ich noch
 * nicht" — und die UI behauptet solange nichts.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../src/context/NotesContext', () => ({ useNotes: jest.fn() }));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/sync/supabaseClient', () => ({ getSupabase: () => null }));

const { useNotes } = require('../src/context/NotesContext') as { useNotes: jest.Mock };
const ProBanner = require('../src/components/ProBanner').default;
const SettingsScreen = require('../src/screens/SettingsScreen').default;

// ---------------------------------------------------------------------------
// ProBanner — der gemeldete Fall
// ---------------------------------------------------------------------------

test('unbekannter Tier: der Upsell-Banner bleibt weg', () => {
  useNotes.mockReturnValue({ tier: null, tierKnown: false });
  render(<ProBanner onPress={jest.fn()} />);

  // Nichts gerendert: weder Free- noch Basic-Hinweis.
  expect(screen.queryByText(/Pro/)).toBeNull();
  expect(screen.toJSON()).toBeNull();
});

test('bestaetigt Free: der Banner erscheint (der Fix versteckt ihn nicht dauerhaft)', () => {
  useNotes.mockReturnValue({ tier: 'free', tierKnown: true });
  render(<ProBanner onPress={jest.fn()} />);

  expect(screen.toJSON()).not.toBeNull();
});

test('bestaetigt Pro: kein Banner', () => {
  useNotes.mockReturnValue({ tier: 'pro', tierKnown: true });
  render(<ProBanner onPress={jest.fn()} />);

  expect(screen.toJSON()).toBeNull();
});

// ---------------------------------------------------------------------------
// SettingsScreen — kein Schloss, solange nichts bekannt ist
// ---------------------------------------------------------------------------

test('unbekannter Tier: keine Zeile behauptet eine Abo-Sperre', () => {
  useNotes.mockReturnValue({ tier: null, tierKnown: false });
  render(<SettingsScreen />);

  // "Erst ab …-Plan verfuegbar" waere eine Aussage, die wir noch nicht treffen koennen.
  expect(screen.queryByText(/Erst ab/)).toBeNull();
  // Stattdessen: normale Beschreibungen.
  expect(screen.getByText('Webseiten als Notiz speichern')).toBeTruthy();
});

test('unbekannter Tier: das Abo-Sublabel behauptet nicht "Free-Plan"', () => {
  useNotes.mockReturnValue({ tier: null, tierKnown: false });
  render(<SettingsScreen />);

  expect(screen.queryByText('Free-Plan')).toBeNull();
});
