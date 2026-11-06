// Rückkehr-Benachrichtigungen: reine Planungslogik (src/utils/reengagement.ts).
import {
  planReengagement,
  computeStats,
  moveOutOfQuietHours,
  hasReminderOnDay,
  renderText,
  isQuietTime,
  REENGAGEMENT_ID_PREFIX,
  PlanInput,
} from '../src/utils/reengagement';
import { i18n } from '../src/i18n';
import type { Note } from '../src/models/Note';
import type { Thread } from '../src/models/Thought';

const DAY = 24 * 60 * 60 * 1000;
const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const hm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

let seq = 0;
function note(over: Partial<Note> = {}): Note {
  seq++;
  return {
    id: `n${seq}`,
    title: `Geheimer Titel ${seq}`,
    content: `Vertraulicher Inhalt ${seq}`,
    category: 'Allgemein',
    isPinned: false,
    checklist: [],
    createdAt: new Date(2027, 2, 10, 12, 0).toISOString(),
    updatedAt: new Date(2027, 2, 10, 12, 0).toISOString(),
    reminderAt: null,
    reminderRecurrence: 'once',
    reminderWeekday: null,
    reminderDayOfMonth: null,
    notificationId: null,
    feedsThreads: false,
    archivedAt: null,
    ...over,
  };
}

function thread(noteIds: string[], status: Thread['status'] = 'active'): Thread {
  return {
    id: `t-${noteIds.join('-')}`, title: 'T', summary: '', status, isPinned: false,
    noteCount: noteIds.length, noteIds, lastSynthesizedAt: null,
    createdAt: new Date(2027, 0, 1).toISOString(), updatedAt: new Date(2027, 0, 1).toISOString(),
  };
}

// Mittwoch, 10. März 2027, 14:30 Ortszeit
const NOW = new Date(2027, 2, 10, 14, 30);

function input(over: Partial<PlanInput> = {}): PlanInput {
  return { enabled: true, now: NOW, lastOpenedAt: NOW, notes: [], threads: [], threadsAvailable: true, ...over };
}

describe('Stufen', () => {
  test('ohne konkreten Anlass: nur Stufe 1 (generisch), Stufe 2/3 entfallen', () => {
    const plan = planReengagement(input());
    expect(plan.map((p) => p.stage)).toEqual([1]);
    expect(plan[0].kind).toBe('generic');
    expect(ymd(plan[0].date)).toBe('2027-3-13'); // +3 Tage
    expect(hm(plan[0].date)).toBe('14:30');
    expect(plan[0].identifier).toBe(`${REENGAGEMENT_ID_PREFIX}1`);
  });

  test('mit Anlass: drei Stufen ab dem letzten Öffnen, je ≥ 7 Tage auseinander', () => {
    const notes = [note({ checklist: [{ id: 'c', text: 'x', checked: false }] }), note()];
    const plan = planReengagement(input({ notes }));
    expect(plan.map((p) => p.stage)).toEqual([1, 2, 3]);
    expect(ymd(plan[0].date)).toBe('2027-3-13'); // Tag 3
    // Stufe 2 (Tag 7) liegt nur 4 Tage nach Stufe 1 → auf Stufe 1 + 7 Tage geschoben (Tag 10)
    expect(ymd(plan[1].date)).toBe('2027-3-20');
    // Stufe 3 (Tag 14) → Stufe 2 + 7 Tage (Tag 17)
    expect(ymd(plan[2].date)).toBe('2027-3-27');
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].date.getTime() - plan[i - 1].date.getTime()).toBeGreaterThanOrEqual(7 * DAY - 2 * 60 * 60 * 1000);
    }
  });

  test('Basis ist "zuletzt geöffnet", nicht die Planungszeit', () => {
    const lastOpenedAt = new Date(2027, 2, 9, 11, 0);
    const plan = planReengagement(input({ lastOpenedAt }));
    expect(ymd(plan[0].date)).toBe('2027-3-12');
    expect(hm(plan[0].date)).toBe('11:00');
  });

  test('7-Tage-Grenze gilt auch gegenüber einer schon ausgelieferten Benachrichtigung', () => {
    const delivered = new Date(2027, 2, 8, 15, 0); // vor 2 Tagen
    const plan = planReengagement(input({ previouslyDelivered: [delivered] }));
    expect(plan[0].date.getTime()).toBeGreaterThanOrEqual(delivered.getTime() + 7 * DAY);
    expect(ymd(plan[0].date)).toBe('2027-3-15');
  });

  test('Schalter aus → nichts geplant', () => {
    const notes = [note({ checklist: [{ id: 'c', text: 'x', checked: false }] })];
    expect(planReengagement(input({ enabled: false, notes }))).toEqual([]);
  });
});

describe('Ruhezeit 21:00–9:00', () => {
  test('später Abend → 18:00 desselben Tages', () => {
    const d = moveOutOfQuietHours(new Date(2027, 2, 13, 22, 15), new Date(2027, 2, 10));
    expect(ymd(d)).toBe('2027-3-13');
    expect(hm(d)).toBe('18:00');
  });

  test('Nacht/früher Morgen → 10:00 desselben Tages', () => {
    const d = moveOutOfQuietHours(new Date(2027, 2, 13, 6, 40), new Date(2027, 2, 10));
    expect(ymd(d)).toBe('2027-3-13');
    expect(hm(d)).toBe('10:00');
  });

  test('18:00 läge vor dem frühesten Zeitpunkt → nächster Tag 10:00', () => {
    const d = moveOutOfQuietHours(new Date(2027, 2, 13, 23, 0), new Date(2027, 2, 13, 21, 30));
    expect(ymd(d)).toBe('2027-3-14');
    expect(hm(d)).toBe('10:00');
  });

  test('zuletzt um 23:10 geöffnet → Stufe 1 um 18:00, nie in der Ruhezeit', () => {
    const lastOpenedAt = new Date(2027, 2, 10, 23, 10);
    const notes = [note({ checklist: [{ id: 'c', text: 'x', checked: false }] }), note()];
    const plan = planReengagement(input({ now: lastOpenedAt, lastOpenedAt, notes }));
    expect(hm(plan[0].date)).toBe('18:00');
    for (const p of plan) expect(isQuietTime(p.date)).toBe(false);
  });

  test('zuletzt um 7:05 geöffnet → 10:00', () => {
    const lastOpenedAt = new Date(2027, 2, 10, 7, 5);
    const plan = planReengagement(input({ now: lastOpenedAt, lastOpenedAt }));
    expect(ymd(plan[0].date)).toBe('2027-3-13');
    expect(hm(plan[0].date)).toBe('10:00');
  });
});

describe('Kollision mit Notiz-Erinnerung', () => {
  test('einmalige Erinnerung am Stufen-Tag → nächster freier Tag', () => {
    const notes = [note({ reminderAt: new Date(2027, 2, 13, 8, 0).toISOString() })];
    const plan = planReengagement(input({ notes }));
    expect(ymd(plan[0].date)).toBe('2027-3-14');
  });

  test('mehrere belegte Tage hintereinander werden übersprungen', () => {
    const notes = [
      note({ reminderAt: new Date(2027, 2, 13, 8, 0).toISOString() }),
      note({ reminderAt: new Date(2027, 2, 14, 19, 0).toISOString() }),
    ];
    expect(ymd(planReengagement(input({ notes }))[0].date)).toBe('2027-3-15');
  });

  test('wöchentliche Erinnerung belegt ihren Wochentag (13.3.2027 = Samstag)', () => {
    const notes = [note({
      reminderAt: new Date(2027, 2, 6, 9, 0).toISOString(),
      reminderRecurrence: 'weekly', reminderWeekday: 7,
    })];
    expect(hasReminderOnDay(notes, new Date(2027, 2, 13))).toBe(true);
    expect(ymd(planReengagement(input({ notes }))[0].date)).toBe('2027-3-14');
  });

  test('monatliche Erinnerung am 31. belegt den letzten Monatstag', () => {
    const notes = [note({
      reminderAt: new Date(2027, 0, 31, 9, 0).toISOString(),
      reminderRecurrence: 'monthly', reminderDayOfMonth: 31,
    })];
    expect(hasReminderOnDay(notes, new Date(2027, 3, 30))).toBe(true);
    expect(hasReminderOnDay(notes, new Date(2027, 3, 29))).toBe(false);
  });

  test('archivierte Notizen und vergangene Einmal-Erinnerungen an anderen Tagen zählen nicht', () => {
    const notes = [
      note({ reminderAt: new Date(2027, 2, 13, 8, 0).toISOString(), archivedAt: NOW.toISOString() }),
      note({ reminderAt: new Date(2027, 2, 1, 8, 0).toISOString() }),
    ];
    expect(ymd(planReengagement(input({ notes }))[0].date)).toBe('2027-3-13');
  });

  test('tägliche Erinnerung belegt jeden Tag → keine Rückkehr-Benachrichtigung', () => {
    const notes = [note({ reminderAt: new Date(2027, 2, 1, 8, 0).toISOString(), reminderRecurrence: 'daily' })];
    expect(planReengagement(input({ notes }))).toEqual([]);
  });
});

describe('Inhalt', () => {
  test('Statistik: neue Notizen ohne Thread (7 Tage) + offene Checklisten-Punkte aktiver Notizen', () => {
    const recentA = note({ createdAt: new Date(2027, 2, 9).toISOString() });
    const recentInThread = note({ createdAt: new Date(2027, 2, 9).toISOString() });
    const recentInArchivedThread = note({ createdAt: new Date(2027, 2, 8).toISOString() });
    const old = note({ createdAt: new Date(2027, 1, 1).toISOString() });
    const archived = note({
      createdAt: new Date(2027, 2, 9).toISOString(), archivedAt: NOW.toISOString(),
      checklist: [{ id: 'a', text: 'x', checked: false }],
    });
    const withList = note({
      createdAt: new Date(2027, 1, 1).toISOString(),
      checklist: [
        { id: 'a', text: 'x', checked: false },
        { id: 'b', text: 'y', checked: true },
        { id: 'c', text: 'z', checked: false },
      ],
    });
    const stats = computeStats(
      [recentA, recentInThread, recentInArchivedThread, old, archived, withList],
      [thread([recentInThread.id]), thread([recentInArchivedThread.id], 'archived')],
      NOW,
    );
    expect(stats).toEqual({ unthreadedRecent: 1, openChecklistItems: 2 });
  });

  test('"Notizen ohne Thread" führt in den Threads-Tab, Checklisten in die Notizen', () => {
    const notes = [note(), note(), note({ checklist: [{ id: 'c', text: 'x', checked: false }] })];
    const plan = planReengagement(input({ notes }));
    expect(plan[0]).toMatchObject({ kind: 'unthreaded', count: 3, target: 'Threads' });
    expect(plan[1]).toMatchObject({ kind: 'openChecklist', count: 1, target: 'Notizen' });
  });

  test('ohne erreichbare Threads kein "ohne Thread"-Anlass', () => {
    const plan = planReengagement(input({ notes: [note(), note()], threadsAvailable: false }));
    expect(plan.map((p) => p.kind)).toEqual(['generic']);
  });

  test.each(['de', 'en'] as const)('Texte (%s) enthalten nie Titel oder Inhalte, nur Zahlen, pluralisiert', (locale) => {
    const prev = i18n.locale;
    i18n.locale = locale;
    try {
      const notes = [
        note(), note(),
        note({ checklist: [{ id: 'c', text: 'Geheimer Punkt', checked: false }] }),
      ];
      const plan = planReengagement(input({ notes }));
      expect(plan.length).toBe(3);
      const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, o);
      for (const p of plan) {
        const { title, body } = renderText(p, t);
        const text = `${title} ${body}`;
        expect(text).not.toMatch(/missing|\[/i);
        for (const n of notes) {
          expect(text).not.toContain(n.title);
          expect(text).not.toContain(n.content);
        }
        expect(text).not.toContain('Geheimer Punkt');
        if (p.kind !== 'generic') expect(body).toContain(String(p.count));
      }
      const one = renderText({ ...plan[1], count: 1 }, t).body;
      const many = renderText({ ...plan[1], count: 4 }, t).body;
      expect(one).not.toBe(many.replace('4', '1'));
    } finally {
      i18n.locale = prev;
    }
  });
});
