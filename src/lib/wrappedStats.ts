import { calculateUserProfileStats } from './profileStats';
import { getUserRestaurantInsights, getUserTopCategories } from './analytics';
import { getParticipantTotalPieces } from './sessionSummary';
import { calculateLevel, levelTitle } from './leveling';
import { getAchievements } from './achievements';
import type { SushiSession } from '../types';

export interface WrappedStats {
  totalParties: number;
  totalPieces: number;
  favoriteRestaurant: string | null;
  distinctRestaurants: number;
  topDish: string | null;
  topDishCount: number;
  topCategory: string | null;
  biggestParty: number;
  level: number;
  levelTitle: string;
  hasData: boolean;
}

export const EMPTY_WRAPPED_STATS: WrappedStats = {
  totalParties: 0,
  totalPieces: 0,
  favoriteRestaurant: null,
  distinctRestaurants: 0,
  topDish: null,
  topDishCount: 0,
  topCategory: null,
  biggestParty: 0,
  level: 1,
  levelTitle: levelTitle(1),
  hasData: false,
};

/**
 * Rolls the user's whole party history into the handful of headline numbers
 * that the shareable "Wrapped" card celebrates.
 */
export function buildWrappedStats(sessions: SushiSession[], userId: string): WrappedStats {
  const profile = calculateUserProfileStats(sessions, userId);
  if (profile.totalSessions === 0) return EMPTY_WRAPPED_STATS;

  const restaurants = getUserRestaurantInsights(sessions, userId);
  const categories = getUserTopCategories(sessions, userId);

  let biggestParty = 0;
  for (const session of sessions) {
    const participant = session.participants.find((p) => p.userId === userId);
    if (!participant) continue;
    biggestParty = Math.max(biggestParty, getParticipantTotalPieces(participant));
  }

  const level = calculateLevel(getAchievements(sessions, userId));

  return {
    totalParties: profile.totalSessions,
    totalPieces: profile.totalPieces,
    favoriteRestaurant: profile.favoriteRestaurant,
    distinctRestaurants: restaurants.length,
    topDish: profile.mostOrderedItem,
    topDishCount: profile.mostOrderedItemCount,
    topCategory: categories[0]?.label ?? null,
    biggestParty,
    level: level.level,
    levelTitle: levelTitle(level.level),
    hasData: true,
  };
}

/** Plain-text fallback shared alongside/instead of the card image. */
export function buildWrappedShareText(stats: WrappedStats, displayName: string): string {
  const lines = [
    `${displayName}'s Sushi Party Wrapped 🍣`,
    `${stats.totalPieces} pieces across ${stats.totalParties} parties`,
  ];
  if (stats.favoriteRestaurant) lines.push(`Favourite spot: ${stats.favoriteRestaurant}`);
  if (stats.topDish) lines.push(`Top dish: ${stats.topDish}`);
  lines.push('Tracked with Sushi Party');
  return lines.join('\n');
}
