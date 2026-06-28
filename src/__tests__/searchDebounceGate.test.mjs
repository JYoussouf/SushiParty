/**
 * Tests for the search debounce gate pattern used in useFriends.ts and
 * restaurant-confirm.tsx.
 *
 * useFriends.ts search(query):
 *   1. Sets latestQueryRef.current = query
 *   2. Clears any pending debounce timeout
 *   3. If query.trim().length < 2: clears results + searching, returns (no network)
 *   4. Else: sets searching=true, schedules a 300ms setTimeout that calls
 *      searchUsersByUsername, then in then/catch/finally bails early if
 *      latestQueryRef.current !== query (stale supersession guard)
 *
 * This file tests the PURE decision logic — the length gate and the stale-
 * supersession guard — as small helpers mirroring the source semantics.
 * No React, no RN, no jest required.
 *
 * Run with: node --test src/__tests__/searchDebounceGate.test.mjs
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ─── Pure helper: length gate ────────────────────────────────────────────────

/**
 * Mirrors the length guard from useFriends.ts search():
 *   if (!userProfile || query.trim().length < 2) → skip network
 *
 * Returns true when a query should be skipped (no network call), false when
 * it should proceed to the debounced fetch.
 */
function shouldSkipSearch(query) {
  return query.trim().length < 2;
}

// ─── Pure helper: stale-supersession guard ───────────────────────────────────

/**
 * Mirrors the staleness check in useFriends.ts then/catch/finally:
 *   if (latestQueryRef.current !== query) return;
 *
 * Returns true when a resolved response is stale (should be discarded).
 */
function isStaleResponse(latestQuery, responseQuery) {
  return latestQuery !== responseQuery;
}

// ─── Tiny scheduler abstraction for debounce invariant testing ───────────────

/**
 * Models the debounce scheduler: only the LAST scheduled callback should fire.
 * Mirrors: clearTimeout(debounceRef.current); debounceRef.current = setTimeout(cb, delay)
 */
function makeDebounceScheduler() {
  let pending = null;

  return {
    schedule(cb) {
      pending = cb; // replaces any previous pending callback
    },
    /** Fire only the latest scheduled callback (simulates timer expiry). */
    flush() {
      if (pending !== null) {
        const cb = pending;
        pending = null;
        cb();
      }
    },
    hasPending() {
      return pending !== null;
    },
    /** Cancel the pending callback without firing it (clearTimeout). */
    clear() {
      pending = null;
    },
  };
}

// ─── Full state machine mirroring useFriends.ts search() ────────────────────

/**
 * Self-contained state machine that faithfully mirrors the search() callback
 * from useFriends.ts:
 *
 *   latestQueryRef.current = query
 *   clearTimeout(debounceRef.current)
 *   if (query.trim().length < 2) { setSearchResults([]); setSearching(false); return }
 *   setSearching(true)
 *   debounceRef.current = setTimeout(() => {
 *     fetchFn(query)
 *       .then(results => { if (latestQuery !== query) return; setSearchResults(results) })
 *       .catch(()    => { if (latestQuery !== query) return; setSearchResults([]) })
 *       .finally(()  => { if (latestQuery !== query) return; setSearching(false) })
 *   }, 300)
 */
function makeSearchMachine(fetchFn) {
  const state = {
    searchResults: [],
    searching: false,
    latestQuery: '',
  };

  const scheduler = makeDebounceScheduler();

  function search(query) {
    state.latestQuery = query;
    scheduler.clear();

    if (query.trim().length < 2) {
      state.searchResults = [];
      state.searching = false;
      return;
    }

    state.searching = true;

    const capturedQuery = query;
    scheduler.schedule(() => {
      void fetchFn(capturedQuery)
        .then((results) => {
          if (state.latestQuery !== capturedQuery) return;
          state.searchResults = results;
        })
        .catch(() => {
          if (state.latestQuery !== capturedQuery) return;
          state.searchResults = [];
        })
        .finally(() => {
          if (state.latestQuery !== capturedQuery) return;
          state.searching = false;
        });
    });
  }

  function clearSearch() {
    scheduler.clear();
    state.latestQuery = '';
    state.searchResults = [];
    state.searching = false;
  }

  return { state, scheduler, search, clearSearch };
}

// ─── Tests: length gate ───────────────────────────────────────────────────────

describe('length gate — shouldSkipSearch', () => {
  it('skips empty string (length 0)', () => {
    assert.equal(shouldSkipSearch(''), true);
  });

  it('skips single space (trimmed length 0)', () => {
    assert.equal(shouldSkipSearch(' '), true);
  });

  it('skips single character (trimmed length 1)', () => {
    assert.equal(shouldSkipSearch('a'), true);
  });

  it('skips single character surrounded by whitespace — "  a " trims to length 1', () => {
    assert.equal(shouldSkipSearch('  a '), true);
  });

  it('skips whitespace-only with multiple spaces (trimmed length 0)', () => {
    assert.equal(shouldSkipSearch('   '), true);
  });

  it('proceeds for exactly 2 characters (boundary: length === 2)', () => {
    assert.equal(shouldSkipSearch('ab'), false);
  });

  it('proceeds for 3 characters', () => {
    assert.equal(shouldSkipSearch('abc'), false);
  });

  it('proceeds for a typical username query', () => {
    assert.equal(shouldSkipSearch('alice'), false);
  });

  it('proceeds when 2 non-space chars are padded with whitespace ("  ab  " trims to 2)', () => {
    assert.equal(shouldSkipSearch('  ab  '), false);
  });
});

// ─── Tests: stale supersession guard ─────────────────────────────────────────

describe('stale supersession guard — isStaleResponse', () => {
  it('response is NOT stale when latestQuery matches the responseQuery', () => {
    assert.equal(isStaleResponse('alice', 'alice'), false);
  });

  it('response IS stale when a newer query has been set', () => {
    assert.equal(isStaleResponse('bob', 'alice'), true);
  });

  it('response IS stale when latestQuery was cleared (empty) but response is for old query', () => {
    assert.equal(isStaleResponse('', 'alice'), true);
  });

  it('response IS stale when latestQuery differs by case (no normalisation at ref level)', () => {
    // The ref stores the raw query; if the user typed "Alice" then "alice" they differ.
    assert.equal(isStaleResponse('alice', 'Alice'), true);
  });

  it('response is NOT stale for empty query when latestQuery is also empty', () => {
    assert.equal(isStaleResponse('', ''), false);
  });
});

// ─── Tests: full state machine — length gate integration ─────────────────────

describe('search machine — length gate stops network and clears state', () => {
  it('sets searching=false and clears results for empty string', () => {
    const machine = makeSearchMachine(() => Promise.resolve([]));
    // Prime some state first
    machine.state.searchResults = [{ uid: '1' }];
    machine.state.searching = true;

    machine.search('');

    assert.equal(machine.state.searching, false);
    assert.deepEqual(machine.state.searchResults, []);
  });

  it('sets searching=false and clears results for single space', () => {
    const machine = makeSearchMachine(() => Promise.resolve([]));
    machine.search(' ');
    assert.equal(machine.state.searching, false);
    assert.deepEqual(machine.state.searchResults, []);
  });

  it('sets searching=false and clears results for single character', () => {
    const machine = makeSearchMachine(() => Promise.resolve([]));
    machine.search('x');
    assert.equal(machine.state.searching, false);
    assert.deepEqual(machine.state.searchResults, []);
  });

  it('sets searching=false for "  a " (1 meaningful char after trim)', () => {
    const machine = makeSearchMachine(() => Promise.resolve([]));
    machine.search('  a ');
    assert.equal(machine.state.searching, false);
  });

  it('does NOT schedule a fetch for queries below the length threshold', () => {
    const machine = makeSearchMachine(() => Promise.resolve([]));
    machine.search('a');
    assert.equal(machine.scheduler.hasPending(), false);
  });

  it('sets searching=true and schedules a fetch for a 2-char query', () => {
    const machine = makeSearchMachine(() => Promise.resolve([]));
    machine.search('ab');
    assert.equal(machine.state.searching, true);
    assert.equal(machine.scheduler.hasPending(), true);
  });

  it('sets searching=true and schedules a fetch for a typical query', () => {
    const machine = makeSearchMachine(() => Promise.resolve([]));
    machine.search('alice');
    assert.equal(machine.state.searching, true);
    assert.equal(machine.scheduler.hasPending(), true);
  });
});

// ─── Tests: full state machine — debounce (only last callback fires) ──────────

describe('search machine — debounce: only the last query in a rapid burst fires', () => {
  it('a second call before flush replaces the first pending callback', () => {
    const calls = [];
    const machine = makeSearchMachine((q) => {
      calls.push(q);
      return Promise.resolve([]);
    });

    machine.search('al');
    machine.search('ali');

    // Only one pending callback, not two
    // (scheduler.clear was called on the second search before scheduling the new one)
    let flushCount = 0;
    while (machine.scheduler.hasPending()) {
      machine.scheduler.flush();
      flushCount++;
    }
    assert.equal(flushCount, 1, 'only one callback should be queued after two rapid calls');
  });

  it('flush after a burst of 5 calls only fires the last query', async () => {
    const calls = [];
    const machine = makeSearchMachine((q) => {
      calls.push(q);
      return Promise.resolve([{ uid: q }]);
    });

    for (const q of ['a', 'al', 'ali', 'alic', 'alice']) {
      machine.search(q);
    }

    machine.scheduler.flush();
    // Give microtasks (the .then/.catch/.finally chain) time to settle
    await new Promise((r) => setImmediate(r));

    assert.deepEqual(calls, ['alice'], 'only the last query should reach the fetch function');
    assert.deepEqual(machine.state.searchResults, [{ uid: 'alice' }]);
    assert.equal(machine.state.searching, false);
  });

  it('a sub-threshold call cancels any pending fetch timer', () => {
    const machine = makeSearchMachine(() => Promise.resolve([]));

    machine.search('ali');       // schedules fetch
    machine.search('a');         // below threshold: clears timer

    assert.equal(machine.scheduler.hasPending(), false, 'sub-threshold call must cancel pending fetch');
    assert.equal(machine.state.searching, false);
  });
});

// ─── Tests: full state machine — stale supersession ──────────────────────────

describe('search machine — stale supersession: out-of-order responses are discarded', () => {
  it('a response for a superseded query does not update searchResults', async () => {
    let resolveOld;
    const oldFetch = new Promise((r) => { resolveOld = r; });

    let fetchCallCount = 0;
    const machine = makeSearchMachine((q) => {
      fetchCallCount++;
      if (q === 'al') return oldFetch;
      return Promise.resolve([{ uid: 'alice_result' }]);
    });

    // First query — fires fetch for 'al'
    machine.search('al');
    machine.scheduler.flush();

    // Second query before 'al' resolves — supersedes 'al'
    machine.search('alice');
    machine.scheduler.flush();

    // 'alice' fetch settles first
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(machine.state.searchResults, [{ uid: 'alice_result' }]);

    // Now the old 'al' fetch resolves — should be discarded
    resolveOld([{ uid: 'stale_result' }]);
    await new Promise((r) => setImmediate(r));

    assert.deepEqual(
      machine.state.searchResults,
      [{ uid: 'alice_result' }],
      'stale response must not overwrite results from the current query',
    );
  });

  it('searching is NOT toggled to false by a superseded response', async () => {
    let resolveStale;
    const staleFetch = new Promise((r) => { resolveStale = r; });

    const machine = makeSearchMachine((q) => {
      if (q === 'al') return staleFetch;
      // Current query fetch never resolves in this test so searching stays true
      return new Promise(() => {});
    });

    machine.search('al');
    machine.scheduler.flush();

    // Supersede with 'alice'
    machine.search('alice');
    machine.scheduler.flush();
    // searching is true because 'alice' fetch is pending
    assert.equal(machine.state.searching, true);

    // Stale 'al' fetch resolves — finally() guard must bail
    resolveStale([]);
    await new Promise((r) => setImmediate(r));

    assert.equal(
      machine.state.searching,
      true,
      'searching must remain true; stale finally() must not set it to false',
    );
  });

  it('a response for the current query IS applied (not discarded)', async () => {
    const machine = makeSearchMachine((q) => Promise.resolve([{ uid: q + '_result' }]));

    machine.search('alice');
    machine.scheduler.flush();
    await new Promise((r) => setImmediate(r));

    assert.deepEqual(machine.state.searchResults, [{ uid: 'alice_result' }]);
    assert.equal(machine.state.searching, false);
  });

  it('a failed fetch for the current query clears results but does not leave searching=true', async () => {
    const machine = makeSearchMachine(() => Promise.reject(new Error('network')));

    machine.search('alice');
    machine.scheduler.flush();
    await new Promise((r) => setImmediate(r));

    assert.deepEqual(machine.state.searchResults, []);
    assert.equal(machine.state.searching, false);
  });

  it('a failed fetch for a superseded query does not clear current results', async () => {
    let rejectStale;
    const staleFetch = new Promise((_, rej) => { rejectStale = rej; });

    const machine = makeSearchMachine((q) => {
      if (q === 'al') return staleFetch;
      return Promise.resolve([{ uid: 'alice_result' }]);
    });

    machine.search('al');
    machine.scheduler.flush();

    machine.search('alice');
    machine.scheduler.flush();
    await new Promise((r) => setImmediate(r)); // 'alice' settles

    assert.deepEqual(machine.state.searchResults, [{ uid: 'alice_result' }]);

    rejectStale(new Error('network'));
    await new Promise((r) => setImmediate(r)); // stale 'al' catch runs

    assert.deepEqual(
      machine.state.searchResults,
      [{ uid: 'alice_result' }],
      'stale rejection must not wipe current results',
    );
  });
});

// ─── Tests: clearSearch resets state ─────────────────────────────────────────

describe('clearSearch', () => {
  it('cancels a pending timer and resets all state', () => {
    const machine = makeSearchMachine(() => Promise.resolve([]));

    machine.search('alice'); // schedules fetch
    assert.equal(machine.scheduler.hasPending(), true);

    machine.clearSearch();

    assert.equal(machine.scheduler.hasPending(), false);
    assert.equal(machine.state.searching, false);
    assert.deepEqual(machine.state.searchResults, []);
    assert.equal(machine.state.latestQuery, '');
  });

  it('makes latestQuery empty so any in-flight response is treated as stale', async () => {
    let resolveFlight;
    const inFlight = new Promise((r) => { resolveFlight = r; });

    const machine = makeSearchMachine(() => inFlight);

    machine.search('alice');
    machine.scheduler.flush(); // fetch in-flight

    machine.clearSearch(); // latestQuery = ''

    resolveFlight([{ uid: 'stale' }]);
    await new Promise((r) => setImmediate(r));

    assert.deepEqual(
      machine.state.searchResults,
      [],
      'in-flight response after clearSearch must be discarded',
    );
  });
});
