'use client';

import { useId } from 'react';
import { useI18n, type Locale } from '@/lib/i18n';

// Flaggen als SVG: Windows zeigt Flaggen-Emojis nur als Buchstaben („DE", „GB").
function FlagDE() {
  return (
    <svg viewBox="0 0 5 3" width="100%" height="100%" preserveAspectRatio="none" aria-hidden>
      <rect width="5" height="1" y="0" fill="#000" />
      <rect width="5" height="1" y="1" fill="#DD0000" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  );
}
function FlagGB() {
  const id = useId(), s = `${id}s`, t = `${id}t`;
  return (
    <svg viewBox="0 0 60 30" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <clipPath id={s}><path d="M0,0 v30 h60 v-30 z" /></clipPath>
      <clipPath id={t}><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
      <g clipPath={`url(#${s})`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${t})`} stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

const OPTIONS: Array<{ locale: Locale; label: string; Flag: () => React.ReactElement }> = [
  { locale: 'de', label: 'Deutsch', Flag: FlagDE },
  { locale: 'en', label: 'English', Flag: FlagGB },
];

/** Sprachumschalter: zwei Flaggen, die aktive hell. Angemeldet wird die Wahl auch am Konto gespeichert. */
export default function LangSwitch() {
  const { locale, setLocale } = useI18n();
  return (
    <div role="group" aria-label="Sprache / Language" style={s.wrap}>
      {OPTIONS.map(({ locale: l, label, Flag }) => {
        const active = l === locale;
        return (
          <button
            key={l} type="button" onClick={() => !active && setLocale(l)}
            aria-label={label} aria-pressed={active} title={label}
            style={{ ...s.btn, ...(active ? s.active : {}) }}
          >
            <span style={{ ...s.flag, opacity: active ? 1 : 0.4, filter: active ? 'none' : 'grayscale(0.6)' }}><Flag /></span>
          </button>
        );
      })}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', alignItems: 'center', gap: 2, padding: 3, flexShrink: 0,
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 18, pointerEvents: 'all',
  },
  btn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 24, padding: 0,
    background: 'transparent', borderWidth: 1, borderStyle: 'solid', borderColor: 'transparent', borderRadius: 14, cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
  },
  active: { background: 'rgba(244,162,97,0.14)', borderColor: 'rgba(244,162,97,0.45)', cursor: 'default' },
  flag: { display: 'block', width: 18, height: 12, borderRadius: 2, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,0.12)', transition: 'opacity 0.15s' },
};
