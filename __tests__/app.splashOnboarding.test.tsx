// Startbildschirm darf nie hängen bleiben — auch nicht im Onboarding-Pfad (fehlendes
// @notizapp_onboarding_done, z. B. nach Admin „Onboarding zurücksetzen"). Früher hing das
// Ausblenden dort am onLayout der Root-View, das in Expo Go nicht ankam: Logo für immer.
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => {}),
  hideAsync: jest.fn(async () => {}),
}));
let mockFontsReady = true;
jest.mock('expo-font', () => ({ useFonts: () => [mockFontsReady, null] }));
jest.mock('@expo-google-fonts/inter', () => ({}));
jest.mock('@expo-google-fonts/instrument-serif', () => ({}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: () => {} })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
}));
jest.mock('./../src/screens/onboarding', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, ONBOARDING_KEY: '@notizapp_onboarding_done', default: () => React.createElement(Text, null, 'ONBOARDING') };
});
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return { GestureHandlerRootView: View };
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/navigation/AppNavigator', () => () => null);
jest.mock('../src/components/ShareHandler', () => () => null);
jest.mock('../src/components/ReengagementBootstrap', () => () => null);
jest.mock('../src/context/NotesContext', () => ({
  NotesProvider: ({ children }: { children: unknown }) => children,
  useNotes: () => ({ loading: true, rescheduleAllReminders: async () => {} }),
}));
jest.mock('../src/context/ThoughtsContext', () => ({
  ThoughtsProvider: ({ children }: { children: unknown }) => children,
}));

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import App from '../App';
import { __resetSplashForTests, SPLASH_FALLBACK_MS } from '../src/utils/splash';

beforeEach(async () => {
  await AsyncStorage.clear();
  (SplashScreen.hideAsync as jest.Mock).mockClear();
  __resetSplashForTests();
  mockFontsReady = true;
});

afterEach(() => {
  jest.useRealTimers();
});

test('Onboarding-Flag fehlt → Onboarding wird gezeigt und der Startbildschirm ausgeblendet (ohne onLayout)', async () => {
  render(<App />);
  await waitFor(() => expect(screen.getByText('ONBOARDING')).toBeTruthy());
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
});

test('Notbremse läuft ab Mount: hängen die Schriften, wird der Startbildschirm trotzdem ausgeblendet', async () => {
  jest.useFakeTimers();
  mockFontsReady = false;
  await AsyncStorage.setItem('@notizapp_onboarding_done', 'true');
  render(<App />);
  await act(async () => { await Promise.resolve(); });
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(SPLASH_FALLBACK_MS); });
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
});

test('normaler Pfad: Ausblenden höchstens einmal, auch wenn Gate und Notbremse beide feuern', async () => {
  jest.useFakeTimers();
  await AsyncStorage.setItem('@notizapp_onboarding_done', 'true');
  render(<App />);
  await act(async () => { jest.advanceTimersByTime(SPLASH_FALLBACK_MS * 2); });
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
});
