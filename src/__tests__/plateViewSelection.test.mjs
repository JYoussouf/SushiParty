import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mirrors src/contexts/SessionContext.tsx (group-party plate-viewing selection, issue #30).
//
// Selection is tracked by `viewedUserId` (not a raw index) so it survives realtime
// draft updates that mutate/reorder participants. `activeParticipantIndex` is DERIVED
// every render from `viewedUserId` + `participants` + the current user's uid:
//   - if viewedUserId resolves to a present participant -> that participant's index
//   - else fall back to the current user's own index
//   - else 0 (never out of bounds, never -1)

function deriveActiveIndex(viewedUserId, participants, currentUid) {
  const currentUserParticipantIndex = participants.findIndex(
    (participant) => participant.userId === currentUid,
  );

  const viewedParticipantIndex = viewedUserId
    ? participants.findIndex((participant) => participant.userId === viewedUserId)
    : -1;

  return viewedParticipantIndex >= 0
    ? viewedParticipantIndex
    : currentUserParticipantIndex >= 0
      ? currentUserParticipantIndex
      : 0;
}

// Mirrors setActiveParticipantIndex: public API stays index-based, internally
// remembers the participant's userId so realtime updates keep the same plate in view.
function setActiveParticipantIndex(index, participants) {
  return participants[index]?.userId ?? null;
}

function participant(userId, counts = {}) {
  return { userId, counts };
}

describe('deriveActiveIndex (issue #30 - plate view selection)', () => {
  it('viewedUserId null falls back to the current user own index', () => {
    const participants = [participant('alice'), participant('me'), participant('bob')];
    assert.equal(deriveActiveIndex(null, participants, 'me'), 1);
  });

  it('viewedUserId null and current user not present falls back to index 0', () => {
    const participants = [participant('alice'), participant('bob')];
    assert.equal(deriveActiveIndex(null, participants, 'me'), 0);
  });

  it('viewedUserId null and participants empty falls back to index 0', () => {
    assert.equal(deriveActiveIndex(null, [], 'me'), 0);
  });

  it('viewedUserId pointing at another present participant resolves to their index', () => {
    const participants = [participant('me'), participant('alice'), participant('bob')];
    assert.equal(deriveActiveIndex('bob', participants, 'me'), 2);
  });

  it('viewedUserId pointing at a participant who left falls back to the current user, not out of bounds', () => {
    const participants = [participant('me'), participant('alice')];
    // 'bob' viewed previously but is no longer in the list.
    const index = deriveActiveIndex('bob', participants, 'me');
    assert.equal(index, 0);
    assert.notEqual(index, -1);
    assert.ok(index < participants.length);
  });

  it('viewedUserId pointing at a departed participant falls back to index 0 when current user also absent', () => {
    const participants = [participant('alice'), participant('carol')];
    const index = deriveActiveIndex('bob', participants, 'me');
    assert.equal(index, 0);
  });

  it('follows the viewed participant to their new index after participants are reordered', () => {
    const before = [participant('me'), participant('alice'), participant('bob')];
    const after = [participant('bob'), participant('me'), participant('alice')];
    assert.equal(deriveActiveIndex('bob', before, 'me'), 2);
    assert.equal(deriveActiveIndex('bob', after, 'me'), 0);
  });
});

describe('#30 regression: counts-only draft updates preserve the viewed plate', () => {
  it('does not reset the viewed index when a realtime update changes counts but keeps membership', () => {
    const participantsBefore = [
      participant('me', { nigiri: 2 }),
      participant('alice', { nigiri: 0 }),
      participant('bob', { nigiri: 5 }),
    ];

    // I am viewing bob's plate.
    const viewedUserId = 'bob';
    const indexBefore = deriveActiveIndex(viewedUserId, participantsBefore, 'me');
    assert.equal(indexBefore, 2);

    // Realtime draft push: only counts changed (e.g. someone else added pieces to
    // alice's plate); membership and order are unchanged. syncFromDraft mutates
    // participant DATA only and must NOT touch viewedUserId.
    const participantsAfter = [
      participant('me', { nigiri: 2 }),
      participant('alice', { nigiri: 3 }), // count changed
      participant('bob', { nigiri: 5 }),
    ];

    const indexAfter = deriveActiveIndex(viewedUserId, participantsAfter, 'me');

    // The #30 property: still viewing bob, at the same index, despite the update.
    assert.equal(indexAfter, indexBefore);
    assert.equal(indexAfter, 2);

    // OLD buggy behavior (pre-fix) tracked the viewed plate by raw index and reset
    // it to the current user's own plate on every draft sync, e.g. resetting
    // activeParticipantIndex back to currentUserParticipantIndex (0 here) even
    // though the viewer never navigated away from bob's plate. The userId-based
    // derivation above must NOT reproduce that: indexAfter must stay 2, not become 0.
    const currentUserIndexAfter = participantsAfter.findIndex((p) => p.userId === 'me');
    assert.notEqual(indexAfter, currentUserIndexAfter);
  });

  it('preserves the viewed plate across multiple sequential counts-only updates', () => {
    const viewedUserId = 'alice';
    let participants = [participant('me'), participant('alice'), participant('bob')];
    const indexAtStart = deriveActiveIndex(viewedUserId, participants, 'me');

    for (let delta = 1; delta <= 3; delta += 1) {
      participants = participants.map((p) =>
        p.userId === 'bob' ? { ...p, counts: { nigiri: delta } } : p,
      );
      assert.equal(deriveActiveIndex(viewedUserId, participants, 'me'), indexAtStart);
    }
  });
});

describe('setActiveParticipantIndex mapping', () => {
  const participants = [participant('me'), participant('alice'), participant('bob')];

  it('maps a valid index to that participant userId', () => {
    assert.equal(setActiveParticipantIndex(2, participants), 'bob');
    assert.equal(setActiveParticipantIndex(0, participants), 'me');
  });

  it('maps an out-of-range index to null (falls back to own plate)', () => {
    assert.equal(setActiveParticipantIndex(99, participants), null);
    assert.equal(setActiveParticipantIndex(-1, participants), null);
  });

  it('maps any index against an empty participants list to null', () => {
    assert.equal(setActiveParticipantIndex(0, []), null);
  });

  it('round-trips: setting then deriving returns to the same index', () => {
    const nextViewedUserId = setActiveParticipantIndex(2, participants);
    assert.equal(deriveActiveIndex(nextViewedUserId, participants, 'me'), 2);
  });
});

describe('edge cases', () => {
  it('empty participants array always resolves to index 0 regardless of viewedUserId', () => {
    assert.equal(deriveActiveIndex(null, [], 'me'), 0);
    assert.equal(deriveActiveIndex('someone', [], 'me'), 0);
  });

  it('empty participants array resolves setActiveParticipantIndex to null safely', () => {
    assert.equal(setActiveParticipantIndex(0, []), null);
  });
});
