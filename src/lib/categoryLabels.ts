import type { SushiItem } from '../types';

export const CATEGORY_LABELS: Record<SushiItem['category'], string> = {
  nigiri: 'Nigiri',
  sashimi: 'Sashimi',
  roll: 'Rolls',
  handroll: 'Hand Rolls',
  special_roll: 'Special Rolls',
  soup: 'Soup',
  salad: 'Salad',
  special: 'Specials',
  dessert: 'Desserts',
  rice: 'Rice Dishes',
  noodles: 'Noodles',
  teriyaki: 'Teriyaki',
  skewers: 'Skewers',
  spring_roll: 'Spring Rolls',
  other: 'Tempura & Other',
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category as SushiItem['category']] ?? category;
}
