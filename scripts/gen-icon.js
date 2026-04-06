const sharp = require('sharp');
const path = require('path');

// Twilight theme palette
const BG = '#0F1117';
const PRIMARY = '#7B6EF6';
const SECONDARY = '#3ECFB4';
const TERTIARY = '#FFB347';
const WHITE = '#FFFFFF';

// Full-bleed icon (iOS + notification) — rounded square note with checklist
const iconSvg = (size, bg = BG, bleed = 0) => {
  const s = size;
  const r = s * 0.22;
  // Note card
  const cardW = s * 0.56;
  const cardH = s * 0.68;
  const cardX = (s - cardW) / 2;
  const cardY = (s - cardH) / 2 + s * 0.01;
  const cardR = s * 0.08;

  // Checklist rows
  const rowH = cardH / 5;
  const rows = [0, 1, 2].map((i) => {
    const y = cardY + rowH * (i + 0.7);
    const boxSize = s * 0.07;
    const boxX = cardX + s * 0.06;
    const lineX = boxX + boxSize + s * 0.03;
    const lineW = cardW - (boxSize + s * 0.12);
    const checked = i < 2;
    const boxFill = checked ? SECONDARY : 'none';
    const boxStroke = checked ? SECONDARY : '#B8BCC9';
    const check = checked
      ? `<polyline points="${boxX + boxSize * 0.2},${y + boxSize * 0.55} ${boxX + boxSize * 0.45},${y + boxSize * 0.78} ${boxX + boxSize * 0.82},${y + boxSize * 0.28}" fill="none" stroke="${WHITE}" stroke-width="${s * 0.012}" stroke-linecap="round" stroke-linejoin="round"/>`
      : '';
    const lineOpacity = checked ? 0.35 : 0.85;
    const lineDeco = checked
      ? `<line x1="${lineX}" y1="${y + boxSize * 0.5}" x2="${lineX + lineW}" y2="${y + boxSize * 0.5}" stroke="#6B7280" stroke-width="${s * 0.008}"/>`
      : '';
    return `
      <rect x="${boxX}" y="${y}" width="${boxSize}" height="${boxSize}" rx="${s * 0.015}" fill="${boxFill}" stroke="${boxStroke}" stroke-width="${s * 0.008}"/>
      ${check}
      <rect x="${lineX}" y="${y + boxSize * 0.25}" width="${lineW}" height="${boxSize * 0.5}" rx="${boxSize * 0.25}" fill="#E5E7EB" opacity="${lineOpacity}"/>
      ${lineDeco}
    `;
  }).join('');

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1A1D2E"/>
        <stop offset="100%" stop-color="${BG}"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FAFBFF"/>
        <stop offset="100%" stop-color="#E8EBF5"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${PRIMARY}"/>
        <stop offset="100%" stop-color="${SECONDARY}"/>
      </linearGradient>
    </defs>
    ${bleed ? `<rect width="${s}" height="${s}" fill="${bg}"/>` : `<rect width="${s}" height="${s}" rx="${r}" fill="url(#bgGrad)"/>`}

    <!-- Glow behind card -->
    <circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.38}" fill="${PRIMARY}" opacity="0.18"/>

    <!-- Note card with slight tilt -->
    <g transform="rotate(-4 ${s / 2} ${s / 2})">
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardR}" fill="url(#cardGrad)"/>
      <!-- top accent bar -->
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${s * 0.055}" rx="${cardR}" fill="url(#accent)"/>
      <rect x="${cardX}" y="${cardY + s * 0.03}" width="${cardW}" height="${s * 0.025}" fill="url(#accent)"/>
      ${rows}
    </g>

    <!-- Pin accent top-right -->
    <circle cx="${s * 0.74}" cy="${s * 0.26}" r="${s * 0.05}" fill="${TERTIARY}"/>
    <circle cx="${s * 0.74}" cy="${s * 0.26}" r="${s * 0.022}" fill="${BG}"/>
  </svg>`;
};

async function gen(name, size, opts = {}) {
  const svg = iconSvg(size, opts.bg, opts.bleed);
  const out = path.join(__dirname, '..', 'assets', name);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log('wrote', out);
}

(async () => {
  await gen('icon.png', 1024);
  await gen('adaptive-icon.png', 1024, { bleed: true, bg: '#5B67CA' });
  await gen('splash-icon.png', 1024, { bleed: true, bg: '#0F1117' });
  await gen('favicon.png', 64);
})();
