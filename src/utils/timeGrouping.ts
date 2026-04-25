import { Note } from '../models/Note';

export interface NoteGroup {
  label: string;
  notes: Note[];
}

function getBucket(noteDate: Date, now: Date): string {
  const diffDays = (now.getTime() - noteDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return 'Heute';
  if (diffDays < 3) return 'Letzte 3 Tage';
  if (diffDays < 14) return 'Letzte Woche';
  return 'Vor >2 Wochen';
}

const BUCKET_ORDER = ['Vor >2 Wochen', 'Letzte Woche', 'Letzte 3 Tage', 'Heute'];

export function groupNotesByTime(notes: Note[], referenceDate: Date): NoteGroup[] {
  const groups: Record<string, Note[]> = {
    'Heute': [],
    'Letzte 3 Tage': [],
    'Letzte Woche': [],
    'Vor >2 Wochen': [],
  };

  const sorted = [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const note of sorted) {
    const bucket = getBucket(new Date(note.createdAt), referenceDate);
    groups[bucket].push(note);
  }

  return BUCKET_ORDER
    .filter((label) => groups[label].length > 0)
    .map((label) => ({ label, notes: groups[label] }));
}

export function calculateReadTime(content: string): number {
  return Math.max(1, Math.ceil((content?.length ?? 0) / 200));
}

export function isNewNote(noteCreatedAt: string): boolean {
  const diffMs = Date.now() - new Date(noteCreatedAt).getTime();
  return diffMs < 3 * 24 * 60 * 60 * 1000;
}

export function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}
