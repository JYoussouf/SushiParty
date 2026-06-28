/**
 * Tests for the "You're here" detection and row-highlight gating logic
 * introduced in app/restaurant/picker.tsx (ticket #10).
 *
 * Source semantics being mirrored:
 *
 *   findHereId (nearby-results effect):
 *     const here = results.find(r => r.distanceKm !== undefined && r.distanceKm <= 0.1);
 *     setHereId(here?.id ?? null);
 *
 *   isHere (renderItem):
 *     const isHere = !showSearch && item.id === hereId;
 *
 * No React, no RN, no jest required.
 * Run with: node --test src/__tests__/pickerHereMatch.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Pure helper: here-match detection ──────────────────────────────────────

/**
 * Mirrors the effect in picker.tsx:
 *   results.find(r => r.distanceKm !== undefined && r.distanceKm <= 0.1)?.id ?? null
 *
 * Returns the id of the first result with distanceKm !== undefined && <= 0.1,
 * or null if none qualify.
 *
 * @param {{ id: string; distanceKm?: number }[]} results
 * @returns {string | null}
 */
function findHereId(results) {
  const here = results.find(r => r.distanceKm !== undefined && r.distanceKm <= 0.1);
  return here?.id ?? null;
}

// ─── Pure helper: row highlight gating ──────────────────────────────────────

/**
 * Mirrors renderItem in picker.tsx:
 *   const isHere = !showSearch && item.id === hereId;
 *
 * @param {boolean} showSearch
 * @param {string}  itemId
 * @param {string | null} hereId
 * @returns {boolean}
 */
function isHere(showSearch, itemId, hereId) {
  return !showSearch && itemId === hereId;
}

// ─── Tests: findHereId ───────────────────────────────────────────────────────

describe('findHereId', () => {
  it('returns null for an empty results array', () => {
    assert.strictEqual(findHereId([]), null);
  });

  it('returns null when all distances are above 0.1 km', () => {
    const results = [
      { id: 'a', distanceKm: 0.5 },
      { id: 'b', distanceKm: 1.2 },
    ];
    assert.strictEqual(findHereId(results), null);
  });

  it('returns null when all entries have undefined distanceKm', () => {
    const results = [
      { id: 'a' },
      { id: 'b' },
    ];
    assert.strictEqual(findHereId(results), null);
  });

  it('returns null when distanceKm is undefined even if other fields are present', () => {
    assert.strictEqual(findHereId([{ id: 'x', distanceKm: undefined }]), null);
  });

  it('returns the id of a result exactly at the 0.1 km boundary (<=, so qualifies)', () => {
    const results = [{ id: 'exact', distanceKm: 0.1 }];
    assert.strictEqual(findHereId(results), 'exact');
  });

  it('returns null for a result just above the 0.1 km boundary (0.1001 does not qualify)', () => {
    const results = [{ id: 'just-over', distanceKm: 0.1001 }];
    assert.strictEqual(findHereId(results), null);
  });

  it('returns the id of a result well within 0.1 km', () => {
    const results = [{ id: 'close', distanceKm: 0.05 }];
    assert.strictEqual(findHereId(results), 'close');
  });

  it('returns the id of the FIRST qualifying result when multiple qualify', () => {
    const results = [
      { id: 'first',  distanceKm: 0.08 },
      { id: 'second', distanceKm: 0.02 },
    ];
    assert.strictEqual(findHereId(results), 'first');
  });

  it('skips entries with undefined distanceKm and finds a later qualifying entry', () => {
    const results = [
      { id: 'no-dist' },
      { id: 'has-dist', distanceKm: 0.05 },
    ];
    assert.strictEqual(findHereId(results), 'has-dist');
  });

  it('returns null when the only within-range candidate has undefined distanceKm mixed with out-of-range distances', () => {
    const results = [
      { id: 'a', distanceKm: undefined },
      { id: 'b', distanceKm: 0.2 },
      { id: 'c', distanceKm: 0.9 },
    ];
    assert.strictEqual(findHereId(results), null);
  });
});

// ─── Tests: isHere ───────────────────────────────────────────────────────────

describe('isHere', () => {
  it('returns true in Nearby view when itemId matches hereId', () => {
    assert.strictEqual(isHere(false, 'abc', 'abc'), true);
  });

  it('returns false in search view even when itemId matches hereId (search rows must never be tagged)', () => {
    assert.strictEqual(isHere(true, 'abc', 'abc'), false);
  });

  it('returns false in Nearby view when itemId does not match hereId', () => {
    assert.strictEqual(isHere(false, 'abc', 'xyz'), false);
  });

  it('returns false in Nearby view when hereId is null', () => {
    assert.strictEqual(isHere(false, 'abc', null), false);
  });

  it('returns false in search view when hereId is null', () => {
    assert.strictEqual(isHere(true, 'abc', null), false);
  });

  it('returns false in search view when itemId differs from hereId', () => {
    assert.strictEqual(isHere(true, 'abc', 'xyz'), false);
  });
});
