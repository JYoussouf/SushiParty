import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearLocalSessions } from '../lib/local/sessions';
import {
  getOrCreateDeviceProfile,
  resetDeviceProfile,
  updateDeviceProfile,
} from '../lib/local/deviceProfile';
import type { User } from '../types';

interface LocalIdentity {
  email: string;
}

interface AuthContextValue {
  firebaseUser: LocalIdentity | null;
  userProfile: User | null;
  loading: boolean;
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
  const [firebaseUser, setFirebaseUser] = useState<LocalIdentity | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const profile = await getOrCreateDeviceProfile();
      setUserProfile(profile);
      setFirebaseUser(profile.email ? { email: profile.email } : null);
      setLoading(false);
    })();
  }, []);

  const signIn = async (email: string) => {
    const profile = await updateDeviceProfile({ email });
    setUserProfile(profile);
    setFirebaseUser(profile.email ? { email: profile.email } : null);
  };

  const signUp = async (
    email: string,
    _password: string,
    displayName: string,
    username: string,
  ) => {
    const profile = await updateDeviceProfile({
      email,
      displayName,
      username,
    });
    setUserProfile(profile);
    setFirebaseUser(profile.email ? { email: profile.email } : null);
  };

  const signOut = async () => {
    await clearLocalSessions();
    const freshProfile = await resetDeviceProfile();
    setUserProfile(freshProfile);
    setFirebaseUser(freshProfile.email ? { email: freshProfile.email } : null);
  };

  const refreshProfile = async () => {
    const profile = await getOrCreateDeviceProfile();
    setUserProfile(profile);
    setFirebaseUser(profile.email ? { email: profile.email } : null);
  };

  return (
    <AuthContext.Provider
      value={{ firebaseUser, userProfile, loading, signIn, signUp, signOut, refreshProfile }}
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
