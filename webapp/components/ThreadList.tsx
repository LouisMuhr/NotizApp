'use client';

import { Thread, Note } from '@/types';
import { useI18n } from '@/lib/i18n';

interface Props {
  threads: Thread[];
  notes: Note[];
  /** Suchbegriff aus der Topbar: Threads, deren Titel oder Notiz-Titel passen */
  query: string;
  onSelect: (thread: Thread) => void;
}

/** Handy: alle Threads als Liste — der Ausweg, wenn der Graph zu voll ist. Antippen springt zur Insel. */
export default function ThreadList({ threads, notes, query, onSelect }: Props) {
  const { t: i18n } = useI18n();
  const q = query.trim().toLowerCase();
  const noteTitles = new Map(notes.map(n => [n.id, (n.title || '').toLowerCase()]));
  const shown = threads
    .filter(t => !q || t.title.toLowerCase().includes(q) || t.noteIds.some(id => noteTitles.get(id)?.includes(q)))
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="velm-scroll" style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, overflowY: 'auto', background: 'var(--bg)', zIndex: 45, padding: '14px 12px 24px', animation: 'velm-rise 0.2s ease-out' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--amber)', margin: '0 4px 10px' }}>
        {q ? i18n.list.countOf(shown.length, threads.length) : i18n.list.count(threads.length)}
      </div>
      {shown.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 4px' }}>{i18n.list.none}</p>
      )}
      {shown.map(t => {
        const date = new Date(t.updatedAt).toLocaleDateString(i18n.dateLocale, { day: '2-digit', month: '2-digit', year: '2-digit' });
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="velm-hover"
            style={{ display: 'block', width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            <div style={{ fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 16, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.3, marginBottom: 4 }}>
              {t.isPinned ? '📌 ' : ''}{t.title}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>
              {i18n.common.notes(t.noteIds.length)} · {date}
            </div>
          </button>
        );
      })}
    </div>
  );
}
