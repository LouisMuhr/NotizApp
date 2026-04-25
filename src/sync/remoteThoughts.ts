// Supabase sync layer für Threads.
// Thoughts wurden entfernt — Threads sind reine AI-Output-Entitäten.
// Der brainstorm-worker liest Notes mit feeds_threads=true und schreibt Threads zurück.

import { Thread, ThreadStatus } from '../models/Thought';
import { getSupabase } from './supabaseClient';

// ----------------------------------------------------------------------------
// Row-Typen (snake_case wie in Supabase)
// ----------------------------------------------------------------------------

interface ThreadRow {
  id: string;
  device_id: string;
  title: string;
  summary: string;
  status: ThreadStatus | null;
  is_pinned: boolean | null;
  thought_count: number | null;
  note_ids: string[] | null;
  last_synthesized_at: string | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// Mapper
// ----------------------------------------------------------------------------

function rowToThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title ?? '',
    summary: row.summary ?? '',
    status: (row.status ?? 'active') as ThreadStatus,
    isPinned: row.is_pinned ?? false,
    noteCount: row.thought_count ?? 0,
    noteIds: row.note_ids ?? [],
    lastSynthesizedAt: row.last_synthesized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ----------------------------------------------------------------------------
// Pull
// ----------------------------------------------------------------------------

export async function pullThreads(deviceId: string): Promise<Thread[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('threads')
    .select('*')
    .eq('device_id', deviceId)
    .order('updated_at', { ascending: false });
  if (error) {
    console.warn('[brainstorm] pullThreads error', error.message);
    return [];
  }
  return (data as ThreadRow[]).map(rowToThread);
}

// ----------------------------------------------------------------------------
// Write
// ----------------------------------------------------------------------------

export async function archiveThread(deviceId: string, id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from('threads')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('device_id', deviceId);
  if (error) console.warn('[brainstorm] archiveThread error', error.message);
}

export async function restoreThread(deviceId: string, id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from('threads')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('device_id', deviceId);
  if (error) console.warn('[brainstorm] restoreThread error', error.message);
}

export async function deleteThreadPermanently(deviceId: string, id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from('threads')
    .delete()
    .eq('id', id)
    .eq('device_id', deviceId);
  if (error) console.warn('[brainstorm] deleteThreadPermanently error', error.message);
}

export async function pinThread(deviceId: string, id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from('threads')
    .update({ is_pinned: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('device_id', deviceId);
  if (error) console.warn('[brainstorm] pinThread error', error.message);
}

export async function unpinThread(deviceId: string, id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from('threads')
    .update({ is_pinned: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('device_id', deviceId);
  if (error) console.warn('[brainstorm] unpinThread error', error.message);
}

// ----------------------------------------------------------------------------
// Realtime
// ----------------------------------------------------------------------------

export type Unsubscribe = () => void;

export type ThreadChangeEvent =
  | { type: 'insert' | 'update'; thread: Thread }
  | { type: 'delete'; threadId: string };

export function subscribeThreads(
  deviceId: string,
  onChange: (event: ThreadChangeEvent) => void,
): Unsubscribe {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`threads:${deviceId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'threads', filter: `device_id=eq.${deviceId}` },
      (payload) => {
        try {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Partial<ThreadRow>;
            if (oldRow?.id) onChange({ type: 'delete', threadId: oldRow.id });
            return;
          }
          const thread = rowToThread(payload.new as ThreadRow);
          onChange({ type: payload.eventType === 'INSERT' ? 'insert' : 'update', thread });
        } catch (e) {
          console.warn('[brainstorm] subscribeThreads map error', e);
        }
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
