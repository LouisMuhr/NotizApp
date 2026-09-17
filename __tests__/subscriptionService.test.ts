/**
 * Phase-2-Tests: Client-seitige Limit-Berechnung (E5, E6, E7).
 * Entscheidung 14: der Client soll nur den Server-Wert anzeigen.
 * Entscheidung 13: Uhrzeit statt Tage anzeigen.
 */
jest.mock('../src/sync/supabaseClient', () => ({ getSupabase: jest.fn() }));
jest.mock('react-native', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('../src/i18n', () => ({ t: (k: string) => k }));

const { getSupabase } = require('../src/sync/supabaseClient') as { getSupabase: jest.Mock };
const { subscriptionService } = require('../src/sync/subscriptionService') as typeof import('../src/sync/subscriptionService');

function withProfile(profile: Record<string, unknown>) {
  getSupabase.mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'u1', created_at: '', ...profile }, error: null }) }) }) }),
  });
}

afterEach(() => { jest.useRealTimers(); });

test('E5: Limit-Status haengt nicht von der Geraeteuhr ab (Server sagt: 23 h gesperrt)', async () => {
  const serverNow = Date.parse('2026-09-16T12:00:00Z');
  const lastRun = new Date(serverNow - 1 * 3_600_000).toISOString(); // vor 1 h → Basic: noch 23 h gesperrt
  withProfile({ tier: 'basic', ai_last_run: lastRun, ai_runs_today: 1, ai_day_reset: '2026-09-16' });

  jest.useFakeTimers({ now: serverNow });
  const correctClock = await subscriptionService.getStatus();
  expect(correctClock.nextAllowedAt).not.toBeNull();

  // Geraeteuhr laeuft 2 Tage vor
  jest.useFakeTimers({ now: serverNow + 2 * 86_400_000 });
  const skewedClock = await subscriptionService.getStatus();

  // Erwartung (Entscheidung 14): gleiche Aussage wie mit korrekter Uhr, weil der Server entscheidet
  expect(skewedClock.nextAllowedAt?.toISOString()).toBe(correctClock.nextAllowedAt?.toISOString());
});

test('E6: Pro-Limit um 23:30 UTC — naechster Lauf ist in 30 Minuten, nicht "in 1 Tag"', async () => {
  jest.useFakeTimers({ now: Date.parse('2026-09-16T23:30:00Z') });
  withProfile({ tier: 'pro', ai_last_run: '2026-09-16T20:00:00Z', ai_runs_today: 10, ai_day_reset: '2026-09-16' });

  const { nextAllowedAt } = await subscriptionService.getStatus();
  expect(nextAllowedAt?.toISOString()).toBe('2026-09-17T00:00:00.000Z'); // Reset Mitternacht UTC (ok)

  // So rechnet ThreadsScreen.daysUntil() das Label "In {{count}} Tag(en) verfuegbar":
  const daysLabel = Math.ceil((nextAllowedAt!.getTime() - Date.now()) / 86_400_000);
  const minutesReal = Math.round((nextAllowedAt!.getTime() - Date.now()) / 60_000);
  expect(minutesReal).toBe(30);
  // Erwartung (Entscheidung 13): Anzeige in Uhrzeit/Minuten, nicht in aufgerundeten Tagen
  expect(daysLabel).not.toBe(1);
});

test('E7: Free-Limit endet zu einer Uhrzeit (14:32), Datum allein reicht als Anzeige nicht', async () => {
  jest.useFakeTimers({ now: Date.parse('2026-09-16T10:00:00Z') });
  withProfile({ tier: 'free', ai_last_run: '2026-09-10T14:32:00Z', ai_runs_today: 1, ai_day_reset: '2026-09-10' });

  const { nextAllowedAt } = await subscriptionService.getStatus();
  expect(nextAllowedAt?.toISOString()).toBe('2026-09-17T14:32:00.000Z');

  // SettingsAboScreen formatiert mit toLocaleDateString(weekday, day, month) → keine Uhrzeit.
  const shown = nextAllowedAt!.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  expect(shown).toMatch(/\d{1,2}:\d{2}/); // Erwartung: Uhrzeit sichtbar (Entscheidung 13)
});
