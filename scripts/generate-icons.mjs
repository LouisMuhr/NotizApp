// Generiert alle App-Icon-PNGs aus dem Velm-Icon-SVG (Bleistift schreibt V).
// Quelle: design_handoff "Velm Icon - Final.html".
// Lauf: node scripts/generate-icons.mjs
//
// Erzeugt:
//   assets/icon.png          1024x1024  Icon mit Gradient-Kachel (volles Detail)
//   assets/adaptive-icon.png 1024x1024  Nur Glyphe auf transparent (Android-Foreground)
//   assets/splash-icon.png   1024x1024  Nur Glyphe auf transparent (Splash)
//   assets/favicon.png         48x48    Icon mit Gradient-Kachel (volles Detail)

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, '..', 'assets');

// Velm-Brand-Gradient (148deg #F4A261 → #E8874A → #C05C20)
const GRADIENT = `
  <linearGradient id="velm" gradientUnits="userSpaceOnUse"
      x1="14.5%" y1="6.7%" x2="85.5%" y2="93.3%">
    <stop offset="0"   stop-color="#F4A261"/>
    <stop offset="0.5" stop-color="#E8874A"/>
    <stop offset="1"   stop-color="#C05C20"/>
  </linearGradient>`;

// V + Bleistift (volles Detail), ViewBox 0 0 100 100 — 1:1 aus dem Handoff.
const GLYPH = `
  <path d="M 10 11 C 16 42, 33 68, 43 84" stroke="#fff" stroke-width="8" stroke-linecap="round" fill="none"/>
  <path d="M 43 84 C 53 68, 68 40, 76 11" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <g transform="translate(43,84) rotate(45)">
    <path d="M 0 0 L -3 -10 L 3 -10 Z" fill="#fff" fill-opacity="0.55" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M -3 -10 L -5.5 -19 L 5.5 -19 L 3 -10 Z" fill="#fff" fill-opacity="0.3" stroke="#fff" stroke-width="1.8"/>
    <rect x="-5.5" y="-55" width="11" height="36" rx="1.5" fill="#fff" fill-opacity="0.15" stroke="#fff" stroke-width="2"/>
    <rect x="-6.5" y="-58" width="13" height="4.5" fill="#fff" fill-opacity="0.4" stroke="#fff" stroke-width="1.8"/>
    <rect x="-5" y="-68" width="10" height="12" rx="5" fill="#fff" fill-opacity="0.22" stroke="#fff" stroke-width="2"/>
  </g>`;

// Vollflächige Icon-Kachel (Gradient deckt das ganze Quadrat — OS rundet die Ecken).
// `inset` = Rand in ViewBox-Einheiten rund um die Glyphe.
function tileSvg(size, inset = 15) {
  const scale = (100 - 2 * inset) / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>${GRADIENT}</defs>
  <rect width="100" height="100" fill="url(#velm)"/>
  <g transform="translate(${inset},${inset}) scale(${scale})">${GLYPH}</g>
</svg>`;
}

// Nur Glyphe auf transparentem Grund (Splash auf der App-Hintergrundfarbe).
function glyphSvg(size, scale = 0.5) {
  const pad = (100 - 100 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <g transform="translate(${pad},${pad}) scale(${scale})">${GLYPH}</g>
</svg>`;
}

async function render(svg, out, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(ASSETS, out));
  console.log(`✓ ${out} (${size}px)`);
}

await render(tileSvg(1024), 'icon.png', 1024);
// Android adaptive Foreground: volle Gradient-Kachel mit großzügigem Rand (~33% Beschnitt),
// damit die weiße Glyphe auf dem Gradient sitzt — nicht auf der (evtl. abweichenden) backgroundColor.
await render(tileSvg(1024, 26), 'adaptive-icon.png', 1024);
await render(glyphSvg(1024, 0.6), 'splash-icon.png', 1024);
await render(tileSvg(48), 'favicon.png', 48);

console.log('Fertig.');
