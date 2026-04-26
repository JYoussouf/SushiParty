import type { User } from '../../types';
import { clearApiToken, setApiToken } from './authToken';
import { apiRequest, hasApiBaseUrl } from './client';

interface AuthResponse {
  token: string;
  user: User;
}

export async function syncDeviceIdentity(profile: User): Promise<User> {
  if (!hasApiBaseUrl()) {
    return profile;
  }

  const { token, user } = await apiRequest<AuthResponse>('/auth/device', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
  await setApiToken(token);
  return user;
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
