'use client';

import { useEffect, useState } from 'react';
import VelmIcon from '@/components/VelmIcon';

type Status = 'saving' | 'ok' | 'error';

interface Payload {
  title: string;
  content: string;
  category: string;
  feeds_threads: boolean;
  bridgeUrl: string;
  token: string;
  reminder_at?: string;
  reminder_recurrence?: string;
}

function decodePayload(): Payload | null {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const data = params.get('data');
    if (!data) return null;
    const json = decodeURIComponent(escape(atob(decodeURIComponent(data))));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function BookmarkletSavePage() {
  const [status, setStatus] = useState<Status>('saving');
  const [errorCode, setErrorCode] = useState<string>('');

  useEffect(() => {
    const payload = decodePayload();
    if (!payload) { setStatus('error'); setErrorCode('invalid_data'); return; }

    const { bridgeUrl, token, ...body } = payload;
    fetch(`${bridgeUrl}/api/note?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (window.opener) {
          window.opener.postMessage({ source: 'velm-bookmarklet', ok, error: j?.error }, '*');
        }
        setStatus(ok ? 'ok' : 'error');
        setErrorCode(j?.error ?? '');
        if (ok) setTimeout(() => window.close(), 900);
      })
      .catch(() => {
        if (window.opener) {
          window.opener.postMessage({ source: 'velm-bookmarklet', ok: false, error: 'network' }, '*');
        }
        setStatus('error');
        setErrorCode('network');
      });
  }, []);

  return (
    <div style={s.page}>
      <VelmIcon size={32} radius={8} />
      {status === 'saving' && (
        <>
          <div style={s.spinner} />
          <p style={s.text}>Notiz wird gespeichert…</p>
        </>
      )}
      {status === 'ok' && <p style={s.text}>✅ Gespeichert — Fenster schließt sich…</p>}
      {status === 'error' && (
        <>
          <p style={s.text}>
            {errorCode === 'invalid_data' ? 'Ungültige Daten.' : 'Speichern fehlgeschlagen.'}
          </p>
          <button onClick={() => window.close()} style={s.closeBtn}>Schließen</button>
        </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    position: 'fixed', inset: 0, background: '#0E0C09',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 14, fontFamily: "'Inter', sans-serif", padding: 20, textAlign: 'center',
  },
  text: { fontSize: 13.5, color: 'rgba(210,198,184,0.9)' },
  spinner: {
    width: 22, height: 22, borderRadius: '50%',
    border: '2px solid #F4A261', borderTopColor: 'transparent',
    animation: 'velm-spin 0.8s linear infinite',
  },
  closeBtn: {
    background: 'transparent', color: 'rgba(160,144,128,0.8)',
    border: '1px solid rgba(255,220,160,0.15)', borderRadius: 8,
    fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    fontFamily: "'Inter', sans-serif", padding: '8px 14px',
  },
};
