// Color gradients used across the app for a more lively, Duolingo/Revolut-style look.
// Each gradient is an array of two hex colors, top-left -> bottom-right.

export const Gradients = {
  primary: ['#8B7BFF', '#5A4ED4'] as const,
  secondary: ['#4FE0C2', '#22A98F'] as const,
  tertiary: ['#FFC36B', '#FF8C42'] as const,
  pink: ['#FF8FB1', '#FF5C84'] as const,
  sky: ['#7DC4FB', '#3B82F6'] as const,
  emerald: ['#5EEAB5', '#10B981'] as const,
  lavender: ['#C5B0FF', '#8B5CF6'] as const,
  surface: ['#1C1F2A', '#15171F'] as const,
  surfaceRaised: ['#22263180', '#181B2380'] as const,
  danger: ['#FF8194', '#E5485F'] as const,
};

export type GradientName = keyof typeof Gradients;

// Hash a string -> a deterministic gradient name. Used for category colors.
const CATEGORY_GRADIENTS: GradientName[] = [
  'primary',
  'secondary',
  'tertiary',
  'sky',
  'pink',
  'emerald',
  'lavender',
];

export function getCategoryGradient(category: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const name = CATEGORY_GRADIENTS[Math.abs(hash) % CATEGORY_GRADIENTS.length];
  return Gradients[name];
}

// Bigger, softer corners for a friendlier feel.
export const Radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
};

// Reusable elevation/shadow presets (iOS shadow + Android elevation).
export const Shadows = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  }),
};
