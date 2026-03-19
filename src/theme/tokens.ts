export const tokens = {
  color: {
    // Foundation - Stark, editorial light mode
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    surface2: '#F3F3F3',
    surface3: '#EBEBEB',

    // Lines
    border: '#E0E0E0',
    borderSubtle: '#F0F0F0',

    // Text - Extreme contrast
    text: '#111111',
    textMuted: '#666666',
    textFaint: '#A3A3A3',

    // Accent - Pure editorial black
    accent: '#111111',
    accent2: '#111111',
    accentSoft: 'rgba(17, 17, 17, 0.05)',
    accentRing: 'rgba(17, 17, 17, 0.1)',
    
    // Brand - A sharp editorial accent for glows and highlights
    brand: '#FF3823', // a harsh striking vermillion/red-orange
    brandSoft: 'rgba(255, 56, 35, 0.15)',

    // Feedback
    danger: '#D95C68',
    dangerSoft: 'rgba(217, 92, 104, 0.12)',
  },
  space: {
    0: 0,
    4: 4,
    8: 8,
    12: 12,
    16: 16,
    20: 20,
    24: 24,
    32: 32,
    40: 40,
  },
  radius: {
    0: 0,  // Sharp for Co-Star feel
    2: 2,
    4: 4,  // Buttons
    6: 6,
    8: 8,  // Cards
    10: 10,
    12: 12,
    16: 16,
    24: 24,
    100: 100, // Orbs/Circles only
  },
  font: {
    size: {
      8: 8,
      10: 10,
      12: 12,
      14: 14,
      16: 16,
      18: 18,
      20: 20,
      24: 24,
      28: 28,
      32: 32,
    },
    weight: {
      light: '300' as const,
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },
} as const;
