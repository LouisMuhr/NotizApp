import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GraphData, Thread, Note, Similarity } from '@/types';

export const revalidate = 60;

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const [{ data: threadRows }, { data: noteRows }, { data: similarityRows }] = await Promise.all([
    supabase
      .from('threads')
      .select('id, title, summary, status, is_pinned, note_ids, last_synthesized_at, created_at, updated_at')
      .eq('status', 'active'),
    supabase
      .from('notes')
      .select('id, title, content, category, created_at, updated_at')
      .eq('feeds_threads', true),
    supabase
      .from('thread_similarities')
      .select('id, thread_id_1, thread_id_2, label'),
  ]);

  const noteMap = new Map((noteRows ?? []).map((n: any) => [n.id, n]));

  const threads: Thread[] = [];
  const notes: Note[] = [];
  const addedNoteIds = new Set<string>();

  for (const row of threadRows ?? []) {
    threads.push({
      id: row.id,
      title: row.title,
      summary: row.summary ?? '',
      status: row.status,
      isPinned: row.is_pinned ?? false,
      noteCount: (row.note_ids ?? []).length,
      noteIds: row.note_ids ?? [],
      lastSynthesizedAt: row.last_synthesized_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });

    for (const noteId of row.note_ids ?? []) {
      if (!addedNoteIds.has(noteId) && noteMap.has(noteId)) {
        const n = noteMap.get(noteId)!;
        notes.push({
          id: n.id,
          threadId: row.id,
          title: n.title ?? '',
          content: n.content ?? '',
          category: n.category ?? '',
          createdAt: n.created_at,
          updatedAt: n.updated_at,
        });
        addedNoteIds.add(noteId);
      }
    }
  }

  const similarities: Similarity[] = (similarityRows ?? []).map((row: any) => ({
    id: row.id ?? `${row.thread_id_1}_${row.thread_id_2}`,
    threadId1: row.thread_id_1,
    threadId2: row.thread_id_2,
    label: row.label ?? '',
    explanation: '',
  }));

  const data: GraphData = { threads, notes, similarities };
  return NextResponse.json(data);
}
