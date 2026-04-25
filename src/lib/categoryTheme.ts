import type { TileTint } from '../components/SushiTile';

export interface CategoryTheme extends TileTint {
  emoji: string;
  accent: string;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  nigiri: {
    emoji: '🍣',
    accent: '#e53935',
    bg: '#fff5f4',
    bgActive: '#ffe3e0',
    border: '#fbd4d0',
    borderActive: '#f2938b',
    badge: '#e53935',
  },
  sashimi: {
    emoji: '🐟',
    accent: '#1e88e5',
    bg: '#eef6ff',
    bgActive: '#d9eaff',
    border: '#c9dff7',
    borderActive: '#7eb3ea',
    badge: '#1e88e5',
  },
  roll: {
    emoji: '🌀',
    accent: '#43a047',
    bg: '#f0faf1',
    bgActive: '#dbf0df',
    border: '#c9e6cd',
    borderActive: '#86c98f',
    badge: '#43a047',
  },
  soup: {
    emoji: '🍜',
    accent: '#f57c00',
    bg: '#fff8e1',
    bgActive: '#ffecb3',
    border: '#ffe082',
    borderActive: '#ffc107',
    badge: '#f57c00',
  },
  special: {
    emoji: '⭐',
    accent: '#8e24aa',
    bg: '#faf3fc',
    bgActive: '#f0dffb',
    border: '#e4cbf0',
    borderActive: '#c084d8',
    badge: '#8e24aa',
  },
  other: {
    emoji: '🍚',
    accent: '#fb8c00',
    bg: '#fff7ea',
    bgActive: '#ffe9c7',
    border: '#ffd99e',
    borderActive: '#f5b661',
    badge: '#fb8c00',
  },
};

export function getCategoryTheme(category: string): CategoryTheme {
  return CATEGORY_THEMES[category] ?? CATEGORY_THEMES.other!;
}
