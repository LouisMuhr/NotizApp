'use client';

import { useState } from 'react';
import { Note, Thread } from '@/types';
import { categoryAccent } from '@/lib/categoryAccent';
import { useI18n } from '@/lib/i18n';
import { buildReminder, validateDraft, type NoteDraft, type NoteError, type Recurrence } from '@/lib/noteDraft';

// ── View mode ─────────────────────────────────────────────────────────────────

interface ViewProps {
  note: Note;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export function NoteViewModal({ note, onClose, onDelete }: ViewProps) {
  const { t } = useI18n();
  const [confirmDel, setConfirmDel] = useState(false);
  const catColor = categoryAccent(note.category);

  const date = note.createdAt
    ? new Date(note.createdAt).toLocaleDateString(t.dateLocale, { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  return (
    <div style={s.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.hdr}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {note.category && (
              <span style={{ ...s.catDot, background: catColor }} />
            )}
            <span style={s.hdrTitle}>{note.title || t.common.untitled}</span>
          </div>
          <button onClick={onClose} style={s.xBtn} aria-label={t.common.close}>×</button>
        </div>

        {/* Body */}
        <div className="velm-scroll" style={s.body}>
          {note.category && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ ...s.badge, background: `${catColor}1A`, color: catColor, border: `1px solid ${catColor}40` }}>
                {note.category}
              </span>
            </div>
          )}

          <div style={s.noteBody}>
            {note.content
              ? <span style={{ whiteSpace: 'pre-wrap' }}>{note.content}</span>
              : <span style={{ color: 'rgba(160,144,128,0.5)', fontStyle: 'italic' }}>{t.noteView.noContent}</span>
            }
          </div>

          <div style={s.noteMeta}>{t.noteView.createdAt(date)}</div>

          {onDelete && (
            confirmDel ? (
              <div style={s.delConfirm}>
                <div style={s.delQ}>{t.noteView.deleteQ}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setConfirmDel(false)} style={s.ghostBtn}>{t.common.cancel}</button>
                  <button onClick={() => { onDelete(note.id); onClose(); }} style={s.delBtn}>{t.noteView.deleteFinal}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
                <button onClick={() => setConfirmDel(true)} style={s.delOutline}>{t.noteView.delete}</button>
                <button onClick={onClose} style={s.ghostBtn}>{t.common.close}</button>
              </div>
            )
          )}
          {!onDelete && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={onClose} style={s.ghostBtn}>{t.common.close}</button>
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
  categories: string[];
  onClose: () => void;
  /** Liefert null bei Erfolg, sonst den Fehler-Code — das Fenster bleibt dann mit allen Eingaben offen. */
  onCreate: (draft: NoteDraft) => Promise<NoteError | null>;
}

const RECURRENCES: Recurrence[] = ['once', 'daily', 'weekly', 'monthly'];
/** Expo-Wochentage in Anzeige-Reihenfolge Mo … So (1 = Sonntag) */
const WEEKDAY_ORDER = [2, 3, 4, 5, 6, 7, 1];

/** „YYYY-MM-DDTHH:MM" in Ortszeit für <input type="datetime-local"> */
function localInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function tomorrowNine() { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return localInput(d); }

export function NoteCreateModal({ threads, categories, onClose, onCreate }: CreateProps) {
  const { t } = useI18n();
  const [title, setTitle]               = useState('');
  const [content, setContent]           = useState('');
  const [category, setCategory]         = useState(categories[0] ?? 'Allgemein');
  // Standard: kein Thread — die Synthese sortiert die Notiz ein. Ein fester Thread nur, wenn man ihn wählt.
  const [threadId, setThreadId]         = useState('');
  const [includeInThreads, setInclude]  = useState(true);
  const [recurrence, setRecurrence]     = useState<Recurrence | null>(null);
  const [dateTime, setDateTime]         = useState('');
  const [time, setTime]                 = useState('09:00');
  const [weekday, setWeekday]           = useState(2);
  const [dayOfMonth, setDayOfMonth]     = useState(1);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<NoteError | null>(null);

  // Jede Eingabe räumt einen alten Fehler weg
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setError(null); };

  const pickRecurrence = (r: Recurrence | null) => {
    setError(null);
    setRecurrence(r);
    if (r === 'once' && !dateTime) setDateTime(tomorrowNine());
  };

  const canSubmit = (!!title.trim() || !!content.trim()) && !loading;

  const doCreate = async () => {
    if (loading) return;
    const built = buildReminder({ recurrence, dateTime, time, weekday, dayOfMonth });
    if ('error' in built) { setError(built.error); return; }
    const draft: NoteDraft = { title: title.trim(), content: content.trim(), category, threadId, includeInThreads, reminder: built.reminder };
    const invalid = validateDraft(draft);
    if (invalid) { setError(invalid); return; }
    setLoading(true); setError(null);
    const err = await onCreate(draft).catch((): NoteError => 'network');
    setLoading(false);
    if (err) { setError(err); return; }
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doCreate(); }
    else if (e.key === 'Escape' && !loading) onClose();
  };

  return (
    <div style={s.backdrop} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={s.card} onKeyDown={onKeyDown}>
        {/* Header */}
        <div style={s.hdr}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={s.hdrIcon}>✦</span>
            <span style={s.hdrTitle}>{t.noteCreate.heading}</span>
          </div>
          <button onClick={onClose} style={s.xBtn} aria-label={t.common.close} disabled={loading}>×</button>
        </div>

        {/* Body */}
        <div className="velm-scroll" style={s.body}>
          <label style={s.lbl}>{t.noteCreate.title}</label>
          <input
            autoFocus value={title} maxLength={500} className="velm-field"
            onChange={e => edit(setTitle)(e.target.value)}
            style={s.inp} placeholder={t.noteCreate.titlePh}
          />

          <label style={{ ...s.lbl, marginTop: 14 }}>{t.noteCreate.content}</label>
          <textarea
            value={content} className="velm-field velm-scroll"
            onChange={e => edit(setContent)(e.target.value)}
            style={{ ...s.inp, resize: 'vertical', minHeight: 100, lineHeight: 1.65 }}
            placeholder={t.noteCreate.contentPh}
          />

          {/* Kategorie: Chips wie in der App */}
          <label style={{ ...s.lbl, marginTop: 16 }}>{t.noteCreate.category}</label>
          <div style={s.chips}>
            {categories.map(c => {
              const active = c === category, accent = categoryAccent(c);
              return (
                <button
                  key={c} type="button" className="velm-hover" onClick={() => edit(setCategory)(c)}
                  style={{ ...s.chip, ...(active ? { background: `${accent}1F`, borderColor: `${accent}80`, color: '#F2EDE6', fontWeight: 600 } : {}) }}
                >
                  <span style={{ ...s.catDot, width: 7, height: 7, background: accent, opacity: active ? 1 : 0.55 }} />
                  {c}
                </button>
              );
            })}
          </div>

          {/* Thread: kann lang werden → Auswahlliste, dunkel gerendert */}
          {threads.length > 0 && (
            <>
              <label style={{ ...s.lbl, marginTop: 16 }}>{t.noteCreate.thread}</label>
              <div style={{ position: 'relative' }}>
                <select value={threadId} onChange={e => edit(setThreadId)(e.target.value)} className="velm-field" style={s.sel}>
                  <option value="">{t.noteCreate.threadAuto}</option>
                  {threads.map(th => <option key={th.id} value={th.id}>{th.title}</option>)}
                </select>
                <span style={s.selArrow}>▾</span>
              </div>
            </>
          )}

          {/* In Threads einbeziehen */}
          <div style={s.toggleRow}>
            <div>
              <div style={s.toggleLabel}>{t.noteCreate.include}</div>
              <div style={s.toggleSub}>{t.noteCreate.includeHint}</div>
            </div>
            <button
              type="button" role="switch" aria-checked={includeInThreads} aria-label={t.noteCreate.include}
              onClick={() => setInclude(v => !v)}
              style={{ ...s.toggleTrack, background: includeInThreads ? '#F4A261' : 'rgba(255,255,255,0.12)' }}
            >
              <span style={{ ...s.toggleThumb, transform: includeInThreads ? 'translateX(20px)' : 'translateX(2px)' }} />
            </button>
          </div>

          {/* Erinnerung: eingestellt wird hier, klingeln tut das Handy */}
          <label style={{ ...s.lbl, marginTop: 16 }}>{t.noteCreate.reminder}</label>
          <div style={s.segment}>
            {[null, ...RECURRENCES].map(r => (
              <button
                key={r ?? 'none'} type="button" onClick={() => pickRecurrence(r)}
                style={{ ...s.segmentBtn, ...(recurrence === r ? s.segmentActive : {}) }}
              >
                {r ? t.noteCreate.recurrence[r] : t.noteCreate.reminderNone}
              </button>
            ))}
          </div>
          {recurrence && (
            <div className="velm-rise" style={s.reminderBox}>
              {recurrence === 'once' ? (
                <input
                  type="datetime-local" className="velm-field" value={dateTime} min={localInput(new Date())}
                  onChange={e => edit(setDateTime)(e.target.value)} style={s.inp} aria-label={t.noteCreate.when}
                />
              ) : (
                <>
                  {recurrence === 'weekly' && (
                    <div style={{ ...s.chips, marginBottom: 10 }} role="group" aria-label={t.noteCreate.weekday}>
                      {WEEKDAY_ORDER.map(wd => (
                        <button
                          key={wd} type="button" className="velm-hover" onClick={() => edit(setWeekday)(wd)}
                          style={{ ...s.chip, minWidth: 44, justifyContent: 'center', ...(weekday === wd ? s.chipActive : {}) }}
                        >
                          {t.noteCreate.weekdaysShort[wd - 1]}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {recurrence === 'monthly' && (
                      <label style={s.inlineLbl}>
                        <input
                          type="number" min={1} max={31} className="velm-field" value={dayOfMonth}
                          onChange={e => edit(setDayOfMonth)(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                          style={{ ...s.inp, width: 72 }} aria-label={t.noteCreate.dayOfMonth}
                        />
                        <span>{t.noteCreate.dayOfMonthSuffix}</span>
                      </label>
                    )}
                    <input
                      type="time" className="velm-field" value={time}
                      onChange={e => edit(setTime)(e.target.value)} style={{ ...s.inp, width: 130 }} aria-label={t.noteCreate.time}
                    />
                  </div>
                </>
              )}
              <div style={s.toggleSub}>📱 {t.noteCreate.reminderPhone}</div>
            </div>
          )}

          {error && <div role="alert" className="velm-rise" style={s.errorBox}>{t.noteErrors[error]}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', marginTop: 22 }}>
            <span style={{ ...s.toggleSub, marginTop: 0, marginRight: 'auto' }}>{t.noteCreate.shortcut}</span>
            <button onClick={onClose} style={s.ghostBtn} disabled={loading}>{t.common.cancel}</button>
            <button
              onClick={doCreate}
              disabled={!canSubmit}
              className="velm-primary"
              style={{ ...s.primaryBtn, opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'default' }}
            >
              {loading ? t.noteCreate.creating : t.noteCreate.create}
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
    width: 500, maxWidth: '94vw', maxHeight: '92dvh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 48px rgba(0,0,0,0.55)',
    overflow: 'hidden',
    colorScheme: 'dark', // native Auswahllisten, Datum/Uhrzeit-Picker und Zahlenfelder dunkel statt weiß
  },
  hdr: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
    padding: '18px 22px 16px',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,220,160,0.08)',
  },
  hdrTitle: {
    fontSize: 18, fontWeight: 600, color: '#F2EDE6', lineHeight: 1.2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
  body: { padding: '22px 24px 24px', overflowY: 'auto', minHeight: 0 },
  lbl: {
    display: 'block', fontSize: 10, fontWeight: 700,
    color: 'rgba(160,144,128,0.55)', marginBottom: 6,
    letterSpacing: '0.07em', textTransform: 'uppercase',
  },
  inlineLbl: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(160,144,128,0.8)' },
  inp: {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,220,160,0.1)', borderRadius: 8,
    fontSize: 14, color: '#F2EDE6',
    fontFamily: "'Inter', sans-serif", outline: 'none',
  },
  sel: {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 32px 10px 12px',
    background: '#1E1A16', border: '1px solid rgba(255,220,160,0.1)', borderRadius: 8,
    fontSize: 14, color: '#F2EDE6', cursor: 'pointer',
    fontFamily: "'Inter', sans-serif", outline: 'none', appearance: 'none',
  },
  selArrow: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(160,144,128,0.7)', fontSize: 12, pointerEvents: 'none' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px',
    background: 'rgba(255,255,255,0.04)', borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(255,220,160,0.12)', borderRadius: 16, // Einzelwerte: aktiv überschreibt nur die Farbe
    fontSize: 12.5, color: 'rgba(160,144,128,0.9)', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },
  chipActive: { background: 'rgba(244,162,97,0.14)', borderColor: 'rgba(244,162,97,0.5)', color: '#F2EDE6', fontWeight: 600 },
  segment: {
    display: 'flex', flexWrap: 'wrap', gap: 2, padding: 3,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,220,160,0.08)', borderRadius: 9,
  },
  segmentBtn: {
    flex: '1 0 auto', padding: '7px 8px', background: 'transparent', border: 'none', borderRadius: 7,
    fontSize: 12.5, color: 'rgba(160,144,128,0.8)', cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontWeight: 500,
  },
  segmentActive: { background: 'rgba(244,162,97,0.14)', color: '#F4A261', fontWeight: 600 },
  reminderBox: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 },
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
  errorBox: {
    marginTop: 16, fontSize: 13, color: '#E88080', lineHeight: 1.5,
    padding: '9px 13px', background: 'rgba(232,128,128,0.08)',
    border: '1px solid rgba(232,128,128,0.2)', borderRadius: 8,
  },
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
    fontFamily: "'Inter', sans-serif",
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
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    marginTop: 16, padding: '10px 14px',
    background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,220,160,0.08)',
  },
  toggleLabel: { fontSize: 13, color: '#F2EDE6', fontWeight: 500 },
  toggleSub:   { fontSize: 11, color: 'rgba(160,144,128,0.6)', marginTop: 2 },
  toggleTrack: {
    width: 42, height: 24, borderRadius: 12,
    border: 'none', cursor: 'pointer',
    position: 'relative', flexShrink: 0,
    transition: 'background 0.2s', padding: 0,
  },
  toggleThumb: {
    position: 'absolute', top: 3, left: 0,
    width: 18, height: 18, borderRadius: '50%',
    background: '#F2EDE6',
    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
    transition: 'transform 0.2s',
    display: 'block',
  },
};
