import { MD3LightTheme, configureFonts } from 'react-native-paper';

// ─── OKLCH-Farben als Hex (vorberechnet — RN unterstützt kein oklch()) ───
export const Tokens = {
  paper:      '#F6F2EA',  // oklch(0.97 0.018 75) — App-Background
  paperDeep:  '#EDE5D6',  // oklch(0.94 0.030 75) — Card-Background
  paperEdge:  '#E2D8C6',  // oklch(0.91 0.035 70) — Card-Border
  ink:        '#2B2419',  // oklch(0.26 0.020 50) — Primärtext
  inkDim:     '#6B6354',  // oklch(0.50 0.020 60) — Sekundärtext
  inkFaint:   '#A29A8A',  // oklch(0.68 0.020 65) — Tertiärtext / Disabled
  amber:      '#D89A4F',  // oklch(0.72 0.160 65) — Hauptakzent
  amberDeep:  '#9C5F1F',  // oklch(0.55 0.150 50) — CTA / aktive States
  amberSoft:  '#F2E0C2',  // oklch(0.93 0.060 70) — Tag-Background, Highlights
  rule:       '#D7CDB9',  // oklch(0.86 0.025 70) — Trennlinien
  warmShadow: '#5C3A12',  // Schatten-Farbe (warm statt neutral schwarz)
};

// ─── Font-Konfig für MD3 ───
const baseFont = {
  fontFamily: 'Inter_400Regular',
  letterSpacing: 0,
};
const fontConfig = {
  // Display & Headline → Serif
  displayLarge:   { ...baseFont, fontFamily: 'InstrumentSerif_400Regular', fontSize: 38, lineHeight: 42, letterSpacing: -0.4 },
  displayMedium:  { ...baseFont, fontFamily: 'InstrumentSerif_400Regular', fontSize: 32, lineHeight: 36, letterSpacing: -0.3 },
  displaySmall:   { ...baseFont, fontFamily: 'InstrumentSerif_400Regular', fontSize: 26, lineHeight: 30, letterSpacing: -0.2 },
  headlineLarge:  { ...baseFont, fontFamily: 'InstrumentSerif_400Regular', fontSize: 24, lineHeight: 28 },
  headlineMedium: { ...baseFont, fontFamily: 'InstrumentSerif_400Regular', fontSize: 20, lineHeight: 24 },
  headlineSmall:  { ...baseFont, fontFamily: 'InstrumentSerif_400Regular', fontSize: 18, lineHeight: 22 },
  titleLarge:     { ...baseFont, fontFamily: 'InstrumentSerif_400Regular', fontSize: 19, lineHeight: 24 },
  titleMedium:    { ...baseFont, fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22 },
  titleSmall:     { ...baseFont, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
  // Body → Sans
  bodyLarge:      { ...baseFont, fontSize: 15.5, lineHeight: 24 },
  bodyMedium:     { ...baseFont, fontSize: 14, lineHeight: 21 },
  bodySmall:      { ...baseFont, fontSize: 12.5, lineHeight: 18 },
  // Label / UI
  labelLarge:     { ...baseFont, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
  labelMedium:    { ...baseFont, fontFamily: 'Inter_500Medium', fontSize: 11.5, lineHeight: 16, letterSpacing: 0.4 },
  labelSmall:     { ...baseFont, fontFamily: 'Inter_600SemiBold', fontSize: 10.5, lineHeight: 14, letterSpacing: 0.6 },
};

export const AppTheme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    // Primary — Amber (deep)
    primary: Tokens.amberDeep,
    onPrimary: Tokens.paper,
    primaryContainer: Tokens.amberSoft,
    onPrimaryContainer: Tokens.amberDeep,
    // Secondary — Ink (für seltene non-amber Akzente)
    secondary: Tokens.ink,
    onSecondary: Tokens.paper,
    secondaryContainer: Tokens.paperDeep,
    onSecondaryContainer: Tokens.ink,
    // Tertiary — Amber (hell) für Pin / Reminder Badges
    tertiary: Tokens.amber,
    onTertiary: Tokens.paper,
    tertiaryContainer: Tokens.amberSoft,
    onTertiaryContainer: Tokens.amberDeep,
    // Surfaces
    background: Tokens.paper,
    surface: Tokens.paper,
    surfaceVariant: Tokens.paperDeep,
    surfaceDisabled: Tokens.paperEdge,
    // Text
    onSurface: Tokens.ink,
    onSurfaceVariant: Tokens.inkDim,
    onSurfaceDisabled: Tokens.inkFaint,
    onBackground: Tokens.ink,
    // Outlines
    outline: Tokens.rule,
    outlineVariant: Tokens.paperEdge,
    // Error — gedämpftes warmes Rot statt Coral
    error: '#B14A3D',
    errorContainer: '#F4DAD3',
    onError: Tokens.paper,
    onErrorContainer: '#7A2E25',
    // Inverse
    inverseSurface: Tokens.ink,
    inverseOnSurface: Tokens.paper,
    inversePrimary: Tokens.amberSoft,
    // Elevation — Papier-Stack: minimal differenzierte Cremes
    elevation: {
      level0: 'transparent',
      level1: Tokens.paper,
      level2: Tokens.paperDeep,
      level3: Tokens.paperDeep,
      level4: Tokens.paperEdge,
      level5: Tokens.paperEdge,
    },
  },
};

export type AppThemeType = typeof AppTheme;
