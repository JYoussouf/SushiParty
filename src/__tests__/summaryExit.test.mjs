/**
 * Tests for the two decision branches in SessionSummaryScreen.
 *
 * 1. doneLabel(origin) — pure label logic:
 *      origin === 'history'  →  "Back to History"
 *      anything else         →  "Let's Go Home!"
 *
 * 2. makeExit() — re-entry guard machine:
 *      Mirrors the `leaving` useState + handleDone logic:
 *        if (leaving) return;          // guard
 *        setLeaving(true);
 *        if (origin === 'history') { router.back(); return; }
 *        router.replace('/(tabs)/home');
 *
 * No React Native, no jest, no Expo. Pure Node.
 * Run with: node --test src/__tests__/summaryExit.test.mjs
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Pure label function — mirrors the JSX ternary in summary.tsx:
//   {origin === 'history' ? 'Back to History' : "Let's Go Home!"}
// ---------------------------------------------------------------------------
function doneLabel(origin) {
  return origin === 'history' ? 'Back to History' : "Let's Go Home!";
}

// ---------------------------------------------------------------------------
// Exit machine — mirrors the handleDone function in summary.tsx.
//
// Factory accepts:
//   origin — the screen param (string | undefined)
//   nav    — { back: fn, replaceHome: fn } (injected; spy-able)
//
// Returns { exit } where exit() is the async callable (same contract as
// handleDone — can be fired multiple times; guard lives inside the closure).
// ---------------------------------------------------------------------------
function makeExit({ origin, nav }) {
  let leaving = false;

  async function exit() {
    if (leaving) return;
    leaving = true;

    if (origin === 'history') {
      nav.back();
      return;
    }

    nav.replaceHome();
  }

  return { exit };
}

// ---------------------------------------------------------------------------
// Tests: label logic
// ---------------------------------------------------------------------------
describe('doneLabel', () => {
  it("returns 'Back to History' when origin is 'history'", () => {
    assert.equal(doneLabel('history'), 'Back to History');
  });

  it("returns \"Let's Go Home!\" when origin is undefined", () => {
    assert.equal(doneLabel(undefined), "Let's Go Home!");
  });

  it("returns \"Let's Go Home!\" when origin is 'home'", () => {
    assert.equal(doneLabel('home'), "Let's Go Home!");
  });

  it("returns \"Let's Go Home!\" when origin is 'submit'", () => {
    assert.equal(doneLabel('submit'), "Let's Go Home!");
  });

  it("returns \"Let's Go Home!\" when origin is an empty string", () => {
    assert.equal(doneLabel(''), "Let's Go Home!");
  });

  it("returns \"Let's Go Home!\" when origin is an unrecognised string", () => {
    assert.equal(doneLabel('some-other-origin'), "Let's Go Home!");
  });
});

// ---------------------------------------------------------------------------
// Tests: re-entry guard machine (non-history)
// ---------------------------------------------------------------------------
describe('makeExit — non-history origin', () => {
  let backCount;
  let replaceHomeCount;
  let nav;

  beforeEach(() => {
    backCount = 0;
    replaceHomeCount = 0;
    nav = {
      back: () => { backCount++; },
      replaceHome: () => { replaceHomeCount++; },
    };
  });

  it('single call navigates to home exactly once', async () => {
    const { exit } = makeExit({ origin: undefined, nav });
    await exit();
    assert.equal(replaceHomeCount, 1, 'replaceHome must fire once');
    assert.equal(backCount, 0, 'back must not fire for non-history origin');
  });

  it('rapid double call navigates home only once', async () => {
    const { exit } = makeExit({ origin: undefined, nav });
    await exit();
    await exit(); // second call — leaving is already true
    assert.equal(replaceHomeCount, 1, 'replaceHome must not fire twice');
  });

  it('concurrent double call navigates home only once', async () => {
    const { exit } = makeExit({ origin: undefined, nav });
    const [p1, p2] = [exit(), exit()]; // button + header tap race
    await Promise.all([p1, p2]);
    assert.equal(replaceHomeCount, 1, 'replaceHome must fire exactly once under concurrency');
  });
});

// ---------------------------------------------------------------------------
// Tests: re-entry guard machine (history origin)
// ---------------------------------------------------------------------------
describe('makeExit — history origin', () => {
  let backCount;
  let replaceHomeCount;
  let nav;

  beforeEach(() => {
    backCount = 0;
    replaceHomeCount = 0;
    nav = {
      back: () => { backCount++; },
      replaceHome: () => { replaceHomeCount++; },
    };
  });

  it('single call calls back() exactly once', async () => {
    const { exit } = makeExit({ origin: 'history', nav });
    await exit();
    assert.equal(backCount, 1, 'back() must be called once');
    assert.equal(replaceHomeCount, 0, 'replaceHome must not fire when origin is history');
  });

  it('rapid double call only calls back() once', async () => {
    const { exit } = makeExit({ origin: 'history', nav });
    await exit();
    await exit();
    assert.equal(backCount, 1, 'back() must not be called twice');
  });

  it('concurrent double call (header + bottom button) only calls back() once', async () => {
    const { exit } = makeExit({ origin: 'history', nav });
    await Promise.all([exit(), exit()]);
    assert.equal(backCount, 1, 'back() must fire exactly once under concurrency');
    assert.equal(replaceHomeCount, 0, 'replaceHome must not fire for history origin');
  });
});

// ---------------------------------------------------------------------------
// Tests: navigation action matches origin
// ---------------------------------------------------------------------------
describe('makeExit — navigation action is determined by origin', () => {
  function makeSpies() {
    const calls = { back: 0, replaceHome: 0 };
    const nav = {
      back: () => { calls.back++; },
      replaceHome: () => { calls.replaceHome++; },
    };
    return { calls, nav };
  }

  it("origin 'history' → back(), no replaceHome", async () => {
    const { calls, nav } = makeSpies();
    const { exit } = makeExit({ origin: 'history', nav });
    await exit();
    assert.equal(calls.back, 1);
    assert.equal(calls.replaceHome, 0);
  });

  it("origin 'submit' → replaceHome(), no back", async () => {
    const { calls, nav } = makeSpies();
    const { exit } = makeExit({ origin: 'submit', nav });
    await exit();
    assert.equal(calls.back, 0);
    assert.equal(calls.replaceHome, 1);
  });

  it("origin undefined → replaceHome(), no back", async () => {
    const { calls, nav } = makeSpies();
    const { exit } = makeExit({ origin: undefined, nav });
    await exit();
    assert.equal(calls.back, 0);
    assert.equal(calls.replaceHome, 1);
  });
});
