'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { buildBookmarkletHref } from '@/lib/bookmarkletScript';
import { fetchTier, hasBookmarklet, type Tier } from '@/lib/tier';
import VelmIcon from '@/components/VelmIcon';
import BookmarkletDragDemo from '@/components/BookmarkletDragDemo';
import LoginView, { AppUser } from '@/components/LoginView';
import { useI18n } from '@/lib/i18n';

export default function BookmarkletPage() {
  const { t } = useI18n();
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tierCheck, setTierCheck] = useState<{ userId: string; tier: Tier | null } | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        setUser({ id: u.id, email: u.email!, name: u.email!.split('@')[0], initial: u.email![0].toUpperCase() });
      }
    }).catch(() => {}).finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!user || user.isDemo) return;
    const userId = user.id;
    fetchTier(userId).then((tier) => setTierCheck({ userId, tier }));
  }, [user]);

  if (authLoading) {
    return (
      <div style={s.center}>
        <div style={s.spinner} />
      </div>
    );
  }

  if (!user) return <LoginView onLogin={setUser} />;

  const tier = tierCheck?.userId === user.id ? tierCheck.tier : undefined;

  return (
    <div style={s.page}>
      <div style={s.card}>
        <Link href="/" style={s.backLink}>{t.bookmarklet.back}</Link>
        <div style={s.logo}>
          <VelmIcon size={36} radius={9} />
          <div>
            <div style={s.logoName}>{t.bookmarklet.name}</div>
            <div style={s.logoSub}>{t.bookmarklet.sub}</div>
          </div>
        </div>

        {user.isDemo ? (
          <div style={s.warnBox}>{t.bookmarklet.needsAccount}</div>
        ) : tier === undefined ? (
          <div style={s.statusRow}><div style={s.spinner} /><span style={s.statusText}>{t.bookmarklet.checkingTier}</span></div>
        ) : tier === null ? (
          <div style={s.warnBox}>{t.bookmarklet.tierUnknown}</div>
        ) : !hasBookmarklet(tier) ? (
          <div style={s.warnBox}>{t.bookmarklet.tierLocked}</div>
        ) : (
          <>
            <p style={s.body}>{t.bookmarklet.intro}</p>
            <div style={s.dragRow}>
              {/* React blockt javascript:-URLs im href-Prop, daher direkt am DOM-Knoten setzen. */}
              <a
                ref={(el) => { if (el) el.href = buildBookmarkletHref(window.location.origin); }}
                href="#"
                style={s.bm}
                onClick={(e) => e.preventDefault()}
              >
                📝 Velm
              </a>
              <span style={s.dragHint}>{t.bookmarklet.dragHint}</span>
              <button
                type="button"
                aria-label={t.bookmarklet.howTo}
                style={s.help}
                onMouseEnter={() => setShowDemo(true)}
                onMouseLeave={() => setShowDemo(false)}
                onFocus={() => setShowDemo(true)}
                onBlur={() => setShowDemo(false)}
              >
                ?
              </button>
              {showDemo && (
                <div style={s.demoPopover} role="tooltip">
                  <BookmarkletDragDemo />
                  <p style={s.demoCaption}>{t.bookmarklet.demoCaption}</p>
                </div>
              )}
            </div>
            <p style={s.footnote}>{t.bookmarklet.noBar}</p>
            <p style={s.footnote}>{t.bookmarklet.loginNote(user.email)}</p>
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
    width: 460, maxWidth: '100%',
    boxShadow: '0 8px 48px rgba(0,0,0,0.55)',
  },
  backLink: { display: 'inline-block', fontSize: 12, color: 'rgba(160,144,128,0.7)', textDecoration: 'none', marginBottom: 18 },
  logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 },
  logoName: { fontSize: 17, fontWeight: 600, color: '#F2EDE6', lineHeight: 1.2 },
  logoSub: { fontSize: 12, color: 'rgba(160,144,128,0.7)', marginTop: 1 },

  body: { fontSize: 13.5, lineHeight: 1.55, color: 'rgba(210,198,184,0.9)', marginBottom: 20 },

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

  dragRow: { position: 'relative', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 },
  help: {
    width: 22, height: 22, flexShrink: 0, marginLeft: -6, padding: 0, borderRadius: '50%', cursor: 'help',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,220,160,0.25)',
    color: 'rgba(210,198,184,0.9)', fontSize: 12, fontWeight: 700, fontFamily: "'Inter', sans-serif",
  },
  demoPopover: {
    position: 'absolute', top: 'calc(100% + 10px)', left: 0, zIndex: 10,
    padding: 12, background: '#16120E', border: '1px solid rgba(255,220,160,0.16)', borderRadius: 12,
    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
  },
  demoCaption: { marginTop: 10, fontSize: 12, color: 'rgba(160,144,128,0.85)', textAlign: 'center' },
  bm: {
    display: 'inline-block',
    background: '#C8972B', color: 'white',
    padding: '12px 22px', borderRadius: 10,
    textDecoration: 'none', fontWeight: 600, fontSize: 14,
    cursor: 'grab', flexShrink: 0,
  },
  dragHint: { fontSize: 12.5, color: 'rgba(160,144,128,0.7)' },

  footnote: { fontSize: 11.5, color: 'rgba(160,144,128,0.55)', lineHeight: 1.5, marginBottom: 8 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 12 },
  statusText: { fontSize: 13, color: 'rgba(160,144,128,0.8)' },
};
