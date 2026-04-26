import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearLocalSessions } from '../lib/local/sessions';
import {
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
import { signInWithApple, signInWithGoogle, signInWithFacebook } from '../lib/oauth';
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
  completeOnboarding: (displayName: string, avatar: string) => Promise<void>;
  updateLocalProfile: (updates: Partial<Pick<User, 'displayName' | 'avatar'>>) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, username: string) => Promise<void>;
  signInWithAppleOAuth: () => Promise<void>;
  signInWithGoogleOAuth: (clientId: string) => Promise<void>;
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
        if (session.accountBacked && !onboardingComplete) {
          await markOnboardingComplete();
          onboardingComplete = true;
        }
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

  const completeOnboarding = async (displayName: string, avatar: string) => {
    const updated = await updateDeviceProfile({ displayName, avatar });
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
    await applyAuthSession(oauthSession, true);
  };

  const signInWithGoogleOAuth = async (clientId: string) => {
    const response = await signInWithGoogle(clientId);
    const oauthSession: AuthSession = {
      user: response.user,
      accountBacked: response.accountBacked,
    };
    await applyAuthSession(oauthSession, true);
  };

  const signInWithFacebookOAuth = async (appId: string) => {
    const response = await signInWithFacebook(appId);
    const oauthSession: AuthSession = {
      user: response.user,
      accountBacked: response.accountBacked,
    };
    await applyAuthSession(oauthSession, true);
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
        signInWithGoogleOAuth,
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
