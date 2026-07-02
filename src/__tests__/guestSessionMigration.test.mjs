import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mirrors migrateGuestSessions in src/lib/local/sessions.ts — re-keys a guest's
// locally-stored parties onto their new account uid when they sign up, so the
// party they just played isn't orphaned.

function migrate(sessions, oldUid, newUid) {
  if (!oldUid || !newUid || oldUid === newUid) return { sessions, changed: 0 };
  let changed = 0;
  const next = sessions.map((session) => {
    let touched = false;
    const participants = session.participants.map((p) => {
      if (p.userId === oldUid) {
        touched = true;
        return { ...p, userId: newUid };
      }
      return p;
    });
    if (touched) changed += 1;
    return touched ? { ...session, participants } : session;
  });
  return { sessions: next, changed };
}

const session = (id, userIds) => ({
  id,
  participants: userIds.map((userId) => ({ userId, counts: {} })),
});

describe('migrateGuestSessions', () => {
  it('re-keys the guest uid to the new account uid across sessions', () => {
    const before = [session('s1', ['guest-1']), session('s2', ['guest-1', 'friend-akira'])];
    const { sessions, changed } = migrate(before, 'guest-1', 'user-9');
    assert.equal(changed, 2);
    assert.equal(sessions[0].participants[0].userId, 'user-9');
    assert.deepEqual(
      sessions[1].participants.map((p) => p.userId),
      ['user-9', 'friend-akira'], // other participants untouched
    );
  });

  it('is a no-op when the uid is unchanged (email path preserves uid)', () => {
    const before = [session('s1', ['same-uid'])];
    const { sessions, changed } = migrate(before, 'same-uid', 'same-uid');
    assert.equal(changed, 0);
    assert.equal(sessions[0].participants[0].userId, 'same-uid');
  });

  it('does nothing when the guest never appears as a participant', () => {
    const before = [session('s1', ['someone-else'])];
    const { changed } = migrate(before, 'guest-1', 'user-9');
    assert.equal(changed, 0);
  });

  it('ignores empty uids', () => {
    const before = [session('s1', ['guest-1'])];
    assert.equal(migrate(before, '', 'user-9').changed, 0);
    assert.equal(migrate(before, 'guest-1', '').changed, 0);
  });
});
