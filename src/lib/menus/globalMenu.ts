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
  { id: 'roll-rainbow', name: 'Rainbow Roll', category: 'roll', imageKey: 'roll_rainbow' },
  { id: 'roll-dragon', name: 'Dragon Roll', category: 'roll', imageKey: 'roll_dragon' },
  { id: 'roll-philadelphia', name: 'Philadelphia Roll', category: 'roll', imageKey: 'roll_philadelphia' },
  { id: 'roll-shrimp-tempura', name: 'Shrimp Tempura Roll', category: 'roll', imageKey: 'roll_shrimp_tempura' },
  { id: 'roll-cucumber', name: 'Cucumber Roll (Kappa Maki)', category: 'roll', imageKey: 'roll_cucumber' },
  { id: 'roll-avocado', name: 'Avocado Roll', category: 'roll', imageKey: 'roll_avocado' },
  { id: 'roll-tuna', name: 'Tuna Roll (Tekka Maki)', category: 'roll', imageKey: 'roll_tuna' },

  // ── Soup ─────────────────────────────────────────────────────────────────────
  { id: 'soup-any', name: 'Any Soup', category: 'soup', imageKey: 'soup_any' },
  { id: 'soup-miso', name: 'Miso Soup', category: 'soup', imageKey: 'soup_miso' },
  { id: 'soup-hot-sour', name: 'Hot & Sour Soup', category: 'soup', imageKey: 'soup_hot_sour' },
  { id: 'soup-tom-yum', name: 'Tom Yum Soup', category: 'soup', imageKey: 'soup_tom_yum' },
  { id: 'soup-egg-drop', name: 'Egg Drop Soup', category: 'soup', imageKey: 'soup_egg_drop' },
  { id: 'soup-wonton', name: 'Wonton Soup', category: 'soup', imageKey: 'soup_wonton' },
  { id: 'soup-seaweed', name: 'Seaweed Soup', category: 'soup', imageKey: 'soup_seaweed' },
  { id: 'soup-sumashi', name: 'Sumashi (Clear) Soup', category: 'soup', imageKey: 'soup_sumashi' },

  // ── Specials ─────────────────────────────────────────────────────────────────
  { id: 'special-edamame', name: 'Edamame', category: 'special', imageKey: 'special_edamame' },
  { id: 'special-gyoza', name: 'Gyoza', category: 'special', imageKey: 'special_gyoza' },
  { id: 'special-ice-cream', name: 'Ice Cream', category: 'special', imageKey: 'special_ice_cream' },
];

export const globalMenu: Menu = {
  id: 'global-default',
  version: 1,
  items,
};

export const globalMenuItemsById: Record<string, SushiItem> = Object.fromEntries(
  items.map((item) => [item.id, item]),
);
