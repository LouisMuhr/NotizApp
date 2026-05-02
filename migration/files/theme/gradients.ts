// Drop-in Ersatz für die alte gradients.ts.
// Im Editorial-Papier-Stil gibt es KEINE Gradients mehr — Papier ist matt.
// Wir behalten die exportierten Namen (Radii, Shadows) bei, damit bestehende
// Imports nicht brechen, und ersetzen Gradient-Werte durch Solid-Tokens.

import { StyleSheet } from 'react-native';
import { Tokens } from './theme';

// ─── Radien — etwas reduziert vs. vorher (weniger "weich-bubblig", editorial) ───
export const Radii = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  pill: 999,
};

// ─── Schatten — warm getönt, sehr subtil ───
export const Shadows = {
  soft: {
    shadowColor: Tokens.warmShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  softWarm: {
    shadowColor: Tokens.warmShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  // glow() bleibt aus Kompat. erhalten, gibt aber jetzt einen warmen, gedämpften
  // Schatten zurück — keinen farbigen Glow mehr.
  glow: (_color: string) => ({
    shadowColor: Tokens.warmShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  }),
};

// ─── Inset-Highlight für Cards (RN-Trick: hellere Top-Border) ───
export const Insets = {
  cardBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.paperEdge,
    borderTopColor: 'rgba(255, 255, 255, 0.65)',
  },
};

// ─── Legacy: Gradients-Map → wird nicht mehr genutzt, aber Imports brechen nicht ───
// Falls noch irgendwo `Gradients.primary` o.ä. importiert wird, geben wir
// ein 2-Tupel mit identischen Tokens zurück, das Solid wirkt.
export const Gradients = {
  primary:    [Tokens.amberDeep, Tokens.amberDeep] as const,
  secondary:  [Tokens.ink, Tokens.ink] as const,
  tertiary:   [Tokens.amber, Tokens.amber] as const,
  pink:       [Tokens.amber, Tokens.amber] as const,
  sky:        [Tokens.ink, Tokens.ink] as const,
  emerald:    [Tokens.amberDeep, Tokens.amberDeep] as const,
  lavender:   [Tokens.amberDeep, Tokens.amberDeep] as const,
  surface:    [Tokens.paperDeep, Tokens.paperDeep] as const,
  surfaceRaised: [Tokens.paperDeep, Tokens.paper] as const,
  danger:     ['#B14A3D', '#B14A3D'] as const,
};

export type GradientName = keyof typeof Gradients;

// Kompat-Export — wird durch categoryAccents.getCategoryAccent() ersetzt
export function getCategoryGradient(_category: string): readonly [string, string] {
  return [Tokens.amberSoft, Tokens.amberSoft] as const;
}
