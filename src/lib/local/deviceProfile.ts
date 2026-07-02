import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../../types';

const DEVICE_PROFILE_KEY = 'sushi-party/device-profile';
const ONBOARDING_KEY = 'sushi-party/onboarding-done';
const GUEST_MODE_KEY = 'sushi-party/guest-mode';

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function randomGuestName(): string {
  return `Guest ${Math.floor(100 + Math.random() * 900)}`;
}

function createGuestProfile(): User {
  const uid = randomId('device');
  return {
    uid,
    username: uid,
    displayName: randomGuestName(),
    email: '',
    createdAt: new Date().toISOString(),
    friendIds: [],
  };
}

export async function getOrCreateDeviceProfile(): Promise<User> {
  const stored = await AsyncStorage.getItem(DEVICE_PROFILE_KEY);
  if (stored) {
    return JSON.parse(stored) as User;
  }

  const profile = createGuestProfile();
  await AsyncStorage.setItem(DEVICE_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export async function isOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1';
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

export async function clearOnboardingFlag(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_KEY);
}

// "Guest mode": the user chose to play without an account. Persisted so the
// account gate keeps letting them in across launches until they sign up.
export async function isGuestMode(): Promise<boolean> {
  return (await AsyncStorage.getItem(GUEST_MODE_KEY)) === '1';
}

export async function setGuestMode(on: boolean): Promise<void> {
  if (on) {
    await AsyncStorage.setItem(GUEST_MODE_KEY, '1');
  } else {
    await AsyncStorage.removeItem(GUEST_MODE_KEY);
  }
}

export async function updateDeviceProfile(
  updates: Partial<Pick<User, 'displayName' | 'username' | 'email' | 'friendIds' | 'avatar'>>,
): Promise<User> {
  const existing = await getOrCreateDeviceProfile();
  const next: User = {
    ...existing,
    ...updates,
    displayName: updates.displayName?.trim() || existing.displayName,
    username: updates.username?.trim().toLowerCase() || existing.username,
    email: updates.email?.trim() || existing.email,
    friendIds: updates.friendIds ?? existing.friendIds,
    ...(updates.avatar !== undefined
      ? { avatar: updates.avatar }
      : existing.avatar !== undefined
        ? { avatar: existing.avatar }
        : {}),
  };
  await AsyncStorage.setItem(DEVICE_PROFILE_KEY, JSON.stringify(next));
  return next;
}

export async function resetDeviceProfile(): Promise<User> {
  const profile = createGuestProfile();
  await AsyncStorage.setItem(DEVICE_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export async function replaceDeviceProfile(profile: User): Promise<User> {
  await AsyncStorage.setItem(DEVICE_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}
