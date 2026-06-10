/**
 * Velm App-Icon — Bleistift schreibt ein kalligraphisches V.
 * 1:1 aus dem Design-Handoff ("Velm Icon - Final.html").
 *
 * `size`      Kantenlänge der Kachel in px.
 * `tile`      true (Default) = abgerundete Kachel mit Brand-Gradient.
 *             false = nur die weiße Glyphe (transparent, für dunkle Flächen).
 * `radius`    Eckenradius der Kachel (nur bei tile).
 * `detail`    'full' (Default) = mit Bleistift. 'mark' = nur das V (kleine Größen).
 */
export default function VelmIcon({
  size = 40,
  tile = true,
  radius,
  detail = 'full',
}: {
  size?: number;
  tile?: boolean;
  radius?: number;
  detail?: 'full' | 'mark';
}) {
  const r = radius ?? Math.round(size * 0.26);
  const inner = tile ? Math.round(size * 0.7) : size;
  const gid = `velm-grad-${size}`;

  const glyph = (
    <svg width={inner} height={inner} viewBox="0 0 100 100" fill="none">
      <path d="M 10 11 C 16 42, 33 68, 43 84" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
      <path d="M 43 84 C 53 68, 68 40, 76 11" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      {detail === 'full' && (
        <g transform="translate(43,84) rotate(45)">
          <path d="M 0 0 L -3 -10 L 3 -10 Z" fill="#fff" fillOpacity="0.55" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M -3 -10 L -5.5 -19 L 5.5 -19 L 3 -10 Z" fill="#fff" fillOpacity="0.3" stroke="#fff" strokeWidth="1.8" />
          <rect x="-5.5" y="-55" width="11" height="36" rx="1.5" fill="#fff" fillOpacity="0.15" stroke="#fff" strokeWidth="2" />
          <rect x="-6.5" y="-58" width="13" height="4.5" fill="#fff" fillOpacity="0.4" stroke="#fff" strokeWidth="1.8" />
          <rect x="-5" y="-68" width="10" height="12" rx="5" fill="#fff" fillOpacity="0.22" stroke="#fff" strokeWidth="2" />
        </g>
      )}
    </svg>
  );

  if (!tile) return glyph;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: 'linear-gradient(148deg, #F4A261 0%, #E8874A 50%, #C05C20 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {glyph}
    </div>
  );
}
