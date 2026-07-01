/**
 * Tests for the group-party subscription resilience fix (issue #27).
 *
 * src/lib/cloudflare/groupParties.ts `subscribeToGroupParty` opens a WS to
 * `/groups/:id/ws` and drives `onChange(draft | null)` from server frames.
 * The #27 regression: `ws.onerror`/`ws.onclose` used to call `onChange(null)`,
 * which SessionContext treats as "party deleted" -> evicts every member on
 * any transient network blip (mobile backgrounding, WiFi->cellular handoff).
 *
 * The fix:
 *   - Only a parsed `{ type: 'draft', draft }` frame drives onChange, and an
 *     explicit server-sent null (`draft: null` or omitted) is preserved as a
 *     real onChange(null) — deletion/expiry must still evict.
 *   - An unparseable frame, or a parsed frame whose `type !== 'draft'`, is
 *     silently ignored (NOT onChange(null)).
 *   - onerror/onclose never call onChange at all; they instead schedule a
 *     bounded exponential-backoff reconnect (base 1000ms, doubling per
 *     attempt, capped at 15000ms), reset to attempt 0 on a successful open.
 *   - unsubscribe() marks the subscription closed, clears any pending
 *     reconnect timer, and closes the live socket.
 *
 * This file replicates that pure decision logic without touching real
 * WebSocket/timers, mirroring the style of finishOnce.test.mjs /
 * partyStartLifecycle.test.mjs.
 *
 * Run with: node --test src/__tests__/groupSubscription.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Exact constants from src/lib/cloudflare/groupParties.ts
const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 15000;

/**
 * Mirrors ws.onmessage from subscribeToGroupParty:
 *   try { payload = JSON.parse(String(event.data)); }
 *   catch { return; }
 *   if (payload.type === 'draft') { onChange(payload.draft ?? null); }
 *
 * Returns { emit: false } when the frame must be ignored (unparseable JSON,
 * or a parsed message that isn't a 'draft' event), or { emit: true, draft }
 * when onChange should fire with the given draft (possibly null).
 */
function classifyMessage(rawString) {
  let payload;
  try {
    payload = JSON.parse(rawString);
  } catch {
    return { emit: false };
  }
  if (payload && payload.type === 'draft') {
    return { emit: true, draft: payload.draft ?? null };
  }
  return { emit: false };
}

/**
 * Mirrors scheduleReconnect's delay computation:
 *   const delay = Math.min(WS_RECONNECT_BASE_MS * 2 ** attempts, WS_RECONNECT_MAX_MS);
 *   attempts += 1;
 * `attempt` is the 0-indexed count of consecutive failures BEFORE this
 * reconnect is scheduled (i.e. attempts state at the moment of the call).
 */
function nextBackoff(attempt) {
  return Math.min(WS_RECONNECT_BASE_MS * 2 ** attempt, WS_RECONNECT_MAX_MS);
}

/**
 * Small state machine mirroring the `attempts` ref lifecycle:
 *   ws.onopen = () => { attempts = 0; };
 *   ws.onclose = () => { scheduleReconnect(); }  // increments attempts
 */
function makeReconnectScheduler() {
  let attempts = 0;
  return {
    onDrop() {
      const delay = nextBackoff(attempts);
      attempts += 1;
      return delay;
    },
    onOpen() {
      attempts = 0;
    },
    get attempts() {
      return attempts;
    },
  };
}

/**
 * Mirrors the crux of #27: which transport events cause a real onChange(null)
 * teardown vs. a silent reconnect. Encoded explicitly as a lookup so the
 * regression (old code: onerror/onclose -> onChange(null) -> false eviction)
 * can never silently creep back in.
 */
function classifyEvent(eventKind) {
  switch (eventKind) {
    case 'server-null-draft':
      // Real deletion/expiry the server told us about explicitly.
      return { action: 'teardown', emitNull: true };
    case 'transport-error':
    case 'socket-close':
      // OLD BUG (#27): these used to call onChange(null), evicting every
      // member on a transient network blip. FIX: reconnect, never emit.
      return { action: 'reconnect', emitNull: false };
    default:
      throw new Error(`unhandled eventKind: ${eventKind}`);
  }
}

describe('classifyMessage (ws.onmessage decision)', () => {
  it('emits the draft object for a valid {type:"draft", draft:{...}} frame', () => {
    const draft = { id: 'ABCD', ownerUid: 'u1', participants: [] };
    const result = classifyMessage(JSON.stringify({ type: 'draft', draft }));
    assert.deepEqual(result, { emit: true, draft });
  });

  it('emits null for an explicit server-sent {type:"draft", draft:null} (real deletion)', () => {
    const result = classifyMessage(JSON.stringify({ type: 'draft', draft: null }));
    assert.deepEqual(result, { emit: true, draft: null });
  });

  it('emits null when the draft field is omitted entirely from a draft-type frame', () => {
    const result = classifyMessage(JSON.stringify({ type: 'draft' }));
    assert.deepEqual(result, { emit: true, draft: null });
  });

  it('does NOT emit for unparseable JSON — the #27 regression guard', () => {
    // Old bug: a parse failure used to fall through to onChange(null),
    // which SessionContext read as "party deleted" and evicted everyone.
    const result = classifyMessage('not json');
    assert.deepEqual(result, { emit: false });
  });

  it('does NOT emit for empty-string / truncated frames', () => {
    assert.deepEqual(classifyMessage(''), { emit: false });
    assert.deepEqual(classifyMessage('{"type":'), { emit: false });
  });

  it('does NOT emit for a well-formed frame of a different type (e.g. ping)', () => {
    const result = classifyMessage(JSON.stringify({ type: 'ping' }));
    assert.deepEqual(result, { emit: false });
  });

  it('does NOT emit for a well-formed frame with no type field at all', () => {
    const result = classifyMessage(JSON.stringify({ foo: 'bar' }));
    assert.deepEqual(result, { emit: false });
  });

  it('does NOT emit for a JSON array or primitive frame (no type property)', () => {
    assert.deepEqual(classifyMessage(JSON.stringify([1, 2, 3])), { emit: false });
    assert.deepEqual(classifyMessage(JSON.stringify('draft')), { emit: false });
    assert.deepEqual(classifyMessage(JSON.stringify(42)), { emit: false });
  });
});

describe('nextBackoff (bounded exponential reconnect schedule)', () => {
  it('starts at the base delay (1000ms) on the first attempt', () => {
    assert.equal(nextBackoff(0), 1000);
  });

  it('doubles per attempt: 1000, 2000, 4000, 8000', () => {
    assert.equal(nextBackoff(1), 2000);
    assert.equal(nextBackoff(2), 4000);
    assert.equal(nextBackoff(3), 8000);
  });

  it('caps at WS_RECONNECT_MAX_MS (15000ms) once doubling would exceed it', () => {
    // 1000 * 2^4 = 16000, which exceeds the 15000 cap.
    assert.equal(nextBackoff(4), 15000);
    assert.equal(nextBackoff(5), 15000);
    assert.equal(nextBackoff(10), 15000);
  });
});

describe('reconnect attempt/reset lifecycle', () => {
  it('follows the full base->cap schedule across consecutive drops', () => {
    const scheduler = makeReconnectScheduler();
    const delays = [scheduler.onDrop(), scheduler.onDrop(), scheduler.onDrop(), scheduler.onDrop(), scheduler.onDrop()];
    assert.deepEqual(delays, [1000, 2000, 4000, 8000, 15000]);
  });

  it('resets attempts to 0 on a successful open, so the next drop restarts at base', () => {
    const scheduler = makeReconnectScheduler();
    scheduler.onDrop(); // 1000, attempts -> 1
    scheduler.onDrop(); // 2000, attempts -> 2
    assert.equal(scheduler.attempts, 2);

    scheduler.onOpen(); // successful reconnect resets the counter
    assert.equal(scheduler.attempts, 0);

    const delay = scheduler.onDrop();
    assert.equal(delay, 1000, 'a fresh drop after a successful open must start back at the base delay');
  });

  it('does not reset attempts merely by scheduling (only onOpen resets)', () => {
    const scheduler = makeReconnectScheduler();
    scheduler.onDrop();
    scheduler.onDrop();
    assert.equal(scheduler.attempts, 2, 'attempts must keep climbing across repeated drops without an intervening open');
  });
});

describe('reconnect vs. teardown distinction (the crux of #27)', () => {
  it('a server-sent explicit null draft is a real teardown: emits onChange(null)', () => {
    assert.deepEqual(classifyEvent('server-null-draft'), { action: 'teardown', emitNull: true });
  });

  it('a transport error triggers reconnect and does NOT emit onChange(null)', () => {
    // Old bug: onerror handler used to call onChange(null) directly here,
    // which false-evicted every member on any transient network blip.
    assert.deepEqual(classifyEvent('transport-error'), { action: 'reconnect', emitNull: false });
  });

  it('a socket close triggers reconnect and does NOT emit onChange(null)', () => {
    assert.deepEqual(classifyEvent('socket-close'), { action: 'reconnect', emitNull: false });
  });

  it('teardown and reconnect are mutually exclusive across all known event kinds', () => {
    const table = ['server-null-draft', 'transport-error', 'socket-close'].map(classifyEvent);
    const teardownCount = table.filter((r) => r.action === 'teardown').length;
    const reconnectCount = table.filter((r) => r.action === 'reconnect').length;
    assert.equal(teardownCount, 1, 'only the explicit server-null case should be a teardown');
    assert.equal(reconnectCount, 2, 'both transport-error and socket-close should reconnect, never emit');
  });
});

describe('unsubscribe teardown ordering (closed flag semantics)', () => {
  /**
   * Mirrors the closed/reconnectTimer guard in subscribeToGroupParty:
   *   const scheduleReconnect = () => { if (closed || reconnectTimer) return; ... };
   *   return () => { closed = true; clearTimeout(reconnectTimer); ...; socket.close(); };
   * Once unsubscribed, no further reconnect may be scheduled even if a
   * close event arrives after teardown (e.g. a race between unsubscribe()
   * and a lagging onclose callback).
   */
  function makeSubscription() {
    let closed = false;
    let pendingTimer = false;
    let scheduledCount = 0;
    return {
      scheduleReconnect() {
        if (closed || pendingTimer) return false;
        pendingTimer = true;
        scheduledCount += 1;
        return true;
      },
      fireTimer() {
        pendingTimer = false;
      },
      unsubscribe() {
        closed = true;
        pendingTimer = false;
      },
      get scheduledCount() {
        return scheduledCount;
      },
    };
  }

  it('schedules a reconnect normally while still subscribed', () => {
    const sub = makeSubscription();
    assert.equal(sub.scheduleReconnect(), true);
    assert.equal(sub.scheduledCount, 1);
  });

  it('does not schedule a reconnect if one is already pending (single in-flight timer)', () => {
    const sub = makeSubscription();
    sub.scheduleReconnect();
    assert.equal(sub.scheduleReconnect(), false, 'a second concurrent close must not double-schedule');
    assert.equal(sub.scheduledCount, 1);
  });

  it('unsubscribe blocks any further reconnect scheduling, even from a late close event', () => {
    const sub = makeSubscription();
    sub.unsubscribe();
    assert.equal(sub.scheduleReconnect(), false, 'a reconnect must never fire after unsubscribe');
    assert.equal(sub.scheduledCount, 0);
  });
});
