import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firestore';
import { haversineKm, latitudeBounds } from '../geo';
import type { Restaurant, GeoPoint } from '../../types';

const DEFAULT_RADIUS_KM = 10;
const MAX_RESULTS = 50;

export async function getRestaurant(id: string): Promise<Restaurant | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.RESTAURANTS, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Restaurant) : null;
}

export async function getNearbyRestaurants(
  center: GeoPoint,
  radiusKm = DEFAULT_RADIUS_KM,
): Promise<Array<Restaurant & { distanceKm: number }>> {
  const bounds = latitudeBounds(center, radiusKm);
  const q = query(
    collection(db, COLLECTIONS.RESTAURANTS),
    where('location.latitude', '>=', bounds.min),
    where('location.latitude', '<=', bounds.max),
    orderBy('location.latitude'),
    limit(MAX_RESULTS),
  );
  const snap = await getDocs(q);
  const results = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Restaurant)
    .map((r) => ({ ...r, distanceKm: haversineKm(center, r.location) }))
    .filter((r) => r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}

export async function searchRestaurantsByName(
  needle: string,
): Promise<Restaurant[]> {
  const lower = needle.trim().toLowerCase();
  if (lower.length < 2) return [];
  // Firestore has no substring search — we use a prefix match on a lowercased name field.
  // Callers writing restaurant docs set `nameLower` to the lowercased name for this query.
  const q = query(
    collection(db, COLLECTIONS.RESTAURANTS),
    where('nameLower', '>=', lower),
    where('nameLower', '<=', `${lower}\uf8ff`),
    limit(20),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Restaurant);
}

interface CreateRestaurantInput {
  name: string;
  address: string;
  location: GeoPoint;
  menuId?: string; // defaults to global-default
}

export async function createRestaurant(input: CreateRestaurantInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.RESTAURANTS), {
    name: input.name.trim(),
    nameLower: input.name.trim().toLowerCase(),
    address: input.address.trim(),
    location: input.location,
    menuId: input.menuId ?? 'global-default',
    stats: {
      totalSessions: 0,
      meanPiecesPerSession: 0,
      stdDevPiecesPerSession: 0,
      updatedAt: serverTimestamp(),
    },
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
