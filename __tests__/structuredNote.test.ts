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
};

test('Checkliste, Kategorie und Herkunft werden uebernommen, Threads bleiben aus', () => {
  const note = structuredToNote(base, NOW);
  expect(note.title).toBe('Einkauf');
  expect(note.category).toBe('Einkauf');
  expect(note.checklist.map((c) => [c.text, c.checked])).toEqual([['Milch', false], ['Eier', false]]);
  expect(new Set(note.checklist.map((c) => c.id)).size).toBe(2);
  expect(note.feedsThreads).toBe(false);
  expect(note.source).toBe('voice');
  expect(note.reminderAt).toBeNull();
});

test('einmalige Erinnerung: lokale Zeit wird zum ISO-Zeitpunkt', () => {
  const note = structuredToNote(
    { ...base, reminder: { at: '2026-09-25T18:00', recurrence: 'once', weekday: null, dayOfMonth: null } },
    NOW,
  );
  expect(note.reminderAt).toBe(new Date(2026, 8, 25, 18, 0).toISOString());
  expect(note.reminderRecurrence).toBe('once');
  expect(note.reminderWeekday).toBeNull();
  expect(note.reminderDayOfMonth).toBeNull();
});

test('einmalige Erinnerung in der Vergangenheit wird verworfen', () => {
  const note = structuredToNote(
    { ...base, reminder: { at: '2026-09-24T09:00', recurrence: 'once', weekday: null, dayOfMonth: null } },
    NOW,
  );
  expect(note.reminderAt).toBeNull();
  expect(note.reminderRecurrence).toBe('once');
});

test('weekly: nur Wochentag, kein Monatstag', () => {
  const note = structuredToNote(
    { ...base, reminder: { at: '2026-09-28T08:00', recurrence: 'weekly', weekday: 2, dayOfMonth: 5 } },
    NOW,
  );
  expect(note.reminderRecurrence).toBe('weekly');
  expect(note.reminderWeekday).toBe(2);
  expect(note.reminderDayOfMonth).toBeNull();
});

test('monthly: nur Monatstag, kein Wochentag', () => {
  const note = structuredToNote(
    { ...base, reminder: { at: '2026-10-01T09:00', recurrence: 'monthly', weekday: 3, dayOfMonth: 1 } },
    NOW,
  );
  expect(note.reminderRecurrence).toBe('monthly');
  expect(note.reminderDayOfMonth).toBe(1);
  expect(note.reminderWeekday).toBeNull();
});

test('daily: weder Wochentag noch Monatstag', () => {
  const note = structuredToNote(
    { ...base, reminder: { at: '2026-09-25T07:30', recurrence: 'daily', weekday: 4, dayOfMonth: 2 } },
    NOW,
  );
  expect(note.reminderRecurrence).toBe('daily');
  expect(note.reminderWeekday).toBeNull();
  expect(note.reminderDayOfMonth).toBeNull();
});

test('kaputtes Datum → keine Erinnerung', () => {
  const note = structuredToNote(
    { ...base, reminder: { at: 'morgen', recurrence: 'once', weekday: null, dayOfMonth: null } },
    NOW,
  );
  expect(note.reminderAt).toBeNull();
});
