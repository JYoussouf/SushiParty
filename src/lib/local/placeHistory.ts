import AsyncStorage from '@react-native-async-storage/async-storage';

// Local record of sushi spots the user has *browsed* in the restaurant picker,
// plus a manual "favourite spot" override. Parties-attended data already lives
// in the session history (see analytics.getUserRestaurantInsights); this store
// only captures the lighter-weight "viewed" signal and the pinned favourite.

const VIEWED_PLACES_KEY = 'sushi-party/viewed-places';
const FAVORITE_PLACE_KEY = 'sushi-party/favorite-place-key';

const MAX_VIEWED_PLACES = 50;

export interface ViewedPlace {
  id: string;
  name: string;
  address?: string;
  lastViewedAt: string; // ISO
  viewCount: number;
}

/** Normalized identity for a place, so viewed + visited records line up by name. */
export function placeKey(name: string): string {
  return name.trim().toLowerCase();
}

export async function getViewedPlaces(): Promise<ViewedPlace[]> {
  const raw = await AsyncStorage.getItem(VIEWED_PLACES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ViewedPlace[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Record that the user opened/selected a place in the picker. Idempotent per
 * place key: bumps the view count and timestamp rather than duplicating.
 */
export async function recordViewedPlace(place: {
  id: string;
  name: string;
  address?: string;
}): Promise<void> {
  const name = place.name.trim();
  if (!name) return;

  const key = placeKey(name);
  const existing = await getViewedPlaces();
  const now = new Date().toISOString();

  const next = existing.filter((entry) => placeKey(entry.name) !== key);
  const prior = existing.find((entry) => placeKey(entry.name) === key);
  next.unshift({
    id: place.id,
    name,
    ...(place.address?.trim() ? { address: place.address.trim() } : {}),
    lastViewedAt: now,
    viewCount: (prior?.viewCount ?? 0) + 1,
  });

  await AsyncStorage.setItem(
    VIEWED_PLACES_KEY,
    JSON.stringify(next.slice(0, MAX_VIEWED_PLACES)),
  );
}

export async function getFavoritePlaceKey(): Promise<string | null> {
  return AsyncStorage.getItem(FAVORITE_PLACE_KEY);
}

/** Pin (or, with null, un-pin) the user's favourite spot by name. */
export async function setFavoritePlaceKey(name: string | null): Promise<void> {
  if (name === null) {
    await AsyncStorage.removeItem(FAVORITE_PLACE_KEY);
    return;
  }
  await AsyncStorage.setItem(FAVORITE_PLACE_KEY, placeKey(name));
}

export async function clearPlaceHistory(): Promise<void> {
  await AsyncStorage.multiRemove([VIEWED_PLACES_KEY, FAVORITE_PLACE_KEY]);
}
