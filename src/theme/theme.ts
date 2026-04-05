import { MD3DarkTheme } from 'react-native-paper';

export const AppTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    // Primary – soft indigo
    primary: '#7B6EF6',
    onPrimary: '#FFFFFF',
    primaryContainer: 'rgba(123, 110, 246, 0.12)',
    onPrimaryContainer: '#BDB4FF',
    // Secondary – mint / teal
    secondary: '#3ECFB4',
    secondaryContainer: 'rgba(62, 207, 180, 0.12)',
    onSecondaryContainer: '#7EEAD5',
    // Tertiary – warm amber
    tertiary: '#FFB347',
    tertiaryContainer: 'rgba(255, 179, 71, 0.12)',
    onTertiaryContainer: '#FFD699',
    // Backgrounds – deep navy
    background: '#0F1117',
    surface: '#181B23',
    surfaceVariant: '#1F232D',
    surfaceDisabled: '#1F232D',
    // Text
    onSurface: '#ECE9F1',
    onSurfaceVariant: '#8A879A',
    onSurfaceDisabled: '#4A4857',
    // Outlines – very subtle
    outline: '#272B36',
    outlineVariant: '#1E2129',
    // Error – soft coral
    error: '#FF6B81',
    errorContainer: 'rgba(255, 107, 129, 0.12)',
    onError: '#FFFFFF',
    onErrorContainer: '#FFB3BE',
    // Inverse
    inverseSurface: '#ECE9F1',
    inverseOnSurface: '#0F1117',
    inversePrimary: '#5A4ED4',
    // Elevation tints
    elevation: {
      level0: 'transparent',
      level1: '#141720',
      level2: '#1A1E28',
      level3: '#202530',
      level4: '#252A36',
      level5: '#2B313E',
    },
  },
};
