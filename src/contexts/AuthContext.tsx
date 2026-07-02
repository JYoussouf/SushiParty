import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearLocalSessions, migrateGuestSessions } from '../lib/local/sessions';
import {
  clearOnboardingFlag,
  getOrCreateDeviceProfile,
  isGuestMode,
  isOnboardingComplete,
  markOnboardingComplete,
  replaceDeviceProfile,
  resetDeviceProfile,
  setGuestMode,
  updateDeviceProfile,
} from '../lib/local/deviceProfile';
import {
  registerAccount,
  signInWithEmail,
  signOutRemote,
  syncDeviceIdentity,
  type AuthSession,
} from '../lib/cloudflare/auth';
import { changeUsername as changeUsernameRemote, createUserDoc, getUserDoc } from '../lib/cloudflare/users';
import { getApiToken, clearApiToken } from '../lib/cloudflare/authToken';
import { hasApiBaseUrl } from '../lib/cloudflare/client';
import { signInWithApple, exchangeGoogleCode, signInWithFacebook } from '../lib/oauth';
import type { User } from '../types';

interface LocalIdentity {
  email: string;
}

interface AuthContextValue {
  remoteUser: LocalIdentity | null;
  userProfile: User | null;
  accountBacked: boolean;
  isGuest: boolean;
  loading: boolean;
  onboardingDone: boolean;
  continueAsGuest: () => Promise<void>;
  completeOnboarding: (displayName: string, avatar: string, username: string) => Promise<void>;
  updateLocalProfile: (updates: Partial<Pick<User, 'displayName' | 'avatar'>>) => Promise<void>;
  changeUsername: (username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, username: string) => Promise<void>;
  signInWithAppleOAuth: () => Promise<void>;
  signInWithGoogleCode: (code: string, redirectUri: string) => Promise<void>;
  signInWithFacebookOAuth: (appId: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [remoteUser, setRemoteUser] = useState<LocalIdentity | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [accountBacked, setAccountBacked] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);

  // When a guest signs up, carry their locally-stored parties onto the account
  // uid and drop guest mode. Email sign-up preserves the uid server-side (so the
  // re-key is a no-op there); OAuth can assign a new uid, which this rescues.
  const finalizeGuestUpgrade = useCallback(async (previousUid: string | undefined, nextUid: string) => {
    if (previousUid) await migrateGuestSessions(previousUid, nextUid);
    await setGuestMode(false);
    setIsGuest(false);
  }, []);

  const applyAuthSession = useCallback(async (session: AuthSession, markOnboarded = false) => {
    const stored = await replaceDeviceProfile(session.user);
    setUserProfile(stored);
    setAccountBacked(session.accountBacked);
    setRemoteUser(session.accountBacked && stored.email ? { email: stored.email } : null);

    if (session.accountBacked && markOnboarded) {
      await markOnboardingComplete();
      setOnboardingDone(true);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const [profile, obDone, storedToken, guest] = await Promise.all([
        getOrCreateDeviceProfile(),
        isOnboardingComplete(),
        getApiToken(),
        isGuestMode(),
      ]);
      setIsGuest(guest);
      let onboardingComplete = obDone;
      try {
        if (storedToken && hasApiBaseUrl()) {
          // Restore the existing OAuth/email session from the stored JWT.
          // /users/me uses the Authorization header — no device sync needed.
          const user = await getUserDoc(profile.uid);
          if (user) {
            const stored = await replaceDeviceProfile(user);
            setUserProfile(stored);
            setAccountBacked(true);
            setRemoteUser(stored.email ? { email: stored.email } : null);
          }
        } else {
          // No stored token — create/sync a guest device identity.
          const session = await syncDeviceIdentity(profile);
          await applyAuthSession(session);
        }
      } catch {
        // Token expired or network error — clear it and fall back to device identity.
        await clearApiToken();
        try {
          const session = await syncDeviceIdentity(profile);
          await applyAuthSession(session);
        } catch {
          setUserProfile(profile);
          setAccountBacked(false);
          setRemoteUser(null);
        }
      } finally {
        setOnboardingDone(onboardingComplete);
        setLoading(false);
      }
    })();
  }, [applyAuthSession]);

  const updateLocalProfile = async (updates: Partial<Pick<User, 'displayName' | 'avatar'>>) => {
    const updated = await updateDeviceProfile(updates);
    setUserProfile(updated);
  };

  // Enter guest mode: play now, no account. The layout gate reads isGuest to let
  // them past the login wall into onboarding/home.
  const continueAsGuest = async () => {
    await setGuestMode(true);
    setIsGuest(true);
  };

  const changeUsername = async (username: string) => {
    const updated = await changeUsernameRemote(username);
    const stored = await updateDeviceProfile({ username: updated.username });
    setUserProfile(stored);
  };

  const completeOnboarding = async (displayName: string, avatar: string, username: string) => {
    const updated = await updateDeviceProfile({ displayName, avatar, username });
    if (accountBacked) {
      await createUserDoc(updated.uid, updated.email, displayName, username);
    }
    await markOnboardingComplete();
    setUserProfile(updated);
    setOnboardingDone(true);
  };

  const signIn = async (email: string, password: string) => {
    const session = await signInWithEmail(email.trim(), password);
    await applyAuthSession(session, true);
    await setGuestMode(false);
    setIsGuest(false);
  };

  const signUp = async (
    email: string,
    _password: string,
    displayName: string,
    username: string,
  ) => {
    const existingProfile = await getOrCreateDeviceProfile();
    const localProfile: User = {
      ...existingProfile,
      email,
      displayName,
      username,
    };
    const session = await registerAccount(localProfile, _password);
    await applyAuthSession(session, true);
    await finalizeGuestUpgrade(existingProfile.uid, session.user.uid);
  };

  const signOut = async () => {
    await clearLocalSessions();
    await signOutRemote();
    await clearOnboardingFlag();
    await setGuestMode(false);
    setIsGuest(false);
    setOnboardingDone(false);
    const freshProfile = await resetDeviceProfile();
    try {
      const session = await syncDeviceIdentity(freshProfile);
      await applyAuthSession(session);
    } catch {
      setUserProfile(freshProfile);
      setAccountBacked(false);
      setRemoteUser(null);
    }
  };

  const refreshProfile = async () => {
    const localProfile = await getOrCreateDeviceProfile();
    try {
      const session = await syncDeviceIdentity(localProfile);
      await applyAuthSession(session);
    } catch {
      setUserProfile(localProfile);
      setAccountBacked(false);
      setRemoteUser(null);
    }
  };

  const signInWithAppleOAuth = async () => {
    const previousUid = (await getOrCreateDeviceProfile()).uid;
    const response = await signInWithApple();
    const oauthSession: AuthSession = {
      user: response.user,
      accountBacked: response.accountBacked,
    };
    // Don't force-mark onboarding done — new OAuth users need to set their profile.
    // The isOnboardingComplete flag (written by completeOnboarding) handles returning users.
    await applyAuthSession(oauthSession, false);
    await finalizeGuestUpgrade(previousUid, response.user.uid);
  };

  const signInWithGoogleCode = async (code: string, redirectUri: string) => {
    const previousUid = (await getOrCreateDeviceProfile()).uid;
    const response = await exchangeGoogleCode(code, redirectUri);
    const oauthSession: AuthSession = {
      user: response.user,
      accountBacked: response.accountBacked,
    };
    await applyAuthSession(oauthSession, false);
    await finalizeGuestUpgrade(previousUid, response.user.uid);
  };

  const signInWithFacebookOAuth = async (appId: string) => {
    const previousUid = (await getOrCreateDeviceProfile()).uid;
    const response = await signInWithFacebook(appId);
    const oauthSession: AuthSession = {
      user: response.user,
      accountBacked: response.accountBacked,
    };
    await applyAuthSession(oauthSession, false);
    await finalizeGuestUpgrade(previousUid, response.user.uid);
  };

  return (
    <AuthContext.Provider
      value={{
        remoteUser,
        userProfile,
        accountBacked,
        isGuest,
        loading,
        onboardingDone,
        continueAsGuest,
        completeOnboarding,
        updateLocalProfile,
        changeUsername,
        signIn,
        signUp,
        signInWithAppleOAuth,
        signInWithGoogleCode,
        signInWithFacebookOAuth,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
