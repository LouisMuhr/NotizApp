'use client';

import { Thread, Note, Similarity } from '@/types';

interface Props {
  thread: Thread;
  notes: Note[];
  similarities: Similarity[];
  allThreads: Thread[];
  onNoteClick: (note: Note) => void;
  onClose: () => void;
}

export default function ThreadPanel({ thread, notes, similarities, allThreads, onNoteClick, onClose }: Props) {
  const synth = thread.lastSynthesizedAt
    ? new Date(thread.lastSynthesizedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;

  const connections = similarities.filter(s => s.threadId1 === thread.id || s.threadId2 === thread.id);

  return (
    <>
      {/* backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', zIndex: 60 }}
        onClick={onClose}
      />

      {/* modal */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 61, pointerEvents: 'none' }}>
        <div
          style={{ width: 680, maxWidth: 'calc(100vw - 80px)', maxHeight: 'calc(100vh - 110px)', background: 'rgba(16,12,9,0.98)', border: '1px solid rgba(244,162,97,0.22)', borderRadius: 22, boxShadow: '0 40px 100px rgba(0,0,0,0.72), 0 0 60px rgba(244,162,97,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden', pointerEvents: 'all' }}
          onClick={e => e.stopPropagation()}
        >
          {/* amber accent line */}
          <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #F4A261 40%, transparent)', opacity: 0.4, flexShrink: 0 }} />

          {/* header */}
          <div style={{ padding: '26px 30px 20px', borderBottom: '1px solid var(--border)', position: 'relative', background: 'linear-gradient(180deg, rgba(244,162,97,0.04) 0%, transparent 100%)', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <span style={{ display: 'inline-block', width: 20, height: 1, background: 'linear-gradient(90deg, var(--amber), transparent)' }} />
              Thread
            </div>
            <h2 style={{ fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 26, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.25, letterSpacing: '-0.02em', marginBottom: 12 }}>
              {thread.title}
            </h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {synth && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px', fontSize: 11.5, color: 'var(--t3)' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />
                  {synth}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px', fontSize: 11.5, color: 'var(--t3)' }}>
                {notes.length} {notes.length === 1 ? 'Notiz' : 'Notizen'}
              </div>
              {thread.isPinned && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px', fontSize: 11.5, color: 'var(--t3)' }}>
                  📌 Angeheftet
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ position: 'absolute', top: 20, right: 22, width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--t3)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.12s' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.09)'; el.style.color = 'var(--t1)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.04)'; el.style.color = 'var(--t3)'; }}
            >
              ×
            </button>
          </div>

          {/* two-column body */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
            {/* left col: summary + connections */}
            <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto', borderRight: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--amber)', marginBottom: 8 }}>
                  KI-Zusammenfassung
                </div>
                <div style={{ background: 'rgba(244,162,97,0.04)', border: '1px solid rgba(244,162,97,0.1)', borderRadius: 12, padding: '14px 16px' }}>
                  <p style={{ fontFamily: 'var(--font-lora, Lora, serif)', fontStyle: 'italic', fontSize: 13, lineHeight: 1.72, color: 'rgba(242,237,230,0.52)' }}>
                    {thread.summary || 'Noch keine Zusammenfassung.'}
                  </p>
                </div>
              </div>

              {connections.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--purple)', marginBottom: 8 }}>
                    KI-Verbindungen
                  </div>
                  {connections.map(s => {
                    const otherId = s.threadId1 === thread.id ? s.threadId2 : s.threadId1;
                    const other = allThreads.find(t => t.id === otherId);
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px', marginBottom: 6, cursor: 'default', transition: 'all 0.14s' }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(244,162,97,0.06)'; el.style.borderColor = 'rgba(244,162,97,0.2)'; }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.025)'; el.style.borderColor = 'var(--border)'; }}
                      >
                        <div style={{ width: 9, height: 9, background: 'var(--amber)', transform: 'rotate(45deg)', flexShrink: 0, borderRadius: 2 }} />
                        <div>
                          <div style={{ fontSize: 12.5, color: 'rgba(242,237,230,0.75)' }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--t3)' }}>↔ {other?.title ?? '–'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* right col: notes */}
            <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto' }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--green)', marginBottom: -10 }}>
                {notes.length} {notes.length === 1 ? 'Notiz' : 'Notizen'}
              </div>
              {notes.map(note => (
                <button
                  key={note.id}
                  onClick={() => onNoteClick(note)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderLeft: '2px solid var(--green)', borderRadius: 10, padding: '11px 13px', marginBottom: 6, cursor: 'pointer', transition: 'all 0.14s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(168,216,168,0.06)'; el.style.borderColor = 'rgba(168,216,168,0.22)'; el.style.transform = 'translateX(2px)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.025)'; el.style.borderColor = 'var(--border)'; el.style.transform = ''; }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(242,237,230,0.82)', marginBottom: 3 }}>{note.title || '(kein Titel)'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--t3)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {note.content.split('\n')[0]}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
