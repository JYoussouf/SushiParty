import { globalMenuItemsById } from './menus/globalMenu';
import { getParticipantTotalPieces } from './sessionSummary';
import type { SushiSession } from '../types';

export interface UserProfileStats {
  totalSessions: number;
  totalPieces: number;
  averagePiecesPerSession: number;
  favoriteRestaurant: string | null;
  favoriteRestaurantVisits: number;
  mostOrderedItem: string | null;
  mostOrderedItemCount: number;
  recentStreakWeeks: number;
  lastSessionAt: string | null;
}

function getWeekStart(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  return copy.getTime();
}

export function calculateUserProfileStats(
  sessions: SushiSession[],
  userId: string,
): UserProfileStats {
  const participantSessions = sessions
    .map((session) => ({
      session,
      participant: session.participants.find((participant) => participant.userId === userId) ?? null,
    }))
    .filter(
      (entry): entry is { session: SushiSession; participant: NonNullable<(typeof entry)['participant']> } =>
        !!entry.participant,
    );

  if (participantSessions.length === 0) {
    return {
      totalSessions: 0,
      totalPieces: 0,
      averagePiecesPerSession: 0,
      favoriteRestaurant: null,
      favoriteRestaurantVisits: 0,
      mostOrderedItem: null,
      mostOrderedItemCount: 0,
      recentStreakWeeks: 0,
      lastSessionAt: null,
    };
  }

  const restaurantVisits = new Map<string, number>();
  const itemCounts = new Map<string, number>();
  const weekStarts = new Set<number>();

  let totalPieces = 0;
  let lastSessionAt: string | null = null;

  for (const { session, participant } of participantSessions) {
    const sessionDate = session.submittedAt ?? session.startedAt;
    const pieces = getParticipantTotalPieces(participant);

    totalPieces += pieces;
    restaurantVisits.set(
      session.restaurantName,
      (restaurantVisits.get(session.restaurantName) ?? 0) + 1,
    );

    for (const [itemId, count] of Object.entries(participant.counts)) {
      itemCounts.set(itemId, (itemCounts.get(itemId) ?? 0) + count);
    }

    weekStarts.add(getWeekStart(new Date(sessionDate)));

    if (!lastSessionAt || new Date(sessionDate).getTime() > new Date(lastSessionAt).getTime()) {
      lastSessionAt = sessionDate;
    }
  }

  const favoriteRestaurantEntry =
    Array.from(restaurantVisits.entries()).sort((left, right) => right[1] - left[1])[0] ?? null;

  const mostOrderedItemEntry =
    Array.from(itemCounts.entries()).sort((left, right) => right[1] - left[1])[0] ?? null;

  let recentStreakWeeks = 0;
  if (lastSessionAt) {
    let currentWeek = getWeekStart(new Date(lastSessionAt));
    while (weekStarts.has(currentWeek)) {
      recentStreakWeeks += 1;
      currentWeek -= 7 * 24 * 60 * 60 * 1000;
    }
  }

  return {
    totalSessions: participantSessions.length,
    totalPieces,
    averagePiecesPerSession: Math.round(totalPieces / participantSessions.length),
    favoriteRestaurant: favoriteRestaurantEntry?.[0] ?? null,
    favoriteRestaurantVisits: favoriteRestaurantEntry?.[1] ?? 0,
    mostOrderedItem: mostOrderedItemEntry
      ? globalMenuItemsById[mostOrderedItemEntry[0]]?.name ?? mostOrderedItemEntry[0]
      : null,
    mostOrderedItemCount: mostOrderedItemEntry?.[1] ?? 0,
    recentStreakWeeks,
    lastSessionAt,
  };
}
