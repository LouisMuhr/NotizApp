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
  };
}

export async function pullRemote(deviceId: string): Promise<Note[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('device_id', deviceId)
    .order('updated_at', { ascending: false });
  if (error) {
    console.warn('[sync] pullRemote error', error.message);
    return [];
  }
  return (data as RemoteRow[]).map(rowToNote);
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
