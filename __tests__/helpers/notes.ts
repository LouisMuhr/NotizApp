import { Note } from '../../src/models/Note';

export function makeNote(overrides: Partial<Note> & { id: string }): Note {
  const now = new Date().toISOString();
  return {
    title: `Titel ${overrides.id}`,
    content: `Inhalt ${overrides.id}`,
    category: 'Allgemein',
    isPinned: false,
    checklist: [],
    createdAt: now,
    updatedAt: now,
    reminderAt: null,
    reminderRecurrence: 'once',
    reminderWeekday: null,
    reminderDayOfMonth: null,
    notificationId: null,
    feedsThreads: false,
    ...overrides,
  };
}

export const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
