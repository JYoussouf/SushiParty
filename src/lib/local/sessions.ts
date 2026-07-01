import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  GeoPoint,
  SessionMode,
  SessionParticipant,
  SushiSession,
  User,
} from '../../types';

const LOCAL_SESSIONS_KEY = 'sushi-party/local-sessions';
const PAGE_SIZE = 20;

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
  startedAt?: string; // ISO; defaults to now. Lets a group session mirror the shared party start.
}

function createSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readSessions(): Promise<SushiSession[]> {
  const raw = await AsyncStorage.getItem(LOCAL_SESSIONS_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as SushiSession[];
  } catch {
    return [];
  }
}

async function writeSessions(sessions: SushiSession[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
}

export async function getAllSessions(): Promise<SushiSession[]> {
  return readSessions();
}

export async function submitSession(params: SubmitSessionParams): Promise<string> {
  const now = new Date().toISOString();
  const id = createSessionId();
  const session: SushiSession = {
    id,
    mode: params.mode,
    restaurantId: params.restaurantId,
    restaurantName: params.restaurantName,
    menuId: params.menuId,
    menuVersion: params.menuVersion,
    location: params.location,
    startedAt: params.startedAt ?? now,
    submittedAt: now,
    participants: params.participants,
    flagged: params.flagged ?? false,
  };
  if (params.groupCode) {
    session.groupCode = params.groupCode;
  }

  const sessions = await readSessions();
  await writeSessions([session, ...sessions.filter((item) => item.id !== id)]);
  return id;
}

export async function getUserSessions(
  uid: string,
  cursor = 0,
): Promise<{ sessions: SushiSession[]; nextCursor: number | null }> {
  const sessions = await readSessions();
  const matching = sessions.filter((session) =>
    session.participants.some((participant) => participant.userId === uid),
  );

  return {
    sessions: matching.slice(cursor, cursor + PAGE_SIZE),
    nextCursor: cursor + PAGE_SIZE < matching.length ? cursor + PAGE_SIZE : null,
  };
}

export async function getSessionById(sessionId: string): Promise<SushiSession | null> {
  const sessions = await readSessions();
  return sessions.find((session) => session.id === sessionId) ?? null;
}

export async function updateSession(sessionId: string, updates: Partial<SushiSession>): Promise<SushiSession | null> {
  const sessions = await readSessions();
  let updatedSession: SushiSession | null = null;

  const nextSessions = sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    updatedSession = { ...session, ...updates, id: session.id };
    return updatedSession;
  });

  if (!updatedSession) {
    return null;
  }

  await writeSessions(nextSessions);
  return updatedSession;
}

export async function tagFriendsOnSession(
  sessionId: string,
  friends: Array<Pick<User, 'uid' | 'displayName'>>,
): Promise<SushiSession | null> {
  const sessions = await readSessions();
  let updatedSession: SushiSession | null = null;

  const nextSessions = sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    const existingParticipantIds = new Set(session.participants.map((participant) => participant.userId));
    const participants = [
      ...session.participants,
      ...friends
        .filter((friend) => !existingParticipantIds.has(friend.uid))
        .map((friend) => ({
          userId: friend.uid,
          displayName: friend.displayName,
          counts: {},
        })),
    ];

    updatedSession = { ...session, participants };
    return updatedSession;
  });

  if (!updatedSession) {
    return null;
  }

  await writeSessions(nextSessions);
  return updatedSession;
}

export async function updateSessionNote(sessionId: string, note: string): Promise<SushiSession | null> {
  const trimmed = note.trim();
  const sessions = await readSessions();
  let updatedSession: SushiSession | null = null;

  const nextSessions = sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    if (trimmed) {
      updatedSession = { ...session, note: trimmed };
      return updatedSession;
    }

    const { note: _note, ...rest } = session;
    updatedSession = rest;
    return updatedSession;
  });

  if (!updatedSession) {
    return null;
  }

  await writeSessions(nextSessions);
  return updatedSession;
}

export async function clearLocalSessions(): Promise<void> {
  await AsyncStorage.removeItem(LOCAL_SESSIONS_KEY);
}
