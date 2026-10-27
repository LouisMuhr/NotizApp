/**
 * Kleine Endlos-Animation: ein Mauszeiger zieht den „📝 Velm"-Button in die Lesezeichen-Leiste
 * eines angedeuteten Browserfensters. Reine CSS-Animation, bei „Bewegung reduzieren" statisch.
 */
const CSS = `
.bmdemo-cursor, .bmdemo-ghost, .bmdemo-mark { animation-duration: 5s; animation-iteration-count: infinite; }
.bmdemo-cursor { animation-name: bmdemo-cursor; }
.bmdemo-ghost { animation-name: bmdemo-ghost; }
.bmdemo-mark { animation-name: bmdemo-mark; }

@keyframes bmdemo-cursor {
  0%   { transform: translate(300px, 150px) scale(1); opacity: 0; animation-timing-function: ease-in-out; }
  5%   { transform: translate(300px, 150px) scale(1); opacity: 1; animation-timing-function: ease-in-out; }
  22%  { transform: translate(58px, 122px) scale(1); opacity: 1; }
  27%  { transform: translate(58px, 122px) scale(0.85); opacity: 1; animation-timing-function: ease-in-out; }
  56%  { transform: translate(144px, 34px) scale(0.85); opacity: 1; }
  61%  { transform: translate(144px, 34px) scale(1); opacity: 1; animation-timing-function: ease-in-out; }
  78%  { transform: translate(230px, 90px) scale(1); opacity: 1; }
  90%  { transform: translate(230px, 90px) scale(1); opacity: 1; }
  96%, 100% { transform: translate(230px, 90px) scale(1); opacity: 0; }
}
@keyframes bmdemo-ghost {
  0%, 26%  { transform: translate(24px, 112px); opacity: 0; animation-timing-function: ease-in-out; }
  27%  { transform: translate(24px, 112px); opacity: 0.9; animation-timing-function: ease-in-out; }
  56%  { transform: translate(110px, 22px); opacity: 0.9; }
  60%, 100% { transform: translate(110px, 22px); opacity: 0; }
}
@keyframes bmdemo-mark {
  0%, 58% { opacity: 0; transform: translate(118px, 25px) scale(0.6); }
  63%     { opacity: 1; transform: translate(118px, 25px) scale(1.08); }
  67%, 90% { opacity: 1; transform: translate(118px, 25px) scale(1); }
  97%, 100% { opacity: 0; transform: translate(118px, 25px) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .bmdemo-cursor, .bmdemo-ghost { animation: none; opacity: 0; }
  .bmdemo-mark { animation: none; opacity: 1; transform: translate(118px, 25px); }
}
`;

export default function BookmarkletDragDemo() {
  return (
    <div style={s.frame} aria-hidden="true">
      <style>{CSS}</style>
      <div style={s.titlebar}>
        <span style={{ ...s.dot, background: '#E8735A' }} />
        <span style={{ ...s.dot, background: '#E8B54A' }} />
        <span style={{ ...s.dot, background: '#6FBF73' }} />
        <span style={s.address} />
      </div>
      <div style={s.bar}>
        <span style={{ ...s.barItem, left: 10 }}>▢ Mail</span>
        <span style={{ ...s.barItem, left: 62 }}>▢ News</span>
      </div>

      <span style={s.lineLong} />
      <span style={s.lineShort} />
      <span style={s.source}>📝 Velm</span>

      <span className="bmdemo-mark" style={s.mark}>📝 Velm</span>
      <span className="bmdemo-ghost" style={s.ghost}>📝 Velm</span>
      <svg className="bmdemo-cursor" style={s.cursor} width="16" height="22" viewBox="0 0 16 22">
        <path d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L14 12 Z" fill="#fff" stroke="#0E0C09" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const pill: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0,
  background: '#C8972B', color: '#fff', fontWeight: 600,
  fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap',
};

const s: Record<string, React.CSSProperties> = {
  frame: {
    position: 'relative', width: 360, height: 170, maxWidth: '100%',
    background: '#1A1612', border: '1px solid rgba(255,220,160,0.14)', borderRadius: 10, overflow: 'hidden',
  },
  titlebar: { display: 'flex', alignItems: 'center', gap: 5, height: 22, padding: '0 8px', background: 'rgba(255,255,255,0.04)' },
  dot: { width: 7, height: 7, borderRadius: '50%', opacity: 0.8 },
  address: { flex: 1, height: 10, marginLeft: 8, borderRadius: 5, background: 'rgba(255,255,255,0.07)' },
  bar: { position: 'relative', height: 24, borderBottom: '1px solid rgba(255,220,160,0.08)', background: 'rgba(255,255,255,0.025)' },
  barItem: { position: 'absolute', top: 5, fontSize: 10, color: 'rgba(160,144,128,0.6)', fontFamily: "'Inter', sans-serif" },
  lineLong: { position: 'absolute', left: 24, top: 66, width: 230, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.06)' },
  lineShort: { position: 'absolute', left: 24, top: 82, width: 160, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.06)' },
  source: { ...pill, transform: 'translate(24px, 112px)', fontSize: 11, padding: '6px 11px', borderRadius: 7 },
  ghost: { ...pill, fontSize: 11, padding: '6px 11px', borderRadius: 7, boxShadow: '0 6px 16px rgba(0,0,0,0.45)', opacity: 0 },
  mark: { ...pill, fontSize: 10, padding: '2px 7px', borderRadius: 4, opacity: 0 },
  cursor: { position: 'absolute', top: 0, left: 0, zIndex: 2, opacity: 0, transformOrigin: '1px 1px' },
};
