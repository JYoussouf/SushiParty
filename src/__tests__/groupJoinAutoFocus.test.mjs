/**
 * Tests for the auto-focus decision logic in app/session/group-join.tsx.
 *
 * On mount, the screen auto-focuses the code TextInput UNLESS:
 *   - deepLinkedCode is a non-empty string (auto-join in progress, will navigate away), OR
 *   - scanning is true (QR scanner is active, keyboard would conflict)
 *
 * Source guard (mirrors the useEffect in group-join.tsx):
 *   if (deepLinkedCode || scanning) return;   // skip focus
 *   const timer = setTimeout(() => inputRef.current?.focus(), 400);
 *   return () => clearTimeout(timer);
 *
 * This file tests the pure decision and the cleanup invariant without
 * requiring React Native or Expo.
 *
 * Run with: node --test src/__tests__/groupJoinAutoFocus.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors the guard condition from the useEffect exactly:
 *   if (deepLinkedCode || scanning) return;
 *
 * @param {string} deepLinkedCode - empty string means no deep link
 * @param {boolean} scanning      - true when QR scanner is open
 * @returns {boolean}
 */
function shouldAutoFocus(deepLinkedCode, scanning) {
  if (deepLinkedCode || scanning) return false;
  return true;
}

/**
 * Tiny synchronous timer abstraction that mirrors the mount effect's
 * setTimeout / clearTimeout pattern, letting us assert that cleanup
 * cancels a pending focus without real async delay.
 *
 * Returns { schedule, cleanup, focusCalled }.
 */
function makeFocusTimer() {
  let pending = false;
  let focusCalled = false;

  function schedule() {
    pending = true;
    // Simulate the deferred focus firing (synchronously for test purposes)
    return {
      fire() {
        if (pending) focusCalled = true;
      },
    };
  }

  function cleanup(timer) {
    // mirrors clearTimeout — cancels before the callback fires
    pending = false;
  }

  return { schedule, cleanup, getFocusCalled: () => focusCalled };
}

// ---------------------------------------------------------------------------
// Core decision logic
// ---------------------------------------------------------------------------

describe('shouldAutoFocus', () => {
  it('focuses when deepLinkedCode is empty and not scanning', () => {
    assert.equal(shouldAutoFocus('', false), true);
  });

  it('skips focus when deepLinkedCode is a non-empty string', () => {
    assert.equal(shouldAutoFocus('ABC123', false), false);
  });

  it('skips focus when scanning is active, even with no deep link', () => {
    assert.equal(shouldAutoFocus('', true), false);
  });

  it('skips focus when both deepLinkedCode is set and scanning is active', () => {
    assert.equal(shouldAutoFocus('ABC123', true), false);
  });

  // Truthiness contract: the source uses `if (deepLinkedCode || scanning)`,
  // so an empty string must be falsy (treated as "no deep link present").
  it('treats empty string as falsy — no deep link, so focus proceeds', () => {
    assert.equal(shouldAutoFocus('', false), true,
      'empty string deepLinkedCode must be treated as absent');
  });

  it('treats any non-empty code string as truthy — focus is suppressed', () => {
    for (const code of ['A', '123', 'XYZABC', ' ']) {
      assert.equal(shouldAutoFocus(code, false), false,
        `non-empty deepLinkedCode "${code}" must suppress focus`);
    }
  });
});

// ---------------------------------------------------------------------------
// Cleanup cancels pending focus (mirrors clearTimeout in the effect cleanup)
// ---------------------------------------------------------------------------

describe('mount effect cleanup cancels pending focus', () => {
  it('focus fires when cleanup is not called before the timer', () => {
    const { schedule, getFocusCalled } = makeFocusTimer();
    const timer = schedule();
    timer.fire(); // simulate setTimeout callback firing normally
    assert.equal(getFocusCalled(), true, 'focus should fire when no cleanup');
  });

  it('focus does not fire when cleanup is called before the timer fires', () => {
    const { schedule, cleanup, getFocusCalled } = makeFocusTimer();
    const timer = schedule();
    cleanup(timer);   // mirrors clearTimeout — component unmounted before 400 ms
    timer.fire();     // simulate the callback attempting to fire after clearTimeout
    assert.equal(getFocusCalled(), false,
      'cleanup must prevent focus from firing (mirrors clearTimeout)');
  });
});
