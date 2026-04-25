import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GraphData, GraphNode, GraphLink } from '@/types';

export const revalidate = 60;

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const [{ data: threadRows }, { data: noteRows }] = await Promise.all([
    supabase
      .from('threads')
      .select('id, title, summary, status, is_pinned, note_ids, last_synthesized_at, created_at, updated_at')
      .eq('status', 'active'),
    supabase
      .from('notes')
      .select('id, title, content, category, created_at, updated_at')
      .eq('feeds_threads', true),
  ]);

  const noteMap = new Map((noteRows ?? []).map((n: any) => [n.id, n]));

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const addedNoteIds = new Set<string>();

  for (const row of threadRows ?? []) {
    const thread = {
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
    };

    nodes.push({ id: row.id, label: row.title, type: 'thread', data: thread });

    for (const noteId of row.note_ids ?? []) {
      if (!addedNoteIds.has(noteId) && noteMap.has(noteId)) {
        const n = noteMap.get(noteId)!;
        const note = {
          id: n.id,
          title: n.title ?? '',
          content: n.content ?? '',
          category: n.category ?? '',
          createdAt: n.created_at,
          updatedAt: n.updated_at,
        };
        nodes.push({ id: n.id, label: n.title || n.content.slice(0, 40), type: 'note', data: note });
        addedNoteIds.add(noteId);
      }
      links.push({ source: noteId, target: row.id });
    }
  }

  const data: GraphData = { nodes, links };
  return NextResponse.json(data);
}
