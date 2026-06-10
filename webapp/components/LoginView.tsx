'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import VelmIcon from '@/components/VelmIcon';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  initial: string;
  isDemo?: boolean;
}

interface Props {
  onLogin: (user: AppUser) => void;
}

export default function LoginView({ onLogin }: Props) {
  const [mode, setMode]           = useState<'login' | 'register'>('login');
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwVisible, setPwVisible] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const reset = () => {
    setName(''); setEmail(''); setPassword(''); setConfirmPw('');
    setError(''); setLoading(false); setPwVisible(false);
  };
  const switchMode = (m: 'login' | 'register') => { reset(); setMode(m); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Bitte alle Felder ausfüllen.'); return; }
    setLoading(true); setError('');
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err || !data.user) {
      setError(err?.message ?? 'Anmeldung fehlgeschlagen.');
      setLoading(false); return;
    }
    const u = data.user;
    onLogin({ id: u.id, email: u.email!, name: u.email!.split('@')[0], initial: u.email![0].toUpperCase() });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) { setError('Bitte alle Felder ausfüllen.'); return; }
    if (password !== confirmPw)        { setError('Passwörter stimmen nicht überein.'); return; }
    if (password.length < 6)           { setError('Passwort muss mind. 6 Zeichen lang sein.'); return; }
    setLoading(true); setError('');
    const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } });
    if (err || !data.user) {
      setError(err?.message ?? 'Registrierung fehlgeschlagen.');
      setLoading(false); return;
    }
    const u = data.user;
    onLogin({ id: u.id, email: u.email!, name: name.trim(), initial: name.trim()[0].toUpperCase() });
  };

  const demoLogin = () => {
    onLogin({ id: 'demo', email: 'demo@velm.app', name: 'Demo', initial: 'D', isDemo: true });
  };

  const isReg = mode === 'register';

  return (
    <div style={s.page}>
      {/* subtle grid */}
      <svg style={s.gridBg} width="100%" height="100%">
        <defs>
          <pattern id="lgrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,220,160,0.07)" strokeWidth="0.6"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lgrid)" />
      </svg>

      <div style={s.card}>
        {/* Logo */}
        <div style={s.logo}>
          <VelmIcon size={40} radius={10} />
          <div>
            <div style={s.logoName}>Velm</div>
            <div style={s.logoSub}>Second Brain</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(mode === 'login' ? s.tabActive : {}) }} onClick={() => switchMode('login')}>
            Anmelden
          </button>
          <button style={{ ...s.tab, ...(mode === 'register' ? s.tabActive : {}) }} onClick={() => switchMode('register')}>
            Registrieren
          </button>
        </div>

        <form onSubmit={isReg ? handleRegister : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {isReg && (
            <div>
              <label style={s.label}>Name</label>
              <input type="text" value={name} autoFocus onChange={e => { setName(e.target.value); setError(''); }} style={s.input} placeholder="Max Mustermann" />
            </div>
          )}
          <div>
            <label style={s.label}>E-Mail</label>
            <input type="email" value={email} autoFocus={!isReg} onChange={e => { setEmail(e.target.value); setError(''); }} style={s.input} placeholder="name@beispiel.de" />
          </div>
          <div>
            <label style={s.label}>Passwort</label>
            <div style={{ position: 'relative' }}>
              <input type={pwVisible ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }} style={{ ...s.input, paddingRight: 40 }} placeholder="••••••••" />
              <button type="button" onClick={() => setPwVisible(v => !v)} style={s.pwEye}>
                {pwVisible ? '👁' : '👁'}
              </button>
            </div>
          </div>
          {isReg && (
            <div>
              <label style={s.label}>Passwort bestätigen</label>
              <input type={pwVisible ? 'text' : 'password'} value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setError(''); }} style={s.input} placeholder="••••••••" />
            </div>
          )}

          {error && <div style={s.errorBox}>{error}</div>}

          <button type="submit" disabled={loading} style={{ ...s.primaryBtn, opacity: loading ? 0.6 : 1 }}>
            {loading
              ? (isReg ? 'Konto wird erstellt…' : 'Anmelden…')
              : (isReg ? 'Konto erstellen →' : 'Anmelden →')}
          </button>
        </form>

        {!isReg && (
          <>
            <div style={s.divider}><span style={s.dividerInner}>oder</span></div>
            <button onClick={demoLogin} style={s.ghostBtn}>Demo-Zugang verwenden</button>
          </>
        )}

        <p style={s.switchHint}>
          {isReg
            ? <> Bereits ein Konto?{' '}<button style={s.switchLink} onClick={() => switchMode('login')}>Anmelden</button></>
            : <> Noch kein Konto?{' '}<button style={s.switchLink} onClick={() => switchMode('register')}>Registrieren</button></>
          }
        </p>
        {!isReg && <p style={s.footnote}>Daten bleiben lokal gespeichert.</p>}
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
  },
  gridBg: {
    position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
  },
  card: {
    position: 'relative', zIndex: 1,
    background: 'rgba(22,18,14,0.98)',
    border: '1px solid rgba(255,220,160,0.12)',
    borderRadius: 14,
    padding: '36px 44px 32px',
    width: 390,
    boxShadow: '0 8px 48px rgba(0,0,0,0.55)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 },
  logoName: { fontSize: 18, fontWeight: 600, color: '#F2EDE6', lineHeight: 1.2 },
  logoSub:  { fontSize: 12, color: 'rgba(160,144,128,0.7)', marginTop: 1 },

  tabs: {
    display: 'flex',
    background: 'rgba(255,255,255,0.04)', borderRadius: 9,
    padding: 3, marginBottom: 22,
    border: '1px solid rgba(255,220,160,0.08)',
  },
  tab: {
    flex: 1, padding: '7px 0',
    background: 'transparent', border: 'none', borderRadius: 7,
    fontSize: 13, color: 'rgba(160,144,128,0.7)', cursor: 'pointer',
    fontFamily: "'Inter', sans-serif", fontWeight: 500,
    transition: 'all 0.15s',
  },
  tabActive: {
    background: 'rgba(244,162,97,0.12)',
    color: '#F4A261',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },

  label: {
    display: 'block', fontSize: 10, fontWeight: 700,
    color: 'rgba(160,144,128,0.6)', marginBottom: 6,
    letterSpacing: '0.07em', textTransform: 'uppercase',
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 13px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,220,160,0.12)', borderRadius: 8,
    fontSize: 14, color: '#F2EDE6',
    fontFamily: "'Inter', sans-serif", outline: 'none',
    transition: 'border-color 0.15s',
  },
  pwEye: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(160,144,128,0.5)', fontSize: 12, padding: 4,
  },
  errorBox: {
    fontSize: 13, color: '#E88080',
    padding: '9px 13px', background: 'rgba(232,128,128,0.08)',
    border: '1px solid rgba(232,128,128,0.2)', borderRadius: 8,
  },
  primaryBtn: {
    width: '100%', padding: '11px',
    background: '#F4A261', color: '#0E0C09',
    border: 'none', borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    boxShadow: '0 0 20px rgba(244,162,97,0.25)',
    marginTop: 2, transition: 'opacity 0.15s',
  },
  divider: {
    textAlign: 'center', margin: '16px 0',
    borderTop: '1px solid rgba(255,220,160,0.08)', position: 'relative',
  },
  dividerInner: {
    background: 'rgba(22,18,14,0.98)', padding: '0 10px',
    position: 'relative', top: -10,
    fontSize: 12, color: 'rgba(160,144,128,0.5)',
  },
  ghostBtn: {
    width: '100%', padding: '10px',
    background: 'transparent', color: 'rgba(160,144,128,0.7)',
    border: '1px solid rgba(255,220,160,0.1)', borderRadius: 10,
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    transition: 'all 0.15s',
  },
  switchHint: {
    textAlign: 'center', fontSize: 12, color: 'rgba(160,144,128,0.5)', marginTop: 18,
  },
  switchLink: {
    background: 'none', border: 'none',
    color: '#F4A261', fontSize: 12, cursor: 'pointer',
    fontFamily: "'Inter', sans-serif", fontWeight: 600, padding: 0,
  },
  footnote: {
    textAlign: 'center', fontSize: 11, color: 'rgba(160,144,128,0.35)', marginTop: 8,
  },
};
