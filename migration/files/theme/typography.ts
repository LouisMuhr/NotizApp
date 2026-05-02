// Typography-Tokens für direkten Einsatz außerhalb von Paper-Komponenten.
// Bei Paper-Komponenten (`<Text variant="...">`) greift automatisch die
// fontConfig aus theme.ts.

export const Fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
};

// Typografie-Presets als StyleSheet-Snippets
export const Type = {
  // Display & Headlines (Serif)
  display: {
    fontFamily: Fonts.serif,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.4,
  },
  h1: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 26,
  },
  noteTitle: {
    fontFamily: Fonts.serif,
    fontSize: 19,
    lineHeight: 22,
  },
  // Body (Sans)
  body: {
    fontFamily: Fonts.sans,
    fontSize: 15.5,
    lineHeight: 24,
  },
  bodySm: {
    fontFamily: Fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
  },
  // UI / Labels
  uiLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  tag: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.1,
  },
  eyebrow: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.84,  // 0.08em bei 10.5px
    textTransform: 'uppercase' as const,
  },
  // Italic-Zitat (Serif)
  quote: {
    fontFamily: Fonts.serifItalic,
    fontSize: 16,
    lineHeight: 22,
  },
};
