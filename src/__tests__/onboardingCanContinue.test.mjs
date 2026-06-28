/**
 * Tests for the canContinue gate in onboarding.tsx.
 *
 * onboarding.tsx (app/onboarding.tsx) computes:
 *
 *   const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
 *
 *   const canContinue =
 *     name.trim().length > 0 &&
 *     (usernameStatus === 'available' ||
 *       (usernameStatus === 'error' && USERNAME_RE.test(username.trim().toLowerCase())));
 *
 * Key behaviours:
 *   - 'available'                              → allow
 *   - 'error' + locally valid handle           → allow (avoids dead-end when network fails)
 *   - 'error' + locally invalid handle         → block
 *   - 'taken' | 'invalid' | 'checking' | 'idle' → block regardless of handle validity
 *   - empty name (after trim) + 'available'    → block
 *
 * Run with: node --test src/__tests__/onboardingCanContinue.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/** Mirrors USERNAME_RE from onboarding.tsx exactly. */
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/**
 * Mirrors the canContinue expression from onboarding.tsx:
 *
 *   name.trim().length > 0 &&
 *   (usernameStatus === 'available' ||
 *     (usernameStatus === 'error' && USERNAME_RE.test(username.trim().toLowerCase())))
 */
function canContinue(name, username, usernameStatus) {
  return (
    name.trim().length > 0 &&
    (usernameStatus === 'available' ||
      (usernameStatus === 'error' && USERNAME_RE.test(username.trim().toLowerCase())))
  );
}

// ─── allow paths ──────────────────────────────────────────────────────────────

describe('canContinue — allow paths', () => {
  it('allows when status is available and name is non-empty', () => {
    assert.equal(canContinue('Alice', 'alice_23', 'available'), true);
  });

  it('allows when status is error and handle is locally valid (letters + digits + underscore, 3-20 chars)', () => {
    assert.equal(canContinue('Bob', 'bob_42', 'error'), true);
  });

  it('allows when status is error and handle is exactly 3 characters (lower boundary)', () => {
    assert.equal(canContinue('Jo', 'abc', 'error'), true);
  });

  it('allows when status is error and handle is exactly 20 characters (upper boundary)', () => {
    assert.equal(canContinue('Sam', 'a'.repeat(20), 'error'), true);
  });

  it('allows when status is error and handle contains only digits', () => {
    assert.equal(canContinue('Sam', '123', 'error'), true);
  });

  it('trims whitespace from name and still allows when result is non-empty', () => {
    assert.equal(canContinue('  Alice  ', 'alice', 'available'), true);
  });

  it('trims whitespace from username before regex test when status is error', () => {
    assert.equal(canContinue('Eve', '  valid_handle  ', 'error'), true);
  });

  it('lowercases username before regex test when status is error', () => {
    // The gate calls .toLowerCase() so mixed-case input that resolves to valid
    // lowercase should be allowed.
    assert.equal(canContinue('Alice', 'Alice_1', 'error'), true);
  });
});

// ─── block paths: status 'error' with invalid handle ─────────────────────────

describe('canContinue — error status with invalid handle blocks', () => {
  it('blocks when status is error and handle is too short (2 chars)', () => {
    assert.equal(canContinue('Alice', 'ab', 'error'), false);
  });

  it('blocks when status is error and handle is too long (21 chars)', () => {
    assert.equal(canContinue('Alice', 'a'.repeat(21), 'error'), false);
  });

  it('blocks when status is error and handle contains a hyphen', () => {
    assert.equal(canContinue('Alice', 'my-handle', 'error'), false);
  });

  it('blocks when status is error and handle contains a space', () => {
    assert.equal(canContinue('Alice', 'my handle', 'error'), false);
  });

  it('blocks when status is error and handle is empty string', () => {
    assert.equal(canContinue('Alice', '', 'error'), false);
  });

  it('blocks when status is error and handle contains special chars (@)', () => {
    assert.equal(canContinue('Alice', 'user@name', 'error'), false);
  });
});

// ─── block paths: statuses that must always block ────────────────────────────

describe('canContinue — statuses that always block', () => {
  it('blocks when status is taken', () => {
    assert.equal(canContinue('Alice', 'alice_23', 'taken'), false);
  });

  it('blocks when status is invalid', () => {
    assert.equal(canContinue('Alice', 'alice_23', 'invalid'), false);
  });

  it('blocks when status is checking', () => {
    assert.equal(canContinue('Alice', 'alice_23', 'checking'), false);
  });

  it('blocks when status is idle', () => {
    assert.equal(canContinue('Alice', 'alice_23', 'idle'), false);
  });
});

// ─── block paths: name requirement ───────────────────────────────────────────

describe('canContinue — name requirement', () => {
  it('blocks when name is empty string even if status is available', () => {
    assert.equal(canContinue('', 'alice_23', 'available'), false);
  });

  it('blocks when name is whitespace-only even if status is available', () => {
    assert.equal(canContinue('   ', 'alice_23', 'available'), false);
  });

  it('blocks when name is empty string and status is error with valid handle', () => {
    assert.equal(canContinue('', 'valid_h', 'error'), false);
  });
});
