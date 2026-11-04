import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { deleteNote } from '@/lib/deleteNote';

// Fehler kommen als Code (`{ error: 'network' }` …), der Client übersetzt sie (lib/i18n.tsx).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { id } = await params;
    const r = await deleteNote(createServerClient(token), id);
    return 'error' in r
      ? NextResponse.json({ error: r.error }, { status: r.status })
      : NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/notes/[id] error:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
