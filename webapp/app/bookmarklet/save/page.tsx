'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchTier, hasBookmarklet } from '@/lib/tier';
import { categoryAccent } from '@/lib/categoryAccent';
import VelmIcon from '@/components/VelmIcon';
import LoginView, { AppUser } from '@/components/LoginView';

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? 'https://bridge-three-coral.vercel.app';
const DEFAULT_CATEGORIES = ['Allgemein', 'Arbeit', 'Privat', 'Ideen', 'Einkauf'];
const RECURRENCES = [
  { value: 'once', label: 'Einmalig' },
  { value: 'daily', label: 'Täglich' },
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'monthly', label: 'Monatlich' },
];

type Capture = { title: string; text: string; url: string; host: string; pageTitle: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Liest {t: Seitentitel, u: URL, s: Auswahl} aus dem Fragment, das das Bookmarklet anhängt. */
function readCapture(): Capture | null {
  const raw = window.location.hash.slice(1);
  if (!raw) return null;
  try {
    const d = JSON.parse(decodeURIComponent(raw));
    const text = typeof d.s === 'string' ? d.s : '';
    const url = typeof d.u === 'string' ? d.u : '';
    const pageTitle = typeof d.t === 'string' ? d.t.trim() : '';
    const title = (text ? text.split('\n')[0] : pageTitle).trim().slice(0, 80);
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keine gültige URL */ }
    return { title, text, url, host, pageTitle };
  } catch {
    return null;
  }
}

/** Morgen 9:00 Uhr im Format von <input type="datetime-local">. */
function defaultReminder(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

function errorMessage(code: string | undefined): string {
  switch (code) {
    case 'unauthorized': return 'Deine Anmeldung ist abgelaufen. Bitte lade die Seite neu und melde dich erneut an.';
    case 'tier_required': return 'Das Bookmarklet ist ab dem Basic-Plan verfügbar.';
    case 'account_required': return 'Dafür brauchst du ein bestätigtes Velm-Konto.';
    case 'network': return 'Keine Verbindung. Bitte prüfe dein Internet und versuch es erneut.';
    case 'rate_limited': return 'Du hast heute schon 50 Notizen per Bookmarklet gespeichert. Morgen geht es weiter.';
    case 'content_too_long': return 'Der Text ist zu lang (höchstens 50.000 Zeichen). Bitte kürze ihn.';
    case 'invalid_reminder': return 'Das Datum der Erinnerung ist ungültig.';
    default: return 'Speichern fehlgeschlagen. Bitte versuch es erneut.';
  }
}

// Nur im Browser rendern: das Fragment mit dem markierten Text gibt es serverseitig nicht.
export default dynamic(() => Promise.resolve(BookmarkletSavePage), { ssr: false });

function BookmarkletSavePage() {
  const [capture] = useState<Capture | null>(readCapture);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [title, setTitle] = useState(capture?.title ?? '');
  const [text, setText] = useState(capture?.text ?? '');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [category, setCategory] = useState('Allgemein');
  const [feedsThreads, setFeedsThreads] = useState(false);
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderAt, setReminderAt] = useState('');
  const [recurrence, setRecurrence] = useState('once');

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [closeFailed, setCloseFailed] = useState(false);
  const [tierBlocked, setTierBlocked] = useState(false);

  useEffect(() => {
    // Markierter Text soll nicht im Browser-Verlauf stehen bleiben.
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        setUser({ id: u.id, email: u.email!, name: u.email!.split('@')[0], initial: u.email![0].toUpperCase() });
      }
    }).catch(() => {}).finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!user || user.isDemo) return;
    // Nur zur Anzeige vorab; die verbindliche Tarifprüfung macht die Bridge beim Speichern.
    fetchTier(user.id).then((tier) => {
      if (tier !== null && !hasBookmarklet(tier)) setTierBlocked(true);
    });
    // Die neuesten 1000 Notizen reichen für die Kategorienliste; mehr liefert PostgREST ohnehin nicht.
    supabase.from('notes').select('category').eq('user_id', user.id)
      .order('updated_at', { ascending: false }).limit(1000).then(({ data }) => {
      const used = (data ?? []).map((r: { category: string | null }) => r.category).filter((c): c is string => !!c);
      const extra = [...new Set(used)].filter((c) => !DEFAULT_CATEGORIES.includes(c)).sort((a, b) => a.localeCompare(b, 'de'));
      setCategories([...DEFAULT_CATEGORIES, ...extra]);
    });
  }, [user]);

  const closeWindow = () => {
    window.close();
    // Hat der Browser das Schließen verweigert, läuft dieser Code noch.
    setTimeout(() => setCloseFailed(true), 300);
  };

  const toggleReminder = () => {
    if (!reminderOn && !reminderAt) setReminderAt(defaultReminder());
    setReminderOn((on) => !on);
  };

  const saving = saveState === 'saving';

  const save = async () => {
    if (saving) return;
    setSaveState('saving');
    setErrorCode(undefined);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSaveState('error'); setErrorCode('unauthorized'); return; }
      // Die Quelle wird wie bisher an den Inhalt angehängt, im Formular steht sie nur als Hinweis.
      const url = capture?.url ?? '';
      const body: Record<string, unknown> = {
        title: title.trim() || 'Notiz aus Bookmarklet',
        content: text.trim() ? (url ? `${text}\n\nQuelle: ${url}` : text) : url,
        category,
        feeds_threads: feedsThreads,
      };
      if (reminderOn && reminderAt) {
        body.reminder_at = new Date(reminderAt).toISOString();
        body.reminder_recurrence = recurrence;
      }
      const res = await fetch(`${BRIDGE_URL}/api/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveState('error'); setErrorCode(json?.error); return; }
      setSaveState('saved');
      setTimeout(closeWindow, 1200);
    } catch {
      setSaveState('error');
      setErrorCode('network');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
    else if (e.key === 'Escape' && !saving) closeWindow();
  };

  if (authLoading) {
    return <div style={s.center}><div style={s.spinner} /></div>;
  }

  if (!user) return <LoginView onLogin={setUser} />;

  const header = (
    <header style={s.header}>
      <VelmIcon size={30} radius={8} />
      <div style={{ minWidth: 0 }}>
        <div style={s.headerTitle}>In Velm speichern</div>
        <div style={s.headerSub}>{user.email}</div>
      </div>
    </header>
  );

  const notice = (content: React.ReactNode) => (
    <div style={s.shell}>
      {header}
      <main style={{ ...s.body, justifyContent: 'center' }}>
        <div className="velm-rise" style={s.noticeCard}>{content}</div>
      </main>
    </div>
  );

  if (user.isDemo) {
    return notice(<p style={s.noticeText}>Das Bookmarklet braucht ein echtes Velm-Konto. Bitte melde dich mit deinem Konto an.</p>);
  }

  if (tierBlocked) {
    return notice(
      <>
        <p style={s.noticeTitle}>Ab dem Basic-Plan</p>
        <p style={s.noticeText}>Upgraden kannst du in der Velm-App unter Einstellungen → Mein Abo.</p>
      </>,
    );
  }

  if (!capture) {
    return notice(
      <>
        <p style={s.noticeText}>Dieses Fenster öffnet sich über das Velm-Bookmarklet. Markiere Text auf einer Webseite und klick das Lesezeichen.</p>
        <Link href="/bookmarklet" style={s.link}>Bookmarklet einrichten →</Link>
      </>,
    );
  }

  if (saveState === 'saved') {
    return (
      <div style={{ ...s.shell, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <svg className="velm-pop" width="64" height="64" viewBox="0 0 64 64" style={{ animation: 'velm-pop 0.45s ease-out both' }}>
          <circle cx="32" cy="32" r="30" fill="rgba(244,162,97,0.14)" stroke="rgba(244,162,97,0.5)" strokeWidth="1.5" />
          <path
            className="velm-draw" d="M20 33 L28.5 41 L44 24" fill="none" stroke="#F4A261" strokeWidth="3.5"
            strokeLinecap="round" strokeLinejoin="round" strokeDasharray="40" strokeDashoffset="40"
            style={{ animation: 'velm-draw 0.35s 0.25s ease-out forwards' }}
          />
        </svg>
        <div style={s.savedTitle}>Gespeichert</div>
        <div style={s.savedSub}>
          <span style={{ ...s.dot, background: categoryAccent(category) }} />
          {category}
        </div>
        <p style={{ ...s.hint, marginTop: 8 }}>
          {closeFailed ? 'Du kannst dieses Fenster jetzt schließen.' : 'Fenster schließt sich…'}
        </p>
      </div>
    );
  }

  return (
    <div style={s.shell} onKeyDown={onKeyDown}>
      {header}

      <main className="velm-scroll" style={s.body}>
        <div className="velm-rise" style={{ animation: 'velm-rise 0.3s ease-out both' }}>
          {capture.host && (
            <div style={s.source} title={`Wird als Quelle angehängt: ${capture.url}`}>
              <span style={s.sourceHost}>{capture.host}</span>
              {capture.pageTitle && <span style={s.sourceTitle}>· {capture.pageTitle}</span>}
            </div>
          )}

          <input
            className="velm-field" style={s.titleInput} value={title} maxLength={200}
            placeholder="Titel" onChange={(e) => setTitle(e.target.value)} autoFocus
          />

          <textarea
            className="velm-field velm-scroll" style={s.textArea} rows={6} value={text}
            placeholder={capture.url ? 'Eigene Gedanken dazu… (sonst wird nur der Link gespeichert)' : 'Notiz…'}
            onChange={(e) => setText(e.target.value)}
          />

          <div style={s.sectionLabel}>Kategorie</div>
          <div style={s.chips}>
            {categories.map((c) => {
              const active = c === category;
              const accent = categoryAccent(c);
              return (
                <button
                  key={c} type="button" className="velm-hover" onClick={() => setCategory(c)}
                  style={{ ...s.chip, ...(active ? { background: `${accent}1F`, borderColor: `${accent}80`, color: '#F2EDE6', fontWeight: 600 } : {}) }}
                >
                  <span style={{ ...s.dot, background: accent, opacity: active ? 1 : 0.55 }} />
                  {c}
                </button>
              );
            })}
          </div>

          <div style={s.options}>
            <div style={s.optionRow}>
              <div>
                <div style={s.optionLabel}>KI darf darauf zugreifen</div>
                <div style={s.optionSub}>Für Threads und Synthese verwenden</div>
              </div>
              <Switch on={feedsThreads} onToggle={() => setFeedsThreads((v) => !v)} label="KI darf darauf zugreifen" />
            </div>

            <div style={s.divider} />

            <div style={s.optionRow}>
              <div>
                <div style={s.optionLabel}>Erinnerung</div>
                <div style={s.optionSub}>
                  {reminderOn && reminderAt
                    ? new Date(reminderAt).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : 'Benachrichtigung in der App'}
                </div>
              </div>
              <Switch on={reminderOn} onToggle={toggleReminder} label="Erinnerung" />
            </div>

            {reminderOn && (
              <div className="velm-rise" style={{ ...s.reminderBox, animation: 'velm-rise 0.2s ease-out both' }}>
                <input
                  type="datetime-local" className="velm-field" value={reminderAt}
                  onChange={(e) => setReminderAt(e.target.value)} style={s.dateInput}
                />
                <div style={s.segment}>
                  {RECURRENCES.map((r) => (
                    <button
                      key={r.value} type="button" onClick={() => setRecurrence(r.value)}
                      style={{ ...s.segmentBtn, ...(recurrence === r.value ? s.segmentActive : {}) }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {saveState === 'error' && <div className="velm-rise" style={s.errorBox}>{errorMessage(errorCode)}</div>}
          {closeFailed && <p style={{ ...s.hint, marginTop: 12 }}>Du kannst dieses Fenster jetzt schließen.</p>}
        </div>
      </main>

      <footer style={s.footer}>
        <span style={s.hint}>Strg + Enter speichert</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="velm-hover" onClick={closeWindow} style={s.ghostBtn} disabled={saving}>Abbrechen</button>
          <button type="button" className="velm-primary" onClick={save} style={{ ...s.primaryBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
            {saving && <span style={s.btnSpinner} />}
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
      </footer>
    </div>
  );
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle}
      style={{ ...s.track, background: on ? '#F4A261' : 'rgba(255,255,255,0.12)' }}
    >
      <span style={{ ...s.thumb, transform: on ? 'translateX(20px)' : 'translateX(2px)' }} />
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  // Die Webapp sperrt das Seiten-Scrollen global, daher eigene Spalte mit scrollendem Mittelteil.
  shell: {
    position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
    background: 'radial-gradient(120% 60% at 100% 0%, rgba(244,162,97,0.07), transparent 60%), #0E0C09',
    fontFamily: "'Inter', sans-serif", color: '#F2EDE6',
  },
  center: {
    position: 'fixed', inset: 0, background: '#0E0C09',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  header: {
    display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
    padding: '14px 22px', borderBottom: '1px solid rgba(255,220,160,0.08)',
  },
  headerTitle: { fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.2 },
  headerSub: { fontSize: 11.5, color: 'rgba(160,144,128,0.7)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  body: { flex: 1, overflowY: 'auto', padding: '18px 22px 22px', display: 'flex', flexDirection: 'column' },

  source: {
    display: 'flex', alignItems: 'baseline', gap: 6, maxWidth: '100%', marginBottom: 10,
    fontSize: 12, color: 'rgba(160,144,128,0.75)', whiteSpace: 'nowrap', overflow: 'hidden',
  },
  sourceHost: {
    flexShrink: 0, padding: '2px 8px', borderRadius: 6, color: '#F4A261', fontWeight: 600,
    background: 'rgba(244,162,97,0.1)', border: '1px solid rgba(244,162,97,0.2)',
  },
  sourceTitle: { overflow: 'hidden', textOverflow: 'ellipsis' },

  titleInput: {
    width: '100%', padding: '6px 2px', marginBottom: 10,
    background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,220,160,0.12)', borderRadius: 0,
    fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em',
    color: '#F2EDE6', outline: 'none',
  },
  textArea: {
    width: '100%', padding: '12px 14px', resize: 'vertical', minHeight: 110,
    background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,220,160,0.1)',
    borderLeft: '3px solid rgba(244,162,97,0.45)', borderRadius: 8,
    fontSize: 14, lineHeight: 1.65, color: 'rgba(242,237,230,0.88)', fontFamily: "'Inter', sans-serif", outline: 'none',
  },

  sectionLabel: {
    margin: '20px 0 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
    color: 'rgba(160,144,128,0.6)',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
    background: 'transparent', border: '1px solid rgba(255,220,160,0.14)',
    color: 'rgba(210,198,184,0.85)', fontSize: 12.5, fontFamily: "'Inter', sans-serif",
  },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },

  options: {
    marginTop: 20, padding: '4px 14px', borderRadius: 10,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,220,160,0.08)',
  },
  optionRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0' },
  optionLabel: { fontSize: 13, fontWeight: 500, color: '#F2EDE6' },
  optionSub: { fontSize: 11.5, color: 'rgba(160,144,128,0.6)', marginTop: 2 },
  divider: { height: 1, background: 'rgba(255,220,160,0.07)' },

  track: {
    width: 42, height: 24, borderRadius: 12, border: 'none', padding: 0, flexShrink: 0,
    position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
  },
  thumb: {
    position: 'absolute', top: 3, left: 0, width: 18, height: 18, borderRadius: '50%', display: 'block',
    background: '#F2EDE6', boxShadow: '0 1px 3px rgba(0,0,0,0.4)', transition: 'transform 0.2s',
  },

  reminderBox: { display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 },
  dateInput: {
    width: '100%', padding: '9px 12px', colorScheme: 'dark',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,220,160,0.12)', borderRadius: 8,
    fontSize: 13.5, color: '#F2EDE6', fontFamily: "'Inter', sans-serif", outline: 'none',
  },
  segment: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, padding: 2, borderRadius: 8,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,220,160,0.1)',
  },
  segmentBtn: {
    padding: '7px 4px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 12, color: 'rgba(160,144,128,0.85)', fontFamily: "'Inter', sans-serif", transition: 'background 0.15s, color 0.15s',
  },
  segmentActive: { background: 'rgba(244,162,97,0.16)', color: '#F4A261', fontWeight: 600 },

  errorBox: {
    marginTop: 16, fontSize: 13, color: '#E88080', lineHeight: 1.5,
    padding: '9px 13px', background: 'rgba(232,128,128,0.08)',
    border: '1px solid rgba(232,128,128,0.2)', borderRadius: 8,
  },

  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0,
    padding: '12px 22px', borderTop: '1px solid rgba(255,220,160,0.08)', background: 'rgba(14,12,9,0.92)',
  },
  hint: { fontSize: 11.5, color: 'rgba(160,144,128,0.55)' },
  ghostBtn: {
    padding: '9px 16px', background: 'transparent', color: 'rgba(160,144,128,0.8)',
    border: '1px solid rgba(255,220,160,0.12)', borderRadius: 8,
    fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '9px 22px', background: '#F4A261', color: '#0E0C09',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Inter', sans-serif", boxShadow: '0 0 16px rgba(244,162,97,0.22)',
  },
  btnSpinner: {
    width: 12, height: 12, borderRadius: '50%',
    border: '2px solid #0E0C09', borderTopColor: 'transparent',
    animation: 'velm-spin 0.8s linear infinite',
  },

  noticeCard: {
    padding: '18px 20px', borderRadius: 12,
    background: 'rgba(22,18,14,0.98)', border: '1px solid rgba(255,220,160,0.12)',
  },
  noticeTitle: { fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 18, fontWeight: 500, marginBottom: 6 },
  noticeText: { fontSize: 13.5, lineHeight: 1.55, color: 'rgba(210,198,184,0.9)' },
  link: { display: 'inline-block', marginTop: 14, fontSize: 13, color: '#F4A261', textDecoration: 'none', fontWeight: 600 },

  savedTitle: { fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 24, fontWeight: 500, letterSpacing: '-0.01em' },
  savedSub: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'rgba(210,198,184,0.8)' },

  spinner: {
    width: 22, height: 22, borderRadius: '50%',
    border: '2px solid #F4A261', borderTopColor: 'transparent',
    animation: 'velm-spin 0.8s linear infinite',
  },
};
