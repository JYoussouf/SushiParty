import { globalMenu, globalMenuItemsById } from './menus/globalMenu';
import { getParticipantTotalPieces } from './sessionSummary';
import { getCategoryLabel } from './categoryLabels';
import type { SushiSession } from '../types';

export interface RankedItem {
  id: string;
  name: string;
  count: number;
  sessionCount: number;
}

export interface RankedCategory {
  category: string;
  label: string;
  totalCount: number;
  subItems: RankedItem[];
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

export function getUserTopCategories(
  sessions: SushiSession[],
  userId: string,
): RankedCategory[] {
  const itemCounts = new Map<string, number>();
  const itemSessionCounts = new Map<string, number>();

  for (const session of sessions) {
    const participant = getUserParticipant(session, userId);
    if (!participant) continue;

    for (const [itemId, count] of Object.entries(participant.counts)) {
      itemCounts.set(itemId, (itemCounts.get(itemId) ?? 0) + count);
      if (count > 0) {
        itemSessionCounts.set(itemId, (itemSessionCounts.get(itemId) ?? 0) + 1);
      }
    }
  }

  const categoryTotals = new Map<string, number>();
  const categorySubItems = new Map<string, RankedItem[]>();

  for (const menuItem of globalMenu.items) {
    const count = itemCounts.get(menuItem.id) ?? 0;
    if (count === 0) continue;

    const cat = menuItem.category;
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + count);

    if (!menuItem.id.endsWith('-any')) {
      const subItems = categorySubItems.get(cat) ?? [];
      subItems.push({
        id: menuItem.id,
        name: menuItem.name,
        count,
        sessionCount: itemSessionCounts.get(menuItem.id) ?? 0,
      });
      categorySubItems.set(cat, subItems);
    }
  }

  return Array.from(categoryTotals.entries())
    .map(([category, totalCount]) => ({
      category,
      label: getCategoryLabel(category),
      totalCount,
      subItems: (categorySubItems.get(category) ?? []).sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.totalCount - a.totalCount);
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
        .map(([itemId, count]) => {
          const menuItem = globalMenuItemsById[itemId];
          const isAny = itemId.endsWith('-any');
          const name = isAny
            ? (menuItem ? getCategoryLabel(menuItem.category) : itemId)
            : (menuItem?.name ?? itemId);
          return { id: itemId, name, count, sessionCount: 0 };
        })
        .sort((left, right) => right.count - left.count)
        .slice(0, 3),
    }))
    .sort((left, right) => right.visits - left.visits || right.totalPieces - left.totalPieces);
}
