'use client';

import { useState } from 'react';
import { Note, Thread } from '@/types';

const CATEGORIES = ['Lernen', 'Arbeit', 'Ideen', 'Persönlich'];

// ── Exported create-data type (used in page.tsx) ──────────────────────────────
export interface NoteCreateData {
  title: string;
  content: string;
  category: string;
  threadId: string;
  createdAt: string;
  userId: string;
  includeInThreads: boolean;
  reminder: null | { type: string; date: string };
}

const CATEGORY_COLORS: Record<string, string> = {
  'Lernen':     '#5A8FC0',
  'Arbeit':     '#5AA46A',
  'Ideen':      '#B0A040',
  'Persönlich': '#B07090',
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? '#A8D8A8';
}

// ── View mode ─────────────────────────────────────────────────────────────────

interface ViewProps {
  note: Note;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export function NoteViewModal({ note, onClose, onDelete }: ViewProps) {
  const [confirmDel, setConfirmDel] = useState(false);
  const catColor = getCategoryColor(note.category);

  const date = note.createdAt
    ? new Date(note.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  return (
    <div style={s.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.hdr}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {note.category && (
              <span style={{ ...s.catDot, background: catColor }} />
            )}
            <span style={s.hdrTitle}>{note.title}</span>
          </div>
          <button onClick={onClose} style={s.xBtn}>×</button>
        </div>

        {/* Body */}
        <div style={s.body}>
          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {note.category && (
              <span style={{ ...s.badge, background: `${catColor}1A`, color: catColor, border: `1px solid ${catColor}40` }}>
                {note.category}
              </span>
            )}
          </div>

          {/* Content */}
          <div style={s.noteBody}>
            {note.content
              ? <span style={{ whiteSpace: 'pre-wrap' }}>{note.content}</span>
              : <span style={{ color: 'rgba(160,144,128,0.5)', fontStyle: 'italic' }}>Kein Inhalt.</span>
            }
          </div>

          {/* Date */}
          <div style={s.noteMeta}>Erstellt am {date}</div>

          {/* Actions */}
          {onDelete && (
            confirmDel ? (
              <div style={s.delConfirm}>
                <div style={s.delQ}>Diese Notiz wirklich löschen?</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setConfirmDel(false)} style={s.ghostBtn}>Abbrechen</button>
                  <button onClick={() => { onDelete(note.id); onClose(); }} style={s.delBtn}>Endgültig löschen</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
                <button onClick={() => setConfirmDel(true)} style={s.delOutline}>Löschen</button>
                <button onClick={onClose} style={s.ghostBtn}>Schließen</button>
              </div>
            )
          )}
          {!onDelete && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={onClose} style={s.ghostBtn}>Schließen</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create mode ───────────────────────────────────────────────────────────────

interface CreateProps {
  threads: Thread[];
  userId: string;
  onClose: () => void;
  onCreate: (data: NoteCreateData) => Promise<void>;
}

export function NoteCreateModal({ threads, userId, onClose, onCreate }: CreateProps) {
  const [title, setTitle]                   = useState('');
  const [content, setContent]               = useState('');
  const [catId, setCatId]                   = useState(CATEGORIES[0]);
  const [threadId, setThreadId]             = useState(threads[0]?.id ?? '');
  const [includeInThreads, setInclude]      = useState(true);
  const [reminder, setReminder]             = useState('none');
  const [reminderDate, setReminderDate]     = useState('');
  const [loading, setLoading]               = useState(false);

  const catColor = getCategoryColor(catId);

  const doCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    await onCreate({
      title: title.trim(),
      content: content.trim(),
      category: catId,
      threadId,
      createdAt: new Date().toISOString(),
      userId,
      includeInThreads,
      reminder: reminder === 'none' ? null : { type: reminder, date: reminderDate },
    });
    setLoading(false);
    onClose();
  };

  return (
    <div style={s.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.hdr}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={s.hdrIcon}>✦</span>
            <span style={s.hdrTitle}>Neue Notiz</span>
          </div>
          <button onClick={onClose} style={s.xBtn}>×</button>
        </div>

        {/* Body */}
        <div style={s.body}>
          <label style={s.lbl}>Titel</label>
          <input
            autoFocus value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.metaKey && doCreate()}
            style={s.inp} placeholder="Notiz-Titel…"
          />

          <label style={{ ...s.lbl, marginTop: 14 }}>Inhalt</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            style={{ ...s.inp, resize: 'vertical', minHeight: 100, lineHeight: 1.65 }}
            placeholder="Was möchtest du festhalten?"
          />

          <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
            {/* Kategorie */}
            <div style={{ flex: 1 }}>
              <label style={s.lbl}>Kategorie</label>
              <div style={{ position: 'relative' }}>
                <span style={{ ...s.selDot, background: catColor }} />
                <select value={catId} onChange={e => setCatId(e.target.value)} style={{ ...s.sel, paddingLeft: 28 }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {/* Thread */}
            {threads.length > 0 && (
              <div style={{ flex: 1 }}>
                <label style={s.lbl}>Thread</label>
                <select value={threadId} onChange={e => setThreadId(e.target.value)} style={s.sel}>
                  {threads.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Toggle */}
          <div style={s.toggleRow}>
            <div>
              <div style={s.toggleLabel}>In Threads einbeziehen</div>
              <div style={s.toggleSub}>Notiz im Thread-Graph sichtbar machen</div>
            </div>
            <button
              type="button"
              onClick={() => setInclude(v => !v)}
              style={{ ...s.toggleTrack, background: includeInThreads ? '#F4A261' : 'rgba(255,255,255,0.12)' }}
            >
              <span style={{ ...s.toggleThumb, transform: includeInThreads ? 'translateX(20px)' : 'translateX(2px)' }} />
            </button>
          </div>

          {/* Erinnerung */}
          <div style={{ marginTop: 14 }}>
            <label style={s.lbl}>Erinnerung</label>
            <select value={reminder} onChange={e => setReminder(e.target.value)} style={s.sel}>
              <option value="none">Keine</option>
              <option value="once">Einmalig</option>
              <option value="daily">Täglich</option>
              <option value="weekly">Wöchentlich</option>
              <option value="monthly">Monatlich</option>
            </select>
            {reminder !== 'none' && (
              <input
                type="datetime-local"
                value={reminderDate}
                onChange={e => setReminderDate(e.target.value)}
                style={{ ...s.inp, marginTop: 8 }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
            <button onClick={onClose} style={s.ghostBtn}>Abbrechen</button>
            <button
              onClick={doCreate}
              disabled={!title.trim() || loading}
              style={{ ...s.primaryBtn, opacity: (title.trim() && !loading) ? 1 : 0.45 }}
            >
              {loading ? 'Erstellt…' : 'Erstellen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: 'rgba(22,18,14,0.98)',
    border: '1px solid rgba(255,220,160,0.15)',
    borderRadius: 14,
    width: 480, maxWidth: '92vw',
    boxShadow: '0 8px 48px rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
  hdr: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 22px 16px',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,220,160,0.08)',
  },
  hdrTitle: {
    fontSize: 18, fontWeight: 600, color: '#F2EDE6', lineHeight: 1.2,
  },
  hdrIcon: { fontSize: 14, color: '#F4A261' },
  catDot: {
    width: 10, height: 10, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
  },
  xBtn: {
    background: 'none', border: 'none', color: 'rgba(160,144,128,0.6)',
    fontSize: 20, cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
    lineHeight: 1,
  },
  body: { padding: '22px 24px 24px' },
  lbl: {
    display: 'block', fontSize: 10, fontWeight: 700,
    color: 'rgba(160,144,128,0.55)', marginBottom: 6,
    letterSpacing: '0.07em', textTransform: 'uppercase',
  },
  inp: {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,220,160,0.1)', borderRadius: 8,
    fontSize: 14, color: '#F2EDE6',
    fontFamily: "'Inter', sans-serif", outline: 'none',
  } as React.CSSProperties,
  sel: {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,220,160,0.1)', borderRadius: 8,
    fontSize: 14, color: '#F2EDE6',
    fontFamily: "'Inter', sans-serif", outline: 'none', appearance: 'none',
  } as React.CSSProperties,
  selDot: {
    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
    width: 8, height: 8, borderRadius: '50%', zIndex: 1, pointerEvents: 'none',
  },
  badge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
    fontSize: 12, fontWeight: 500,
  },
  noteBody: {
    fontSize: 14, color: 'rgba(242,237,230,0.7)', lineHeight: 1.75,
    minHeight: 72, marginBottom: 14,
  },
  noteMeta: {
    fontSize: 12, color: 'rgba(160,144,128,0.5)',
    borderTop: '1px solid rgba(255,220,160,0.08)', paddingTop: 12,
  },
  delConfirm: {
    background: 'rgba(232,128,128,0.08)', border: '1px solid rgba(232,128,128,0.2)',
    borderRadius: 10, padding: 16, marginTop: 18,
  },
  delQ: { fontSize: 14, color: '#E88080', fontWeight: 500 },
  ghostBtn: {
    padding: '9px 16px', background: 'transparent',
    border: '1px solid rgba(255,220,160,0.12)', borderRadius: 8,
    fontSize: 13, color: 'rgba(160,144,128,0.7)', cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
  },
  primaryBtn: {
    padding: '9px 20px', background: '#F4A261',
    border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 700, color: '#0E0C09',
    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
    boxShadow: '0 0 16px rgba(244,162,97,0.2)',
    transition: 'opacity 0.15s',
  },
  delOutline: {
    padding: '9px 16px', background: 'transparent',
    border: '1px solid rgba(232,128,128,0.35)', borderRadius: 8,
    fontSize: 13, color: '#E88080', cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
  },
  delBtn: {
    padding: '9px 16px', background: 'rgba(232,128,128,0.85)',
    border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 600, color: 'white',
    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },
  toggleRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, padding: '10px 14px',
    background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,220,160,0.08)',
  },
  toggleLabel: { fontSize: 13, color: '#F2EDE6', fontWeight: 500 },
  toggleSub:   { fontSize: 11, color: 'rgba(160,144,128,0.5)', marginTop: 2 },
  toggleTrack: {
    width: 42, height: 24, borderRadius: 12,
    border: 'none', cursor: 'pointer',
    position: 'relative', flexShrink: 0,
    transition: 'background 0.2s', padding: 0,
  },
  toggleThumb: {
    position: 'absolute', top: 3,
    width: 18, height: 18, borderRadius: '50%',
    background: '#F2EDE6',
    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
    transition: 'transform 0.2s',
    display: 'block',
  },
};
