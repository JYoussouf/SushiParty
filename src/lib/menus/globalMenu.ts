import type { Menu, SushiItem } from '../../types';

const items: SushiItem[] = [
  // ── Nigiri ──────────────────────────────────────────────────────────────────
  { id: 'nigiri-salmon', name: 'Salmon Nigiri', category: 'nigiri', imageKey: 'nigiri_salmon' },
  { id: 'nigiri-tuna', name: 'Tuna Nigiri', category: 'nigiri', imageKey: 'nigiri_tuna' },
  { id: 'nigiri-yellowtail', name: 'Yellowtail Nigiri', category: 'nigiri', imageKey: 'nigiri_yellowtail' },
  { id: 'nigiri-shrimp', name: 'Shrimp Nigiri', category: 'nigiri', imageKey: 'nigiri_shrimp' },
  { id: 'nigiri-eel', name: 'Eel Nigiri', category: 'nigiri', imageKey: 'nigiri_eel' },
  { id: 'nigiri-scallop', name: 'Scallop Nigiri', category: 'nigiri', imageKey: 'nigiri_scallop' },
  { id: 'nigiri-octopus', name: 'Octopus Nigiri', category: 'nigiri', imageKey: 'nigiri_octopus' },
  { id: 'nigiri-egg', name: 'Egg Nigiri (Tamago)', category: 'nigiri', imageKey: 'nigiri_egg' },

  // ── Sashimi ─────────────────────────────────────────────────────────────────
  { id: 'sashimi-salmon', name: 'Salmon Sashimi', category: 'sashimi', imageKey: 'sashimi_salmon' },
  { id: 'sashimi-tuna', name: 'Tuna Sashimi', category: 'sashimi', imageKey: 'sashimi_tuna' },
  { id: 'sashimi-yellowtail', name: 'Yellowtail Sashimi', category: 'sashimi', imageKey: 'sashimi_yellowtail' },
  { id: 'sashimi-octopus', name: 'Octopus Sashimi', category: 'sashimi', imageKey: 'sashimi_octopus' },
  { id: 'sashimi-scallop', name: 'Scallop Sashimi', category: 'sashimi', imageKey: 'sashimi_scallop' },

  // ── Rolls ────────────────────────────────────────────────────────────────────
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

  // ── Specials ─────────────────────────────────────────────────────────────────
  { id: 'special-edamame', name: 'Edamame', category: 'special', imageKey: 'special_edamame' },
  { id: 'special-gyoza', name: 'Gyoza', category: 'special', imageKey: 'special_gyoza' },
  { id: 'special-miso-soup', name: 'Miso Soup', category: 'special', imageKey: 'special_miso_soup' },
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
