/**
 * Tests for the group-party END lifecycle (issue #29).
 *
 * Covers three pure decision points mirrored exactly from the current code:
 *
 * 1. Guest end-of-party navigation predicate (app/session/scoreboard.tsx:112-115):
 *      useEffect(() => {
 *        if (mode !== 'group' || isHost || groupPhase !== 'ended') return;
 *        if (endedNavRef.current || !userProfile) return;
 *        endedNavRef.current = true;
 *        ...
 *      }, [...]);
 *    combined with the endedNavRef one-shot guard (reset on unmount only).
 *
 * 2. Guest SushiSession build from the shared draft (scoreboard.tsx:122-138), which
 *    calls submitLocalSession with ALL participants (for group breakdown) plus the
 *    shared groupContext fields, falling back per-field when groupContext is null:
 *      restaurantId: ctx?.restaurantId ?? 'unknown'
 *      restaurantName: ctx?.restaurantName ?? 'Unknown Restaurant'
 *      menuId: ctx?.menuId ?? globalMenu.id            ('global-default')
 *      menuVersion: ctx?.menuVersion ?? globalMenu.version (3)
 *      location: ctx?.location ?? { latitude: 0, longitude: 0 }
 *      ...(ctx?.startedAt ? { startedAt: ctx.startedAt } : {})
 *
 * 3. startedAt defaulting inside submitSession/submitLocalSession
 *    (src/lib/local/sessions.ts:51,61): `params.startedAt ?? now`.
 *
 * Run with: node --test src/__tests__/partyEndLifecycle.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors the guest end-of-party navigation predicate from scoreboard.tsx:
 *   if (mode !== 'group' || isHost || groupPhase !== 'ended') return;
 *   if (endedNavRef.current || !userProfile) return;
 * `alreadyEnded` stands in for `endedNavRef.current`; `hasProfile` for `!!userProfile`.
 */
function shouldGuestEnterResults({ mode = 'group', groupPhase, isHost, alreadyEnded, hasProfile = true }) {
  if (mode !== 'group' || isHost || groupPhase !== 'ended') return false;
  if (alreadyEnded || !hasProfile) return false;
  return true;
}

/**
 * Mirrors the endedNavRef one-shot guard: fires the callback at most once per
 * mount, same double-fire-prevention pattern as makeEnterPartyGuard /
 * finishOnce.
 */
function makeEndedNavGuard(onEnter) {
  const endedRef = { current: false };
  return function tryEnter(decision) {
    if (!decision) return false;
    if (endedRef.current) return false;
    endedRef.current = true;
    onEnter();
    return true;
  };
}

const globalMenu = { id: 'global-default', version: 3 };

/**
 * Mirrors the guest SushiSession-build params passed to submitLocalSession in
 * scoreboard.tsx's guest end-of-party effect. `draft` is the group draft as
 * seen by the guest: { participants, groupContext, groupCode }.
 */
function buildGuestSessionParams(draft, currentUid) {
  const ctx = draft.groupContext;
  const code = draft.groupCode;
  return {
    ownerUid: currentUid,
    mode: 'group',
    restaurantId: ctx?.restaurantId ?? 'unknown',
    restaurantName: ctx?.restaurantName ?? 'Unknown Restaurant',
    menuId: ctx?.menuId ?? globalMenu.id,
    menuVersion: ctx?.menuVersion ?? globalMenu.version,
    location: ctx?.location ?? { latitude: 0, longitude: 0 },
    participants: draft.participants,
    ...(ctx?.startedAt ? { startedAt: ctx.startedAt } : {}),
    ...(code ? { groupCode: code } : {}),
  };
}

/**
 * Mirrors submitSession/submitLocalSession's startedAt defaulting
 * (src/lib/local/sessions.ts:51,61): `params.startedAt ?? now`.
 */
function resolveStartedAt(params, now = new Date().toISOString()) {
  return params.startedAt ?? now;
}

describe('shouldGuestEnterResults (guest end-nav truth table)', () => {
  const base = { groupPhase: 'ended', isHost: false, alreadyEnded: false };

  it('navigates on the single true case: ended phase, guest, not yet navigated', () => {
    assert.equal(shouldGuestEnterResults(base), true);
  });

  it('does not navigate when phase is lobby', () => {
    assert.equal(shouldGuestEnterResults({ ...base, groupPhase: 'lobby' }), false);
  });

  it('does not navigate when phase is active', () => {
    assert.equal(shouldGuestEnterResults({ ...base, groupPhase: 'active' }), false);
  });

  it('never navigates the host, even when phase is ended', () => {
    assert.equal(shouldGuestEnterResults({ ...base, isHost: true }), false);
  });

  it('does not navigate a host in lobby/active either (host stays on its own path)', () => {
    assert.equal(shouldGuestEnterResults({ ...base, isHost: true, groupPhase: 'lobby' }), false);
    assert.equal(shouldGuestEnterResults({ ...base, isHost: true, groupPhase: 'active' }), false);
  });

  it('does not re-navigate once already navigated (guard already fired)', () => {
    assert.equal(shouldGuestEnterResults({ ...base, alreadyEnded: true }), false);
  });

  it('does not navigate a solo/non-group session', () => {
    assert.equal(shouldGuestEnterResults({ ...base, mode: 'single' }), false);
  });

  it('does not navigate without a loaded user profile', () => {
    assert.equal(shouldGuestEnterResults({ ...base, hasProfile: false }), false);
  });
});

describe('makeEndedNavGuard (one-shot guard around the guest end-nav effect)', () => {
  it('fires exactly once when the decision is true on every call', () => {
    let calls = 0;
    const tryEnter = makeEndedNavGuard(() => { calls += 1; });

    assert.equal(tryEnter(true), true);
    assert.equal(tryEnter(true), false);
    assert.equal(tryEnter(true), false);
    assert.equal(calls, 1);
  });

  it('does not consume the guard when the decision is false (e.g. still lobby/active)', () => {
    let calls = 0;
    const tryEnter = makeEndedNavGuard(() => { calls += 1; });

    assert.equal(tryEnter(false), false);
    assert.equal(tryEnter(false), false);
    assert.equal(calls, 0);
    // Guard is still available once the phase actually flips to ended.
    assert.equal(tryEnter(true), true);
    assert.equal(calls, 1);
  });

  it('models a re-broadcast of the ended phase re-firing the effect: still only enters once', () => {
    let calls = 0;
    const tryEnter = makeEndedNavGuard(() => { calls += 1; });
    // Simulates the effect re-running because a dependency (e.g. participants) changed
    // while groupPhase stays 'ended'.
    for (let i = 0; i < 5; i += 1) {
      tryEnter(shouldGuestEnterResults({ groupPhase: 'ended', isHost: false, alreadyEnded: i > 0 }));
    }
    assert.equal(calls, 1);
  });
});

describe('buildGuestSessionParams (session build from shared draft context)', () => {
  const participants = [
    { userId: 'guest-1', displayName: 'Guest One', counts: { 'nigiri-salmon': 3 } },
    { userId: 'host-1', displayName: 'Host', counts: { 'roll-california': 2 } },
    { userId: 'guest-2', displayName: 'Guest Two', counts: {} },
  ];
  const fullContext = {
    restaurantId: 'rest-42',
    restaurantName: 'Sushi Palace',
    location: { latitude: 12.5, longitude: -3.25 },
    menuId: 'menu-42',
    menuVersion: 7,
    startedAt: '2026-06-30T18:00:00.000Z',
  };
  const draft = { participants, groupContext: fullContext, groupCode: 'ABCD' };

  it('carries the shared restaurant/menu/location context through unchanged', () => {
    const params = buildGuestSessionParams(draft, 'guest-1');
    assert.equal(params.restaurantId, 'rest-42');
    assert.equal(params.restaurantName, 'Sushi Palace');
    assert.deepEqual(params.location, { latitude: 12.5, longitude: -3.25 });
    assert.equal(params.menuId, 'menu-42');
    assert.equal(params.menuVersion, 7);
    assert.equal(params.startedAt, '2026-06-30T18:00:00.000Z');
  });

  it('includes ALL participants (not just the guest) so group results can be broken down', () => {
    const params = buildGuestSessionParams(draft, 'guest-1');
    assert.equal(params.participants.length, 3);
    assert.deepEqual(params.participants, participants);
  });

  it('includes the current guest\'s own participant among the results', () => {
    const params = buildGuestSessionParams(draft, 'guest-1');
    const own = params.participants.find((p) => p.userId === 'guest-1');
    assert.ok(own, 'own participant must be present in the built session');
    assert.deepEqual(own.counts, { 'nigiri-salmon': 3 });
  });

  it('is scoped to the guest as ownerUid and mode group', () => {
    const params = buildGuestSessionParams(draft, 'guest-1');
    assert.equal(params.ownerUid, 'guest-1');
    assert.equal(params.mode, 'group');
  });

  it('carries the group code through when present', () => {
    const params = buildGuestSessionParams(draft, 'guest-1');
    assert.equal(params.groupCode, 'ABCD');
  });

  it('omits groupCode entirely when the draft has none', () => {
    const params = buildGuestSessionParams({ ...draft, groupCode: null }, 'guest-1');
    assert.equal('groupCode' in params, false);
  });
});

describe('buildGuestSessionParams missing-context fallback (lobby/legacy draft)', () => {
  const participants = [{ userId: 'guest-1', displayName: 'Guest One', counts: {} }];
  const draft = { participants, groupContext: null, groupCode: null };

  it('falls back to the unknown-restaurant placeholders', () => {
    const params = buildGuestSessionParams(draft, 'guest-1');
    assert.equal(params.restaurantId, 'unknown');
    assert.equal(params.restaurantName, 'Unknown Restaurant');
  });

  it('falls back to the global menu id/version', () => {
    const params = buildGuestSessionParams(draft, 'guest-1');
    assert.equal(params.menuId, 'global-default');
    assert.equal(params.menuVersion, 3);
  });

  it('falls back to the null-island location rather than leaving it undefined', () => {
    const params = buildGuestSessionParams(draft, 'guest-1');
    assert.deepEqual(params.location, { latitude: 0, longitude: 0 });
  });

  it('omits startedAt from params (letting submitSession default it) rather than crashing', () => {
    const params = buildGuestSessionParams(draft, 'guest-1');
    assert.equal('startedAt' in params, false);
  });

  it('omits groupCode from params when the draft has none', () => {
    const params = buildGuestSessionParams(draft, 'guest-1');
    assert.equal('groupCode' in params, false);
  });

  it('still carries participants through with no crash on an all-undefined context', () => {
    const params = buildGuestSessionParams(draft, 'guest-1');
    assert.equal(params.participants.length, 1);
    assert.equal(params.participants[0].userId, 'guest-1');
  });

  it('falls back per-field, not all-or-nothing, when only some context fields are set', () => {
    const partialDraft = {
      participants,
      groupContext: { restaurantId: 'rest-9' }, // no name/menu/location/startedAt
      groupCode: null,
    };
    const params = buildGuestSessionParams(partialDraft, 'guest-1');
    assert.equal(params.restaurantId, 'rest-9');
    assert.equal(params.restaurantName, 'Unknown Restaurant');
    assert.equal(params.menuId, 'global-default');
    assert.equal(params.menuVersion, 3);
    assert.deepEqual(params.location, { latitude: 0, longitude: 0 });
  });
});

describe('resolveStartedAt (submitSession/submitLocalSession startedAt defaulting)', () => {
  it('uses the shared startedAt when the draft context provided one', () => {
    const params = { startedAt: '2026-06-30T18:00:00.000Z' };
    assert.equal(resolveStartedAt(params, '2026-07-01T00:00:00.000Z'), '2026-06-30T18:00:00.000Z');
  });

  it('defaults to "now" when startedAt is absent (missing-context fallback path)', () => {
    const now = '2026-07-01T00:00:00.000Z';
    const params = {};
    assert.equal(resolveStartedAt(params, now), now);
  });

  it('produces a non-empty ISO-ish default in practice (no crash, no undefined field)', () => {
    const params = {};
    const startedAt = resolveStartedAt(params);
    assert.equal(typeof startedAt, 'string');
    assert.ok(startedAt.length > 0);
  });

  it('treats an explicit undefined startedAt the same as absent (nullish coalescing)', () => {
    const now = '2026-07-01T00:00:00.000Z';
    assert.equal(resolveStartedAt({ startedAt: undefined }, now), now);
  });
});

describe('host vs. guest divergence at party end', () => {
  it('the host never satisfies the guest end-nav predicate, regardless of phase', () => {
    for (const groupPhase of ['lobby', 'active', 'ended']) {
      assert.equal(
        shouldGuestEnterResults({ groupPhase, isHost: true, alreadyEnded: false }),
        false,
      );
    }
  });

  it('only a non-host sees the predicate flip true, and only once phase is ended', () => {
    assert.equal(shouldGuestEnterResults({ groupPhase: 'ended', isHost: false, alreadyEnded: false }), true);
    assert.equal(shouldGuestEnterResults({ groupPhase: 'active', isHost: false, alreadyEnded: false }), false);
  });
});
