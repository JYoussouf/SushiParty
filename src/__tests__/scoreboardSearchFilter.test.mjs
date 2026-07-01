/**
 * Tests for the menu search-filter logic in app/session/scoreboard.tsx
 * (issue #23).
 *
 * Mirrors the pure decision logic from scoreboard.tsx exactly:
 *
 *   normalizedQuery = query.trim().toLowerCase()
 *   matchesQuery(item) =
 *     item.name.toLowerCase().includes(normalizedQuery) ||
 *     getCategoryLabel(item.category).toLowerCase().includes(normalizedQuery)
 *
 *   Simple list, per category's items, while searching (normalizedQuery non-empty):
 *     real = items.filter(item => !item.id.endsWith('-any'))
 *     visible = (real.length > 0 ? real : items).filter(matchesQuery)
 *   Simple list, NOT searching:
 *     anyItem = items.find(item => item.id.endsWith('-any'))
 *     collapsible = !!anyItem && items.length > 1
 *     visible = collapsible ? [anyItem] : items
 *
 *   Detailed list, per category:
 *     items = catItems.filter(item => !item.id.endsWith('-any'))
 *     baseItems = items.length > 0 ? items : catItems
 *     displayItems = normalizedQuery ? baseItems.filter(matchesQuery) : baseItems
 *     category dropped (null) when displayItems.length === 0
 *
 *   filteredItemCount = normalizedQuery
 *     ? activeMenu.items.filter(item => !item.id.endsWith('-any') && matchesQuery(item)).length
 *     : activeMenu.items.length
 *
 * This file replicates these pure predicates and asserts on them directly,
 * with no React/RN/Expo imports required.
 *
 * Run with: node --test src/__tests__/scoreboardSearchFilter.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Category label stub — mirrors src/lib/categoryLabels.ts CATEGORY_LABELS ──

const CATEGORY_LABELS = {
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

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] ?? category;
}

// ─── Pure helpers mirroring scoreboard.tsx ────────────────────────────────────

function normalize(query) {
  return query.trim().toLowerCase();
}

function makeMatchesQuery(normalizedQuery) {
  return (item) =>
    item.name.toLowerCase().includes(normalizedQuery) ||
    getCategoryLabel(item.category).toLowerCase().includes(normalizedQuery);
}

/** Mirrors the simple-list per-category visibility decision. */
function simpleVisibleItems(items, normalizedQuery) {
  const matchesQuery = makeMatchesQuery(normalizedQuery);
  if (normalizedQuery) {
    const real = items.filter((item) => !item.id.endsWith('-any'));
    return (real.length > 0 ? real : items).filter(matchesQuery);
  }
  const anyItem = items.find((item) => item.id.endsWith('-any'));
  const collapsible = !!anyItem && items.length > 1;
  return collapsible && anyItem ? [anyItem] : items;
}

/** Mirrors the detailed-list per-category display items (null-when-empty semantics). */
function detailedDisplayItems(catItems, normalizedQuery) {
  const matchesQuery = makeMatchesQuery(normalizedQuery);
  const items = catItems.filter((item) => !item.id.endsWith('-any'));
  const baseItems = items.length > 0 ? items : catItems;
  const displayItems = normalizedQuery ? baseItems.filter(matchesQuery) : baseItems;
  return displayItems.length === 0 ? null : displayItems;
}

/** Mirrors filteredItemCount. */
function filteredItemCount(allItems, normalizedQuery) {
  const matchesQuery = makeMatchesQuery(normalizedQuery);
  return normalizedQuery
    ? allItems.filter((item) => !item.id.endsWith('-any') && matchesQuery(item)).length
    : allItems.length;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const salmonNigiri = { id: 'nigiri-salmon', name: 'Salmon', category: 'nigiri' };
const tunaNigiri = { id: 'nigiri-tuna', name: 'Tuna', category: 'nigiri' };
const nigiriAny = { id: 'nigiri-any', name: 'Nigiri (any)', category: 'nigiri' };

const californiaRoll = { id: 'roll-california', name: 'California Roll', category: 'roll' };
const spicyTunaRoll = { id: 'roll-spicy-tuna', name: 'Spicy Tuna Roll', category: 'roll' };
const rollAny = { id: 'roll-any', name: 'Rolls (any)', category: 'roll' };

const misoSoupOnlyAny = { id: 'soup-any', name: 'Soup (any)', category: 'soup' };

// ─── matchesQuery ───────────────────────────────────────────────────────────

describe('matchesQuery — name and category matching', () => {
  it('matches on item name, case-insensitively', () => {
    const matchesQuery = makeMatchesQuery(normalize('SALMON'));
    assert.equal(matchesQuery(salmonNigiri), true);
  });

  it('matches on a partial/substring of the item name', () => {
    const matchesQuery = makeMatchesQuery(normalize('cali'));
    assert.equal(matchesQuery(californiaRoll), true);
  });

  it('matches on the category label, case-insensitively', () => {
    const matchesQuery = makeMatchesQuery(normalize('nigi'));
    assert.equal(matchesQuery(salmonNigiri), true);
    assert.equal(matchesQuery(tunaNigiri), true);
  });

  it('matches on a multi-word category label like "Special Rolls"', () => {
    const specialRollItem = { id: 'special_roll-dragon', name: 'Dragon Roll', category: 'special_roll' };
    const matchesQuery = makeMatchesQuery(normalize('special'));
    assert.equal(matchesQuery(specialRollItem), true);
  });

  it('does NOT match unrelated text present in neither name nor category label', () => {
    const matchesQuery = makeMatchesQuery(normalize('pizza'));
    assert.equal(matchesQuery(salmonNigiri), false);
    assert.equal(matchesQuery(californiaRoll), false);
  });

  it('does not false-positive across items that share neither name nor category substring', () => {
    const matchesQuery = makeMatchesQuery(normalize('tuna'));
    assert.equal(matchesQuery(tunaNigiri), true);
    assert.equal(matchesQuery(spicyTunaRoll), true);
    assert.equal(matchesQuery(californiaRoll), false);
  });
});

describe('matchesQuery — whitespace and empty query handling', () => {
  it('an all-whitespace query trims to empty string', () => {
    assert.equal(normalize('   '), '');
  });

  it('an empty normalizedQuery matches everything (empty string is a substring of any string)', () => {
    const matchesQuery = makeMatchesQuery(normalize('   '));
    assert.equal(matchesQuery(salmonNigiri), true);
    assert.equal(matchesQuery(californiaRoll), true);
  });

  it('a query with surrounding spaces still matches after trimming', () => {
    const matchesQuery = makeMatchesQuery(normalize('  salmon  '));
    assert.equal(matchesQuery(salmonNigiri), true);
  });

  it('a mixed-case query with surrounding whitespace matches case-insensitively', () => {
    const matchesQuery = makeMatchesQuery(normalize('  SaLmOn  '));
    assert.equal(matchesQuery(salmonNigiri), true);
  });
});

// ─── Simple list: "-any" expansion decision ──────────────────────────────────

describe('simple list — "-any" expansion while searching', () => {
  it('while searching, real items are surfaced and filtered instead of the collapsed "-any" item', () => {
    const items = [salmonNigiri, tunaNigiri, nigiriAny];
    const visible = simpleVisibleItems(items, normalize('salmon'));
    assert.deepEqual(visible, [salmonNigiri]);
  });

  it('while searching, a query matching the shared category label surfaces all real items', () => {
    const items = [salmonNigiri, tunaNigiri, nigiriAny];
    const visible = simpleVisibleItems(items, normalize('nigiri'));
    assert.deepEqual(visible, [salmonNigiri, tunaNigiri]);
  });

  it('when a category has ONLY an "-any" item, it is filtered directly (no real items to fall back on)', () => {
    const items = [misoSoupOnlyAny];
    const visibleMatch = simpleVisibleItems(items, normalize('soup'));
    assert.deepEqual(visibleMatch, [misoSoupOnlyAny]);

    const visibleNoMatch = simpleVisibleItems(items, normalize('salmon'));
    assert.deepEqual(visibleNoMatch, []);
  });

  it('while searching with no match at all, real items are surfaced but filtered out to empty', () => {
    const items = [californiaRoll, spicyTunaRoll, rollAny];
    const visible = simpleVisibleItems(items, normalize('pizza'));
    assert.deepEqual(visible, []);
  });
});

describe('simple list — collapsing to "-any" aggregate when NOT searching', () => {
  it('a collapsible category (has "-any" item and more than 1 item) collapses to just the aggregate', () => {
    const items = [salmonNigiri, tunaNigiri, nigiriAny];
    const visible = simpleVisibleItems(items, normalize(''));
    assert.deepEqual(visible, [nigiriAny]);
  });

  it('a category with only a single item (no "-any", not collapsible) shows that item as-is', () => {
    const items = [salmonNigiri];
    const visible = simpleVisibleItems(items, normalize(''));
    assert.deepEqual(visible, [salmonNigiri]);
  });

  it('a category with only an "-any" item and nothing else is NOT collapsible (items.length is 1)', () => {
    const items = [misoSoupOnlyAny];
    const visible = simpleVisibleItems(items, normalize(''));
    assert.deepEqual(visible, [misoSoupOnlyAny]);
  });

  it('a category with multiple real items but no "-any" item shows all items uncollapsed', () => {
    const items = [californiaRoll, spicyTunaRoll];
    const visible = simpleVisibleItems(items, normalize(''));
    assert.deepEqual(visible, [californiaRoll, spicyTunaRoll]);
  });
});

// ─── Detailed list ────────────────────────────────────────────────────────────

describe('detailed list — per-category filtering and null-when-empty', () => {
  it('while searching, filters items within a category by matchesQuery', () => {
    const catItems = [californiaRoll, spicyTunaRoll, rollAny];
    const result = detailedDisplayItems(catItems, normalize('spicy'));
    assert.deepEqual(result, [spicyTunaRoll]);
  });

  it('a category with zero matches while searching is dropped (returns null)', () => {
    const catItems = [californiaRoll, spicyTunaRoll, rollAny];
    const result = detailedDisplayItems(catItems, normalize('pizza'));
    assert.equal(result, null);
  });

  it('a category with only "-any" items falls back to those items when filtering (no real items)', () => {
    const catItems = [misoSoupOnlyAny];
    const result = detailedDisplayItems(catItems, normalize('soup'));
    assert.deepEqual(result, [misoSoupOnlyAny]);
  });

  it('when NOT searching, shows all real items (ignoring the "-any" aggregate) unfiltered', () => {
    const catItems = [salmonNigiri, tunaNigiri, nigiriAny];
    const result = detailedDisplayItems(catItems, normalize(''));
    assert.deepEqual(result, [salmonNigiri, tunaNigiri]);
  });
});

// ─── filteredItemCount ────────────────────────────────────────────────────────

describe('filteredItemCount — drives the "No matches" empty state', () => {
  const allItems = [salmonNigiri, tunaNigiri, nigiriAny, californiaRoll, spicyTunaRoll, rollAny, misoSoupOnlyAny];

  it('excludes "-any" items even when they would otherwise match the query', () => {
    // "any" appears in every "-any" item's display name pattern, but count must
    // only reflect real (non "-any") items.
    const count = filteredItemCount(allItems, normalize('nigiri'));
    assert.equal(count, 2); // salmonNigiri, tunaNigiri — not nigiriAny
  });

  it('counts only items whose name or category matches the query', () => {
    const count = filteredItemCount(allItems, normalize('tuna'));
    assert.equal(count, 2); // tunaNigiri, spicyTunaRoll
  });

  it('is 0 when nothing matches — this is what drives the "No matches" empty state', () => {
    const count = filteredItemCount(allItems, normalize('pizza'));
    assert.equal(count, 0);
  });

  it('when not searching, counts the full menu including "-any" items', () => {
    const count = filteredItemCount(allItems, normalize(''));
    assert.equal(count, allItems.length);
  });

  it('counts a category with only an "-any" item as 0 when it does not match a real-item search', () => {
    const count = filteredItemCount([misoSoupOnlyAny], normalize('salmon'));
    assert.equal(count, 0);
  });
});
