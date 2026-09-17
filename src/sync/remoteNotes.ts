import { Note, ChecklistItem, ReminderRecurrence } from '../models/Note';
import { getSupabase } from './supabaseClient';

interface RemoteRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  checklist: ChecklistItem[] | null;
  created_at: string;
  updated_at: string;
  reminder_at: string | null;
  reminder_recurrence: ReminderRecurrence | null;
  reminder_weekday: number | null;
  reminder_day_of_month: number | null;
  source?: string | null;
  feeds_threads?: boolean | null;
  archived_at?: string | null;
}

/** PostgREST liefert per Default max. 1000 Zeilen (max_rows) — daher seitenweise lesen. */
const PAGE_SIZE = 500;

function rowToNote(row: RemoteRow): Note {
  return {
    id: row.id,
    title: row.title ?? '',
    content: row.content ?? '',
    category: row.category ?? 'Allgemein',
    isPinned: row.is_pinned ?? false,
    checklist: row.checklist ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reminderAt: row.reminder_at,
    reminderRecurrence: row.reminder_recurrence ?? 'once',
    reminderWeekday: row.reminder_weekday,
    reminderDayOfMonth: row.reminder_day_of_month,
    notificationId: null,
    feedsThreads: row.feeds_threads ?? false,
    archivedAt: row.archived_at ?? null,
  };
}

function noteToRow(userId: string, note: Note) {
  return {
    id: note.id,
    user_id: userId,
    title: note.title,
    content: note.content,
    category: note.category,
    is_pinned: note.isPinned,
    checklist: note.checklist ?? [],
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    reminder_at: note.reminderAt,
    reminder_recurrence: note.reminderRecurrence,
    reminder_weekday: note.reminderWeekday,
    reminder_day_of_month: note.reminderDayOfMonth,
    source: 'app',
    feeds_threads: note.feedsThreads,
    archived_at: note.archivedAt ?? null,
  };
}

/** Teilmenge der Note-Felder → Spalten (fuer PATCH nur geaenderter Felder). */
export function patchToRow(patch: Partial<Note>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.content !== undefined) row.content = patch.content;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.isPinned !== undefined) row.is_pinned = patch.isPinned;
  if (patch.checklist !== undefined) row.checklist = patch.checklist ?? [];
  if (patch.updatedAt !== undefined) row.updated_at = patch.updatedAt;
  if (patch.reminderAt !== undefined) row.reminder_at = patch.reminderAt;
  if (patch.reminderRecurrence !== undefined) row.reminder_recurrence = patch.reminderRecurrence;
  if (patch.reminderWeekday !== undefined) row.reminder_weekday = patch.reminderWeekday;
  if (patch.reminderDayOfMonth !== undefined) row.reminder_day_of_month = patch.reminderDayOfMonth;
  if (patch.feedsThreads !== undefined) row.feeds_threads = patch.feedsThreads;
  if (patch.archivedAt !== undefined) row.archived_at = patch.archivedAt;
  return row;
}

/**
 * Liest alle Notizen (aktiv UND archiviert) des Users, seitenweise.
 * Gibt null zurueck, wenn der Pull nicht vollstaendig war — der Aufrufer
 * darf dann nichts als "remote geloescht" interpretieren.
 */
export async function pullRemote(userId: string): Promise<Note[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const all: RemoteRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.warn('[sync] pullRemote error', error.message);
      return null;
    }
    const page = (data ?? []) as RemoteRow[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all.map(rowToNote);
}

/**
 * Notiz remote schreiben. Wirft bei Fehler (der Aufrufer fuehrt die Outbox).
 *
 * Ohne `patch`: ganze Zeile (Neuanlage, Nachschicken aus der Outbox).
 * Mit `patch`: nur die geaenderten Felder + updated_at, damit ein veralteter
 * lokaler Stand nicht Felder ueberschreibt, die ein anderes Geraet inzwischen
 * geaendert hat (S5). Existiert die Zeile remote nicht, wird sie angelegt.
 */
export async function upsertRemote(userId: string, note: Note, patch?: Partial<Note>): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  if (patch) {
    const row = patchToRow({ ...patch, updatedAt: note.updatedAt });
    const { data, error } = await supabase
      .from('notes')
      .update(row)
      .eq('user_id', userId)
      .eq('id', note.id)
      .select('id');
    if (error) throw new Error(`updateRemote: ${error.message}`);
    if (data && data.length > 0) return;
    // Zeile fehlt remote (nie hochgeladen) → ganze Notiz anlegen
  }
  const { error } = await supabase.from('notes').upsert(noteToRow(userId, note), { onConflict: 'id' });
  if (error) throw new Error(`upsertRemote: ${error.message}`);
}

/** Endgueltig loeschen. In Batches, damit die URL-Laenge nicht explodiert (S14). */
const DELETE_BATCH = 200;
export async function deleteRemote(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabase();
  if (!supabase) return;
  for (let i = 0; i < ids.length; i += DELETE_BATCH) {
    const batch = ids.slice(i, i + DELETE_BATCH);
    const { error } = await supabase.from('notes').delete().eq('user_id', userId).in('id', batch);
    if (error) throw new Error(`deleteRemote: ${error.message}`);
  }
}

export type Unsubscribe = () => void;

export interface RemoteHandlers {
  onUpsert: (note: Note) => void;
  onDelete: (id: string) => void;
}

/** Alle Aenderungen (INSERT/UPDATE/DELETE) an den eigenen Notizen abonnieren (S10). */
export function subscribeRemote(userId: string, handlers: RemoteHandlers): Unsubscribe {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`notes:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
      (payload) => {
        try {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as Partial<RemoteRow>)?.id;
            if (id) handlers.onDelete(id);
            return;
          }
          handlers.onUpsert(rowToNote(payload.new as RemoteRow));
        } catch (e) {
          console.warn('[sync] subscribe map error', e);
        }
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
