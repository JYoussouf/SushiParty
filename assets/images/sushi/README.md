# Sushi Image Assets

Drop all sushi item images here. Follow this naming convention strictly.

## Naming Convention

Use the `imageKey` from `src/lib/menus/globalMenu.ts` as the filename stem.

| File | Usage |
|------|-------|
| `nigiri_salmon.png` | 1× (mdpi / baseline) |
| `nigiri_salmon@2x.png` | 2× (xhdpi / @2x) |
| `nigiri_salmon@3x.png` | 3× (xxhdpi / @3x) |

React Native automatically picks the correct resolution at runtime — just place all
three sizes and reference the base name (e.g., `require('./nigiri_salmon.png')`).

## Required Items (from global menu)

```
nigiri_salmon, nigiri_tuna, nigiri_yellowtail, nigiri_shrimp, nigiri_eel,
nigiri_scallop, nigiri_octopus, nigiri_egg,
sashimi_salmon, sashimi_tuna, sashimi_yellowtail, sashimi_octopus, sashimi_scallop,
roll_california, roll_spicy_tuna, roll_salmon_avocado, roll_rainbow, roll_dragon,
roll_philadelphia, roll_shrimp_tempura, roll_cucumber, roll_avocado, roll_tuna,
special_edamame, special_gyoza, special_miso_soup, special_ice_cream
```

## Specs for Designer

- Format: PNG (transparent background preferred) or JPG
- Minimum 1× size: 64×64 px
- 2× size: 128×128 px
- 3× size: 192×192 px
- Style: cute, slightly cartoonish, consistent line-art or flat-illustration look
