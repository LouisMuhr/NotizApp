/**
 * Abo-Screen: Kauf-Ergebnis wird als Papier-Dialog gezeigt (kein Alert),
 * Abbruch zeigt nichts, ohne Konto fuehrt der Dialog zum Konto-Screen.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

jest.mock('../src/context/NotesContext', () => ({ useNotes: jest.fn() }));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('../src/sync/supabaseClient', () => ({ getSupabase: () => null }));
jest.mock('../src/sync/subscriptionService', () => ({
  subscriptionService: { openUpgradeFlow: jest.fn(), restorePurchases: jest.fn() },
}));

const { useNotes } = require('../src/context/NotesContext') as { useNotes: jest.Mock };
const { subscriptionService } = require('../src/sync/subscriptionService') as {
  subscriptionService: { openUpgradeFlow: jest.Mock; restorePurchases: jest.Mock };
};
const SettingsAboScreen = require('../src/screens/SettingsAboScreen').default;

const refreshSubscription = jest.fn(async () => {});
const navigation = { navigate: jest.fn() };

function renderScreen() {
  return render(
    <PaperProvider>
      <SettingsAboScreen navigation={navigation} />
    </PaperProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useNotes.mockReturnValue({ tier: 'free', nextAllowedAt: null, refreshSubscription });
});

test('ohne Konto: Dialog mit Weg zum Konto', async () => {
  subscriptionService.openUpgradeFlow.mockResolvedValue({ kind: 'needs_account' });
  renderScreen();
  fireEvent.press(screen.getByText('Auf Basic upgraden'));
  await waitFor(() => expect(screen.getByText('Konto nötig')).toBeTruthy());
  fireEvent.press(screen.getByText('Zum Konto'));
  expect(navigation.navigate).toHaveBeenCalledWith('SettingsKonto');
});

test('erfolgreicher Kauf: Tier neu laden + Danke-Dialog', async () => {
  subscriptionService.openUpgradeFlow.mockResolvedValue({ kind: 'purchased', synced: true });
  renderScreen();
  fireEvent.press(screen.getByText('Auf Pro upgraden'));
  await waitFor(() => expect(screen.getByText('Dein Plan ist freigeschaltet.')).toBeTruthy());
  expect(subscriptionService.openUpgradeFlow).toHaveBeenCalledWith('pro');
  expect(refreshSubscription).toHaveBeenCalled();
});

test('Abbruch im Store: kein Dialog', async () => {
  subscriptionService.openUpgradeFlow.mockResolvedValue({ kind: 'cancelled' });
  renderScreen();
  fireEvent.press(screen.getByText('Auf Basic upgraden'));
  await waitFor(() => expect(subscriptionService.openUpgradeFlow).toHaveBeenCalled());
  expect(screen.queryByText('Kauf nicht möglich')).toBeNull();
  expect(screen.queryByText('Danke!')).toBeNull();
});
