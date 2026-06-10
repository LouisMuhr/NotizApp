/**
 * prepare-screenshots.mjs
 *
 * Normalizes raw phone screenshots into Play-Store-ready images:
 *   1. Crops the OS status bar (top) and the system navigation bar (bottom).
 *   2. Scales onto a fixed 1080×2400 (9:20) canvas with "contain" — no distortion,
 *      cream padding (matches Velm's surface) fills any leftover.
 *   3. Exports PNG, numbered in the screenshot-story order (§5 of launch-reach-plan).
 *
 * Source: docs/screenshot-story/*.jpeg (921×2048)
 * Output: docs/screenshot-story/play/01..07.png
 *
 * Run: node scripts/prepare-screenshots.mjs
 *
 * The crop is detected PER IMAGE (not fixed offsets), so it adapts to different
 * system bars — gesture pill vs. 3-button nav, taller/shorter status bars. It works
 * by walking in from the top/bottom edge while rows look like a system bar
 * (near-white or near-black) and stopping at the first real app-content row.
 */

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../docs/screenshot-story');
const OUT = resolve(SRC, 'play');
mkdirSync(OUT, { recursive: true });

// Target Play phone canvas (9:20 portrait, same ratio family as source).
const CANVAS_W = 1080;
const CANVAS_H = 2400;
const BG = { r: 246, g: 242, b: 233 }; // Velm cream surface

// --- per-image system-bar detection ---------------------------------------
// A system bar (status bar icons, white gesture pill, black 3-button nav) is
// either near-white or near-black across the row, unlike the cream app content.
const SYS_WHITE = 248; // mean >= this → likely white bar / pill background
const SYS_BLACK = 40;  // mean <= this → likely black nav bar
// Scan windows: bars only ever live within these margins from each edge.
const TOP_SCAN = 90; // status bar only; below this is app content (headings/pills)
const BOTTOM_SCAN = 300;

function rowMean(data, W, ch, y) {
  let sum = 0;
  let n = 0;
  for (let x = 0; x < W; x += 3) {
    const i = (y * W + x) * ch;
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    n++;
  }
  return sum / n;
}

function isSystemRow(mean) {
  return mean >= SYS_WHITE || mean <= SYS_BLACK;
}

/** Detect the content band [top, bottom) by trimming system bars from each edge. */
function detectCrop(data, W, H, ch) {
  // Top: the status bar holds dark icons/text on the light bg. Find the LAST row
  // within the top window that still has dark pixels (= bottom of the icons), then
  // cut just below it. A row of pure light = no status content there.
  const STATUS_PAD = 4; // small breathing room below the icons
  let lastDarkTop = -1;
  for (let y = 0; y < TOP_SCAN; y++) {
    let dark = 0;
    for (let x = 0; x < W; x += 3) {
      const i = (y * W + x) * ch;
      const m = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (m < 120) dark++;
    }
    if (dark > 0) lastDarkTop = y;
  }
  const top = lastDarkTop >= 0 ? Math.min(lastDarkTop + STATUS_PAD, TOP_SCAN) : 0;

  // Bottom: walk up while rows look like a system nav bar (white pill / black bar).
  let bottom = H;
  for (let y = H - 1; y >= H - BOTTOM_SCAN; y--) {
    if (isSystemRow(rowMean(data, W, ch, y))) bottom = y;
    else break;
  }
  return { top, bottom };
}

// Story order → output number. Filenames as found in docs/screenshot-story.
const ORDER = [
  'NotesScreen.jpeg',          // 01 hero
  'EditorScree.jpeg',          // 02
  'ThreadsScreen.jpeg',        // 03
  'ThreadsDetailScreen.jpeg',  // 04
  'filtered-NotesScreen.jpeg', // 05
  'VoiceScreen.jpeg',          // 06
  'SubscribtionScreen.jpeg',   // 07 (optional / abo)
];

async function process(file, index) {
  const num = String(index + 1).padStart(2, '0');

  const src = sharp(resolve(SRC, file));
  const { data, info } = await src
    .clone()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: ch } = info;

  const { top, bottom } = detectCrop(data, W, H, ch);
  const cropHeight = bottom - top;

  const cropped = await sharp(resolve(SRC, file))
    .extract({ left: 0, top, width: W, height: cropHeight })
    .toBuffer();

  // Fit the cropped content inside the canvas without cropping (contain),
  // padding with cream so the ratio difference is invisible.
  const resized = await sharp(cropped)
    .resize(CANVAS_W, CANVAS_H, {
      fit: 'contain',
      background: BG,
      kernel: 'lanczos3',
    })
    .png()
    .toBuffer();

  const outPath = resolve(OUT, `${num}.png`);
  await sharp(resized).toFile(outPath);

  const meta = await sharp(outPath).metadata();
  console.log(
    `✓ ${num}.png  ←  ${file}  (${meta.width}×${meta.height})  crop[top=${top}, bottom=${bottom}]`,
  );
}

let i = 0;
for (const file of ORDER) {
  await process(file, i++);
}
console.log(`\nDone → ${OUT}`);
