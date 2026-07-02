import type { Restaurant } from '../types';

export type FeedRestaurant = Restaurant & { distanceKm?: number };

/**
 * Ordering for the "Sushi near you" feed: paid/featured spots first (that's the
 * premium placement restaurants pay for), then everyone else by distance.
 * Stable and pure so it can be unit-tested and reused.
 */
export function sortNearbyFeed(list: FeedRestaurant[]): FeedRestaurant[] {
  return [...list].sort((a, b) => {
    if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    return da - db;
  });
}

/** Render a 0..4 Google price level as $-signs ('' when unknown). */
export function priceLevelLabel(level?: number): string {
  if (level === undefined || level <= 0) return '';
  return '$'.repeat(Math.min(4, level));
}

/** One-decimal rating string, or null when there are no reviews. */
export function formatRating(rating?: number, count?: number): string | null {
  if (typeof rating !== 'number' || !count) return null;
  return rating.toFixed(1);
}
