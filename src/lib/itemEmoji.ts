const EMOJI_BY_KEY: Record<string, string> = {
  nigiri_any: '🍣',
  sashimi_any: '🐟',
  roll_any: '🌀',
  nigiri_salmon: '🍣',
  nigiri_tuna: '🍣',
  nigiri_yellowtail: '🍣',
  nigiri_shrimp: '🍤',
  nigiri_eel: '🍣',
  nigiri_scallop: '🍣',
  nigiri_octopus: '🐙',
  nigiri_egg: '🥚',
  sashimi_salmon: '🐟',
  sashimi_tuna: '🐟',
  sashimi_yellowtail: '🐟',
  sashimi_octopus: '🐙',
  sashimi_scallop: '🦪',
  roll_california: '🍱',
  roll_spicy_tuna: '🌶️',
  roll_salmon_avocado: '🥑',
  roll_rainbow: '🌈',
  roll_dragon: '🐉',
  roll_philadelphia: '🧀',
  roll_shrimp_tempura: '🍤',
  roll_cucumber: '🥒',
  roll_avocado: '🥑',
  roll_tuna: '🍣',
  soup_any: '🍜',
  soup_miso: '🍜',
  soup_hot_sour: '🌶️',
  soup_tom_yum: '🥘',
  soup_egg_drop: '🥚',
  soup_wonton: '🥟',
  soup_seaweed: '🌿',
  soup_sumashi: '🫖',
  special_edamame: '🫛',
  special_gyoza: '🥟',
  special_miso_soup: '🍜',
  special_ice_cream: '🍨',
};

const CATEGORY_FALLBACK: Record<string, string> = {
  nigiri: '🍣',
  sashimi: '🐟',
  roll: '🍣',
  soup: '🍜',
  special: '🍱',
  other: '🍚',
};

export function getItemEmoji(imageKey: string | undefined, category: string): string {
  if (imageKey && EMOJI_BY_KEY[imageKey]) return EMOJI_BY_KEY[imageKey]!;
  return CATEGORY_FALLBACK[category] ?? '🍣';
}
