/**
 * Cooldown am "Erneut senden"-Button.
 *
 * Supabase laesst pro Adresse nur alle 60s eine Auth-Mail zu. Vorher landete
 * diese Sperre als englischer Roh-Toast auf dem Schirm ("For security purposes,
 * you can only request this after 47 seconds") — leicht zu uebersehen, waehrend
 * man auf eine Mail wartet. Erwartung: die Restzeit laeuft sichtbar am Button.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockResend = jest.fn();

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/context/NotesContext', () => ({
  useNotes: () => ({
    resyncForUser: jest.fn(async () => {}),
    refreshSubscription: jest.fn(async () => {}),
    flushPending: jest.fn(async () => {}),
    uploadLocalNotes: jest.fn(async () => {}),
    initialUploadPending: false,
    detachSync: jest.fn(),
  }),
}));
jest.mock('../src/context/ThoughtsContext', () => ({
  useThoughts: () => ({ resyncForUser: jest.fn(async () => {}), detachSync: jest.fn(async () => {}) }),
}));
jest.mock('../src/context/LanguageContext', () => {
  const { t } = require('../src/i18n');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('../src/sync/userId', () => ({ clearUserIdCache: jest.fn() }));
jest.mock('../src/sync/supabaseClient', () => ({
  getSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
      resend: mockResend,
      verifyOtp: jest.fn(),
      signInWithPassword: jest.fn(),
    },
  }),
}));

const SettingsKontoScreen = require('../src/screens/SettingsKontoScreen').default;
const { t } = require('../src/i18n');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  await AsyncStorage.setItem('@notizapp_pending_email', 'louis@example.com');
});

test('nach erfolgreichem Versand laeuft der Countdown am Button', async () => {
  mockResend.mockResolvedValue({ error: null });

  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));

  fireEvent.press(screen.getByText(t('settingsKonto.resendConfirmation')));

  await screen.findByText(t('settingsKonto.resendCooldown', { seconds: 60 }));
  // Gesperrt: ein zweiter Druck loest keinen weiteren Versand aus.
  fireEvent.press(screen.getByText(t('settingsKonto.resendCooldown', { seconds: 60 })));
  expect(mockResend).toHaveBeenCalledTimes(1);
});

test('Rate-Limit-Fehler wandert in den Countdown statt in einen Roh-Toast', async () => {
  mockResend.mockResolvedValue({
    error: { message: 'For security purposes, you can only request this after 47 seconds.' },
  });

  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));

  fireEvent.press(screen.getByText(t('settingsKonto.resendConfirmation')));

  // Die Restzeit kommt aus der Supabase-Meldung (47), nicht aus dem 60s-Default.
  // Der Countdown tickt bereits, daher auf den Bereich statt den exakten Wert pruefen.
  await screen.findByText(/4[0-7]s/);
  expect(screen.queryByText(/For security purposes/)).toBeNull();
});

test('andere Fehler bleiben ein Toast', async () => {
  mockResend.mockResolvedValue({ error: { message: 'Network unreachable' } });

  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));

  fireEvent.press(screen.getByText(t('settingsKonto.resendConfirmation')));

  await screen.findByText(t('settingsKonto.toastErrorPrefix') + 'Network unreachable');
  // Kein Cooldown: der Button bleibt sofort wieder nutzbar.
  expect(screen.getByText(t('settingsKonto.resendConfirmation'))).toBeTruthy();
});
