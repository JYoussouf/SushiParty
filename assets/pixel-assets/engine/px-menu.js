/* ============================================================
   Sushi Party — full menu → sprite mapping (all 110 items)
   "Any X" entries reuse their category hero. A handful of
   genuinely indistinguishable items also share art (reuse).
   Depends on px-core / px-forms / px-forms2.
   ============================================================ */
const P = PAL;

const CATS = [
  { id: 'nigiri', label: 'Nigiri', accent: '#e53935', items: [
    { k: 'nigiri_any', n: 'Any Nigiri', reuse: 'nigiri_salmon' },
    { k: 'nigiri_salmon', n: 'Salmon', make: () => nigiri({ fish: P.salmon, stripe: P.salmon.stripe }) },
    { k: 'nigiri_tuna', n: 'Tuna', make: () => nigiri({ fish: P.tuna }) },
    { k: 'nigiri_yellowtail', n: 'Yellowtail', make: () => nigiri({ fish: P.yellowtail }) },
    { k: 'nigiri_shrimp', n: 'Shrimp', make: () => nigiri({ fish: P.shrimp, tail: true }) },
    { k: 'nigiri_eel', n: 'Eel', make: () => nigiri({ fish: P.eel, glaze: true, band: true }) },
    { k: 'nigiri_scallop', n: 'Scallop', make: () => nigiri({ fish: P.scallop, plump: true }) },
    { k: 'nigiri_octopus', n: 'Octopus', make: () => nigiri({ fish: P.octopus, skin: P.octopus.skin }) },
    { k: 'nigiri_egg', n: 'Egg (Tamago)', make: () => nigiri({ fish: P.egg, block: true, band: true }) },
  ]},
  { id: 'sashimi', label: 'Sashimi', accent: '#1e88e5', items: [
    { k: 'sashimi_any', n: 'Any Sashimi', reuse: 'sashimi_salmon' },
    { k: 'sashimi_salmon', n: 'Salmon', make: () => sashimi({ fish: P.salmon }) },
    { k: 'sashimi_tuna', n: 'Tuna', make: () => sashimi({ fish: P.tuna }) },
    { k: 'sashimi_yellowtail', n: 'Yellowtail', make: () => sashimi({ fish: P.yellowtail }) },
    { k: 'sashimi_octopus', n: 'Octopus', make: () => sashimi({ fish: P.octopus, skin: P.octopus.skin }) },
    { k: 'sashimi_scallop', n: 'Scallop', make: () => sashimi({ fish: P.scallop, shape: 'disc' }) },
  ]},
  { id: 'roll', label: 'Rolls', accent: '#43a047', items: [
    { k: 'roll_any', n: 'Any Roll', reuse: 'roll_tuna' },
    { k: 'roll_california', n: 'California', make: () => maki({ fill: P.crab, fill2: P.avocado, insideOut: true }) },
    { k: 'roll_spicy_tuna', n: 'Spicy Tuna', make: () => maki({ fill: P.tuna, spicy: true, sesame: true }) },
    { k: 'roll_salmon_avocado', n: 'Salmon Avocado', make: () => maki({ fill: P.salmon, fill2: P.avocado }) },
    { k: 'roll_salmon', n: 'Salmon', make: () => maki({ fill: P.salmon }) },
    { k: 'roll_philadelphia', n: 'Philadelphia', make: () => maki({ fill: P.salmon, fill2: P.cream, insideOut: true }) },
    { k: 'roll_cucumber', n: 'Cucumber (Kappa)', make: () => maki({ fill: P.cucumber, thin: true }) },
    { k: 'roll_avocado', n: 'Avocado', make: () => maki({ fill: P.avocado }) },
    { k: 'roll_tuna', n: 'Tuna (Tekka)', make: () => maki({ fill: P.tuna, thin: true }) },
    { k: 'roll_yellowtail', n: 'Yellowtail', make: () => maki({ fill: P.yellowtail }) },
  ]},
  { id: 'handroll', label: 'Hand Rolls', accent: '#795548', items: [
    { k: 'handroll_any', n: 'Any Hand Roll', reuse: 'handroll_salmon' },
    { k: 'handroll_salmon', n: 'Salmon', make: () => handroll({ fill: P.salmon, bits: P.cucumber, bits2: P.avocado }) },
    { k: 'handroll_tuna', n: 'Tuna', make: () => handroll({ fill: P.tuna, bits: P.cucumber, bits2: P.avocado }) },
    { k: 'handroll_spicy_tuna', n: 'Spicy Tuna', make: () => handroll({ fill: P.tuna, bits: P.spicy, bits2: P.avocado }) },
    { k: 'handroll_shrimp_tempura', n: 'Shrimp Tempura', make: () => handroll({ fill: P.shrimp, bits: P.fried, bits2: P.avocado }) },
    { k: 'handroll_california', n: 'California', make: () => handroll({ fill: P.crab, bits: P.avocado, bits2: P.cucumber }) },
    { k: 'handroll_yellowtail', n: 'Yellowtail', make: () => handroll({ fill: P.yellowtail, bits: P.cucumber, bits2: P.scallion ? P.avocado : P.avocado }) },
  ]},
  { id: 'special_roll', label: 'Special Rolls', accent: '#f9a825', items: [
    { k: 'special_roll_any', n: 'Any Special', reuse: 'special_roll_rainbow' },
    { k: 'special_roll_rainbow', n: 'Rainbow', make: () => specialRoll({ kind: 'rainbow' }) },
    { k: 'special_roll_dragon', n: 'Dragon', make: () => specialRoll({ kind: 'dragon', core: P.eel }) },
    { k: 'special_roll_dynamite', n: 'Dynamite', make: () => specialRoll({ kind: 'dynamite', core: P.spicy }) },
    { k: 'special_roll_volcano', n: 'Volcano', make: () => specialRoll({ kind: 'volcano' }) },
    { k: 'special_roll_spider', n: 'Spider', make: () => specialRoll({ kind: 'spider', core: P.fried }) },
    { k: 'special_roll_caterpillar', n: 'Caterpillar', make: () => specialRoll({ kind: 'caterpillar' }) },
    { k: 'special_roll_shrimp_tempura', n: 'Shrimp Tempura', make: () => specialRoll({ kind: 'shrimp_tempura', core: P.shrimp }) },
  ]},
  { id: 'tempura', label: 'Tempura', accent: '#fb8c00', items: [
    { k: 'tempura_any', n: 'Any Tempura', reuse: 'tempura_shrimp' },
    { k: 'tempura_shrimp', n: 'Shrimp', make: () => tempura({ kind: 'shrimp' }) },
    { k: 'tempura_vegetable', n: 'Vegetable', make: () => tempura({ kind: 'veg' }) },
    { k: 'tempura_chicken', n: 'Chicken', make: () => tempura({ kind: 'chicken' }) },
  ]},
  { id: 'salad', label: 'Salad', accent: '#558b2f', items: [
    { k: 'salad_any', n: 'Any Salad', reuse: 'salad_house' },
    { k: 'salad_seaweed', n: 'Seaweed', make: () => bowl({ mound: P.seaweed, garnish: [{ x: 9, y: 6, c: '#fff7ea' }, { x: 14, y: 7, c: '#fff7ea' }, gb(15, 6.2, 1.2, P.seaweed.l)] }) },
    { k: 'salad_mango', n: 'Mango', make: () => bowl({ mound: P.greens, garnish: [gb(8, 6, 1.6, P.mango.m), gb(14.5, 6, 1.6, P.mango.m), gb(11, 5, 1.3, P.mango.l)] }) },
    { k: 'salad_house', n: 'House', make: () => bowl({ mound: P.greens, garnish: [gb(9, 6, 1.5, P.tomato), gb(15, 6.5, 1.4, P.tomato), { x: 12, y: 5, c: P.greens.l }] }) },
    { k: 'salad_sunomono', n: 'Sunomono', make: () => bowl({ mound: P.cucumber, garnish: [{ x: 9, y: 6, c: P.cucumber.core }, { x: 13, y: 6, c: P.cucumber.core }, { x: 11, y: 7, c: '#fff7ea' }] }) },
  ]},
  { id: 'soup', label: 'Soup', accent: '#f57c00', items: [
    { k: 'soup_any', n: 'Any Soup', reuse: 'soup_miso' },
    { k: 'soup_miso', n: 'Miso', make: () => bowl({ liquid: P.miso.m, bandColor: P.tuna.m, garnish: [gb(8, 8, 1.6, P.tofu.m), gb(15, 9, 1.4, P.tofu.m), { x: 11, y: 7, c: P.scallion }, { x: 13, y: 9, c: P.scallion }, gb(16, 7.5, 1.3, P.seaweed.m)] }) },
    { k: 'soup_hot_sour', n: 'Hot & Sour', make: () => bowl({ liquid: P.brown.m, garnish: [gb(9, 8, 1.4, P.tofu.m), { x: 13, y: 7.5, c: P.spicy.d }, { x: 11, y: 9, c: P.scallion }, gb(15, 8.5, 1.3, P.brown.d)] }) },
    { k: 'soup_tom_yum', n: 'Tom Yum', make: () => bowl({ liquid: P.spicy.m, bandColor: P.greens.m, garnish: [gb(9, 8, 1.6, P.shrimp.m), { x: 13, y: 7, c: P.greens.d }, { x: 15, y: 9, c: P.tomato }, gb(11, 9, 1.1, P.shrimp.l)] }) },
    { k: 'soup_egg_drop', n: 'Egg Drop', make: () => bowl({ liquid: P.eggdrop.m, garnish: [{ x: 9, y: 8, c: P.eggdrop.l }, { x: 12, y: 7, c: P.eggdrop.l }, { x: 14, y: 9, c: P.scallion }, { x: 11, y: 9, c: P.eggdrop.d }] }) },
    { k: 'soup_wonton', n: 'Wonton', make: () => bowl({ liquid: P.clear.m, garnish: [gb(11, 7.6, 2.6, P.cream.m, P.cream.d), { x: 9, y: 9, c: P.scallion }, { x: 15, y: 8, c: P.scallion }] }) },
    { k: 'soup_seaweed', n: 'Seaweed', make: () => bowl({ liquid: P.clear.m, garnish: [gb(9, 8, 1.6, P.seaweed.m), gb(14, 8.5, 1.6, P.seaweed.d), { x: 12, y: 7, c: P.seaweed.m }] }) },
    { k: 'soup_sumashi', n: 'Sumashi (Clear)', make: () => bowl({ liquid: P.clear.l, garnish: [{ x: 12, y: 8, c: P.scallion }, gb(14, 8.5, 1.2, P.cream.m)] }) },
  ]},
  { id: 'rice', label: 'Rice Dishes', accent: '#6d8c3d', items: [
    { k: 'rice_any', n: 'Any Rice', reuse: 'rice_fried' },
    { k: 'rice_fried', n: 'Fried Rice', make: () => bowl({ mound: P.egg, garnish: [{ x: 8, y: 6, c: P.greens.m }, { x: 12, y: 5.5, c: P.tomato }, { x: 15, y: 7, c: P.greens.m }, { x: 10, y: 7.5, c: P.eel.m }] }) },
    { k: 'rice_donburi', n: 'Donburi', make: () => bowl({ mound: P.rice, garnish: [gb(9, 6, 2.2, P.beef.m, P.beef.d), gb(14, 6, 2.2, P.beef.m, P.beef.d), { x: 12, y: 5, c: P.scallion }] }) },
    { k: 'rice_onigiri', n: 'Onigiri', make: () => onigiri({}) },
    { k: 'rice_chirashi', n: 'Chirashi', make: () => bowl({ mound: P.rice, garnish: [gb(8, 6, 1.6, P.salmon.m), gb(13, 5.5, 1.6, P.tuna.m), gb(15, 7, 1.5, P.egg.m), { x: 11, y: 7, c: P.avocado.m }] }) },
  ]},
  { id: 'noodles', label: 'Noodles', accent: '#c46a21', items: [
    { k: 'noodles_any', n: 'Any Noodles', reuse: 'noodles_ramen' },
    { k: 'noodles_ramen', n: 'Ramen', make: () => bowl({ bowl: P.bowlBlue, bandColor: '#ffffff', noodle: P.noodle, eye: '#ffffff', garnish: [gb(8, 6.5, 2.4, P.egg.l, P.egg.m), { x: 15, y: 6, c: P.scallion }, gb(15.5, 8, 1.6, P.nori.d), gb(11, 6, 1.2, P.pork.m)] }) },
    { k: 'noodles_udon', n: 'Udon', make: () => bowl({ noodle: P.noodle, garnish: [{ x: 9, y: 6, c: P.scallion }, { x: 13, y: 6.5, c: P.scallion }, gb(15, 7, 1.6, P.cream.m)] }) },
    { k: 'noodles_soba', n: 'Soba', make: () => bowl({ bowl: P.plate, noodle: P.sobaN, garnish: [{ x: 9, y: 6, c: P.scallion }, { x: 14, y: 6.5, c: '#fff7ea' }, { x: 11, y: 7, c: P.sobaN.d }] }) },
    { k: 'noodles_yaki_udon', n: 'Yaki Udon', make: () => bowl({ mound: P.noodle, garnish: [{ x: 8, y: 6, c: P.greens.m }, { x: 12, y: 5.5, c: P.beef.m }, { x: 15, y: 7, c: P.tomato }, { x: 10, y: 7, c: P.greens.d }] }) },
    { k: 'noodles_pad_thai', n: 'Pad Thai', make: () => bowl({ mound: P.mango, garnish: [{ x: 8, y: 6, c: P.shrimp.m }, { x: 13, y: 5.5, c: P.greens.m }, { x: 15, y: 7, c: P.fried.deep }, { x: 11, y: 7, c: P.shrimp.l }] }) },
  ]},
  { id: 'teriyaki', label: 'Teriyaki', accent: '#9c5a2e', items: [
    { k: 'teriyaki_any', n: 'Any Teriyaki', reuse: 'teriyaki_chicken' },
    { k: 'teriyaki_chicken', n: 'Chicken', make: () => teriyaki({ meat: P.chicken }) },
    { k: 'teriyaki_salmon', n: 'Salmon', make: () => teriyaki({ meat: P.salmon }) },
    { k: 'teriyaki_beef', n: 'Beef', make: () => teriyaki({ meat: P.beef }) },
    { k: 'teriyaki_tofu', n: 'Tofu', make: () => teriyaki({ meat: P.tofu, cubes: true }) },
  ]},
  { id: 'skewers', label: 'Skewers', accent: '#546e7a', items: [
    { k: 'skewers_any', n: 'Any Skewer', reuse: 'skewers_chicken' },
    { k: 'skewers_chicken', n: 'Chicken Yakitori', make: () => skewer({ meat: P.chicken, glaze: true }) },
    { k: 'skewers_beef', n: 'Beef', make: () => skewer({ meat: P.beef, glaze: true }) },
    { k: 'skewers_shrimp', n: 'Shrimp', make: () => skewer({ meat: P.shrimp }) },
    { k: 'skewers_veggie', n: 'Veggie', make: () => skewer({ meat: [P.greens, P.tomato, P.mango] }) },
  ]},
  { id: 'spring_roll', label: 'Spring Rolls', accent: '#00897b', items: [
    { k: 'spring_roll_any', n: 'Any Spring Roll', reuse: 'spring_roll_vegetable' },
    { k: 'spring_roll_vegetable', n: 'Vegetable', make: () => springRoll({ fill: P.greens }) },
    { k: 'spring_roll_shrimp', n: 'Shrimp', make: () => springRoll({ fill: P.shrimp }) },
    { k: 'spring_roll_pork', n: 'Pork', make: () => springRoll({ fill: P.pork }) },
    { k: 'spring_roll_fresh', n: 'Fresh', make: () => springRoll({ fresh: true }) },
  ]},
  { id: 'special', label: 'Specials', accent: '#8e24aa', items: [
    { k: 'special_any', n: 'Any Special', reuse: 'special_gyoza' },
    { k: 'special_edamame', n: 'Edamame', make: () => edamame() },
    { k: 'special_gyoza', n: 'Gyoza', make: () => gyoza() },
  ]},
  { id: 'dessert', label: 'Desserts', accent: '#d81b60', items: [
    { k: 'dessert_any', n: 'Any Dessert', reuse: 'dessert_mochi' },
    { k: 'dessert_ice_cream', n: 'Ice Cream', make: () => iceCream({ scoop: P.vanilla }) },
    { k: 'dessert_mochi', n: 'Mochi', make: () => mochi({}) },
    { k: 'dessert_green_tea_ice_cream', n: 'Green Tea Ice Cream', make: () => iceCream({ scoop: P.matcha }) },
    { k: 'dessert_tempura_ice_cream', n: 'Tempura Ice Cream', make: () => friedIceCream({ scoop: P.vanilla }) },
    { k: 'dessert_cheesecake', n: 'Cheesecake', make: () => cakeSlice({ body: P.cheese, crust: P.fried, berry: true }) },
    { k: 'dessert_tiramisu', n: 'Tiramisu', make: () => cakeSlice({ body: P.tira, layers: true, dust: P.cocoa }) },
    { k: 'dessert_banana_tempura', n: 'Banana Tempura', make: () => bananaTempura() },
    { k: 'dessert_lava_cake', n: 'Chocolate Lava Cake', make: () => cakeSlice({ body: P.choco, molten: P.caramel, dust: '#fff7ea' }) },
    { k: 'dessert_mango_pudding', n: 'Mango Pudding', make: () => puddingCup({ body: P.mango, sauce: P.caramel.d }) },
  ]},
];

// garnish blob helper
function gb(x, y, r, c, c2) { return { x, y, r, c, c2 }; }

// resolve every key -> make fn (following reuse), and render cache
const MAKE_BY_KEY = {};
CATS.forEach(c => c.items.forEach(it => { if (it.make) MAKE_BY_KEY[it.k] = it.make; }));
function makeFor(it) { return it.make || MAKE_BY_KEY[it.reuse]; }
