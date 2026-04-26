import type { GeoPoint, Restaurant } from '../../types';
import { apiRequest, encodeQuery } from './client';

type RestaurantWithDistance = Restaurant & { distanceKm?: number };

export async function getRestaurant(id: string): Promise<Restaurant | null> {
  try {
    const { restaurant } = await apiRequest<{ restaurant: Restaurant }>(
      `/restaurants/${encodeURIComponent(id)}`,
    );
    return restaurant;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
      return null;
    }
    throw error;
  }
}

export async function getNearbyRestaurants(
  center: GeoPoint,
  radiusKm = 5,
): Promise<RestaurantWithDistance[]> {
  const { restaurants } = await apiRequest<{ restaurants: RestaurantWithDistance[] }>(
    `/places/nearby${encodeQuery({ lat: center.latitude, lng: center.longitude, radiusKm })}`,
  );
  return restaurants;
}

export async function searchRestaurantsByName(
  needle: string,
  center?: GeoPoint,
): Promise<RestaurantWithDistance[]> {
  const q = needle.trim();
  if (q.length < 2) return [];

  const { restaurants } = await apiRequest<{ restaurants: RestaurantWithDistance[] }>(
    `/places/search${encodeQuery({ q, lat: center?.latitude, lng: center?.longitude })}`,
  );
  return restaurants;
}

interface CreateRestaurantInput {
  name: string;
  address: string;
  location: GeoPoint;
  menuId?: string;
}

export async function createRestaurant(input: CreateRestaurantInput): Promise<string> {
  const { id } = await apiRequest<{ id: string }>('/restaurants', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return id;
}
