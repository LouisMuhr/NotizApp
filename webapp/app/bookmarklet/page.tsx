'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { buildBookmarkletHref } from '@/lib/bookmarkletScript';
import VelmIcon from '@/components/VelmIcon';
import LoginView, { AppUser } from '@/components/LoginView';

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? 'https://bridge-three-coral.vercel.app';
const CATEGORIES = ['Allgemein', 'Arbeit', 'Privat', 'Ideen', 'Einkauf'];

type Status = 'loading' | 'ready' | 'account_required' | 'tier_required' | 'error';

export default function BookmarkletPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [status, setStatus] = useState<Status>('loading');
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        setUser({ id: u.id, email: u.email!, name: u.email!.split('@')[0], initial: u.email![0].toUpperCase() });
      }
    }).catch(() => {}).finally(() => setAuthLoading(false));
  }, []);

  const fetchToken = useCallback(async () => {
    if (!user) return;
    if (user.isDemo) { setStatus('account_required'); return; }
    setStatus('loading');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setStatus('account_required'); return; }
    try {
      const res = await fetch(`${BRIDGE_URL}/api/bookmarklet-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 403 && json?.error === 'tier_required') { setStatus('tier_required'); return; }
      if (res.status === 403 && json?.error === 'account_required') { setStatus('account_required'); return; }
      if (!res.ok || typeof json?.token !== 'string') { setStatus('error'); return; }
      const bookmarkletHref = buildBookmarkletHref(window.location.origin, BRIDGE_URL, json.token, CATEGORIES);
      setStatus('ready');
      // React blocks javascript: URLs set via the href prop as an XSS precaution.
      // Setting it directly on the DOM node after render bypasses that check safely,
      // since we built this string ourselves from a token we just fetched.
      requestAnimationFrame(() => {
        if (linkRef.current) linkRef.current.href = bookmarkletHref;
      });
    } catch {
      setStatus('error');
    }
  }, [user]);

  useEffect(() => { if (user) fetchToken(); }, [user, fetchToken]);

  if (authLoading) {
    return (
      <div style={s.center}>
        <div style={s.spinner} />
      </div>
    );
  }

  if (!user) return <LoginView onLogin={setUser} />;

  return (
    <div style={s.page}>
      <div style={s.card}>
        <Link href="/" style={s.backLink}>← Zurück zum Graph</Link>
        <div style={s.logo}>
          <VelmIcon size={36} radius={9} />
          <div>
            <div style={s.logoName}>Velm Bookmarklet</div>
            <div style={s.logoSub}>Text markieren → Notiz speichern</div>
          </div>
        </div>

        {status === 'loading' && (
          <div style={s.statusBox}>
            <div style={s.spinner} />
            <p style={s.statusText}>Bookmarklet wird vorbereitet…</p>
          </div>
        )}

        {status === 'account_required' && (
          <div style={s.warnBox}>Dafür brauchst du ein bestätigtes Konto. Melde dich in der App oder hier mit deinem Konto an.</div>
        )}

        {status === 'tier_required' && (
          <div style={s.warnBox}>Das Bookmarklet ist ab dem Basic-Plan verfügbar.</div>
        )}

        {status === 'error' && (
          <div style={s.warnBox}>
            Bookmarklet konnte nicht vorbereitet werden.{' '}
            <button onClick={fetchToken} style={s.retryLink}>Erneut versuchen</button>
          </div>
        )}

        {status === 'ready' && (
          <>
            <p style={s.body}>
              Zieh diesen Link in deine Lesezeichen-Leiste. Markiere danach auf jeder Webseite Text und klick den Link —
              ein Panel lässt dich Titel, Kategorie und optional eine Erinnerung setzen, bevor die Notiz sofort in Velm landet.
            </p>
            <div style={s.dragRow}>
              <a ref={linkRef} href="#" style={s.bm} onClick={(e) => e.preventDefault()}>📝 Velm</a>
              <span style={s.dragHint}>← in die Lesezeichen-Leiste ziehen</span>
            </div>
            <button onClick={fetchToken} style={s.regenBtn}>Neuen Schlüssel erzeugen</button>
            <p style={s.footnote}>
              Ein neuer Schlüssel macht bereits installierte Bookmarklets (z. B. auf anderen Geräten) ungültig.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    position: 'fixed', inset: 0,
    background: '#0E0C09',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', sans-serif",
    padding: 20,
  },
  center: {
    position: 'fixed', inset: 0, background: '#0E0C09',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    position: 'relative',
    background: 'rgba(22,18,14,0.98)',
    border: '1px solid rgba(255,220,160,0.12)',
    borderRadius: 14,
    padding: '32px 36px',
    width: 460,
    boxShadow: '0 8px 48px rgba(0,0,0,0.55)',
  },
  backLink: { display: 'inline-block', fontSize: 12, color: 'rgba(160,144,128,0.7)', textDecoration: 'none', marginBottom: 18 },
  logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 },
  logoName: { fontSize: 17, fontWeight: 600, color: '#F2EDE6', lineHeight: 1.2 },
  logoSub: { fontSize: 12, color: 'rgba(160,144,128,0.7)', marginTop: 1 },

  body: { fontSize: 13.5, lineHeight: 1.55, color: 'rgba(210,198,184,0.9)', marginBottom: 20 },

  statusBox: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' },
  statusText: { fontSize: 13, color: 'rgba(160,144,128,0.8)' },
  spinner: {
    width: 22, height: 22, borderRadius: '50%',
    border: '2px solid #F4A261', borderTopColor: 'transparent',
    animation: 'velm-spin 0.8s linear infinite',
  },

  warnBox: {
    fontSize: 13, color: '#F4C77E',
    padding: '12px 14px', background: 'rgba(244,199,126,0.08)',
    border: '1px solid rgba(244,199,126,0.2)', borderRadius: 8, lineHeight: 1.5,
  },

  dragRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 },
  bm: {
    display: 'inline-block',
    background: '#C8972B', color: 'white',
    padding: '12px 22px', borderRadius: 10,
    textDecoration: 'none', fontWeight: 600, fontSize: 14,
    cursor: 'grab', flexShrink: 0,
  },
  dragHint: { fontSize: 12.5, color: 'rgba(160,144,128,0.7)' },

  regenBtn: {
    background: 'transparent', color: 'rgba(160,144,128,0.7)',
    border: '1px solid rgba(255,220,160,0.1)', borderRadius: 8,
    fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    fontFamily: "'Inter', sans-serif", padding: '8px 14px',
  },
  footnote: { fontSize: 11, color: 'rgba(160,144,128,0.45)', marginTop: 10, lineHeight: 1.4 },

  retryLink: {
    background: 'none', border: 'none', color: '#F4A261',
    fontSize: 13, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
    fontWeight: 600, padding: 0, textDecoration: 'underline',
  },
};
