/**
 * Der Bookmarklet-Screen in der App erklaert, dass die Funktion nur am Laptop/Computer
 * funktioniert, und wie man sie dort aktiviert (Webapp-Seite oeffnen, anmelden,
 * Button in die Lesezeichen-Leiste ziehen).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});

const Clipboard = require('expo-clipboard') as { setStringAsync: jest.Mock };
const SettingsBookmarkletScreen = require('../src/screens/SettingsBookmarkletScreen').default;

const renderScreen = () => render(<PaperProvider><SettingsBookmarkletScreen /></PaperProvider>);

test('weist darauf hin, dass das Bookmarklet nur am Laptop/Computer funktioniert', () => {
  renderScreen();
  expect(screen.getByText('Nur für Laptop und Computer')).toBeTruthy();
  expect(screen.getByText(/Auf dem Handy funktioniert es nicht/)).toBeTruthy();
});

test('erklaert die Aktivierung in drei Schritten mit der Webapp-Adresse', () => {
  renderScreen();
  expect(screen.getByText('So aktivierst du es am Computer')).toBeTruthy();
  expect(screen.getByText('Seite am Computer öffnen')).toBeTruthy();
  expect(screen.getByText('Mit deinem Velm-Konto anmelden')).toBeTruthy();
  expect(screen.getByText('Button in die Lesezeichen-Leiste ziehen')).toBeTruthy();
  expect(screen.getByText('https://www.velmnote.com/bookmarklet')).toBeTruthy();
});

test('"Link kopieren" kopiert die Adresse der Bookmarklet-Seite', async () => {
  renderScreen();
  fireEvent.press(screen.getByText('Link kopieren'));
  await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://www.velmnote.com/bookmarklet'));
});

test('kein Text bleibt als roher i18n-Key stehen', () => {
  renderScreen();
  expect(screen.queryByText(/settingsBookmarklet\./)).toBeNull();
});
