const EMOJI_BY_KEY: Record<string, string> = {
  // Nigiri
  nigiri_any: '🍣',
  nigiri_salmon: '🍣',
  nigiri_tuna: '🍣',
  nigiri_yellowtail: '🍣',
  nigiri_shrimp: '🍤',
  nigiri_eel: '🍣',
  nigiri_scallop: '🍣',
  nigiri_octopus: '🐙',
  nigiri_egg: '🥚',

  // Sashimi
  sashimi_any: '🐟',
  sashimi_salmon: '🐟',
  sashimi_tuna: '🐟',
  sashimi_yellowtail: '🐟',
  sashimi_octopus: '🐙',
  sashimi_scallop: '🦪',

  // Regular Rolls
  roll_any: '🌀',
  roll_california: '🍱',
  roll_spicy_tuna: '🌶️',
  roll_salmon_avocado: '🥑',
  roll_salmon: '🍣',
  roll_philadelphia: '🧀',
  roll_shrimp_tempura: '🍤',
  roll_cucumber: '🥒',
  roll_avocado: '🥑',
  roll_tuna: '🍣',
  roll_yellowtail: '🐟',

  // Hand Rolls
  handroll_any: '🌯',
  handroll_salmon: '🌯',
  handroll_tuna: '🌯',
  handroll_spicy_tuna: '🌶️',
  handroll_shrimp_tempura: '🍤',
  handroll_california: '🌯',
  handroll_yellowtail: '🌯',

  // Special Rolls
  special_roll_any: '⭐',
  special_roll_rainbow: '🌈',
  special_roll_dragon: '🐉',
  special_roll_dynamite: '💥',
  special_roll_volcano: '🌋',
  special_roll_spider: '🕷️',
  special_roll_caterpillar: '🐛',
  special_roll_shrimp_tempura: '🍤',

  // Tempura
  tempura_any: '🍤',
  tempura_shrimp: '🍤',
  tempura_vegetable: '🥦',
  tempura_chicken: '🍗',

  // Salad
  salad_any: '🥗',
  salad_seaweed: '🌿',
  salad_mango: '🥭',
  salad_house: '🥗',
  salad_sunomono: '🥒',

  // Soup
  soup_any: '🍜',
  soup_miso: '🍜',
  soup_hot_sour: '🌶️',
  soup_tom_yum: '🥘',
  soup_egg_drop: '🥚',
  soup_wonton: '🥟',
  soup_seaweed: '🌿',
  soup_sumashi: '🫖',

  // Rice Dishes
  rice_any: '🍚',
  rice_fried: '🍛',
  rice_donburi: '🍚',
  rice_onigiri: '🍙',
  rice_chirashi: '🍱',

  // Noodles
  noodles_any: '🍜',
  noodles_ramen: '🍜',
  noodles_udon: '🍜',
  noodles_soba: '🥢',
  noodles_yaki_udon: '🍜',
  noodles_pad_thai: '🥡',

  // Teriyaki
  teriyaki_any: '🍱',
  teriyaki_chicken: '🍗',
  teriyaki_salmon: '🐟',
  teriyaki_beef: '🥩',
  teriyaki_tofu: '⬜',

  // Skewers
  skewers_any: '🍢',
  skewers_chicken: '🍢',
  skewers_beef: '🍢',
  skewers_shrimp: '🍤',
  skewers_veggie: '🥦',

  // Spring Rolls
  spring_roll_any: '🥬',
  spring_roll_vegetable: '🥬',
  spring_roll_shrimp: '🍤',
  spring_roll_pork: '🥢',
  spring_roll_fresh: '🌿',

  // Specials
  special_any: '🍱',
  special_edamame: '🫛',
  special_gyoza: '🥟',
  special_miso_soup: '🍜',
  special_ice_cream: '🍨',

  // Desserts
  dessert_any: '🍡',
  dessert_ice_cream: '🍨',
  dessert_mochi: '🍡',
  dessert_green_tea_ice_cream: '🍵',
  dessert_tempura_ice_cream: '🍦',
  dessert_cheesecake: '🍰',
  dessert_tiramisu: '🍮',
  dessert_banana_tempura: '🍌',
  dessert_lava_cake: '🍫',
  dessert_mango_pudding: '🥭',
};

const CATEGORY_FALLBACK: Record<string, string> = {
  nigiri: '🍣',
  sashimi: '🐟',
  roll: '🍣',
  handroll: '🌯',
  special_roll: '⭐',
  soup: '🍜',
  salad: '🥗',
  special: '🍱',
  dessert: '🍡',
  rice: '🍚',
  noodles: '🍜',
  teriyaki: '🍱',
  skewers: '🍢',
  spring_roll: '🥬',
  other: '🍚',
};

export function getItemEmoji(imageKey: string | undefined, category: string): string {
  if (imageKey && EMOJI_BY_KEY[imageKey]) return EMOJI_BY_KEY[imageKey]!;
  return CATEGORY_FALLBACK[category] ?? '🍣';
}
