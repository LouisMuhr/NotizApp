// Ergebnis der KI-Strukturierung → Felder fuer addNote().
//
// Die Bridge liefert Erinnerungen als lokale Geraetezeit ("YYYY-MM-DDTHH:mm");
// erst hier wird daraus ein ISO-Zeitpunkt. Wochentag/Monatstag nur passend zur
// Wiederholung, wie im Editor. In Threads einbezogen wird nie automatisch.

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import type { Note } from '../models/Note';
import type { StructuredNoteResult } from '../sync/parseNote';

export type NoteDraft = Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'notificationId'>;

const LOCAL_DT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function localToIso(at: string): string | null {
  const m = LOCAL_DT.exec(at);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function structuredToNote(result: StructuredNoteResult, now: Date = new Date()): NoteDraft {
  let reminderAt: string | null = null;
  let recurrence: Note['reminderRecurrence'] = 'once';
  let weekday: number | null = null;
  let dayOfMonth: number | null = null;

  const r = result.reminder;
  const iso = r ? localToIso(r.at) : null;
  if (r && iso && !(r.recurrence === 'once' && new Date(iso).getTime() <= now.getTime())) {
    reminderAt = iso;
    recurrence = r.recurrence;
    weekday = r.recurrence === 'weekly' ? r.weekday : null;
    dayOfMonth = r.recurrence === 'monthly' ? r.dayOfMonth : null;
  }

  return {
    title: result.title,
    content: result.content,
    category: result.category || 'Allgemein',
    isPinned: false,
    checklist: result.checklist.map((text) => ({ id: uuidv4(), text, checked: false })),
    reminderAt,
    reminderRecurrence: recurrence,
    reminderWeekday: weekday,
    reminderDayOfMonth: dayOfMonth,
    feedsThreads: false,
    source: 'voice',
  };
}
