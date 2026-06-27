// Two coexisting themes selectable at runtime via ThemeContext:
//   • classic — the original warm cream / Press Start 2P "pixel" look.
//   • tokyo   — "Tokyo Nights": dark purple gradients, neon coral→pink accents,
//               glass cards, large rounded pills, Playfair + Inter type.
//
// Screens read everything from the active Theme object (see useTheme()), so the
// whole app can flip between the two looks instantly.
import { PIXEL_FONT, palette as classicPalette } from './pixel';
import { getCategoryTheme } from '../lib/categoryTheme';

export type ThemeName = 'classic' | 'tokyo';

export interface CategoryVisual {
  gradient: [string, string];
  accent: string;
  emoji: string;
}

export interface Theme {
  name: ThemeName;
  isDark: boolean;
  color: {
    bg: string;
    bgGradient: [string, string, ...string[]];
    surface: string;
    surfaceAlt: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    accent: string;
    accentSoft: string;
    accentGradient: [string, string];
    onAccent: string;
    success: string;
    amber: string;
    cyan: string;
    purple: string;
    tabBar: string;
    tabActive: string;
    tabInactive: string;
    danger: string;
  };
  font: {
    display: string;
    displayItalic: string;
    body: string;
    bodyMedium: string;
    bodySemibold: string;
    bodyBold: string;
  };
  radius: { sm: number; md: number; lg: number; pill: number; button: number };
  shadow: {
    card: object;
    glow: (color: string) => object;
  };
  category: (cat: string) => CategoryVisual;
}

// ── Tokyo Nights category gradients (neon, dark) ──────────────────────────────
const TOKYO_CATEGORY: Record<string, [string, string]> = {
  nigiri: ['#FF9A8B', '#FF6A88'],
  sashimi: ['#FF87B2', '#FF5C9E'],
  roll: ['#FFC46B', '#FF9A5A'],
  handroll: ['#FFB07A', '#FF8A5A'],
  special_roll: ['#FFD36B', '#FFAE42'],
  salad: ['#A6E782', '#5FD08A'],
  soup: ['#C9A0FF', '#9A7AE0'],
  special: ['#C9A0FF', '#9A7AE0'],
  dessert: ['#FF9AD1', '#FF6AB0'],
  rice: ['#B6E08A', '#7FC97A'],
  noodles: ['#FFC46B', '#FF9A5A'],
  teriyaki: ['#FFB07A', '#FF8A5A'],
  skewers: ['#86E0FF', '#5AB0E0'],
  spring_roll: ['#86E8D2', '#4FC9B0'],
  other: ['#86E0FF', '#5AB0E0'],
};

export const tokyoTheme: Theme = {
  name: 'tokyo',
  isDark: true,
  color: {
    bg: '#0B0712',
    bgGradient: ['#2A1330', '#140C20', '#0B0712'],
    surface: '#1A1330',
    surfaceAlt: '#221A3A',
    border: 'rgba(255,255,255,0.08)',
    textPrimary: '#F4F1FB',
    textSecondary: '#9D93B8',
    textTertiary: '#6E6489',
    accent: '#FF6F91',
    accentSoft: '#FF8FA8',
    accentGradient: ['#FFB199', '#FF6F91'],
    onAccent: '#2A0E18',
    success: '#5FD08A',
    amber: '#FFB35A',
    cyan: '#6FD3FF',
    purple: '#B58CFF',
    tabBar: 'rgba(18,12,28,0.92)',
    tabActive: '#FF6F91',
    tabInactive: '#6E6489',
    danger: '#FF6F91',
  },
  font: {
    display: 'PlayfairDisplay_600SemiBold',
    displayItalic: 'PlayfairDisplay_600SemiBold_Italic',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemibold: 'Inter_600SemiBold',
    bodyBold: 'Inter_700Bold',
  },
  radius: { sm: 10, md: 16, lg: 26, pill: 20, button: 30 },
  shadow: {
    card: {
      shadowColor: '#000000',
      shadowOpacity: 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    glow: (color: string) => ({
      shadowColor: color,
      shadowOpacity: 0.55,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    }),
  },
  category: (cat: string): CategoryVisual => {
    const base = getCategoryTheme(cat);
    return {
      gradient: TOKYO_CATEGORY[cat] ?? TOKYO_CATEGORY.other!,
      accent: (TOKYO_CATEGORY[cat] ?? TOKYO_CATEGORY.other!)[1],
      emoji: base.emoji,
    };
  },
};

export const classicTheme: Theme = {
  name: 'classic',
  isDark: false,
  color: {
    bg: classicPalette.bg,
    bgGradient: ['#fffaf2', '#fdf3e3', '#fff4d7'],
    surface: '#fffdf8',
    surfaceAlt: '#fff4d7',
    border: 'rgba(26,19,38,0.12)',
    textPrimary: classicPalette.ink,
    textSecondary: classicPalette.inkSoft,
    textTertiary: '#7a6452',
    accent: classicPalette.red,
    accentSoft: '#ee5d52',
    accentGradient: ['#ee5d52', classicPalette.red],
    onAccent: '#ffffff',
    success: classicPalette.green,
    amber: classicPalette.yellow,
    cyan: classicPalette.blue,
    purple: classicPalette.purple,
    tabBar: '#fffdf8',
    tabActive: classicPalette.red,
    tabInactive: '#7a6452',
    danger: classicPalette.red,
  },
  font: {
    display: PIXEL_FONT,
    displayItalic: PIXEL_FONT,
    body: PIXEL_FONT,
    bodyMedium: PIXEL_FONT,
    bodySemibold: PIXEL_FONT,
    bodyBold: PIXEL_FONT,
  },
  radius: { sm: 4, md: 8, lg: 12, pill: 10, button: 10 },
  shadow: {
    card: {
      shadowColor: classicPalette.shadow,
      shadowOpacity: 1,
      shadowRadius: 0,
      shadowOffset: { width: 4, height: 4 },
      elevation: 0,
    },
    glow: () => ({
      shadowColor: classicPalette.shadow,
      shadowOpacity: 1,
      shadowRadius: 0,
      shadowOffset: { width: 2, height: 2 },
      elevation: 0,
    }),
  },
  category: (cat: string): CategoryVisual => {
    const base = getCategoryTheme(cat);
    return { gradient: [base.bg, base.bgActive], accent: base.accent, emoji: base.emoji };
  },
};

export const THEMES: Record<ThemeName, Theme> = {
  classic: classicTheme,
  tokyo: tokyoTheme,
};
