/**
 * Tests for the finishOnce double-fire guard pattern used in PartySplash.
 *
 * PartySplash (src/components/PartySplash.tsx) uses a useRef(false) guard
 * so that both the auto-timer path and the tap-to-skip path can call
 * finishOnce(), but onFinish() only fires exactly once regardless of order
 * or overlap. This file tests that invariant in pure JS without requiring
 * React Native or Reanimated setup.
 *
 * Run with: node --test src/__tests__/finishOnce.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors the finishOnce factory from PartySplash exactly:
 *   const finishedRef = useRef(false);
 *   const finishOnce = useCallback((reason) => {
 *     if (finishedRef.current) return;
 *     finishedRef.current = true;
 *     onFinish();
 *   }, [onFinish]);
 */
function makeFinishOnce(onFinish) {
  const finishedRef = { current: false };
  return function finishOnce(reason) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(reason);
  };
}

describe('finishOnce guard', () => {
  it('calls onFinish exactly once when invoked twice in sequence', () => {
    let callCount = 0;
    const finishOnce = makeFinishOnce(() => { callCount++; });

    finishOnce('timer');
    finishOnce('tap');

    assert.equal(callCount, 1, 'onFinish must fire exactly once');
  });

  it('calls onFinish exactly once when tap fires before timer', () => {
    let callCount = 0;
    const finishOnce = makeFinishOnce(() => { callCount++; });

    finishOnce('tap');
    finishOnce('timer');

    assert.equal(callCount, 1, 'onFinish must fire exactly once regardless of which fires first');
  });

  it('calls onFinish exactly once even when invoked many times', () => {
    let callCount = 0;
    const finishOnce = makeFinishOnce(() => { callCount++; });

    for (let i = 0; i < 10; i++) {
      finishOnce('tap');
    }

    assert.equal(callCount, 1, 'guard must hold across repeated calls');
  });

  it('forwards the reason string to onFinish on first call', () => {
    let capturedReason = null;
    const finishOnce = makeFinishOnce((reason) => { capturedReason = reason; });

    finishOnce('timer');
    finishOnce('tap'); // should be ignored

    assert.equal(capturedReason, 'timer', 'onFinish receives the reason from the first caller');
  });

  it('does not fire onFinish when never called', () => {
    let callCount = 0;
    makeFinishOnce(() => { callCount++; });
    // finishOnce never invoked
    assert.equal(callCount, 0, 'onFinish must not fire if finishOnce is never called');
  });

  it('fires onFinish exactly once on single invocation', () => {
    let callCount = 0;
    const finishOnce = makeFinishOnce(() => { callCount++; });

    finishOnce('tap');

    assert.equal(callCount, 1, 'single invocation must fire onFinish once');
  });
});
