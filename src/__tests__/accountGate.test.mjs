import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mirrors the account-gate routing in app/_layout.tsx after the "Continue as
// Guest" change. `authed = accountBacked || isGuest` may pass the login wall;
// only real accounts are auto-bounced out of the auth screens so a guest can
// open them to upgrade. Returns the redirect target, or null to stay put.

function gateDecision({ accountBacked, isGuest, onboardingDone, inAuth, currentPath }) {
  const authed = accountBacked || isGuest;
  if (!authed) return inAuth ? null : 'login';
  if (accountBacked && inAuth) return onboardingDone ? 'home' : 'onboarding';
  if (!onboardingDone && currentPath !== 'onboarding') return 'onboarding';
  return null;
}

describe('account gate — Continue as Guest', () => {
  it('sends a brand-new user (no account, no guest) to login', () => {
    assert.equal(
      gateDecision({ accountBacked: false, isGuest: false, onboardingDone: false, inAuth: false, currentPath: 'index' }),
      'login',
    );
  });

  it('lets a new user sit on the login screen without a loop', () => {
    assert.equal(
      gateDecision({ accountBacked: false, isGuest: false, onboardingDone: false, inAuth: true, currentPath: '(auth)/login' }),
      null,
    );
  });

  it('routes a fresh guest (not onboarded) to onboarding', () => {
    assert.equal(
      gateDecision({ accountBacked: false, isGuest: true, onboardingDone: false, inAuth: false, currentPath: 'index' }),
      'onboarding',
    );
  });

  it('leaves a fresh guest on the onboarding screen', () => {
    assert.equal(
      gateDecision({ accountBacked: false, isGuest: true, onboardingDone: false, inAuth: false, currentPath: 'onboarding' }),
      null,
    );
  });

  it('does NOT bounce an onboarded guest out of the register screen (so they can upgrade)', () => {
    assert.equal(
      gateDecision({ accountBacked: false, isGuest: true, onboardingDone: true, inAuth: true, currentPath: '(auth)/register' }),
      null,
    );
  });

  it('keeps an onboarded guest on home', () => {
    assert.equal(
      gateDecision({ accountBacked: false, isGuest: true, onboardingDone: true, inAuth: false, currentPath: '(tabs)/home' }),
      null,
    );
  });

  it('bounces an account-backed, onboarded user out of auth to home', () => {
    assert.equal(
      gateDecision({ accountBacked: true, isGuest: false, onboardingDone: true, inAuth: true, currentPath: '(auth)/login' }),
      'home',
    );
  });

  it('sends an account-backed but not-onboarded user to onboarding from auth', () => {
    assert.equal(
      gateDecision({ accountBacked: true, isGuest: false, onboardingDone: false, inAuth: true, currentPath: '(auth)/login' }),
      'onboarding',
    );
  });
});
