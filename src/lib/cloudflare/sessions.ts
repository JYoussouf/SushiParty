import type {
  GeoPoint,
  SessionMode,
  SessionParticipant,
  SushiSession,
  User,
} from '../../types';
import { apiRequest, encodeQuery } from './client';

interface SubmitSessionParams {
  ownerUid: string;
  mode: SessionMode;
  restaurantId: string;
  restaurantName: string;
  menuId: string;
  menuVersion: number;
  location: GeoPoint;
  participants: SessionParticipant[];
  groupCode?: string;
  flagged?: boolean;
}

export async function submitSession(params: SubmitSessionParams): Promise<string> {
  const { id } = await apiRequest<{ id: string }>('/sessions', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return id;
}

export async function getAllSessions(): Promise<SushiSession[]> {
  const { sessions } = await apiRequest<{ sessions: SushiSession[] }>('/sessions/me');
  return sessions;
}

export async function getUserSessions(
  _uid: string,
  cursor = 0,
): Promise<{ sessions: SushiSession[]; nextCursor: number | null }> {
  const { sessions } = await apiRequest<{ sessions: SushiSession[] }>(
    `/sessions/me${encodeQuery({ limit: cursor + 20 })}`,
  );
  return {
    sessions: sessions.slice(cursor, cursor + 20),
    nextCursor: cursor + 20 < sessions.length ? cursor + 20 : null,
  };
}

export async function getSessionById(sessionId: string): Promise<SushiSession | null> {
  try {
    const { session } = await apiRequest<{ session: SushiSession }>(
      `/sessions/${encodeURIComponent(sessionId)}`,
    );
    return session;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
      return null;
    }
    throw error;
  }
}

export async function updateSession(
  sessionId: string,
  updates: Partial<SushiSession>,
): Promise<SushiSession | null> {
  const { session } = await apiRequest<{ session: SushiSession }>(
    `/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    },
  );
  return session;
}

export async function tagFriendsOnSession(
  sessionId: string,
  friends: Array<Pick<User, 'uid' | 'displayName'>>,
): Promise<SushiSession | null> {
  const existing = await getSessionById(sessionId);
  if (!existing) return null;

  const existingParticipantIds = new Set(
    existing.participants.map((participant) => participant.userId),
  );
  const participants = [
    ...existing.participants,
    ...friends
      .filter((friend) => !existingParticipantIds.has(friend.uid))
      .map((friend) => ({
        userId: friend.uid,
        displayName: friend.displayName,
        counts: {},
      })),
  ];

  return updateSession(sessionId, { participants });
}

export async function updateSessionNote(
  sessionId: string,
  note: string,
): Promise<SushiSession | null> {
  return updateSession(sessionId, { note: note.trim() });
}
