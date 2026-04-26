import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GroupSessionDraft, SessionParticipant } from '../../types';

const GROUP_SESSIONS_KEY = 'sushi-party/group-sessions';
const GROUP_CODE_LENGTH = 6;
const GROUP_TTL_MS = 8 * 60 * 60 * 1000;

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: GROUP_CODE_LENGTH }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');
}

async function readDrafts(): Promise<GroupSessionDraft[]> {
  const raw = await AsyncStorage.getItem(GROUP_SESSIONS_KEY);
  if (!raw) return [];

  try {
    const drafts = JSON.parse(raw) as GroupSessionDraft[];
    return drafts;
  } catch {
    return [];
  }
}

async function writeDrafts(drafts: GroupSessionDraft[]): Promise<void> {
  await AsyncStorage.setItem(GROUP_SESSIONS_KEY, JSON.stringify(drafts));
}

async function getFreshDrafts(): Promise<GroupSessionDraft[]> {
  const drafts = await readDrafts();
  const now = Date.now();
  const freshDrafts = drafts.filter((draft) => new Date(draft.expiresAt).getTime() > now);

  if (freshDrafts.length !== drafts.length) {
    await writeDrafts(freshDrafts);
  }

  return freshDrafts;
}

function ensureParticipant(
  participants: SessionParticipant[],
  userId: string,
  displayName: string,
  avatar?: string,
): SessionParticipant[] {
  if (participants.some((participant) => participant.userId === userId)) {
    return participants.map((participant) =>
      participant.userId === userId && avatar && participant.avatar !== avatar
        ? { ...participant, avatar }
        : participant,
    );
  }

  return [
    ...participants,
    {
      userId,
      displayName,
      ...(avatar ? { avatar } : {}),
      counts: {},
    },
  ];
}

export async function createGroupSession(
  ownerUid: string,
  displayName: string,
  avatar?: string,
): Promise<GroupSessionDraft> {
  const drafts = await getFreshDrafts();
  let code = randomCode();

  while (drafts.some((draft) => draft.code === code)) {
    code = randomCode();
  }

  const now = new Date().toISOString();
  const draft: GroupSessionDraft = {
    id: randomId('group'),
    code,
    ownerUid,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + GROUP_TTL_MS).toISOString(),
    participants: [
      {
        userId: ownerUid,
        displayName,
        ...(avatar ? { avatar } : {}),
        counts: {},
      },
    ],
  };

  await writeDrafts([draft, ...drafts]);
  return draft;
}

export async function getGroupSessionById(groupSessionId: string): Promise<GroupSessionDraft | null> {
  const drafts = await getFreshDrafts();
  return drafts.find((draft) => draft.id === groupSessionId) ?? null;
}

export async function getGroupSessionByCode(code: string): Promise<GroupSessionDraft | null> {
  const normalized = code.trim().toUpperCase();
  const drafts = await getFreshDrafts();
  return drafts.find((draft) => draft.code === normalized) ?? null;
}

export async function joinGroupSession(
  code: string,
  userId: string,
  displayName: string,
  avatar?: string,
): Promise<GroupSessionDraft | null> {
  const drafts = await getFreshDrafts();
  const normalized = code.trim().toUpperCase();
  let joinedDraft: GroupSessionDraft | null = null;

  const nextDrafts = drafts.map((draft) => {
    if (draft.code !== normalized) {
      return draft;
    }

    joinedDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
      participants: ensureParticipant(draft.participants, userId, displayName, avatar),
    };
    return joinedDraft;
  });

  if (!joinedDraft) {
    return null;
  }

  await writeDrafts(nextDrafts);
  return joinedDraft;
}

export async function updateGroupParticipantCounts(
  groupSessionId: string,
  userId: string,
  displayName: string,
  itemId: string,
  delta: number,
  avatar?: string,
): Promise<GroupSessionDraft | null> {
  const drafts = await getFreshDrafts();
  let updatedDraft: GroupSessionDraft | null = null;

  const nextDrafts = drafts.map((draft) => {
    if (draft.id !== groupSessionId) {
      return draft;
    }

    const participants = ensureParticipant(draft.participants, userId, displayName, avatar).map((participant) => {
      if (participant.userId !== userId) {
        return participant;
      }

      const current = participant.counts[itemId] ?? 0;
      const next = Math.max(0, current + delta);
      return {
        ...participant,
        counts: { ...participant.counts, [itemId]: next },
      };
    });

    updatedDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
      participants,
    };

    return updatedDraft;
  });

  if (!updatedDraft) {
    return null;
  }

  await writeDrafts(nextDrafts);
  return updatedDraft;
}

export async function resetGroupParticipantCounts(
  groupSessionId: string,
  userId: string,
): Promise<GroupSessionDraft | null> {
  const drafts = await getFreshDrafts();
  let updatedDraft: GroupSessionDraft | null = null;

  const nextDrafts = drafts.map((draft) => {
    if (draft.id !== groupSessionId) {
      return draft;
    }

    updatedDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
      participants: draft.participants.map((participant) =>
        participant.userId === userId ? { ...participant, counts: {} } : participant,
      ),
    };
    return updatedDraft;
  });

  if (!updatedDraft) {
    return null;
  }

  await writeDrafts(nextDrafts);
  return updatedDraft;
}

export async function updateGroupParticipantAvatar(
  groupSessionId: string,
  userId: string,
  displayName: string,
  avatar: string,
): Promise<GroupSessionDraft | null> {
  const drafts = await getFreshDrafts();
  let updatedDraft: GroupSessionDraft | null = null;

  const nextDrafts = drafts.map((draft) => {
    if (draft.id !== groupSessionId) {
      return draft;
    }

    updatedDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
      participants: ensureParticipant(draft.participants, userId, displayName, avatar),
    };
    return updatedDraft;
  });

  if (!updatedDraft) {
    return null;
  }

  await writeDrafts(nextDrafts);
  return updatedDraft;
}

export async function removeGroupSession(groupSessionId: string): Promise<void> {
  const drafts = await getFreshDrafts();
  await writeDrafts(drafts.filter((draft) => draft.id !== groupSessionId));
}
