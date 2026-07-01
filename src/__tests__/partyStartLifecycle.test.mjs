/**
 * Tests for the group-party START lifecycle (issue #28).
 *
 * Covers three pure decision points mirrored exactly from the current code:
 *
 * 1. Owner-guard for POST /start and /end (api/src/index.ts ~1243-1264):
 *      if (draft.ownerUid !== body.ownerUid) return 403;
 *
 * 2. Legacy phase default (api/src/index.ts ~1350, src/contexts/SessionContext.tsx:114):
 *      draft.phase ?? 'lobby'
 *
 * 3. Guest auto-navigation effect (app/session/lobby.tsx:209-214):
 *      useEffect(() => {
 *        if (!groupSessionId || isHost) return;
 *        if (groupPhase === 'active') enterParty();
 *      }, [enterParty, groupPhase, groupSessionId, isHost]);
 *    combined with the enterParty() double-fire guard (lobby.tsx:182-189):
 *      const enteredPartyRef = useRef(false);
 *      const enterParty = () => {
 *        if (enteredPartyRef.current) return;
 *        enteredPartyRef.current = true;
 *        router.replace('/session/party-intro');
 *      };
 *
 * Run with: node --test src/__tests__/partyStartLifecycle.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors the owner-guard check shared by the /start and /end DO routes:
 *   if (draft.ownerUid !== body.ownerUid) return 403;
 * Returns true when the requester is allowed to flip the phase.
 */
function canChangePhase(draft, requesterUid) {
  return draft.ownerUid === requesterUid;
}

/**
 * Mirrors the legacy-default normalization applied both server-side
 * (api/src/index.ts requireDraft: `draft.phase ?? 'lobby'`) and client-side
 * (SessionContext.tsx: `setGroupPhase(draft.phase ?? 'lobby')`).
 */
function phaseOf(draft) {
  return draft.phase ?? 'lobby';
}

/**
 * Mirrors the guest-navigation effect predicate from lobby.tsx:
 *   if (!groupSessionId || isHost) return;
 *   if (groupPhase === 'active') enterParty();
 *
 * inLobby stands in for `!!groupSessionId` (guests only run this effect while
 * still parked on the lobby screen with a live groupSessionId).
 */
function shouldGuestEnterParty({ groupPhase, isOwner, inLobby, alreadyEntered }) {
  if (!inLobby || isOwner) return false;
  if (alreadyEntered) return false;
  return groupPhase === 'active';
}

/**
 * Mirrors the enteredPartyRef double-fire guard around enterParty().
 */
function makeEnterPartyGuard(onEnter) {
  const enteredRef = { current: false };
  return function enterParty() {
    if (enteredRef.current) return;
    enteredRef.current = true;
    onEnter();
  };
}

describe('canChangePhase (owner-guard for /start and /end)', () => {
  const draft = { ownerUid: 'owner-123', phase: 'lobby' };

  it('allows the owner to change phase', () => {
    assert.equal(canChangePhase(draft, 'owner-123'), true);
  });

  it('rejects a non-owner participant', () => {
    assert.equal(canChangePhase(draft, 'guest-456'), false);
  });

  it('rejects a missing/undefined requester uid', () => {
    assert.equal(canChangePhase(draft, undefined), false);
  });

  it('rejects an empty-string requester uid', () => {
    assert.equal(canChangePhase(draft, ''), false);
  });

  it('rejects a uid that merely prefixes the owner uid', () => {
    assert.equal(canChangePhase(draft, 'owner-1234'), false);
  });
});

describe('phaseOf (legacy phase default)', () => {
  it('defaults an undefined phase (legacy draft) to lobby', () => {
    assert.equal(phaseOf({ ownerUid: 'x' }), 'lobby');
  });

  it('defaults an explicit undefined phase to lobby', () => {
    assert.equal(phaseOf({ ownerUid: 'x', phase: undefined }), 'lobby');
  });

  it('passes through an explicit lobby phase', () => {
    assert.equal(phaseOf({ ownerUid: 'x', phase: 'lobby' }), 'lobby');
  });

  it('passes through an explicit active phase', () => {
    assert.equal(phaseOf({ ownerUid: 'x', phase: 'active' }), 'active');
  });

  it('passes through an explicit ended phase', () => {
    assert.equal(phaseOf({ ownerUid: 'x', phase: 'ended' }), 'ended');
  });

  it('defaults a null phase to lobby (nullish coalescing treats null as absent too)', () => {
    assert.equal(phaseOf({ ownerUid: 'x', phase: null }), 'lobby');
  });
});

describe('shouldGuestEnterParty (guest auto-navigation truth table)', () => {
  const base = { groupPhase: 'active', isOwner: false, inLobby: true, alreadyEntered: false };

  it('navigates on the single true case: active phase, guest, in lobby, not yet entered', () => {
    assert.equal(shouldGuestEnterParty(base), true);
  });

  it('does not navigate when phase is lobby', () => {
    assert.equal(shouldGuestEnterParty({ ...base, groupPhase: 'lobby' }), false);
  });

  it('does not navigate when phase is ended', () => {
    assert.equal(shouldGuestEnterParty({ ...base, groupPhase: 'ended' }), false);
  });

  it('does not auto-navigate the owner/host even when phase is active', () => {
    assert.equal(shouldGuestEnterParty({ ...base, isOwner: true }), false);
  });

  it('does not navigate when the owner is also not in the lobby (belt and suspenders)', () => {
    assert.equal(shouldGuestEnterParty({ ...base, isOwner: true, inLobby: false }), false);
  });

  it('does not navigate when there is no live groupSessionId (not in lobby)', () => {
    assert.equal(shouldGuestEnterParty({ ...base, inLobby: false }), false);
  });

  it('does not re-navigate once the double-nav guard has already fired', () => {
    assert.equal(shouldGuestEnterParty({ ...base, alreadyEntered: true }), false);
  });

  it('does not navigate when neither active nor in lobby nor first entry', () => {
    assert.equal(
      shouldGuestEnterParty({ groupPhase: 'lobby', isOwner: false, inLobby: false, alreadyEntered: true }),
      false
    );
  });

  it('does not navigate for the owner in the lobby phase', () => {
    assert.equal(
      shouldGuestEnterParty({ groupPhase: 'lobby', isOwner: true, inLobby: true, alreadyEntered: false }),
      false
    );
  });
});

describe('solo / non-group safety (no groupSessionId)', () => {
  it('never navigates when inLobby is false, regardless of phase', () => {
    for (const groupPhase of ['lobby', 'active', 'ended']) {
      assert.equal(
        shouldGuestEnterParty({ groupPhase, isOwner: false, inLobby: false, alreadyEntered: false }),
        false,
        `phase=${groupPhase} must not navigate without a live groupSessionId`
      );
    }
  });

  it('never navigates for a solo (owner-only) session with no groupSessionId', () => {
    assert.equal(
      shouldGuestEnterParty({ groupPhase: 'active', isOwner: true, inLobby: false, alreadyEntered: false }),
      false
    );
  });
});

describe('enterParty double-nav guard (mirrors enteredPartyRef)', () => {
  it('calls onEnter exactly once when the guest effect fires twice for the same active phase flip', () => {
    let navigations = 0;
    const enterParty = makeEnterPartyGuard(() => { navigations++; });

    // Simulate the effect re-running (e.g. groupPhase re-broadcast) while
    // already inside the party: the predicate re-evaluates each time using
    // an alreadyEntered flag that flips true after the first real fire.
    let alreadyEntered = false;
    const decision = { groupPhase: 'active', isOwner: false, inLobby: true, alreadyEntered };
    if (shouldGuestEnterParty(decision)) {
      enterParty();
      alreadyEntered = true;
    }
    if (shouldGuestEnterParty({ ...decision, alreadyEntered })) {
      enterParty();
    }

    assert.equal(navigations, 1, 'enterParty must fire exactly once across repeated effect runs');
  });

  it('calls onEnter exactly once even if enterParty is invoked directly many times', () => {
    let navigations = 0;
    const enterParty = makeEnterPartyGuard(() => { navigations++; });

    for (let i = 0; i < 5; i++) {
      enterParty();
    }

    assert.equal(navigations, 1, 'guard must hold across repeated direct calls');
  });

  it('does not call onEnter when the guest never actually qualifies to enter', () => {
    let navigations = 0;
    const enterParty = makeEnterPartyGuard(() => { navigations++; });

    const decision = { groupPhase: 'lobby', isOwner: false, inLobby: true, alreadyEntered: false };
    if (shouldGuestEnterParty(decision)) {
      enterParty();
    }

    assert.equal(navigations, 0, 'onEnter must not fire while phase is still lobby');
  });
});
