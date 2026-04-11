// Supabase sync layer für thoughts/threads/thought_threads.
// Spiegelt das Pattern aus remoteNotes.ts wider:
//   - row → model mapper
//   - pull*, insert*/upsert*, subscribe*
// subscribeThreads nutzt event '*' (statt nur INSERT) weil Threads vom Worker
// auch ge-UPDATEt werden, wenn ein neuer Thought hinzukommt.

import {
  Thought,
  ThoughtSource,
  Thread,
  ThreadStatus,
  ThoughtThreadLink,
  ThreadWithThoughts,
} from '../models/Thought';
import { getSupabase } from './supabaseClient';

// ----------------------------------------------------------------------------
// Row-Typen (snake_case wie in Supabase)
// ----------------------------------------------------------------------------

interface ThoughtRow {
  id: string;
  device_id: string;
  content: string;
  source: ThoughtSource | null;
  raw_audio_url: string | null;
  created_at: string;
  processed_at: string | null;
}

interface ThreadRow {
  id: string;
  device_id: string;
  title: string;
  summary: string;
  status: ThreadStatus | null;
  thought_count: number | null;
  last_synthesized_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ThoughtThreadRow {
  thought_id: string;
  thread_id: string;
  relevance: number | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Mapper
// ----------------------------------------------------------------------------

function rowToThought(row: ThoughtRow): Thought {
  return {
    id: row.id,
    content: row.content ?? '',
    source: (row.source ?? 'app') as ThoughtSource,
    rawAudioUrl: row.raw_audio_url,
    createdAt: row.created_at,
    processedAt: row.processed_at,
  };
}

function thoughtToRow(deviceId: string, t: Thought): ThoughtRow {
  return {
    id: t.id,
    device_id: deviceId,
    content: t.content,
    source: t.source,
    raw_audio_url: t.rawAudioUrl,
    created_at: t.createdAt,
    processed_at: t.processedAt,
  };
}

function rowToThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title ?? '',
    summary: row.summary ?? '',
    status: (row.status ?? 'active') as ThreadStatus,
    thoughtCount: row.thought_count ?? 0,
    lastSynthesizedAt: row.last_synthesized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToLink(row: ThoughtThreadRow): ThoughtThreadLink {
  return {
    thoughtId: row.thought_id,
    threadId: row.thread_id,
    relevance: row.relevance ?? 1.0,
    createdAt: row.created_at,
  };
}

// ----------------------------------------------------------------------------
// Pull (initial fetch)
// ----------------------------------------------------------------------------

export async function pullThoughts(deviceId: string): Promise<Thought[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('thoughts')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[brainstorm] pullThoughts error', error.message);
    return [];
  }
  return (data as ThoughtRow[]).map(rowToThought);
}

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

export async function pullThoughtThreadLinks(
  deviceId: string,
): Promise<ThoughtThreadLink[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  // Wir filtern indirekt über die Thread-Zugehörigkeit, damit fremde device_ids
  // nicht im Resultat landen (RLS ist permissive).
  const { data, error } = await supabase
    .from('thought_threads')
    .select('thought_id, thread_id, relevance, created_at, threads!inner(device_id)')
    .eq('threads.device_id', deviceId);
  if (error) {
    console.warn('[brainstorm] pullThoughtThreadLinks error', error.message);
    return [];
  }
  return (data as unknown as ThoughtThreadRow[]).map(rowToLink);
}

// ----------------------------------------------------------------------------
// Write
// ----------------------------------------------------------------------------

export async function insertThought(
  deviceId: string,
  thought: Thought,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from('thoughts')
    .insert(thoughtToRow(deviceId, thought));
  if (error) {
    console.warn('[brainstorm] insertThought error', error.message);
  }
}

export async function deleteThought(deviceId: string, id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from('thoughts')
    .delete()
    .eq('id', id)
    .eq('device_id', deviceId);
  if (error) {
    console.warn('[brainstorm] deleteThought error', error.message);
  }
}

// ----------------------------------------------------------------------------
// Detail-Lookup für Thread-Detail-Screen (kommt erst in Slice 3 zum Einsatz,
// wird hier aber schon bereitgestellt damit der Sync-Layer komplett ist).
// ----------------------------------------------------------------------------

export async function getThreadWithThoughts(
  deviceId: string,
  threadId: string,
): Promise<ThreadWithThoughts | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: threadData, error: threadError } = await supabase
    .from('threads')
    .select('*')
    .eq('device_id', deviceId)
    .eq('id', threadId)
    .maybeSingle();
  if (threadError) {
    console.warn('[brainstorm] getThreadWithThoughts thread error', threadError.message);
    return null;
  }
  if (!threadData) return null;

  const { data: linkData, error: linkError } = await supabase
    .from('thought_threads')
    .select('thought_id, relevance, created_at, thoughts!inner(*)')
    .eq('thread_id', threadId);
  if (linkError) {
    console.warn('[brainstorm] getThreadWithThoughts links error', linkError.message);
    return { ...rowToThread(threadData as ThreadRow), thoughts: [] };
  }

  const thoughts = (linkData ?? [])
    .map((row: any) => rowToThought(row.thoughts as ThoughtRow))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return { ...rowToThread(threadData as ThreadRow), thoughts };
}

// ----------------------------------------------------------------------------
// Realtime-Subscriptions
// ----------------------------------------------------------------------------

export type Unsubscribe = () => void;

export function subscribeThoughts(
  deviceId: string,
  onInsert: (thought: Thought) => void,
): Unsubscribe {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`thoughts:${deviceId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'thoughts',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => {
        try {
          onInsert(rowToThought(payload.new as ThoughtRow));
        } catch (e) {
          console.warn('[brainstorm] subscribeThoughts map error', e);
        }
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// Threads brauchen UPDATE-Events (nicht nur INSERT) — der Worker schreibt
// Summary/thought_count laufend fort.
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
      {
        event: '*',
        schema: 'public',
        table: 'threads',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => {
        try {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Partial<ThreadRow>;
            if (oldRow?.id) onChange({ type: 'delete', threadId: oldRow.id });
            return;
          }
          const thread = rowToThread(payload.new as ThreadRow);
          onChange({
            type: payload.eventType === 'INSERT' ? 'insert' : 'update',
            thread,
          });
        } catch (e) {
          console.warn('[brainstorm] subscribeThreads map error', e);
        }
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// thought_threads-Links: wir hören auf INSERT, weil der Worker neue
// Verknüpfungen erzeugt sobald ein Thread um einen Thought erweitert wird.
// (Updates der relevance sind unkritisch, DELETE kommt selten vor.)
export function subscribeThoughtThreadLinks(
  deviceId: string,
  onInsert: (link: ThoughtThreadLink) => void,
): Unsubscribe {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  // Filter direkt per device_id ist nicht möglich (Tabelle hat keinen device_id-
  // Spalte), aber RLS ist permissive für single-device. Wir bekommen also alle
  // Inserts und filtern client-seitig nach bekannten Thread-IDs falls nötig.
  const channel = supabase
    .channel(`thought_threads:${deviceId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'thought_threads',
      },
      (payload) => {
        try {
          onInsert(rowToLink(payload.new as ThoughtThreadRow));
        } catch (e) {
          console.warn('[brainstorm] subscribeThoughtThreadLinks map error', e);
        }
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
