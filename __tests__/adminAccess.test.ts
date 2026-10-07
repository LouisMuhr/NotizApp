/**
 * Admin = bestaetigtes Konto mit der Admin-Adresse. Alles andere (anderes Konto,
 * unbestaetigte Registrierung, anonymer Alt-User, niemand) ist kein Admin.
 */
import type { User } from '@supabase/supabase-js';

jest.mock('../src/sync/supabaseClient', () => ({ getSupabase: () => null }));

const { isAdminUser, ADMIN_EMAIL } = require('../src/sync/adminAccess') as typeof import('../src/sync/adminAccess');

const user = (over: Partial<User>): User =>
  ({ id: 'u1', email: ADMIN_EMAIL, email_confirmed_at: '2026-01-01T00:00:00Z', ...over }) as User;

test('bestaetigtes Admin-Konto ist Admin', () => {
  expect(isAdminUser(user({}))).toBe(true);
});

test('Gross-/Kleinschreibung und Leerzeichen der Adresse spielen keine Rolle', () => {
  expect(isAdminUser(user({ email: '  LouisMuhr8@Gmail.com ' }))).toBe(true);
});

test('anderes Konto ist kein Admin', () => {
  expect(isAdminUser(user({ email: 'jemand@example.com' }))).toBe(false);
});

test('unbestaetigte Registrierung mit Admin-Adresse ist kein Admin', () => {
  expect(isAdminUser(user({ email_confirmed_at: undefined }))).toBe(false);
});

test('anonymer Alt-User und kein User sind kein Admin', () => {
  expect(isAdminUser(user({ is_anonymous: true, email: undefined }))).toBe(false);
  expect(isAdminUser(null)).toBe(false);
});
