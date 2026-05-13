import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearLocalSessions } from '../lib/local/sessions';
import {
  clearOnboardingFlag,
  getOrCreateDeviceProfile,
  isOnboardingComplete,
  markOnboardingComplete,
  replaceDeviceProfile,
  resetDeviceProfile,
  updateDeviceProfile,
} from '../lib/local/deviceProfile';
import {
  registerAccount,
  signInWithEmail,
  signOutRemote,
  syncDeviceIdentity,
  type AuthSession,
} from '../lib/cloudflare/auth';
import { createUserDoc } from '../lib/cloudflare/users';
import { signInWithApple, exchangeGoogleCode, signInWithFacebook } from '../lib/oauth';
import type { User } from '../types';

interface LocalIdentity {
  email: string;
}

interface AuthContextValue {
  remoteUser: LocalIdentity | null;
  userProfile: User | null;
  accountBacked: boolean;
  loading: boolean;
  onboardingDone: boolean;
  completeOnboarding: (displayName: string, avatar: string, username: string) => Promise<void>;
  updateLocalProfile: (updates: Partial<Pick<User, 'displayName' | 'avatar'>>) => Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);

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
      const [profile, obDone] = await Promise.all([
        getOrCreateDeviceProfile(),
        isOnboardingComplete(),
      ]);
      let onboardingComplete = obDone;
      try {
        const session = await syncDeviceIdentity(profile);
        await applyAuthSession(session);
      } catch {
        setUserProfile(profile);
        setAccountBacked(false);
        setRemoteUser(null);
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
  };

  const signOut = async () => {
    await clearLocalSessions();
    await signOutRemote();
    await clearOnboardingFlag();
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
    const response = await signInWithApple();
    const oauthSession: AuthSession = {
      user: response.user,
      accountBacked: response.accountBacked,
    };
    // Don't force-mark onboarding done — new OAuth users need to set their profile.
    // The isOnboardingComplete flag (written by completeOnboarding) handles returning users.
    await applyAuthSession(oauthSession, false);
  };

  const signInWithGoogleCode = async (code: string, redirectUri: string) => {
    const response = await exchangeGoogleCode(code, redirectUri);
    const oauthSession: AuthSession = {
      user: response.user,
      accountBacked: response.accountBacked,
    };
    await applyAuthSession(oauthSession, false);
  };

  const signInWithFacebookOAuth = async (appId: string) => {
    const response = await signInWithFacebook(appId);
    const oauthSession: AuthSession = {
      user: response.user,
      accountBacked: response.accountBacked,
    };
    await applyAuthSession(oauthSession, false);
  };

  return (
    <AuthContext.Provider
      value={{
        remoteUser,
        userProfile,
        accountBacked,
        loading,
        onboardingDone,
        completeOnboarding,
        updateLocalProfile,
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
