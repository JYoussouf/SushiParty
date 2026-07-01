import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  acceptEndVote as acceptEndVoteRequest,
  cancelEndVote as cancelEndVoteRequest,
  createGroupParty,
  endGroupParty,
  joinGroupParty,
  removeGroupParty,
  resetGroupPartyParticipantCounts,
  startEndVote as startEndVoteRequest,
  startGroupParty,
  subscribeToGroupParty,
  updateGroupPartyParticipantAvatar,
  updateGroupPartyParticipantCounts,
  type GroupPartyStartContext,
} from '../lib/cloudflare/groupParties';
import { DEFAULT_CAT_AVATAR } from '../lib/catAvatars';
import type { GroupEndVote, GroupPhase, GroupSessionDraft, SessionMode, SessionParticipant } from '../types';

// Shared session context carried on the draft (host-populated at start). Exposed so a
// guest can reconstruct their results when the party ends.
export type GroupSessionContext = Pick<
  GroupSessionDraft,
  'restaurantId' | 'restaurantName' | 'location' | 'menuId' | 'menuVersion' | 'startedAt'
>;

interface SessionContextValue {
  mode: SessionMode;
  setMode: (mode: SessionMode) => Promise<void>;
  participants: SessionParticipant[];
  activeParticipantIndex: number;
  setActiveParticipantIndex: (index: number) => void;
  increment: (itemId: string) => Promise<void>;
  decrement: (itemId: string) => Promise<void>;
  getCount: (itemId: string) => number;
  totalPieces: number;
  reset: () => Promise<void>;
  completeSession: () => Promise<void>;
  groupCode: string | null;
  groupSessionId: string | null;
  groupOwnerUid: string | null;
  groupPhase: GroupPhase;
  groupContext: GroupSessionContext | null;
  endVote: GroupEndVote | null;
  createGroup: () => Promise<GroupSessionDraft>;
  joinGroup: (code: string) => Promise<GroupSessionDraft>;
  startParty: (context?: GroupPartyStartContext) => Promise<void>;
  endParty: () => Promise<void>;
  startEndVote: () => Promise<void>;
  acceptEndVote: () => Promise<void>;
  cancelEndVote: () => Promise<void>;
  setParticipantAvatar: (avatar: string) => Promise<void>;
  currentUserParticipantIndex: number;
  currentUserCanEditActive: boolean;
  hasActiveSession: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function createLocalParticipant(userId?: string, displayName?: string, avatar?: string): SessionParticipant {
  return {
    userId: userId ?? 'local',
    displayName: displayName ?? 'Me',
    avatar: avatar ?? DEFAULT_CAT_AVATAR,
    counts: {},
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const [mode, setModeState] = useState<SessionMode>('single');
  const [draftActive, setDraftActive] = useState(false);
  const [participants, setParticipants] = useState<SessionParticipant[]>([createLocalParticipant()]);
  // The plate currently being viewed is tracked by userId (not a raw index) so it
  // survives realtime draft updates that reorder or mutate the participant list.
  // `null` means "no explicit selection" -> fall back to the current user's own plate.
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [groupSessionId, setGroupSessionId] = useState<string | null>(null);
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [groupOwnerUid, setGroupOwnerUid] = useState<string | null>(null);
  const [groupPhase, setGroupPhase] = useState<GroupPhase>('lobby');
  const [groupContext, setGroupContext] = useState<GroupSessionContext | null>(null);
  const [endVote, setEndVote] = useState<GroupEndVote | null>(null);
  const [localAvatar, setLocalAvatar] = useState<string>(
    () => userProfile?.avatar ?? DEFAULT_CAT_AVATAR,
  );

  // Keep localAvatar in sync with the persisted profile avatar
  useEffect(() => {
    if (!userProfile?.avatar) return;
    setLocalAvatar(userProfile.avatar);
  }, [userProfile?.avatar]);

  const localParticipant = useMemo(
    () => createLocalParticipant(userProfile?.uid, userProfile?.displayName, localAvatar),
    [localAvatar, userProfile?.displayName, userProfile?.uid],
  );

  const currentUserParticipantIndex = participants.findIndex(
    (participant) => participant.userId === userProfile?.uid,
  );

  // Resolve the viewed plate to a concrete index every render. If the viewed
  // participant is unset or has left the party, fall back to the current user's
  // own plate (or index 0 if that is somehow missing), never out of bounds.
  const viewedParticipantIndex = viewedUserId
    ? participants.findIndex((participant) => participant.userId === viewedUserId)
    : -1;
  const activeParticipantIndex =
    viewedParticipantIndex >= 0
      ? viewedParticipantIndex
      : currentUserParticipantIndex >= 0
        ? currentUserParticipantIndex
        : 0;

  // Public API stays index-based; internally we remember the participant's userId
  // so realtime updates keep the same plate in view.
  const setActiveParticipantIndex = useCallback(
    (index: number) => {
      setViewedUserId(participants[index]?.userId ?? null);
    },
    [participants],
  );

  const syncFromDraft = useCallback(
    (draft: GroupSessionDraft) => {
      // Update participant DATA only. Do NOT touch the viewed plate here: doing so
      // would boot a viewer off a teammate's plate on every realtime count push.
      setParticipants(draft.participants);
      setGroupSessionId(draft.id);
      setGroupCode(draft.code);
      setGroupOwnerUid(draft.ownerUid);
      setGroupPhase(draft.phase ?? 'lobby');
      const hasContext =
        draft.restaurantId !== undefined ||
        draft.menuId !== undefined ||
        draft.startedAt !== undefined;
      setGroupContext(
        hasContext
          ? {
              ...(draft.restaurantId !== undefined ? { restaurantId: draft.restaurantId } : {}),
              ...(draft.restaurantName !== undefined ? { restaurantName: draft.restaurantName } : {}),
              ...(draft.location !== undefined ? { location: draft.location } : {}),
              ...(draft.menuId !== undefined ? { menuId: draft.menuId } : {}),
              ...(draft.menuVersion !== undefined ? { menuVersion: draft.menuVersion } : {}),
              ...(draft.startedAt !== undefined ? { startedAt: draft.startedAt } : {}),
            }
          : null,
      );
      setEndVote(draft.endVote ?? null);
      setModeState('group');
      setDraftActive(true);
    },
    [],
  );

  useEffect(() => {
    if (groupSessionId) {
      return;
    }

    setParticipants([localParticipant]);
    setViewedUserId(null);
  }, [groupSessionId, localParticipant]);

  useEffect(() => {
    if (!groupSessionId) {
      return;
    }

    return subscribeToGroupParty(groupSessionId, (draft) => {
      if (!draft) {
        setGroupSessionId(null);
        setGroupCode(null);
        setGroupOwnerUid(null);
        setGroupPhase('lobby');
        setGroupContext(null);
        setEndVote(null);
        setModeState('single');
        setDraftActive(false);
        setParticipants([localParticipant]);
        setViewedUserId(null);
        return;
      }

      syncFromDraft(draft);
    });
  }, [groupSessionId, localParticipant, syncFromDraft]);

  const setMode = useCallback(
    async (nextMode: SessionMode) => {
      const leavingGroup = !!groupSessionId && nextMode !== 'group';

      if (nextMode !== 'group' && groupSessionId) {
        await removeGroupParty(groupSessionId);
        setGroupSessionId(null);
        setGroupCode(null);
        setGroupOwnerUid(null);
        setGroupPhase('lobby');
        setGroupContext(null);
        setEndVote(null);
      }

      setModeState(nextMode);
      setDraftActive(nextMode === 'group' || !leavingGroup);
      setParticipants([localParticipant]);
      setViewedUserId(null);
    },
    [groupSessionId, localParticipant],
  );

  const updateLocalCounts = useCallback((itemId: string, delta: number) => {
    setParticipants((prev) =>
      prev.map((participant, index) => {
        if (index !== activeParticipantIndex) {
          return participant;
        }

        const current = participant.counts[itemId] ?? 0;
        const next = Math.max(0, current + delta);
        return { ...participant, counts: { ...participant.counts, [itemId]: next } };
      }),
    );
  }, [activeParticipantIndex]);

  const updateCounts = useCallback(
    async (itemId: string, delta: number) => {
      if (mode === 'group' && groupSessionId && userProfile) {
        const draft = await updateGroupPartyParticipantCounts(
          groupSessionId,
          userProfile.uid,
          userProfile.displayName,
          itemId,
          delta,
          localAvatar,
        );
        if (draft) {
          syncFromDraft(draft);
        }
        return;
      }

      updateLocalCounts(itemId, delta);
    },
    [groupSessionId, localAvatar, mode, syncFromDraft, updateLocalCounts, userProfile],
  );

  const increment = useCallback((itemId: string) => updateCounts(itemId, 1), [updateCounts]);
  const decrement = useCallback((itemId: string) => updateCounts(itemId, -1), [updateCounts]);

  const getCount = useCallback(
    (itemId: string) => participants[activeParticipantIndex]?.counts[itemId] ?? 0,
    [activeParticipantIndex, participants],
  );

  const totalPieces = Object.values(participants[activeParticipantIndex]?.counts ?? {}).reduce(
    (sum, count) => sum + count,
    0,
  );

  const reset = useCallback(async () => {
    if (mode === 'group' && groupSessionId && userProfile) {
      const draft = await resetGroupPartyParticipantCounts(groupSessionId, userProfile.uid);
      if (draft) {
        syncFromDraft(draft);
      }
      return;
    }

    setParticipants((prev) => prev.map((participant) => ({ ...participant, counts: {} })));
  }, [groupSessionId, mode, syncFromDraft, userProfile]);

  const completeSession = useCallback(async () => {
    if (groupSessionId) {
      await removeGroupParty(groupSessionId);
      setGroupSessionId(null);
      setGroupCode(null);
      setGroupOwnerUid(null);
      setGroupPhase('lobby');
      setGroupContext(null);
      setEndVote(null);
    }

    setModeState('single');
    setDraftActive(false);
    setParticipants([localParticipant]);
    setViewedUserId(null);
  }, [groupSessionId, localParticipant]);

  const createGroup = useCallback(async () => {
    if (!userProfile) {
      throw new Error('Profile unavailable.');
    }

    const draft = await createGroupParty(userProfile.uid, userProfile.displayName, localAvatar);
    syncFromDraft(draft);
    return draft;
  }, [localAvatar, syncFromDraft, userProfile]);

  const joinGroup = useCallback(async (code: string) => {
    if (!userProfile) {
      throw new Error('Profile unavailable.');
    }

    const draft = await joinGroupParty(code, userProfile.uid, userProfile.displayName, localAvatar);
    if (!draft) {
      throw new Error('Group code not found or expired.');
    }

    syncFromDraft(draft);
    return draft;
  }, [localAvatar, syncFromDraft, userProfile]);

  const startParty = useCallback(
    async (context?: GroupPartyStartContext) => {
      if (!groupSessionId || !userProfile) {
        return;
      }

      const draft = await startGroupParty(groupSessionId, userProfile.uid, context);
      if (draft) {
        syncFromDraft(draft);
      }
    },
    [groupSessionId, syncFromDraft, userProfile],
  );

  // Host-only: flip the shared phase to 'ended' and broadcast so every guest follows
  // into their individualized results. Does NOT tear the party down here; the host's
  // own submit/complete flow (and the DO's TTL) handle cleanup.
  const endParty = useCallback(async () => {
    if (!groupSessionId || !userProfile) {
      return;
    }

    const draft = await endGroupParty(groupSessionId, userProfile.uid);
    if (draft) {
      syncFromDraft(draft);
    }
  }, [groupSessionId, syncFromDraft, userProfile]);

  // Host-only: open a vote to end the party (broadcast, phase stays 'active').
  const startEndVote = useCallback(async () => {
    if (!groupSessionId || !userProfile) {
      return;
    }
    const draft = await startEndVoteRequest(groupSessionId, userProfile.uid);
    if (draft) {
      syncFromDraft(draft);
    }
  }, [groupSessionId, syncFromDraft, userProfile]);

  // Any participant: accept the open end vote. The server flips to 'ended' once
  // everyone has accepted.
  const acceptEndVote = useCallback(async () => {
    if (!groupSessionId || !userProfile) {
      return;
    }
    const draft = await acceptEndVoteRequest(groupSessionId, userProfile.uid);
    if (draft) {
      syncFromDraft(draft);
    }
  }, [groupSessionId, syncFromDraft, userProfile]);

  // Host-only: abandon the open end vote.
  const cancelEndVote = useCallback(async () => {
    if (!groupSessionId || !userProfile) {
      return;
    }
    const draft = await cancelEndVoteRequest(groupSessionId, userProfile.uid);
    if (draft) {
      syncFromDraft(draft);
    }
  }, [groupSessionId, syncFromDraft, userProfile]);

  const setParticipantAvatar = useCallback(
    async (avatar: string) => {
      setLocalAvatar(avatar);

      if (mode === 'group' && groupSessionId && userProfile) {
        const draft = await updateGroupPartyParticipantAvatar(
          groupSessionId,
          userProfile.uid,
          userProfile.displayName,
          avatar,
        );
        if (draft) {
          syncFromDraft(draft);
        }
        return;
      }

      setParticipants((prev) =>
        prev.map((participant, index) =>
          index === activeParticipantIndex ? { ...participant, avatar } : participant,
        ),
      );
    },
    [activeParticipantIndex, groupSessionId, mode, syncFromDraft, userProfile],
  );

  const hasActiveSession =
    draftActive ||
    !!groupSessionId ||
    participants.some((participant) =>
      Object.values(participant.counts).some((count) => count > 0),
    );

  const value: SessionContextValue = {
    mode,
    setMode,
    participants,
    activeParticipantIndex,
    setActiveParticipantIndex,
    increment,
    decrement,
    getCount,
    totalPieces,
    reset,
    completeSession,
    groupCode,
    groupSessionId,
    groupOwnerUid,
    groupPhase,
    groupContext,
    endVote,
    createGroup,
    joinGroup,
    startParty,
    endParty,
    startEndVote,
    acceptEndVote,
    cancelEndVote,
    setParticipantAvatar,
    currentUserParticipantIndex,
    currentUserCanEditActive:
      mode !== 'group' || currentUserParticipantIndex === activeParticipantIndex,
    hasActiveSession,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return value;
}
