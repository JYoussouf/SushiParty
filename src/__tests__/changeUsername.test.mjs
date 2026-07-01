/**
 * Tests for the change-username decision logic added for GitHub issue #19
 * ("[UX] Add rate-limited 'change username' feature (1/week)").
 *
 * The logic under test lives in the `POST /users/me/username` handler in
 * api/src/index.ts (not directly importable — it's a Cloudflare Worker route
 * closed over `env.DB`). Per this repo's testing convention (see
 * src/__tests__/onboardingCanContinue.test.mjs, finishOnce.test.mjs), the
 * pure decision logic is replicated here exactly and tested in isolation.
 *
 * Mirrored from api/src/index.ts:
 *
 *   const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;   // line 162
 *
 *   function normalizeUsername(username, fallback) {                // line 218
 *     const normalized = username?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
 *     return normalized || fallback;
 *   }
 *
 *   function isValidAccountUsername(username) {                     // line 231
 *     return /^[a-z0-9_]{3,20}$/.test(username);
 *   }
 *
 * Handler body (lines 748-792), in order:
 *   1. normalize + validate the requested username -> 400 if invalid
 *   2. if requested === current.username -> graceful no-op, 200, NO cooldown charged
 *   3. else if current.username_changed_at is set and within 7 days -> 429
 *   4. else if another uid already owns the requested username -> 409
 *   5. else -> success, 200, username_changed_at is set to now (cooldown charged)
 *
 * Run with: node --test src/__tests__/changeUsername.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Mirrors normalizeUsername from api/src/index.ts exactly. */
function normalizeUsername(username, fallback) {
  const normalized = username?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return normalized || fallback;
}

/** Mirrors isValidAccountUsername from api/src/index.ts exactly. */
function isValidAccountUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

/** Mirrors the cooldown check at api/src/index.ts lines 763-768. */
function isRateLimited(usernameChangedAt, nowMs) {
  if (!usernameChangedAt) return false;
  const lastChanged = Date.parse(usernameChangedAt);
  if (Number.isNaN(lastChanged)) return false;
  return nowMs - lastChanged < USERNAME_CHANGE_COOLDOWN_MS;
}

/**
 * Full composed decision, mirroring the handler body at
 * api/src/index.ts lines 748-792 in exact order:
 *   validate -> self no-op -> rate limit -> uniqueness -> success.
 *
 * @param {string} requestedUsername raw input from the request body
 * @param {{ uid: string, username: string, username_changed_at: string|null }} current
 * @param {string|null} takenByUid uid of the row owning the normalized username, if any
 * @param {number} nowMs Date.now() at decision time
 */
function decideUsernameChange(requestedUsername, current, takenByUid, nowMs) {
  const username = normalizeUsername(requestedUsername, '');
  if (!isValidAccountUsername(username)) {
    return { outcome: 'invalid', status: 400 };
  }
  if (current.username === username) {
    return { outcome: 'noop', status: 200, cooldownCharged: false };
  }
  if (isRateLimited(current.username_changed_at, nowMs)) {
    return { outcome: 'rate_limited', status: 429 };
  }
  if (takenByUid && takenByUid !== current.uid) {
    return { outcome: 'taken', status: 409 };
  }
  return { outcome: 'success', status: 200, cooldownCharged: true };
}

// ─── validation + normalization ────────────────────────────────────────────

describe('isValidAccountUsername — regex boundaries', () => {
  it('accepts a typical lowercase handle with letters, digits, underscore', () => {
    assert.equal(isValidAccountUsername('alice_23'), true);
  });

  it('accepts the minimum length of 3 characters', () => {
    assert.equal(isValidAccountUsername('abc'), true);
  });

  it('accepts the maximum length of 20 characters', () => {
    assert.equal(isValidAccountUsername('a'.repeat(20)), true);
  });

  it('rejects 2 characters (below minimum)', () => {
    assert.equal(isValidAccountUsername('ab'), false);
  });

  it('rejects 21 characters (above maximum)', () => {
    assert.equal(isValidAccountUsername('a'.repeat(21)), false);
  });

  it('rejects uppercase letters (pre-normalization)', () => {
    assert.equal(isValidAccountUsername('Alice23'), false);
  });

  it('rejects spaces', () => {
    assert.equal(isValidAccountUsername('alice 23'), false);
  });

  it('rejects a hyphen even though normalizeUsername would preserve it', () => {
    assert.equal(isValidAccountUsername('alice-23'), false);
  });

  it('rejects an empty string', () => {
    assert.equal(isValidAccountUsername(''), false);
  });

  it('rejects special characters like @', () => {
    assert.equal(isValidAccountUsername('alice@23'), false);
  });
});

describe('normalizeUsername — trim + lowercase before validation', () => {
  it('trims surrounding whitespace', () => {
    assert.equal(normalizeUsername('  alice23  ', ''), 'alice23');
  });

  it('lowercases mixed-case input', () => {
    assert.equal(normalizeUsername('AliceBob', ''), 'alicebob');
  });

  it('strips characters outside [a-z0-9_-] entirely (e.g. @, spaces mid-string)', () => {
    assert.equal(normalizeUsername('ali ce@23', ''), 'alice23');
  });

  it('falls back to the provided fallback when the result is empty', () => {
    assert.equal(normalizeUsername('   ', 'fallback_id'), 'fallback_id');
  });

  it('falls back when input is undefined', () => {
    assert.equal(normalizeUsername(undefined, 'fallback_id'), 'fallback_id');
  });

  it('a normalized+trimmed+lowercased valid username passes isValidAccountUsername', () => {
    const normalized = normalizeUsername('  Alice_23  ', '');
    assert.equal(normalized, 'alice_23');
    assert.equal(isValidAccountUsername(normalized), true);
  });

  it('normalization can still leave an invalid handle (hyphen survives, regex still rejects it)', () => {
    const normalized = normalizeUsername('  Alice-23  ', '');
    assert.equal(normalized, 'alice-23');
    assert.equal(isValidAccountUsername(normalized), false);
  });
});

// ─── rate-limit gate boundaries ────────────────────────────────────────────

describe('isRateLimited — 7-day cooldown boundaries', () => {
  const now = Date.parse('2026-06-30T12:00:00.000Z');

  it('allows when username_changed_at is null (never changed)', () => {
    assert.equal(isRateLimited(null, now), false);
  });

  it('allows when username_changed_at is exactly 7 days ago (boundary is inclusive of "allowed")', () => {
    const sevenDaysAgo = new Date(now - USERNAME_CHANGE_COOLDOWN_MS).toISOString();
    assert.equal(isRateLimited(sevenDaysAgo, now), false);
  });

  it('allows when username_changed_at is more than 7 days ago', () => {
    const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(isRateLimited(eightDaysAgo, now), false);
  });

  it('blocks when username_changed_at is 6 days 23 hours ago (just inside the window)', () => {
    const almostSevenDays = new Date(now - (6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000)).toISOString();
    assert.equal(isRateLimited(almostSevenDays, now), true);
  });

  it('blocks when username_changed_at is 1ms inside the 7-day window', () => {
    const justInside = new Date(now - USERNAME_CHANGE_COOLDOWN_MS + 1).toISOString();
    assert.equal(isRateLimited(justInside, now), true);
  });

  it('blocks when username_changed_at is right now', () => {
    assert.equal(isRateLimited(new Date(now).toISOString(), now), true);
  });

  it('allows when username_changed_at is an unparseable/malformed timestamp', () => {
    assert.equal(isRateLimited('not-a-date', now), false);
  });
});

// ─── self no-op: re-submitting the current username ───────────────────────

describe('decideUsernameChange — self no-op bypasses the rate limit', () => {
  const now = Date.parse('2026-06-30T12:00:00.000Z');

  it('allows re-submitting the current username with no cooldown charged, even when never changed before', () => {
    const current = { uid: 'u1', username: 'alice', username_changed_at: null };
    const result = decideUsernameChange('alice', current, null, now);
    assert.deepEqual(result, { outcome: 'noop', status: 200, cooldownCharged: false });
  });

  it('allows re-submitting the current username even while inside an active cooldown window', () => {
    const justChanged = new Date(now - 1000).toISOString();
    const current = { uid: 'u1', username: 'alice', username_changed_at: justChanged };
    const result = decideUsernameChange('alice', current, null, now);
    assert.deepEqual(result, { outcome: 'noop', status: 200, cooldownCharged: false });
  });

  it('treats re-submission as a no-op after normalization (case/whitespace differences still match)', () => {
    const current = { uid: 'u1', username: 'alice', username_changed_at: null };
    const result = decideUsernameChange('  Alice  ', current, null, now);
    assert.equal(result.outcome, 'noop');
    assert.equal(result.cooldownCharged, false);
  });
});

// ─── rate-limit gate through the full decision ─────────────────────────────

describe('decideUsernameChange — rate limit blocks genuine changes', () => {
  const now = Date.parse('2026-06-30T12:00:00.000Z');

  it('blocks a genuine change attempted 1 hour after the last change', () => {
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const current = { uid: 'u1', username: 'alice', username_changed_at: oneHourAgo };
    const result = decideUsernameChange('bob', current, null, now);
    assert.deepEqual(result, { outcome: 'rate_limited', status: 429 });
  });

  it('allows a genuine change exactly 7 days after the last change', () => {
    const sevenDaysAgo = new Date(now - USERNAME_CHANGE_COOLDOWN_MS).toISOString();
    const current = { uid: 'u1', username: 'alice', username_changed_at: sevenDaysAgo };
    const result = decideUsernameChange('bob', current, null, now);
    assert.deepEqual(result, { outcome: 'success', status: 200, cooldownCharged: true });
  });

  it('allows a genuine change when the user has never changed their username before', () => {
    const current = { uid: 'u1', username: 'alice', username_changed_at: null };
    const result = decideUsernameChange('bob', current, null, now);
    assert.deepEqual(result, { outcome: 'success', status: 200, cooldownCharged: true });
  });
});

// ─── uniqueness ─────────────────────────────────────────────────────────────

describe('decideUsernameChange — uniqueness decision', () => {
  const now = Date.parse('2026-06-30T12:00:00.000Z');
  const current = { uid: 'u1', username: 'alice', username_changed_at: null };

  it('blocks with 409 when the requested username is taken by a different uid', () => {
    const result = decideUsernameChange('bob', current, 'u2', now);
    assert.deepEqual(result, { outcome: 'taken', status: 409 });
  });

  it('allows when the requested username row is owned by the requesting uid itself', () => {
    // Defensive case: e.g. a stale/duplicate lookup returning the same uid.
    const result = decideUsernameChange('bob', current, 'u1', now);
    assert.deepEqual(result, { outcome: 'success', status: 200, cooldownCharged: true });
  });

  it('allows when no row owns the requested username at all', () => {
    const result = decideUsernameChange('bob', current, null, now);
    assert.deepEqual(result, { outcome: 'success', status: 200, cooldownCharged: true });
  });
});

// ─── validation short-circuits before rate limit / uniqueness are checked ──

describe('decideUsernameChange — invalid input is rejected before other checks', () => {
  const now = Date.parse('2026-06-30T12:00:00.000Z');

  it('rejects an invalid requested username even when it would otherwise be a rate-limited change', () => {
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const current = { uid: 'u1', username: 'alice', username_changed_at: oneHourAgo };
    const result = decideUsernameChange('a', current, null, now);
    assert.deepEqual(result, { outcome: 'invalid', status: 400 });
  });

  it('rejects an invalid requested username even when it would otherwise collide with another uid', () => {
    const current = { uid: 'u1', username: 'alice', username_changed_at: null };
    const result = decideUsernameChange('!!', current, 'u2', now);
    assert.deepEqual(result, { outcome: 'invalid', status: 400 });
  });
});
