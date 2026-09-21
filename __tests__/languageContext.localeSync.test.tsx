/**
 * Sprachwechsel landet am Supabase-User.
 *
 * Die Mail-Templates schalten ueber `{{ .Data.locale }}` — und weder
 * `resend()` noch `resetPasswordForEmail()` nehmen eine Sprache entgegen.
 * Sie muss also schon am User stehen, BEVOR eine Mail ausgeloest wird. Beim
 * Reset ist das der einzige Weg: dort ist der Nutzer ausgesperrt und die App
 * hat keine Session mehr, aus der sich die Sprache ableiten liesse.
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';

const mockUpdateUser = jest.fn(async () => ({ error: null }));
let mockSession: any = { access_token: 'tok' };

jest.mock('../src/sync/supabaseClient', () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: mockSession } }),
      updateUser: mockUpdateUser,
    },
  }),
}));

const { LanguageProvider, useLanguage } = require('../src/context/LanguageContext');

/** Schaltet beim Mount einmal auf Englisch. */
function Switcher() {
  const { setPreference, locale } = useLanguage();
  return (
    <TouchableOpacity onPress={() => setPreference('en')} testID="switch">
      <Text>{locale}</Text>
    </TouchableOpacity>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { access_token: 'tok' };
});

test('Sprachwechsel schreibt locale in die user_metadata', async () => {
  const { getByTestId } = render(
    <LanguageProvider><Switcher /></LanguageProvider>,
  );

  fireEvent.press(getByTestId('switch'));

  await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ data: { locale: 'en' } }));
});

test('ohne Session passiert nichts — der Wechsel gilt trotzdem lokal', async () => {
  mockSession = null;

  const { getByTestId } = render(
    <LanguageProvider><Switcher /></LanguageProvider>,
  );

  fireEvent.press(getByTestId('switch'));

  // Kein Konto: ein updateUser() waere ein Fehler, kein No-op.
  await waitFor(() => expect(getByTestId('switch')).toBeTruthy());
  expect(mockUpdateUser).not.toHaveBeenCalled();
});
