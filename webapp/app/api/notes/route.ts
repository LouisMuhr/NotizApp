import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { createNote } from '@/lib/createNote';

// Fehler kommen als Code (`{ error: 'reminder_past' }` …), der Client übersetzt sie (lib/i18n.tsx).
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const r = await createNote(createServerClient(token), body);
    return 'id' in r
      ? NextResponse.json({ id: r.id }, { status: 201 })
      : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (err) {
    console.error('POST /api/notes error:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
