'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import VelmIcon from '@/components/VelmIcon';
import LoginView, { AppUser } from '@/components/LoginView';

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? 'https://bridge-three-coral.vercel.app';
const DEFAULT_CATEGORIES = ['Allgemein', 'Arbeit', 'Privat', 'Ideen', 'Einkauf'];

type Capture = { title: string; content: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Liest {t: Seitentitel, u: URL, s: Auswahl} aus dem Fragment, das das Bookmarklet anhängt. */
function readCapture(): Capture | null {
  const raw = window.location.hash.slice(1);
  if (!raw) return null;
  try {
    const d = JSON.parse(decodeURIComponent(raw));
    const sel = typeof d.s === 'string' ? d.s : '';
    const url = typeof d.u === 'string' ? d.u : '';
    const pageTitle = typeof d.t === 'string' ? d.t : '';
    const title = (sel ? sel.split('\n')[0] : pageTitle).trim().slice(0, 80);
    const content = sel ? (url ? `${sel}\n\nQuelle: ${url}` : sel) : url;
    return { title, content };
  } catch {
    return null;
  }
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
  const [content, setContent] = useState(capture?.content ?? '');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [category, setCategory] = useState('Allgemein');
  const [feedsThreads, setFeedsThreads] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
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
    supabase.from('profiles').select('tier').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data?.tier === 'free') setTierBlocked(true);
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

  const save = async () => {
    setSaveState('saving');
    setErrorCode(undefined);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSaveState('error'); setErrorCode('unauthorized'); return; }
      const body: Record<string, unknown> = {
        title: title.trim() || 'Notiz aus Bookmarklet',
        content,
        category,
        feeds_threads: feedsThreads,
      };
      if (reminderOpen && reminderAt) {
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
      setTimeout(closeWindow, 900);
    } catch {
      setSaveState('error');
      setErrorCode('network');
    }
  };

  if (authLoading) {
    return <div style={s.center}><div style={s.spinner} /></div>;
  }

  if (!user) return <LoginView onLogin={setUser} />;

  const header = (
    <div style={s.logo}>
      <VelmIcon size={30} radius={8} />
      <div>
        <div style={s.logoName}>In Velm speichern</div>
        <div style={s.logoSub}>{user.email}</div>
      </div>
    </div>
  );

  if (user.isDemo) {
    return (
      <div style={s.page}><div style={s.card}>
        {header}
        <div style={s.warnBox}>Das Bookmarklet braucht ein echtes Velm-Konto. Bitte melde dich mit deinem Konto an.</div>
      </div></div>
    );
  }

  if (tierBlocked) {
    return (
      <div style={s.page}><div style={s.card}>
        {header}
        <div style={s.warnBox}>Das Bookmarklet ist ab dem Basic-Plan verfügbar. Upgraden kannst du in der Velm-App unter Einstellungen → Mein Abo.</div>
      </div></div>
    );
  }

  if (!capture) {
    return (
      <div style={s.page}><div style={s.card}>
        {header}
        <p style={s.text}>Diese Seite öffnet sich über das Velm-Bookmarklet. Markiere Text auf einer Webseite und klick das Lesezeichen.</p>
        <Link href="/bookmarklet" style={s.link}>Bookmarklet einrichten →</Link>
      </div></div>
    );
  }

  if (saveState === 'saved') {
    return (
      <div style={s.page}><div style={{ ...s.card, textAlign: 'center' }}>
        <div style={s.check}>✅</div>
        <p style={s.savedText}>Notiz gespeichert</p>
        {closeFailed && <p style={s.text}>Du kannst dieses Fenster jetzt schließen.</p>}
      </div></div>
    );
  }

  const saving = saveState === 'saving';

  return (
    <div style={s.page}>
      <div style={s.card}>
        {header}

        <label style={s.label}>Titel</label>
        <input style={s.input} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} autoFocus />

        <label style={s.label}>Inhalt</label>
        <textarea style={{ ...s.input, resize: 'vertical' }} rows={4} value={content} onChange={(e) => setContent(e.target.value)} />

        <label style={s.label}>Kategorie</label>
        <div style={s.chips}>
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} style={{ ...s.chip, ...(c === category ? s.chipActive : {}) }}>
              {c}
            </button>
          ))}
        </div>

        <label style={s.toggleRow}>
          <input type="checkbox" checked={feedsThreads} onChange={(e) => setFeedsThreads(e.target.checked)} style={s.checkbox} />
          KI darf darauf zugreifen
        </label>

        <button type="button" onClick={() => setReminderOpen((o) => !o)} style={s.reminderToggle}>
          {reminderOpen ? '✕ Erinnerung entfernen' : '⏰ Erinnerung hinzufügen'}
        </button>
        {reminderOpen && (
          <div style={s.reminderRow}>
            <input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} style={{ ...s.input, colorScheme: 'dark' }} />
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} style={{ ...s.input, colorScheme: 'dark' }}>
              <option value="once">Einmalig</option>
              <option value="daily">Täglich</option>
              <option value="weekly">Wöchentlich</option>
              <option value="monthly">Monatlich</option>
            </select>
          </div>
        )}

        {saveState === 'error' && <div style={s.errorBox}>{errorMessage(errorCode)}</div>}

        <div style={s.footer}>
          <button type="button" onClick={closeWindow} style={s.ghostBtn} disabled={saving}>Abbrechen</button>
          <button type="button" onClick={save} style={{ ...s.primaryBtn, opacity: saving ? 0.6 : 1 }} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
        {closeFailed && <p style={{ ...s.text, marginTop: 10 }}>Du kannst dieses Fenster jetzt schließen.</p>}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: '#0E0C09',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    fontFamily: "'Inter', sans-serif", padding: 12,
  },
  center: {
    position: 'fixed', inset: 0, background: '#0E0C09',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    background: 'rgba(22,18,14,0.98)',
    border: '1px solid rgba(255,220,160,0.12)',
    borderRadius: 14, padding: '22px 24px',
    width: 560, maxWidth: '100%',
    boxShadow: '0 8px 48px rgba(0,0,0,0.55)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 },
  logoName: { fontSize: 16, fontWeight: 600, color: '#F2EDE6', lineHeight: 1.2 },
  logoSub: { fontSize: 12, color: 'rgba(160,144,128,0.7)', marginTop: 1 },

  label: {
    display: 'block', fontSize: 10, fontWeight: 700,
    color: 'rgba(160,144,128,0.6)', margin: '16px 0 6px',
    letterSpacing: '0.07em', textTransform: 'uppercase',
  },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '10px 13px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,220,160,0.12)', borderRadius: 8,
    fontSize: 14, color: '#F2EDE6', fontFamily: "'Inter', sans-serif", outline: 'none', lineHeight: 1.5,
  },

  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '6px 13px', borderRadius: 20, cursor: 'pointer',
    background: 'transparent', border: '1px solid rgba(255,220,160,0.15)',
    color: 'rgba(210,198,184,0.85)', fontSize: 12.5, fontFamily: "'Inter', sans-serif",
  },
  chipActive: { background: 'rgba(244,162,97,0.15)', border: '1px solid rgba(244,162,97,0.5)', color: '#F4A261', fontWeight: 600 },

  toggleRow: { display: 'flex', alignItems: 'center', gap: 9, marginTop: 18, fontSize: 13.5, color: 'rgba(210,198,184,0.9)', cursor: 'pointer' },
  checkbox: { width: 16, height: 16, accentColor: '#F4A261', cursor: 'pointer' },

  reminderToggle: {
    display: 'block', marginTop: 14, padding: 0, background: 'none', border: 'none',
    color: '#F4A261', fontSize: 13, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },
  reminderRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 },

  errorBox: {
    marginTop: 16, fontSize: 13, color: '#E88080', lineHeight: 1.5,
    padding: '9px 13px', background: 'rgba(232,128,128,0.08)',
    border: '1px solid rgba(232,128,128,0.2)', borderRadius: 8,
  },
  warnBox: {
    fontSize: 13, color: '#F4C77E', lineHeight: 1.5,
    padding: '12px 14px', background: 'rgba(244,199,126,0.08)',
    border: '1px solid rgba(244,199,126,0.2)', borderRadius: 8,
  },

  footer: { display: 'flex', gap: 10, marginTop: 24 },
  ghostBtn: {
    flex: 1, padding: 11, background: 'transparent', color: 'rgba(160,144,128,0.8)',
    border: '1px solid rgba(255,220,160,0.12)', borderRadius: 10,
    fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },
  primaryBtn: {
    flex: 2, padding: 11, background: '#F4A261', color: '#0E0C09',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Inter', sans-serif", boxShadow: '0 0 20px rgba(244,162,97,0.25)',
  },

  text: { fontSize: 13.5, lineHeight: 1.55, color: 'rgba(210,198,184,0.9)' },
  link: { display: 'inline-block', marginTop: 14, fontSize: 13, color: '#F4A261', textDecoration: 'none', fontWeight: 600 },
  check: { fontSize: 44 },
  savedText: { marginTop: 10, fontSize: 16, fontWeight: 600, color: '#F2EDE6' },

  spinner: {
    width: 22, height: 22, borderRadius: '50%',
    border: '2px solid #F4A261', borderTopColor: 'transparent',
    animation: 'velm-spin 0.8s linear infinite',
  },
};
