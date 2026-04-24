import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  createGroupSession,
  getGroupSessionById,
  joinGroupSession,
  removeGroupSession,
  resetGroupParticipantCounts,
  updateGroupParticipantCounts,
} from '../lib/local/groupSessions';
import type { GroupSessionDraft, SessionMode, SessionParticipant } from '../types';

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
  createGroup: () => Promise<GroupSessionDraft>;
  joinGroup: (code: string) => Promise<GroupSessionDraft>;
  currentUserParticipantIndex: number;
  currentUserCanEditActive: boolean;
  hasActiveSession: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function createLocalParticipant(userId?: string, displayName?: string): SessionParticipant {
  return {
    userId: userId ?? 'local',
    displayName: displayName ?? 'Me',
    counts: {},
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const [mode, setModeState] = useState<SessionMode>('single');
  const [participants, setParticipants] = useState<SessionParticipant[]>([createLocalParticipant()]);
  const [activeParticipantIndex, setActiveParticipantIndex] = useState(0);
  const [groupSessionId, setGroupSessionId] = useState<string | null>(null);
  const [groupCode, setGroupCode] = useState<string | null>(null);

  const localParticipant = useMemo(
    () => createLocalParticipant(userProfile?.uid, userProfile?.displayName),
    [userProfile?.displayName, userProfile?.uid],
  );

  const syncFromDraft = useCallback(
    (draft: GroupSessionDraft) => {
      setParticipants(draft.participants);
      setGroupSessionId(draft.id);
      setGroupCode(draft.code);
      setModeState('group');

      const participantIndex = draft.participants.findIndex(
        (participant) => participant.userId === userProfile?.uid,
      );
      if (participantIndex >= 0) {
        setActiveParticipantIndex(participantIndex);
      }
    },
    [userProfile?.uid],
  );

  useEffect(() => {
    if (groupSessionId) {
      return;
    }

    setParticipants([localParticipant]);
    setActiveParticipantIndex(0);
  }, [groupSessionId, localParticipant]);

  useEffect(() => {
    if (!groupSessionId) {
      return;
    }

    let active = true;

    const sync = async () => {
      const draft = await getGroupSessionById(groupSessionId);
      if (!active) {
        return;
      }

      if (!draft) {
        setGroupSessionId(null);
        setGroupCode(null);
        setModeState('single');
        setParticipants([localParticipant]);
        setActiveParticipantIndex(0);
        return;
      }

      syncFromDraft(draft);
    };

    void sync();
    const interval = setInterval(() => {
      void sync();
    }, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [groupSessionId, localParticipant, syncFromDraft]);

  const setMode = useCallback(
    async (nextMode: SessionMode) => {
      if (nextMode !== 'group' && groupSessionId) {
        await removeGroupSession(groupSessionId);
        setGroupSessionId(null);
        setGroupCode(null);
      }

      setModeState(nextMode);
      setParticipants([localParticipant]);
      setActiveParticipantIndex(0);
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
        const draft = await updateGroupParticipantCounts(
          groupSessionId,
          userProfile.uid,
          userProfile.displayName,
          itemId,
          delta,
        );
        if (draft) {
          syncFromDraft(draft);
        }
        return;
      }

      updateLocalCounts(itemId, delta);
    },
    [groupSessionId, mode, syncFromDraft, updateLocalCounts, userProfile],
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
      const draft = await resetGroupParticipantCounts(groupSessionId, userProfile.uid);
      if (draft) {
        syncFromDraft(draft);
      }
      return;
    }

    setParticipants((prev) => prev.map((participant) => ({ ...participant, counts: {} })));
  }, [groupSessionId, mode, syncFromDraft, userProfile]);

  const completeSession = useCallback(async () => {
    if (groupSessionId) {
      await removeGroupSession(groupSessionId);
      setGroupSessionId(null);
      setGroupCode(null);
    }

    setModeState('single');
    setParticipants([localParticipant]);
    setActiveParticipantIndex(0);
  }, [groupSessionId, localParticipant]);

  const createGroup = useCallback(async () => {
    if (!userProfile) {
      throw new Error('Profile unavailable.');
    }

    const draft = await createGroupSession(userProfile.uid, userProfile.displayName);
    syncFromDraft(draft);
    return draft;
  }, [syncFromDraft, userProfile]);

  const joinGroup = useCallback(async (code: string) => {
    if (!userProfile) {
      throw new Error('Profile unavailable.');
    }

    const draft = await joinGroupSession(code, userProfile.uid, userProfile.displayName);
    if (!draft) {
      throw new Error('Group code not found or expired.');
    }

    syncFromDraft(draft);
    return draft;
  }, [syncFromDraft, userProfile]);

  const currentUserParticipantIndex = participants.findIndex(
    (participant) => participant.userId === userProfile?.uid,
  );

  const hasActiveSession =
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
    createGroup,
    joinGroup,
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
