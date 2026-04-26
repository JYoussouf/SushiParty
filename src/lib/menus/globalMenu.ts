import type { Menu, SushiItem } from '../../types';

const items: SushiItem[] = [
  // ── Nigiri ──────────────────────────────────────────────────────────────────
  { id: 'nigiri-any', name: 'Any Nigiri', category: 'nigiri', imageKey: 'nigiri_any' },
  { id: 'nigiri-salmon', name: 'Salmon Nigiri', category: 'nigiri', imageKey: 'nigiri_salmon' },
  { id: 'nigiri-tuna', name: 'Tuna Nigiri', category: 'nigiri', imageKey: 'nigiri_tuna' },
  { id: 'nigiri-yellowtail', name: 'Yellowtail Nigiri', category: 'nigiri', imageKey: 'nigiri_yellowtail' },
  { id: 'nigiri-shrimp', name: 'Shrimp Nigiri', category: 'nigiri', imageKey: 'nigiri_shrimp' },
  { id: 'nigiri-eel', name: 'Eel Nigiri', category: 'nigiri', imageKey: 'nigiri_eel' },
  { id: 'nigiri-scallop', name: 'Scallop Nigiri', category: 'nigiri', imageKey: 'nigiri_scallop' },
  { id: 'nigiri-octopus', name: 'Octopus Nigiri', category: 'nigiri', imageKey: 'nigiri_octopus' },
  { id: 'nigiri-egg', name: 'Egg Nigiri (Tamago)', category: 'nigiri', imageKey: 'nigiri_egg' },

  // ── Sashimi ─────────────────────────────────────────────────────────────────
  { id: 'sashimi-any', name: 'Any Sashimi', category: 'sashimi', imageKey: 'sashimi_any' },
  { id: 'sashimi-salmon', name: 'Salmon Sashimi', category: 'sashimi', imageKey: 'sashimi_salmon' },
  { id: 'sashimi-tuna', name: 'Tuna Sashimi', category: 'sashimi', imageKey: 'sashimi_tuna' },
  { id: 'sashimi-yellowtail', name: 'Yellowtail Sashimi', category: 'sashimi', imageKey: 'sashimi_yellowtail' },
  { id: 'sashimi-octopus', name: 'Octopus Sashimi', category: 'sashimi', imageKey: 'sashimi_octopus' },
  { id: 'sashimi-scallop', name: 'Scallop Sashimi', category: 'sashimi', imageKey: 'sashimi_scallop' },

  // ── Rolls ────────────────────────────────────────────────────────────────────
  { id: 'roll-any', name: 'Any Roll', category: 'roll', imageKey: 'roll_any' },
  { id: 'roll-california', name: 'California Roll', category: 'roll', imageKey: 'roll_california' },
  { id: 'roll-spicy-tuna', name: 'Spicy Tuna Roll', category: 'roll', imageKey: 'roll_spicy_tuna' },
  { id: 'roll-salmon-avocado', name: 'Salmon Avocado Roll', category: 'roll', imageKey: 'roll_salmon_avocado' },
  { id: 'roll-salmon', name: 'Salmon Roll', category: 'roll', imageKey: 'roll_salmon' },
  { id: 'roll-philadelphia', name: 'Philadelphia Roll', category: 'roll', imageKey: 'roll_philadelphia' },
  { id: 'roll-cucumber', name: 'Cucumber Roll (Kappa Maki)', category: 'roll', imageKey: 'roll_cucumber' },
  { id: 'roll-avocado', name: 'Avocado Roll', category: 'roll', imageKey: 'roll_avocado' },
  { id: 'roll-tuna', name: 'Tuna Roll (Tekka Maki)', category: 'roll', imageKey: 'roll_tuna' },
  { id: 'roll-yellowtail', name: 'Yellowtail Roll', category: 'roll', imageKey: 'roll_yellowtail' },

  // ── Hand Rolls ───────────────────────────────────────────────────────────────
  { id: 'handroll-any', name: 'Any Hand Roll', category: 'handroll', imageKey: 'handroll_any' },
  { id: 'handroll-salmon', name: 'Salmon Hand Roll', category: 'handroll', imageKey: 'handroll_salmon' },
  { id: 'handroll-tuna', name: 'Tuna Hand Roll', category: 'handroll', imageKey: 'handroll_tuna' },
  { id: 'handroll-spicy-tuna', name: 'Spicy Tuna Hand Roll', category: 'handroll', imageKey: 'handroll_spicy_tuna' },
  { id: 'handroll-shrimp-tempura', name: 'Shrimp Tempura Hand Roll', category: 'handroll', imageKey: 'handroll_shrimp_tempura' },
  { id: 'handroll-california', name: 'California Hand Roll', category: 'handroll', imageKey: 'handroll_california' },
  { id: 'handroll-yellowtail', name: 'Yellowtail Hand Roll', category: 'handroll', imageKey: 'handroll_yellowtail' },

  // ── Special Rolls ─────────────────────────────────────────────────────────────
  { id: 'special-roll-any', name: 'Any Special Roll', category: 'special_roll', imageKey: 'special_roll_any' },
  { id: 'special-roll-rainbow', name: 'Rainbow Roll', category: 'special_roll', imageKey: 'special_roll_rainbow' },
  { id: 'special-roll-dragon', name: 'Dragon Roll', category: 'special_roll', imageKey: 'special_roll_dragon' },
  { id: 'special-roll-dynamite', name: 'Dynamite Roll', category: 'special_roll', imageKey: 'special_roll_dynamite' },
  { id: 'special-roll-volcano', name: 'Volcano Roll', category: 'special_roll', imageKey: 'special_roll_volcano' },
  { id: 'special-roll-spider', name: 'Spider Roll', category: 'special_roll', imageKey: 'special_roll_spider' },
  { id: 'special-roll-caterpillar', name: 'Caterpillar Roll', category: 'special_roll', imageKey: 'special_roll_caterpillar' },
  { id: 'special-roll-shrimp-tempura', name: 'Shrimp Tempura Roll', category: 'special_roll', imageKey: 'special_roll_shrimp_tempura' },

  // ── Tempura ──────────────────────────────────────────────────────────────────
  { id: 'tempura-any', name: 'Any Tempura', category: 'other', imageKey: 'tempura_any' },
  { id: 'tempura-shrimp', name: 'Shrimp Tempura', category: 'other', imageKey: 'tempura_shrimp' },
  { id: 'tempura-vegetable', name: 'Vegetable Tempura', category: 'other', imageKey: 'tempura_vegetable' },
  { id: 'tempura-chicken', name: 'Chicken Tempura', category: 'other', imageKey: 'tempura_chicken' },

  // ── Salad ─────────────────────────────────────────────────────────────────────
  { id: 'salad-any', name: 'Any Salad', category: 'salad', imageKey: 'salad_any' },
  { id: 'salad-seaweed', name: 'Seaweed Salad', category: 'salad', imageKey: 'salad_seaweed' },
  { id: 'salad-mango', name: 'Mango Salad', category: 'salad', imageKey: 'salad_mango' },
  { id: 'salad-house', name: 'House Salad', category: 'salad', imageKey: 'salad_house' },
  { id: 'salad-sunomono', name: 'Sunomono (Cucumber Salad)', category: 'salad', imageKey: 'salad_sunomono' },

  // ── Soup ─────────────────────────────────────────────────────────────────────
  { id: 'soup-any', name: 'Any Soup', category: 'soup', imageKey: 'soup_any' },
  { id: 'soup-miso', name: 'Miso Soup', category: 'soup', imageKey: 'soup_miso' },
  { id: 'soup-hot-sour', name: 'Hot & Sour Soup', category: 'soup', imageKey: 'soup_hot_sour' },
  { id: 'soup-tom-yum', name: 'Tom Yum Soup', category: 'soup', imageKey: 'soup_tom_yum' },
  { id: 'soup-egg-drop', name: 'Egg Drop Soup', category: 'soup', imageKey: 'soup_egg_drop' },
  { id: 'soup-wonton', name: 'Wonton Soup', category: 'soup', imageKey: 'soup_wonton' },
  { id: 'soup-seaweed', name: 'Seaweed Soup', category: 'soup', imageKey: 'soup_seaweed' },
  { id: 'soup-sumashi', name: 'Sumashi (Clear) Soup', category: 'soup', imageKey: 'soup_sumashi' },

  // ── Rice Dishes ───────────────────────────────────────────────────────────────
  { id: 'rice-any', name: 'Any Rice Dish', category: 'rice', imageKey: 'rice_any' },
  { id: 'rice-fried', name: 'Fried Rice', category: 'rice', imageKey: 'rice_fried' },
  { id: 'rice-donburi', name: 'Donburi (Rice Bowl)', category: 'rice', imageKey: 'rice_donburi' },
  { id: 'rice-onigiri', name: 'Onigiri (Rice Ball)', category: 'rice', imageKey: 'rice_onigiri' },
  { id: 'rice-chirashi', name: 'Chirashi Bowl', category: 'rice', imageKey: 'rice_chirashi' },

  // ── Noodles ───────────────────────────────────────────────────────────────────
  { id: 'noodles-any', name: 'Any Noodles', category: 'noodles', imageKey: 'noodles_any' },
  { id: 'noodles-ramen', name: 'Ramen', category: 'noodles', imageKey: 'noodles_ramen' },
  { id: 'noodles-udon', name: 'Udon', category: 'noodles', imageKey: 'noodles_udon' },
  { id: 'noodles-soba', name: 'Soba', category: 'noodles', imageKey: 'noodles_soba' },
  { id: 'noodles-yaki-udon', name: 'Yaki Udon', category: 'noodles', imageKey: 'noodles_yaki_udon' },
  { id: 'noodles-pad-thai', name: 'Pad Thai', category: 'noodles', imageKey: 'noodles_pad_thai' },

  // ── Teriyaki ─────────────────────────────────────────────────────────────────
  { id: 'teriyaki-any', name: 'Any Teriyaki', category: 'teriyaki', imageKey: 'teriyaki_any' },
  { id: 'teriyaki-chicken', name: 'Chicken Teriyaki', category: 'teriyaki', imageKey: 'teriyaki_chicken' },
  { id: 'teriyaki-salmon', name: 'Salmon Teriyaki', category: 'teriyaki', imageKey: 'teriyaki_salmon' },
  { id: 'teriyaki-beef', name: 'Beef Teriyaki', category: 'teriyaki', imageKey: 'teriyaki_beef' },
  { id: 'teriyaki-tofu', name: 'Tofu Teriyaki', category: 'teriyaki', imageKey: 'teriyaki_tofu' },

  // ── Skewers ───────────────────────────────────────────────────────────────────
  { id: 'skewers-any', name: 'Any Skewer', category: 'skewers', imageKey: 'skewers_any' },
  { id: 'skewers-chicken', name: 'Chicken Yakitori', category: 'skewers', imageKey: 'skewers_chicken' },
  { id: 'skewers-beef', name: 'Beef Skewer', category: 'skewers', imageKey: 'skewers_beef' },
  { id: 'skewers-shrimp', name: 'Shrimp Skewer', category: 'skewers', imageKey: 'skewers_shrimp' },
  { id: 'skewers-veggie', name: 'Veggie Skewer', category: 'skewers', imageKey: 'skewers_veggie' },

  // ── Spring Rolls ─────────────────────────────────────────────────────────────
  { id: 'spring-roll-any', name: 'Any Spring Roll', category: 'spring_roll', imageKey: 'spring_roll_any' },
  { id: 'spring-roll-vegetable', name: 'Vegetable Spring Roll', category: 'spring_roll', imageKey: 'spring_roll_vegetable' },
  { id: 'spring-roll-shrimp', name: 'Shrimp Spring Roll', category: 'spring_roll', imageKey: 'spring_roll_shrimp' },
  { id: 'spring-roll-pork', name: 'Pork Spring Roll', category: 'spring_roll', imageKey: 'spring_roll_pork' },
  { id: 'spring-roll-fresh', name: 'Fresh Spring Roll', category: 'spring_roll', imageKey: 'spring_roll_fresh' },

  // ── Specials ─────────────────────────────────────────────────────────────────
  { id: 'special-any', name: 'Any Special', category: 'special', imageKey: 'special_any' },
  { id: 'special-edamame', name: 'Edamame', category: 'special', imageKey: 'special_edamame' },
  { id: 'special-gyoza', name: 'Gyoza', category: 'special', imageKey: 'special_gyoza' },

  // ── Desserts ──────────────────────────────────────────────────────────────────
  { id: 'dessert-any', name: 'Any Dessert', category: 'dessert', imageKey: 'dessert_any' },
  { id: 'dessert-ice-cream', name: 'Ice Cream', category: 'dessert', imageKey: 'dessert_ice_cream' },
  { id: 'dessert-mochi', name: 'Mochi', category: 'dessert', imageKey: 'dessert_mochi' },
  { id: 'dessert-green-tea-ice-cream', name: 'Green Tea Ice Cream', category: 'dessert', imageKey: 'dessert_green_tea_ice_cream' },
  { id: 'dessert-tempura-ice-cream', name: 'Tempura Ice Cream', category: 'dessert', imageKey: 'dessert_tempura_ice_cream' },
  { id: 'dessert-cheesecake', name: 'Cheesecake', category: 'dessert', imageKey: 'dessert_cheesecake' },
  { id: 'dessert-tiramisu', name: 'Tiramisu', category: 'dessert', imageKey: 'dessert_tiramisu' },
  { id: 'dessert-banana-tempura', name: 'Banana Tempura', category: 'dessert', imageKey: 'dessert_banana_tempura' },
  { id: 'dessert-lava-cake', name: 'Chocolate Lava Cake', category: 'dessert', imageKey: 'dessert_lava_cake' },
  { id: 'dessert-mango-pudding', name: 'Mango Pudding', category: 'dessert', imageKey: 'dessert_mango_pudding' },
];

export const globalMenu: Menu = {
  id: 'global-default',
  version: 3,
  items,
};

export const globalMenuItemsById: Record<string, SushiItem> = Object.fromEntries(
  items.map((item) => [item.id, item]),
);
