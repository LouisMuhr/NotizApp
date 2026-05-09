import { StyleSheet } from 'react-native';
import { Tokens } from '../../theme/theme';
import { Fonts } from '../../theme/typography';

export const ONBOARDING_KEY = '@notizapp_onboarding_done';

export const CREAM = '#F0E9D6' as const; // oklch(0.95 0.045 75)

export const shared = StyleSheet.create({
  screen: {
    flex: 1,
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Tokens.inkFaint,
    letterSpacing: 1.32,
  },
  skipText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '500',
    color: Tokens.inkDim,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  nextBtn: {
    height: 46,
    paddingHorizontal: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtnText: {
    fontFamily: Fonts.serifItalic,
    fontSize: 16,
    letterSpacing: -0.16,
  },
  kapitel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Tokens.amberDeep,
    letterSpacing: 1.68,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Tokens.amberSoft,
    borderRadius: 999,
  },
  tagText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: Tokens.amberDeep,
    letterSpacing: 0.1,
  },
});
