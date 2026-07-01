/**
 * Tests for the group-party END-VOTE lifecycle (issue #31).
 *
 * Covers the pure decision points mirrored exactly from the current code:
 *
 * 1. Owner-guard for POST /end-vote/start and /end-vote/cancel (api/src/index.ts ~1308-1377):
 *      if (draft.ownerUid !== body.ownerUid) return 403;
 *
 * 2. Start-vote construction (api/src/index.ts ~1308-1328):
 *      endVote: { active: true, startedBy: ownerUid, acceptedUserIds: [ownerUid], startedAt: now }
 *    The host is implicitly accepted (seeded into acceptedUserIds).
 *
 * 3. Accept dedupe (api/src/index.ts ~1341-1343):
 *      const acceptedUserIds = draft.endVote.acceptedUserIds.includes(body.userId)
 *        ? draft.endVote.acceptedUserIds
 *        : [...draft.endVote.acceptedUserIds, body.userId];
 *
 * 4. Unanimous coverage (api/src/index.ts ~1344-1346):
 *      const everyoneAccepted = draft.participants.every((participant) =>
 *        acceptedUserIds.includes(participant.userId),
 *      );
 *    Coverage is "every CURRENT participant is in acceptedUserIds" (not the reverse),
 *    which is what makes it leave-safe (a departed non-voter can't deadlock the vote)
 *    and join-safe (a brand-new joiner can't accidentally complete the vote).
 *
 * 5. Accept-with-no-active-vote idempotent no-op (api/src/index.ts ~1337-1339):
 *      if (!draft.endVote || !draft.endVote.active) return { draft }; // unchanged
 *
 * 6. Host one-shot end guard (app/session/scoreboard.tsx ~110-183): the same
 *    finishOnce/makeEndedNavGuard ref pattern, guarding hostSubmitRef so the
 *    unanimous-auto-end effect and the "End now" override can't both persist.
 *
 * 7. Override independence: POST /end (api/src/index.ts ~1295-1305) sets
 *    phase='ended' unconditionally once the owner-guard passes, regardless of
 *    any endVote state.
 *
 * Run with: node --test src/__tests__/endPartyVote.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors the owner-guard shared by /end-vote/start, /end-vote/cancel, and /end:
 *   if (draft.ownerUid !== body.ownerUid) return 403;
 */
function canManageVote(draft, requesterUid) {
  return draft.ownerUid === requesterUid;
}

/**
 * Mirrors POST /end-vote/start's endVote construction. The host is implicitly
 * accepted: acceptedUserIds seeds with [ownerUid].
 */
function startVote(ownerUid, now) {
  return {
    active: true,
    startedBy: ownerUid,
    acceptedUserIds: [ownerUid],
    startedAt: now,
  };
}

/**
 * Mirrors the dedupe logic in POST /end-vote/accept:
 *   acceptedUserIds.includes(userId) ? acceptedUserIds : [...acceptedUserIds, userId]
 */
function acceptVote(acceptedUserIds, userId) {
  return acceptedUserIds.includes(userId) ? acceptedUserIds : [...acceptedUserIds, userId];
}

/**
 * Mirrors the unanimity check in POST /end-vote/accept:
 *   participants.every((p) => acceptedUserIds.includes(p.userId))
 * The crux of issue #31: coverage runs over the CURRENT participant list, not
 * over acceptedUserIds, so it self-heals on both leaves and joins.
 */
function isUnanimous(participants, acceptedUserIds) {
  return participants.every((p) => acceptedUserIds.includes(p.userId));
}

/**
 * Mirrors the full POST /end-vote/accept handler decision (minus persistence),
 * including the no-active-vote no-op guard and the phase flip on unanimity.
 */
function decideAccept(draft, userId) {
  if (!draft.endVote || !draft.endVote.active) {
    return draft; // idempotent no-op, same object
  }
  const acceptedUserIds = acceptVote(draft.endVote.acceptedUserIds, userId);
  const everyoneAccepted = isUnanimous(draft.participants, acceptedUserIds);
  return everyoneAccepted
    ? { ...draft, phase: 'ended', endVote: { ...draft.endVote, active: false, acceptedUserIds } }
    : { ...draft, endVote: { ...draft.endVote, acceptedUserIds } };
}

/**
 * Mirrors POST /end-vote/cancel: strips endVote, leaves phase untouched.
 */
function cancelVote(draft) {
  const { endVote: _cancelled, ...rest } = draft;
  return rest;
}

/**
 * Mirrors POST /end: unconditional phase='ended' once the owner-guard passes,
 * regardless of any endVote state (host override).
 */
function overrideEnd(draft) {
  return { ...draft, phase: 'ended' };
}

/**
 * Mirrors the hostSubmitRef one-shot guard in scoreboard.tsx: both the
 * unanimous-auto-end effect (groupPhase flips to 'ended') and the "End now"
 * override (persistSession) can trip this, but onSubmit fires exactly once.
 * Same pattern as finishOnce / makeEndedNavGuard elsewhere in this repo.
 */
function makeHostSubmitGuard(onSubmit) {
  const submittedRef = { current: false };
  return function trySubmit(reason) {
    if (submittedRef.current) return false;
    submittedRef.current = true;
    onSubmit(reason);
    return true;
  };
}

function participant(userId) {
  return { userId, counts: {} };
}

describe('canManageVote (owner-guard for /end-vote/start and /end-vote/cancel)', () => {
  const draft = { ownerUid: 'owner-1' };

  it('allows the owner', () => {
    assert.equal(canManageVote(draft, 'owner-1'), true);
  });

  it('rejects a non-owner participant', () => {
    assert.equal(canManageVote(draft, 'guest-1'), false);
  });

  it('rejects undefined requesterUid', () => {
    assert.equal(canManageVote(draft, undefined), false);
  });

  it('rejects an empty string requesterUid', () => {
    assert.equal(canManageVote(draft, ''), false);
  });

  it('rejects a uid that is merely a prefix of the owner uid', () => {
    assert.equal(canManageVote({ ownerUid: 'owner-123' }, 'owner-1'), false);
  });

  it('rejects a uid that only differs by trailing whitespace', () => {
    assert.equal(canManageVote(draft, 'owner-1 '), false);
  });
});

describe('startVote (POST /end-vote/start construction)', () => {
  it('builds active endVote seeded with the host as already-accepted', () => {
    const now = '2026-07-01T00:00:00.000Z';
    const vote = startVote('owner-1', now);
    assert.deepEqual(vote, {
      active: true,
      startedBy: 'owner-1',
      acceptedUserIds: ['owner-1'],
      startedAt: now,
    });
  });

  it('host is implicitly accepted (no separate accept call needed)', () => {
    const vote = startVote('owner-1', 'now');
    assert.equal(vote.acceptedUserIds.includes('owner-1'), true);
    assert.equal(vote.acceptedUserIds.length, 1);
  });
});

describe('acceptVote (dedupe union)', () => {
  it('adds a new userId', () => {
    assert.deepEqual(acceptVote(['owner-1'], 'guest-1'), ['owner-1', 'guest-1']);
  });

  it('is idempotent when the userId already accepted', () => {
    const result = acceptVote(['owner-1', 'guest-1'], 'guest-1');
    assert.deepEqual(result, ['owner-1', 'guest-1']);
  });

  it('re-broadcast of the same accept never duplicates the id', () => {
    let ids = ['owner-1'];
    ids = acceptVote(ids, 'guest-1');
    ids = acceptVote(ids, 'guest-1'); // duplicate accept (e.g. retry)
    ids = acceptVote(ids, 'guest-1'); // another retry
    assert.deepEqual(ids, ['owner-1', 'guest-1']);
  });

  it('does not mutate the input array', () => {
    const original = ['owner-1'];
    acceptVote(original, 'guest-1');
    assert.deepEqual(original, ['owner-1']);
  });
});

describe('isUnanimous (coverage rule: every participant in acceptedUserIds)', () => {
  it('true when all current participants have accepted', () => {
    const participants = [participant('owner-1'), participant('guest-1')];
    assert.equal(isUnanimous(participants, ['owner-1', 'guest-1']), true);
  });

  it('false when one participant has not yet accepted', () => {
    const participants = [participant('owner-1'), participant('guest-1'), participant('guest-2')];
    assert.equal(isUnanimous(participants, ['owner-1', 'guest-1']), false);
  });

  it('leave-safe: a non-voter leaving removes the deadlock and completes the vote', () => {
    // guest-2 never accepted, blocking unanimity...
    const withStraggler = [participant('owner-1'), participant('guest-1'), participant('guest-2')];
    assert.equal(isUnanimous(withStraggler, ['owner-1', 'guest-1']), false);
    // ...but once guest-2 leaves the party, the remaining participants are all
    // accepted, so coverage completes without requiring guest-2's vote.
    const afterLeave = [participant('owner-1'), participant('guest-1')];
    assert.equal(isUnanimous(afterLeave, ['owner-1', 'guest-1']), true);
  });

  it('join-safe: a brand-new joiner (not yet in acceptedUserIds) blocks unanimity', () => {
    const beforeJoin = [participant('owner-1'), participant('guest-1')];
    assert.equal(isUnanimous(beforeJoin, ['owner-1', 'guest-1']), true);
    // A new participant joins mid-vote, not in acceptedUserIds -> can't falsely
    // complete the vote just because the pre-join set was unanimous.
    const afterJoin = [...beforeJoin, participant('guest-new')];
    assert.equal(isUnanimous(afterJoin, ['owner-1', 'guest-1']), false);
  });

  it('acceptedUserIds may contain ids for participants who already left (harmless superset)', () => {
    const participants = [participant('owner-1')];
    assert.equal(isUnanimous(participants, ['owner-1', 'ghost-departed-guest']), true);
  });

  it('empty-participants edge case: every() on [] is vacuously true', () => {
    // This documents actual Array.prototype.every semantics used by the source
    // (api/src/index.ts ~1344-1346): with zero participants, isUnanimous(([]), ids)
    // returns true regardless of acceptedUserIds. The handler only reaches this
    // check inside `if (!draft.endVote || !draft.endVote.active) return no-op`,
    // i.e. only when a vote is active. It does NOT separately guard against an
    // empty participants list. In practice a group draft can't reach phase
    // 'active'/an open vote with zero participants (the owner who started the
    // vote is always a participant), so this is not reachable in the live
    // handler, but the raw predicate itself does not special-case it.
    assert.equal(isUnanimous([], ['owner-1']), true);
  });
});

describe('decideAccept (full /end-vote/accept handler decision)', () => {
  it('flips phase to ended and closes the vote when the last participant accepts', () => {
    const draft = {
      phase: 'active',
      participants: [participant('owner-1'), participant('guest-1')],
      endVote: { active: true, startedBy: 'owner-1', acceptedUserIds: ['owner-1'], startedAt: 't0' },
    };
    const next = decideAccept(draft, 'guest-1');
    assert.equal(next.phase, 'ended');
    assert.equal(next.endVote.active, false);
    assert.deepEqual(next.endVote.acceptedUserIds, ['owner-1', 'guest-1']);
  });

  it('keeps phase and vote active when unanimity is not yet reached', () => {
    const draft = {
      phase: 'active',
      participants: [participant('owner-1'), participant('guest-1'), participant('guest-2')],
      endVote: { active: true, startedBy: 'owner-1', acceptedUserIds: ['owner-1'], startedAt: 't0' },
    };
    const next = decideAccept(draft, 'guest-1');
    assert.equal(next.phase, 'active');
    assert.equal(next.endVote.active, true);
    assert.deepEqual(next.endVote.acceptedUserIds, ['owner-1', 'guest-1']);
  });

  it('is an idempotent no-op (returns the same draft reference) when no vote is active', () => {
    const draft = { phase: 'active', participants: [participant('owner-1')], endVote: undefined };
    const next = decideAccept(draft, 'guest-1');
    assert.equal(next, draft, 'must return the exact same object, not a copy, for a late/duplicate accept');
  });

  it('is an idempotent no-op when endVote exists but is not active (already closed)', () => {
    const draft = {
      phase: 'ended',
      participants: [participant('owner-1'), participant('guest-1')],
      endVote: { active: false, startedBy: 'owner-1', acceptedUserIds: ['owner-1', 'guest-1'], startedAt: 't0' },
    };
    const next = decideAccept(draft, 'guest-1');
    assert.equal(next, draft, 'duplicate accept after the vote already closed must not mutate anything');
  });

  it('a repeated accept from the same user does not re-trigger a redundant ended write once already closed', () => {
    const draft = {
      phase: 'active',
      participants: [participant('owner-1')],
      endVote: { active: true, startedBy: 'owner-1', acceptedUserIds: ['owner-1'], startedAt: 't0' },
    };
    // Owner alone is already unanimous (single-participant party).
    const first = decideAccept(draft, 'owner-1');
    assert.equal(first.phase, 'ended');
    // A duplicate broadcast/retry of the same accept against the now-closed vote is a no-op.
    const second = decideAccept(first, 'owner-1');
    assert.equal(second, first);
  });
});

describe('cancelVote (POST /end-vote/cancel)', () => {
  it('removes endVote entirely without touching phase', () => {
    const draft = {
      phase: 'active',
      endVote: { active: true, startedBy: 'owner-1', acceptedUserIds: ['owner-1'], startedAt: 't0' },
      participants: [participant('owner-1')],
    };
    const next = cancelVote(draft);
    assert.equal('endVote' in next, false);
    assert.equal(next.phase, 'active');
  });
});

describe('overrideEnd (POST /end, host override independent of votes)', () => {
  it('sets phase to ended even with zero acceptances beyond the host', () => {
    const draft = {
      phase: 'active',
      participants: [participant('owner-1'), participant('guest-1'), participant('guest-2')],
      endVote: { active: true, startedBy: 'owner-1', acceptedUserIds: ['owner-1'], startedAt: 't0' },
    };
    const next = overrideEnd(draft);
    assert.equal(next.phase, 'ended');
  });

  it('sets phase to ended when there is no vote at all', () => {
    const draft = { phase: 'active', participants: [participant('owner-1')] };
    const next = overrideEnd(draft);
    assert.equal(next.phase, 'ended');
  });
});

describe('makeHostSubmitGuard (one-shot guard around hostSubmitRef in scoreboard.tsx)', () => {
  it('fires onSubmit exactly once when the unanimous auto-end effect fires first, then override taps', () => {
    let calls = 0;
    const trySubmit = makeHostSubmitGuard(() => { calls += 1; });

    assert.equal(trySubmit('auto-end'), true);
    assert.equal(trySubmit('override'), false);
    assert.equal(calls, 1);
  });

  it('fires onSubmit exactly once when the override taps first, then the auto-end effect fires', () => {
    let calls = 0;
    const trySubmit = makeHostSubmitGuard(() => { calls += 1; });

    assert.equal(trySubmit('override'), true);
    assert.equal(trySubmit('auto-end'), false);
    assert.equal(calls, 1);
  });

  it('holds across many repeated fires from re-renders/rebroadcasts', () => {
    let calls = 0;
    const trySubmit = makeHostSubmitGuard(() => { calls += 1; });
    for (let i = 0; i < 10; i++) trySubmit('auto-end');
    assert.equal(calls, 1);
  });
});
