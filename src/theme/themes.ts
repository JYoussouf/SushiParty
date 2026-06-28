// Single app theme — "Tokyo Nights": dark charcoal background, warm red accent,
// glass cards, large rounded pills, Playfair + Inter type, colorful per-category
// counters. Screens read everything from this Theme object via useTheme().
import { getCategoryTheme } from '../lib/categoryTheme';

export type ThemeName = 'tokyo';

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
  nigiri: ['#FF7A5E', '#E53935'],
  sashimi: ['#5EC8FF', '#1E88E5'],
  roll: ['#A6E782', '#43A047'],
  handroll: ['#FFB07A', '#C46A21'],
  special_roll: ['#FFD36B', '#F5A623'],
  salad: ['#B6E08A', '#5FB85F'],
  soup: ['#FFC46B', '#F57C00'],
  special: ['#C9A0FF', '#8E24AA'],
  dessert: ['#FF9AD1', '#D81B60'],
  rice: ['#C9D98A', '#8DA24B'],
  noodles: ['#FFC46B', '#E07B2A'],
  teriyaki: ['#E0A878', '#9C5A2E'],
  skewers: ['#9FB6C0', '#546E7A'],
  spring_roll: ['#86E8D2', '#00897B'],
  other: ['#FFC46B', '#F5A623'],
};

export const tokyoTheme: Theme = {
  name: 'tokyo',
  isDark: true,
  color: {
    bg: '#0E0C0B',
    bgGradient: ['#241A18', '#161312', '#0C0A0A'],
    surface: '#1C1817',
    surfaceAlt: '#262120',
    border: 'rgba(255,255,255,0.08)',
    textPrimary: '#F5F1EE',
    textSecondary: '#B0A8A2',
    textTertiary: '#7E756F',
    accent: '#E53935',
    accentSoft: '#FF6B5E',
    accentGradient: ['#FF7A5E', '#E53935'],
    onAccent: '#FFFFFF',
    success: '#5FB85F',
    amber: '#F5A623',
    cyan: '#3FA9E0',
    purple: '#A06CD8',
    tabBar: 'rgba(18,15,14,0.94)',
    tabActive: '#E53935',
    tabInactive: '#7E756F',
    danger: '#E53935',
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

// Single active theme for the app.
export const appTheme: Theme = tokyoTheme;
