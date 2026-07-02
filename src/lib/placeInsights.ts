import { getUserRestaurantInsights, type RankedItem } from './analytics';
import { placeKey, type ViewedPlace } from './local/placeHistory';
import type { SushiSession } from '../types';

export interface PlaceInsight {
  key: string;
  name: string;
  address?: string;
  /** Whether the user has logged at least one party here. */
  visited: boolean;
  visits: number;
  totalPieces: number;
  lastVisitedAt?: string;
  /** Browsed in the picker but never partied here. */
  lastViewedAt?: string;
  topItems: RankedItem[];
  isFavorite: boolean;
}

/**
 * Unified view of every sushi spot the user has any relationship with:
 * places they had a party at (from session history) and places they only
 * browsed in the picker. The favourite is the pinned override when present,
 * otherwise the most-partied spot.
 */
export function buildPlaceInsights(
  sessions: SushiSession[],
  userId: string,
  viewedPlaces: ViewedPlace[],
  favoriteKey: string | null,
): PlaceInsight[] {
  const visited = getUserRestaurantInsights(sessions, userId).filter(
    (place) =>
      place.restaurantName.trim().length > 0 &&
      place.restaurantName.trim().toLowerCase() !== 'unknown restaurant',
  );

  const byKey = new Map<string, PlaceInsight>();

  for (const place of visited) {
    const key = placeKey(place.restaurantName);
    byKey.set(key, {
      key,
      name: place.restaurantName,
      visited: true,
      visits: place.visits,
      totalPieces: place.totalPieces,
      lastVisitedAt: place.lastVisitedAt,
      topItems: place.topItems,
      isFavorite: false,
    });
  }

  for (const viewed of viewedPlaces) {
    const key = placeKey(viewed.name);
    const existing = byKey.get(key);
    if (existing) {
      // Keep the richer visited record; just annotate the browse timestamp.
      existing.lastViewedAt = viewed.lastViewedAt;
      if (!existing.address && viewed.address) existing.address = viewed.address;
      continue;
    }
    byKey.set(key, {
      key,
      name: viewed.name,
      ...(viewed.address ? { address: viewed.address } : {}),
      visited: false,
      visits: 0,
      totalPieces: 0,
      lastViewedAt: viewed.lastViewedAt,
      topItems: [],
      isFavorite: false,
    });
  }

  const all = Array.from(byKey.values());

  // Resolve the favourite: pinned override if it still exists, else the
  // most-visited spot (ties broken by total pieces).
  const visitedSorted = all
    .filter((place) => place.visited)
    .sort((a, b) => b.visits - a.visits || b.totalPieces - a.totalPieces);

  const pinned = favoriteKey ? all.find((place) => place.key === favoriteKey) : undefined;
  const favorite = pinned ?? visitedSorted[0];
  if (favorite) favorite.isFavorite = true;

  return all.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    if (a.visited !== b.visited) return a.visited ? -1 : 1;
    if (a.visited && b.visited) {
      return b.visits - a.visits || b.totalPieces - a.totalPieces;
    }
    // Both view-only: most recently browsed first.
    return (b.lastViewedAt ?? '').localeCompare(a.lastViewedAt ?? '');
  });
}

export function getFavoritePlace(places: PlaceInsight[]): PlaceInsight | null {
  return places.find((place) => place.isFavorite) ?? null;
}
