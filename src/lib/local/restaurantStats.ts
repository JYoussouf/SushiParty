import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateRestaurantStats } from '../stats/anomalyDetection';
import type { RestaurantStats } from '../../types';

const LOCAL_RESTAURANT_STATS_KEY = 'sushi-party/restaurant-stats';

type RestaurantStatsMap = Record<string, RestaurantStats>;

async function readRestaurantStatsMap(): Promise<RestaurantStatsMap> {
  const raw = await AsyncStorage.getItem(LOCAL_RESTAURANT_STATS_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as RestaurantStatsMap;
  } catch {
    return {};
  }
}

async function writeRestaurantStatsMap(statsMap: RestaurantStatsMap): Promise<void> {
  await AsyncStorage.setItem(LOCAL_RESTAURANT_STATS_KEY, JSON.stringify(statsMap));
}

export function createEmptyRestaurantStats(): RestaurantStats {
  return {
    totalSessions: 0,
    meanPiecesPerSession: 0,
    stdDevPiecesPerSession: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function getRestaurantStats(
  restaurantId: string,
  fallback?: RestaurantStats,
): Promise<RestaurantStats> {
  const statsMap = await readRestaurantStatsMap();
  return statsMap[restaurantId] ?? fallback ?? createEmptyRestaurantStats();
}

export async function recordRestaurantSession(
  restaurantId: string,
  totalPieces: number,
  fallback?: RestaurantStats,
): Promise<RestaurantStats> {
  const statsMap = await readRestaurantStatsMap();
  const current = statsMap[restaurantId] ?? fallback ?? createEmptyRestaurantStats();
  const nextCore = updateRestaurantStats(current, totalPieces);
  const next: RestaurantStats = {
    ...nextCore,
    updatedAt: new Date().toISOString(),
  };

  await writeRestaurantStatsMap({
    ...statsMap,
    [restaurantId]: next,
  });

  return next;
}
