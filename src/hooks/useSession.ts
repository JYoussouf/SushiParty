import { useState, useCallback } from 'react';
import type { SessionMode, SessionParticipant } from '../types';

interface UseSessionReturn {
  mode: SessionMode;
  setMode: (mode: SessionMode) => void;
  participants: SessionParticipant[];
  activeParticipantIndex: number;
  setActiveParticipantIndex: (index: number) => void;
  increment: (itemId: string) => void;
  decrement: (itemId: string) => void;
  getCount: (itemId: string) => number;
  totalPieces: number;
  reset: () => void;
}

export function useSession(initialMode: SessionMode = 'single'): UseSessionReturn {
  const [mode, setMode] = useState<SessionMode>(initialMode);
  const [activeParticipantIndex, setActiveParticipantIndex] = useState(0);
  const [participants, setParticipants] = useState<SessionParticipant[]>([
    { userId: 'local', displayName: 'Me', counts: {} },
  ]);

  const updateCounts = useCallback(
    (itemId: string, delta: number) => {
      setParticipants((prev) =>
        prev.map((p, i) => {
          if (i !== activeParticipantIndex) return p;
          const current = p.counts[itemId] ?? 0;
          const next = Math.max(0, current + delta);
          return { ...p, counts: { ...p.counts, [itemId]: next } };
        }),
      );
    },
    [activeParticipantIndex],
  );

  const increment = useCallback((itemId: string) => updateCounts(itemId, 1), [updateCounts]);
  const decrement = useCallback((itemId: string) => updateCounts(itemId, -1), [updateCounts]);

  const getCount = useCallback(
    (itemId: string) => participants[activeParticipantIndex]?.counts[itemId] ?? 0,
    [participants, activeParticipantIndex],
  );

  const totalPieces = Object.values(
    participants[activeParticipantIndex]?.counts ?? {},
  ).reduce((sum, n) => sum + n, 0);

  const reset = useCallback(() => {
    setParticipants((prev) => prev.map((p) => ({ ...p, counts: {} })));
  }, []);

  return {
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
  };
}
