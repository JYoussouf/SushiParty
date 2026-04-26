import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearLocalSessions } from '../lib/local/sessions';
import {
  getOrCreateDeviceProfile,
  isOnboardingComplete,
  markOnboardingComplete,
  replaceDeviceProfile,
  resetDeviceProfile,
  updateDeviceProfile,
} from '../lib/local/deviceProfile';
import { signOutRemote, syncDeviceIdentity } from '../lib/cloudflare/auth';
import type { User } from '../types';

interface LocalIdentity {
  email: string;
}

interface AuthContextValue {
  remoteUser: LocalIdentity | null;
  userProfile: User | null;
  loading: boolean;
  onboardingDone: boolean;
  completeOnboarding: (displayName: string, avatar: string) => Promise<void>;
  updateLocalProfile: (updates: Partial<Pick<User, 'displayName' | 'avatar'>>) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    username: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [remoteUser, setRemoteUser] = useState<LocalIdentity | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    void (async () => {
      const [profile, obDone] = await Promise.all([
        getOrCreateDeviceProfile(),
        isOnboardingComplete(),
      ]);
      setOnboardingDone(obDone);
      try {
        const synced = await syncDeviceIdentity(profile);
        const stored = await replaceDeviceProfile(synced);
        setUserProfile(stored);
        setRemoteUser(stored.email ? { email: stored.email } : null);
      } catch {
        setUserProfile(profile);
        setRemoteUser(profile.email ? { email: profile.email } : null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const signIn = async (email: string) => {
    const localProfile = await updateDeviceProfile({ email });
    const profile = await syncDeviceIdentity(localProfile);
    await replaceDeviceProfile(profile);
    setUserProfile(profile);
    setRemoteUser(profile.email ? { email: profile.email } : null);
  };

  const signUp = async (
    email: string,
    _password: string,
    displayName: string,
    username: string,
  ) => {
    const localProfile = await updateDeviceProfile({
      email,
      displayName,
      username,
    });
    const profile = await syncDeviceIdentity(localProfile);
    await replaceDeviceProfile(profile);
    setUserProfile(profile);
    setRemoteUser(profile.email ? { email: profile.email } : null);
  };

  const signOut = async () => {
    await clearLocalSessions();
    await signOutRemote();
    const freshProfile = await resetDeviceProfile();
    try {
      const synced = await syncDeviceIdentity(freshProfile);
      const stored = await replaceDeviceProfile(synced);
      setUserProfile(stored);
      setRemoteUser(stored.email ? { email: stored.email } : null);
    } catch {
      setUserProfile(freshProfile);
      setRemoteUser(freshProfile.email ? { email: freshProfile.email } : null);
    }
  };

  const refreshProfile = async () => {
    const localProfile = await getOrCreateDeviceProfile();
    try {
      const profile = await syncDeviceIdentity(localProfile);
      await replaceDeviceProfile(profile);
      setUserProfile(profile);
      setRemoteUser(profile.email ? { email: profile.email } : null);
    } catch {
      setUserProfile(localProfile);
      setRemoteUser(localProfile.email ? { email: localProfile.email } : null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        remoteUser,
        userProfile,
        loading,
        onboardingDone,
        completeOnboarding,
        updateLocalProfile,
        signIn,
        signUp,
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
