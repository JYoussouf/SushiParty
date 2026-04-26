import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import type { GeoPoint } from '../types';

export type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied' | 'denied-permanent';

interface UseLocationReturn {
  location: GeoPoint | null;
  permission: LocationPermissionStatus;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const LOCATION_TIMEOUT_MS = 5000;

export function useLocation(autoRequest = true): UseLocationReturn {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [permission, setPermission] = useState<LocationPermissionStatus>('undetermined');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermission(canAskAgain ? 'denied' : 'denied-permanent');
        setLoading(false);
        return;
      }
      setPermission('granted');
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Location timed out — try again.')), LOCATION_TIMEOUT_MS),
      );
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        timeout,
      ]);
      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not get location.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoRequest) void refresh();
  }, [autoRequest, refresh]);

  return { location, permission, loading, error, refresh };
}
