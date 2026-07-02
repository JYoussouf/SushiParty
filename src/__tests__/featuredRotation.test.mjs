import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mirrors selectRotatingFeatured in api/src/index.ts — sponsored placement is
// finite inventory: feature at most `slots`, rotating which sponsors fill the
// top slots over time so a busy area doesn't put every payer on top at once.

function selectRotatingFeatured(sortedIds, slots, bucket) {
  if (slots <= 0 || sortedIds.length === 0) return new Set();
  if (sortedIds.length <= slots) return new Set(sortedIds);
  const chosen = new Set();
  const offset = ((bucket % sortedIds.length) + sortedIds.length) % sortedIds.length;
  for (let i = 0; i < slots; i += 1) {
    const id = sortedIds[(offset + i) % sortedIds.length];
    if (id) chosen.add(id);
  }
  return chosen;
}

const ids = (n) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i)); // a,b,c,...

describe('selectRotatingFeatured', () => {
  it('features everyone when sponsors <= slots', () => {
    assert.deepEqual([...selectRotatingFeatured(['a', 'b'], 2, 0)], ['a', 'b']);
    assert.deepEqual([...selectRotatingFeatured(['a'], 2, 5)], ['a']);
  });

  it('caps the featured set to the slot count', () => {
    assert.equal(selectRotatingFeatured(ids(6), 2, 0).size, 2);
    assert.equal(selectRotatingFeatured(ids(10), 3, 7).size, 3);
  });

  it('rotates the window as the time bucket advances', () => {
    const list = ids(5); // a b c d e
    assert.deepEqual([...selectRotatingFeatured(list, 2, 0)], ['a', 'b']);
    assert.deepEqual([...selectRotatingFeatured(list, 1, 0)], ['a']);
    assert.deepEqual([...selectRotatingFeatured(list, 1, 1)], ['b']);
    assert.deepEqual([...selectRotatingFeatured(list, 1, 4)], ['e']);
  });

  it('wraps the window around the end of the list', () => {
    const list = ids(4); // a b c d
    // bucket 3, 2 slots -> starts at d, wraps to a
    assert.deepEqual([...selectRotatingFeatured(list, 2, 3)], ['d', 'a']);
  });

  it('is stable within the same bucket and rotates across buckets', () => {
    const list = ids(6);
    const b0 = [...selectRotatingFeatured(list, 2, 0)];
    const b0again = [...selectRotatingFeatured(list, 2, 0)];
    assert.deepEqual(b0, b0again); // deterministic within a bucket
    const b1 = [...selectRotatingFeatured(list, 2, 1)];
    assert.notDeepEqual(b0, b1); // moves on the next bucket
  });

  it('handles slots <= 0 and empty input safely', () => {
    assert.equal(selectRotatingFeatured(ids(5), 0, 0).size, 0);
    assert.equal(selectRotatingFeatured([], 2, 0).size, 0);
  });

  it('every sponsor eventually gets featured across buckets (fair share)', () => {
    const list = ids(5);
    const seen = new Set();
    for (let bucket = 0; bucket < 5; bucket += 1) {
      for (const id of selectRotatingFeatured(list, 1, bucket)) seen.add(id);
    }
    assert.deepEqual([...seen].sort(), list); // all five appear over 5 buckets
  });
});
