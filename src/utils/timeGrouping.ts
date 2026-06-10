import { Note } from '../models/Note';
import { t as translate } from '../i18n';

export interface NoteGroup {
  label: string;
  notes: Note[];
}

type TFunc = typeof translate;

const BUCKET_KEYS = ['timeline.bucketOlder', 'timeline.bucketLastWeek', 'timeline.bucketLast3Days', 'timeline.bucketToday'] as const;

function getBucketKey(noteDate: Date, now: Date): typeof BUCKET_KEYS[number] {
  const diffDays = (now.getTime() - noteDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return 'timeline.bucketToday';
  if (diffDays < 3) return 'timeline.bucketLast3Days';
  if (diffDays < 14) return 'timeline.bucketLastWeek';
  return 'timeline.bucketOlder';
}

export function groupNotesByTime(notes: Note[], referenceDate: Date, t: TFunc = translate): NoteGroup[] {
  const groups: Record<string, Note[]> = {
    'timeline.bucketToday': [],
    'timeline.bucketLast3Days': [],
    'timeline.bucketLastWeek': [],
    'timeline.bucketOlder': [],
  };

  const sorted = [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const note of sorted) {
    const bucketKey = getBucketKey(new Date(note.createdAt), referenceDate);
    groups[bucketKey].push(note);
  }

  return BUCKET_KEYS
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ label: t(key), notes: groups[key] }));
}

export function calculateReadTime(content: string): number {
  return Math.max(1, Math.ceil((content?.length ?? 0) / 200));
}

export function isNewNote(noteCreatedAt: string): boolean {
  const diffMs = Date.now() - new Date(noteCreatedAt).getTime();
  return diffMs < 3 * 24 * 60 * 60 * 1000;
}

export function formatRelativeDate(iso: string, t: TFunc = translate): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return t('threads.relativeJustNow');
  if (minutes < 60) return t('threads.relativeMinutesAgo', { count: minutes });
  if (hours < 24) return t('threads.relativeHoursAgo', { count: hours });
  if (days === 1) return t('threads.relativeYesterday');
  return t('threads.relativeDaysAgo', { count: days });
}
