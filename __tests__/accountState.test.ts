/**
 * Lokal-first-Zustandsmaschine: `local` → `pending-confirmation` → `secured`.
 *
 * Kernzusage: der Zustand wird strikt aus `email_confirmed_at` abgeleitet, nie
 * aus einem lokal gesetzten Status-Flag, und ohne bestaetigte E-Mail gibt es
 * keine Sync-UID.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

let mockCurrentUser: any = null;

jest.mock('../src/sync/supabaseClient', () => ({
  getSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: mockCurrentUser } }) },
  }),
}));

const {
  deriveStateFromUser, resolveAccountState, getSyncUserId,
  savePendingEmail, loadPendingEmail, clearPendingEmail,
  isLegacyAnonymous,
} = require('../src/sync/accountState') as typeof import('../src/sync/accountState');

beforeEach(async () => {
  await AsyncStorage.clear();
  mockCurrentUser = null;
});

const confirmed = { id: 'u1', email: 'a@b.de', email_confirmed_at: '2026-01-01T00:00:00.000Z' };
const unconfirmed = { id: 'u2', email: 'c@d.de', email_confirmed_at: null };

describe('deriveStateFromUser', () => {
  test('kein User → local', () => {
    expect(deriveStateFromUser(null)).toBe('local');
  });

  test('unbestaetigte E-Mail → pending-confirmation, NICHT secured', () => {
    expect(deriveStateFromUser(unconfirmed as any)).toBe('pending-confirmation');
  });

  test('bestaetigte E-Mail → secured', () => {
    expect(deriveStateFromUser(confirmed as any)).toBe('secured');
  });

  test('anonymer User aus dem alten Modell zaehlt nicht als Konto', () => {
    const anon = { id: 'anon', is_anonymous: true, email_confirmed_at: null };
    expect(isLegacyAnonymous(anon as any)).toBe(true);
    expect(deriveStateFromUser(anon as any)).toBe('local');
  });
});

describe('getSyncUserId — Sync-Gate', () => {
  test('ohne User gibt es keine Sync-UID', async () => {
    expect(await getSyncUserId()).toBeNull();
  });

  test('bei ausstehender Bestaetigung gibt es KEINE Sync-UID', async () => {
    mockCurrentUser = unconfirmed;
    expect(await getSyncUserId()).toBeNull();
  });

  test('erst nach der Bestaetigung gibt es eine Sync-UID', async () => {
    mockCurrentUser = confirmed;
    expect(await getSyncUserId()).toBe('u1');
  });
});

describe('resolveAccountState', () => {
  test('Session gewinnt immer gegen den lokalen Merker', async () => {
    // Merker steht noch von der Registrierung, die Bestaetigung ist inzwischen da.
    await savePendingEmail('alt@example.com');
    mockCurrentUser = confirmed;

    const snapshot = await resolveAccountState();

    expect(snapshot.state).toBe('secured');
    expect(snapshot.email).toBe('a@b.de');
    // Der erledigte Merker wird dabei aufgeraeumt.
    expect(await loadPendingEmail()).toBeNull();
  });

  test('ohne Session rettet der Merker die Registrierung ueber den Neustart', async () => {
    // Supabase gibt bei aktivierter Bestaetigungspflicht keine Session aus.
    await savePendingEmail('neu@example.com');
    mockCurrentUser = null;

    const snapshot = await resolveAccountState();

    expect(snapshot.state).toBe('pending-confirmation');
    expect(snapshot.email).toBe('neu@example.com');
    expect(snapshot.userId).toBeNull();
  });

  test('ohne Session und ohne Merker → local', async () => {
    const snapshot = await resolveAccountState();
    expect(snapshot.state).toBe('local');
    expect(snapshot.userId).toBeNull();
  });

  test('nach dem Abmelden (Merker geloescht) ist der Zustand wieder local', async () => {
    await savePendingEmail('x@y.de');
    await clearPendingEmail();
    mockCurrentUser = null;

    expect((await resolveAccountState()).state).toBe('local');
  });
});
