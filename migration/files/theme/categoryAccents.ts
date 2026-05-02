// Kategorien werden im Editorial-Papier-Stil NICHT mehr durch unterschiedliche
// Buntfarben unterschieden. Stattdessen rotieren wir den Hue um den Amber-Anker
// (65°) bei gleicher Lightness/Chroma — die Kategorien sehen zusammen wie
// verschiedene Tintenbrauntöne aus.
//
// Vorberechnete Hex-Werte für oklch(0.93 0.060 H) bzw. oklch(0.55 0.150 H_deep)
// in 30°-Schritten. Eine deterministische Hash-Funktion mappt Kategorienamen
// auf einen Slot.

import { Tokens } from './theme';

export interface CategoryAccent {
  soft: string;   // chip/background
  deep: string;   // text/icon
}

// 8 Slots, beginnend bei Amber (65°), rotierend in 30°-Schritten
const ACCENTS: CategoryAccent[] = [
  { soft: '#F2E0C2', deep: '#9C5F1F' }, //  65° Amber (Anker)
  { soft: '#F2DBC8', deep: '#9C5028' }, //  35° Rost
  { soft: '#F0D5CE', deep: '#963F33' }, //   5° Terrakotta
  { soft: '#EAD0D8', deep: '#8C3F50' }, // 335° Burgund
  { soft: '#DECEDC', deep: '#6E436A' }, // 305° Pflaume
  { soft: '#CDD3D8', deep: '#3F5670' }, // 245° Indigo
  { soft: '#CDDBC9', deep: '#3F6B45' }, // 145° Salbei
  { soft: '#E2DDB6', deep: '#7A6C20' }, //  95° Olive
];

const NEUTRAL: CategoryAccent = {
  soft: Tokens.paperEdge,
  deep: Tokens.inkDim,
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = s.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

export function getCategoryAccent(category: string | null | undefined): CategoryAccent {
  if (!category) return NEUTRAL;
  return ACCENTS[hash(category) % ACCENTS.length];
}

// Backward-compat-Wrapper falls noch alter Code `getCategoryColor` aufruft.
export function getCategoryColor(category: string | null | undefined): string {
  return getCategoryAccent(category).deep;
}

// Ersatz für withAlpha aus utils/categoryColors — wird im neuen Design selten
// gebraucht, weil wir feste soft/deep-Paare nutzen. Hier zur Sicherheit.
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
