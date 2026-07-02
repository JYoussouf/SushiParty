import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mirrors src/lib/featuredFeed.ts — near-me feed ordering + display helpers.

function sortNearbyFeed(list) {
  return [...list].sort((a, b) => {
    if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    return da - db;
  });
}

function priceLevelLabel(level) {
  if (level === undefined || level <= 0) return '';
  return '$'.repeat(Math.min(4, level));
}

function formatRating(rating, count) {
  if (typeof rating !== 'number' || !count) return null;
  return rating.toFixed(1);
}

const r = (id, distanceKm, featured = false) => ({ id, distanceKm, featured });

describe('sortNearbyFeed', () => {
  it('puts featured spots first regardless of distance', () => {
    const out = sortNearbyFeed([r('near', 0.2), r('far-featured', 9, true), r('mid', 1)]);
    assert.equal(out[0].id, 'far-featured');
  });

  it('orders non-featured by ascending distance', () => {
    const out = sortNearbyFeed([r('c', 3), r('a', 0.5), r('b', 1.2)]);
    assert.deepEqual(out.map((x) => x.id), ['a', 'b', 'c']);
  });

  it('sorts multiple featured spots among themselves by distance', () => {
    const out = sortNearbyFeed([r('f-far', 5, true), r('f-near', 0.3, true), r('plain', 0.1)]);
    assert.deepEqual(out.map((x) => x.id), ['f-near', 'f-far', 'plain']);
  });

  it('places unknown-distance spots last', () => {
    const out = sortNearbyFeed([{ id: 'unknown' }, r('known', 2)]);
    assert.deepEqual(out.map((x) => x.id), ['known', 'unknown']);
  });
});

describe('priceLevelLabel', () => {
  it('maps 1..4 to $-signs and caps at 4', () => {
    assert.equal(priceLevelLabel(1), '$');
    assert.equal(priceLevelLabel(3), '$$$');
    assert.equal(priceLevelLabel(9), '$$$$');
  });
  it('returns empty for unknown or zero', () => {
    assert.equal(priceLevelLabel(undefined), '');
    assert.equal(priceLevelLabel(0), '');
  });
});

describe('formatRating', () => {
  it('formats to one decimal when reviews exist', () => {
    assert.equal(formatRating(4.25, 130), '4.3');
  });
  it('returns null with no reviews or no rating', () => {
    assert.equal(formatRating(4.5, 0), null);
    assert.equal(formatRating(undefined, 10), null);
  });
});
