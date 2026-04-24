import type { GeoPoint } from '../types';

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two points in kilometers.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Latitude-only bounding box for a Firestore range query.
 * One degree of latitude ≈ 111 km everywhere. Longitude is filtered client-side
 * because Firestore only supports range filters on a single field per query.
 */
export function latitudeBounds(center: GeoPoint, radiusKm: number): { min: number; max: number } {
  const delta = radiusKm / 111;
  return { min: center.latitude - delta, max: center.latitude + delta };
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
