import type { User } from '../../types';
import { apiRequest } from './client';

export async function createUserDoc(
  uid: string,
  email: string,
  displayName: string,
  username: string,
): Promise<void> {
  await apiRequest('/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ uid, email, displayName, username }),
  });
}

export async function getUserDoc(_uid: string): Promise<User | null> {
  const { user } = await apiRequest<{ user: User }>('/users/me');
  return user;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const { taken } = await apiRequest<{ taken: boolean }>(
    `/users/username/${encodeURIComponent(username)}/exists`,
  );
  return taken;
}
