import { globalMenuItemsById } from './menus/globalMenu';
import { getParticipantTotalPieces } from './sessionSummary';
import type { SushiSession } from '../types';

export interface RankedItem {
  id: string;
  name: string;
  count: number;
  sessionCount: number;
}

export interface RankedRestaurant {
  restaurantName: string;
  visits: number;
  totalPieces: number;
  lastVisitedAt: string;
  topItems: RankedItem[];
}

function getUserParticipant(session: SushiSession, userId: string) {
  return session.participants.find((participant) => participant.userId === userId) ?? null;
}

export function getUserTopItems(sessions: SushiSession[], userId: string): RankedItem[] {
  const counts = new Map<string, number>();
  const sessionCounts = new Map<string, number>();

  for (const session of sessions) {
    const participant = getUserParticipant(session, userId);
    if (!participant) continue;

    for (const [itemId, count] of Object.entries(participant.counts)) {
      counts.set(itemId, (counts.get(itemId) ?? 0) + count);
      if (count > 0) {
        sessionCounts.set(itemId, (sessionCounts.get(itemId) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .map(([itemId, count]) => ({
      id: itemId,
      name: globalMenuItemsById[itemId]?.name ?? itemId,
      count,
      sessionCount: sessionCounts.get(itemId) ?? 0,
    }))
    .sort((left, right) => right.count - left.count);
}

export function getUserRestaurantInsights(
  sessions: SushiSession[],
  userId: string,
): RankedRestaurant[] {
  const restaurantMap = new Map<
    string,
    { visits: number; totalPieces: number; lastVisitedAt: string; itemCounts: Map<string, number> }
  >();

  for (const session of sessions) {
    const participant = getUserParticipant(session, userId);
    if (!participant) continue;

    const existing =
      restaurantMap.get(session.restaurantName) ??
      {
        visits: 0,
        totalPieces: 0,
        lastVisitedAt: session.submittedAt ?? session.startedAt,
        itemCounts: new Map<string, number>(),
      };

    existing.visits += 1;
    existing.totalPieces += getParticipantTotalPieces(participant);

    const visitedAt = session.submittedAt ?? session.startedAt;
    if (new Date(visitedAt).getTime() > new Date(existing.lastVisitedAt).getTime()) {
      existing.lastVisitedAt = visitedAt;
    }

    for (const [itemId, count] of Object.entries(participant.counts)) {
      existing.itemCounts.set(itemId, (existing.itemCounts.get(itemId) ?? 0) + count);
    }

    restaurantMap.set(session.restaurantName, existing);
  }

  return Array.from(restaurantMap.entries())
    .map(([restaurantName, value]) => ({
      restaurantName,
      visits: value.visits,
      totalPieces: value.totalPieces,
      lastVisitedAt: value.lastVisitedAt,
      topItems: Array.from(value.itemCounts.entries())
        .map(([itemId, count]) => ({
          id: itemId,
          name: globalMenuItemsById[itemId]?.name ?? itemId,
          count,
          sessionCount: 0,
        }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 3),
    }))
    .sort((left, right) => right.visits - left.visits || right.totalPieces - left.totalPieces);
}
