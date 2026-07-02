import { useEffect, useState } from 'react';
import { useLocation } from './useLocation';
import { getNearbyRestaurants } from '../lib/cloudflare/restaurants';
import { sortNearbyFeed, type FeedRestaurant } from '../lib/featuredFeed';

interface UseNearbyFeedReturn {
  restaurants: FeedRestaurant[];
  loading: boolean;
  error: string | null;
  permission: ReturnType<typeof useLocation>['permission'];
  refresh: () => Promise<void>;
}

/**
 * Loads sushi spots near the device for the home-screen feed, sorted with
 * featured (paid) placements first. Reacts to the resolved location.
 */
export function useNearbyFeed(): UseNearbyFeedReturn {
  const {
    location,
    permission,
    loading: locLoading,
    error: locError,
    refresh: refreshLocation,
  } = useLocation();
  const [restaurants, setRestaurants] = useState<FeedRestaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNearby = async (coords: { latitude: number; longitude: number }) => {
    setLoading(true);
    setError(null);
    try {
      const results = await getNearbyRestaurants(coords);
      setRestaurants(sortNearbyFeed(results));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load nearby spots.');
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!location) return;
    void fetchNearby(location);
  }, [location]);

  const refresh = async () => {
    if (location) {
      await fetchNearby(location);
    } else {
      await refreshLocation();
    }
  };

  // Surface a location-acquisition error (e.g. a GPS timeout) so the feed can
  // show its retry affordance instead of a misleading "none found" empty state.
  return { restaurants, loading: loading || locLoading, error: error ?? locError, permission, refresh };
}
