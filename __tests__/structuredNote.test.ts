/**
 * KI-Ergebnis → Notiz-Felder: Erinnerung aus lokaler Geraetezeit, Wochentag/
 * Monatstag nur passend zur Wiederholung (wie im Editor), nie in Threads.
 */
import { structuredToNote } from '../src/utils/structuredNote';
import type { StructuredNoteResult } from '../src/sync/parseNote';

const NOW = new Date(2026, 8, 24, 10, 0); // 24.09.2026 10:00 lokal

const base: StructuredNoteResult = {
  title: 'Einkauf',
  content: 'Fuer das Wochenende',
  checklist: ['Milch', 'Eier'],
  category: 'Einkauf',
  reminder: null,
  reminderAmbiguous: false,
};

test('Checkliste, Kategorie und Herkunft werden uebernommen, Threads bleiben aus', () => {
  const { draft } = structuredToNote(base, NOW);
  expect(draft.title).toBe('Einkauf');
  expect(draft.category).toBe('Einkauf');
  expect(draft.checklist.map((c) => [c.text, c.checked])).toEqual([['Milch', false], ['Eier', false]]);
  expect(new Set(draft.checklist.map((c) => c.id)).size).toBe(2);
  expect(draft.feedsThreads).toBe(false);
  expect(draft.source).toBe('voice');
  expect(draft.reminderAt).toBeNull();
});

test('einmalige Erinnerung: lokale Zeit wird zum ISO-Zeitpunkt', () => {
  const { draft } = structuredToNote(
    { ...base, reminder: { at: '2026-09-25T18:00', recurrence: 'once', weekday: null, dayOfMonth: null } },
    NOW,
  );
  expect(draft.reminderAt).toBe(new Date(2026, 8, 25, 18, 0).toISOString());
  expect(draft.reminderRecurrence).toBe('once');
  expect(draft.reminderWeekday).toBeNull();
  expect(draft.reminderDayOfMonth).toBeNull();
});

test('einmalige Erinnerung in der Vergangenheit wird verworfen', () => {
  const { draft } = structuredToNote(
    { ...base, reminder: { at: '2026-09-24T09:00', recurrence: 'once', weekday: null, dayOfMonth: null } },
    NOW,
  );
  expect(draft.reminderAt).toBeNull();
  expect(draft.reminderRecurrence).toBe('once');
});

test('weekly: nur Wochentag, kein Monatstag', () => {
  const { draft } = structuredToNote(
    { ...base, reminder: { at: '2026-09-28T08:00', recurrence: 'weekly', weekday: 2, dayOfMonth: 5 } },
    NOW,
  );
  expect(draft.reminderRecurrence).toBe('weekly');
  expect(draft.reminderWeekday).toBe(2);
  expect(draft.reminderDayOfMonth).toBeNull();
});

test('monthly: nur Monatstag, kein Wochentag', () => {
  const { draft } = structuredToNote(
    { ...base, reminder: { at: '2026-10-01T09:00', recurrence: 'monthly', weekday: 3, dayOfMonth: 1 } },
    NOW,
  );
  expect(draft.reminderRecurrence).toBe('monthly');
  expect(draft.reminderDayOfMonth).toBe(1);
  expect(draft.reminderWeekday).toBeNull();
});

test('daily: weder Wochentag noch Monatstag', () => {
  const { draft } = structuredToNote(
    { ...base, reminder: { at: '2026-09-25T07:30', recurrence: 'daily', weekday: 4, dayOfMonth: 2 } },
    NOW,
  );
  expect(draft.reminderRecurrence).toBe('daily');
  expect(draft.reminderWeekday).toBeNull();
  expect(draft.reminderDayOfMonth).toBeNull();
});

test('kaputtes Datum → keine Erinnerung', () => {
  const { draft } = structuredToNote(
    { ...base, reminder: { at: 'morgen', recurrence: 'once', weekday: null, dayOfMonth: null } },
    NOW,
  );
  expect(draft.reminderAt).toBeNull();
});

test('mehrdeutige Erinnerung (mehrere Zeitpunkte im Diktat) wird durchgereicht', () => {
  const { draft, reminderAmbiguous } = structuredToNote(
    { ...base, reminder: null, reminderAmbiguous: true },
    NOW,
  );
  expect(draft.reminderAt).toBeNull();
  expect(reminderAmbiguous).toBe(true);
});

test('reminderAmbiguous ist false, wenn ein Reminder gesetzt wurde', () => {
  const { reminderAmbiguous } = structuredToNote(
    { ...base, reminder: { at: '2026-09-25T18:00', recurrence: 'once', weekday: null, dayOfMonth: null } },
    NOW,
  );
  expect(reminderAmbiguous).toBe(false);
});
