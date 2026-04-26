import type { User } from '../../types';
import { clearApiToken, setApiToken } from './authToken';
import { apiRequest, hasApiBaseUrl } from './client';

interface AuthResponse {
  token: string;
  user: User;
  accountBacked?: boolean;
}

export interface AuthSession {
  user: User;
  accountBacked: boolean;
}

function toAuthSession(response: AuthResponse): AuthSession {
  return {
    user: response.user,
    accountBacked: response.accountBacked === true,
  };
}

function requireAccountApi(): void {
  if (!hasApiBaseUrl()) {
    throw new Error(
      'Account login requires EXPO_PUBLIC_API_BASE_URL to point at the Sushi Party API.',
    );
  }
}

export async function syncDeviceIdentity(profile: User): Promise<AuthSession> {
  if (!hasApiBaseUrl()) {
    return { user: profile, accountBacked: false };
  }

  const response = await apiRequest<AuthResponse>('/auth/device', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
  await setApiToken(response.token);
  return toAuthSession(response);
}

export async function signInWithEmail(email: string, password: string): Promise<AuthSession> {
  requireAccountApi();

  const response = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await setApiToken(response.token);
  return toAuthSession(response);
}

export async function registerAccount(profile: User, password: string): Promise<AuthSession> {
  requireAccountApi();

  const response = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...profile, password }),
  });
  await setApiToken(response.token);
  return toAuthSession(response);
}

export async function updateRemoteProfile(profile: User): Promise<User> {
  if (!hasApiBaseUrl()) {
    return profile;
  }

  const { user } = await apiRequest<{ user: User }>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(profile),
  });
  return user;
}

export async function signOutRemote(): Promise<void> {
  await clearApiToken();
}
