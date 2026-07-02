import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mirrors the favourite-resolution + ordering logic in src/lib/placeInsights.ts.
// A place is identified by its normalized name. The favourite is the pinned
// override when it still exists, otherwise the most-partied spot. Ordering:
// favourite first, then visited spots (by visits, then pieces), then browsed-only
// spots (most recently viewed first).

const key = (name) => name.trim().toLowerCase();

function resolveAndSort(places, favoriteKey) {
  const all = places.map((p) => ({ ...p, isFavorite: false }));
  const visitedSorted = all
    .filter((p) => p.visited)
    .sort((a, b) => b.visits - a.visits || b.totalPieces - a.totalPieces);
  const pinned = favoriteKey ? all.find((p) => p.key === favoriteKey) : undefined;
  const favorite = pinned ?? visitedSorted[0];
  if (favorite) favorite.isFavorite = true;

  all.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    if (a.visited !== b.visited) return a.visited ? -1 : 1;
    if (a.visited && b.visited) return b.visits - a.visits || b.totalPieces - a.totalPieces;
    return (b.lastViewedAt ?? '').localeCompare(a.lastViewedAt ?? '');
  });
  return all;
}

const place = (name, { visited = false, visits = 0, totalPieces = 0, lastViewedAt } = {}) => ({
  key: key(name),
  name,
  visited,
  visits,
  totalPieces,
  lastViewedAt,
});

describe('place favourite resolution', () => {
  it('defaults the favourite to the most-visited spot', () => {
    const result = resolveAndSort(
      [
        place('Kibo', { visited: true, visits: 2, totalPieces: 30 }),
        place('Midori', { visited: true, visits: 5, totalPieces: 40 }),
      ],
      null,
    );
    assert.equal(result[0].name, 'Midori');
    assert.equal(result[0].isFavorite, true);
    assert.equal(result[1].isFavorite, false);
  });

  it('honours a pinned override even over a more-visited spot', () => {
    const result = resolveAndSort(
      [
        place('Kibo', { visited: true, visits: 2, totalPieces: 30 }),
        place('Midori', { visited: true, visits: 5, totalPieces: 40 }),
      ],
      key('Kibo'),
    );
    const fav = result.find((p) => p.isFavorite);
    assert.equal(fav.name, 'Kibo');
    assert.equal(result[0].name, 'Kibo'); // favourite floats to the top
  });

  it('breaks visit ties by total pieces', () => {
    const result = resolveAndSort(
      [
        place('A', { visited: true, visits: 3, totalPieces: 20 }),
        place('B', { visited: true, visits: 3, totalPieces: 55 }),
      ],
      null,
    );
    assert.equal(result[0].name, 'B');
  });

  it('orders browsed-only spots after visited spots, newest browse first', () => {
    const result = resolveAndSort(
      [
        place('Visited', { visited: true, visits: 1, totalPieces: 10 }),
        place('OldBrowse', { visited: false, lastViewedAt: '2026-01-01T00:00:00.000Z' }),
        place('NewBrowse', { visited: false, lastViewedAt: '2026-06-01T00:00:00.000Z' }),
      ],
      null,
    );
    assert.equal(result[0].name, 'Visited'); // favourite (only visited)
    assert.equal(result[1].name, 'NewBrowse');
    assert.equal(result[2].name, 'OldBrowse');
  });

  it('a stale pinned key (place gone) falls back to most-visited', () => {
    const result = resolveAndSort(
      [place('Midori', { visited: true, visits: 5, totalPieces: 40 })],
      key('DeletedSpot'),
    );
    const fav = result.find((p) => p.isFavorite);
    assert.equal(fav.name, 'Midori');
  });
});
