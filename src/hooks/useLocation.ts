import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import type { GeoPoint } from '../types';

export type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied';

interface UseLocationReturn {
  location: GeoPoint | null;
  permission: LocationPermissionStatus;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLocation(autoRequest = true): UseLocationReturn {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [permission, setPermission] = useState<LocationPermissionStatus>('undetermined');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status === 'granted' ? 'granted' : 'denied');
      if (status !== 'granted') {
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
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
