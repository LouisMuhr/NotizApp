// Rückkehr-Benachrichtigungen: reine Planungslogik (src/utils/reengagement.ts).
import {
  planReengagement,
  computeStats,
  moveOutOfQuietHours,
  reminderTimesOnDay,
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

  test('mit Anlass: drei Stufen exakt 3 / 7 / 14 Tage nach dem letzten Öffnen, gleiche Uhrzeit', () => {
    const notes = [note({ checklist: [{ id: 'c', text: 'x', checked: false }] }), note()];
    const plan = planReengagement(input({ notes }));
    expect(plan.map((p) => p.stage)).toEqual([1, 2, 3]);
    expect(plan.map((p) => ymd(p.date))).toEqual(['2027-3-13', '2027-3-17', '2027-3-24']);
    expect(plan.map((p) => hm(p.date))).toEqual(['14:30', '14:30', '14:30']);
  });

  test('Basis ist "zuletzt geöffnet", nicht die Planungszeit', () => {
    const lastOpenedAt = new Date(2027, 2, 9, 11, 0);
    const plan = planReengagement(input({ lastOpenedAt }));
    expect(ymd(plan[0].date)).toBe('2027-3-12');
    expect(hm(plan[0].date)).toBe('11:00');
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

describe('Notiz-Erinnerungen (Abstand ≥ 2 h am selben Tag)', () => {
  const checklistNote = () => note({ checklist: [{ id: 'c', text: 'x', checked: false }] });

  test('Erinnerung am Stufen-Tag, aber weit weg → keine Verschiebung', () => {
    const notes = [note({ reminderAt: new Date(2027, 2, 13, 8, 0).toISOString() })];
    const d = planReengagement(input({ notes }))[0].date;
    expect(ymd(d)).toBe('2027-3-13');
    expect(hm(d)).toBe('14:30');
  });

  test('Erinnerung 1 h nach dem Zeitpunkt → auf 2 h davor geschoben (nächstgelegener Punkt)', () => {
    const notes = [note({ reminderAt: new Date(2027, 2, 13, 15, 30).toISOString() })];
    const d = planReengagement(input({ notes }))[0].date;
    expect(ymd(d)).toBe('2027-3-13');
    expect(hm(d)).toBe('13:30');
  });

  test('Erinnerung 30 min vor dem Zeitpunkt → auf 2 h danach geschoben', () => {
    const notes = [note({ reminderAt: new Date(2027, 2, 13, 14, 0).toISOString() })];
    const d = planReengagement(input({ notes }))[0].date;
    expect(hm(d)).toBe('16:00');
  });

  test('tägliche Erinnerung blockiert keinen Tag, nur ihre Uhrzeit wird umgangen', () => {
    const notes = [
      checklistNote(), note(),
      note({ reminderAt: new Date(2027, 2, 1, 14, 0).toISOString(), reminderRecurrence: 'daily' }),
    ];
    const plan = planReengagement(input({ notes }));
    expect(plan.map((p) => ymd(p.date))).toEqual(['2027-3-13', '2027-3-17', '2027-3-24']);
    for (const p of plan) expect(hm(p.date)).toBe('16:00');
  });

  test('Verschiebung bleibt außerhalb der Ruhezeit (früh morgens nicht vor 9:00)', () => {
    const lastOpenedAt = new Date(2027, 2, 10, 7, 5); // → 10:00
    const notes = [note({ reminderAt: new Date(2027, 2, 13, 10, 30).toISOString() })];
    const d = planReengagement(input({ now: lastOpenedAt, lastOpenedAt, notes }))[0].date;
    expect(ymd(d)).toBe('2027-3-13');
    expect(hm(d)).toBe('12:30'); // 8:30 läge in der Ruhezeit
    expect(isQuietTime(d)).toBe(false);
  });

  test('kein Tagespunkt mit ≥ 2 h Abstand → trotzdem zum ursprünglichen Zeitpunkt senden', () => {
    const notes: Note[] = [];
    for (let h = 9; h <= 21; h += 2) {
      notes.push(note({ reminderAt: new Date(2027, 2, 1, h, 0).toISOString(), reminderRecurrence: 'daily' }));
    }
    // Erinnerungs-Notizen selbst sind kein Anlass (Threads nicht erreichbar) → nur Stufe 1 generisch
    const plan = planReengagement(input({ notes, threadsAvailable: false }));
    expect(plan.length).toBe(1);
    expect(ymd(plan[0].date)).toBe('2027-3-13');
    expect(hm(plan[0].date)).toBe('14:30');
  });

  test('Erinnerungszeiten: wöchentlich am Wochentag, monatlich am 31. = letzter Monatstag', () => {
    const weekly = note({
      reminderAt: new Date(2027, 2, 6, 9, 0).toISOString(),
      reminderRecurrence: 'weekly', reminderWeekday: 7, // Samstag
    });
    expect(reminderTimesOnDay([weekly], new Date(2027, 2, 13)).map(hm)).toEqual(['9:00']);
    expect(reminderTimesOnDay([weekly], new Date(2027, 2, 14))).toEqual([]);
    const monthly = note({
      reminderAt: new Date(2027, 0, 31, 9, 0).toISOString(),
      reminderRecurrence: 'monthly', reminderDayOfMonth: 31,
    });
    expect(reminderTimesOnDay([monthly], new Date(2027, 3, 30)).length).toBe(1);
    expect(reminderTimesOnDay([monthly], new Date(2027, 3, 29))).toEqual([]);
  });

  test('archivierte Notizen zählen nicht', () => {
    const notes = [note({ reminderAt: new Date(2027, 2, 13, 15, 0).toISOString(), archivedAt: NOW.toISOString() })];
    expect(hm(planReengagement(input({ notes }))[0].date)).toBe('14:30');
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
