import { Note, ChecklistItem, ReminderRecurrence } from '../models/Note';
import { getSupabase } from './supabaseClient';

interface RemoteRow {
  id: string;
  device_id: string;
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
}

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
  };
}

export async function pullRemote(deviceId: string): Promise<Note[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('device_id', deviceId)
    .order('updated_at', { ascending: false });
  if (error) {
    console.warn('[sync] pullRemote error', error.message);
    return null;
  }
  return (data as RemoteRow[]).map(rowToNote);
}

export async function upsertRemote(deviceId: string, note: Note): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const row = {
    id: note.id,
    device_id: deviceId,
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
  };
  const { error } = await supabase.from('notes').upsert(row, { onConflict: 'id' });
  if (error) {
    console.warn('[sync] upsertRemote error', error.message);
  }
}

export async function deleteRemote(deviceId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('device_id', deviceId)
    .in('id', ids);
  if (error) {
    console.warn('[sync] deleteRemote error', error.message);
  }
}

export type Unsubscribe = () => void;

export function subscribeRemote(
  deviceId: string,
  onInsert: (note: Note) => void,
): Unsubscribe {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`notes:${deviceId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notes',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => {
        try {
          onInsert(rowToNote(payload.new as RemoteRow));
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
